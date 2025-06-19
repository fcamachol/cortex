# Public Schema to Schema-Organized Migration Plan

## Overview
This document outlines the complete migration strategy to move all data from the public schema to properly organized schemas (app, whatsapp, crm, actions).

## Current Database Structure Analysis

### Public Schema Tables (To Be Migrated)
- `app_users` → `app.users`
- `whatsapp_instances` → `whatsapp.instances`
- `whatsapp_contacts` → `whatsapp.contacts`
- `whatsapp_conversations` → `whatsapp.chats`
- `whatsapp_messages` → `whatsapp.messages`
- `tasks` → `crm.tasks`
- `spaces` → `app.spaces`

### Target Schema Structure
```
app/
├── users
├── user_preferences
├── workspaces
└── spaces

whatsapp/
├── instances
├── contacts
├── chats
├── messages
├── groups
└── group_participants

crm/
└── tasks

actions/
├── action_rules
├── action_executions
└── action_templates
```

## Migration Phases

### Phase 1: App Schema Migration
**Files:** `migrate-to-schemas.sql` (Phase 1)

1. **app_users → app.users**
   - Map `id` → `user_id`
   - Map `display_name` → `full_name`
   - Handle password hashing if needed
   - Create default user preferences

2. **Create default workspaces**
   - Generate workspace for each user
   - Set up default workspace structure

### Phase 2: WhatsApp Schema Migration
**Files:** `migrate-to-schemas.sql` (Phase 2-5)

1. **whatsapp_instances → whatsapp.instances**
   - Map `instance_name` → `instance_id`
   - Map `user_id` → `client_id`
   - Convert status to boolean `is_connected`

2. **whatsapp_contacts → whatsapp.contacts**
   - Map `remote_jid` → `jid`
   - Join with instances to get `instance_name`
   - Handle duplicate contacts

3. **whatsapp_conversations → whatsapp.chats**
   - Map `remote_jid` → `chat_id`
   - Convert chat_type enum
   - Handle timestamp conversions

4. **whatsapp_messages → whatsapp.messages**
   - Map `evolution_message_id` → `message_id`
   - Convert message_type enum
   - Handle timestamp conversions (divide by 1000)

### Phase 3: CRM Schema Migration
**Files:** `migrate-to-schemas.sql` (Phase 6)

1. **tasks → crm.tasks**
   - Convert status and priority enums
   - Link to user's default workspace
   - Preserve all metadata and relationships

### Phase 4: Application Code Updates

#### Database Connection Update
```typescript
// server/db.ts - Updated to use schema-migration
import * as schema from "../shared/schema-migration";
```

#### Storage Layer Update
```typescript
// Use server/storage-schema.ts instead of server/storage.ts
import { schemaStorage } from "./storage-schema";
```

#### Routes Update
```typescript
// server/routes.ts - Update imports
import {
  insertUserSchema,
  insertWhatsappInstanceSchema,
  // ... other schemas
} from "../shared/schema-migration";
```

## Execution Steps

### Step 1: Prepare Schema Files
- ✅ `shared/schema-migration.ts` - Complete schema definitions
- ✅ `server/storage-schema.ts` - Schema-aware storage layer
- ✅ `migrate-to-schemas.sql` - Migration SQL script

### Step 2: Run Migration (DO NOT EXECUTE YET)
```sql
-- Execute phases sequentially with validation
psql $DATABASE_URL -f migrate-to-schemas.sql
```

### Step 3: Update Application Code
1. Update `server/db.ts` to import `schema-migration`
2. Update `server/routes.ts` to use new storage layer
3. Update any other files importing from old schema
4. Test application functionality

### Step 4: Validation
```sql
-- Run validation queries from migration script
-- Verify data counts match between old and new tables
-- Test application functionality thoroughly
```

### Step 5: Cleanup (ONLY AFTER FULL VALIDATION)
```sql
-- Drop public schema tables
DROP TABLE IF EXISTS public.app_users CASCADE;
DROP TABLE IF EXISTS public.whatsapp_instances CASCADE;
-- ... other tables
```

## Key Migration Considerations

### Data Mapping Challenges
1. **Enum Conversions**: Ensure proper enum type casting
2. **Timestamp Formats**: Convert millisecond timestamps to PostgreSQL format
3. **Foreign Keys**: Maintain referential integrity across schemas
4. **Null Handling**: Preserve null values appropriately

### Application Impact
1. **Zero Downtime**: Migration can be done with application running
2. **Gradual Rollout**: Update application code after data migration
3. **Rollback Plan**: Keep public tables until full validation

### Testing Strategy
1. **Data Validation**: Compare row counts and sample data
2. **Functional Testing**: Verify all application features work
3. **Performance Testing**: Ensure query performance is maintained
4. **Integration Testing**: Test WhatsApp API integration

## Files Created for Migration

1. **`shared/schema-migration.ts`** - Complete schema with proper organization
2. **`server/storage-schema.ts`** - Storage layer for schema-organized tables
3. **`migrate-to-schemas.sql`** - SQL migration script with validation
4. **`migration-plan.sql`** - Detailed migration documentation

## Next Steps

1. Review migration files thoroughly
2. Test migration on development copy of database
3. Update application code to use new schema structure
4. Execute migration on production (when ready)
5. Validate all functionality
6. Remove public schema tables after validation

## Risk Mitigation

- Full database backup before migration
- Gradual phase execution with validation
- Keep old tables until complete validation
- Rollback plan documented
- Application can continue using old structure during migration