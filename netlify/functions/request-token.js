exports.handler = async function(event) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { 
            statusCode: 204, 
            headers, 
            body: '' 
        };
    }

    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers, 
            body: 'Method Not Allowed' 
        };
    }

    try {
        // --- মূল পরিবর্তন এখানে ---
        // Adsterra API কলের পরিবর্তে সরাসরি আপনার ডাইরেক্ট লিঙ্কটি ব্যবহার করা হচ্ছে।
        const directLink = "https://www.profitableratecpm.com/mpjy0juwn?key=8021699e3efbf35a743bdc80703dc5eb";

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ token: directLink })
        };

    } catch (error) {
        // যদিও এই কোডে এরর হওয়ার সম্ভাবনা কম, তবুও ভালো অভ্যাসের জন্য এটি রাখা হলো।
        console.error('Function Error:', error.message);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'An internal server error occurred.' })
        };
    }
};
