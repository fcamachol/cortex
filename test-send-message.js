import fetch from 'node-fetch';

async function testSendMessage() {
  const serverUrl = 'https://evolution-api-evolution-api.vuswn0.easypanel.host';
  const apiKey = 'B6D711FCDE4D4FD5936544120E713976';
  const instanceId = 'instance-1750433520122';
  
  try {
    console.log('🔍 Sending test message to trigger webhook...');
    
    const response = await fetch(`${serverUrl}/message/sendText/${instanceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: '5214422501780',
        text: 'Test webhook message - ' + new Date().toISOString()
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Test message sent successfully');
      console.log('Response:', JSON.stringify(result, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ Failed to send test message');
      console.log('Status:', response.status);
      console.log('Error:', errorText);
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testSendMessage();