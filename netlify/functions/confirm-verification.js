const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

// --- Firebase Admin SDK Initialization ---
// পরিবেশ ভেরিয়েবল থেকে Firebase সার্ভিস অ্যাকাউন্ট কী লোড করুন (Base64 এনকোডেড)
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
let serviceAccount = null; // ডিফল্টভাবে null

try {
    if (serviceAccountBase64) {
        console.log("LOG: Attempting to parse FIREBASE_SERVICE_ACCOUNT_BASE64...");
        // নিশ্চিত করার জন্য প্রথম কয়েকটি অক্ষর লগ করুন, কিন্তু পুরো কী নয়
        console.log("LOG: Service Account Base64 (first 20 chars):", serviceAccountBase64.substring(0, 20) + "...");
        serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('utf8'));
        console.log("LOG: Service Account JSON parsed successfully.");
    } else {
        console.error("ERROR: FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is NOT set.");
    }
} catch (e) {
    console.error("FATAL ERROR: Failed to parse Firebase service account JSON from environment variable:", e.message, e.stack);
    serviceAccount = null; // পার্স ত্রুটিতে serviceAccount null নিশ্চিত করুন
}

// Firebase Admin SDK ইনিশিয়ালাইজ করুন
if (serviceAccount && !admin.apps.length) {
    try {
        console.log("LOG: Attempting to initialize Firebase Admin SDK...");
        const dbUrl = process.env.FIREBASE_DB_URL;
        if (!dbUrl) {
            console.error("ERROR: FIREBASE_DB_URL environment variable is NOT set.");
        } else {
            console.log("LOG: Firebase DB URL:", dbUrl);
        }
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: dbUrl
        });
        console.log("LOG: Firebase Admin SDK initialized successfully.");
    } catch (initError) {
        console.error("FATAL ERROR: Failed to initialize Firebase Admin SDK:", initError.message, initError.stack);
        // যদি প্রয়োজন হয় পুনরায় চেষ্টা করার জন্য অ্যাপ্লিকেশনগুলি সাফ করুন
        if (admin.apps.length > 0) {
            admin.app().delete();
        }
    }
} else if (!serviceAccount) {
    console.error("ERROR: Firebase Admin SDK initialization skipped: Service Account is null/invalid.");
} else if (admin.apps.length > 0) {
    console.log("LOG: Firebase Admin SDK already initialized.");
}
// --- Firebase Admin SDK ইনিশিয়ালাইজেশন শেষ ---

// config.json এর URL, এটিও পরিবেশ ভেরিয়েবল থেকে নেওয়া যেতে পারে
const CONFIG_URL = process.env.CONFIG_URL || "https://raw.githubusercontent.com/YaminDeveloper/Pin-Verification/main/config.json";

