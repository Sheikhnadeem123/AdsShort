const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

// আপনার GitHub কনফিগারেশন URL
const CONFIG_URL = "https://raw.githubusercontent.com/YaminDeveloper/AdsShortJson/refs/heads/main/config.json";

try {
    const serviceAccountJson = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DB_URL
        });
    }
} catch (e) {
    console.error('Firebase Admin Initialization Error:', e);
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
       
        const configResponse = await fetch(CONFIG_URL);
        if (!configResponse.ok) throw new Error('Failed to fetch remote config');
        const config = await configResponse.json();

       
        const { token } = JSON.parse(event.body);
        if (!token) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Token is required' }) };
        }

        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
            throw new Error('Server configuration error: JWT_SECRET is not set.');
        }

        // --- পরিবর্তন শুরু ---
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // শুধুমাত্র deviceId নিন, verification_token লাগবে না
        const { deviceId } = decoded; 
        
        // শুধুমাত্র deviceId চেক করুন
        if (!deviceId) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid token payload. Device ID is missing.' }) };
        }
        // --- পরিবর্তন শেষ ---
        
        const db = admin.database();
       
        const blockSnapshot = await db.ref(`blocked_devices/${deviceId}`).once('value');
        if (blockSnapshot.exists()) {
            console.log(`Verification blocked for device: ${deviceId}`);
            return {
                statusCode: 403, 
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

        // --- পরিবর্তন শুরু ---
        // Firebase-এ ডেটা সেভ করার সময় last_token সরিয়ে দিন
        await db.ref(`verified_devices/${deviceId}`).set({
            expiration: expirationTime,
            isPermanent: false,
            verified_at: new Date().toISOString()
        });
        // --- পরিবর্তন শেষ ---

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: `Successfully verified device: ${deviceId}` })
        };

    } catch (error) {
       
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { 
                statusCode: 401, 
                body: JSON.stringify({ error: 'Invalid or expired token.' }) 
            };
        }
        
        console.error('Function Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'An internal server error occurred. Please contact support.' })
        };
    }
};
