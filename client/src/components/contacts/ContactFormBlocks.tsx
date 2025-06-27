import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Phone, Mail, MapPin, Building2, Users, Link as LinkIcon, Calendar, Tag, MessageSquare, Plus, MoreHorizontal, X, User, ChevronDown, ChevronUp, Check, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TagInput } from "./TagInput";

// Block types organized by categories for consistent order across all contacts
const CONTACT_INFO_BLOCKS = [
  { id: 'phone', label: 'Phone Number', icon: Phone },
  { id: 'email', label: 'Email Address', icon: Mail },
  { id: 'address', label: 'Physical Address', icon: MapPin },
];

const RELATIONSHIP_BLOCKS = [
  { id: 'company', label: 'Company / Workplace', icon: Building2 },
  { id: 'group', label: 'Group Membership', icon: Users },
  { id: 'link', label: 'Link to Another Contact', icon: LinkIcon },
];

const PERSONAL_DETAILS_BLOCKS = [
  { id: 'date', label: 'Special Date (Birthday, etc.)', icon: Calendar },
  { id: 'interest', label: 'Interest', icon: Tag },
  { id: 'alias', label: 'Alias / Nickname', icon: Tag },
  { id: 'note', label: 'Context Note', icon: MessageSquare },
];

// All block types combined for reference
const BLOCK_TYPES = [...CONTACT_INFO_BLOCKS, ...RELATIONSHIP_BLOCKS, ...PERSONAL_DETAILS_BLOCKS];

interface Block {
  id: string;
  type: string;
  data: Record<string, any>;
}

interface ContactFormBlocksProps {
  onSuccess?: () => void;
  ownerUserId: string;
  spaceId?: number;
  isEditMode?: boolean;
  contactId?: number;
  onDelete?: () => void;
  initialData?: {
    fullName?: string;
    relationship?: string;
    tags?: string[];
    profilePictureUrl?: string;
    notes?: string;
  };
}

