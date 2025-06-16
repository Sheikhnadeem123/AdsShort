const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

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

        // এনভায়রনমেন্ট ভেরিয়েবল থেকে সময়কাল নিন, ডিফল্ট মান 48
        const verificationDurationHours = parseInt(process.env.VERIFICATION_HOURS, 10) || 48;
        const durationMillis = verificationDurationHours * 60 * 60 * 1000;
        const expirationTime = Date.now() + durationMillis;

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
