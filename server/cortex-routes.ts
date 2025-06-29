/**
 * CORTEX API ROUTES
 * New API endpoints that use Cortex schemas instead of CRM
 * Maintains backward compatibility with existing frontend components
 */

import { Router } from 'express';
import { storage } from './storage';

const router = Router();

// =====================================================
// CORTEX CONTACTS (replaces /api/crm/contacts)
// =====================================================

// Get all contacts from Cortex entities.persons
router.get('/contacts', async (req, res) => {
  try {
    const userId = req.user?.id || 'dev-user-placeholder';
    
    const contacts = await storage.query(`
      SELECT 
        p.id as contact_id,
        p.first_name,
        p.last_name,
        p.display_name as full_name,
        p.profession,
        p.description as notes,
        p.avatar as profile_picture_url,
        p.status,
        p.created_at,
        p.updated_at,
        -- Get primary phone
        (SELECT phone_number FROM cortex_entities.person_phones WHERE person_id = p.id AND is_primary = true LIMIT 1) as primary_phone,
        -- Get primary email  
        (SELECT email_address FROM cortex_entities.person_emails WHERE person_id = p.id AND is_primary = true LIMIT 1) as primary_email,
        -- Get WhatsApp linking info
        (SELECT is_whatsapp_linked FROM cortex_entities.person_phones WHERE person_id = p.id AND is_whatsapp_linked = true LIMIT 1) as is_whatsapp_linked,
        -- Get tags
        COALESCE(
          ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL),
          ARRAY[]::text[]
        ) as tags
      FROM cortex_entities.persons p
      LEFT JOIN cortex_entities.entity_tags et ON et.entity_id = p.id
      LEFT JOIN cortex_entities.tags t ON t.id = et.tag_id
      WHERE p.status = 'active'
      GROUP BY p.id, p.first_name, p.last_name, p.display_name, p.profession, p.description, p.avatar, p.status, p.created_at, p.updated_at
      ORDER BY p.created_at DESC
    `);

    res.json(contacts.rows);
  } catch (error) {
    console.error('Error fetching Cortex contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Get contact by ID from Cortex entities.persons
router.get('/contacts/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    
    const contact = await storage.query(`
      SELECT 
        p.*,
        -- Get all phones
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'phoneId', ph.id,
              'phoneNumber', ph.phone_number,
              'label', ph.label,
              'isPrimary', ph.is_primary,
              'isWhatsappLinked', ph.is_whatsapp_linked
            )
          ) FILTER (WHERE ph.id IS NOT NULL),
          '[]'::json
        ) as phones,
        -- Get all emails
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'emailId', e.id,
              'emailAddress', e.email_address,
              'label', e.label,
              'isPrimary', e.is_primary
            )
          ) FILTER (WHERE e.id IS NOT NULL),
          '[]'::json
        ) as emails,
        -- Get all addresses
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'addressId', a.id,
              'label', a.label,
              'street', a.street,
              'city', a.city,
              'state', a.state,
              'postalCode', a.postal_code,
              'country', a.country,
              'isPrimary', a.is_primary
            )
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'::json
        ) as addresses
      FROM cortex_entities.persons p
      LEFT JOIN cortex_entities.person_phones ph ON ph.person_id = p.id
      LEFT JOIN cortex_entities.person_emails e ON e.person_id = p.id
      LEFT JOIN cortex_entities.person_addresses a ON a.person_id = p.id
      WHERE p.id = $1
      GROUP BY p.id
    `, [contactId]);

    if (contact.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(contact.rows[0]);
  } catch (error) {
    console.error('Error fetching Cortex contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// Create new contact in Cortex entities.persons
router.post('/contacts', async (req, res) => {
  try {
    const contactData = req.body;
    const { randomUUID } = await import('crypto');
    const cortexPersonId = 'cp_' + randomUUID().replace(/-/g, '');

    // Insert person
    await storage.query(`
      INSERT INTO cortex_entities.persons (
        id, first_name, last_name, display_name, profession, 
        description, status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'active', NOW(), NOW()
      )
    `, [
      cortexPersonId,
      contactData.firstName || '',
      contactData.lastName || '',
      contactData.fullName || `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim(),
      contactData.profession,
      contactData.notes
    ]);

    // Add primary phone if provided
    if (contactData.primaryPhone) {
      await storage.query(`
        INSERT INTO cortex_entities.person_phones (
          person_id, phone_number, label, is_primary, is_whatsapp_linked
        ) VALUES ($1, $2, 'Mobile', true, $3)
      `, [
        cortexPersonId,
        contactData.primaryPhone,
        contactData.isWhatsappLinked || false
      ]);
    }

    // Add primary email if provided
    if (contactData.primaryEmail) {
      await storage.query(`
        INSERT INTO cortex_entities.person_emails (
          person_id, email_address, label, is_primary
        ) VALUES ($1, $2, 'Personal', true)
      `, [
        cortexPersonId,
        contactData.primaryEmail
      ]);
    }

    res.json({ contactId: cortexPersonId, ...contactData });
  } catch (error) {
    console.error('Error creating Cortex contact:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// =====================================================
// CORTEX TASKS (replaces /api/crm/tasks)
// =====================================================

// Get all tasks from Cortex projects.tasks
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await storage.query(`
      SELECT 
        t.id as task_id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.due_date,
        t.completed_at,
        t.estimated_hours,
        t.actual_hours,
        t.tags,
        t.created_at,
        t.updated_at,
        -- Get associated project info
        p.name as project_name,
        p.id as project_id,
        -- Get WhatsApp message links
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'messageId', tml.message_id,
              'instanceId', tml.instance_id,
              'linkType', tml.link_type
            )
          ) FILTER (WHERE tml.message_id IS NOT NULL),
          '[]'::json
        ) as message_links
      FROM cortex_projects.tasks t
      LEFT JOIN cortex_projects.projects p ON t.project_id = p.id
      LEFT JOIN cortex_communication.message_tasks tml ON tml.task_id = t.id
      GROUP BY t.id, p.name, p.id
      ORDER BY t.created_at DESC
    `);

    res.json(tasks.rows);
  } catch (error) {
    console.error('Error fetching Cortex tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create new task in Cortex projects.tasks
router.post('/tasks', async (req, res) => {
  try {
    const taskData = req.body;
    const { randomUUID } = await import('crypto');
    const cortexTaskId = randomUUID();

    await storage.query(`
      INSERT INTO cortex_projects.tasks (
        id, title, description, status, priority, due_date,
        estimated_hours, tags, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
      )
    `, [
      cortexTaskId,
      taskData.title,
      taskData.description,
      taskData.status || 'to_do',
      taskData.priority || 'medium',
      taskData.dueDate,
      taskData.estimatedHours,
      JSON.stringify(taskData.tags || [])
    ]);

    res.json({ taskId: cortexTaskId, ...taskData });
  } catch (error) {
    console.error('Error creating Cortex task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// =====================================================
// CORTEX PROJECTS (replaces /api/crm/projects)
// =====================================================

// Get all projects from Cortex projects.projects
router.get('/projects', async (req, res) => {
  try {
    const projects = await storage.query(`
      SELECT 
        p.id as project_id,
        p.name as project_name,
        p.description,
        p.status,
        p.priority,
        p.start_date,
        p.end_date,
        p.budget,
        p.spent_amount,
        p.progress,
        p.tags,
        p.color,
        p.created_at,
        p.updated_at,
        -- Count tasks
        (SELECT COUNT(*) FROM cortex_projects.tasks WHERE project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM cortex_projects.tasks WHERE project_id = p.id AND status = 'completed') as completed_tasks
      FROM cortex_projects.projects p
      ORDER BY p.created_at DESC
    `);

    res.json(projects.rows);
  } catch (error) {
    console.error('Error fetching Cortex projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// =====================================================
// CORTEX EVENTS (replaces /api/crm/events)
// =====================================================

// Get all events from Cortex scheduling.events
router.get('/events', async (req, res) => {
  try {
    const events = await storage.query(`
      SELECT 
        e.id as event_id,
        e.title,
        e.description,
        e.event_type,
        e.start_time,
        e.end_time,
        e.location,
        e.all_day,
        e.timezone,
        e.status,
        e.priority,
        e.created_at,
        e.updated_at
      FROM cortex_scheduling.events e
      ORDER BY e.start_time DESC
    `);

    res.json(events.rows);
  } catch (error) {
    console.error('Error fetching Cortex events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// =====================================================
// CORTEX NOTES (replaces /api/crm/notes)
// =====================================================

// Get all notes from Cortex knowledge.notes
router.get('/notes', async (req, res) => {
  try {
    const notes = await storage.query(`
      SELECT 
        n.id as note_id,
        n.title,
        n.content,
        n.content_type,
        n.word_count,
        n.note_type,
        n.is_pinned,
        n.is_archived,
        n.tags,
        n.created_at,
        n.updated_at
      FROM cortex_knowledge.notes n
      WHERE n.is_archived = false
      ORDER BY n.created_at DESC
    `);

    res.json(notes.rows);
  } catch (error) {
    console.error('Error fetching Cortex notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// =====================================================
// WHATSAPP LINK STATUS (maintains compatibility)
// =====================================================

// Get WhatsApp link status for contact
router.get('/contacts/whatsapp-link-status/:jid', async (req, res) => {
  try {
    const { jid } = req.params;
    
    // Check if JID exists in Cortex persons phones
    const linkStatus = await storage.query(`
      SELECT 
        p.id as contact_id,
        p.display_name as full_name,
        ph.is_whatsapp_linked,
        ph.phone_number
      FROM cortex_entities.persons p
      JOIN cortex_entities.person_phones ph ON ph.person_id = p.id
      WHERE ph.phone_number = $1 AND ph.is_whatsapp_linked = true
      LIMIT 1
    `, [jid.replace('@s.whatsapp.net', '')]);

    if (linkStatus.rows.length > 0) {
      res.json({
        isLinked: true,
        contactId: linkStatus.rows[0].contact_id,
        fullName: linkStatus.rows[0].full_name
      });
    } else {
      res.json({ isLinked: false });
    }
  } catch (error) {
    console.error('Error checking Cortex WhatsApp link status:', error);
    res.json({ isLinked: false });
  }
});

// Get WhatsApp link status for group
router.get('/groups/whatsapp-link-status/:jid', async (req, res) => {
  try {
    const { jid } = req.params;
    
    // Check if JID exists in Cortex groups
    const linkStatus = await storage.query(`
      SELECT 
        g.id as group_id,
        g.name,
        g.is_whatsapp_linked
      FROM cortex_entities.groups g
      WHERE g.whatsapp_jid = $1 AND g.is_whatsapp_linked = true
      LIMIT 1
    `, [jid]);

    if (linkStatus.rows.length > 0) {
      res.json({
        isLinked: true,
        groupId: linkStatus.rows[0].group_id,
        name: linkStatus.rows[0].name
      });
    } else {
      res.json({ isLinked: false });
    }
  } catch (error) {
    console.error('Error checking Cortex group WhatsApp link status:', error);
    res.json({ isLinked: false });
  }
});

export default router;