const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const CONFIG_URL = "https://raw.githubusercontent.com/YaminDeveloper/Pin-Verification/main/config.json";

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DB_URL
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

        const JWT_SECRET = process.env.JWT_SECRET;
        const decoded = jwt.verify(token, JWT_SECRET);
        const { deviceId, verification_token } = decoded;

        if (!deviceId || !verification_token) {
             return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid token payload.' }) };
        }
        
        // Fetch config to determine duration
        const configResponse = await fetch(CONFIG_URL);
        const config = await configResponse.json();
        
        let durationMillis;
        if (config.useHoursForVerification === true) {
            durationMillis = (config.verificationDurationHours || 48) * 60 * 60 * 1000;
        } else {
            durationMillis = (config.verificationDurationMinutes || 60) * 60 * 1000;
        }
        
        const expirationTime = Date.now() + durationMillis;

        await admin.database().ref('verified_devices/' + deviceId).set({
            expiration: expirationTime,
            last_token: verification_token,
            isPermanent: false // নতুন ভেরিফিকেশন কখনো পার্মানেন্ট হবে না
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
