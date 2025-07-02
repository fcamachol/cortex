/**
 * DIRECT NLP TESTING - Test chrono-node Spanish time parsing
 * This tests the NLP service directly without webhook complexities
 */

import { nlpService } from './server/nlp-service.ts';

async function testDirectNLP() {
  console.log('🧪 Testing NLP Service directly for Spanish time parsing...');
  
  // Test cases for Spanish time expressions
  const testCases = [
    'Nos vemos hoy a las 3 pm por meet',
    'Comida mañana a las 2 pm',
    'Reunión hoy a las 15:30',
    'Desayuno a las 9 am',
    'Lunch today at 3 pm',
    'Meeting tomorrow at 2:30 PM'
  ];
  
  console.log('📝 Testing enhanced calendar event parsing with chrono-node:');
  
  for (const testCase of testCases) {
    console.log(`\n🔍 Testing: "${testCase}"`);
    
    try {
      const result = await nlpService.parse(testCase, 'calendar');
      
      if (result) {
        console.log(`✅ Parsed successfully:`);
        console.log(`  - Title: ${result.title}`);
        console.log(`  - Start Time: ${result.startTime || 'None'}`);
        console.log(`  - End Time: ${result.endTime || 'None'}`);
        console.log(`  - Duration: ${result.duration || 'None'} minutes`);
        console.log(`  - Location: ${result.location || 'None'}`);
        console.log(`  - Attendees: ${result.attendees?.join(', ') || 'None'}`);
        console.log(`  - Should Create Meet: ${result.shouldCreateMeetInvite}`);
        console.log(`  - Confidence: ${result.confidence}`);
      } else {
        console.log(`❌ Failed to parse`);
      }
    } catch (error) {
      console.log(`❌ Error parsing: ${error.message}`);
    }
  }
}

testDirectNLP().catch(console.error);