export function ContactFormBlocks({ onSuccess, ownerUserId, spaceId, isEditMode = false, contactId, onDelete, initialData }: ContactFormBlocksProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  
  // Core contact fields
  const [contactName, setContactName] = useState(initialData?.fullName || '');
  const [profession, setProfession] = useState('');
  const [company, setCompany] = useState('');
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [description, setDescription] = useState(initialData?.notes || '');
  
  // Dynamic blocks system
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isMainContact, setIsMainContact] = useState(false);

  // Fetch existing contact details in edit mode
  useEffect(() => {
    if (isEditMode && contactId) {
      const fetchContactDetails = async () => {
        try {
          // Force fresh data by adding timestamp to bypass cache
          const response = await fetch(`/api/crm/contacts/${contactId}/details?t=${Date.now()}`)
            .then(res => res.json());
          console.log('Contact details response (fresh):', response);
          
          // If response is empty or null, return early
          if (!response || Object.keys(response).length === 0) {
            console.log('Empty response, skipping block creation');
            return;
          }
          
          // Populate blocks from existing contact data
          const newBlocks: Block[] = [];
          
          // Add phone blocks
          if (response.phones && response.phones.length > 0) {
            response.phones.forEach((phone: any, index: number) => {
              newBlocks.push({
                id: `phone-${index}`,
                type: 'phone',
                data: {
                  number: phone.phoneNumber,
                  type: phone.label === 'WhatsApp' ? 'Mobile' : (phone.label || 'Mobile'),
                  isPrimary: phone.isPrimary,
                  hasWhatsApp: phone.isWhatsappLinked
                }
              });
            });
          } else if (response.notes) {
            // Try to extract phone from notes for older contacts
            const phoneMatch = response.notes.match(/Primary phone:\s*([+\d\s()-]+)/i);
            if (phoneMatch) {
              newBlocks.push({
                id: 'phone-from-notes',
                type: 'phone',
                data: {
                  number: phoneMatch[1].trim(),
                  type: 'Mobile',
                  isPrimary: true,
                  hasWhatsApp: false
                }
              });
            }
          }
          
          // Add email blocks
          if (response.emails && response.emails.length > 0) {
            response.emails.forEach((email: any, index: number) => {
              newBlocks.push({
                id: `email-${index}`,
                type: 'email',
                data: {
                  address: email.emailAddress,
                  type: email.label || 'Personal',
                  isPrimary: email.isPrimary
                }
              });
            });
          } else if (response.notes) {
            // Try to extract email from notes for older contacts
            const emailMatch = response.notes.match(/Primary email:\s*([^\s\n]+@[^\s\n]+)/i);
            if (emailMatch) {
              newBlocks.push({
                id: 'email-from-notes',
                type: 'email',
                data: {
                  address: emailMatch[1].trim(),
                  type: 'Personal',
                  isPrimary: true
                }
              });
            }
          }
          
          // Add address blocks
          if (response.addresses) {
            response.addresses.forEach((address: any, index: number) => {
              newBlocks.push({
                id: `address-${index}`,
                type: 'address',
                data: {
                  street: address.streetAddress,
                  city: address.city,
                  state: address.state,
                  zipCode: address.postalCode,
                  country: address.country,
                  type: address.label || 'Home'
                }
              });
            });
          }
          
          // Populate form fields with existing data
          setContactName(response.fullName || '');
          setProfession(response.profession || '');
          setCompany(response.company || '');
          setTags(response.tags || []);
          setDescription(response.notes || '');
          
          // Check if this is the main contact
          const isMain = response.relationship === "Self" || response.tags?.includes("Main");
          setIsMainContact(isMain);
          
          setBlocks(newBlocks);
        } catch (error) {
          console.error('Error fetching contact details:', error);
        }
      };
      
      fetchContactDetails();
    }
  }, [isEditMode, contactId]);

  const createContactMutation = useMutation({
    mutationFn: async () => {
      // Process blocks into contact data
      const contactData = {
        fullName: contactName,
        tags,
        ownerUserId,
        spaceId,
      };

      // Extract and process block data
      const phoneBlocks = blocks.filter(b => b.type === 'phone');
      const emailBlocks = blocks.filter(b => b.type === 'email');
      const addressBlocks = blocks.filter(b => b.type === 'address');
      const companyBlocks = blocks.filter(b => b.type === 'company');
      const noteBlocks = blocks.filter(b => b.type === 'note');
      const linkBlocks = blocks.filter(b => b.type === 'link');

      // Set primary contact methods
      const primaryPhone = phoneBlocks.find(b => b.data.isPrimary)?.data.number || phoneBlocks[0]?.data.number || '';
      const primaryEmail = emailBlocks.find(b => b.data.isPrimary)?.data.address || emailBlocks[0]?.data.address || '';

      // Build complete contact object with block data
      const completeContactData = {
        ...contactData,
        primaryPhone,
        primaryEmail,
        profession: profession || companyBlocks[0]?.data.role || '',
        company: company || companyBlocks[0]?.data.name || '',
        notes: description || noteBlocks.map(b => b.data.content).join('\n') || initialData?.notes || '',
        // Include all block data for processing
        phones: phoneBlocks.map(block => ({
          phoneNumber: block.data.number,
          label: block.data.type,
          isPrimary: block.data.isPrimary,
          isWhatsappLinked: block.data.hasWhatsApp
        })),
        emails: emailBlocks.map(block => ({
          emailAddress: block.data.address,
          label: block.data.type,
          isPrimary: block.data.isPrimary
        })),
        addresses: addressBlocks.map(block => ({
          streetAddress: block.data.street,
          city: block.data.city,
          state: block.data.state,
          postalCode: block.data.zipCode,
          country: block.data.country,
          label: block.data.type,
          isPrimary: block.data.isPrimary
        })),
        relationships: linkBlocks.map(block => ({
          relatedContactId: block.data.contactId,
          relationshipType: block.data.relationshipType,
          notes: block.data.notes
        }))
      };

      if (isEditMode && contactId) {
        const response = await apiRequest('PUT', `/api/crm/contacts/${contactId}/complete`, completeContactData);
        return response;
      } else {
        const response = await apiRequest('POST', '/api/crm/contacts/complete', completeContactData);
        return response;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      if (!isEditMode) {
        setContactName('');
        setTags([]);
        setProfession('');
        setCompany('');
        setBlocks([]);
      }
      toast({
        title: "Success",
        description: isEditMode ? "Contact updated successfully" : "Contact created successfully",
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
        return { title: '', day: null, month: null, year: null, type: 'birthday', reminderDays: 7 };
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
    <div className="space-y-4 px-6 py-6">
      {/* Header with person icon and delete button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <User className="h-6 w-6 text-gray-700" />
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditMode ? "Edit Contact" : "Add New Contact"}
          </h2>
        </div>
        {isEditMode && onDelete && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteAlert(true)}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}
      </div>
      
      <form onSubmit={onSubmit} className="space-y-4">
        {/* Contact Name - Fill Box Style */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Contact Name <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Enter contact name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="h-12 border-2 border-gray-900 rounded-lg px-4 text-base font-medium focus:border-gray-900 focus:ring-0"
              required
            />
          </div>

          {/* Optional fields for profession and company */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Profession</label>
              <Input
                placeholder="e.g., Cardiologist"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                className="h-10 border border-gray-300 rounded-lg px-3 focus:border-gray-500 focus:ring-0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Company</label>
              <Input
                placeholder="e.g., Hospital Angeles"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="h-10 border border-gray-300 rounded-lg px-3 focus:border-gray-500 focus:ring-0"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Description</label>
            <Textarea
              placeholder="Es un abogado que trabajo conmigo en Excel. Se dedica al outsourcing."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px] border border-gray-300 rounded-lg px-3 py-2 focus:border-gray-500 focus:ring-0 resize-none"
              rows={3}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Tags</label>
            <TagInput
              tags={tags}
              onChange={setTags}
              placeholder="Add tags like Client, Friend, etc."
            />
          </div>
        </div>

        {/* Dynamic Blocks - Edit Mode vs View Mode */}
        {isPreviewMode ? (
          <ContactViewMode blocks={blocks} contactName={contactName} profession={profession} company={company} tags={tags} description={description} />
        ) : (
          <div className="space-y-4">
            {/* Contact Info Section */}
            <ContactInfoSection 
              blocks={blocks.filter(b => ['phone', 'email', 'address'].includes(b.type))}
              onUpdate={updateBlock}
              onRemove={removeBlock}
              onAddSubBlock={addBlock}
              ownerUserId={ownerUserId}
            />

            {/* Relationships & Groups Section */}
            <RelationshipSection 
              blocks={blocks.filter(b => ['company', 'group', 'link'].includes(b.type))}
              onUpdate={updateBlock}
              onRemove={removeBlock}
              onAddSubBlock={addBlock}
              ownerUserId={ownerUserId}
            />

            {/* Personal Details Section */}
            <PersonalDetailsSection 
              blocks={blocks.filter(b => ['date', 'interest', 'alias'].includes(b.type))}
              onUpdate={updateBlock}
              onRemove={removeBlock}
              onAddSubBlock={addBlock}
              ownerUserId={ownerUserId}
            />

            {/* Individual Note Blocks */}
            {blocks.filter(b => b.type === 'note').map((block) => (
              <BlockComponent
                key={block.id}
                block={block}
                onUpdate={updateBlock}
                onRemove={removeBlock}
                ownerUserId={ownerUserId}
              />
            ))}

            {/* Add Note Button */}
            <div className="flex justify-center py-2">
              <Button 
                variant="outline" 
                className="border-dashed border-2 border-gray-300 py-3 px-6 bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium rounded-lg"
                type="button"
                onClick={() => addBlock('note')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Note
              </Button>
            </div>
          </div>
        )}

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-gray-200">
          <Button 
            type="button"
            variant="outline"
            className="px-4 py-2 text-sm font-medium rounded-lg"
          >
            Cancel
          </Button>
          {!isPreviewMode ? (
            <Button 
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-medium rounded-lg"
              disabled={createContactMutation.isPending}
            >
              {createContactMutation.isPending ? (isEditMode ? "Updating Contact..." : "Creating Contact...") : (isEditMode ? "Update Contact" : "Create Contact")}
            </Button>
          ) : (
            <Button 
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-medium rounded-lg"
              disabled={createContactMutation.isPending}
            >
              {createContactMutation.isPending ? (isEditMode ? "Updating Contact..." : "Creating Contact...") : (isEditMode ? "Update Contact" : "Create Contact")}
            </Button>
          )}
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
  ownerUserId: string;
  isMainContact?: boolean;
}

function BlockComponent({ block, onUpdate, onRemove, ownerUserId, isMainContact }: BlockComponentProps) {
  const blockType = BLOCK_TYPES.find(t => t.id === block.type);
  if (!blockType) return null;

  const Icon = blockType.icon;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
      <div className="space-y-3">
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
        <BlockContent block={block} onUpdate={onUpdate} ownerUserId={ownerUserId} isMainContact={isMainContact} />
      </div>
    </div>
  );
}

// Section Components for organized blocks
function ContactInfoSection({ blocks, onUpdate, onRemove, onAddSubBlock, ownerUserId, isMainContact }: {
  blocks: Block[];
  onUpdate: (blockId: string, field: string, value: any) => void;
  onRemove: (blockId: string) => void;
  onAddSubBlock: (type: string) => void;
  ownerUserId: string;
  isMainContact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border border-gray-200 rounded-lg">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <Phone className="h-5 w-5 text-gray-500" />
          <h3 className="font-medium text-gray-900">Contact Info</h3>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              {CONTACT_INFO_BLOCKS.map((blockType) => (
                <DropdownMenuItem
                  key={blockType.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Adding block type:', blockType.id);
                    onAddSubBlock(blockType.id);
                  }}
                >
                  <blockType.icon className="h-4 w-4 mr-2" />
                  {blockType.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>
      
      {isOpen && blocks.length > 0 && (
        <div className="border-t border-gray-200 p-4 space-y-3">
          {blocks.map((block) => (
            <BlockComponent
              key={block.id}
              block={block}
              onUpdate={onUpdate}
              onRemove={onRemove}
              ownerUserId={ownerUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RelationshipSection({ blocks, onUpdate, onRemove, onAddSubBlock, ownerUserId }: {
  blocks: Block[];
  onUpdate: (blockId: string, field: string, value: any) => void;
  onRemove: (blockId: string) => void;
  onAddSubBlock: (type: string) => void;
  ownerUserId: string;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border border-gray-200 rounded-lg">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-gray-500" />
          <h3 className="font-medium text-gray-900">Relationships & Groups</h3>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              {RELATIONSHIP_BLOCKS.map((blockType) => (
                <DropdownMenuItem
                  key={blockType.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Adding relationship block type:', blockType.id);
                    onAddSubBlock(blockType.id);
                  }}
                >
                  <blockType.icon className="h-4 w-4 mr-2" />
                  {blockType.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>
      
      {isOpen && blocks.length > 0 && (
        <div className="border-t border-gray-200 p-4 space-y-3">
          {blocks.map((block) => (
            <BlockComponent
              key={block.id}
              block={block}
              onUpdate={onUpdate}
              onRemove={onRemove}
              ownerUserId={ownerUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonalDetailsSection({ blocks, onUpdate, onRemove, onAddSubBlock, ownerUserId }: {
  blocks: Block[];
  onUpdate: (blockId: string, field: string, value: any) => void;
  onRemove: (blockId: string) => void;
  onAddSubBlock: (type: string) => void;
  ownerUserId: string;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border border-gray-200 rounded-lg">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-gray-500" />
          <h3 className="font-medium text-gray-900">Personal Details</h3>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              {PERSONAL_DETAILS_BLOCKS.filter(b => b.id !== 'note').map((blockType) => (
                <DropdownMenuItem
                  key={blockType.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Adding personal details block type:', blockType.id);
                    onAddSubBlock(blockType.id);
                  }}
                >
                  <blockType.icon className="h-4 w-4 mr-2" />
                  {blockType.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>
      
      {isOpen && blocks.length > 0 && (
        <div className="border-t border-gray-200 p-4 space-y-3">
          {blocks.map((block) => (
            <BlockComponent
              key={block.id}
              block={block}
              onUpdate={onUpdate}
              onRemove={onRemove}
              ownerUserId={ownerUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Company Block Component with dropdown and modal
function CompanyBlock({ block, onUpdate }: { 
  block: Block; 
  onUpdate: (blockId: string, field: string, value: any) => void;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyType, setNewCompanyType] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch companies for dropdown
  const { data: companies = [] } = useQuery({
    queryKey: ['/api/crm/companies'],
  });

  // Create company mutation
  const createCompanyMutation = useMutation({
    mutationFn: async (companyData: any) => {
      return await apiRequest('/api/crm/companies', 'POST', companyData);
    },
    onSuccess: (newCompany: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/companies'] });
      onUpdate(block.id, 'companyId', newCompany.companyId || newCompany.id);
      onUpdate(block.id, 'companyName', newCompany.companyName);
      setShowCreateModal(false);
      setNewCompanyName('');
      setNewCompanyType('');
      toast({
        title: "Company created",
        description: `${newCompany.companyName} has been added successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating company",
        description: "Failed to create the company. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateCompany = () => {
    if (!newCompanyName.trim()) {
      toast({
        title: "Company name required",
        description: "Please enter a company name.",
        variant: "destructive",
      });
      return;
    }

    createCompanyMutation.mutate({
      companyName: newCompanyName,
      businessType: newCompanyType || 'Other',
    });
  };

  const handleCompanySelect = (companyId: string) => {
    const selectedCompany = companies.find((c: any) => c.id.toString() === companyId);
    if (selectedCompany) {
      onUpdate(block.id, 'companyId', selectedCompany.id);
      onUpdate(block.id, 'companyName', selectedCompany.companyName);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Company</label>
        <div className="flex gap-2">
          <Select value={block.data.companyId?.toString() || ''} onValueChange={handleCompanySelect}>
            <SelectTrigger className="h-10 border-gray-300 rounded-lg">
              <SelectValue placeholder="Select company..." />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company: any) => (
                <SelectItem key={company.id} value={company.id.toString()}>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-500" />
                    {company.companyName}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-10 px-3"
                type="button"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Company</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="Enter company name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="businessType">Business Type</Label>
                  <Select value={newCompanyType} onValueChange={setNewCompanyType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select business type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Healthcare">Healthcare</SelectItem>
                      <SelectItem value="Technology">Technology</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                      <SelectItem value="Education">Education</SelectItem>
                      <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="Retail">Retail</SelectItem>
                      <SelectItem value="Services">Services</SelectItem>
                      <SelectItem value="Non-profit">Non-profit</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                    disabled={createCompanyMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateCompany}
                    disabled={createCompanyMutation.isPending}
                  >
                    {createCompanyMutation.isPending ? 'Creating...' : 'Create Company'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Role</label>
        <Input
          placeholder="Lead Designer"
          value={block.data.role || ''}
          onChange={(e) => onUpdate(block.id, 'role', e.target.value)}
          className="h-10 border-gray-300 rounded-lg"
        />
      </div>
    </div>
  );
}

// Block Content based on type
function BlockContent({ block, onUpdate, ownerUserId, isMainContact }: { 
  block: Block; 
  onUpdate: (blockId: string, field: string, value: any) => void;
  ownerUserId: string;
  isMainContact?: boolean;
}) {
  // Fetch WhatsApp instances for main contact only
  const { data: whatsappInstances = [] } = useQuery({
    queryKey: ['/api/whatsapp/instances', ownerUserId],
    queryFn: () => fetch(`/api/whatsapp/instances?ownerUserId=${ownerUserId}`).then(res => res.json()),
    enabled: isMainContact && !!ownerUserId,
  });

  switch (block.type) {
    case 'phone':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Label</label>
              <Select
                value={block.data.type}
                onValueChange={(value) => onUpdate(block.id, 'type', value)}
              >
                <SelectTrigger className="h-10 border-gray-300 rounded-lg">
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
              <label className="block text-sm font-medium text-gray-600 mb-1">Phone Number</label>
              <Input
                placeholder="+1-555-123-4567"
                value={block.data.number}
                onChange={(e) => onUpdate(block.id, 'number', e.target.value)}
                className="h-10 border-gray-300 rounded-lg"
              />
            </div>
          </div>
          
          {/* WhatsApp Instance Selection - Only for Main Contact */}
          {isMainContact && block.data.hasWhatsApp && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">WhatsApp Instance</label>
              <Select
                value={block.data.whatsappInstanceId || ''}
                onValueChange={(value) => onUpdate(block.id, 'whatsappInstanceId', value)}
              >
                <SelectTrigger className="h-10 border-gray-300 rounded-lg">
                  <SelectValue placeholder="Select WhatsApp instance" />
                </SelectTrigger>
                <SelectContent>
                  {whatsappInstances.map((instance: any) => (
                    <SelectItem key={instance.instanceName} value={instance.instanceName}>
                      {instance.instanceName} - {instance.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`whatsapp-${block.id}`}
                checked={block.data.hasWhatsApp}
                onCheckedChange={(checked) => onUpdate(block.id, 'hasWhatsApp', checked)}
              />
              <label htmlFor={`whatsapp-${block.id}`} className="text-sm text-gray-600">
                This number has WhatsApp
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`primary-${block.id}`}
                checked={block.data.isPrimary}
                onCheckedChange={(checked) => onUpdate(block.id, 'isPrimary', checked)}
              />
              <label htmlFor={`primary-${block.id}`} className="text-sm text-gray-600">
                Set as primary
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
              <label className="block text-sm font-medium text-gray-600 mb-1">Label</label>
              <Select
                value={block.data.type}
                onValueChange={(value) => onUpdate(block.id, 'type', value)}
              >
                <SelectTrigger className="h-10 border-gray-300 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="Work">Work</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Email Address</label>
              <Input
                placeholder="isabella@email.com"
                value={block.data.address}
                onChange={(e) => onUpdate(block.id, 'address', e.target.value)}
                className="h-10 border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`primary-email-${block.id}`}
              checked={block.data.isPrimary}
              onCheckedChange={(checked) => onUpdate(block.id, 'isPrimary', checked)}
            />
            <label htmlFor={`primary-email-${block.id}`} className="text-sm text-gray-600">
              Set as primary email
            </label>
          </div>
        </div>
      );

    case 'company':
      return <CompanyBlock block={block} onUpdate={onUpdate} />;

    case 'note':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Note Title</label>
            <Input
              placeholder="Note title (e.g., Cuenta de banco)"
              value={block.data.title}
              onChange={(e) => onUpdate(block.id, 'title', e.target.value)}
              className="h-10 border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Content</label>
            <Textarea
              placeholder="Note content..."
              value={block.data.content}
              onChange={(e) => onUpdate(block.id, 'content', e.target.value)}
              className="min-h-[60px] border-gray-300 rounded-lg resize-none"
            />
          </div>
        </div>
      );

    case 'address':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Label</label>
              <Select
                value={block.data.type || 'Home'}
                onValueChange={(value) => onUpdate(block.id, 'type', value)}
              >
                <SelectTrigger className="h-10 border-gray-300 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Home">Home</SelectItem>
                  <SelectItem value="Work">Work</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Checkbox
                id={`primary-address-${block.id}`}
                checked={block.data.isPrimary || false}
                onCheckedChange={(checked) => onUpdate(block.id, 'isPrimary', checked)}
              />
              <label htmlFor={`primary-address-${block.id}`} className="text-sm text-gray-600">
                Primary Address
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Street Address</label>
            <Input
              placeholder="123 Main Street"
              value={block.data.street || ''}
              onChange={(e) => onUpdate(block.id, 'street', e.target.value)}
              className="h-10 border-gray-300 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">City</label>
              <Input
                placeholder="New York"
                value={block.data.city || ''}
                onChange={(e) => onUpdate(block.id, 'city', e.target.value)}
                className="h-10 border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">State/Province</label>
              <Input
                placeholder="NY"
                value={block.data.state || ''}
                onChange={(e) => onUpdate(block.id, 'state', e.target.value)}
                className="h-10 border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">ZIP/Postal Code</label>
              <Input
                placeholder="10001"
                value={block.data.zipCode || ''}
                onChange={(e) => onUpdate(block.id, 'zipCode', e.target.value)}
                className="h-10 border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Country</label>
              <Input
                placeholder="United States"
                value={block.data.country || ''}
                onChange={(e) => onUpdate(block.id, 'country', e.target.value)}
                className="h-10 border-gray-300 rounded-lg"
              />
            </div>
          </div>
        </div>
      );

    case 'date':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Event Type</label>
              <Select
                value={block.data.type || 'birthday'}
                onValueChange={(value) => onUpdate(block.id, 'type', value)}
              >
                <SelectTrigger className="h-10 border-gray-300 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="birthday">Birthday</SelectItem>
                  <SelectItem value="anniversary">Anniversary</SelectItem>
                  <SelectItem value="wedding">Wedding</SelectItem>
                  <SelectItem value="graduation">Graduation</SelectItem>
                  <SelectItem value="work_anniversary">Work Anniversary</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Event Name</label>
              <Input
                placeholder="e.g., Birthday, Wedding Anniversary"
                value={block.data.title || ''}
                onChange={(e) => onUpdate(block.id, 'title', e.target.value)}
                className="h-10 border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Day</label>
              <Select
                value={String(block.data.day || '')}
                onValueChange={(value) => onUpdate(block.id, 'day', parseInt(value))}
              >
                <SelectTrigger className="h-10 border-gray-300 rounded-lg">
                  <SelectValue placeholder="Day" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <SelectItem key={day} value={String(day)}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Month</label>
              <Select
                value={String(block.data.month || '')}
                onValueChange={(value) => onUpdate(block.id, 'month', parseInt(value))}
              >
                <SelectTrigger className="h-10 border-gray-300 rounded-lg">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">January</SelectItem>
                  <SelectItem value="2">February</SelectItem>
                  <SelectItem value="3">March</SelectItem>
                  <SelectItem value="4">April</SelectItem>
                  <SelectItem value="5">May</SelectItem>
                  <SelectItem value="6">June</SelectItem>
                  <SelectItem value="7">July</SelectItem>
                  <SelectItem value="8">August</SelectItem>
                  <SelectItem value="9">September</SelectItem>
                  <SelectItem value="10">October</SelectItem>
                  <SelectItem value="11">November</SelectItem>
                  <SelectItem value="12">December</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Year (optional)</label>
              <Input
                type="number"
                placeholder="e.g., 1990"
                value={block.data.year || ''}
                onChange={(e) => onUpdate(block.id, 'year', e.target.value ? parseInt(e.target.value) : null)}
                className="h-10 border-gray-300 rounded-lg"
                min="1900"
                max="2100"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Reminder (days before)</label>
            <Select
              value={String(block.data.reminderDays || 7)}
              onValueChange={(value) => onUpdate(block.id, 'reminderDays', parseInt(value))}
            >
              <SelectTrigger className="h-10 border-gray-300 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case 'interest':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Interest/Hobby</label>
            <Input
              placeholder="e.g., Marathon Running, Classical Music, Medical Research"
              value={block.data.name || ''}
              onChange={(e) => onUpdate(block.id, 'name', e.target.value)}
              className="h-10 border-gray-300 rounded-lg"
            />
          </div>
        </div>
      );

    case 'alias':
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Alias/Nickname</label>
            <Input
              placeholder="e.g., Doc, Izzy, Coach"
              value={block.data.name || ''}
              onChange={(e) => onUpdate(block.id, 'name', e.target.value)}
              className="h-10 border-gray-300 rounded-lg"
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

    case 'link':
      return <LinkBlock block={block} onUpdate={onUpdate} ownerUserId={ownerUserId} />;

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
  tags: string[];
  description: string;
}

function ContactViewMode({ blocks, contactName, profession, company, tags, description }: ContactViewModeProps) {
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
      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag, index) => (
            <Badge 
              key={index} 
              variant="secondary" 
              className="text-xs"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

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
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium border border-green-300">
                        <Check className="w-3 h-3" />
                        WhatsApp
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
                {dateBlocks.map((block) => {
                  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 
                                     'July', 'August', 'September', 'October', 'November', 'December'];
                  const dateDisplay = block.data.day && block.data.month 
                    ? `${block.data.day}/${block.data.month}${block.data.year ? `/${block.data.year}` : ''}`
                    : 'No date set';
                  
                  return (
                    <div key={block.id} className="ml-6">
                      <span className="text-sm">
                        {block.data.title || block.data.type}: {dateDisplay}
                        {' '}(Reminder: {block.data.reminderDays || 7} days prior)
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Interests */}
            {interestBlocks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Interests</span>
                </div>
                <div className="ml-6 flex flex-wrap gap-2">
                  {interestBlocks.map((block) => (
                    <Badge key={block.id} variant="outline" className="text-xs">
                      {block.data.name}
                    </Badge>
                  ))}
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

function LinkBlock({ block, onUpdate, ownerUserId }: { 
  block: Block; 
  onUpdate: (blockId: string, field: string, value: any) => void;
  ownerUserId: string;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch contacts for dropdown
  const { data: contactsList = [], error, isLoading: isContactsLoading } = useQuery({
    queryKey: ['/api/crm/contacts', ownerUserId],
    queryFn: async () => {
      if (!ownerUserId) {
        throw new Error('Owner user ID is required');
      }
      const response = await fetch(`/api/crm/contacts?ownerUserId=${ownerUserId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch contacts: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!ownerUserId,
    staleTime: 30000,
  });

  const selectedContact = contactsList.find((c: any) => c.contactId === block.data.contactId);
  
  // Filter contacts based on search term
  const filteredContacts = contactsList.filter((contact: any) => 
    contact.fullName.toLowerCase().includes(searchTerm.toLowerCase()) &&
    contact.contactId !== block.data.contactId // Don't show currently selected contact
  );

  // Handle contact selection
  const handleContactSelect = (contact: any) => {
    onUpdate(block.id, 'contactId', contact.contactId);
    setSearchTerm('');
    setShowSuggestions(false);
  };

  // Initialize search term with selected contact name
  React.useEffect(() => {
    if (selectedContact && !showSuggestions) {
      setSearchTerm(selectedContact.fullName);
    }
  }, [selectedContact, showSuggestions]);

  // Close suggestions when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSuggestions) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSuggestions]);

  return (
    <div className="space-y-3">
      {/* Contact Selection */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Linked Contact</label>
          <div className="relative">
            <Input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search and select contact..."
              className="border-gray-300 rounded-lg"
            />
            
            {/* Dropdown Suggestions */}
            {showSuggestions && searchTerm && filteredContacts.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredContacts.slice(0, 5).map((contact: any) => (
                  <button
                    key={contact.contactId}
                    type="button"
                    onClick={() => handleContactSelect(contact)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <User className="h-4 w-4 text-gray-500" />
                    <div>
                      <div className="font-medium">{contact.fullName}</div>
                      {contact.relationship && (
                        <div className="text-xs text-gray-500">{contact.relationship}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {/* No results message */}
            {showSuggestions && searchTerm && filteredContacts.length === 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg px-3 py-2 text-gray-500 text-sm">
                No contacts found
              </div>
            )}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Relationship Type</label>
          <Select
            value={block.data.relationshipType || ''}
            onValueChange={(value) => onUpdate(block.id, 'relationshipType', value)}
          >
            <SelectTrigger className="h-10 border-gray-300 rounded-lg">
              <SelectValue placeholder="Select relationship..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spouse">Spouse</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
              <SelectItem value="parent">Parent</SelectItem>
              <SelectItem value="child">Child</SelectItem>
              <SelectItem value="sibling">Sibling</SelectItem>
              <SelectItem value="friend">Friend</SelectItem>
              <SelectItem value="colleague">Colleague</SelectItem>
              <SelectItem value="business_partner">Business Partner</SelectItem>
              <SelectItem value="mentor">Mentor</SelectItem>
              <SelectItem value="mentee">Mentee</SelectItem>
              <SelectItem value="neighbor">Neighbor</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Notes (Optional)</label>
        <Textarea
          placeholder="Add notes about this relationship..."
          value={block.data.notes || ''}
          onChange={(e) => onUpdate(block.id, 'notes', e.target.value)}
          rows={2}
          className="border-gray-300 rounded-lg"
        />
      </div>
    </div>
  );
}

export default ContactFormBlocks;