const axios = require('axios');

exports.handler = async function(event) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS' // এটি POST রাখলেও সমস্যা নেই কারণ ব্রাউজার প্রথমে OPTIONS পাঠায়
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    // আপনার অ্যাপ যেহেতু POST রিকোয়েস্ট পাঠায়, তাই এই চেকটি ঠিক আছে
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: 'Method Not Allowed' };
    }

    try {
        const apiToken = process.env.ADSTERRA_API_TOKEN;
        const placementId = 26857271;

        if (!apiToken) {
            throw new Error('Adsterra API token is not configured.');
        }

        const apiUrl = `https://publishers.adsterra.com/api/v2/direct_links/${placementId}`;
        
        // *** মূল পরিবর্তন: POST এর পরিবর্তে GET ব্যবহার করা হচ্ছে ***
        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': `Bearer ${apiToken}`
            }
        });

        const directLink = response.data.url;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ token: directLink })
        };

    } catch (error) {
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error('Adsterra API Error:', errorMessage);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to fetch link from Adsterra.' })
        };
    }
};
