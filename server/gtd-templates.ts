/**
 * GTD Enhanced Emoji System Templates
 * Implementation of the comprehensive Getting Things Done methodology using emoji triggers
 */

export const GTD_TEMPLATES = [
  // ===============================
  // Part 1: Actionable Items
  // ===============================
  {
    templateId: "gtd-next-task",
    templateName: "✅ Next Task",
    description: "Create immediate physical task from message reaction. Use for single actionable items that need to be completed.",
    category: "gtd-actionable",
    triggerType: "reaction",
    actionType: "create_task",
    defaultConfig: {
      triggerConditions: {
        emoji: "✅",
        allowUpdateExisting: true // Key feature: update existing task if already created
      },
      actionConfig: {
        title: "{{content}}",
        description: "Task created from WhatsApp message reaction ✅\n\nOriginal message: \"{{content}}\"\nFrom: {{senderName}} ({{senderJid}})\nChat: {{chatName}}",
        priority: "medium",
        status: "todo",
        taskType: "next_task",
        dueDate: null,
        tags: ["whatsapp", "gtd", "next-task"]
      }
    }
  },
  {
    templateId: "gtd-payment-task",
    templateName: "💳 Next Task (Pay)",
    description: "Create payment task for outgoing payments. Use when you need to pay an invoice or make a payment.",
    category: "gtd-actionable",
    triggerType: "reaction",
    actionType: "create_task",
    defaultConfig: {
      triggerConditions: {
        emoji: "💳",
        allowUpdateExisting: true
      },
      actionConfig: {
        title: "💳 Pay: {{content}}",
        description: "Payment task created from WhatsApp message reaction 💳\n\nPayment details: \"{{content}}\"\nFrom: {{senderName}} ({{senderJid}})\nChat: {{chatName}}\n\n⚠️ Action Required: Process outgoing payment",
        priority: "high",
        status: "todo",
        taskType: "payment_outgoing",
        tags: ["whatsapp", "gtd", "payment", "finance", "outgoing"]
      }
    }
  },
  {
    templateId: "gtd-collect-task",
    templateName: "🧾 Next Task (Collect)",
    description: "Create collection task for invoicing or collecting payments. Use when you need to bill someone.",
    category: "gtd-actionable",
    triggerType: "reaction",
    actionType: "create_task",
    defaultConfig: {
      triggerConditions: {
        emoji: "🧾",
        allowUpdateExisting: true
      },
      actionConfig: {
        title: "🧾 Invoice: {{content}}",
        description: "Collection task created from WhatsApp message reaction 🧾\n\nBilling details: \"{{content}}\"\nClient: {{senderName}} ({{senderJid}})\nChat: {{chatName}}\n\n💰 Action Required: Send invoice or collect payment",
        priority: "high",
        status: "todo",
        taskType: "payment_incoming",
        tags: ["whatsapp", "gtd", "billing", "finance", "incoming"]
      }
    }
  },
  {
    templateId: "gtd-waiting-for",
    templateName: "⏳ Waiting For",
    description: "Track when you're waiting for someone else's input. Critical for GTD - logs that the ball is in their court.",
    category: "gtd-actionable",
    triggerType: "reaction",
    actionType: "create_waiting_for",
    defaultConfig: {
      triggerConditions: {
        emoji: "⏳",
        allowUpdateExisting: true
      },
      actionConfig: {
        title: "⏳ Waiting for: {{senderName}} - {{content}}",
        description: "Waiting For item created from WhatsApp message reaction ⏳\n\nWaiting for response to: \"{{content}}\"\nFrom: {{senderName}} ({{senderJid}})\nChat: {{chatName}}\n\n👥 Ball is in their court - delegated task",
        priority: "medium",
        status: "waiting",
        taskType: "waiting_for",
        waitingForPerson: "{{senderName}}",
        waitingForContact: "{{senderJid}}",
        tags: ["whatsapp", "gtd", "waiting-for", "delegated"]
      }
    }
  },

  // ===============================
  // Part 2: Multi-Step Outcomes
  // ===============================
  {
    templateId: "gtd-project",
    templateName: "🎯 Project",
    description: "Create project for multi-step outcomes. Use for goals requiring multiple tasks to complete.",
    category: "gtd-projects",
    triggerType: "reaction", 
    actionType: "create_project",
    defaultConfig: {
      triggerConditions: {
        emoji: "🎯",
        allowUpdateExisting: true
      },
      actionConfig: {
        title: "🎯 {{content}}",
        description: "Project created from WhatsApp message reaction 🎯\n\nProject scope: \"{{content}}\"\nInitiated by: {{senderName}} ({{senderJid}})\nChat: {{chatName}}\n\n🎯 Multi-step outcome requiring project planning",
        status: "planning",
        priority: "medium",
        projectType: "gtd_project",
        tags: ["whatsapp", "gtd", "project", "multi-step"]
      }
    }
  },
  {
    templateId: "gtd-checklist",
    templateName: "📋 Checklist / Project Plan",
    description: "Create detailed checklist to support a project. Use after creating a 🎯 Project to outline specific tasks.",
    category: "gtd-projects",
    triggerType: "reaction",
    actionType: "create_note",
    defaultConfig: {
      triggerConditions: {
        emoji: "📋",
        allowUpdateExisting: true
      },
      actionConfig: {
        title: "📋 Checklist: {{content}}",
        description: "Project checklist created from WhatsApp message reaction 📋\n\nChecklist for: \"{{content}}\"\nCreated by: {{senderName}} ({{senderJid}})\nChat: {{chatName}}\n\n📋 Action Items:\n- [ ] Define project scope\n- [ ] Break down into tasks\n- [ ] Assign responsibilities\n- [ ] Set deadlines\n- [ ] Track progress",
        noteType: "checklist",
        tags: ["whatsapp", "gtd", "checklist", "project-plan"]
      }
    }
  },

  // ===============================
  // Part 3: Non-Actionable & Future
  // ===============================
  {
    templateId: "gtd-someday-maybe",
    templateName: "💡 Someday/Maybe",
    description: "Capture ideas for future consideration. Perfect for brilliant ideas you might want to pursue later.",
    category: "gtd-future",
    triggerType: "reaction",
    actionType: "create_someday_maybe",
    defaultConfig: {
      triggerConditions: {
        emoji: "💡",
        allowUpdateExisting: true
      },
      actionConfig: {
        title: "💡 Idea: {{content}}",
        description: "Someday/Maybe item created from WhatsApp message reaction 💡\n\nIdea: \"{{content}}\"\nSuggested by: {{senderName}} ({{senderJid}})\nChat: {{chatName}}\n\n💡 Future consideration - not actionable now",
        priority: "low",
        status: "someday",
        taskType: "someday_maybe",
        tags: ["whatsapp", "gtd", "someday-maybe", "idea", "future"]
      }
    }
  },
  {
    templateId: "gtd-calendar",
    templateName: "📅 Calendar",
    description: "Create calendar event for time-specific appointments. Use only for true appointments and deadlines.",
    category: "gtd-future",
    triggerType: "reaction",
    actionType: "create_calendar_event",
    defaultConfig: {
      triggerConditions: {
        emoji: "📅",
        allowUpdateExisting: true
      },
      actionConfig: {
        title: "📅 {{content}}",
        description: "Calendar event created from WhatsApp message reaction 📅\n\nEvent: \"{{content}}\"\nWith: {{senderName}} ({{senderJid}})\nChat: {{chatName}}\n\n📅 Time-specific commitment",
        eventType: "appointment",
        isAllDay: false,
        tags: ["whatsapp", "gtd", "calendar", "appointment"]
      }
    }
  },
  {
    templateId: "gtd-reference",
    templateName: "📝 Reference",
    description: "Save non-actionable but useful information. Your digital filing cabinet for future reference.",
    category: "gtd-reference",
    triggerType: "reaction",
    actionType: "create_note",
    defaultConfig: {
      triggerConditions: {
        emoji: "📝",
        allowUpdateExisting: true
      },
      actionConfig: {
        title: "📝 Reference: {{content}}",
        description: "Reference note created from WhatsApp message reaction 📝\n\nReference info: \"{{content}}\"\nFrom: {{senderName}} ({{senderJid}})\nChat: {{chatName}}\n\n📝 Non-actionable reference material",
        noteType: "reference",
        tags: ["whatsapp", "gtd", "reference", "info"]
      }
    }
  },
  {
    templateId: "gtd-file-reference",
    templateName: "💾 Reference (File)",
    description: "Save files, documents, or media for future reference. Use for important documents and media files.",
    category: "gtd-reference",
    triggerType: "reaction",
    actionType: "create_file",
    defaultConfig: {
      triggerConditions: {
        emoji: "💾",
        allowUpdateExisting: true
      },
      actionConfig: {
        title: "💾 File: {{content}}",
        description: "File reference created from WhatsApp message reaction 💾\n\nFile context: \"{{content}}\"\nShared by: {{senderName}} ({{senderJid}})\nChat: {{chatName}}\n\n💾 Digital file for reference system",
        fileType: "reference",
        tags: ["whatsapp", "gtd", "file", "reference", "document"]
      }
    }
  }
];