exports.handler = async (event) => {
    // CORS হেডার
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // OPTIONS মেথড হ্যান্ডেল করার জন্য
    if (event.httpMethod === 'OPTIONS') {
        console.log("LOG: Handling OPTIONS request.");
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        console.log("ERROR: Method Not Allowed. Received method:", event.httpMethod);
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        console.log("LOG: Received request. Parsing body...");
        const body = JSON.parse(event.body);
        const { token } = body; // <<-- এই ফাংশনটি JWT 'token' আশা করে

        if (!token) {
            console.error("ERROR: Request body missing JWT token.");
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Token is required.' }) };
        }

        const JWT_SECRET = process.env.JWT_SECRET || 'f9a3b8e2d1c7g4h6i5j2k9l1m8n4o7p3';
        if (!process.env.JWT_SECRET) {
            console.warn("WARNING: JWT_SECRET environment variable is not set. Using default secret.");
        }

        let decoded;
        try {
            console.log("LOG: Verifying JWT token...");
            decoded = jwt.verify(token, JWT_SECRET);
            console.log("LOG: JWT token successfully verified. Decoded payload:", JSON.stringify(decoded));
        } catch (jwtError) {
            console.error("ERROR: JWT verification failed:", jwtError.message, jwtError.stack);
            if (jwtError.name === 'TokenExpiredError') {
                return { statusCode: 401, headers, body: JSON.stringify({ error: 'Verification failed: Token expired.' }) };
            }
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Verification failed: Invalid token.' }) };
        }

        const { deviceId, verification_token } = decoded; // JWT পেলোড থেকে deviceId এবং আসল UUID নিন

        if (!deviceId || !verification_token) {
            console.error("ERROR: Invalid token payload: Missing deviceId or verification_token.");
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid token payload: deviceId or verification_token missing.' }) };
        }
        console.log("LOG: Device ID from token:", deviceId);
        console.log("LOG: Verification Token (UUID) from token:", verification_token);

        // Firebase Admin SDK সঠিকভাবে ইনিশিয়ালাইজ হয়েছে কিনা নিশ্চিত করুন
        if (!admin.apps.length || !admin.app().database()) {
            console.error("FATAL ERROR: Firebase Admin SDK is NOT initialized or database is not accessible at this point.");
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error: Firebase not ready or accessible.' }) };
        }
        console.log("LOG: Firebase Admin SDK is confirmed initialized and database accessible.");

        const db = admin.database();
        console.log("LOG: Firebase Database reference obtained.");

        // config.json ফাইল থেকে কনফিগারেশন লোড করুন
        let config;
        try {
            console.log("LOG: Fetching remote config from:", CONFIG_URL);
            const configResponse = await fetch(CONFIG_URL);
            if (!configResponse.ok) {
                throw new Error(`Failed to fetch config.json: ${configResponse.statusText}. Status: ${configResponse.status}`);
            }
            config = await configResponse.json();
            console.log("LOG: Remote config fetched successfully:", JSON.stringify(config));
        } catch (fetchError) {
            console.error("ERROR: Failed to fetch or parse config.json. Using default values for verification duration.", fetchError.message, fetchError.stack);
            config = {
                useHoursForVerification: true,
                verificationDurationHours: 48,
                verificationDurationMinutes: 0
            };
        }

        // --- ব্লকড ডিভাইস চেক ---
        try {
            console.log("LOG: Checking if device is blocked:", deviceId);
            const blockedDeviceRef = db.ref(`blocked_devices/${deviceId}`);
            const isBlockedSnapshot = await blockedDeviceRef.once('value');
            // Firebase-এ যদি পাথ বিদ্যমান না থাকে বা ডেটা null হয়, তাহলে .val() null রিটার্ন করে
            const isBlocked = isBlockedSnapshot.exists() && isBlockedSnapshot.val() !== null;

            if (isBlocked) {
                console.warn(`WARNING: Device ${deviceId} is blocked. Verification denied.`);
                return { statusCode: 403, headers, body: JSON.stringify({ error: 'Device is blocked. Access denied.' }) };
            }
            console.log(`LOG: Device ${deviceId} is NOT blocked.`);
        } catch (blockCheckError) {
            console.error("ERROR: Error checking blocked devices in Firebase:", blockCheckError.message, blockCheckError.stack);
            // নিরাপত্তার জন্য ব্লক চেক ব্যর্থ হলে ভেরিফিকেশন ব্যর্থ করুন
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error during block check.' }) };
        }
        // --- ব্লকড ডিভাইস চেক শেষ ---

        // এক্সপিরেশন টাইম হিসাব করুন config.json অনুযায়ী (ঘণ্টা/মিনিট)
        let durationMillis;
        const useHours = config.useHoursForVerification; // config.json থেকে আসবে
        const durationHours = config.verificationDurationHours || 48; // config.json থেকে আসবে
        const durationMinutes = config.verificationDurationMinutes || 0; // config.json থেকে আসবে

        if (useHours) {
            durationMillis = durationHours * 60 * 60 * 1000;
        } else {
            durationMillis = durationMinutes * 60 * 1000;
        }
        const expirationTime = Date.now() + durationMillis;
        console.log(`LOG: Verification duration: ${durationMillis} ms. Expires at: ${new Date(expirationTime).toISOString()}`);

        // Firebase-এ ভেরিফিকেশন স্ট্যাটাস সেভ করুন
        try {
            console.log(`LOG: Attempting to save verification for device ${deviceId} to Firebase...`);
            const verifiedDeviceRef = db.ref('verified_devices/' + deviceId);
            await verifiedDeviceRef.set({
                expiration: expirationTime,
                last_token: verification_token // অ্যাপ থেকে আসা UUIDটি এখানে সেভ করা হচ্ছে
            });
            console.log(`LOG: Successfully saved verification for device ${deviceId} to Firebase.`);
        } catch (firebaseSaveError) {
            console.error("ERROR: Failed to save verification to Firebase:", firebaseSaveError.message, firebaseSaveError.stack);
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to save verification to Firebase.' }) };
        }

        console.log("LOG: Verification process completed successfully.");
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: `Successfully verified device: ${deviceId}` })
        };

    } catch (error) {
        console.error("ERROR: Unhandled error in function execution:", error.message, error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'An unexpected server error occurred: ' + error.message })
        };
    }
};
