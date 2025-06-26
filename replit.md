# WhatsApp CRM Integration Platform

## Overview

This is a comprehensive WhatsApp CRM integration platform built with Node.js, Express, React, and PostgreSQL. The system provides real-time WhatsApp messaging capabilities, contact management, task automation, and workflow orchestration through Evolution API integration.

The application features a modern React frontend with server-sent events (SSE) for real-time updates, a robust Express backend with webhook processing, and a well-structured PostgreSQL database with proper schema organization and Row Level Security (RLS).

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite for development and production builds
- **UI Components**: Radix UI components with Tailwind CSS styling
- **State Management**: TanStack React Query for server state management
- **Real-time Updates**: Server-Sent Events (SSE) for live conversation updates
- **Drag & Drop**: Hello Pangea DnD for interactive UI elements

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Integration**: Evolution API for WhatsApp functionality
- **Webhook Processing**: Comprehensive webhook handlers for all WhatsApp events
- **Real-time Communication**: WebSocket and SSE implementations
- **Media Processing**: Multi-method media download with local caching

### Database Architecture
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Organization**: 
  - `app` schema: User management, workspaces, preferences
  - `whatsapp` schema: Instances, contacts, messages, chats, groups
  - `crm` schema: Tasks and workflow management
  - `actions` schema: Automation rules and templates
- **Security**: Row Level Security (RLS) for data isolation
- **Migration Strategy**: Planned migration from public schema to organized schemas

## Key Components

### WhatsApp Integration
- **Evolution API Client**: Robust API client with multiple endpoint fallback strategies
- **Webhook Processing**: Handles all WhatsApp events (messages, contacts, groups, chats)
- **Media Management**: Multi-method media download system with local caching
- **Real-time Synchronization**: Live updates for conversations and messages

### Contact & Conversation Management
- **Dynamic Contact Creation**: Automatic contact creation from incoming messages
- **Group Management**: Comprehensive group metadata synchronization
- **Conversation Threading**: Proper chat organization with unread counts
- **Phone Number Formatting**: International phone number standardization

### Task Automation
- **Template Processing**: Dynamic message template interpolation
- **Action Rules**: Automated task creation based on message patterns
- **Workflow Orchestration**: Integration between WhatsApp events and CRM actions

### Media Processing Architecture
The system implements a sophisticated media processing pipeline:
1. **Webhook Notification**: Receives media message notifications (without base64 data)
2. **Evolution API Download**: Makes proper API calls to download media content
3. **Local Caching**: Stores media files locally with proper file organization
4. **Database Updates**: Updates message records with local file paths
5. **Fallback Strategies**: Multiple download methods for reliability

## Data Flow

### Message Processing Flow
1. WhatsApp → Evolution API → Webhook → Express Server
2. Message validation and parsing
3. Contact/Chat auto-creation if needed
4. Media download and caching (if applicable)
5. Database storage with proper relationships
6. SSE broadcast for real-time UI updates

### Contact Synchronization Flow
1. Evolution API contact webhooks
2. Phone number normalization and validation
3. Database upsert with conflict resolution
4. Group participant management
5. Real-time contact list updates

### Real-time Update Flow
1. Database changes trigger SSE events
2. Frontend establishes SSE connections
3. Live updates for conversations, messages, and contacts
4. Optimized polling strategies to reduce server load

## External Dependencies

### Core Dependencies
- **Evolution API**: WhatsApp Business API integration
- **PostgreSQL**: Primary database with Neon serverless hosting
- **Drizzle ORM**: Type-safe database operations
- **TanStack Query**: Client-side data fetching and caching

### Authentication & Security
- **bcryptjs**: Password hashing and security
- **jsonwebtoken**: JWT token management
- **Row Level Security**: Database-level access control

### Media & Communication
- **mime-types**: Media type detection and handling
- **WebSocket**: Real-time communication protocols
- **Server-Sent Events**: Live update broadcasting

### Development Tools
- **TypeScript**: Type safety across the entire stack
- **ESBuild**: Fast production builds
- **Drizzle Kit**: Database schema management and migrations

## Deployment Strategy

### Environment Configuration
- **Development**: Local development with hot reloading via Vite
- **Production**: Optimized builds with ESBuild bundling
- **Database**: Neon PostgreSQL with connection pooling

