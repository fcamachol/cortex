import { db } from "./db";
import { 
  appUsers, 
  whatsappInstances, 
  whatsappContacts, 
  whatsappConversations, 
  whatsappMessages,
  tasks,
  contacts,
  conversations,
  messages
} from "@shared/schema";

export async function seedDatabase() {
  try {
    console.log("Seeding database...");

    // Create a demo user
    const [user] = await db.insert(appUsers).values({
      email: "demo@example.com",
      firstName: "Demo",
      lastName: "User",
      passwordHash: "demo123",
      status: "active",
      plan: "premium"
    }).returning();

    console.log("Created demo user:", user.id);

    // Create WhatsApp instance
    const [whatsappInstance] = await db.insert(whatsappInstances).values({
      userId: user.id,
      instanceName: "personal_phone",
      displayName: "Personal WhatsApp",
      apiKey: "demo-api-key",
      phoneNumber: "+1234567890",
      profileName: "Demo User",
      status: "connected"
    }).returning();

    // Create WhatsApp contacts
    const whatsappContactsData = [
      {
        instanceId: whatsappInstance.id,
        userId: user.id,
        whatsappId: "+1234567891@s.whatsapp.net",
        name: "John Smith",
        displayName: "John",
        isBusiness: false,
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 30) // 30 minutes ago
      },
      {
        instanceId: whatsappInstance.id,
        userId: user.id,
        whatsappId: "+1234567892@s.whatsapp.net",
        name: "Sarah Johnson",
        displayName: "Sarah",
        isBusiness: true,
        businessDescription: "Marketing Agency Owner",
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 120) // 2 hours ago
      },
      {
        instanceId: whatsappInstance.id,
        userId: user.id,
        whatsappId: "+1234567893@s.whatsapp.net",
        name: "Mike Wilson",
        displayName: "Mike",
        isBusiness: false,
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 24) // 1 day ago
      }
    ];

    const createdWhatsappContacts = await db.insert(whatsappContacts).values(whatsappContactsData).returning();

    // Create WhatsApp conversations
    const conversationsData = createdWhatsappContacts.map((contact, index) => ({
      instanceId: whatsappInstance.id,
      userId: user.id,
      chatId: contact.whatsappId,
      type: "individual" as const,
      contactId: contact.id,
      title: contact.name,
      unreadCount: index === 0 ? 2 : 0,
      isPinned: index === 0
    }));

    const createdConversations = await db.insert(whatsappConversations).values(conversationsData).returning();

    // Create WhatsApp messages
    const messagesData = [
      // Conversation with John Smith
      {
        instanceId: whatsappInstance.id,
        userId: user.id,
        conversationId: createdConversations[0].id,
        messageId: "msg1",
        fromNumber: createdWhatsappContacts[0].whatsappId,
        toNumber: whatsappInstance.phoneNumber || "",
        messageType: "text" as const,
        content: "Hey! How are you doing?",
        isFromMe: false,
        timestamp: Date.now() - 1000 * 60 * 30
      },
      {
        instanceId: whatsappInstance.id,
        userId: user.id,
        conversationId: createdConversations[0].id,
        messageId: "msg2",
        fromNumber: whatsappInstance.phoneNumber || "",
        toNumber: createdWhatsappContacts[0].whatsappId,
        messageType: "text" as const,
        content: "I'm doing great! Thanks for asking. How about you?",
        isFromMe: true,
        timestamp: Date.now() - 1000 * 60 * 25
      },
      {
        instanceId: whatsappInstance.id,
        userId: user.id,
        conversationId: createdConversations[0].id,
        messageId: "msg3",
        fromNumber: createdWhatsappContacts[0].whatsappId,
        toNumber: whatsappInstance.phoneNumber || "",
        messageType: "text" as const,
        content: "All good here! Want to catch up this weekend?",
        isFromMe: false,
        timestamp: Date.now() - 1000 * 60 * 20
      },
      // Conversation with Sarah Johnson
      {
        instanceId: whatsappInstance.id,
        userId: user.id,
        conversationId: createdConversations[1].id,
        messageId: "msg4",
        fromNumber: createdWhatsappContacts[1].whatsappId,
        toNumber: whatsappInstance.phoneNumber || "",
        messageType: "text" as const,
        content: "Hi! I wanted to discuss the marketing campaign proposal.",
        isFromMe: false,
        timestamp: Date.now() - 1000 * 60 * 120
      },
      {
        instanceId: whatsappInstance.id,
        userId: user.id,
        conversationId: createdConversations[1].id,
        messageId: "msg5",
        fromNumber: whatsappInstance.phoneNumber || "",
        toNumber: createdWhatsappContacts[1].whatsappId,
        messageType: "text" as const,
        content: "Sure! I'll review it and get back to you by tomorrow.",
        isFromMe: true,
        timestamp: Date.now() - 1000 * 60 * 115
      }
    ];

    await db.insert(whatsappMessages).values(messagesData);

    // Create regular contacts
    const contactsData = [
      {
        userId: user.id,
        name: "Alice Cooper",
        phone: "+1234567894",
        email: "alice@example.com",
        company: "Tech Solutions Inc",
        jobTitle: "CEO"
      },
      {
        userId: user.id,
        name: "Bob Martinez",
        phone: "+1234567895",
        email: "bob@marketing.com",
        company: "Marketing Pro",
        jobTitle: "Marketing Director"
      },
      {
        userId: user.id,
        name: "Carol Davis",
        phone: "+1234567896",
        email: "carol@design.com",
        company: "Creative Studio",
        jobTitle: "Lead Designer"
      }
    ];

    const createdContacts = await db.insert(contacts).values(contactsData).returning();

    // Create tasks
    const tasksData = [
      {
        userId: user.id,
        title: "Follow up with Sarah about marketing proposal",
        description: "Review the proposal and provide feedback by tomorrow",
        taskStatus: "to_do",
        priority: "high",
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24), // Tomorrow
        conversationId: createdConversations[1].id,
        contactId: createdWhatsappContacts[1].id
      },
      {
        userId: user.id,
        title: "Schedule meeting with Alice Cooper",
        description: "Discuss the new tech solutions project",
        taskStatus: "to_do",
        priority: "medium",
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 48) // Day after tomorrow
      },
      {
        userId: user.id,
        title: "Complete project documentation",
        description: "Finalize all project documents and deliverables",
        taskStatus: "in_progress",
        priority: "high",
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 72) // 3 days
      },
      {
        userId: user.id,
        title: "Review Q4 budget",
        description: "Analyze expenses and plan for next quarter",
        taskStatus: "done",
        priority: "medium"
      },
      {
        userId: user.id,
        title: "Weekend catch up with John",
        description: "Personal meeting to catch up",
        taskStatus: "to_do",
        priority: "low",
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 120) // 5 days
      }
    ];

    await db.insert(tasks).values(tasksData);

    // Create regular conversations
    const regularConversationsData = createdContacts.map(contact => ({
      userId: user.id,
      contactId: contact.id,
      lastMessage: "Let's schedule a meeting to discuss the project details.",
      lastMessageAt: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 24 * 7), // Random within last week
      isUnread: Math.random() > 0.7
    }));

    const createdRegularConversations = await db.insert(conversations).values(regularConversationsData).returning();

    // Create regular messages
    const regularMessagesData = createdRegularConversations.flatMap((conversation, index) => [
      {
        userId: user.id,
        conversationId: conversation.id,
        content: "Hi! I wanted to discuss our upcoming project.",
        messageType: "text",
        isFromUser: false,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2)
      },
      {
        userId: user.id,
        conversationId: conversation.id,
        content: "Sure! Let's schedule a meeting to discuss the project details.",
        messageType: "text",
        isFromUser: true,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1)
      }
    ]);

    await db.insert(messages).values(regularMessagesData);

    console.log("Database seeded successfully!");
    console.log("Demo user ID:", user.id);
    console.log("Use 'user-1' as the user ID to see the demo data");

  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase().then(() => process.exit(0));
}