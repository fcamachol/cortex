import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ChevronDown, ChevronRight, Plus, Building2, User, Phone, Mail, Briefcase, Heart, FileText } from "lucide-react";

// Phase 1: Quick capture schema - Only name is required per user spec
const quickContactSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  primaryPhone: z.string().optional(),
  primaryEmail: z.string().optional(),
  relationship: z.string().optional(),
});

// Phase 2: Detailed contact schema
const detailedContactSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  relationship: z.string().optional(),
  profilePictureUrl: z.string().url().optional().or(z.literal("")),
  
  // Professional context
  profession: z.string().optional(),
  specialty: z.string().optional(),
  company: z.string().optional(),
  roleAtCompany: z.string().optional(),
  
  // Personal context
  aliases: z.string().optional(),
  interests: z.string().optional(),
  
  notes: z.string().optional(),
});

type QuickContactFormData = z.infer<typeof quickContactSchema>;
type DetailedContactFormData = z.infer<typeof detailedContactSchema>;

interface ContactFormProps {
  onSuccess?: () => void;
  ownerUserId: string;
  spaceId?: number;
  mode?: 'quick' | 'detailed';
}

export function ContactForm({ onSuccess, ownerUserId, spaceId, mode = 'quick' }: ContactFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentPhase, setCurrentPhase] = useState<'quick' | 'detailed'>(mode);
  const [savedContactData, setSavedContactData] = useState<any>(null);
  
  // Collapsible sections state
  const [sectionsOpen, setSectionsOpen] = useState({
    professional: false,
    contact: false,
    personal: false,
    notes: false,
  });

  const quickForm = useForm<QuickContactFormData>({
    resolver: zodResolver(quickContactSchema),
    defaultValues: {
      fullName: "",
      primaryContact: "",
      relationship: "Client",
    },
  });

  const detailedForm = useForm<DetailedContactFormData>({
    resolver: zodResolver(detailedContactSchema),
    defaultValues: {
      fullName: "",
      relationship: "Client",
      profilePictureUrl: "",
      profession: "",
      specialty: "",
      company: "",
      roleAtCompany: "",
      aliases: "",
      interests: "",
      notes: "",
    },
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: any) => {
      const contactData = {
        ...data,
        ownerUserId,
        spaceId,
      };
      return await apiRequest('POST', '/api/crm/contacts', contactData);
    },
    onSuccess: (response) => {
      setSavedContactData(response);
      toast({
        title: "Success",
        description: "Contact created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      
      if (currentPhase === 'quick') {
        quickForm.reset();
      } else {
        detailedForm.reset();
      }
      
      if (currentPhase === 'detailed' || !response.contactId) {
        onSuccess?.();
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

  const onQuickSubmit = (data: QuickContactFormData) => {
    const contactData = {
      fullName: data.fullName,
      relationship: data.relationship,
      notes: [
        data.primaryPhone ? `Primary phone: ${data.primaryPhone}` : null,
        data.primaryEmail ? `Primary email: ${data.primaryEmail}` : null
      ].filter(Boolean).join('\n') || undefined,
    };
    createContactMutation.mutate(contactData);
  };

  const onSaveAndAddDetails = (data: QuickContactFormData) => {
    const contactData = {
      fullName: data.fullName,
      relationship: data.relationship,
      notes: [
        data.primaryPhone ? `Primary phone: ${data.primaryPhone}` : null,
        data.primaryEmail ? `Primary email: ${data.primaryEmail}` : null
      ].filter(Boolean).join('\n') || undefined,
    };
    
    createContactMutation.mutate(contactData);
    
    // After successful creation, switch to detailed view
    setTimeout(() => {
      if (savedContactData) {
        setCurrentPhase('detailed');
        detailedForm.setValue('fullName', data.fullName);
        detailedForm.setValue('relationship', data.relationship || 'Client');
        detailedForm.setValue('notes', [
          data.primaryPhone ? `Primary phone: ${data.primaryPhone}` : null,
          data.primaryEmail ? `Primary email: ${data.primaryEmail}` : null
        ].filter(Boolean).join('\n') || '');
      }
    }, 1000);
  };

  const onDetailedSubmit = (data: DetailedContactFormData) => {
    createContactMutation.mutate(data);
  };

  const toggleSection = (section: keyof typeof sectionsOpen) => {
    setSectionsOpen(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  if (currentPhase === 'quick') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Add New Contact</h2>
          <p className="text-sm text-muted-foreground">Only a name is required to create a contact profile</p>
        </div>

        <Form {...quickForm}>
          <form onSubmit={quickForm.handleSubmit(onQuickSubmit)} className="space-y-4">
            <FormField
              control={quickForm.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name*</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter full name..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={quickForm.control}
                name="primaryPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="+52 123 456 7890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={quickForm.control}
                name="primaryEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Email (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="contact@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={quickForm.control}
              name="relationship"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relationship</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Client">Client</SelectItem>
                      <SelectItem value="Family">Family</SelectItem>
                      <SelectItem value="Friend">Friend</SelectItem>
                      <SelectItem value="Vendor">Vendor</SelectItem>
                      <SelectItem value="Colleague">Colleague</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button 
                type="submit" 
                variant="outline"
                className="flex-1"
                disabled={createContactMutation.isPending}
              >
                {createContactMutation.isPending ? "Saving..." : "Save & Close"}
              </Button>
              <Button 
                type="button"
                onClick={quickForm.handleSubmit(onSaveAndAddDetails)}
                className="flex-1"
                disabled={createContactMutation.isPending}
              >
                Save & Add Details ▸
              </Button>
            </div>
          </form>
        </Form>
      </div>
    );
  }

  // Detailed Phase
  return (
    <div className="space-y-6 max-h-[80vh] overflow-y-auto">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Editing Contact: {detailedForm.watch('fullName') || 'New Contact'}</h2>
      </div>

      <Form {...detailedForm}>
        <form onSubmit={detailedForm.handleSubmit(onDetailedSubmit)} className="space-y-6">
          
          {/* Basic Information */}
          <div className="space-y-4">
            <FormField
              control={detailedForm.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={detailedForm.control}
              name="relationship"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relationship</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select relationship type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Client">Client</SelectItem>
                      <SelectItem value="Family">Family</SelectItem>
                      <SelectItem value="Friend">Friend</SelectItem>
                      <SelectItem value="Vendor">Vendor</SelectItem>
                      <SelectItem value="Colleague">Colleague</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={detailedForm.control}
              name="profilePictureUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profile Picture URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/image.jpg" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          {/* Add Additional Information Header */}
          <div className="text-center py-4 border-t">
            <h3 className="text-lg font-semibold mb-2">Add Additional Information</h3>
            <p className="text-sm text-muted-foreground">
              Expand any section below to add more details to this contact profile
            </p>
          </div>

          {/* Professional Context */}
          <Collapsible open={sectionsOpen.professional} onOpenChange={() => toggleSection('professional')}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-4 h-auto border rounded-lg hover:bg-accent">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  <span className="font-medium">Professional Context</span>
                </div>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4 space-y-4 border-l-2 border-primary/20 ml-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={detailedForm.control}
                  name="profession"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profession</FormLabel>
                      <FormControl>
                        <Input placeholder="Doctor" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={detailedForm.control}
                  name="specialty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specialty / Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Cardiologist" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={detailedForm.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input placeholder="🏢 Hospital..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={detailedForm.control}
                  name="roleAtCompany"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role at Company</FormLabel>
                      <FormControl>
                        <Input placeholder="Head of Cardio..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Contact Details */}
          <Collapsible open={sectionsOpen.contact} onOpenChange={() => toggleSection('contact')}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-4 h-auto border rounded-lg hover:bg-accent">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  <span className="font-medium">Contact Details</span>
                </div>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4 space-y-4 border-l-2 border-primary/20 ml-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Phone Numbers</Label>
                  <Button type="button" variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" /> Add Phone
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 border rounded">
                    <Phone className="h-4 w-4" />
                    <span className="text-sm">Mobile: +52... ✓ Has WhatsApp (Primary)</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Emails</Label>
                  <Button type="button" variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" /> Add Email
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 border rounded">
                    <Mail className="h-4 w-4" />
                    <span className="text-sm">Work: contact@email.com (Primary)</span>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Personal Context */}
          <Collapsible open={sectionsOpen.personal} onOpenChange={() => toggleSection('personal')}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-4 h-auto border rounded-lg hover:bg-accent">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  <span className="font-medium">Personal Context</span>
                </div>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4 space-y-4 border-l-2 border-primary/20 ml-4">
              <FormField
                control={detailedForm.control}
                name="aliases"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aliases / Nicknames</FormLabel>
                    <FormControl>
                      <Input placeholder="Add a nickname..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={detailedForm.control}
                name="interests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interests</FormLabel>
                    <FormControl>
                      <Input placeholder="Add an interest..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Special Dates</Label>
                  <Button type="button" variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" /> Add Date
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  Birthday: August 15, 1980
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Context Notes */}
          <Collapsible open={sectionsOpen.notes} onOpenChange={() => toggleSection('notes')}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-4 h-auto border rounded-lg hover:bg-accent">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span className="font-medium">Context Notes</span>
                </div>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4 border-l-2 border-primary/20 ml-4">
              <FormField
                control={detailedForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea 
                        placeholder="Type any other notes here..."
                        className="resize-none"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CollapsibleContent>
          </Collapsible>

          <div className="pt-4">
            <Button 
              type="submit" 
              className="w-full"
              disabled={createContactMutation.isPending}
            >
              {createContactMutation.isPending ? "Saving..." : "Save & Close"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}