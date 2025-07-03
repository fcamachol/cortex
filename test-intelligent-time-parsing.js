/**
 * TEST INTELLIGENT TIME PARSING
 * Tests the improved contextual time parsing logic
 */

import { NLPService } from './server/nlp-service.js';

async function testTimeParsingContext() {
    console.log('🕐 TESTING INTELLIGENT TIME PARSING');
    console.log('===================================');
    
    const nlp = new NLPService();
    
    // Test cases with different contexts
    const testCases = [
        {
            description: "Message at 5pm about 6:30 event (should be PM)",
            content: "Nos vemos hoy 6:30 por meet",
            currentTime: new Date('2025-07-02T17:00:00'), // 5:00 PM
            expectedHour: 18 // 6:30 PM
        },
        {
            description: "Message at 10am about 11:30 event (could be AM)",
            content: "Reunión hoy 11:30",
            currentTime: new Date('2025-07-02T10:00:00'), // 10:00 AM
            expectedHour: 11 // 11:30 AM (not past current time)
        },
        {
            description: "Message at 2pm about 1:30 event (should be PM)",
            content: "Evento hoy 1:30",
            currentTime: new Date('2025-07-02T14:00:00'), // 2:00 PM
            expectedHour: 13 // 1:30 PM (1:30 AM already passed)
        },
        {
            description: "Evening context with meet indicator",
            content: "Junta hoy 7:00 por meet",
            currentTime: new Date('2025-07-02T16:00:00'), // 4:00 PM
            expectedHour: 19 // 7:00 PM (evening context + meet)
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n🔍 Testing: ${testCase.description}`);
        console.log(`   Content: "${testCase.content}"`);
        console.log(`   Current time: ${testCase.currentTime.toLocaleTimeString()}`);
        
        // Mock the current time for the test
        const originalDate = global.Date;
        global.Date = class extends originalDate {
            constructor(...args) {
                if (args.length === 0) {
                    return testCase.currentTime;
                }
                return new originalDate(...args);
            }
            static now() {
                return testCase.currentTime.getTime();
            }
        };
        
        try {
            const result = nlp.parseCalendarEvent(testCase.content, 'es');
            const parsedHour = result.startTime ? result.startTime.getHours() : null;
            
            console.log(`   Parsed time: ${result.startTime ? result.startTime.toLocaleTimeString() : 'none'}`);
            console.log(`   Expected hour: ${testCase.expectedHour}, Got hour: ${parsedHour}`);
            
            if (parsedHour === testCase.expectedHour) {
                console.log('   ✅ CORRECT: Time parsed with proper AM/PM context');
            } else {
                console.log('   ❌ INCORRECT: Time parsing failed context detection');
            }
        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}`);
        } finally {
            // Restore original Date
            global.Date = originalDate;
        }
    }
}

// Run the test
testTimeParsingContext().catch(console.error);