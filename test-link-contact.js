import fetch from 'node-fetch';

const API_BASE = 'https://cf94481b-abb0-462d-99ce-66c0beae05d0-00-25qqlo4pnl49g.worf.replit.dev';

async function testLinkContact() {
    console.log('🔗 Testing WhatsApp-CRM Contact Linking');
    
    try {
        // Test linking for Lisi's contact (ID: 8) with her phone number
        const response = await fetch(`${API_BASE}/api/contacts/8/link-whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber: '+5215585333840' })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Linking result:', result);
        } else {
            console.log('❌ Linking failed:', await response.text());
        }

        // Check the status after linking
        const statusResponse = await fetch(`${API_BASE}/api/contacts/8/whatsapp-status`);
        if (statusResponse.ok) {
            const status = await statusResponse.json();
            console.log('📱 WhatsApp Status:', status);
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testLinkContact();