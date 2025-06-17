const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-super-secret-key-change-it';
const CONFIG_URL = "https://raw.githubusercontent.com/YaminDeveloper/Pin-Verification/main/config.json";

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { token } = JSON.parse(event.body);
        if (!token) {
            return { statusCode: 400, body: 'Token is required' };
        }

        // টোকেনটি ভেরিফাই করুন
        const decoded = jwt.verify(token, JWT_SECRET);
        const { deviceId } = decoded;

        // ---- config.json এবং Firebase লজিক ----
        const configResponse = await fetch(CONFIG_URL);
        const config = await configResponse.json();
        const firebaseDbUrl = config.firebaseDbUrl;
        const verificationHours = config.verificationDurationHours || 48;
        
        // ব্লকড ডিভাইস চেক
        const blockCheckUrl = `${firebaseDbUrl}/blocked_devices/${deviceId}.json`;
        const blockResponse = await fetch(blockCheckUrl);
        const isBlocked = await blockResponse.json();
        if (isBlocked) {
            return { statusCode: 403, body: JSON.stringify({ error: 'Device is blocked' }) };
        }

        // Firebase-এ ভেরিফিকেশন সেভ করুন
        const expirationTimestamp = new Date().getTime() + (verificationHours * 60 * 60 * 1000);
        const firebaseUrl = `${firebaseDbUrl}/verified_devices/${deviceId}.json`;
        const firebaseResponse = await fetch(firebaseUrl, {
            method: 'PUT',
            body: JSON.stringify({ expiration: expirationTimestamp })
        });

        if (!firebaseResponse.ok) throw new Error('Failed to save to Firebase');

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Verification successful' })
        };

    } catch (error) {
        // JWT-এর এরর (যেমন: মেয়াদ শেষ) আলাদাভাবে হ্যান্ডেল করুন
        if (error.name === 'TokenExpiredError') {
            return { statusCode: 401, body: JSON.stringify({ error: 'Token expired' }) };
        }
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
