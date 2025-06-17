const jwt = require('jsonwebtoken');

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

    const JWT_SECRET = process.env.JWT_SECRET;

    if (!JWT_SECRET) {
        console.error('JWT_SECRET environment variable is not set.');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server configuration error.' })
        };
    }

    try {
        const { deviceId, verification_token } = JSON.parse(event.body);

        if (!deviceId || !verification_token) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Device ID and verification token are required.' })
            };
        }

        const payload = {
            deviceId: deviceId,
            verification_token: verification_token,
            type: 'pin_verification_request'
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '10m' });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ token: token })
        };

    } catch (error) {
        console.error('Token generation failed:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to generate token.' })
        };
    }
};
