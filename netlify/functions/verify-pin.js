const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

// Firebase Admin SDK ইনিশিয়ালাইজেশন (সবচেয়ে নিরাপদ পদ্ধতি ব্যবহার করে)
try {
    // Netlify এনভায়রনমেন্ট ভ্যারিয়েবল থেকে Base64-এনকোডেড সার্ভিস অ্যাকাউন্ট কী ডিকোড করা হচ্ছে
    const serviceAccountJson = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    // Firebase অ্যাপটি আগে থেকে ইনিশিয়ালাইজ করা না থাকলে তবেই করা হচ্ছে
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DB_URL
        });
    }
} catch (e) {
    console.error('Firebase Admin Initialization Error:', e);
    // যদি ইনিশিয়ালাইজেশন ব্যর্থ হয়, তবে ফাংশনটি কাজ করা থেকে বিরত থাকবে
}

// এই ফাংশনটি ভেরিফিকেশন টোকেন যাচাই করে এবং সফল হলে Firebase এ ডেটা আপডেট করে
exports.handler = async (event) => {
    // ব্রাউজার থেকে অ্যাক্সেসের জন্য CORS হেডার
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // OPTIONS মেথড হ্যান্ডেল করার জন্য (CORS pre-flight রিকোয়েস্ট)
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // শুধুমাত্র POST মেথড গ্রহণ করা হবে
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body);
        const { token } = body;

        // টোকেন পাঠানো হয়েছে কিনা তা চেক করা হচ্ছে
        if (!token) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Token is required.' }) };
        }

        // এনভায়রনমেন্ট ভ্যারিয়েবল থেকে JWT সিক্রেট কী নেওয়া হচ্ছে
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
            console.error('JWT_SECRET environment variable is not set.');
            return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error.' }) };
        }
        
        // JWT ভেরিফাই করা হচ্ছে। ভুল বা মেয়াদোত্তীর্ণ হলে এটি একটি এরর থ্রো করবে।
        const decoded = jwt.verify(token, JWT_SECRET);
        const { deviceId, verification_token } = decoded;

        // টোকেনের ভেতরে প্রয়োজনীয় ডেটা আছে কিনা তা চেক করা হচ্ছে
        if (!deviceId || !verification_token) {
             return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid token payload.' }) };
        }
        
        const db = admin.database();

        // === নতুন এবং গুরুত্বপূর্ণ: ব্লকড ডিভাইস চেক ===
        const blockSnapshot = await db.ref(`blocked_devices/${deviceId}`).once('value');
        if (blockSnapshot.exists()) {
            console.log(`Verification blocked for device: ${deviceId}`);
            return {
                statusCode: 403, // 403 Forbidden - অ্যাক্সেস নিষিদ্ধ
                body: JSON.stringify({ error: 'This device has been blocked.' })
            };
        }

        // ভেরিফিকেশনের সময়কাল নির্ধারণ (এনভায়রনমেন্ট ভ্যারিয়েবল থেকে, না পেলে ৪৮ ঘণ্টা)
        const verificationDurationHours = parseInt(process.env.VERIFICATION_HOURS, 10) || 48;
        const durationMillis = verificationDurationHours * 60 * 60 * 1000;
        const expirationTime = Date.now() + durationMillis;
        
        // Firebase-এ ডিভাইসটিকে ভেরিফাইড হিসেবে সেট করা হচ্ছে
        await db.ref('verified_devices/' + deviceId).set({
            expiration: expirationTime,
            last_token: verification_token,
            verified_at: new Date().toISOString() // কখন ভেরিফাই হয়েছে, তা সংরক্ষণের জন্য
        });

        // সফল হলে 200 OK রেসপন্স পাঠানো হচ্ছে
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: `Successfully verified device: ${deviceId}` })
        };

    } catch (error) {
        // === নতুন এবং উন্নত: আরও ভালো এরর হ্যান্ডলিং ===
        // যদি টোকেন ভুল বা মেয়াদোত্তীর্ণ হয়
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { 
                statusCode: 401, // 401 Unauthorized
                body: JSON.stringify({ error: 'Invalid or expired token.' }) 
            };
        }
        
        // অন্যান্য সব অপ্রত্যাশিত এররের জন্য
        console.error('Verification failed:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'An internal error occurred during verification.' })
        };
    }
};
