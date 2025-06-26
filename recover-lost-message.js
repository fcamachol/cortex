/**
 * Recovery script for Michelle Smeke's lost reply message from 7:47 PM on June 25, 2025
 * This script will attempt to fetch message history from Evolution API for the CRM Ventas Technogym group
 */

import fetch from 'node-fetch';

const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const INSTANCE_ID = 'instance-1750433520122';
const GROUP_JID = '120363402836657819@g.us'; // CRM Ventas Technogym group

async function recoverLostMessage() {
    if (!EVOLUTION_API_KEY || !EVOLUTION_API_URL) {
        console.error('❌ Evolution API credentials not found');
        return;
    }

    try {
        // Try multiple Evolution API endpoints to fetch message history
        let response;
        const endpoints = [
            `/message/findMessages/${INSTANCE_ID}`,
            `/chat/findMessages/${INSTANCE_ID}`,
            `/instance/fetchMessages/${INSTANCE_ID}`
        ];

        for (const endpoint of endpoints) {
            try {
                console.log(`🔍 Trying endpoint: ${endpoint}`);
                response = await fetch(`${EVOLUTION_API_URL}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': EVOLUTION_API_KEY
                    },
                    body: JSON.stringify({
                        where: {
                            remoteJid: GROUP_JID,
                            messageTimestamp: {
                                $gte: Math.floor(new Date('2025-06-25T19:45:00Z').getTime() / 1000),
                                $lte: Math.floor(new Date('2025-06-25T19:50:00Z').getTime() / 1000)
                            }
                        },
                        limit: 20
                    })
                });

                if (response.ok) {
                    console.log(`✅ Success with endpoint: ${endpoint}`);
                    break;
                }
            } catch (err) {
                console.log(`❌ Failed endpoint: ${endpoint}`);
                continue;
            }
        }

        if (!response.ok) {
            console.error('❌ Failed to fetch messages:', response.status, response.statusText);
            return;
        }

        const data = await response.json();
        console.log('📥 Fetched messages from Evolution API');

        // Filter messages from Michelle Smeke around 7:47 PM on June 25
        const targetTime = new Date('2025-06-25T19:47:00Z');
        const timeWindow = 5 * 60 * 1000; // 5 minutes window

        const michellesmithMessages = data.messages?.filter(msg => {
            const messageTime = new Date(msg.messageTimestamp * 1000);
            const isInTimeWindow = Math.abs(messageTime - targetTime) <= timeWindow;
            const isMichelle = msg.pushName?.includes('Michelle') || msg.pushName?.includes('Smeke');
            const isReply = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            
            return isInTimeWindow && isMichelle && isReply;
        });

        if (michellesmithMessages?.length > 0) {
            console.log('🎯 Found Michelle Smeke\'s lost reply message:');
            michellesmithMessages.forEach(msg => {
                console.log({
                    messageId: msg.key.id,
                    timestamp: new Date(msg.messageTimestamp * 1000),
                    content: msg.message?.conversation || msg.message?.extendedTextMessage?.text,
                    quotedMessage: msg.message?.extendedTextMessage?.contextInfo?.quotedMessage,
                    sender: msg.pushName
                });
            });

            // Process the recovered message through our webhook system
            for (const msg of michellesmithMessages) {
                console.log('🔄 Processing recovered message through webhook system...');
                
                const webhookPayload = {
                    instance: INSTANCE_ID,
                    data: {
                        key: msg.key,
                        pushName: msg.pushName,
                        message: msg.message,
                        messageTimestamp: msg.messageTimestamp
                    }
                };

                // Send to our webhook endpoint for processing
                const processResponse = await fetch('http://localhost:5000/webhook/instance-1750433520122/messages-upsert', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(webhookPayload)
                });

                if (processResponse.ok) {
                    console.log('✅ Successfully processed recovered message');
                } else {
                    console.error('❌ Failed to process recovered message');
                }
            }
        } else {
            console.log('❌ No matching messages found in the specified timeframe');
        }

    } catch (error) {
        console.error('❌ Error recovering message:', error.message);
    }
}

// Run the recovery
recoverLostMessage();