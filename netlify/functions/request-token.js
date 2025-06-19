const axios = require('axios');

exports.handler = async function(event) {
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
        const apiToken = process.env.ADSTERRA_API_TOKEN;
        const placementId = 26857271; // আপনার placementId

        if (!apiToken) {
            throw new Error('Adsterra API token is not configured.');
        }

        // *** মূল পরিবর্তনটি এখানে ***
        // placementId এখন URL-এর অংশ এবং রিকোয়েস্টের কোনো body নেই।
        const apiUrl = `https://publishers.adsterra.com/api/v2/direct_links/${placementId}`;
        
        // রিকোয়েস্টটি POST, কিন্তু কোনো body নেই (null)
        const response = await axios.post(apiUrl, null, {
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
        // এরর লগ করার জন্য এই অংশটি খুবই গুরুত্বপূর্ণ
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error('Adsterra API Error:', errorMessage);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to fetch link from Adsterra.' })
        };
    }
};
