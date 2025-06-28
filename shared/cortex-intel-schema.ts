import { pgSchema, pgView } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Create cortex_intel schema
export const cortexIntelSchema = pgSchema("cortex_intel");

// Unified entity view - provides comprehensive view of all entities across schemas
export const allEntitiesView = cortexIntelSchema.view("all_entities").as(sql`
  SELECT 
      p.id, 'person' as entity_type, p.full_name as name, 
      p.primary_whatsapp_jid as primary_contact, p.created_at, p.updated_at,
      jsonb_build_object(
          'first_name', p.first_name, 'profession', p.profession,
          'whatsapp_linked', p.is_whatsapp_linked
      ) as metadata
  FROM cortex_entities.persons p WHERE p.is_active = TRUE
  UNION ALL
  SELECT 
      c.id, 'company' as entity_type, c.name,
      COALESCE(c.main_email, c.main_phone) as primary_contact, c.created_at, c.updated_at,
      jsonb_build_object(
          'business_type', c.business_type, 'industry', c.industry,
          'is_client', c.is_client, 'is_vendor', c.is_vendor
      ) as metadata
  FROM cortex_entities.companies c WHERE c.status = 'active'
  UNION ALL
  SELECT 
      pr.id, 'project' as entity_type, pr.name,
      pr.description as primary_contact, pr.created_at, pr.updated_at,
      jsonb_build_object(
          'status', pr.status, 'progress', pr.progress_percentage,
          'budget', pr.budget, 'owner_id', pr.owner_entity_id
      ) as metadata
  FROM cortex_projects.projects pr
  UNION ALL
  SELECT 
      o.id, 'object' as entity_type, o.name,
      o.location as primary_contact, o.created_at, o.updated_at,
      jsonb_build_object(
          'object_type', o.object_type, 'brand', o.brand,
          'current_value', o.current_value, 'owner_id', o.current_owner_entity_id
      ) as metadata
  FROM cortex_entities.objects o WHERE o.status = 'active'
  UNION ALL
  SELECT 
      g.id, 'group' as entity_type, g.name,
      g.description as primary_contact, g.created_at, g.updated_at,
      jsonb_build_object(
          'group_type', g.group_type, 'whatsapp_linked', g.is_whatsapp_linked
      ) as metadata
  FROM cortex_entities.groups g WHERE g.status = 'active'
  UNION ALL
  SELECT 
      a.id, 'account' as entity_type, a.name,
      a.institution_name as primary_contact, a.created_at, a.updated_at,
      jsonb_build_object(
          'account_type', a.account_type, 'balance', a.current_balance,
          'currency', a.currency
      ) as metadata
  FROM cortex_finance.accounts a WHERE a.status = 'active'
  UNION ALL
  SELECT 
      s.id, 'space' as entity_type, s.name,
      s.description as primary_contact, s.created_at, s.updated_at,
      jsonb_build_object(
          'space_type', s.space_type, 'privacy', s.privacy,
          'is_starred', s.is_starred
      ) as metadata
  FROM cortex_foundation.spaces s WHERE s.is_archived = FALSE
`);

// Unified content view - provides comprehensive view of all content across schemas
export const allContentView = cortexIntelSchema.view("all_content").as(sql`
  SELECT 
      t.id, 'task' as content_type, t.title, t.description,
      t.created_at, t.updated_at,
      jsonb_build_object(
          'status', t.status, 'priority', t.priority,
          'assigned_to', t.assigned_to_entity_id, 'project_id', t.project_entity_id
      ) as metadata
  FROM cortex_projects.tasks t
  UNION ALL
  SELECT 
      n.id, 'note' as content_type, n.title, LEFT(n.content, 200) as description,
      n.created_at, n.updated_at,
      jsonb_build_object(
          'note_type', n.note_type, 'word_count', n.word_count,
          'is_pinned', n.is_pinned
      ) as metadata
  FROM cortex_knowledge.notes n WHERE n.is_archived = FALSE
  UNION ALL
  SELECT 
      d.id, 'document' as content_type, COALESCE(d.title, d.filename) as title, d.description,
      d.created_at, d.updated_at,
      jsonb_build_object(
          'document_type', d.document_type, 'mime_type', d.mime_type,
          'google_drive_id', d.google_drive_file_id
      ) as metadata
  FROM cortex_knowledge.documents d WHERE d.is_deleted = FALSE
  UNION ALL
  SELECT 
      e.id, 'event' as content_type, e.title, e.description,
      e.created_at, e.updated_at,
      jsonb_build_object(
          'start_time', e.start_time, 'end_time', e.end_time,
          'location', e.location, 'status', e.status
      ) as metadata
  FROM cortex_scheduling.events e
  UNION ALL
  SELECT 
      tr.id, 'transaction' as content_type, tr.description as title,
      'Amount: ' || tr.amount || ' ' || 
      COALESCE((SELECT currency FROM cortex_finance.accounts WHERE id = tr.from_account_entity_id), 'USD') as description,
      tr.created_at, tr.updated_at,
      jsonb_build_object(
          'amount', tr.amount, 'transaction_type', tr.transaction_type,
          'vendor_id', tr.vendor_entity_id
      ) as metadata
  FROM cortex_finance.transactions tr
`);

