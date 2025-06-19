const axios = require('axios');

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
        const apiToken = process.env.ADSTERRA_API_TOKEN;
        const placementId = 26857271;

        if (!apiToken) {
            throw new Error('Adsterra API token is not configured.');
        }

        const response = await axios.post(
            'https://beta.publishers.adsterra.com/api/v2/direct_links', { placementId: placementId }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiToken}`
                }
            }
        );

        const directLink = response.data.url;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ token: directLink })
        };

    } catch (error) {
        console.error('Adsterra API Error:', error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to fetch link from Adsterra.' })
        };
    }
};
