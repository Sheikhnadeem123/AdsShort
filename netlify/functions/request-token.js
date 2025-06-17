const jwt = require('jsonwebtoken');

// এই সিক্রেট কী-টি Netlify-এর Environment Variable থেকে লোড হবে
const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async function(event) {
    // ব্রাউজার থেকে অ্যাক্সেসের জন্য CORS হেডার
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

    // নিশ্চিত করুন যে JWT_SECRET সেট করা আছে
    if (!JWT_SECRET) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'JWT_SECRET environment variable is not set.' })
        };
    }

    try {
        const { deviceId, verification_token } = JSON.parse(event.body);

        // deviceId এবং verification_token দুটোই আছে কিনা তা চেক করুন
        if (!deviceId || !verification_token) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Device ID and verification token are required.' })
            };
        }

        // একটি JWT টোকেন তৈরি করুন যা ৫ মিনিটের জন্য বৈধ থাকবে
        const token = jwt.sign({
                deviceId: deviceId,
                verification_token: verification_token
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