// Universal relationships view - shows all relationships between entities and content
export const allRelationshipsView = cortexIntelSchema.view("all_relationships").as(sql`
  SELECT 
      er.id, er.from_entity_id,
      ae1.entity_type as from_entity_type, ae1.name as from_entity_name,
      er.to_entity_id, ae2.entity_type as to_entity_type, ae2.name as to_entity_name,
      er.content_type, er.content_id, ac.title as content_title,
      er.relationship_type, er.metadata, er.weight, er.created_at, er.is_bidirectional,
      CASE 
          WHEN er.to_entity_id IS NOT NULL THEN 'entity_to_entity'
          ELSE 'entity_to_content'
      END as link_type
  FROM cortex_foundation.entity_relationships er
  LEFT JOIN cortex_intel.all_entities ae1 ON er.from_entity_id = ae1.id
  LEFT JOIN cortex_intel.all_entities ae2 ON er.to_entity_id = ae2.id
  LEFT JOIN cortex_intel.all_content ac ON er.content_id::text = ac.id::text 
      AND er.content_type = ac.content_type
  WHERE er.is_active = TRUE
`);

// Entity activity summary view - provides activity insights per entity
export const entityActivityView = cortexIntelSchema.view("entity_activity").as(sql`
  WITH entity_counts AS (
    SELECT 
      from_entity_id as entity_id,
      COUNT(*) as total_relationships,
      COUNT(CASE WHEN content_type = 'task' THEN 1 END) as task_count,
      COUNT(CASE WHEN content_type = 'note' THEN 1 END) as note_count,
      COUNT(CASE WHEN content_type = 'event' THEN 1 END) as event_count,
      COUNT(CASE WHEN content_type = 'transaction' THEN 1 END) as transaction_count,
      COUNT(CASE WHEN to_entity_id IS NOT NULL THEN 1 END) as entity_relationships,
      MAX(created_at) as last_activity
    FROM cortex_foundation.entity_relationships
    WHERE is_active = TRUE
    GROUP BY from_entity_id
  )
  SELECT 
    ae.id as entity_id,
    ae.entity_type,
    ae.name as entity_name,
    ae.primary_contact,
    COALESCE(ec.total_relationships, 0) as total_relationships,
    COALESCE(ec.task_count, 0) as task_count,
    COALESCE(ec.note_count, 0) as note_count,
    COALESCE(ec.event_count, 0) as event_count,
    COALESCE(ec.transaction_count, 0) as transaction_count,
    COALESCE(ec.entity_relationships, 0) as entity_relationships,
    ec.last_activity,
    CASE 
      WHEN ec.last_activity > NOW() - INTERVAL '7 days' THEN 'high'
      WHEN ec.last_activity > NOW() - INTERVAL '30 days' THEN 'medium'
      WHEN ec.last_activity IS NOT NULL THEN 'low'
      ELSE 'none'
    END as activity_level
  FROM cortex_intel.all_entities ae
  LEFT JOIN entity_counts ec ON ae.id = ec.entity_id
`);

