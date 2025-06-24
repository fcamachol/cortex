import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Phone, Mail, MapPin, Calendar, Tag, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const contactFormSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  relationship: z.string().optional(),
  profilePictureUrl: z.string().optional(),
  notes: z.string().optional(),
  phones: z.array(z.object({
    phoneNumber: z.string().min(1, "Phone number is required"),
    label: z.string().optional(),
    isWhatsappLinked: z.boolean().default(false),
    isPrimary: z.boolean().default(false),
  })).optional(),
  emails: z.array(z.object({
    emailAddress: z.string().email("Invalid email address"),
    label: z.string().optional(),
    isPrimary: z.boolean().default(false),
  })).optional(),
  addresses: z.array(z.object({
    label: z.string().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    isPrimary: z.boolean().default(false),
  })).optional(),
  aliases: z.array(z.object({
    alias: z.string().min(1, "Alias is required"),
  })).optional(),
  specialDates: z.array(z.object({
    eventName: z.string().min(1, "Event name is required"),
    eventDate: z.string().min(1, "Event date is required"),
    reminderDaysBefore: z.number().default(7),
  })).optional(),
  interestIds: z.array(z.number()).optional(),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

interface ContactFormProps {
  userId: string;
  interests: any[];
  onSubmit: (data: ContactFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  initialData?: Partial<ContactFormData>;
}

export default function ContactForm({ 
  userId, 
  interests, 
  onSubmit, 
  onCancel, 
  isLoading = false,
  initialData 
}: ContactFormProps) {
  const [activeTab, setActiveTab] = useState("basic");
  
  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      fullName: "",
      relationship: "",
      profilePictureUrl: "",
      notes: "",
      phones: [{ phoneNumber: "", label: "Mobile", isWhatsappLinked: false, isPrimary: true }],
      emails: [],
      addresses: [],
      aliases: [],
      specialDates: [],
      interestIds: [],
      ...initialData,
    },
  });

  const relationshipOptions = [
    { value: "Family", label: "Family" },
    { value: "Friend", label: "Friend" },
    { value: "Client", label: "Client" },
    { value: "Business Partner", label: "Business Partner" },
    { value: "Colleague", label: "Colleague" },
    { value: "Vendor", label: "Vendor" },
    { value: "Other", label: "Other" },
  ];

  const phoneLabels = ["Mobile", "Work", "Home", "Fax", "Other"];
  const emailLabels = ["Personal", "Work", "Other"];
  const addressLabels = ["Home", "Work", "Billing", "Shipping", "Other"];

  // Dynamic field management functions
  const addPhone = () => {
    const currentPhones = form.getValues("phones") || [];
    form.setValue("phones", [...currentPhones, { phoneNumber: "", label: "Mobile", isWhatsappLinked: false, isPrimary: false }]);
  };

  const removePhone = (index: number) => {
    const currentPhones = form.getValues("phones") || [];
    form.setValue("phones", currentPhones.filter((_, i) => i !== index));
  };

  const addEmail = () => {
    const currentEmails = form.getValues("emails") || [];
    form.setValue("emails", [...currentEmails, { emailAddress: "", label: "Personal", isPrimary: false }]);
  };

  const removeEmail = (index: number) => {
    const currentEmails = form.getValues("emails") || [];
    form.setValue("emails", currentEmails.filter((_, i) => i !== index));
  };

  const addAddress = () => {
    const currentAddresses = form.getValues("addresses") || [];
    form.setValue("addresses", [...currentAddresses, { 
      label: "Home", street: "", city: "", state: "", postalCode: "", country: "", isPrimary: false 
    }]);
  };

  const removeAddress = (index: number) => {
    const currentAddresses = form.getValues("addresses") || [];
    form.setValue("addresses", currentAddresses.filter((_, i) => i !== index));
  };

  const addAlias = () => {
    const currentAliases = form.getValues("aliases") || [];
    form.setValue("aliases", [...currentAliases, { alias: "" }]);
  };

  const removeAlias = (index: number) => {
    const currentAliases = form.getValues("aliases") || [];
    form.setValue("aliases", currentAliases.filter((_, i) => i !== index));
  };

  const addSpecialDate = () => {
    const currentDates = form.getValues("specialDates") || [];
    form.setValue("specialDates", [...currentDates, { 
      eventName: "", eventDate: "", reminderDaysBefore: 7 
    }]);
  };

  const removeSpecialDate = (index: number) => {
    const currentDates = form.getValues("specialDates") || [];
    form.setValue("specialDates", currentDates.filter((_, i) => i !== index));
  };

  const handleSubmit = (data: ContactFormData) => {
    // Filter out empty arrays and clean data
    const cleanData = {
      ...data,
      phones: data.phones?.filter(p => p.phoneNumber.trim()) || [],
      emails: data.emails?.filter(e => e.emailAddress.trim()) || [],
      addresses: data.addresses?.filter(a => a.street?.trim() || a.city?.trim()) || [],
      aliases: data.aliases?.filter(a => a.alias.trim()) || [],
      specialDates: data.specialDates?.filter(d => d.eventName.trim() && d.eventDate.trim()) || [],
    };
    
    onSubmit(cleanData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="interests">Interests</TabsTrigger>
          </TabsList>

          {/* Basic Information Tab */}
          <TabsContent value="basic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Essential contact details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                          {relationshipOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Additional notes about this contact..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contact Information Tab */}
          <TabsContent value="contact" className="space-y-4">
            {/* Phone Numbers */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Phone Numbers
                    </CardTitle>
                    <CardDescription>Add multiple phone numbers</CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addPhone}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {form.watch("phones")?.map((_, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <FormField
                        control={form.control}
                        name={`phones.${index}.phoneNumber`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Phone number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`phones.${index}.label`}
                        render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {phoneLabels.map((label) => (
                                  <SelectItem key={label} value={label}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <div className="flex gap-2 items-center">
                        <FormField
                          control={form.control}
                          name={`phones.${index}.isWhatsappLinked`}
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="text-sm">WhatsApp</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`phones.${index}.isPrimary`}
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="text-sm">Primary</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removePhone(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Email Addresses */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email Addresses
                    </CardTitle>
                    <CardDescription>Add multiple email addresses</CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addEmail}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {form.watch("emails")?.map((_, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <FormField
                        control={form.control}
                        name={`emails.${index}.emailAddress`}
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormControl>
                              <Input placeholder="Email address" type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`emails.${index}.label`}
                        render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {emailLabels.map((label) => (
                                  <SelectItem key={label} value={label}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeEmail(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {form.watch("emails")?.length === 0 && (
                  <p className="text-sm text-gray-500">No email addresses added</p>
                )}
              </CardContent>
            </Card>

            {/* Addresses */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Addresses
                    </CardTitle>
                    <CardDescription>Add multiple addresses</CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addAddress}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {form.watch("addresses")?.map((_, index) => (
                  <div key={index} className="space-y-3 p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <FormField
                        control={form.control}
                        name={`addresses.${index}.label`}
                        render={({ field }) => (
                          <FormItem>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {addressLabels.map((label) => (
                                  <SelectItem key={label} value={label}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAddress(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <FormField
                        control={form.control}
                        name={`addresses.${index}.street`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Street address" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={form.control}
                          name={`addresses.${index}.city`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="City" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`addresses.${index}.state`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="State" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={form.control}
                          name={`addresses.${index}.postalCode`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="Postal code" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`addresses.${index}.country`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="Country" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {form.watch("addresses")?.length === 0 && (
                  <p className="text-sm text-gray-500">No addresses added</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Personal Information Tab */}
          <TabsContent value="personal" className="space-y-4">
            {/* Aliases */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Nicknames & Aliases
                    </CardTitle>
                    <CardDescription>Alternative names this person goes by</CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addAlias}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {form.watch("aliases")?.map((_, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <FormField
                      control={form.control}
                      name={`aliases.${index}.alias`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input placeholder="Nickname or alias" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAlias(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {form.watch("aliases")?.length === 0 && (
                  <p className="text-sm text-gray-500">No aliases added</p>
                )}
              </CardContent>
            </Card>

            {/* Special Dates */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Special Dates
                    </CardTitle>
                    <CardDescription>Birthdays, anniversaries, and other important dates</CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addSpecialDate}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {form.watch("specialDates")?.map((_, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <FormField
                        control={form.control}
                        name={`specialDates.${index}.eventName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Event name (e.g., Birthday)" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`specialDates.${index}.eventDate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`specialDates.${index}.reminderDaysBefore`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="Reminder days" 
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 7)}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSpecialDate(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {form.watch("specialDates")?.length === 0 && (
                  <p className="text-sm text-gray-500">No special dates added</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Interests Tab */}
          <TabsContent value="interests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Interests & Hobbies</CardTitle>
                <CardDescription>Select interests that apply to this contact</CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="interestIds"
                  render={({ field }) => (
                    <FormItem>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {interests.map((interest) => (
                          <div key={interest.interestId} className="flex items-center space-x-2">
                            <Checkbox
                              id={`interest-${interest.interestId}`}
                              checked={field.value?.includes(interest.interestId) || false}
                              onCheckedChange={(checked) => {
                                const currentValues = field.value || [];
                                if (checked) {
                                  field.onChange([...currentValues, interest.interestId]);
                                } else {
                                  field.onChange(currentValues.filter(id => id !== interest.interestId));
                                }
                              }}
                            />
                            <Label 
                              htmlFor={`interest-${interest.interestId}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {interest.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {interests.length === 0 && (
                  <p className="text-sm text-gray-500">No interests available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Contact"}
          </Button>
        </div>
      </form>
    </Form>
  );
}