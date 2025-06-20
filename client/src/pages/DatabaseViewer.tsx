import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Database, MessageSquare, Users, Phone, Calendar } from 'lucide-react';

interface WhatsAppMessage {
  message_id: string;
  instance_id: string;
  chat_id: string;
  sender_jid: string;
  from_me: boolean;
  message_type: string;
  content: string;
  timestamp: string;
  created_at: string;
}

interface WhatsAppInstance {
  instance_id: string;
  display_name: string;
  owner_jid: string;
  is_connected: boolean;
  created_at: string;
}

interface WhatsAppContact {
  jid: string;
  instance_id: string;
  push_name: string;
  profile_picture_url?: string;
  is_business: boolean;
  last_updated_at: string;
}

interface WhatsAppChat {
  chat_id: string;
  instance_id: string;
  type: string;
  unread_count: number;
  last_message_timestamp: string;
}

export default function DatabaseViewer() {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (endpoint: string) => {
    try {
      const response = await fetch(`/api/database/${endpoint}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${endpoint}`);
      }
      return await response.json();
    } catch (err) {
      throw new Error(`Error fetching ${endpoint}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [messagesData, instancesData, contactsData, chatsData] = await Promise.all([
        fetchData('messages'),
        fetchData('instances'),
        fetchData('contacts'),
        fetchData('chats')
      ]);
      
      setMessages(messagesData);
      setInstances(instancesData);
      setContacts(contactsData);
      setChats(chatsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const truncateText = (text: string, maxLength: number = 50) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Database Viewer</h1>
        </div>
        <Button onClick={loadAllData} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh Data'}
        </Button>
      </div>

      {error && (
        <Alert className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="instances" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="instances" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Instances ({instances.length})
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages ({messages.length})
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Contacts ({contacts.length})
          </TabsTrigger>
          <TabsTrigger value="chats" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Chats ({chats.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="instances">
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Instances</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {instances.map((instance) => (
                  <div key={instance.instance_id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{instance.display_name}</h3>
                      <Badge variant={instance.is_connected ? "default" : "destructive"}>
                        {instance.is_connected ? "Connected" : "Disconnected"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">Instance ID: {instance.instance_id}</p>
                    <p className="text-sm text-gray-600">Owner: {instance.owner_jid}</p>
                    <p className="text-sm text-gray-600">Created: {formatDate(instance.created_at)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Recent Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20).map((message) => (
                  <div key={`${message.message_id}-${message.instance_id}`} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={message.from_me ? "default" : "secondary"}>
                          {message.from_me ? "Sent" : "Received"}
                        </Badge>
                        <Badge variant="outline">{message.message_type}</Badge>
                      </div>
                      <span className="text-xs text-gray-500">{formatDate(message.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">From: {message.sender_jid}</p>
                    <p className="text-sm text-gray-600 mb-2">Instance: {instances.find(i => i.instance_id === message.instance_id)?.display_name || message.instance_id}</p>
                    <p className="text-sm">{truncateText(message.content, 100)}</p>
                    <p className="text-xs text-gray-400 mt-2">Message ID: {message.message_id}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {contacts.map((contact) => (
                  <div key={`${contact.jid}-${contact.instance_id}`} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{contact.push_name || contact.jid}</h3>
                      {contact.is_business && <Badge variant="outline">Business</Badge>}
                    </div>
                    <p className="text-sm text-gray-600">JID: {contact.jid}</p>
                    <p className="text-sm text-gray-600">Instance: {instances.find(i => i.instance_id === contact.instance_id)?.display_name || contact.instance_id}</p>
                    <p className="text-sm text-gray-600">Last Updated: {formatDate(contact.last_updated_at)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chats">
          <Card>
            <CardHeader>
              <CardTitle>Chats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {chats.map((chat) => (
                  <div key={`${chat.chat_id}-${chat.instance_id}`} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{chat.chat_id}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{chat.type}</Badge>
                        {chat.unread_count > 0 && (
                          <Badge variant="destructive">{chat.unread_count} unread</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">Instance: {instances.find(i => i.instance_id === chat.instance_id)?.display_name || chat.instance_id}</p>
                    <p className="text-sm text-gray-600">Last Message: {formatDate(chat.last_message_timestamp)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}