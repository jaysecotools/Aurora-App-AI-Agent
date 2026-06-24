// netlify/functions/bom-proxy.js
exports.handler = async function(event, context) {
    const { endpoint, api_key, ...body } = JSON.parse(event.body);
    
    const response = await fetch(`https://sws-data.sws.bom.gov.au/api/v1/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key, ...body })
    });
    
    const data = await response.json();
    
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    };
};
