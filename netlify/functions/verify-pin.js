const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

// --- Firebase Admin SDK ইনিশিয়ালাইজেশন (Base64 ডিকোডিং সহ) ---

// 1. আপনার এনভায়রনমেন্ট ভেরিয়েবলের নাম অনুযায়ী Base64 স্ট্রিংটি নিন
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

// নিশ্চিত করুন যে ভেরিয়েবলটি বিদ্যমান
if (serviceAccountBase64) {
    try {
        // 2. Base64 থেকে ডিকোড করে মূল JSON স্ট্রিং-এ পরিণত করুন
        const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');

        // 3. JSON স্ট্রিংটিকে পার্স করে একটি অবজেক্টে পরিণত করুন
        const serviceAccount = JSON.parse(serviceAccountJson);

        // 4. Firebase Admin SDK ইনিশিয়ালাইজ করুন (যদি আগে না করা হয়ে থাকে)
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: process.env.FIREBASE_DB_URL
            });
        }
    } catch (e) {
        console.error("Firebase Admin SDK initialization failed:", e);
    }
} else {
    console.error("FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set.");
}


// --- Netlify ফাংশন হ্যান্ডলার ---

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // CORS preflight রিকোয়েস্ট হ্যান্ডেল করার জন্য
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // শুধুমাত্র POST রিকোয়েস্ট গ্রহণ করা হবে
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body);
        const { token } = body;

        // টোকেন পাঠানো হয়েছে কিনা তা চেক করুন
        if (!token) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Token is required.' }) };
        }

        // JWT Secret কী এনভায়রনমেন্ট ভেরিয়েবল থেকে নিন
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
            console.error("JWT_SECRET environment variable is not set.");
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error.' }) };
        }
        
        // টোকেনটি ভেরিফাই এবং ডিকোড করুন
        const decoded = jwt.verify(token, JWT_SECRET);
        const { deviceId, verification_token } = decoded;

        // টোকেনের payload সঠিক কিনা তা চেক করুন
        if (!deviceId || !verification_token) {
             return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid token payload.' }) };
        }

        // ভেরিফিকেশনের মেয়াদকাল এনভায়রনমেন্ট ভেরিয়েবল থেকে নিন (ডিফল্ট ৪৮ ঘণ্টা)
        const verificationDurationHours = parseInt(process.env.VERIFICATION_HOURS, 10) || 48;
        const durationMillis = verificationDurationHours * 60 * 60 * 1000;
        const expirationTime = Date.now() + durationMillis;

        // Firebase ডাটাবেসে ভেরিফাইড ডিভাইসটি সেভ করুন
        await admin.database().ref('verified_devices/' + deviceId).set({
            expiration: expirationTime,
            last_token: verification_token
        });

        // সফলভাবে ভেরিফাই হলে বার্তা পাঠান
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: `Successfully verified device: ${deviceId}` })
        };

    } catch (error) {
        console.error('Verification failed:', error);
        
        // ভেরিফিকেশন ব্যর্থ হলে ত্রুটির বার্তা পাঠান
        let errorMessage = 'Verification failed.';
        if (error.name === 'JsonWebTokenError') {
             errorMessage = 'Invalid token.';
             return { statusCode: 401, headers, body: JSON.stringify({ error: errorMessage }) };
        } else if (error.name === 'TokenExpiredError') {
            errorMessage = 'Token has expired.';
            return { statusCode: 401, headers, body: JSON.stringify({ error: errorMessage }) };
        }

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: errorMessage, details: error.message })
        };
    }
};
