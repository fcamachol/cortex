const fetch = require('node-fetch');

async function syncPrueba7Instance() {
  try {
    // Create instance in Evolution API
    const createResponse = await fetch('https://evolution-api-evolution-api.vuswn0.easypanel.host/instance/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': 'B6D711FCDE4D4FD5936544120E713976'
      },
      body: JSON.stringify({
        instanceName: 'prueba-7',
        integration: 'WHATSAPP-BAILEYS',
        webhook_url: 'https://rest-express-repl.replit.app/webhook/evolution/prueba-7',
        webhook_wa_business: 'true',
        webhook_wa_groups: 'true',
        events: [
          'APPLICATION_STARTUP',
          'QRCODE_UPDATED', 
          'CONNECTION_UPDATE',
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'MESSAGES_DELETE',
          'SEND_MESSAGE',
          'CONTACTS_UPDATE',
          'CONTACTS_UPSERT',
          'PRESENCE_UPDATE',
          'CHATS_UPDATE',
          'CHATS_UPSERT',
          'CHATS_DELETE',
          'GROUPS_UPSERT',
          'GROUP_UPDATE',
          'GROUP_PARTICIPANTS_UPDATE',
          'MESSAGE_REACTION',
          'CALL'
        ],
        qrcode: true
      })
    });

    const result = await createResponse.json();
    console.log('Evolution API Response:', result);

    if (result.hash?.apikey) {
      console.log('Instance created successfully with API key:', result.hash.apikey);
      
      // Update the database with the API key
      const { Pool } = require('@neondatabase/serverless');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      
      await pool.query(
        'UPDATE whatsapp.instances SET api_key = $1, updated_at = NOW() WHERE instance_id = $2',
        [result.hash.apikey, 'prueba-7']
      );
      
      console.log('Database updated with API key');
    }

  } catch (error) {
    console.error('Error syncing instance:', error);
  }
}

syncPrueba7Instance();