/**
 * Enhanced action processing that handles task updates for same message
 */
export const GTD_ACTION_PROCESSOR = {
  /**
   * Check if a task already exists for this message and update it
   */
  async handleTaskUpdate(messageId: string, instanceId: string, emoji: string, actionConfig: any, storage: any) {
    try {
      // Check for existing task from this message
      const existingTasks = await storage.getTasksByTriggeringMessage(messageId, instanceId);
      
      if (existingTasks && existingTasks.length > 0) {
        // Update existing task instead of creating new one
        const existingTask = existingTasks[0];
        
        // Update task with new emoji context
        const updatedTask = await storage.updateTask(existingTask.taskId, {
          title: `${emoji} ${actionConfig.title}`,
          description: `${actionConfig.description}\n\n🔄 Updated from previous reaction`,
          status: actionConfig.status || existingTask.status,
          priority: actionConfig.priority || existingTask.priority,
          updatedAt: new Date()
        });
        
        console.log(`✅ Updated existing task ${existingTask.taskId} with new emoji ${emoji}`);
        return { type: 'update', task: updatedTask };
      } else {
        // No existing task, create new one
        return { type: 'create', task: null };
      }
    } catch (error) {
      console.error('Error checking for existing task:', error);
      return { type: 'create', task: null };
    }
  },

  /**
   * Get GTD template by emoji
   */
  getTemplateByEmoji(emoji: string) {
    return GTD_TEMPLATES.find(template => 
      template.defaultConfig.triggerConditions.emoji === emoji
    );
  }
};