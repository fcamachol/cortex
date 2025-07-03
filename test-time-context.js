/**
 * Simple test for contextual time parsing
 */

const chrono = require('chrono-node');

function testTimeContext() {
    console.log('🕐 TESTING TIME CONTEXT LOGIC');
    console.log('=============================');
    
    // Simulate the parsing logic
    const content = "Nos vemos hoy 6:30 por meet";
    const now = new Date('2025-07-02T17:00:00'); // 5:00 PM
    
    console.log(`Content: "${content}"`);
    console.log(`Current time: ${now.toLocaleTimeString()}`);
    
    // Parse with chrono
    const results = chrono.es.parse(content, now, { forwardDate: true });
    console.log(`Chrono results: ${results.length}`);
    
    if (results.length > 0) {
        const firstResult = results[0];
        let startTime = firstResult.start.date();
        
        console.log(`Initial parsed time: ${startTime.toLocaleTimeString()}`);
        console.log(`Parsed hour: ${startTime.getHours()}`);
        
        // Apply our context logic
        const hour = startTime.getHours();
        const minute = startTime.getMinutes();
        
        if (hour >= 1 && hour <= 11) {
            let shouldUsePM = false;
            
            // Check if time already passed today
            if (startTime < now && startTime.toDateString() === now.toDateString()) {
                shouldUsePM = true;
                console.log(`⏰ Time ${hour}:${minute.toString().padStart(2, '0')} already passed, assuming PM`);
            }
            
            // Check evening context
            const eveningIndicators = ['tarde', 'noche', 'evening', 'meet', 'reunión', 'junta', 'cita'];
            const hasEveningContext = eveningIndicators.some(indicator => 
                content.toLowerCase().includes(indicator)
            );
            
            const isLikelyEvening = hour >= 6 || (hour >= 4 && hasEveningContext);
            
            if (shouldUsePM || isLikelyEvening) {
                console.log(`🌅 Correcting to PM: ${hour + 12}:${minute.toString().padStart(2, '0')}`);
                startTime.setHours(hour + 12);
            }
        }
        
        console.log(`Final time: ${startTime.toLocaleTimeString()}`);
        console.log(`Final hour: ${startTime.getHours()}`);
        
        if (startTime.getHours() === 18) {
            console.log('✅ SUCCESS: Correctly parsed as 6:30 PM');
        } else {
            console.log('❌ FAILED: Did not parse as expected PM time');
        }
    }
}

testTimeContext();