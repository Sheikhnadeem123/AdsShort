const jwt = require('jsonwebtoken');

exports.handler = async (event) => {
    // হেডারগুলো সেট করা হচ্ছে যাতে সব ডোমেইন থেকে অ্যাক্সেস করা যায় (CORS)
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // ব্রাউজারের preflight রিকোয়েস্ট হ্যান্ডেল করার জন্য
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    
    // শুধুমাত্র POST রিকোয়েস্ট গ্রহণ করা হবে
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    // Netlify এনভায়রনমেন্ট ভেরিয়েবল থেকে আপনার গোপন কী (Secret Key) নেওয়া হচ্ছে
    const JWT_SECRET = process.env.JWT_SECRET;

    // JWT_SECRET সেট করা না থাকলে সার্ভারে এরর দেখানো হবে
    if (!JWT_SECRET) {
        console.error('JWT_SECRET environment variable is not set.');
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server configuration error.' })
        };
    }

    try {
        // অ্যান্ড্রয়েড অ্যাপ থেকে পাঠানো ডাটা (deviceId, verification_token) পার্স করা হচ্ছে
        const { deviceId, verification_token } = JSON.parse(event.body);

        // deviceId বা verification_token না থাকলে এরর দেখানো হবে
        if (!deviceId || !verification_token) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Device ID and verification token are required.' })
            };
        }

        // একটি পেলোড তৈরি করা হচ্ছে যা টোকেনের ভেতরে থাকবে
        const payload = {
            deviceId: deviceId,
            verification_token: verification_token,
            type: 'pin_verification_request'
        };

        // একটি নতুন JWT তৈরি করা হচ্ছে যা ১০ মিনিটের জন্য বৈধ থাকবে
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '10m' });

        // সফলভাবে টোকেন তৈরি হলে সেটি অ্যান্ড্রয়েড অ্যাপে ফেরত পাঠানো হচ্ছে
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
