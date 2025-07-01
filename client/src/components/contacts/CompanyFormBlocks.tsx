import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Building2, Phone, Mail, MapPin, Trash2, Plus, X, Check, 
  User, ChevronDown, ChevronRight, Globe, Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Block {
  id: string;
  type: string;
  data: Record<string, any>;
}

interface CompanyFormBlocksProps {
  onSuccess?: () => void;
  ownerUserId: string;
  spaceId?: number;
  isEditMode?: boolean;
  companyId?: number | string;
  onDelete?: () => void;
  initialData?: {
    name?: string;
    description?: string;
    tags?: string[];
  };
}

const COMPANY_INFO_BLOCKS = [
  { id: 'phone', label: 'Phone Number', icon: Phone },
  { id: 'email', label: 'Email Address', icon: Mail },
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'website', label: 'Website', icon: Globe },
  { id: 'relationship', label: 'Contact Person', icon: User },
];

export function CompanyFormBlocks({ 
  onSuccess, 
  ownerUserId, 
  spaceId, 
  isEditMode = false, 
  companyId, 
  onDelete, 
  initialData 
}: CompanyFormBlocksProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  
  // Core company fields
  const [companyName, setCompanyName] = useState(initialData?.name || '');
  const [industry, setIndustry] = useState('');
  const [legalName, setLegalName] = useState('');
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [description, setDescription] = useState(initialData?.description || '');
  
  // Dynamic blocks system
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Fetch existing company details in edit mode
  useEffect(() => {
    if (isEditMode && companyId) {
      console.log('CompanyFormBlocks: Starting edit mode fetch for companyId:', companyId);
      const fetchCompanyDetails = async () => {
        try {
          const response = await fetch(`/api/crm/companies/${companyId}/details?t=${Date.now()}`)
            .then(res => res.json());
          console.log('CompanyFormBlocks: Company details response:', response);
          
          // Set basic company info if available
          if (response) {
            if (response.name) setCompanyName(response.name);
            if (response.legal_name) setLegalName(response.legal_name);
            if (response.industry) setIndustry(response.industry);
            if (response.description) setDescription(response.description);
            if (response.tags) setTags(response.tags);
          }
          
          if (!response || Object.keys(response).length === 0) {
            console.log('CompanyFormBlocks: Empty response, skipping block creation');
            return;
          }
          
          // Populate blocks from existing company data
          const newBlocks: Block[] = [];
          
          // Add phone blocks
          if (response.phones && response.phones.length > 0) {
            response.phones.forEach((phone: any, index: number) => {
              newBlocks.push({
                id: `phone-${index}`,
                type: 'phone',
                data: {
                  number: phone.phoneNumber,
                  type: phone.label || 'Main',
                  isPrimary: phone.isPrimary,
                  extension: phone.extension
                }
              });
            });
          }
          
          // Add email blocks
          if (response.emails && response.emails.length > 0) {
            response.emails.forEach((email: any, index: number) => {
              newBlocks.push({
                id: `email-${index}`,
                type: 'email',
                data: {
                  address: email.emailAddress,
                  type: email.label || 'Business',
                  isPrimary: email.isPrimary
                }
              });
            });
          }
          
          // Add address blocks
          if (response.addresses && response.addresses.length > 0) {
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
                  type: address.label || 'Headquarters'
                }
              });
            });
          }

          // Add website block if exists
          if (response.website_url) {
            newBlocks.push({
              id: 'website-main',
              type: 'website',
              data: {
                url: response.website_url,
                type: 'Main Website'
              }
            });
          }

          // Add relationship blocks (contact persons)
          if (response.relationships && response.relationships.length > 0) {
            response.relationships.forEach((relationship: any, index: number) => {
              newBlocks.push({
                id: `relationship-${index}`,
                type: 'relationship',
                data: {
                  contactId: relationship.relatedContactId,
                  relationshipType: relationship.relationshipType,
                  notes: relationship.notes
                }
              });
            });
          }
          
          setBlocks(newBlocks);
        } catch (error) {
          console.error('Error fetching company details:', error);
        }
      };
      
      fetchCompanyDetails();
    }
  }, [isEditMode, companyId]);

  const createCompanyMutation = useMutation({
    mutationFn: async () => {
      const companyData = {
        name: companyName,
        legal_name: legalName || companyName,
        industry,
        description,
        tags,
        ownerUserId,
        spaceId,
      };

      // Extract and process block data
      const phoneBlocks = blocks.filter(b => b.type === 'phone');
      const emailBlocks = blocks.filter(b => b.type === 'email');
      const addressBlocks = blocks.filter(b => b.type === 'address');
      const websiteBlocks = blocks.filter(b => b.type === 'website');
      const relationshipBlocks = blocks.filter(b => b.type === 'relationship');

      // Set primary contact methods
      const primaryPhone = phoneBlocks.find(b => b.data.isPrimary)?.data.number || phoneBlocks[0]?.data.number || '';
      const primaryEmail = emailBlocks.find(b => b.data.isPrimary)?.data.address || emailBlocks[0]?.data.address || '';
      const websiteUrl = websiteBlocks[0]?.data.url || '';

      // Build complete company object with block data
      const completeCompanyData = {
        ...companyData,
        main_phone: primaryPhone,
        main_email: primaryEmail,
        website_url: websiteUrl,
        // Include all block data for processing
        phones: phoneBlocks.map(block => ({
          phoneNumber: block.data.number,
          label: block.data.type,
          isPrimary: block.data.isPrimary,
          extension: block.data.extension
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
          label: block.data.type
        })),
        relationships: relationshipBlocks.map(block => ({
          relatedContactId: block.data.contactId,
          relationshipType: block.data.relationshipType,
          notes: block.data.notes
        }))
      };

      if (isEditMode && companyId) {
        const response = await apiRequest('PUT', `/api/crm/companies/${companyId}/complete`, completeCompanyData);
        return response;
      } else {
        const response = await apiRequest('POST', '/api/crm/companies/complete', completeCompanyData);
        return response;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/companies'] });
      if (!isEditMode) {
        setCompanyName('');
        setLegalName('');
        setIndustry('');
        setTags([]);
        setDescription('');
        setBlocks([]);
      }
      toast({
        title: "Success",
        description: isEditMode ? "Company updated successfully" : "Company created successfully",
      });
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save company",
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
        return { number: '', type: 'Main', isPrimary: false, extension: '' };
      case 'email':
        return { address: '', type: 'Business', isPrimary: false };
      case 'address':
        return { street: '', city: '', state: '', zipCode: '', country: '', type: 'Headquarters' };
      case 'website':
        return { url: '', type: 'Main Website' };
      case 'relationship':
        return { contactId: '', relationshipType: 'Contact Person', notes: '' };
      default:
        return {};
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast({
        title: "Error",
        description: "Company name is required",
        variant: "destructive",
      });
      return;
    }
    createCompanyMutation.mutate();
  };

  const renderBlockEditor = (block: Block) => {
    switch (block.type) {
      case 'phone':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Label</label>
                <Select
                  value={block.data.type}
                  onValueChange={(value) => updateBlock(block.id, 'type', value)}
                >
                  <SelectTrigger className="h-10 border-gray-300 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Main">Main</SelectItem>
                    <SelectItem value="Office">Office</SelectItem>
                    <SelectItem value="Support">Support</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Fax">Fax</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Phone Number</label>
                <Input
                  placeholder="+52-55-1234-5678"
                  value={block.data.number}
                  onChange={(e) => updateBlock(block.id, 'number', e.target.value)}
                  className="h-10 border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Extension</label>
                <Input
                  placeholder="ext. 123"
                  value={block.data.extension}
                  onChange={(e) => updateBlock(block.id, 'extension', e.target.value)}
                  className="h-10 border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  checked={block.data.isPrimary}
                  onCheckedChange={(value) => updateBlock(block.id, 'isPrimary', value)}
                />
                <label className="text-sm font-medium text-gray-600">Primary</label>
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
                  onValueChange={(value) => updateBlock(block.id, 'type', value)}
                >
                  <SelectTrigger className="h-10 border-gray-300 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Business">Business</SelectItem>
                    <SelectItem value="Support">Support</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Info">Info</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Email Address</label>
                <Input
                  placeholder="contact@company.com"
                  value={block.data.address}
                  onChange={(e) => updateBlock(block.id, 'address', e.target.value)}
                  className="h-10 border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={block.data.isPrimary}
                onCheckedChange={(value) => updateBlock(block.id, 'isPrimary', value)}
              />
              <label className="text-sm font-medium text-gray-600">Primary</label>
            </div>
          </div>
        );

      case 'address':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Label</label>
              <Select
                value={block.data.type}
                onValueChange={(value) => updateBlock(block.id, 'type', value)}
              >
                <SelectTrigger className="h-10 border-gray-300 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Headquarters">Headquarters</SelectItem>
                  <SelectItem value="Office">Office</SelectItem>
                  <SelectItem value="Branch">Branch</SelectItem>
                  <SelectItem value="Warehouse">Warehouse</SelectItem>
                  <SelectItem value="Shipping">Shipping</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Street Address</label>
              <Input
                placeholder="123 Business Ave"
                value={block.data.street}
                onChange={(e) => updateBlock(block.id, 'street', e.target.value)}
                className="h-10 border-gray-300 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">City</label>
                <Input
                  placeholder="Mexico City"
                  value={block.data.city}
                  onChange={(e) => updateBlock(block.id, 'city', e.target.value)}
                  className="h-10 border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">State/Province</label>
                <Input
                  placeholder="CDMX"
                  value={block.data.state}
                  onChange={(e) => updateBlock(block.id, 'state', e.target.value)}
                  className="h-10 border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">ZIP/Postal Code</label>
                <Input
                  placeholder="01000"
                  value={block.data.zipCode}
                  onChange={(e) => updateBlock(block.id, 'zipCode', e.target.value)}
                  className="h-10 border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Country</label>
                <Input
                  placeholder="Mexico"
                  value={block.data.country}
                  onChange={(e) => updateBlock(block.id, 'country', e.target.value)}
                  className="h-10 border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        );

      case 'website':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Label</label>
                <Select
                  value={block.data.type}
                  onValueChange={(value) => updateBlock(block.id, 'type', value)}
                >
                  <SelectTrigger className="h-10 border-gray-300 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Main Website">Main Website</SelectItem>
                    <SelectItem value="Support Portal">Support Portal</SelectItem>
                    <SelectItem value="Online Store">Online Store</SelectItem>
                    <SelectItem value="Social Media">Social Media</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Website URL</label>
                <Input
                  placeholder="https://www.company.com"
                  value={block.data.url}
                  onChange={(e) => updateBlock(block.id, 'url', e.target.value)}
                  className="h-10 border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        );

      case 'relationship':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Contact Person</label>
                <ContactSelect
                  value={block.data.contactId}
                  onValueChange={(value) => updateBlock(block.id, 'contactId', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Role/Position</label>
                <Select
                  value={block.data.relationshipType}
                  onValueChange={(value) => updateBlock(block.id, 'relationshipType', value)}
                >
                  <SelectTrigger className="h-10 border-gray-300 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Contact Person">Contact Person</SelectItem>
                    <SelectItem value="CEO">CEO</SelectItem>
                    <SelectItem value="Manager">Manager</SelectItem>
                    <SelectItem value="Sales Rep">Sales Rep</SelectItem>
                    <SelectItem value="Support">Support</SelectItem>
                    <SelectItem value="Accountant">Accountant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Notes</label>
              <Input
                placeholder="Additional notes about this contact"
                value={block.data.notes}
                onChange={(e) => updateBlock(block.id, 'notes', e.target.value)}
                className="h-10 border-gray-300 rounded-lg"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 px-6 py-6">
      {/* Header with building icon and delete button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-gray-700" />
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditMode ? "Edit Company" : "Add New Company"}
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
        {/* Company Name - Fill Box Style */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Company Name <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Enter company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="h-12 border-2 border-gray-900 rounded-lg px-4 text-base font-medium focus:border-gray-900 focus:ring-0"
              required
            />
          </div>

          {/* Optional fields for legal name and industry */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Legal Name</label>
              <Input
                placeholder="Legal business name"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="h-10 border border-gray-300 rounded-lg px-3 focus:border-gray-500 focus:ring-0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Industry</label>
              <Input
                placeholder="e.g., Technology, Healthcare"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="h-10 border border-gray-300 rounded-lg px-3 focus:border-gray-500 focus:ring-0"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Description</label>
            <Textarea
              placeholder="Brief description of the company"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-20 border border-gray-300 rounded-lg px-3 py-2 focus:border-gray-500 focus:ring-0"
              rows={3}
            />
          </div>
        </div>

        {/* Dynamic Blocks Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Company Information</h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Add Info
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                {COMPANY_INFO_BLOCKS.map((blockType) => (
                  <DropdownMenuItem
                    key={blockType.id}
                    onClick={() => addBlock(blockType.id)}
                  >
                    <blockType.icon className="h-4 w-4 mr-2" />
                    {blockType.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Render blocks */}
          {blocks.map((block) => (
            <Card key={block.id} className="p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {block.type === 'relationship' ? 'Contact Person' : block.type}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeBlock(block.id)}
                  className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              {renderBlockEditor(block)}
            </Card>
          ))}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <Button 
            type="submit" 
            disabled={createCompanyMutation.isPending}
            className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2 rounded-lg"
          >
            {createCompanyMutation.isPending 
              ? (isEditMode ? "Updating..." : "Creating...") 
              : (isEditMode ? "Update Company" : "Create Company")
            }
          </Button>
        </div>
      </form>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this company? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Contact selector component for relationships
function ContactSelect({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) {
  const { data: contacts = [] } = useQuery({
    queryKey: ["/api/crm/contacts"],
  });

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-10 border-gray-300 rounded-lg">
        <SelectValue placeholder="Select contact" />
      </SelectTrigger>
      <SelectContent>
        {contacts.map((contact: any) => (
          <SelectItem key={contact.id} value={contact.id}>
            {contact.fullName || contact.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default CompanyFormBlocks;