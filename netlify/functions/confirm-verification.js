const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

// Firebase Admin SDK ইনিশিয়ালাইজেশন
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
    console.error('Firebase Admin Initialization Error:', e);
}

// রিমোট কনফিগারেশন লোড করার জন্য একটি ফাংশন
async function getRemoteConfig() {
    // node-fetch এর আর প্রয়োজন নেই, Node.js v18+ এ fetch বিল্ট-ইন
    const CONFIG_URL = "https://raw.githubusercontent.com/YaminDeveloper/AdsVerificationConfig/main/config.json";
    const response = await fetch(CONFIG_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch remote config. Status: ${response.status}`);
    }
    return response.json();
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
        const config = await getRemoteConfig();
        
        const { token } = JSON.parse(event.body);
        if (!token) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Token is required' }) };
        }

        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
            throw new Error('JWT_SECRET is not configured on the server.');
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const { deviceId, verification_token } = decoded;

        if (!deviceId || !verification_token) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid token payload' }) };
        }
        
        const db = admin.database();

        const blockSnapshot = await db.ref(`blocked_devices/${deviceId}`).once('value');
        if (blockSnapshot.exists()) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ error: 'This device has been blocked.' })
            };
        }

        const verificationConfig = config.verification || {};
        const useHours = verificationConfig.useHours === true;
        let durationMillis;

        if (useHours) {
            const durationHours = verificationConfig.durationHours || 48;
            durationMillis = durationHours * 60 * 60 * 1000;
        } else {
            const durationMinutes = verificationConfig.durationMinutes || 60;
            durationMillis = durationMinutes * 60 * 1000;
        }
        
        const expirationTime = Date.now() + durationMillis;

        await db.ref(`verified_devices/${deviceId}`).set({
            expiration: expirationTime,
            last_token: verification_token,
            isPermanent: false,
            verified_at: new Date().toISOString()
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: `Successfully verified device: ${deviceId}` })
        };

    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { 
                statusCode: 401,
                headers,
                body: JSON.stringify({ error: 'Invalid or expired token.' }) 
            };
        }
        
        console.error('Function Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'An internal server error occurred.' })
        };
    }
};
