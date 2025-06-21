const jwt = require('jsonwebtoken');

// আপনার Netlify প্রজেক্টের Environment Variables-এ JWT_SECRET সেট করতে ভুলবেন না
const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async function(event) {
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
        if (!JWT_SECRET) {
            console.error('Server configuration error: JWT_SECRET is not set.');
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error.' }) };
        }

        // ===============================================
        // === এই অংশটি আপডেট করা হয়েছে ===
        // ===============================================
        // এখন শুধু deviceId গ্রহণ করা হচ্ছে
        const { deviceId } = JSON.parse(event.body);

        if (!deviceId) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Device ID is required.' }) };
        }

        // JWT টোকেন শুধুমাত্র deviceId দিয়ে তৈরি করা হচ্ছে
        const token = jwt.sign(
            { deviceId: deviceId },
            JWT_SECRET,
            { expiresIn: '10m' } // টোকেনটি ৫ মিনিট কার্যকর থাকবে
        );
        // ===============================================

        return { statusCode: 200, headers, body: JSON.stringify({ token: token }) };

    } catch (error) {
        console.error("Token Generation Error:", error.message);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'An internal server error occurred.' }) };
    }
};
