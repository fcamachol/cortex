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
import { Plus, ChevronDown, ChevronRight, User, Briefcase, Heart, Phone, Mail, FileText, X, Trash2, MapPin, Building2, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";

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
  const [isSpecialDatesOpen, setIsSpecialDatesOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  
  // State for managing notes
  const [notes, setNotes] = useState<Array<{ id: string; title: string; content: string; createdAt?: string }>>([]);
  
  // State for managing contact information
  const [phones, setPhones] = useState<Array<{ id: string; number: string; type: string; isPrimary?: boolean }>>([]);
  const [emails, setEmails] = useState<Array<{ id: string; address: string; type: string; isPrimary?: boolean }>>([]);
  const [addresses, setAddresses] = useState<Array<{ id: string; street: string; city: string; state: string; zipCode: string; country: string; type: string; isPrimary?: boolean }>>([]);
  const [specialDates, setSpecialDates] = useState<Array<{ id: string; title: string; date: string; type: string }>>([]);

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

  // Functions for managing phones
  const addPhone = () => {
    const newPhone = {
      id: Date.now().toString(),
      number: "",
      type: "Mobile",
      isPrimary: phones.length === 0,
    };
    setPhones([...phones, newPhone]);
    setIsContactInfoOpen(true);
  };

  const updatePhone = (id: string, field: string, value: string | boolean) => {
    setPhones(phones.map(phone => 
      phone.id === id ? { ...phone, [field]: value } : phone
    ));
  };

  const removePhone = (id: string) => {
    setPhones(phones.filter(phone => phone.id !== id));
  };

  // Functions for managing emails
  const addEmail = () => {
    const newEmail = {
      id: Date.now().toString(),
      address: "",
      type: "Personal",
      isPrimary: emails.length === 0,
    };
    setEmails([...emails, newEmail]);
    setIsContactInfoOpen(true);
  };

  const updateEmail = (id: string, field: string, value: string | boolean) => {
    setEmails(emails.map(email => 
      email.id === id ? { ...email, [field]: value } : email
    ));
  };

  const removeEmail = (id: string) => {
    setEmails(emails.filter(email => email.id !== id));
  };

  // Functions for managing addresses
  const addAddress = () => {
    const newAddress = {
      id: Date.now().toString(),
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
      type: "Home",
      isPrimary: addresses.length === 0,
    };
    setAddresses([...addresses, newAddress]);
    setIsContactInfoOpen(true);
  };

  const updateAddress = (id: string, field: string, value: string | boolean) => {
    setAddresses(addresses.map(address => 
      address.id === id ? { ...address, [field]: value } : address
    ));
  };

  const removeAddress = (id: string) => {
    setAddresses(addresses.filter(address => address.id !== id));
  };

  // Functions for managing notes
  const addNote = () => {
    const newNote = {
      id: Date.now().toString(),
      title: "",
      content: "",
    };
    setNotes([...notes, newNote]);
    setIsNotesOpen(true);
  };

  const updateNote = (id: string, field: string, value: string) => {
    setNotes(notes.map(note => 
      note.id === id ? { ...note, [field]: value } : note
    ));
  };

  const removeNote = (id: string) => {
    setNotes(notes.filter(note => note.id !== id));
  };

  // Functions for managing special dates
  const addSpecialDate = () => {
    const newDate = {
      id: Date.now().toString(),
      title: "",
      date: "",
      type: "birthday", // default type
    };
    setSpecialDates([...specialDates, newDate]);
    setIsSpecialDatesOpen(true);
  };

  const updateSpecialDate = (id: string, field: string, value: string) => {
    setSpecialDates(specialDates.map(date => 
      date.id === id ? { ...date, [field]: value } : date
    ));
  };

  const removeSpecialDate = (id: string) => {
    setSpecialDates(specialDates.filter(date => date.id !== id));
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
          {/* Core Information - Always Visible */}
          <div className="space-y-3 pb-2">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium">Full Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter full name" {...field} className="h-8" />
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
                  <FormLabel className="text-sm font-medium">Relationship</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-8">
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

          {/* Contact Information - Minimalistic Notion-style */}
          <Collapsible open={isContactInfoOpen} onOpenChange={setIsContactInfoOpen}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                {isContactInfoOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <span>Contact Information</span>
                {!isContactInfoOpen && (phones.length > 0 || emails.length > 0 || addresses.length > 0) && (
                  <div className="flex items-center gap-1 ml-2">
                    {phones.length > 0 && <span className="text-xs">📞</span>}
                    {emails.length > 0 && <span className="text-xs">✉️</span>}
                    {addresses.length > 0 && <span className="text-xs">🏠</span>}
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    addPhone();
                  }}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                >
                  [+ Add Phone]
                </button>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 pt-1">
              <div className="border-l border-dashed border-muted-foreground/20 pl-4 space-y-2">
                {/* Primary Contact Fields */}
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="primaryPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Primary Phone</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="+1 (555) 123-4567" 
                            {...field} 
                            className="h-7 text-sm border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="primaryEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Primary Email</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="email@example.com" 
                            {...field} 
                            className="h-7 text-sm border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Phone Numbers */}
                {phones.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-medium">📞 Phone Numbers</div>
                    {phones.map((phone) => (
                      <div key={phone.id} className="flex items-center gap-2 py-1 text-sm group">
                        <Select
                          value={phone.type}
                          onValueChange={(value) => updatePhone(phone.id, "type", value)}
                        >
                          <SelectTrigger className="w-20 h-6 border-none bg-transparent text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Mobile">📱 Mobile</SelectItem>
                            <SelectItem value="Work">🏢 Work</SelectItem>
                            <SelectItem value="Home">🏠 Home</SelectItem>
                            <SelectItem value="Other">📞 Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-xs">:</span>
                        <Input
                          placeholder="+1 (555) 123-4567"
                          value={phone.number}
                          onChange={(e) => updatePhone(phone.id, "number", e.target.value)}
                          className="flex-1 h-6 border-none bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        {phone.isPrimary && <span className="text-xs text-blue-600">(Primary)</span>}
                        <button
                          type="button"
                          onClick={() => removePhone(phone.id)}
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Email Addresses */}
                {emails.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-medium">✉️ Email Addresses</div>
                    {emails.map((email) => (
                      <div key={email.id} className="flex items-center gap-2 py-1 text-sm group">
                        <Select
                          value={email.type}
                          onValueChange={(value) => updateEmail(email.id, "type", value)}
                        >
                          <SelectTrigger className="w-20 h-6 border-none bg-transparent text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Personal">👤 Personal</SelectItem>
                            <SelectItem value="Work">🏢 Work</SelectItem>
                            <SelectItem value="Other">✉️ Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-xs">:</span>
                        <Input
                          placeholder="email@example.com"
                          value={email.address}
                          onChange={(e) => updateEmail(email.id, "address", e.target.value)}
                          className="flex-1 h-6 border-none bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        {email.isPrimary && <span className="text-xs text-blue-600">(Primary)</span>}
                        <button
                          type="button"
                          onClick={() => removeEmail(email.id)}
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Addresses */}
                {addresses.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-medium">🏠 Addresses</div>
                    {addresses.map((address) => (
                      <div key={address.id} className="space-y-1 py-1 group">
                        <div className="flex items-center gap-2 text-sm">
                          <Select
                            value={address.type}
                            onValueChange={(value) => updateAddress(address.id, "type", value)}
                          >
                            <SelectTrigger className="w-16 h-6 border-none bg-transparent text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Home">🏠 Home</SelectItem>
                              <SelectItem value="Work">🏢 Work</SelectItem>
                              <SelectItem value="Other">📍 Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-xs">:</span>
                          <Input
                            placeholder="Street address"
                            value={address.street}
                            onChange={(e) => updateAddress(address.id, "street", e.target.value)}
                            className="flex-1 h-6 border-none bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                          {address.isPrimary && <span className="text-xs text-blue-600">(Primary)</span>}
                          <button
                            type="button"
                            onClick={() => removeAddress(address.id)}
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pl-6">
                          <Input
                            placeholder="City"
                            value={address.city}
                            onChange={(e) => updateAddress(address.id, "city", e.target.value)}
                            className="h-6 border-none bg-transparent p-0 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                          <Input
                            placeholder="State"
                            value={address.state}
                            onChange={(e) => updateAddress(address.id, "state", e.target.value)}
                            className="h-6 border-none bg-transparent p-0 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                          <Input
                            placeholder="ZIP"
                            value={address.zipCode}
                            onChange={(e) => updateAddress(address.id, "zipCode", e.target.value)}
                            className="h-6 border-none bg-transparent p-0 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={addPhone}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    [+ Add Phone]
                  </button>
                  <button
                    type="button"
                    onClick={addEmail}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    [+ Add Email]
                  </button>
                  <button
                    type="button"
                    onClick={addAddress}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    [+ Add Address]
                  </button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Professional Information - Minimalistic Notion-style */}
          <Collapsible open={isProfessionalOpen} onOpenChange={setIsProfessionalOpen}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                {isProfessionalOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <span>Professional</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsProfessionalOpen(true);
                  }}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                >
                  [+ Add]
                </button>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 pt-1">
              <div className="border-l border-dashed border-muted-foreground/20 pl-4 space-y-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="profession"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Profession</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Software Engineer" 
                            {...field} 
                            className="h-7 text-sm border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
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
                        <FormLabel className="text-xs text-muted-foreground">Specialty</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Frontend Development" 
                            {...field} 
                            className="h-7 text-sm border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Company</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Company name" 
                            {...field} 
                            className="h-7 text-sm border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
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
                        <FormLabel className="text-xs text-muted-foreground">Role at Company</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Job title" 
                            {...field} 
                            className="h-7 text-sm border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Personal Information - Minimalistic Notion-style */}
          <Collapsible open={isPersonalOpen} onOpenChange={setIsPersonalOpen}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                {isPersonalOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <span>Personal</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPersonalOpen(true);
                  }}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                >
                  [+ Add]
                </button>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 pt-1">
              <div className="border-l border-dashed border-muted-foreground/20 pl-4 space-y-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="aliases"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">Aliases/Nicknames</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Mike, Mickey" 
                            {...field} 
                            className="h-7 text-sm border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
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
                        <FormLabel className="text-xs text-muted-foreground">Interests/Hobbies</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Photography, Travel" 
                            {...field} 
                            className="h-7 text-sm border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="profilePictureUrl"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel className="text-xs text-muted-foreground">Profile Picture URL</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://example.com/photo.jpg" 
                            {...field} 
                            className="h-7 text-sm border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Special Dates - Minimalistic Notion-style */}
          <Collapsible open={isSpecialDatesOpen} onOpenChange={setIsSpecialDatesOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-start p-0 h-auto font-normal text-left hover:bg-transparent"
                type="button"
              >
                <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                  {isSpecialDatesOpen ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <span>Special Dates</span>
                  {!isSpecialDatesOpen && specialDates.length > 0 && (
                    <div className="flex items-center gap-1 ml-2">
                      {specialDates.slice(0, 2).map((date) => (
                        <span key={date.id} className="text-xs">
                          {date.type === 'birthday' ? '🎂' : date.type === 'anniversary' ? '❤️' : '📅'}
                        </span>
                      ))}
                      {specialDates.length > 2 && <span className="text-xs">+{specialDates.length - 2}</span>}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      addSpecialDate();
                    }}
                    className="ml-auto h-5 w-12 p-0 text-xs text-muted-foreground hover:text-foreground"
                  >
                    [+ Add Date]
                  </Button>
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 pt-1">
              <div className="border-l border-dashed border-muted-foreground/20 pl-4 space-y-1">
                {specialDates.map((specialDate) => (
                  <div key={specialDate.id} className="flex items-center gap-2 py-1 text-sm group">
                    <span className="text-base">
                      {specialDate.type === 'birthday' ? '🎂' : specialDate.type === 'anniversary' ? '❤️' : '📅'}
                    </span>
                    <span className="font-medium min-w-20">
                      {specialDate.type === 'birthday' ? 'Birthday:' : 
                       specialDate.type === 'anniversary' ? 'Anniversary:' : 
                       (specialDate.title || 'Date:')}
                    </span>
                    <Input
                      type="date"
                      value={specialDate.date}
                      onChange={(e) => updateSpecialDate(specialDate.id, "date", e.target.value)}
                      className="h-6 border-none bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 w-32"
                    />
                    {specialDate.type === 'other' && (
                      <Input
                        placeholder="Title"
                        value={specialDate.title}
                        onChange={(e) => updateSpecialDate(specialDate.id, "title", e.target.value)}
                        className="h-6 border-none bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 flex-1"
                      />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSpecialDate(specialDate.id)}
                      className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
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
                <div className="flex items-center gap-2 py-2 px-1">
                  {isNotesOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">Notes</span>
                  {notes.length > 0 && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                      {notes.length}
                    </span>
                  )}
                  {!isNotesOpen && (
                    <Plus className="h-4 w-4 ml-auto text-blue-600" />
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pl-6 pt-2">
              {notes.map((note) => (
                <Card key={note.id} className="p-3">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Title (e.g., Cuenta de banco)"
                        value={note.title}
                        onChange={(e) => updateNote(note.id, "title", e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeNote(note.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      placeholder="Content..."
                      value={note.content}
                      onChange={(e) => updateNote(note.id, "content", e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>
                </Card>
              ))}
              
              <Button
                type="button"
                variant="outline"
                onClick={addNote}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Note
              </Button>
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