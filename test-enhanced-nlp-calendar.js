/**
 * TEST ENHANCED NLP CALENDAR AUTOMATION WITH CHRONO-NODE
 * Tests the improved time parsing for Spanish "hoy a las 3 pm" expressions
 */

async function sendMessageWebhook() {
  const webhookUrl = `http://localhost:5000/api/evolution/webhook/live-test-1750199771/messages-upsert`;
  
  // First send the original message with Spanish time expression
  const messagePayload = {
    data: {
      instanceId: "c5215849-bfb9-413c-aa94-dfa911c8310a",
      instanceName: "live-test-1750199771",
      messageType: "conversation",
      message: {
        key: {
          id: "3AA3BAAF8A5B9610E00F",
          fromMe: false,
          remoteJid: "15103165094@s.whatsapp.net"
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: "Franco Camacho",
        message: {
          conversation: "Nos vemos hoy a las 3 pm por meet"
        }
      },
      source: "web"
    }
  };

  console.log('📝 Step 1: Sending message with Spanish time: "Nos vemos hoy a las 3 pm por meet"');
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload)
    });

    console.log(`📡 Message webhook response: ${response.status}`);
    return response.ok;
  } catch (error) {
    console.error('❌ Message webhook error:', error);
    return false;
  }
}

async function sendReactionWebhook() {
  const webhookUrl = `http://localhost:5000/api/evolution/webhook/live-test-1750199771/messages-upsert`;
  
  // Now send the reaction to that message
  const reactionPayload = {
    data: {
      instanceId: "c5215849-bfb9-413c-aa94-dfa911c8310a",
      instanceName: "live-test-1750199771",
      messageType: "reactionMessage",
      message: {
        key: {
          id: "3AA3BAAF8A5B9610E00F_REACTION",
          fromMe: true,
          remoteJid: "15103165094@s.whatsapp.net"
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: "Franco Camacho",
        reactionMessage: {
          key: {
            id: "3AA3BAAF8A5B9610E00F",
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

  console.log('📅 Step 2: Sending 📅 reaction from instance owner (15103165094@s.whatsapp.net)');
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reactionPayload)
    });

    console.log(`📡 Reaction webhook response: ${response.status}`);
    return response.ok;
  } catch (error) {
    console.error('❌ Reaction webhook error:', error);
    return false;
  }
}

async function checkCalendarEventCreation() {
  console.log('🔍 Checking if calendar event was created with enhanced NLP...');
  
  try {
    const response = await fetch('http://localhost:5000/api/calendar/events');
    const events = await response.json();
    
    console.log(`📅 Found ${events.length} calendar events in database`);
    
    // Look for recent events (last 5 minutes)
    const recentTime = new Date(Date.now() - 5 * 60 * 1000);
    const recentEvents = events.filter(event => new Date(event.created_at) > recentTime);
    
    if (recentEvents.length > 0) {
      console.log('🎉 SUCCESS! Enhanced NLP calendar automation with chrono-node is working');
      console.log('📅 Recent events created:');
      recentEvents.forEach(event => {
        console.log(`  - ${event.title || 'Untitled'}`);
        console.log(`  - Start: ${event.start_time}`);
        console.log(`  - End: ${event.end_time}`);
        console.log(`  - Location: ${event.location || 'None'}`);
      });
    } else {
      console.log('❌ No recent calendar events found - enhanced NLP may need debugging');
    }
  } catch (error) {
    console.error('❌ Error checking calendar events:', error);
  }
}

async function main() {
  console.log('🧪 Testing enhanced NLP with chrono-node for Spanish time parsing...');
  
  // Step 1: Send the message
  const messageSuccess = await sendMessageWebhook();
  if (!messageSuccess) {
    console.log('❌ Failed to send message webhook');
    return;
  }
  
  // Wait a moment between message and reaction
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Step 2: Send the reaction
  const reactionSuccess = await sendReactionWebhook();
  if (!reactionSuccess) {
    console.log('❌ Failed to send reaction webhook');
    return;
  }
  
  // Wait for webhook processing
  console.log('⏳ Waiting 3 seconds for webhook processing...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  await checkCalendarEventCreation();
}

main().catch(console.error);