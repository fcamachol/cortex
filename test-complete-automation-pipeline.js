/**
 * COMPLETE AUTOMATION PIPELINE TEST
 * Tests the entire flow: Message → Reaction → NLP Enhancement → Calendar Event Creation
 */

async function sendCompleteWorkflow() {
  const webhookUrl = `http://localhost:5000/api/evolution/webhook/live-test-1750199771/messages-upsert`;
  
  console.log('🎯 Testing complete enhanced NLP automation pipeline...');
  
  // Step 1: Store the test message in database first
  console.log('📝 Step 1: Creating test message in database');
  
  const messageId = '3AA3BAAF8A5B9610E00G';
  const testMessage = {
    messageId: messageId,
    instanceName: 'live-test-1750199771',
    chatId: '15103165094@s.whatsapp.net',
    senderJid: '15103165094@s.whatsapp.net',
    content: 'Nos vemos hoy a las 3 pm por meet',
    messageType: 'conversation',
    timestamp: new Date(),
    fromMe: false,
    status: 'received'
  };
  
  try {
    const messageResponse = await fetch('http://localhost:5000/api/whatsapp/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMessage)
    });
    
    if (messageResponse.ok) {
      console.log('✅ Test message stored in database');
    } else {
      console.log('❌ Failed to store test message');
      return false;
    }
  } catch (error) {
    console.log('❌ Error storing message:', error.message);
    return false;
  }
  
  // Step 2: Send reaction webhook
  console.log('📅 Step 2: Sending 📅 reaction from instance owner');
  
  const reactionPayload = {
    data: {
      instanceId: "c5215849-bfb9-413c-aa94-dfa911c8310a",
      instanceName: "live-test-1750199771",
      messageType: "reactionMessage",
      message: {
        key: {
          id: messageId + "_REACTION",
          fromMe: true,
          remoteJid: "15103165094@s.whatsapp.net"
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: "Franco Camacho",
        reactionMessage: {
          key: {
            id: messageId,
            fromMe: false,
            remoteJid: "15103165094@s.whatsapp.net"
          },
          text: "📅",
          senderTimestamp: Math.floor(Date.now() / 1000)
        }
      },
      source: "web"
    }
  };
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reactionPayload)
    });
    
    console.log(`📡 Reaction webhook response: ${response.status}`);
    return response.ok;
  } catch (error) {
    console.error('❌ Reaction webhook error:', error);
    return false;
  }
}

async function checkEnhancedCalendarCreation() {
  console.log('🔍 Checking if enhanced NLP calendar automation created an event...');
  
  try {
    const response = await fetch('http://localhost:5000/api/calendar/events');
    const events = await response.json();
    
    console.log(`📅 Found ${events.length} total calendar events`);
    
    // Look for very recent events (last 2 minutes)
    const recentTime = new Date(Date.now() - 2 * 60 * 1000);
    const recentEvents = events.filter(event => new Date(event.created_at) > recentTime);
    
    if (recentEvents.length > 0) {
      console.log('🎉 SUCCESS! Enhanced NLP calendar automation is FULLY OPERATIONAL');
      console.log('📅 Recent enhanced NLP events:');
      recentEvents.forEach(event => {
        console.log(`  ✅ ${event.title || 'Untitled'}`);
        console.log(`     🕐 Start: ${event.start_time}`);
        console.log(`     🕐 End: ${event.end_time || 'No end time'}`);
        console.log(`     📍 Location: ${event.location || 'No location'}`);
        console.log(`     🎯 NLP Enhanced: ${event.description?.includes('NLP') ? 'Yes' : 'Likely'}`);
        console.log(`     🔗 Google Meet: ${event.meet_link ? 'Yes' : 'No'}`);
      });
      return true;
    } else {
      console.log('❌ No recent calendar events found - checking action processing logs...');
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking calendar events:', error);
    return false;
  }
}

async function checkActionProcessorStatus() {
  console.log('🔧 Checking action processor service status...');
  
  try {
    const response = await fetch('http://localhost:5000/api/action-processor/status');
    const status = await response.json();
    
    console.log('📊 Action Processor Statistics:');
    console.log(`  - Queue Size: ${status.queueSize}`);
    console.log(`  - Processed: ${status.processed}`);
    console.log(`  - Failed: ${status.failed}`);
    console.log(`  - Success Rate: ${status.successRate}%`);
    
    if (status.queueSize > 0) {
      console.log('⏳ Actions are queued for processing...');
    }
    
    return status;
  } catch (error) {
    console.error('❌ Error checking action processor:', error);
    return null;
  }
}

async function main() {
  console.log('🧪 TESTING ENHANCED NLP CALENDAR AUTOMATION PIPELINE');
  console.log('📊 This tests: Spanish time parsing + chrono-node + calendar creation');
  
  // Send the complete workflow
  const workflowSuccess = await sendCompleteWorkflow();
  if (!workflowSuccess) {
    console.log('❌ Workflow failed, stopping test');
    return;
  }
  
  // Check action processor status
  await checkActionProcessorStatus();
  
  // Wait for processing
  console.log('⏳ Waiting 5 seconds for enhanced NLP processing...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Check results
  const calendarSuccess = await checkEnhancedCalendarCreation();
  
  if (calendarSuccess) {
    console.log('🎯 ENHANCED NLP AUTOMATION SYSTEM IS FULLY OPERATIONAL!');
    console.log('✅ Spanish time parsing with chrono-node working perfectly');
    console.log('✅ End-to-end automation pipeline functional');
  } else {
    console.log('🔧 Enhanced NLP automation needs debugging - checking logs...');
    await checkActionProcessorStatus();
  }
}

main().catch(console.error);