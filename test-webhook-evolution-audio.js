/**
 * Test webhook-based Evolution API audio processing system
 * This simulates receiving an audio message webhook and validates the complete pipeline
 */

async function testWebhookEvolutionAudio() {
  try {
    console.log('🧪 Testing webhook-based Evolution API audio processing...');
    
    // Create a realistic audio message webhook payload
    const audioWebhookPayload = {
      event: "messages.upsert",
      instance: "live-test-1750199771",
      data: {
        key: {
          id: "3A22F20DFB15C869255E",
          remoteJid: "5215579188699@s.whatsapp.net",
          fromMe: false
        },
        message: {
          audioMessage: {
            mimetype: "audio/ogg; codecs=opus",
            seconds: 5,
            ptt: true,
            base64: "T2dnUwACAAAAAAAAAAB8AAAAAAAAWAcAAE9nZ1MAAgAAAAAAAAAAfAAAAQAAAFgHAAACT2dnUwACAAAAAAAAAAB8AAAAAgAAAFgHAAABT2dnUwACAAAAAAAAAAB8AAAAAwAAAFgHAAABT2dnUwACAAAAAAAAAAB8AAAABAAAAFgHAAABT2dnUwACAAAAAAAAAAB8AAAABQAAAFgHAAABT2dnUwACAAAAAAAAAAB8AAAABgAAAFgHAAABT2dnUwACAAAAAAAAAAB8AAAABwAAAFgHAAAB",
            contextInfo: {}
          }
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        status: "PENDING"
      },
      destination: "https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev/api/evolution/webhook/live-test-1750199771",
      date_time: new Date().toISOString(),
      sender: "15103165094@s.whatsapp.net",
      server_url: "https://evolution-api-evolution-api.vuswn0.easypanel.host",
      apikey: "119FA240-45ED-46A7-AE13-5A1B7C909D7D"
    };

    console.log('📤 Sending audio message webhook to server...');
    
    // Send webhook to our server
    const webhookResponse = await fetch('http://localhost:5000/api/evolution/webhook/live-test-1750199771', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(audioWebhookPayload)
    });

    if (webhookResponse.ok) {
      console.log('✅ Webhook received successfully by server');
      
      // Wait a moment for processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if audio file was created in media_storage
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const mediaStoragePath = path.resolve('./media_storage/live-test-1750199771');
      
      try {
        const files = await fs.readdir(mediaStoragePath);
        const audioFile = files.find(file => file.startsWith('3A22F20DFB15C869255E'));
        
        if (audioFile) {
          console.log(`✅ Audio file created: ${audioFile}`);
          
          // Test the media endpoint
          const mediaResponse = await fetch(`http://localhost:5000/api/whatsapp/media/live-test-1750199771/3A22F20DFB15C869255E`);
          
          if (mediaResponse.ok) {
            const contentType = mediaResponse.headers.get('content-type');
            const contentLength = mediaResponse.headers.get('content-length');
            
            console.log(`✅ Media endpoint working:`);
            console.log(`📊 Content-Type: ${contentType}`);
            console.log(`📊 Content-Length: ${contentLength} bytes`);
            
            // Verify it's playable audio format
            if (contentType && (contentType.includes('audio/ogg') || contentType.includes('audio/mpeg') || contentType.includes('audio/wav'))) {
              console.log(`🎵 Audio format is browser-compatible!`);
              return true;
            } else {
              console.log(`❌ Audio format may not be browser-compatible: ${contentType}`);
              return false;
            }
          } else {
            console.log(`❌ Media endpoint failed: ${mediaResponse.status}`);
            return false;
          }
        } else {
          console.log(`❌ No audio file found in media storage`);
          console.log(`📁 Files found: ${files.join(', ')}`);
          return false;
        }
      } catch (dirError) {
        console.log(`❌ Media storage directory not found or empty`);
        return false;
      }
    } else {
      console.log(`❌ Webhook failed: ${webhookResponse.status}`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
    return false;
  }
}

// Run the test
testWebhookEvolutionAudio()
  .then(success => {
    if (success) {
      console.log('\n🎉 WEBHOOK EVOLUTION AUDIO TEST PASSED!');
      console.log('✅ Complete pipeline working: Webhook → Evolution API → Browser-compatible audio');
    } else {
      console.log('\n❌ WEBHOOK EVOLUTION AUDIO TEST FAILED');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test error:', error);
    process.exit(1);
  });