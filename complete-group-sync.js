import fetch from 'node-fetch';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const INSTANCE_NAME = 'instance-1750433520122';

const remainingGroups = [
  '120363420139252714@g.us',  // Adrian Bravo Chat
  '888888888888888888@g.us',   // Business Development Group
  'correctedgrouptest456@g.us', // Corrected Group Test
  'finalcorrectiontest123@g.us', // Final Correction Test Group
  '120363420038831248@g.us',    // Final Test Group
  '999999999999999999@g.us',    // Full Information Team
  '120363402303233469@g.us',    // IR Professional Group
  '14156025895-1625545159@g.us', // Magdalena Project Group
  '999777555333111222@g.us',    // Management Team Group
  'messagegrouptest456@g.us',   // Message Testing Group
  '111222333444555666@g.us',    // Project Coordination Group
  'realtestgroup789@g.us',      // Real Test Group
  '120363143882947198@g.us',    // Steven Business Group
  '120363417688835335@g.us',    // Test Development Group
  'testgroup123456789@g.us'     // Test Group 123
];

async function completeGroupSync() {
  console.log('Starting complete group metadata sync...');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const groupId of remainingGroups) {
    try {
      console.log(`Processing: ${groupId}`);
      
      const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        },
        body: JSON.stringify({
          number: groupId,
          text: '.',
          options: { delay: 1000, presence: 'composing' }
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✓ ${groupId}: Message sent (${result.status})`);
        successCount++;
      } else {
        const errorText = await response.text();
        console.log(`✗ ${groupId}: ${response.status} - ${errorText.substring(0, 50)}`);
        errorCount++;
      }
      
      // Wait 3 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.log(`✗ ${groupId}: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\nCompleted: ${successCount} successful, ${errorCount} errors`);
  console.log('Webhook processing will update groups with authentic names over the next few minutes.');
}

completeGroupSync().catch(console.error);