// Content network view - shows how content items are interconnected
export const contentNetworkView = cortexIntelSchema.view("content_network").as(sql`
  WITH content_connections AS (
    SELECT 
      er.content_id,
      er.content_type,
      COUNT(DISTINCT er.from_entity_id) as connected_entities,
      ARRAY_AGG(DISTINCT ae.entity_type) as entity_types,
      ARRAY_AGG(DISTINCT ae.name) as entity_names,
      MAX(er.created_at) as last_connection
    FROM cortex_foundation.entity_relationships er
    JOIN cortex_intel.all_entities ae ON er.from_entity_id = ae.id
    WHERE er.content_id IS NOT NULL AND er.is_active = TRUE
    GROUP BY er.content_id, er.content_type
  )
  SELECT 
    ac.id as content_id,
    ac.content_type,
    ac.title,
    ac.description,
    ac.created_at,
    ac.updated_at,
    COALESCE(cc.connected_entities, 0) as connected_entities,
    COALESCE(cc.entity_types, ARRAY[]::text[]) as connected_entity_types,
    COALESCE(cc.entity_names, ARRAY[]::text[]) as connected_entity_names,
    cc.last_connection,
    CASE 
      WHEN cc.connected_entities >= 5 THEN 'highly_connected'
      WHEN cc.connected_entities >= 2 THEN 'connected'
      WHEN cc.connected_entities = 1 THEN 'single_connection'
      ELSE 'isolated'
    END as connectivity_level
  FROM cortex_intel.all_content ac
  LEFT JOIN content_connections cc ON ac.id::text = cc.content_id::text 
    AND ac.content_type = cc.content_type
`);

// Cross-schema analytics view - provides business intelligence metrics
export const businessIntelView = cortexIntelSchema.view("business_intel").as(sql`
  SELECT 
    'summary' as metric_type,
    'total_entities' as metric_name,
    COUNT(*)::text as metric_value,
    'Total entities across all types' as description,
    NOW() as calculated_at
  FROM cortex_intel.all_entities
  UNION ALL
  SELECT 
    'summary' as metric_type,
    'total_content' as metric_name,
    COUNT(*)::text as metric_value,
    'Total content items across all types' as description,
    NOW() as calculated_at
  FROM cortex_intel.all_content
  UNION ALL
  SELECT 
    'summary' as metric_type,
    'total_relationships' as metric_name,
    COUNT(*)::text as metric_value,
    'Total active relationships' as description,
    NOW() as calculated_at
  FROM cortex_intel.all_relationships
  UNION ALL
  SELECT 
    'entity_distribution' as metric_type,
    entity_type as metric_name,
    COUNT(*)::text as metric_value,
    'Count of ' || entity_type || ' entities' as description,
    NOW() as calculated_at
  FROM cortex_intel.all_entities
  GROUP BY entity_type
  UNION ALL
  SELECT 
    'content_distribution' as metric_type,
    content_type as metric_name,
    COUNT(*)::text as metric_value,
    'Count of ' || content_type || ' items' as description,
    NOW() as calculated_at
  FROM cortex_intel.all_content
  GROUP BY content_type
  UNION ALL
  SELECT 
    'activity_level' as metric_type,
    activity_level as metric_name,
    COUNT(*)::text as metric_value,
    'Entities with ' || activity_level || ' activity level' as description,
    NOW() as calculated_at
  FROM cortex_intel.entity_activity
  GROUP BY activity_level
`);

// Types for Intel views
export type AllEntity = {
  id: string;
  entityType: string;
  name: string;
  primaryContact: string | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: any;
};

export type AllContent = {
  id: string;
  contentType: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: any;
};

export type AllRelationship = {
  id: string;
  fromEntityId: string;
  fromEntityType: string | null;
  fromEntityName: string | null;
  toEntityId: string | null;
  toEntityType: string | null;
  toEntityName: string | null;
  contentType: string | null;
  contentId: string | null;
  contentTitle: string | null;
  relationshipType: string;
  metadata: any;
  weight: number | null;
  createdAt: Date;
  isBidirectional: boolean;
  linkType: string;
};

export type EntityActivity = {
  entityId: string;
  entityType: string;
  entityName: string;
  primaryContact: string | null;
  totalRelationships: number;
  taskCount: number;
  noteCount: number;
  eventCount: number;
  transactionCount: number;
  entityRelationships: number;
  lastActivity: Date | null;
  activityLevel: string;
};

export type ContentNetwork = {
  contentId: string;
  contentType: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  connectedEntities: number;
  connectedEntityTypes: string[];
  connectedEntityNames: string[];
  lastConnection: Date | null;
  connectivityLevel: string;
};

export type BusinessIntel = {
  metricType: string;
  metricName: string;
  metricValue: string;
  description: string;
  calculatedAt: Date;
};