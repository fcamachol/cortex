// Direct test of group management API
const fetch = require('node-fetch');

async function testGroupsAPI() {
    try {
        console.log('Testing group management API...');
        
        // Test the groups endpoint
        const response = await fetch('http://localhost:5000/api/whatsapp/groups/7804247f-3ae8-4eb2-8c6d-2c44f967ad42');
        
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers));
        
        const data = await response.text();
        console.log('Response data:', data);
        
        if (response.headers.get('content-type')?.includes('application/json')) {
            const jsonData = JSON.parse(data);
            console.log('Parsed JSON:', jsonData);
            console.log('Groups count:', jsonData.length);
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testGroupsAPI();