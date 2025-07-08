const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Firebase Admin SDK ইনিশিয়ালাইজ করুন
// (আপনার আগের কোডের মতোই)

exports.handler = async function(event, context) {
    try {
        // ধাপ ১: একটি সিস্টেম-জেনারেটেড টোকেন অনুরোধ করুন
        // এখানে deviceId হার্ডকোড করা যেতে পারে কারণ এটি সিস্টেম জেনারেটেড
        const tokenResponse = await fetch('https://adsshort.netlify.app/.netlify/functions/request-token', {
            method: 'POST',
            body: JSON.stringify({
                deviceId: 'SYSTEM_DAILY_JOB',
                verification_token: `daily_update_${new Date().toISOString()}`
            })
        });

        const { token } = await tokenResponse.json();

        // ধাপ ২: সম্পূর্ণ ভেরিফিকেশন URL তৈরি করুন
        const longUrl = `https://adsshort.netlify.app/verify/${token}`;
        
        // এখানে আপনি চাইলে URL Shortener API ব্যবহার করতে পারেন
        // const shortUrl = await shortenUrl(longUrl);

        // ধাপ ৩: Firebase ডাটাবেসে নতুন লিংকটি সেভ করুন
        const db = admin.database();
        await db.ref('daily_link').set({
            current_link: longUrl, // অথবা shortUrl
            updated_at: new Date().toISOString()
        });

        console.log('Daily link updated successfully.');
        return { statusCode: 200, body: 'Link updated' };

    } catch (error) {
        console.error('Error updating daily link:', error);
        return { statusCode: 500, body: 'Failed to update link' };
    }
};
