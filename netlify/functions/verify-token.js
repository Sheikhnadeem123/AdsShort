const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

/*
 * ===================================================================
 * Firebase Admin SDK ইনিশিয়ালাইজেশন (আপডেটেড এবং সঠিক সংস্করণ)
 * ===================================================================
 */
try {
    // ধাপ ১: Netlify-এর সঠিক নামের ভেরিয়েবল থেকে Base64 কী ডিকোড করা হচ্ছে
    const serviceAccountJson = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    // ধাপ ২: Netlify-এর সঠিক নামের ডাটাবেস ইউআরএল ভেরিয়েবল ব্যবহার করা হচ্ছে
    const databaseURL = process.env.FIREBASE_DB_URL; 

    // ধাপ ৩: Firebase অ্যাপটি আগে থেকে ইনিশিয়ালাইজ করা না থাকলে তবেই করা হচ্ছে
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: databaseURL
        });
    }
} catch (e) {
    console.error('Firebase Admin Initialization Error:', e);
    // ইনিশিয়ালাইজেশন ব্যর্থ হলে ফাংশনটি কাজ করা থেকে বিরত রাখা হয়,
    // যাতে সার্ভার ক্র্যাশ না করে এবং একটি পরিষ্কার এরর মেসেজ দেয়।
}

// Netlify এনভায়রনমেন্ট ভেরিয়েবল থেকে JWT সিক্রেট নেওয়া হচ্ছে
const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    if (!JWT_SECRET) {
        console.error('JWT_SECRET environment variable is not set.');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server configuration error.' })
        };
    }

    try {
        const { token } = JSON.parse(event.body);

        if (!token) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ message: 'Token is required.' })
            };
        }

        let decoded;
        try {
            // JWT ভেরিফাই করা হচ্ছে। যদি টোকেনটি অবৈধ বা মেয়াদোত্তীর্ণ হয়, তবে এটি একটি এরর থ্রো করবে।
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ message: 'Invalid or expired token.' })
            };
        }
        
        const { deviceId, verification_token } = decoded;

        // Firebase-এ `verified_devices` নোডে ডিভাইসটি যোগ করা হচ্ছে
        const db = admin.database();
        const verifiedRef = db.ref(`verified_devices/${deviceId}`);

        // ভেরিফিকেশনের সময়কাল (যেমন ৪৮ ঘণ্টা)
        const verificationDurationHours = 48; // এটি আপনি কনফিগারেশন থেকে নিতে পারেন
        const expirationTimestamp = Date.now() + verificationDurationHours * 60 * 60 * 1000;

        await verifiedRef.set({
            verified_at: Date.now(),
            expiration: expirationTimestamp,
            last_token: verification_token // অ্যান্ড্রয়েড অ্যাপ থেকে আসা মূল টোকেনটি সেভ করা হচ্ছে
        });
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: `Device ${deviceId} verified successfully.` })
        };

    } catch (error) {
        console.error('Verification failed:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ message: 'An internal error occurred during verification.' })
        };
    }
};
