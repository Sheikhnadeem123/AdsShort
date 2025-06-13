const fetch = require('node-fetch');

const CONFIG_URL = "https://raw.githubusercontent.com/YaminDeveloper/Pin-Verification/main/config.json";

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { deviceId } = JSON.parse(event.body);
        if (!deviceId) {
            return { statusCode: 400, body: 'Device ID is required' };
        }

        const configResponse = await fetch(CONFIG_URL);
        if (!configResponse.ok) throw new Error('Failed to fetch remote config');
        const config = await configResponse.json();
        
        const verificationHours = config.verificationDurationHours || 48;
        const firebaseDbUrl = config.firebaseDbUrl;

        if (!firebaseDbUrl) {
             throw new Error('Firebase DB URL not found in config');
        }
        
        // --- নতুন পরিবর্তন এখানে ---
        // প্রথমে চেক করুন ডিভাইসটি ব্লক করা আছে কিনা
        const blockCheckUrl = `${firebaseDbUrl}/blocked_devices/${deviceId}.json`;
        const blockCheckResponse = await fetch(blockCheckUrl);
        const isBlocked = await blockCheckResponse.json();

        // যদি isBlocked নাল না হয় (অর্থাৎ, ডেটা পাওয়া যায়), তাহলে ডিভাইসটি ব্লকড
        if (isBlocked) {
            return {
                statusCode: 403, // 403 Forbidden একটি উপযুক্ত স্ট্যাটাস কোড
                body: JSON.stringify({ error: 'Device is blocked' })
            };
        }
        // --- পরিবর্তন শেষ ---

        const expirationTimestamp = new Date().getTime() + (verificationHours * 60 * 60 * 1000);

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
        console.error('Function Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};