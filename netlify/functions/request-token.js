const jwt = require('jsonwebtoken');

// এই সিক্রেট কী-টি পরে Netlify-এর Environment Variable-এ সেট করতে হবে
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-super-secret-key-change-it';

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { deviceId } = JSON.parse(event.body);
        if (!deviceId) {
            return { statusCode: 400, body: 'Device ID is required' };
        }

        // একটি টোকেন তৈরি করুন যা ৫ মিনিটের জন্য বৈধ থাকবে
        const token = jwt.sign(
            { deviceId: deviceId },
            JWT_SECRET,
            { expiresIn: '5m' } // 5 minutes validity
        );

        return {
            statusCode: 200,
            body: JSON.stringify({ token: token })
        };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
