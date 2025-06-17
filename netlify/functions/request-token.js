const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

// Firebase Admin SDK ইনিশিয়ালাইজেশন
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
const databaseURL = process.env.FIREBASE_DATABASE_URL;

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: databaseURL
    });
}

// Netlify এনভায়রনমেন্ট ভেরিয়েবল থেকে JWT সিক্রেট নেওয়া হচ্ছে
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
