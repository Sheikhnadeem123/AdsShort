const fetch = require('node-fetch');
const jwt = require('jsonwebtoken'); // JWT ব্যবহারের জন্য এটি যোগ করা হয়েছে

const CONFIG_URL = "https://raw.githubusercontent.com/YaminDeveloper/Pin-Verification/main/config.json";

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // --- নতুন সিকিউরিটি লেয়ার এখানে যুক্ত করা হয়েছে ---

        // ১. রিকোয়েস্টের বডি থেকে টোকেন সংগ্রহ করা হচ্ছে
        const { token } = JSON.parse(event.body);
        if (!token) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Token is required' }) };
        }

        // ২. এনভায়রনমেন্ট ভেরিয়েবল থেকে গোপন কী (Secret Key) নেওয়া হচ্ছে
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
            console.error('JWT_SECRET environment variable not set.');
            return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
        }

        // ৩. টোকেনটি ভেরিফাই করা হচ্ছে
        const decoded = jwt.verify(token, JWT_SECRET);

        // ৪. টোকেনের ভেতর থেকে deviceId সংগ্রহ করা হচ্ছে
        const { deviceId } = decoded;
        if (!deviceId) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Invalid token payload' }) };
        }
        // --- সিকিউরিটি লেয়ার শেষ ---


        // --- আপনার আগের ভেরিফিকেশন লজিক এখন এখানে চলবে ---

        const configResponse = await fetch(CONFIG_URL);
        if (!configResponse.ok) throw new Error('Failed to fetch remote config');
        const config = await configResponse.json();
        
        const firebaseDbUrl = config.firebaseDbUrl;
        if (!firebaseDbUrl) {
             throw new Error('Firebase DB URL not found in config');
        }
        
        // প্রথমে চেক করুন ডিভাইসটি ব্লক করা আছে কিনা
        const blockCheckUrl = `${firebaseDbUrl}/blocked_devices/${deviceId}.json`;
        const blockCheckResponse = await fetch(blockCheckUrl);
        const isBlocked = await blockCheckResponse.json();

        // যদি isBlocked নাল না হয়, তাহলে ডিভাইসটি ব্লকড
        if (isBlocked) {
            return {
                statusCode: 403, // 403 Forbidden
                body: JSON.stringify({ error: 'Device is blocked' })
            };
        }

        // ভেরিফিকেশনের সময়কাল নির্ধারণ
        const verificationHours = config.verification?.durationHours || 48;
        const expirationTimestamp = new Date().getTime() + (verificationHours * 60 * 60 * 1000);

        // ফায়ারবেসে ডিভাইসটিকে ভেরিফাইড হিসেবে সেট করা হচ্ছে
        const firebaseUrl = `${firebaseDbUrl}/verified_devices/${deviceId}.json`;
        const firebaseResponse = await fetch(firebaseUrl, {
            method: 'PUT',
            body: JSON.stringify({ expiration: expirationTimestamp })
        });

        if (!firebaseResponse.ok) {
            const errorBody = await firebaseResponse.text();
            throw new Error(`Firebase error: ${firebaseResponse.statusText} - ${errorBody}`);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Verification successful' })
        };

    } catch (error) {
        // JWT সম্পর্কিত এরর আলাদাভাবে হ্যান্ডেল করা হচ্ছে
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { 
                statusCode: 401, 
                body: JSON.stringify({ error: 'Invalid or expired token.' }) 
            };
        }

        console.error('Function Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
