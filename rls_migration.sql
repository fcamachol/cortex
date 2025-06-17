-- Enable Row Level Security on all user-related tables
-- This ensures users can only access their own data

-- Add user_id column to evolution_messages if not exists
ALTER TABLE evolution_messages ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Enable RLS on all tables
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolution_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create a function to get current user context
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
BEGIN
  -- In a real application, this would get the user ID from the session
  -- For now, we'll use a session variable that can be set by the application
  RETURN COALESCE(
    current_setting('app.current_user_id', true)::UUID,
    '00000000-0000-0000-0000-000000000000'::UUID
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- App Users: Users can only see their own record
CREATE POLICY "Users can view own record" ON app_users
  FOR SELECT USING (id = get_current_user_id());

CREATE POLICY "Users can update own record" ON app_users
  FOR UPDATE USING (id = get_current_user_id());

-- WhatsApp Instances: Users can only access their own instances
CREATE POLICY "Users can view own instances" ON whatsapp_instances
  FOR ALL USING (user_id = get_current_user_id());

-- WhatsApp Contacts: Users can only access contacts from their instances
CREATE POLICY "Users can view own contacts" ON whatsapp_contacts
  FOR ALL USING (user_id = get_current_user_id());

-- WhatsApp Conversations: Users can only access conversations from their instances
CREATE POLICY "Users can view own conversations" ON whatsapp_conversations
  FOR ALL USING (user_id = get_current_user_id());

-- WhatsApp Messages: Users can only access messages from their conversations
CREATE POLICY "Users can view own messages" ON whatsapp_messages
  FOR ALL USING (user_id = get_current_user_id());

-- Evolution Messages: Users can only access messages from their instances
CREATE POLICY "Users can view own evolution messages" ON evolution_messages
  FOR ALL USING (user_id = get_current_user_id());

-- Tasks: Users can only access their own tasks
CREATE POLICY "Users can view own tasks" ON tasks
  FOR ALL USING (user_id = get_current_user_id());

-- Contacts: Users can only access their own contacts
CREATE POLICY "Users can view own contacts_table" ON contacts
  FOR ALL USING (user_id = get_current_user_id());

-- Conversations: Users can only access their own conversations
CREATE POLICY "Users can view own conversations_table" ON conversations
  FOR ALL USING (user_id = get_current_user_id());

-- Messages: Users can only access messages from their conversations
CREATE POLICY "Users can view own messages_table" ON messages
  FOR ALL USING (user_id = get_current_user_id());

-- Create a function to set the current user context
CREATE OR REPLACE FUNCTION set_current_user_id(user_uuid UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_uuid::TEXT, true);
END;
$$ LANGUAGE plpgsql;