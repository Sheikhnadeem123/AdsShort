const jwt = require('jsonwebtoken');

// আপনার SECRET কী পরিবর্তন করবেন না
const JWT_SECRET = process.env.JWT_SECRET || 'D9f$Gk&hLp@z$sWc!z%C*W!z%C';

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
        // শুধুমাত্র deviceId নিন
        const { deviceId } = JSON.parse(event.body);

        // শুধুমাত্র deviceId চেক করুন
        if (!deviceId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Device ID is required.' })
            };
        }

        // টোকেনে শুধুমাত্র deviceId রাখুন
        const token = jwt.sign({
                deviceId: deviceId
            },
            JWT_SECRET, { expiresIn: '10m' }
        );

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ token: token })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
