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
  
  // Dynamic blocks system
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [showBlockMenu, setShowBlockMenu] = useState(false);

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
        profession: companyBlocks[0]?.data.role || '',
        company: companyBlocks[0]?.data.name || '',
        notes: noteBlocks.map(b => b.data.content).join('\n') || '',
      };

      const response = await apiRequest('POST', '/api/crm/contacts', completeContactData);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      setContactName('');
      setRelationship('Client');
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
        {/* Header with avatar placeholder and name */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400">
              (AVATAR)
            </div>
            <Input
              placeholder="Contact Name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="text-lg font-medium border-none bg-transparent p-0 focus-visible:ring-0"
              required
            />
          </div>
          
          <div className="border-t border-dashed border-gray-300 dark:border-gray-600"></div>
        </div>

        {/* Dynamic Blocks */}
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
                  className="border-dashed border-2 py-6 px-8"
                  type="button"
                >
                  <Plus className="h-4 w-4 mr-2" />
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

        {/* Submit Button */}
        <div className="flex justify-center pt-6">
          <Button 
            type="submit"
            className="w-full max-w-md"
            disabled={createContactMutation.isPending}
          >
            {createContactMutation.isPending ? "Creating Contact..." : "Create Contact"}
          </Button>
        </div>
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
    <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600 p-4">
      <div className="space-y-3">
        {/* Block Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <span className="font-medium text-sm">{blockType.label.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(block.id)}
              className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Block Content */}
        <BlockContent block={block} onUpdate={onUpdate} />
      </div>
    </Card>
  );
}

// Block Content based on type
function BlockContent({ block, onUpdate }: { block: Block; onUpdate: (blockId: string, field: string, value: any) => void }) {
  switch (block.type) {
    case 'phone':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Label</label>
              <Select
                value={block.data.type}
                onValueChange={(value) => onUpdate(block.id, 'type', value)}
              >
                <SelectTrigger className="h-8">
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
              <label className="block text-xs font-medium mb-1">Phone Number</label>
              <Input
                placeholder="+1-555-123-4567"
                value={block.data.number}
                onChange={(e) => onUpdate(block.id, 'number', e.target.value)}
                className="h-8"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`whatsapp-${block.id}`}
                checked={block.data.hasWhatsApp}
                onCheckedChange={(checked) => onUpdate(block.id, 'hasWhatsApp', checked)}
              />
              <label htmlFor={`whatsapp-${block.id}`} className="text-xs">
                This number has WhatsApp
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`primary-${block.id}`}
                checked={block.data.isPrimary}
                onCheckedChange={(checked) => onUpdate(block.id, 'isPrimary', checked)}
              />
              <label htmlFor={`primary-${block.id}`} className="text-xs">
                Set as primary number for this contact
              </label>
            </div>
          </div>
        </div>
      );

    case 'email':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Label</label>
              <Select
                value={block.data.type}
                onValueChange={(value) => onUpdate(block.id, 'type', value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="Work">Work</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Email Address</label>
              <Input
                placeholder="isabella@email.com"
                value={block.data.address}
                onChange={(e) => onUpdate(block.id, 'address', e.target.value)}
                className="h-8"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`primary-email-${block.id}`}
              checked={block.data.isPrimary}
              onCheckedChange={(checked) => onUpdate(block.id, 'isPrimary', checked)}
            />
            <label htmlFor={`primary-email-${block.id}`} className="text-xs">
              Set as primary email for this contact
            </label>
          </div>
        </div>
      );

    case 'company':
      return (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Company</label>
            <Input
              placeholder="CreativeCo"
              value={block.data.name}
              onChange={(e) => onUpdate(block.id, 'name', e.target.value)}
              className="h-8"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Role</label>
            <Input
              placeholder="Lead Designer"
              value={block.data.role}
              onChange={(e) => onUpdate(block.id, 'role', e.target.value)}
              className="h-8"
            />
          </div>
        </div>
      );

    case 'note':
      return (
        <div className="space-y-2">
          <Input
            placeholder="Note title (e.g., Cuenta de banco)"
            value={block.data.title}
            onChange={(e) => onUpdate(block.id, 'title', e.target.value)}
            className="h-8"
          />
          <Textarea
            placeholder="Note content..."
            value={block.data.content}
            onChange={(e) => onUpdate(block.id, 'content', e.target.value)}
            className="min-h-[60px]"
          />
        </div>
      );

    default:
      return (
        <div className="text-sm text-gray-500">
          Block type "{block.type}" not yet implemented
        </div>
      );
  }
}