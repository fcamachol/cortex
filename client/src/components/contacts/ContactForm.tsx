import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, ChevronDown, ChevronRight, User, Briefcase, Heart, Phone, Mail, FileText, X } from "lucide-react";

// Enhanced Contact Schema with all possible fields
const contactFormSchema = z.object({
  // Core information (always visible)
  fullName: z.string().min(1, "Full name is required"),
  primaryPhone: z.string().optional(),
  primaryEmail: z.string().email().optional().or(z.literal("")),
  relationship: z.string().optional(),
  
  // Professional context (collapsible)
  profession: z.string().optional(),
  specialty: z.string().optional(),
  company: z.string().optional(),
  roleAtCompany: z.string().optional(),
  
  // Personal context (collapsible)  
  aliases: z.string().optional(),
  interests: z.string().optional(),
  profilePictureUrl: z.string().url().optional().or(z.literal("")),
  
  // Notes (collapsible)
  notes: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

interface ContactFormProps {
  onSuccess?: () => void;
  ownerUserId: string;
  spaceId?: number;
}

export function ContactForm({ onSuccess, ownerUserId, spaceId }: ContactFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for collapsible sections
  const [isContactInfoOpen, setIsContactInfoOpen] = useState(false);
  const [isProfessionalOpen, setIsProfessionalOpen] = useState(false);
  const [isPersonalOpen, setIsPersonalOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  
  // State for managing notes
  const [notes, setNotes] = useState<Array<{ id: string; content: string; createdAt?: string }>>([]);
  
  // State for managing contact information
  const [phones, setPhones] = useState<Array<{ id: string; number: string; type: string; isPrimary?: boolean }>>([]);
  const [emails, setEmails] = useState<Array<{ id: string; address: string; type: string; isPrimary?: boolean }>>([]);
  const [addresses, setAddresses] = useState<Array<{ id: string; street: string; city: string; state: string; zipCode: string; country: string; type: string; isPrimary?: boolean }>>([]);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      fullName: "",
      primaryPhone: "",
      primaryEmail: "",
      relationship: "Client",
      profession: "",
      specialty: "",
      company: "",
      roleAtCompany: "",
      aliases: "",
      interests: "",
      profilePictureUrl: "",
      notes: "",
    },
  });

  const createContactMutation = useMutation({
    mutationFn: async (contactData: ContactFormData) => {
      // Clean the data - remove empty strings and format notes
      const cleanData = {
        ...contactData,
        ownerUserId,
        spaceId,
        notes: [
          contactData.primaryPhone ? `Primary phone: ${contactData.primaryPhone}` : null,
          contactData.primaryEmail ? `Primary email: ${contactData.primaryEmail}` : null,
          contactData.notes || null
        ].filter(Boolean).join('\n') || undefined,
      };
      
      const response = await apiRequest('POST', '/api/crm/contacts', cleanData);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/contacts'] });
      form.reset();
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

  const onSubmit = (data: ContactFormData) => {
    createContactMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Core Information - Always Visible */}
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
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
                      <SelectItem value="Colleague">Colleague</SelectItem>
                      <SelectItem value="Business Partner">Business Partner</SelectItem>
                      <SelectItem value="Vendor">Vendor</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Contact Information - Collapsible */}
          <Collapsible open={isContactInfoOpen} onOpenChange={setIsContactInfoOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-start p-0 h-auto font-normal text-left"
                type="button"
              >
                <div className="flex items-center gap-2 py-3 px-1">
                  {isContactInfoOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Phone className="h-4 w-4" />
                  <span className="font-medium">Contact Information</span>
                  {(phones.length > 0 || emails.length > 0 || addresses.length > 0) && (
                    <span className="text-xs text-muted-foreground">
                      ({phones.length + emails.length + addresses.length})
                    </span>
                  )}
                  {!isContactInfoOpen && (
                    <Plus className="h-4 w-4 ml-auto text-blue-600" />
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-6 pl-6 pt-2">
              {/* Phones */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Phone Numbers</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addPhone}
                    type="button"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Phone
                  </Button>
                </div>
                {phones.map((phone, index) => (
                  <div key={phone.id} className="border rounded-lg p-3 bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Phone {index + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePhone(phone.id)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        type="button"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Input
                        placeholder="+1 (555) 123-4567"
                        value={phone.number}
                        onChange={(e) => updatePhone(phone.id, 'number', e.target.value)}
                      />
                      <Select
                        value={phone.type}
                        onValueChange={(value) => updatePhone(phone.id, 'type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mobile">Mobile</SelectItem>
                          <SelectItem value="Home">Home</SelectItem>
                          <SelectItem value="Work">Work</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`phone-primary-${phone.id}`}
                          checked={phone.isPrimary || false}
                          onChange={(e) => updatePhone(phone.id, 'isPrimary', e.target.checked)}
                          className="rounded"
                        />
                        <label htmlFor={`phone-primary-${phone.id}`} className="text-xs">Primary</label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Emails */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Email Addresses</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addEmail}
                    type="button"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Email
                  </Button>
                </div>
                {emails.map((email, index) => (
                  <div key={email.id} className="border rounded-lg p-3 bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Email {index + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEmail(email.id)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        type="button"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Input
                        placeholder="email@example.com"
                        value={email.address}
                        onChange={(e) => updateEmail(email.id, 'address', e.target.value)}
                      />
                      <Select
                        value={email.type}
                        onValueChange={(value) => updateEmail(email.id, 'type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Personal">Personal</SelectItem>
                          <SelectItem value="Work">Work</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`email-primary-${email.id}`}
                          checked={email.isPrimary || false}
                          onChange={(e) => updateEmail(email.id, 'isPrimary', e.target.checked)}
                          className="rounded"
                        />
                        <label htmlFor={`email-primary-${email.id}`} className="text-xs">Primary</label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Addresses */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Addresses</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addAddress}
                    type="button"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Address
                  </Button>
                </div>
                {addresses.map((address, index) => (
                  <div key={address.id} className="border rounded-lg p-3 bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Address {index + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAddress(address.id)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        type="button"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Input
                        placeholder="Street Address"
                        value={address.street}
                        onChange={(e) => updateAddress(address.id, 'street', e.target.value)}
                      />
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <Input
                          placeholder="City"
                          value={address.city}
                          onChange={(e) => updateAddress(address.id, 'city', e.target.value)}
                        />
                        <Input
                          placeholder="State"
                          value={address.state}
                          onChange={(e) => updateAddress(address.id, 'state', e.target.value)}
                        />
                        <Input
                          placeholder="ZIP"
                          value={address.zipCode}
                          onChange={(e) => updateAddress(address.id, 'zipCode', e.target.value)}
                        />
                        <Input
                          placeholder="Country"
                          value={address.country}
                          onChange={(e) => updateAddress(address.id, 'country', e.target.value)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Select
                          value={address.type}
                          onValueChange={(value) => updateAddress(address.id, 'type', value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Home">Home</SelectItem>
                            <SelectItem value="Work">Work</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`address-primary-${address.id}`}
                            checked={address.isPrimary || false}
                            onChange={(e) => updateAddress(address.id, 'isPrimary', e.target.checked)}
                            className="rounded"
                          />
                          <label htmlFor={`address-primary-${address.id}`} className="text-xs">Primary</label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Professional Information - Collapsible */}
          <Collapsible open={isProfessionalOpen} onOpenChange={setIsProfessionalOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-start p-0 h-auto font-normal text-left"
                type="button"
              >
                <div className="flex items-center gap-2 py-3 px-1">
                  {isProfessionalOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Briefcase className="h-4 w-4" />
                  <span className="font-medium">Professional Information</span>
                  {!isProfessionalOpen && (
                    <Plus className="h-4 w-4 ml-auto text-blue-600" />
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pl-6 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="profession"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profession</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Software Engineer" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="specialty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specialty</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., React Development" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl>
                        <Input placeholder="Company name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="roleAtCompany"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role at Company</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Senior Developer" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Personal Information - Collapsible */}
          <Collapsible open={isPersonalOpen} onOpenChange={setIsPersonalOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-start p-0 h-auto font-normal text-left"
                type="button"
              >
                <div className="flex items-center gap-2 py-3 px-1">
                  {isPersonalOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Heart className="h-4 w-4" />
                  <span className="font-medium">Personal Information</span>
                  {!isPersonalOpen && (
                    <Plus className="h-4 w-4 ml-auto text-blue-600" />
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pl-6 pt-2">
              <FormField
                control={form.control}
                name="aliases"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aliases / Nicknames</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Johnny, JD" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interests</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., Photography, Travel, Cooking" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="profilePictureUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile Picture URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/photo.jpg" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Notes - Collapsible */}
          <Collapsible open={isNotesOpen} onOpenChange={setIsNotesOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-start p-0 h-auto font-normal text-left"
                type="button"
              >
                <div className="flex items-center gap-2 py-3 px-1">
                  {isNotesOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <User className="h-4 w-4" />
                  <span className="font-medium">Additional Notes</span>
                  {!isNotesOpen && (
                    <Plus className="h-4 w-4 ml-auto text-blue-600" />
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pl-6 pt-2">
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Additional notes about this contact..."
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Add More Information Sections */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Plus className="h-4 w-4" />
              <span>Click the sections above to add more information</span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button 
              type="submit"
              className="w-full"
              disabled={createContactMutation.isPending}
            >
              {createContactMutation.isPending ? "Creating Contact..." : "Create Contact"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}