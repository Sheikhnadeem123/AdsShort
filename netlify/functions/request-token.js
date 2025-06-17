const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers,
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: 'Method Not Allowed'
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { deviceId, verification_token } = body;

        if (!deviceId || !verification_token) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'deviceId and verification_token are required.'
                })
            };
        }
        
        const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_DEFAULT_SUPER_SECRET_KEY';

        const token = jwt.sign({
            deviceId: deviceId,
            verification_token: verification_token
        }, JWT_SECRET, {
            expiresIn: '15m'
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                token: token
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'An error occurred while generating the token.'
            })
        };
    }
};
