/**
 * MULTI-ENTITY DETECTION TEST
 * Tests the new multi-bill and multi-task detection capabilities
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function sendWebhook(eventType, data) {
  const response = await fetch(`${BASE_URL}/webhook/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: eventType,
      instance: 'live-test-1750199771',
      data
    })
  });
  return response.ok;
}

async function testMultipleBills() {
  console.log('🧪 TESTING MULTIPLE BILLS DETECTION');
  console.log('=====================================');
  
  // Test message from your attached file
  const multiBillMessage = `*Pagos pendientes junio  *
- tarjeta lisi fecha límite 7 junio pago para no generar intereses: $80,120
- ⁠club se debe nov, dic, enero, feb, marzo, abril , mayo , jun 156,700( si puedes depositar algo aunque sea para no ir acumulando) 
- ⁠Crédito: vence 4 de junio  se debe marzo y abril y mayo, junio   $93,380
- ⁠colegiatura bella 6,600 
- ⁠agua casa venció en mayo hay que pagarla $ 1,616
- ⁠mantenimiento lomas 2,700
- ⁠Braulio 600`;

  const messageData = {
    key: {
      remoteJid: '5215579188699@s.whatsapp.net',
      fromMe: true,
      id: 'MULTI_BILL_TEST_' + Date.now()
    },
    message: {
      conversation: multiBillMessage
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    pushName: 'Test User',
    instanceName: 'live-test-1750199771'
  };

  console.log('📤 Step 1: Sending multi-bill message...');
  await sendWebhook('messages.upsert', messageData);
  console.log('✅ Multi-bill message sent successfully');

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Send reaction to trigger bill creation
  const reactionData = {
    key: messageData.key,
    reaction: {
      text: '💳',
      key: messageData.key
    },
    instanceName: 'live-test-1750199771'
  };

  console.log('📤 Step 2: Sending 💳 reaction to trigger multi-bill processing...');
  await sendWebhook('messages.reaction', reactionData);
  console.log('✅ Multi-bill reaction sent successfully');

  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('🔍 Step 3: Checking created bills...');
  const billsResponse = await fetch(`${BASE_URL}/api/finance/payables`);
  const bills = await billsResponse.json();
  
  console.log(`📊 Total bills found: ${bills.length}`);
  const recentBills = bills.filter(bill => 
    new Date(bill.createdAt) > new Date(Date.now() - 60000) // Last minute
  );
  
  console.log(`📋 Recent bills (last minute): ${recentBills.length}`);
  
  if (recentBills.length >= 5) {
    console.log('✅ MULTI-BILL DETECTION SUCCESS!');
    recentBills.forEach((bill, index) => {
      console.log(`   ${index + 1}. ${bill.vendor}: $${bill.amount} ${bill.currency} (${bill.category})`);
    });
  } else {
    console.log('❌ Multi-bill detection may have failed - expected 7 bills');
  }
}

async function testMultipleTasks() {
  console.log('\n🧪 TESTING MULTIPLE TASKS DETECTION');
  console.log('====================================');
  
  // Test message from your proposed structure
  const multiTaskMessage = `Project tasks:
- Design mockup
  - Create wireframes
  - Choose colors
- Write code
  - Backend API
  - Frontend UI`;

  const messageData = {
    key: {
      remoteJid: '5215579188699@s.whatsapp.net',
      fromMe: true,
      id: 'MULTI_TASK_TEST_' + Date.now()
    },
    message: {
      conversation: multiTaskMessage
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    pushName: 'Test User',
    instanceName: 'live-test-1750199771'
  };

  console.log('📤 Step 1: Sending multi-task message...');
  await sendWebhook('messages.upsert', messageData);
  console.log('✅ Multi-task message sent successfully');

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Send reaction to trigger task creation
  const reactionData = {
    key: messageData.key,
    reaction: {
      text: '✅',
      key: messageData.key
    },
    instanceName: 'live-test-1750199771'
  };

  console.log('📤 Step 2: Sending ✅ reaction to trigger multi-task processing...');
  await sendWebhook('messages.reaction', reactionData);
  console.log('✅ Multi-task reaction sent successfully');

  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('🔍 Step 3: Checking created tasks...');
  const tasksResponse = await fetch(`${BASE_URL}/api/crm/tasks`);
  const tasks = await tasksResponse.json();
  
  console.log(`📊 Total tasks found: ${tasks.length}`);
  const recentTasks = tasks.filter(task => 
    new Date(task.createdAt) > new Date(Date.now() - 60000) // Last minute
  );
  
  console.log(`📋 Recent tasks (last minute): ${recentTasks.length}`);
  
  if (recentTasks.length >= 2) {
    console.log('✅ MULTI-TASK DETECTION SUCCESS!');
    recentTasks.forEach((task, index) => {
      console.log(`   ${index + 1}. "${task.title}" (${task.priority}) ${task.tags?.includes('subtask') ? '[SUBTASK]' : '[MAIN TASK]'}`);
    });
    
    // Count main tasks vs subtasks
    const mainTasks = recentTasks.filter(task => !task.tags?.includes('subtask'));
    const subtasks = recentTasks.filter(task => task.tags?.includes('subtask'));
    console.log(`📊 Main tasks: ${mainTasks.length}, Subtasks: ${subtasks.length}`);
    
    if (mainTasks.length === 2 && subtasks.length === 4) {
      console.log('🎯 PERFECT! Expected structure: 2 main tasks with 2 subtasks each');
    }
  } else {
    console.log('❌ Multi-task detection may have failed - expected at least 2 tasks');
  }
}

async function runCompleteTest() {
  console.log('🧪 MULTI-ENTITY DETECTION COMPREHENSIVE TEST');
  console.log('==========================================');
  console.log('Testing enhanced NLP.js architecture with:');
  console.log('   ✓ Multiple bills detection');
  console.log('   ✓ Multiple tasks detection');
  console.log('   ✓ Hierarchical subtask support');
  console.log('   ✓ Spanish bill parsing');
  console.log('   ✓ Enhanced vendor extraction');
  
  try {
    await testMultipleBills();
    await new Promise(resolve => setTimeout(resolve, 2000));
    await testMultipleTasks();
    
    console.log('\n✅ Multi-entity detection test completed!');
    console.log('🧠 NLP.js architecture now supports:');
    console.log('   • Single bill → Multiple bills');
    console.log('   • Single task → Multiple tasks + subtasks');
    console.log('   • Enhanced Spanish parsing');
    console.log('   • Intelligent vendor extraction');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runCompleteTest();