const admin = require('firebase-admin');

// Firebase Admin SDK ইনিশিয়ালাইজেশন
try {
    if (!admin.apps.length) {
        const serviceAccountJson = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DB_URL
        });
    }
} catch (e) {
    console.error('Firebase Admin Initialization Error:', e.message);
}

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

    try {
        const { deviceId } = JSON.parse(event.body);

        if (!deviceId) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Device ID is required.' }) };
        }

        const db = admin.database();

        // ধাপ ১: ডিভাইসটি ব্লক করা আছে কি না চেক করুন
        const blockSnapshot = await db.ref(`blocked_devices/${deviceId}`).once('value');
        if (blockSnapshot.exists()) {
            // যদি ব্লক করা থাকে, সাথে সাথে "DEVICE_BLOCKED" নির্দেশ পাঠান
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ action: 'DEVICE_BLOCKED', message: 'This device has been blocked.' })
            };
        }

        // ধাপ ২: ডিভাইসটি ভেরিফাইড কি না এবং মেয়াদ আছে কি না চেক করুন
        const verifiedSnapshot = await db.ref(`verified_devices/${deviceId}`).once('value');
        if (verifiedSnapshot.exists()) {
            const verificationData = verifiedSnapshot.val();
            const expirationTime = verificationData.expiration || 0;

            if (expirationTime > Date.now()) {
                // যদি ভেরিফাইড থাকে এবং মেয়াদ শেষ না হয়, তাহলে "GRANT_ACCESS" নির্দেশ পাঠান
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ action: 'GRANT_ACCESS', message: 'Access granted.', expires_at: expirationTime })
                };
            }
        }
        
        // ধাপ ৩: যদি ব্লক করা না থাকে এবং ভেরিফাইডও না থাকে, তাহলে ডায়ালগ দেখানোর নির্দেশ পাঠান
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ action: 'SHOW_DIALOG', message: 'Verification required.' })
        };

    } catch (error) {
        console.error('Check Status Function Error:', error.message);
        // কোনো অপ্রত্যাশিত ত্রুটি ঘটলে, ডিফল্টভাবে ডায়ালগ দেখানোর নির্দেশ দিন
        // এটি অ্যাপটিকে ক্র্যাশ করা থেকে বাঁচাবে
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ action: 'SHOW_DIALOG', message: 'Server error, proceeding with verification.' })
        };
    }
};
