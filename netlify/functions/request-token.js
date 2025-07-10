const jwt = require('jsonwebtoken');

// এনভায়রনমেন্ট ভেরিয়েবল থেকে গোপন কী লোড করা হবে
const JWT_SECRET = process.env.JWT_SECRET;

exports.handler = async function(event) {
    // CORS এবং HTTP মেথড চেক করার জন্য হেডার
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // OPTIONS রিকোয়েস্ট হ্যান্ডেল করুন
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    
    // শুধুমাত্র POST রিকোয়েস্ট গ্রহণ করুন
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        // সার্ভারে JWT_SECRET সেট করা আছে কিনা তা নিশ্চিত করুন
        if (!JWT_SECRET) {
            console.error('Server configuration error: JWT_SECRET is not set.');
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error.' }) };
        }

        // রিকোয়েস্টের বডি থেকে deviceId নিন
        const { deviceId } = JSON.parse(event.body);

        // deviceId আছে কিনা তা যাচাই করুন
        if (!deviceId) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Device ID is required.' }) };
        }

        // মেয়াদ ছাড়াই একটি নতুন JWT টোকেন তৈরি করুন
        const token = jwt.sign(
            { deviceId: deviceId },
            JWT_SECRET
        );

        // সফলভাবে টোকেন তৈরি হলে তা ফেরত পাঠান
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ token: token })
        };

    } catch (error) {
        // কোনো ত্রুটি ঘটলে সার্ভার লগে তা দেখান এবং একটি সাধারণ এরর মেসেজ পাঠান
        console.error("Token Generation Error:", error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'An internal server error occurred.' })
        };
    }
};
