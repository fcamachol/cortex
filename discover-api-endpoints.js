import fetch from 'node-fetch';

async function discoverEvolutionApiEndpoints() {
  try {
    console.log('🔍 Discovering available Evolution API endpoints...');
    
    const instanceName = 'live-test-1750199771';
    const apiKey = '119FA240-45ED-46A7-AE13-5A1B7C909D7D';
    const baseUrl = 'https://evolution-api-evolution-api.vuswn0.easypanel.host';
    
    // Test common endpoint patterns based on Evolution API versions
    const endpointPatterns = [
      // Instance endpoints
      `/instance/fetchInstances`,
      `/instance/connect/${instanceName}`,
      `/instance/connectionState/${instanceName}`,
      
      // Message endpoints  
      `/message/findAll/${instanceName}`,
      `/message/find/${instanceName}`,
      
      // Chat endpoints
      `/chat/find/${instanceName}`,
      `/chat/fetchAll/${instanceName}`,
      `/chat/whatsAppNumbers/${instanceName}`,
      
      // Group endpoints (various patterns)
      `/group/fetch/${instanceName}`,
      `/group/participants/${instanceName}`,
      `/group/inviteCode/${instanceName}`,
      `/group/updateGroupPicture/${instanceName}`,
      `/group/updateGroupSubject/${instanceName}`,
      
      // Contact endpoints
      `/contact/find/${instanceName}`,
      `/contact/fetch/${instanceName}`,
      
      // Webhook endpoints
      `/webhook/find/${instanceName}`,
      `/webhook/set/${instanceName}`
    ];
    
    const workingEndpoints = [];
    const failedEndpoints = [];
    
    for (const endpoint of endpointPatterns) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'apikey': apiKey,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.status !== 404) {
          workingEndpoints.push({
            endpoint,
            status: response.status,
            method: 'GET'
          });
          console.log(`✅ ${endpoint} -> ${response.status}`);
        } else {
          failedEndpoints.push({ endpoint, status: 404 });
        }
        
        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        failedEndpoints.push({ endpoint, error: error.message });
      }
    }
    
    console.log(`\n📊 Discovery Results:`);
    console.log(`   ✅ Working endpoints: ${workingEndpoints.length}`);
    console.log(`   ❌ Failed endpoints: ${failedEndpoints.length}`);
    
    // Test POST endpoints for data operations
    console.log('\n🔍 Testing POST endpoints for data fetching...');
    const postEndpoints = [
      `/chat/findChat/${instanceName}`,
      `/group/findGroup/${instanceName}`,
      `/contact/findContact/${instanceName}`
    ];
    
    for (const endpoint of postEndpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'apikey': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });
        
        if (response.status !== 404) {
          workingEndpoints.push({
            endpoint,
            status: response.status,
            method: 'POST'
          });
          console.log(`✅ POST ${endpoint} -> ${response.status}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        // Continue with discovery
      }
    }
    
    return workingEndpoints;
    
  } catch (error) {
    console.error('❌ Discovery failed:', error);
    return [];
  }
}

discoverEvolutionApiEndpoints();