# CRM to Cortex Migration Guide

## Overview

This guide documents the comprehensive migration from the CRM schema to the new Cortex architecture. The migration eliminates the CRM schema while preserving all data and functionality through the unified Cortex system.

## Migration Strategy

### Phase 1: Bridge Tables ✅
- Created bridge tables linking CRM data to Cortex entities
- Supports gradual migration without data loss
- Maintains referential integrity during transition

### Phase 2: Data Migration 🔄
- Automated migration scripts move data from CRM to Cortex schemas
- Preserves all relationships and metadata
- Creates audit trail for migration tracking

### Phase 3: API Adapter 🔄
- Backward-compatible API layer maintains existing endpoints
- Frontend continues working without changes
- Gradual transition to new Cortex endpoints

### Phase 4: Frontend Updates 📋
- Update frontend to use new Cortex data structures
- Remove dependencies on CRM schema
- Enhance UI with new Cortex capabilities

### Phase 5: Schema Cleanup 📋
- Remove CRM schema after complete migration
- Clean up bridge tables
- Archive migration logs

## Schema Mapping

### Core Entities
```
CRM Schema                  →  Cortex Schema
──────────────────────────     ────────────────────────────
crm.contacts               →  cortex_entities.persons (cp_)
crm.companies              →  cortex_entities.companies (cc_)
crm.groups                 →  cortex_entities.groups (cg_)
crm.objects                →  cortex_entities.objects (co_)
```

### Content & Activities
```
CRM Schema                  →  Cortex Schema
──────────────────────────     ────────────────────────────
crm.tasks                  →  cortex_projects.tasks
crm.projects               →  cortex_projects.projects (cj_)
crm.calendar_events        →  cortex_scheduling.events
crm.notes                  →  cortex_knowledge.notes
crm.documents              →  cortex_knowledge.documents
```

### Support Tables
```
CRM Schema                  →  Cortex Schema
──────────────────────────     ────────────────────────────
crm.contact_phones         →  cortex_entities.person_phones
crm.contact_emails         →  cortex_entities.person_emails
crm.contact_addresses      →  cortex_entities.person_addresses
crm.task_message_links     →  cortex_communication.message_tasks
crm.entity_relationships   →  cortex_foundation.entity_relationships
```

## API Endpoints Migration

### Contacts
```
Old: GET /api/crm/contacts
New: GET /api/cortex/contacts

Old: POST /api/crm/contacts
New: POST /api/cortex/contacts

Old: GET /api/crm/contacts/:id
New: GET /api/cortex/contacts/:id
```

### Tasks
```
Old: GET /api/crm/tasks
New: GET /api/cortex/tasks

Old: POST /api/crm/tasks
New: POST /api/cortex/tasks
```

### Projects
```
Old: GET /api/crm/projects
New: GET /api/cortex/projects

Old: POST /api/crm/projects
New: POST /api/cortex/projects
```

## Data Preservation

### What's Preserved
- ✅ All contact information (phones, emails, addresses)
- ✅ WhatsApp integration data
- ✅ Task and project relationships
- ✅ Calendar events and scheduling
- ✅ Notes and document attachments
- ✅ Entity relationships and tags
- ✅ Activity history and timestamps

### Enhanced Capabilities
- 🚀 Unified entity ID system (cp_, cc_, cg_, co_ prefixes)
- 🚀 Enhanced relationship management
- 🚀 Advanced automation and workflow capabilities
- 🚀 Business intelligence and analytics
- 🚀 Multi-channel communication support
- 🚀 Google Drive integration
- 🚀 Advanced scheduling and reminders

## WhatsApp Integration

### Unchanged Components
- WhatsApp schema remains completely unchanged
- All message, chat, and contact data preserved
- Webhook processing continues normally
- Media processing unaffected

### Enhanced Integration
- Better contact linking through unified entity system
- Advanced automation triggers for WhatsApp events
- Improved task creation from messages
- Enhanced group management capabilities

## Migration Timeline

### Immediate (Phase 1-2) ✅
- Bridge tables created
- Migration scripts ready
- API adapter implemented

### Next Steps (Phase 3-4)
1. Run data migration scripts
2. Test Cortex API endpoints
3. Update frontend components gradually
4. Validate data integrity

### Final Steps (Phase 5)
1. Remove CRM schema dependencies
2. Clean up bridge tables
3. Update documentation
4. Archive migration logs

## Frontend Updates Required

### Contact Management
- Update contact forms to use new Cortex data structures
- Enhance contact detail views with unified entity capabilities
- Integrate new relationship management features

### Task Management
- Migrate task components to use Cortex projects schema
- Enhanced project linking and hierarchy
- Better WhatsApp message integration

### Event Management
- Update calendar integration to use Cortex scheduling
- Advanced reminder and notification capabilities
- Better timezone and recurrence support

## Benefits of Migration

### Technical Benefits
- **Unified Architecture**: Single source of truth for all entities
- **Better Performance**: Optimized queries and indexing
- **Enhanced Security**: Improved RLS and access control
- **Scalability**: Better support for large datasets

### Functional Benefits
- **Advanced Automation**: Cortex automation and workflow engine
- **Business Intelligence**: Built-in analytics and insights
- **Better Integration**: Enhanced Google Drive and calendar support
- **Improved UX**: More intuitive and powerful user interface

### Maintenance Benefits
- **Simplified Schema**: Reduced complexity and redundancy
- **Better Documentation**: Comprehensive schema documentation
- **Easier Testing**: Improved testing capabilities
- **Future-Proof**: Architecture ready for future enhancements

## Rollback Plan

### Emergency Rollback
1. Disable Cortex API routes
2. Re-enable CRM API routes
3. Bridge tables preserve original data
4. No data loss during rollback

### Validation Checks
- Data integrity verification scripts
- API response comparison tools
- Frontend functionality testing
- Performance monitoring

## Support

### Documentation
- API reference documentation
- Schema documentation
- Migration scripts documentation
- Troubleshooting guides

### Monitoring
- Migration progress tracking
- Error logging and alerts
- Performance monitoring
- Data integrity checks

## Conclusion

The CRM to Cortex migration represents a significant architectural improvement that:
- Preserves all existing functionality
- Enhances capabilities with new features
- Improves performance and scalability
- Provides a foundation for future growth

The migration is designed to be safe, reversible, and transparent to end users while providing substantial technical and functional benefits.