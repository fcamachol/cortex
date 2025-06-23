/**
 * Test real-time audio conversion by sending a webhook with base64 audio
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

// Create a minimal OGG audio file in base64 (silent audio for testing)
const createTestAudioBase64 = () => {
  // This is a minimal OGG Vorbis header for a very short silent audio file
  const oggHeader = Buffer.from([
    0x4F, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1E, 0x01, 0x76, 0x6F, 0x72, 0x62,
    0x69, 0x73, 0x00, 0x00, 0x00, 0x00, 0x01, 0x44, 0xAC, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0xEE, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01
  ]);
  return oggHeader.toString('base64');
};

async function testAudioConversion() {
  console.log('🔄 TESTING REAL-TIME AUDIO CONVERSION PIPELINE');
  console.log('='.repeat(60));
  
  const testMessageId = `AUDIO_CONVERSION_TEST_${Date.now()}`;
  const instanceName = 'live-test-1750199771';
  
  // Create webhook payload with base64 audio
  const webhookPayload = {
    event: 'messages.upsert',
    instance: instanceName,
    data: {
      key: {
        remoteJid: '5521987654321@s.whatsapp.net',
        fromMe: false,
        id: testMessageId
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      message: {
        audioMessage: {
          base64: createTestAudioBase64(),
          mimetype: 'audio/ogg; codecs=opus',
          seconds: 1,
          ptt: true
        }
      },
      pushName: 'Test User',
      messageType: 'audioMessage'
    }
  };
  
  try {
    // Send webhook to trigger audio processing
    console.log(`📤 Sending webhook with base64 audio: ${testMessageId}`);
    const webhookResponse = await fetch(`${BASE_URL}/api/evolution/webhook/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'test-key'
      },
      body: JSON.stringify(webhookPayload)
    });
    
    console.log(`📨 Webhook response: ${webhookResponse.status}`);
    
    if (webhookResponse.ok) {
      // Wait a moment for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test media endpoint
      console.log(`🎵 Testing media conversion endpoint...`);
      const mediaResponse = await fetch(`${BASE_URL}/api/whatsapp/media/${instanceName}/${testMessageId}`);
      
      console.log(`📁 Media response: ${mediaResponse.status}`);
      console.log(`📋 Content-Type: ${mediaResponse.headers.get('content-type')}`);
      console.log(`📏 Content-Length: ${mediaResponse.headers.get('content-length')}`);
      
      if (mediaResponse.ok) {
        const arrayBuffer = await mediaResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        console.log(`✅ Audio conversion successful!`);
        console.log(`📊 Converted audio size: ${buffer.length} bytes`);
        
        // Check if it's WAV format
        const wavHeader = buffer.subarray(0, 4).toString('ascii');
        if (wavHeader === 'RIFF') {
          console.log(`🎵 Successfully converted to WAV format - browsers can play this!`);
        } else {
          console.log(`📄 Audio format: ${wavHeader} (${buffer.length} bytes)`);
        }
        
        return true;
      } else {
        console.log(`❌ Media endpoint failed: ${mediaResponse.status}`);
        const errorText = await mediaResponse.text();
        console.log(`Error: ${errorText}`);
      }
    } else {
      console.log(`❌ Webhook failed: ${webhookResponse.status}`);
    }
    
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
  }
  
  return false;
}

testAudioConversion();