import fetch from 'node-fetch';

async function testMexicanInstance() {
  // Test sending a message from the US instance to the Mexican number
  const serverUrl = 'https://evolution-api-evolution-api.vuswn0.easypanel.host';
  const apiKey = '119FA240-45ED-46A7-AE13-5A1B7C909D7D';
  const usInstanceId = 'live-test-1750199771';
  const mexicanNumber = '5215579188699';

  try {
    console.log('Sending test message to Mexican number...');
    
    const response = await fetch(`${serverUrl}/message/sendText/${usInstanceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: mexicanNumber,
        text: 'Test message for Mexican instance webhook verification'
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Message sent successfully:', result);
      console.log('Check webhook logs for Mexican instance processing...');
    } else {
      const errorText = await response.text();
      console.log('Failed to send message:', response.status, errorText);
    }

  } catch (error) {
    console.log('Error:', error.message);
  }
}

testMexicanInstance();