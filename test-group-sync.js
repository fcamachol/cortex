import fetch from 'node-fetch';

async function testGroupSync() {
    try {
        console.log('Testing group sync from Evolution API...');
        
        const response = await fetch('http://localhost:5000/api/whatsapp/groups/instance-1750433520122/sync-from-api', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Group sync result:', result);
        } else {
            console.log('❌ HTTP Error:', response.status, response.statusText);
            const text = await response.text();
            console.log('Response:', text.substring(0, 200) + '...');
        }
    } catch (error) {
        console.error('❌ Test error:', error.message);
    }
}

testGroupSync();