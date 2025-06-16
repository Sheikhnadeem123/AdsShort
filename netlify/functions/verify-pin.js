const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

// Firebase Admin SDK-এর জন্য আপনার Service Account Key প্রয়োজন
// এই JSON ডেটাটি সরাসরি কোডে না রেখে Netlify Environment Variable এ রাখুন
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// Firebase অ্যাপটি আগে থেকেই ইনিশিয়ালাইজ করা আছে কিনা তা চেক করুন
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DB_URL // আপনার Firebase Database URL টিও এখানে দিন
    });
}

exports.handler = async (event) => {
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

    try {
        const body = JSON.parse(event.body);
        const { token } = body;

        if (!token) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Token is required.' }) };
        }

        const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_DEFAULT_SUPER_SECRET_KEY';
        
        // JWT ডিকোড করে ভেতরের ডেটা বের করুন
        const decoded = jwt.verify(token, JWT_SECRET);
        const { deviceId, verification_token } = decoded;

        if (!deviceId || !verification_token) {
             return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid token payload.' }) };
        }

        const verificationDurationHours = 48; // আপনার অ্যাপের কনফিগারেশন অনুযায়ী
        const durationMillis = verificationDurationHours * 60 * 60 * 1000;
        const expirationTime = Date.now() + durationMillis;

        // Firebase Realtime Database এ ডেটা সেভ করুন
        await admin.database().ref('verified_devices/' + deviceId).set({
            expiration: expirationTime,
            last_token: verification_token
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: `Successfully verified device: ${deviceId}` })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Verification failed: ' + error.message })
        };
    }
};
