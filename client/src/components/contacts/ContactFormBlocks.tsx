import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Phone, Mail, MapPin, Building2, Users, Link as LinkIcon, Calendar, Tag, MessageSquare, Plus, MoreHorizontal, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// Block types available in the system
const BLOCK_TYPES = [
  { id: 'phone', label: 'Phone Number', icon: Phone },
  { id: 'email', label: 'Email Address', icon: Mail },
  { id: 'address', label: 'Physical Address', icon: MapPin },
  { id: 'company', label: 'Company / Workplace', icon: Building2 },
  { id: 'group', label: 'Group Membership', icon: Users },
  { id: 'link', label: 'Link to Another Contact', icon: LinkIcon },
  { id: 'date', label: 'Special Date (Birthday, etc.)', icon: Calendar },
  { id: 'interest', label: 'Interest', icon: Tag },
  { id: 'alias', label: 'Alias / Nickname', icon: Tag },
  { id: 'note', label: 'Context Note', icon: MessageSquare },
];

interface Block {
  id: string;
  type: string;
  data: Record<string, any>;
}

interface ContactFormBlocksProps {
  onSuccess?: () => void;
  ownerUserId: string;
  spaceId?: number;
}

export function ContactFormBlocks({ onSuccess, ownerUserId, spaceId }: ContactFormBlocksProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Core contact fields
  const [contactName, setContactName] = useState('');
  const [relationship, setRelationship] = useState('Client');
  const [profession, setProfession] = useState('');
  const [company, setCompany] = useState('');
  
  // Dynamic blocks system
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const createContactMutation = useMutation({
    mutationFn: async () => {
      // Process blocks into contact data
      const contactData = {
        fullName: contactName,
        relationship,
        ownerUserId,
        spaceId,
      };

      // Extract and process block data
      const phoneBlocks = blocks.filter(b => b.type === 'phone');
      const emailBlocks = blocks.filter(b => b.type === 'email');
      const addressBlocks = blocks.filter(b => b.type === 'address');
      const companyBlocks = blocks.filter(b => b.type === 'company');
      const noteBlocks = blocks.filter(b => b.type === 'note');

      // Set primary contact methods
      const primaryPhone = phoneBlocks.find(b => b.data.isPrimary)?.data.number || phoneBlocks[0]?.data.number || '';
      const primaryEmail = emailBlocks.find(b => b.data.isPrimary)?.data.address || emailBlocks[0]?.data.address || '';

      // Build complete contact object
      const completeContactData = {
        ...contactData,
        primaryPhone,
        primaryEmail,
        profession: profession || companyBlocks[0]?.data.role || '',
        company: company || companyBlocks[0]?.data.name || '',
        notes: noteBlocks.map(b => b.data.content).join('\n') || '',
      };

      const response = await apiRequest('POST', '/api/crm/contacts', completeContactData);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      setContactName('');
      setRelationship('Client');
      setProfession('');
      setCompany('');
      setBlocks([]);
      toast({
        title: "Success",
        description: "Contact created successfully",
      });
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create contact",
        variant: "destructive",
      });
    },
  });

  const addBlock = (blockType: string) => {
    const newBlock: Block = {
      id: crypto.randomUUID(),
      type: blockType,
      data: getDefaultBlockData(blockType),
    };
    setBlocks([...blocks, newBlock]);
    setShowBlockMenu(false);
  };

  const updateBlock = (blockId: string, field: string, value: any) => {
    setBlocks(blocks.map(block => 
      block.id === blockId 
        ? { ...block, data: { ...block.data, [field]: value } }
        : block
    ));
  };

  const removeBlock = (blockId: string) => {
    setBlocks(blocks.filter(block => block.id !== blockId));
  };

  const getDefaultBlockData = (blockType: string): Record<string, any> => {
    switch (blockType) {
      case 'phone':
        return { number: '', type: 'Mobile', isPrimary: false, hasWhatsApp: false };
      case 'email':
        return { address: '', type: 'Personal', isPrimary: false };
      case 'address':
        return { street: '', city: '', state: '', zipCode: '', country: '', type: 'Home', isPrimary: false };
      case 'company':
        return { name: '', role: '' };
      case 'group':
        return { name: '' };
      case 'link':
        return { contactId: '', relationship: '' };
      case 'date':
        return { title: '', date: '', type: 'birthday' };
      case 'interest':
        return { name: '' };
      case 'alias':
        return { name: '' };
      case 'note':
        return { title: '', content: '' };
      default:
        return {};
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim()) {
      toast({
        title: "Error",
        description: "Contact name is required",
        variant: "destructive",
      });
      return;
    }
    createContactMutation.mutate();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <form onSubmit={onSubmit} className="space-y-6">
        {/* Header with avatar and contact info */}
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-pink-100 dark:bg-pink-900 rounded-full flex items-center justify-center text-pink-600 dark:text-pink-400 text-sm font-medium">
              (AVATAR)
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Input
                  placeholder="Dr. Ana Rodriguez"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="text-xl font-semibold border-none bg-transparent p-0 focus-visible:ring-0 text-gray-900 dark:text-gray-100 placeholder-gray-400"
                  required
                />
                <div className="flex items-center gap-2 ml-4">
                  <Button 
                    onClick={() => setIsPreviewMode(!isPreviewMode)} 
                    type="button" 
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-medium rounded-lg shadow-sm"
                  >
                    + {isPreviewMode ? 'Edit' : 'Preview'}
                  </Button>
                  <Button 
                    variant="outline" 
                    type="button" 
                    className="text-gray-600 border-gray-300 hover:bg-gray-50 hover:text-gray-700 px-4 py-2 text-sm font-medium rounded-lg bg-white"
                  >
                    Message
                  </Button>
                  <Button 
                    variant="outline" 
                    type="button" 
                    className="text-gray-600 border-gray-300 hover:bg-gray-50 hover:text-gray-700 px-3 py-2 text-sm font-medium rounded-lg bg-white"
                  >
                    ⋯
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-base">
                <Input
                  placeholder="Cardiologist (Doctor)"
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  className="text-base border-none bg-transparent p-0 focus-visible:ring-0 flex-1 placeholder-gray-400 text-gray-500"
                />
                <span className="text-base text-gray-500">at</span>
                <Input
                  placeholder="@Hospital Angeles"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="text-base border-none bg-transparent p-0 focus-visible:ring-0 flex-1 placeholder-gray-400 text-gray-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Blocks - Edit Mode vs View Mode */}
        {isPreviewMode ? (
          <ContactViewMode blocks={blocks} contactName={contactName} profession={profession} company={company} />
        ) : (
          <div className="space-y-4">
            {blocks.map((block) => (
              <BlockComponent
                key={block.id}
                block={block}
                onUpdate={updateBlock}
                onRemove={removeBlock}
              />
            ))}

            {/* Add Information Block Button */}
            <div className="flex justify-center">
              <Popover open={showBlockMenu} onOpenChange={setShowBlockMenu}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="border-dashed border-2 border-gray-300 dark:border-gray-600 py-8 px-12 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium"
                    type="button"
                  >
                    <Plus className="h-5 w-5 mr-3" />
                    Add Information Block
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="center">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Add a block:</h4>
                    <div className="border-t border-dashed my-2"></div>
                    
                    {BLOCK_TYPES.slice(0, 3).map((blockType) => (
                      <Button
                        key={blockType.id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => addBlock(blockType.id)}
                        type="button"
                      >
                        <blockType.icon className="h-4 w-4 mr-2" />
                        {blockType.label}
                      </Button>
                    ))}
                    
                    <div className="border-t border-dashed my-2"></div>
                    
                    {BLOCK_TYPES.slice(3, 6).map((blockType) => (
                      <Button
                        key={blockType.id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => addBlock(blockType.id)}
                        type="button"
                      >
                        <blockType.icon className="h-4 w-4 mr-2" />
                        {blockType.label}
                      </Button>
                    ))}
                    
                    <div className="border-t border-dashed my-2"></div>
                    
                    {BLOCK_TYPES.slice(6).map((blockType) => (
                      <Button
                        key={blockType.id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => addBlock(blockType.id)}
                        type="button"
                      >
                        <blockType.icon className="h-4 w-4 mr-2" />
                        {blockType.label}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {/* Submit Button - Only show in edit mode */}
        {!isPreviewMode && (
          <div className="flex justify-center pt-6">
            <Button 
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-sm font-medium rounded-lg shadow-sm"
              disabled={createContactMutation.isPending}
            >
              {createContactMutation.isPending ? "Creating Contact..." : "Create Contact"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}

// Individual Block Component
interface BlockComponentProps {
  block: Block;
  onUpdate: (blockId: string, field: string, value: any) => void;
  onRemove: (blockId: string) => void;
}

function BlockComponent({ block, onUpdate, onRemove }: BlockComponentProps) {
  const blockType = BLOCK_TYPES.find(t => t.id === block.type);
  if (!blockType) return null;

  const Icon = blockType.icon;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-900">
      <div className="space-y-4">
        {/* Block Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="font-medium text-base text-gray-900 dark:text-gray-100 uppercase tracking-wide">
              {blockType.label}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
              type="button"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(block.id)}
              className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
              type="button"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Block Content */}
        <BlockContent block={block} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

// Block Content based on type
function BlockContent({ block, onUpdate }: { block: Block; onUpdate: (blockId: string, field: string, value: any) => void }) {
  switch (block.type) {
    case 'phone':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Label</label>
              <Select
                value={block.data.type}
                onValueChange={(value) => onUpdate(block.id, 'type', value)}
              >
                <SelectTrigger className="h-11 border-gray-200 dark:border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mobile">Mobile</SelectItem>
                  <SelectItem value="Work">Work</SelectItem>
                  <SelectItem value="Home">Home</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Phone Number</label>
              <Input
                placeholder="+1-555-123-4567"
                value={block.data.number}
                onChange={(e) => onUpdate(block.id, 'number', e.target.value)}
                className="h-11 border-gray-200 dark:border-gray-700"
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`whatsapp-${block.id}`}
                checked={block.data.hasWhatsApp}
                onCheckedChange={(checked) => onUpdate(block.id, 'hasWhatsApp', checked)}
              />
              <label htmlFor={`whatsapp-${block.id}`} className="text-sm text-gray-600 dark:text-gray-400">
                This number has WhatsApp
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`primary-${block.id}`}
                checked={block.data.isPrimary}
                onCheckedChange={(checked) => onUpdate(block.id, 'isPrimary', checked)}
              />
              <label htmlFor={`primary-${block.id}`} className="text-sm text-gray-600 dark:text-gray-400">
                Set as primary number for this contact
              </label>
            </div>
          </div>
        </div>
      );

    case 'email':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Label</label>
              <Select
                value={block.data.type}
                onValueChange={(value) => onUpdate(block.id, 'type', value)}
              >
                <SelectTrigger className="h-11 border-gray-200 dark:border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="Work">Work</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Email Address</label>
              <Input
                placeholder="isabella@email.com"
                value={block.data.address}
                onChange={(e) => onUpdate(block.id, 'address', e.target.value)}
                className="h-11 border-gray-200 dark:border-gray-700"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`primary-email-${block.id}`}
              checked={block.data.isPrimary}
              onCheckedChange={(checked) => onUpdate(block.id, 'isPrimary', checked)}
            />
            <label htmlFor={`primary-email-${block.id}`} className="text-sm text-gray-600 dark:text-gray-400">
              Set as primary email for this contact
            </label>
          </div>
        </div>
      );

    case 'company':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Company</label>
            <Input
              placeholder="CreativeCo"
              value={block.data.name}
              onChange={(e) => onUpdate(block.id, 'name', e.target.value)}
              className="h-11 border-gray-200 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Role</label>
            <Input
              placeholder="Lead Designer"
              value={block.data.role}
              onChange={(e) => onUpdate(block.id, 'role', e.target.value)}
              className="h-11 border-gray-200 dark:border-gray-700"
            />
          </div>
        </div>
      );

    case 'note':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Note Title</label>
            <Input
              placeholder="Note title (e.g., Cuenta de banco)"
              value={block.data.title}
              onChange={(e) => onUpdate(block.id, 'title', e.target.value)}
              className="h-11 border-gray-200 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Content</label>
            <Textarea
              placeholder="Note content..."
              value={block.data.content}
              onChange={(e) => onUpdate(block.id, 'content', e.target.value)}
              className="min-h-[80px] border-gray-200 dark:border-gray-700"
            />
          </div>
        </div>
      );

    case 'group':
      return (
        <div className="text-sm text-gray-500 py-4 text-center">
          Block type "group" not yet implemented
        </div>
      );

    default:
      return (
        <div className="text-sm text-gray-500 py-4 text-center">
          Block type "{block.type}" not yet implemented
        </div>
      );
  }
}

// Contact View Mode Component
interface ContactViewModeProps {
  blocks: Block[];
  contactName: string;
  profession: string;
  company: string;
}

function ContactViewMode({ blocks, contactName, profession, company }: ContactViewModeProps) {
  const phoneBlocks = blocks.filter(b => b.type === 'phone');
  const emailBlocks = blocks.filter(b => b.type === 'email');
  const companyBlocks = blocks.filter(b => b.type === 'company');
  const relationshipBlocks = blocks.filter(b => b.type === 'link');
  const groupBlocks = blocks.filter(b => b.type === 'group');
  const dateBlocks = blocks.filter(b => b.type === 'date');
  const interestBlocks = blocks.filter(b => b.type === 'interest');
  const noteBlocks = blocks.filter(b => b.type === 'note');

  return (
    <div className="space-y-6">
      {/* Contact Info Block */}
      {(phoneBlocks.length > 0 || emailBlocks.length > 0) && (
        <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600 p-4">
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-gray-600 dark:text-gray-400">CONTACT INFO</h3>
            
            {/* Phone Numbers */}
            {phoneBlocks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">Phone Numbers</span>
                </div>
                {phoneBlocks.map((block) => (
                  <div key={block.id} className="ml-6 flex items-center gap-2">
                    <span className="text-sm">{block.data.type}{block.data.isPrimary ? ' (Primary)' : ''}:</span>
                    <span className="text-sm font-mono">{block.data.number}</span>
                    {block.data.hasWhatsApp && (
                      <span className="inline-flex items-center justify-center w-4 h-4 bg-green-100 text-green-600 rounded text-xs font-medium">
                        W
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Emails */}
            {emailBlocks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">Emails</span>
                </div>
                {emailBlocks.map((block) => (
                  <div key={block.id} className="ml-6 flex items-center gap-2">
                    <span className="text-sm">{block.data.type}:</span>
                    <span className="text-sm">{block.data.address}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Relationships & Groups Block */}
      {(relationshipBlocks.length > 0 || groupBlocks.length > 0) && (
        <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600 p-4">
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-gray-600 dark:text-gray-400">RELATIONSHIPS & GROUPS</h3>
            
            {/* Related Contacts */}
            {relationshipBlocks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">Related Contacts</span>
                </div>
                {relationshipBlocks.map((block) => (
                  <div key={block.id} className="ml-6">
                    <span className="text-sm">Spouse: [Dr. David Chen] (Link to his contact profile)</span>
                  </div>
                ))}
              </div>
            )}

            {/* Member Of */}
            {groupBlocks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Member Of</span>
                </div>
                {groupBlocks.map((block) => (
                  <div key={block.id} className="ml-6">
                    <span className="text-sm">[My Medical Team] (Link to the group page)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Personal Details Block */}
      {(dateBlocks.length > 0 || interestBlocks.length > 0) && (
        <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600 p-4">
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-gray-600 dark:text-gray-400">PERSONAL DETAILS</h3>
            
            {/* Special Dates */}
            {dateBlocks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">Special Dates</span>
                </div>
                {dateBlocks.map((block) => (
                  <div key={block.id} className="ml-6">
                    <span className="text-sm">Birthday: November 12 (Reminder: 7 days prior)</span>
                  </div>
                ))}
              </div>
            )}

            {/* Interests */}
            {interestBlocks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Interests</span>
                </div>
                <div className="ml-6">
                  <span className="text-sm">[Medical Research] [Classical Music] [Marathon Running]</span>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Notes Section - Based on user's screenshot */}
      {noteBlocks.length > 0 && (
        <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600 p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm text-gray-600 dark:text-gray-400">NOTES</h3>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-xs">
                  [+ New Note]
                </Button>
                <Button variant="ghost" size="sm" className="text-xs">
                  [ Search all notes... ]
                </Button>
                <span className="text-xs text-gray-500">🔍</span>
              </div>
            </div>
            
            <div className="space-y-3">
              {/* Dynamic Notes from blocks */}
              {noteBlocks.map((noteBlock) => (
                <Card key={noteBlock.id} className="border border-dashed border-gray-300 p-3">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">{noteBlock.data.title || 'Untitled Note'}</h4>
                    <p className="text-sm text-gray-600">{noteBlock.data.content || 'No content'}</p>
                    <div className="flex items-center justify-end text-xs text-gray-500">
                      <span>Modified: Just now</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}