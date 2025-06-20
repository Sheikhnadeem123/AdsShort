// functions/redirect.js

exports.handler = async (event) => {
    // URL থেকে টোকেনটি নিন
    const token = event.queryStringParameters.token;

    // যদি টোকেন না থাকে, তাহলে একটি এরর পেজে পাঠান
    if (!token) {
        return {
            statusCode: 400,
            body: 'Error: Verification token is missing.'
        };
    }

    // আপনার মূল ভেরিফিকেশন পেজের ঠিকানা
    const verificationPageUrl = `https://adsverification.netlify.app/verify?token=${token}`;

    // ব্যবহারকারীকে নতুন ঠিকানায় রিডাইরেক্ট করুন
    return {
        statusCode: 302, // 302 মানে Temporary Redirect
        headers: {
            'Location': verificationPageUrl
        }
    };
};
