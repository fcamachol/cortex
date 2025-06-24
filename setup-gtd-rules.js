#!/usr/bin/env node

/**
 * Setup GTD rules directly via database
 */

const GTD_RULES = [
  {
    ruleName: "✅ Next Task",
    description: "Create immediate physical task from message reaction",
    triggerType: "reaction",
    triggerConditions: { emoji: "✅", allowUpdateExisting: true },
    actionType: "create_task",
    actionConfig: {
      title: "{{content}}",
      description: "Task created from WhatsApp message reaction ✅",
      priority: "medium",
      status: "todo",
      taskType: "next_task"
    },
    isActive: true,
    gtdTemplate: true,
    category: "gtd-actionable"
  },
  {
    ruleName: "💳 Payment Task",
    description: "Create payment task for outgoing payments",
    triggerType: "reaction", 
    triggerConditions: { emoji: "💳", allowUpdateExisting: true },
    actionType: "create_task",
    actionConfig: {
      title: "💳 Pay: {{content}}",
      description: "Payment task created from WhatsApp message reaction 💳",
      priority: "high",
      status: "todo",
      taskType: "payment_outgoing"
    },
    isActive: true,
    gtdTemplate: true,
    category: "gtd-actionable"
  }
];

async function setupGTDRules() {
  console.log('Setting up GTD rules...');
  
  for (const rule of GTD_RULES) {
    try {
      const response = await fetch('http://localhost:5000/api/actions/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      });
      
      if (response.ok) {
        console.log(`✅ Created: ${rule.ruleName}`);
      } else {
        const error = await response.text();
        console.log(`❌ Failed: ${rule.ruleName} - ${error}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${rule.ruleName} - ${error.message}`);
    }
  }
}

setupGTDRules();