### Scaling Considerations
- **Media Storage**: Local file system with planned cloud storage migration
- **Database Connections**: Connection pooling for high concurrency
- **Real-time Updates**: Efficient SSE connection management
- **Webhook Processing**: Asynchronous processing for high-volume webhooks

### Monitoring & Performance
- **Draft Polling**: Optimized from 5-second to 30-second intervals
- **Query Caching**: 25-second stale time for improved performance
- **Media Caching**: Local storage to reduce API calls
- **Error Handling**: Comprehensive error logging and recovery

## Changelog
- June 26, 2025: Successfully renamed api_key column to instance_id in whatsapp.instances table to improve naming consistency - updated database schema and storage methods, fixed critical Drizzle ORM errors in chat messages functionality by replacing complex join queries with optimized raw SQL, verified system operational with working message retrieval and real-time updates
- June 26, 2025: Successfully merged duplicate instance columns in WhatsApp database schema - consolidated instance_id and instance_name fields into single instance_name column across all WhatsApp tables (instances, contacts, chats, messages, groups, etc.) to match Evolution API data format, updated all Drizzle ORM queries and storage methods to use new field structure, maintained data integrity during migration with zero data loss, system now uses consistent instanceName field throughout application matching Evolution API specifications
- June 26, 2025: Successfully implemented WhatsApp-CRM contact linking system that automatically connects CRM contacts to WhatsApp contacts based on phone number matching - added WhatsApp JID fields to CRM contacts table (whatsapp_jid, whatsapp_instance_id, is_whatsapp_linked, whatsapp_linked_at), created automatic phone number normalization and JID matching logic, implemented bidirectional linking where adding phone numbers to CRM contacts triggers WhatsApp contact detection, added API endpoints for manual linking and status checking, system now provides unified contact experience like WhatsApp does with phone contacts, verified working with test contact showing successful linking between +5215585333840 and 5215585333840@s.whatsapp.net
- June 26, 2025: Successfully implemented comprehensive Payables/Receivables separation in finance schema - enhanced financial tracking with separate tables for money owed (payables) vs money you're owed (receivables), added receivable_status enum with proper workflow states (draft, sent, partially_paid, paid, overdue), created complete CRUD operations with storage methods and API endpoints, established proper junction tables for payment tracking, following accounting best practices for clear financial distinction and improved reporting capabilities
- June 26, 2025: Fixed spaces categorization system - resolved missing category field in Drizzle ORM schema definition for appSpaces table, added category, level, and path fields to support proper hierarchical organization and categorization, spaces now correctly display under "work" and "personal" categories based on database values rather than defaulting to "work" for all spaces
- June 25, 2025: Implemented comprehensive webhook reliability system for uninterrupted production event capture - created WebhookReliabilityManager with file-based persistence, automatic retry logic with exponential backoff, health monitoring every 30 seconds, stuck queue detection and recovery, integrated into webhook controller with immediate event capture before processing, added production monitoring endpoints (/api/webhook-health, /api/webhook-cleanup, /api/webhook-force-retry), ensured zero data loss during database outages, server restarts, or Evolution API downtime with automatic restoration of pending events on startup
- June 25, 2025: Successfully completed calendar automation system with CRM schema integration - added missing crmCalendarEvents table definition to shared schema, fixed storage imports to include CRM calendar events table, created API endpoint for CRM calendar events CRUD operations, verified calendar reaction functionality working correctly with events being created in crm.calendar_events table as designed, confirmed complete 📅 reaction-to-calendar workflow from WhatsApp messages to database storage
- June 25, 2025: Fixed production deployment issues and conversation list updates - resolved critical database schema errors causing server crashes, corrected conversation API query from INNER JOIN to LEFT JOIN LATERAL for proper message retrieval, eliminated TypeScript errors preventing startup, verified real-time message persistence and SSE notifications working correctly, deployed stable version with immediate conversation list updates for sent messages
- June 25, 2025: Fixed real-time conversation updates for sent messages - resolved issue where new conversations and replies weren't appearing immediately by implementing proper SSE notifications for chat updates, added conversation refresh triggers to message sending flow with fallback for storage failures, ensuring users see their messages and new conversations instantly in the interface
- June 25, 2025: Successfully completed clean layered architecture refactoring - eliminated redundant ActionsEngine layer, implemented ActionService as single "brain" for all automation logic, removed circular imports and delegation overhead, established clean data flow (Webhook → Adapter → ActionService → Storage), fixed application startup issues, implemented development authentication bypass for testing, validated financial automation system working with direct action execution following intended architectural patterns, deleted obsolete files (actions-engine.ts, routes-broken.ts) and fixed action execution logging with proper schema imports
- June 25, 2025: Successfully implemented and verified financial records automation system - completed create_financial_record action type with bills (payables) creation in finance.payables table, automatic payment task generation in crm.tasks with linked_payable_id foreign key relationship, fixed schema constraints and database mappings, integrated keyword processing pipeline in ActionService, and validated complete workflow from WhatsApp message triggers to synchronized bill/task creation with real-time notifications
- June 25, 2025: Successfully implemented complete 📅 reaction-to-calendar system - fixed missing messages.reaction handler in webhook adapter, added handleDirectReaction method for processing direct reaction events, resolved database column mapping issues in CRM calendar events storage, and verified end-to-end functionality with reaction triggers creating events in crm.calendar_events table as designed
- June 25, 2025: Confirmed CRM calendar events architecture is properly implemented - crm.calendar_events table serves as source of truth for internal app events, separate from calendar.events sync layer, following best practice separation between internal CRM functionality and external calendar integration
- June 25, 2025: Fixed app crashes and contact editing errors - resolved infinite re-render loops in ChatInterface component by stabilizing useEffect dependencies, implemented missing getMessageReplies method in storage class to fix contact editing functionality, and ensured stable SSE connections for real-time updates without performance issues
- June 25, 2025: Fixed 📝 reaction trigger system with standalone CRM notes architecture - made space_id nullable in crm.notes table, removed fallback space assignment logic, implemented proper title generation with chat ID and date format for untitled notes, and ensured notes are truly standalone entities that can be optionally linked to contacts, spaces, tasks, events, companies, or groups without mandatory relationships
- June 25, 2025: Optimized media processing to eliminate on-demand downloads - removed Evolution API downloads from media endpoint to only serve cached files processed during webhook events, preventing unnecessary API calls when users browse conversations
- June 24, 2025: Enhanced actions system with comprehensive automation types - expanded action types to include project creation, note creation, file storage, document creation, space management, financial records, meeting scheduling, invoice creation, and task priority updates, providing comprehensive automation capabilities for WhatsApp message triggers
- June 24, 2025: Successfully implemented comprehensive CRM projects table with space assignment functionality - added crmProjects table to schema with full CRUD operations, storage methods, API endpoints, and space assignment for both projects and tasks, enabling proper hierarchical organization within spaces
- June 24, 2025: Updated space navigation - space cards in all views (grid, list, hierarchy) now navigate directly to space detail view instead of opening modals, providing seamless hierarchical navigation experience
- June 24, 2025: Cleaned up sidebar interface - removed "Expand All" and "Collapse All" buttons for cleaner navigation experience
- June 24, 2025: Updated sidebar navigation - changed "Teamspaces" to "Spaces" with clickable header that navigates to all spaces view, maintained + button functionality for creating new spaces
- June 24, 2025: Successfully implemented unlimited depth hierarchical space navigation - fixed recursive space flattening to find nested child spaces at any level, implemented multi-level routing patterns supporting up to 5 levels deep (/spaces/1/5/6/7/8), enhanced breadcrumb system with dynamic path building, and completed three-level routing with proper space detail views and tabbed interface
- June 24, 2025: Completed functional hierarchical space navigation system - fixed data type errors in SpaceDetailView component, corrected sidebar navigation URL format from query parameters to path parameters (/spaces/1), resolved allSpaces and spaceItems array formatting issues, and fully implemented three-level routing (/spaces → /spaces/1 → /spaces/1/subspace) with working space detail views featuring tabbed interface and unlimited nesting depth
- June 24, 2025: Fixed JSX syntax errors and completed hierarchical space navigation system - rebuilt SpaceDetailView component with proper JSX structure, three-level routing (/spaces → /spaces/1 → /spaces/1/subspace), sidebar navigation with hierarchical URL construction, full-screen space detail views with comprehensive tabbed interface (Overview, Subspaces, Projects, Tasks, Files, Events), breadcrumb navigation with clickable parent space links, and unlimited nesting depth support
- June 24, 2025: Implemented complete hierarchical space navigation system supporting three-level routing: `/spaces` (all spaces), `/spaces/1` (specific space), `/spaces/1/subspace` (specific subspace) - enabling unlimited nesting depth with proper breadcrumb navigation and parent-child relationships
- June 24, 2025: Created comprehensive SpaceDetailView component with full-screen space management interface featuring tabbed navigation (Overview, Subspaces, Projects, Tasks, Files, Events), inline title/description editing, multiple view modes (grid/list), search functionality, and complete CRUD operations matching ClickUp/Notion-style design patterns
- June 24, 2025: Enhanced drag and drop logic to support full folder-like behavior - spaces can now be dropped onto other spaces as containers, maintaining proper hierarchical relationships with visual feedback during drag operations
- June 24, 2025: Created ultra-compact hierarchical spaces design - removed visual bracket lines, reduced tab spacing from 12px to 6px per level, eliminated unnecessary borders and margins for cleaner nested subspace appearance
- June 24, 2025: Removed redundant category labels from spaces sidebar - cleaned up interface by removing "(work)" and other category badges from individual space items, keeping only the main category headers for better visual hierarchy
- June 24, 2025: Implemented category inheritance system where subspaces automatically inherit parent space categories - ensures consistent categorization throughout unlimited nesting levels like Test Space > Personal > Health & Fitness all sharing "personal" category
- June 24, 2025: Fixed hierarchical spaces chevron detection with recursive space lookup - now properly detects child spaces at all nesting levels and displays chevron arrows for expandable subspaces, supporting unlimited depth like Test Space > Personal > Health & Fitness with full recursive navigation functionality
- June 24, 2025: Successfully implemented enhanced hierarchical spaces system with unlimited nesting levels, categories (personal, work, etc.), and comprehensive space items (projects, tasks, notes, documents, events, finance) - now supports complex structures like Work > Company A > Marketing > Q3 Marketing Plan with full CRUD operations and hierarchical path tracking
- June 24, 2025: Implemented comprehensive Notion/ClickUp-style spaces functionality - enhanced database schema with hierarchical spaces, templates, views, privacy settings, cover images, favorites, and complete CRUD operations with three view modes (grid, list, hierarchy)
- June 24, 2025: Fixed project creation functionality in TasksPage - added missing handleProjectCreate function and updated ProjectForm component to properly handle dialog state and form submission
- June 24, 2025: Enhanced mobile chat interface to match WhatsApp-style design from web app - implemented proper avatars, timestamps, message previews with "You:" prefix for sent messages, smart relative time display, and authentic conversation data display
- June 24, 2025: Fixed mobile app scrolling issue by removing overflow:hidden from body and adding proper overflow-y:auto with touch scrolling support for iOS devices
- June 24, 2025: Fixed contact editing bug - now opens proper edit mode instead of create new contact modal, uses ContactDetailView with ContactFormBlocks in edit mode
- June 24, 2025: Implemented collapsible sidebar with icon-only mode - added toggle button in header, smooth transition animations, collapsed state with tooltips, and proper badge indicators for icon mode to improve space utilization
- June 24, 2025: Updated Expo React Native setup guide to use WhatsApp-style bottom tab navigation - replaced material top tabs with bottom tabs featuring proper icons, badge indicators for unread counts, and improved mobile UX following user preference
- June 24, 2025: Updated ContactModal to match platform's clean modern UX/UI style - removed dashed borders, implemented clean gray sections with proper hover states, updated activity tabs with icons and green accent color matching the contacts page design
- June 24, 2025: Successfully implemented "Link to Another Contact" functionality - added LinkBlock component with contact selection dropdown, relationship type selection, and modal interface for creating contact-to-contact relationships within the CRM system
- June 24, 2025: Added ContactModal with collapsible sections and Activity module with Tasks, Events, Finance, and Notes & Docs tabs - provides comprehensive contact view with organized information blocks
- June 24, 2025: Updated company blocks to use dropdown with existing companies and modal for creating new ones - companies are now properly linked entities instead of free text input
- June 24, 2025: Restructured contact form to use collapsible section-based organization - Contact Info, Relationships & Groups, and Personal Details sections with sub-block capabilities, Notes as standalone blocks with dedicated Add Note button
- June 24, 2025: Organized contact information blocks into three logical categories (Contact Info, Relationships & Groups, Personal Details) following consistent order across all contacts - improved Add Information Block menu with proper section groupings
- June 24, 2025: Minimized white space in contact form by removing max-width container and using full width with px-6 padding - added header with person icon matching company form style exactly
- June 24, 2025: Further reduced white space in contact form by increasing max width to max-w-5xl and reducing horizontal padding to px-4 for better space utilization
- June 24, 2025: Updated contact form to use fill box style for name input matching company form design - eliminated header section, avatar and actions now only appear in preview mode after form completion
- June 24, 2025: Optimized contact form layout to use available space efficiently - increased container width from max-w-2xl to max-w-4xl for better space utilization while maintaining professional appearance
- June 24, 2025: Converted header action buttons to proper outlined buttons with larger text and consistent styling matching platform's UX/UI patterns - removed bracketed text format for professional button appearance
- June 24, 2025: Updated contact form header to match platform's exact design - larger avatar with proper styling, improved typography hierarchy, and consistent spacing matching the user's screenshots
- June 24, 2025: Updated ContactFormBlocks to match platform's actual UX/UI design patterns - improved styling with proper spacing, typography, and visual hierarchy matching the rest of the application interface
- June 24, 2025: Implemented view mode display with grouped blocks showing contact information in bordered sections (Contact Info, Relationships & Groups, Personal Details) - added notes section matching user's screenshot design with proper card layout and metadata display
- June 24, 2025: Completely redesigned contact form to use Notion-style block system - replaced collapsible sections with dynamic information blocks that can be added through a central "Add Information Block" menu with phone, email, address, company, and note blocks
- June 24, 2025: Updated address display to match unified design pattern with label-based format like phones and emails - shows custom name or type with primary designation and condensed address format
- June 24, 2025: Enhanced Contact Information section to support multiple phones, emails, and addresses with dynamic add/remove functionality - users can now add unlimited contact methods with type classification and primary designation
- June 24, 2025: Redesigned contact form with collapsible sections approach - moved phone/email to collapsible "Contact Information" section, added expandable Professional, Personal, and Notes sections with plus sign indicators for intuitive form expansion
- June 24, 2025: Updated contact form to use independent primary phone and primary email fields that are both optional, replacing combined primary contact field per user specification  
- June 24, 2025: Successfully implemented comprehensive 360-degree CRM contacts module with network intelligence capabilities - transformed from basic contact groups to full-featured CRM with 11 specialized tables supporting phones, emails, addresses, aliases, special dates, interests, company memberships, relationships, and intelligent search functionality
- June 24, 2025: Created complete contacts interface with ContactsPage, ContactForm, ContactDetailView, and ContactGroupsManager components - providing intuitive contact creation, editing, and organization with tabbed interface and comprehensive data capture
- June 24, 2025: Added comprehensive CRM storage methods and API routes supporting all contact operations including full contact details retrieval, search functionality, upcoming special dates intelligence, and relationship management
- June 23, 2025: Successfully completed comprehensive contact groups feature for flexible contact organization - added CRM schema tables, storage methods, and complete API endpoints for custom contact collections
- June 23, 2025: Enhanced loan form with complete redesign matching user specifications - added interest type (simple/compound), moratory interests module, and improved field layout
- June 23, 2025: Implemented comprehensive polymorphic lender/borrower relationships - both lenders and borrowers can be contacts or companies with dual search interfaces
- June 23, 2025: Added loan form fields: start_date, payment_frequency, purpose, collateral, interest_type with proper database schema updates
- June 23, 2025: Created EnhancedLoanForm component with visual contact/company differentiation and streamlined user experience matching design mockup
- June 23, 2025: Successfully implemented polymorphic creditor relationship for loans - lenders can now be either contacts or companies
- June 23, 2025: Created comprehensive PolymorphicLoanForm with universal search supporting both contact and company selection as creditors
- June 23, 2025: Added CRM companies table with full CRUD operations including business type, tax ID, and contact information
- June 23, 2025: Enhanced loan schema with creditor_id and creditor_type fields for flexible lender relationships
- June 23, 2025: Built intuitive creditor selection UI with icons differentiating between companies (Building2) and contacts (User)
- June 23, 2025: Integrated companies API endpoints with proper space isolation and error handling
- June 23, 2025: Successfully implemented comprehensive bill-to-task automatic creation system with penalty balance calculations
- June 23, 2025: Created BillToTaskService for automatic companion task generation when bills are created - bills generate tasks, not assigned to existing ones
- June 23, 2025: Added penalty_balance, amount_paid, moratory_rate fields to finance.payables table for transparent late fee tracking
- June 23, 2025: Implemented linked_payable_id field in crm.tasks table to establish one-to-one bill-to-task relationship
- June 23, 2025: Built comprehensive payment application system with penalty priority - penalties paid first, then principal amount
- June 23, 2025: Created ScheduledJobsService with node-cron for daily moratory interest calculations on overdue bills at 1:00 AM
- June 23, 2025: Added payment processing endpoints for bill payments with automatic task status updates and penalty balance management
- June 23, 2025: Established complete audit trail system - original bill amounts remain fixed, penalties tracked separately for transparency
- June 23, 2025: Integrated automatic task completion when bills are fully paid, with real-time task title updates reflecting payment status
- June 23, 2025: Fixed all SelectItem component errors across finance forms by adding proper value props and TypeScript array handling
- June 23, 2025: Removed Database and Groups modules from sidebar navigation to streamline interface
- June 23, 2025: Moved Spaces section to top of sidebar navigation to emphasize spaces as core foundation of the app
- June 23, 2025: Completed transaction-account linking functionality with account dropdown in transaction form and account column in transaction list
- June 23, 2025: Fixed spaces creation functionality by correcting apiRequest parameter order and implementing missing createSpace storage method
- June 23, 2025: Successfully completed comprehensive finance accounts module with full CRUD functionality and database integration
- June 23, 2025: Created finance.accounts table with 11 account types (checking, savings, credit card, investment, loan, mortgage, business, cash, crypto, retirement, other)
- June 23, 2025: Built AccountForm component with comprehensive validation, multi-currency support, and contact linking capabilities
- June 23, 2025: Implemented AccountList component with overview dashboard, account management, and real-time balance tracking
- June 23, 2025: Added complete accounts API endpoints (GET, POST, PUT, DELETE) with proper error handling and spaceId filtering
- June 23, 2025: Integrated accounts module into FinancePage with dedicated tab and seamless user experience
- June 23, 2025: Added comprehensive date filter to Finance module with 11 time period options integrated into all API queries
- June 23, 2025: Made Finance module fully scrollable with fixed header and overflow-handling content area
- June 23, 2025: Successfully implemented complete finance schema with 6 tables, 4 enums, and full type safety
- June 23, 2025: Created finance.categories (hierarchical), finance.transactions (ledger), finance.payables (bills), finance.recurring_bills (templates), finance.loans (credit instruments), and junction tables for payments
- June 23, 2025: Added comprehensive finance schema relations, insert schemas, and TypeScript types for full integration
- June 23, 2025: Reverted problematic app schema changes that caused authentication errors and restored system stability
- June 23, 2025: Fixed TaskForm creation error by implementing field name transformation and null safety for projects API endpoint  
- June 23, 2025: Resolved TaskDetailModal "Invalid time value" error by updating all snake_case field references to camelCase format
- June 23, 2025: Fixed TaskBoard rendering by implementing server-side field name transformation from snake_case to camelCase for API compatibility
- June 23, 2025: Resolved missing tasks issue - all 70 tasks now properly distributed (66 To Do, 3 In Progress, 1 Done) with "Contrato Sindicato DH" visible
- June 23, 2025: Fixed TaskBoard filtering logic to properly display all tasks across status columns
- June 23, 2025: Fixed critical task display issue by resolving field name mismatches between API response and component interfaces  
- June 23, 2025: Updated default task status from "pending" to "to_do" across all task creation points (server routes and forms)
- June 23, 2025: Stabilized ChatInterface SSE connections by fixing useCallback dependencies to prevent infinite re-renders
- June 23, 2025: Implemented real-time waiting response detection - "esperando respuesta" now triggers directly from chat interface with instant blue indicator in conversation list
- June 23, 2025: Consolidated data fetching architecture - eliminated duplicate API calls by having Dashboard fetch once and pass data as props to components
- June 23, 2025: Made ChatInterface the central SSE hub for all real-time updates, automatic conversation list refresh via SSE events
- June 23, 2025: Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.
Contact form requirements: Contact methods should be independent - primary phone and primary email fields that are both optional, separate from the main contact info.