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