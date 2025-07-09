const admin = require('firebase-admin');

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

        const blockSnapshot = await db.ref(`blocked_devices/${deviceId}`).once('value');
        if (blockSnapshot.exists()) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ action: 'DEVICE_BLOCKED', message: 'This device has been blocked.' })
            };
        }

        const expiredSnapshot = await db.ref(`expired_users/${deviceId}`).once('value');
        if (expiredSnapshot.exists()) {
             return { 
                 statusCode: 200, 
                 headers, 
                 body: JSON.stringify({ action: 'SHOW_EXPIRED_UI', message: "Your access has expired."}) 
            };
        }

        const verifiedSnapshot = await db.ref(`verified_devices/${deviceId}`).once('value');
        if (verifiedSnapshot.exists()) {
            const verificationData = verifiedSnapshot.val();
            const expirationTime = verificationData.expiration || 0;

            if (expirationTime > Date.now()) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ action: 'GRANT_ACCESS', message: 'Access granted.', expires_at: expirationTime })
                };
            }
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ action: 'SHOW_DIALOG', message: 'Verification required.' })
        };

    } catch (error) {
        console.error('Check Status Function Error:', error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ action: 'SHOW_DIALOG', message: 'Server error, proceeding with verification.' })
        };
    }
};
