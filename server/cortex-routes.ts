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
// CORTEX ENTITIES - VENDOR CREATION ENDPOINTS
// =====================================================

// Create new person entity (for VendorSelect)
router.post('/entities/persons', async (req, res) => {
  try {
    const { name, userId } = req.body;
    const { randomUUID } = await import('crypto');
    const cortexPersonId = 'cp_' + randomUUID().replace(/-/g, '');

    // Parse name into first and last
    const nameParts = name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    await storage.query(`
      INSERT INTO cortex_entities.persons (
        id, first_name, last_name, display_name, status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, 'active', NOW(), NOW()
      )
    `, [
      cortexPersonId,
      firstName,
      lastName,
      name
    ]);

    res.json({ id: cortexPersonId, name: name, type: 'person' });
  } catch (error) {
    console.error('Error creating Cortex person entity:', error);
    res.status(500).json({ error: 'Failed to create person entity' });
  }
});

// Create new company entity (for VendorSelect)
router.post('/entities/companies', async (req, res) => {
  try {
    const { name, userId } = req.body;
    const { randomUUID } = await import('crypto');
    const cortexCompanyId = 'cc_' + randomUUID().replace(/-/g, '');

    await storage.query(`
      INSERT INTO cortex_entities.companies (
        id, name, status, created_at, updated_at
      ) VALUES (
        $1, $2, 'active', NOW(), NOW()
      )
    `, [
      cortexCompanyId,
      name
    ]);

    res.json({ id: cortexCompanyId, name: name, type: 'company' });
  } catch (error) {
    console.error('Error creating Cortex company entity:', error);
    res.status(500).json({ error: 'Failed to create company entity' });
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

// ================================
// FINANCE TRANSACTIONS ROUTES
// ================================

// Get all transactions
router.get('/finance/transactions', async (req, res) => {
  try {
    const userId = req.user?.id || "7804247f-3ae8-4eb2-8c6d-2c44f967ad42";
    
    const transactions = await storage.query(`
      SELECT 
        t.*,
        da.name as debit_account_name,
        da.account_type as debit_account_type,
        ca.name as credit_account_name,
        ca.account_type as credit_account_type
      FROM cortex_finance.transactions t
      LEFT JOIN cortex_finance.accounts da ON t.debit_account_entity_id = da.id
      LEFT JOIN cortex_finance.accounts ca ON t.credit_account_entity_id = ca.id
      WHERE t.created_by_entity_id = $1
      ORDER BY t.transaction_date DESC, t.created_at DESC
    `, [userId]);

    res.json(transactions.rows);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Create new transaction
router.post('/finance/transactions', async (req, res) => {
  try {
    const userId = req.user?.id || "7804247f-3ae8-4eb2-8c6d-2c44f967ad42";
    const transactionData = {
      ...req.body,
      created_by_entity_id: userId
    };

    const result = await storage.query(`
      INSERT INTO cortex_finance.transactions (
        amount, transaction_type, description, transaction_date,
        category, subcategory, debit_account_entity_id, credit_account_entity_id,
        vendor_entity_id, project_entity_id, bill_payable_id, bill_receivable_id,
        transaction_source, reference, reconciled, reconciled_date,
        created_by_entity_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING *
    `, [
      transactionData.amount,
      transactionData.transactionType,
      transactionData.description,
      transactionData.transactionDate,
      transactionData.category,
      transactionData.subcategory,
      transactionData.debitAccountEntityId,
      transactionData.creditAccountEntityId,
      transactionData.vendorEntityId,
      transactionData.projectEntityId,
      transactionData.billPayableId,
      transactionData.billReceivableId,
      transactionData.transactionSource || 'manual',
      transactionData.reference,
      transactionData.reconciled || false,
      transactionData.reconciledDate,
      transactionData.created_by_entity_id
    ]);

    // Update account balances based on transaction
    await updateAccountBalances(
      transactionData.debitAccountEntityId,
      transactionData.creditAccountEntityId,
      parseFloat(transactionData.amount)
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// Helper function to update account balances
async function updateAccountBalances(debitAccountId: string, creditAccountId: string, amount: number) {
  try {
    // For debit account: increase balance (assets increase with debits)
    // For credit account: decrease balance (assets decrease with credits, liabilities increase with credits)
    
    // Get account types first
    const accountsInfo = await storage.query(`
      SELECT id, account_type, balance FROM cortex_finance.accounts 
      WHERE id IN ($1, $2)
    `, [debitAccountId, creditAccountId]);

    for (const account of accountsInfo.rows) {
      let balanceChange = 0;
      
      if (account.id === debitAccountId) {
        // Debit side
        if (['checking', 'savings', 'cash', 'expense'].includes(account.account_type)) {
          balanceChange = amount; // Assets and expenses increase with debits
        } else if (['credit_card', 'loan'].includes(account.account_type)) {
          balanceChange = -amount; // Liabilities decrease with debits (paying down debt)
        }
      } else if (account.id === creditAccountId) {
        // Credit side
        if (['checking', 'savings', 'cash'].includes(account.account_type)) {
          balanceChange = -amount; // Assets decrease with credits
        } else if (['credit_card', 'loan'].includes(account.account_type)) {
          balanceChange = amount; // Liabilities increase with credits (charging card, borrowing)
        } else if (account.account_type === 'income') {
          balanceChange = amount; // Income increases with credits
        }
      }

      // Update the balance
      await storage.query(`
        UPDATE cortex_finance.accounts 
        SET balance = balance + $1,
            updated_at = NOW()
        WHERE id = $2
      `, [balanceChange, account.id]);
    }
  } catch (error) {
    console.error('Error updating account balances:', error);
    // Don't throw here to avoid breaking transaction creation
  }
}

// Get all accounts
router.get('/finance/accounts', async (req, res) => {
  try {
    const userId = req.user?.id || "7804247f-3ae8-4eb2-8c6d-2c44f967ad42";
    
    const accounts = await storage.query(`
      SELECT * FROM cortex_finance.accounts
      WHERE created_by_entity_id = $1 AND is_active = true
      ORDER BY account_type, name
    `, [userId]);

    res.json(accounts.rows);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Create new account
router.post('/finance/accounts', async (req, res) => {
  try {
    const userId = req.user?.id || "7804247f-3ae8-4eb2-8c6d-2c44f967ad42";
    
    // Generate account entity ID with ca_ prefix
    const accountId = `ca_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    
    const accountData = {
      ...req.body,
      id: accountId,
      created_by_entity_id: userId
    };

    const result = await storage.query(`
      INSERT INTO cortex_finance.accounts (
        id, name, account_type, account_number, bank_name, 
        balance, currency, is_active, description, 
        contact_entity_id, created_by_entity_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      ) RETURNING *
    `, [
      accountData.id,
      accountData.name,
      accountData.accountType,
      accountData.accountNumber,
      accountData.bankName,
      accountData.balance || '0.00',
      accountData.currency || 'USD',
      accountData.isActive !== false,
      accountData.description,
      accountData.contactEntityId,
      accountData.created_by_entity_id
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// =====================================================
// CORTEX AUTOMATION RULES (WhatsApp Instance & Permissions)
// =====================================================

// Get all automation rules with WhatsApp instance and permission info
router.get('/automation/rules', async (req, res) => {
  try {
    const rules = await storage.query(`
      SELECT 
        r.id,
        r.name,
        r.description,
        r.is_active,
        r.trigger_type,
        r.priority,
        r.created_by,
        r.space_id,
        r.whatsapp_instance_id,
        r.trigger_permission,
        r.allowed_user_ids,
        r.last_executed_at,
        r.execution_count,
        r.success_count,
        r.failure_count,
        r.created_at,
        r.updated_at,
        -- Get associated WhatsApp instance name
        (SELECT instance_name FROM whatsapp.instances WHERE id = r.whatsapp_instance_id) as instance_name,
        -- Get conditions
        COALESCE(
          ARRAY_AGG(
            json_build_object(
              'id', rc.id,
              'condition_type', rc.condition_type,
              'operator', rc.operator,
              'field_name', rc.field_name,
              'value', rc.value,
              'is_negated', rc.is_negated
            )
          ) FILTER (WHERE rc.id IS NOT NULL),
          ARRAY[]::json[]
        ) as conditions,
        -- Get actions
        COALESCE(
          ARRAY_AGG(
            json_build_object(
              'id', ra.id,
              'action_type', ra.action_type,
              'action_order', ra.action_order,
              'target_entity_id', ra.target_entity_id,
              'parameters', ra.parameters,
              'template_id', ra.template_id
            ) ORDER BY ra.action_order
          ) FILTER (WHERE ra.id IS NOT NULL),
          ARRAY[]::json[]
        ) as actions
      FROM cortex_automation.rules r
      LEFT JOIN cortex_automation.rule_conditions rc ON r.id = rc.rule_id
      LEFT JOIN cortex_automation.rule_actions ra ON r.id = ra.rule_id
      GROUP BY r.id, r.name, r.description, r.is_active, r.trigger_type, r.priority, 
               r.created_by, r.space_id, r.whatsapp_instance_id, r.trigger_permission, 
               r.allowed_user_ids, r.last_executed_at, r.execution_count, r.success_count, 
               r.failure_count, r.created_at, r.updated_at
      ORDER BY r.priority DESC, r.created_at DESC
    `);

    res.json(rules.rows);
  } catch (error) {
    console.error('Error fetching automation rules:', error);
    res.status(500).json({ error: 'Failed to fetch automation rules' });
  }
});

// Create new automation rule with WhatsApp instance and permission settings
router.post('/automation/rules', async (req, res) => {
  try {
    const userId = req.user?.id || 'dev-user-placeholder';
    const {
      name,
      description,
      triggerType,
      whatsappInstanceId,
      triggerPermission = 'anyone',
      allowedUserIds,
      conditions = [],
      actions = []
    } = req.body;

    // Create the rule
    const ruleResult = await storage.query(`
      INSERT INTO cortex_automation.rules (
        id, name, description, is_active, trigger_type, priority, created_by,
        whatsapp_instance_id, trigger_permission, allowed_user_ids
      ) VALUES (
        gen_random_uuid(), $1, $2, true, $3, 100, $4, $5, $6, $7
      ) RETURNING *
    `, [name, description, triggerType, userId, whatsappInstanceId, triggerPermission, allowedUserIds]);

    const rule = ruleResult.rows[0];

    // Add conditions
    for (const condition of conditions) {
      await storage.query(`
        INSERT INTO cortex_automation.rule_conditions (
          rule_id, condition_type, operator, field_name, value, is_negated
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [rule.id, condition.conditionType, condition.operator, condition.fieldName, condition.value, condition.isNegated || false]);
    }

    // Add actions
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      await storage.query(`
        INSERT INTO cortex_automation.rule_actions (
          rule_id, action_type, action_order, target_entity_id, parameters, template_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [rule.id, action.actionType, i + 1, action.targetEntityId, action.parameters, action.templateId]);
    }

    res.status(201).json({ 
      message: 'Automation rule created successfully',
      rule: rule
    });
  } catch (error) {
    console.error('Error creating automation rule:', error);
    res.status(500).json({ error: 'Failed to create automation rule' });
  }
});

// Update automation rule WhatsApp instance and permission settings
router.put('/automation/rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const {
      name,
      description,
      isActive,
      whatsappInstanceId,
      triggerPermission,
      allowedUserIds
    } = req.body;

    const result = await storage.query(`
      UPDATE cortex_automation.rules
      SET 
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        is_active = COALESCE($4, is_active),
        whatsapp_instance_id = COALESCE($5, whatsapp_instance_id),
        trigger_permission = COALESCE($6, trigger_permission),
        allowed_user_ids = COALESCE($7, allowed_user_ids),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [ruleId, name, description, isActive, whatsappInstanceId, triggerPermission, allowedUserIds]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Automation rule not found' });
    }

    res.json({
      message: 'Automation rule updated successfully',
      rule: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating automation rule:', error);
    res.status(500).json({ error: 'Failed to update automation rule' });
  }
});

// Get WhatsApp instances for rule configuration
router.get('/automation/whatsapp-instances', async (req, res) => {
  try {
    const instances = await storage.query(`
      SELECT 
        id,
        instance_name,
        display_name,
        status,
        is_connected,
        created_at
      FROM whatsapp.instances
      WHERE status = 'active'
      ORDER BY instance_name
    `);

    res.json(instances.rows);
  } catch (error) {
    console.error('Error fetching WhatsApp instances:', error);
    res.status(500).json({ error: 'Failed to fetch WhatsApp instances' });
  }
});

export default router;