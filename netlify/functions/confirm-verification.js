const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

const CONFIG_URL = "https://raw.githubusercontent.com/YaminDeveloper/AdsShortJson/refs/heads/main/config.json";

try {
    if (!admin.apps.length) {
        const serviceAccountJson = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DB_URL
        });
    }
} catch (e) {
    console.error('Firebase Admin Initialization Error:', e.message);
}

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
    if (event.httpMethod === 'OPTIONS') { return { statusCode: 204, headers, body: '' }; }
    if (event.httpMethod !== 'POST') { return { statusCode: 405, headers, body: 'Method Not Allowed' }; }

    try {
        const { token } = JSON.parse(event.body);
        if (!token) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Token is required' }) };
        }

        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
            throw new Error('Server configuration error: JWT_SECRET environment variable is not set.');
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        // ===============================================
        // === এই অংশটি আপডেট করা হয়েছে ===
        // ===============================================
        // এখন শুধু deviceId ডিকোড করা হচ্ছে
        const { deviceId } = decoded;

        if (!deviceId) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid token payload: deviceId is missing.' }) };
        }
        
        const db = admin.database();

        const blockSnapshot = await db.ref(`blocked_devices/${deviceId}`).once('value');
        if (blockSnapshot.exists()) {
            return { statusCode: 403, headers, body: JSON.stringify({ error: 'This device has been blocked.' }) };
        }

        // রিমোট কনফিগারেশন থেকে ভেরিফিকেশনের সময়কাল নেওয়া হচ্ছে
        const configResponse = await fetch(CONFIG_URL);
        if (!configResponse.ok) throw new Error('Failed to fetch remote config');
        const config = await configResponse.json();
        const verificationConfig = config.verification || {};
        const useHours = verificationConfig.useHours === true;
        let durationMillis = (useHours ? (verificationConfig.durationHours || 48) : (verificationConfig.durationMinutes || 60)) * (useHours ? 3600000 : 60000);
        const expirationTime = Date.now() + durationMillis;

        // Firebase-এ সম্পূর্ণ টোকেনটি সেভ করা হচ্ছে
        await db.ref(`verified_devices/${deviceId}`).set({
            expiration: expirationTime,
            last_token: token, // অ্যান্ড্রয়েড অ্যাপ এই টোকেনটিই মেলাবে
            verified_at: new Date().toISOString()
        });
        // ===============================================

        return { statusCode: 200, headers, body: JSON.stringify({ message: `Successfully verified device: ${deviceId}` }) };

    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired token.' }) };
        }
        
        console.error('Function Runtime Error:', error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'An internal server error occurred.' }) };
    }
};
