import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, X, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const companyFormSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  businessType: z.string().optional(),
  taxId: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  industry: z.string().optional(),
  description: z.string().optional(),
  phoneNumbers: z.array(z.object({
    phoneNumber: z.string().min(1, "Phone number is required"),
    label: z.string().optional(),
    isPrimary: z.boolean().default(false),
  })).default([]),
  emails: z.array(z.object({
    emailAddress: z.string().email("Invalid email").min(1, "Email is required"),
    label: z.string().optional(),
    isPrimary: z.boolean().default(false),
  })).default([]),
  addresses: z.array(z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    label: z.string().optional(),
    isPrimary: z.boolean().default(false),
  })).default([]),
});

type CompanyFormData = z.infer<typeof companyFormSchema>;

interface CompanyFormProps {
  isOpen: boolean;
  onClose: () => void;
  company?: any;
  spaceId: string;
}

export default function CompanyForm({ isOpen, onClose, company, spaceId }: CompanyFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: company ? {
      companyName: company.companyName || "",
      businessType: company.businessType || "",
      taxId: company.taxId || "",
      website: company.website || "",
      industry: company.industry || "",
      description: company.description || "",
      phoneNumbers: company.phoneNumbers || [],
      emails: company.emails || [],
      addresses: company.addresses || [],
    } : {
      companyName: "",
      businessType: "",
      taxId: "",
      website: "",
      industry: "",
      description: "",
      phoneNumbers: [],
      emails: [],
      addresses: [],
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      const endpoint = company ? `/api/crm/companies/${company.companyId}` : "/api/crm/companies";
      const method = company ? "PUT" : "POST";
      return await apiRequest(method, endpoint, { ...data, spaceId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/companies"] });
      toast({
        title: company ? "Company Updated" : "Company Created",
        description: `${form.getValues("companyName")} has been ${company ? "updated" : "created"} successfully.`,
      });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save company",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CompanyFormData) => {
    createCompanyMutation.mutate(data);
  };

  const addPhoneNumber = () => {
    const currentPhones = form.getValues("phoneNumbers");
    form.setValue("phoneNumbers", [...currentPhones, { phoneNumber: "", label: "", isPrimary: false }]);
  };

  const removePhoneNumber = (index: number) => {
    const currentPhones = form.getValues("phoneNumbers");
    form.setValue("phoneNumbers", currentPhones.filter((_, i) => i !== index));
  };

  const addEmail = () => {
    const currentEmails = form.getValues("emails");
    form.setValue("emails", [...currentEmails, { emailAddress: "", label: "", isPrimary: false }]);
  };

  const removeEmail = (index: number) => {
    const currentEmails = form.getValues("emails");
    form.setValue("emails", currentEmails.filter((_, i) => i !== index));
  };

  const addAddress = () => {
    const currentAddresses = form.getValues("addresses");
    form.setValue("addresses", [...currentAddresses, { 
      street: "", city: "", state: "", postalCode: "", country: "", label: "", isPrimary: false 
    }]);
  };

  const removeAddress = (index: number) => {
    const currentAddresses = form.getValues("addresses");
    form.setValue("addresses", currentAddresses.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {company ? "Edit Company" : "Add New Company"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Magabar" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select business type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="corporation">Corporation</SelectItem>
                            <SelectItem value="llc">LLC</SelectItem>
                            <SelectItem value="partnership">Partnership</SelectItem>
                            <SelectItem value="sole_proprietorship">Sole Proprietorship</SelectItem>
                            <SelectItem value="nonprofit">Non-Profit</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="taxId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax ID / EIN</FormLabel>
                        <FormControl>
                          <Input placeholder="Tax identification number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input placeholder="https://www.company.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Technology, Healthcare" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Brief description of the company" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Phone Numbers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Phone Numbers
                  <Button type="button" variant="outline" size="sm" onClick={addPhoneNumber}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Phone
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {form.watch("phoneNumbers").map((_, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <FormField
                      control={form.control}
                      name={`phoneNumbers.${index}.phoneNumber`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input placeholder="Phone number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`phoneNumbers.${index}.label`}
                      render={({ field }) => (
                        <FormItem className="w-32">
                          <FormControl>
                            <Input placeholder="Label" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removePhoneNumber(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Email Addresses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Email Addresses
                  <Button type="button" variant="outline" size="sm" onClick={addEmail}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Email
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {form.watch("emails").map((_, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <FormField
                      control={form.control}
                      name={`emails.${index}.emailAddress`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input placeholder="Email address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`emails.${index}.label`}
                      render={({ field }) => (
                        <FormItem className="w-32">
                          <FormControl>
                            <Input placeholder="Label" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeEmail(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Addresses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Addresses
                  <Button type="button" variant="outline" size="sm" onClick={addAddress}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Address
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {form.watch("addresses").map((_, index) => (
                  <div key={index} className="border rounded-lg p-4 mb-4">
                    <div className="flex justify-between items-center mb-3">
                      <FormField
                        control={form.control}
                        name={`addresses.${index}.label`}
                        render={({ field }) => (
                          <FormItem className="w-32">
                            <FormControl>
                              <Input placeholder="Label" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeAddress(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <FormField
                        control={form.control}
                        name={`addresses.${index}.street`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormControl>
                              <Input placeholder="Street address" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
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
                              <Input placeholder="State/Province" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`addresses.${index}.postalCode`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Postal Code" {...field} />
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
                ))}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCompanyMutation.isPending}>
                {createCompanyMutation.isPending ? "Saving..." : company ? "Update Company" : "Create Company"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}