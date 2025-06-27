import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, User, Search, CalendarIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Enhanced loan schema using unified entity IDs
const loanSchema = z.object({
  spaceId: z.number(),
  principalAmount: z.string().min(1, "Principal amount is required"),
  interestRate: z.string().min(1, "Interest rate is required"),
  interestType: z.enum(["simple", "compound"]).default("simple"),
  startDate: z.string().min(1, "Start date is required"),
  termMonths: z.number().min(1, "Term in months is required"),
  paymentFrequency: z.enum(["weekly", "bi-weekly", "monthly", "quarterly", "annually"]).default("monthly"),
  purpose: z.string().optional(),
  collateral: z.string().optional(),
  status: z.enum(["active", "paid", "defaulted"]).default("active"),
  lenderEntityId: z.string().optional(), // Unified entity UUID (cp_ or cc_ prefixed)
  borrowerEntityId: z.string().optional(), // Unified entity UUID (cp_ or cc_ prefixed)
  moratoryInterestRate: z.string().optional(),
  moratoryInterestPeriod: z.enum(["daily", "monthly", "yearly"]).optional(),
});

type LoanFormData = z.infer<typeof loanSchema>;

interface EnhancedLoanFormProps {
  spaceId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
  editingLoan?: any;
}

export function EnhancedLoanForm({ spaceId, onSuccess, onCancel, editingLoan }: EnhancedLoanFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Lender selection state
  const [lenderSearchTerm, setLenderSearchTerm] = useState("");
  const [selectedLender, setSelectedLender] = useState<{
    id: string; // Will convert from integer during transition
    name: string;
    type: "contact" | "company";
  } | null>(null);
  
  // Borrower selection state
  const [borrowerSearchTerm, setBorrowerSearchTerm] = useState("");
  const [selectedBorrower, setSelectedBorrower] = useState<{
    id: string; // Will convert from integer during transition
    name: string;
    type: "contact" | "company";
  } | null>(null);

  // Fetch contacts for selection
  const { data: contacts = [] } = useQuery({
    queryKey: ["/api/contacts", spaceId],
    enabled: !!spaceId,
  });

  // Fetch companies for selection
  const { data: companies = [] } = useQuery({
    queryKey: ["/api/crm/companies", spaceId],
    queryFn: () => apiRequest("GET", `/api/crm/companies?spaceId=${spaceId}`),
    enabled: !!spaceId,
  });

  const form = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      spaceId,
      principalAmount: editingLoan?.principalAmount || "",
      interestRate: editingLoan?.interestRate || "",
      interestType: editingLoan?.interestType || "simple",
      startDate: editingLoan?.startDate || new Date().toISOString().split('T')[0],
      termMonths: editingLoan?.termMonths || 12,
      paymentFrequency: editingLoan?.paymentFrequency || "monthly",
      purpose: editingLoan?.purpose || "",
      collateral: editingLoan?.collateral || "",
      status: editingLoan?.status || "active",
      lenderEntityId: editingLoan?.lenderEntityId,
      borrowerEntityId: editingLoan?.borrowerEntityId,
      moratoryInterestRate: editingLoan?.moratoryInterestRate || "",
      moratoryInterestPeriod: editingLoan?.moratoryInterestPeriod || "monthly",
    },
  });

  const createLoanMutation = useMutation({
    mutationFn: (data: LoanFormData) => 
      apiRequest("POST", "/api/finance/loans", {
        ...data,
        lenderEntityId: selectedLender?.id,
        borrowerEntityId: selectedBorrower?.id,
        principalAmount: parseFloat(data.principalAmount),
        interestRate: parseFloat(data.interestRate),
        moratoryInterestRate: data.moratoryInterestRate ? parseFloat(data.moratoryInterestRate) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/loans"] });
      toast({
        title: "Success",
        description: "Loan created successfully",
      });
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create loan",
        variant: "destructive",
      });
    },
  });

  const updateLoanMutation = useMutation({
    mutationFn: (data: LoanFormData) =>
      apiRequest("PUT", `/api/finance/loans/${editingLoan?.loanId}`, {
        ...data,
        lenderEntityId: selectedLender?.id,
        borrowerEntityId: selectedBorrower?.id,
        principalAmount: parseFloat(data.principalAmount),
        interestRate: parseFloat(data.interestRate),
        moratoryInterestRate: data.moratoryInterestRate ? parseFloat(data.moratoryInterestRate) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/loans"] });
      toast({
        title: "Success",
        description: "Loan updated successfully",
      });
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update loan",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoanFormData) => {
    if (editingLoan) {
      updateLoanMutation.mutate(data);
    } else {
      createLoanMutation.mutate(data);
    }
  };

  // Filter and combine contacts and companies for search
  const getSearchOptions = (searchTerm: string) => {
    const filteredContacts = Array.isArray(contacts) ? contacts.filter((contact: any) =>
      `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    const filteredCompanies = Array.isArray(companies) ? companies.filter((company: any) =>
      (company.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (company.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    return [
      ...filteredContacts.map((contact: any) => ({
        id: String(contact.contactId), // Convert to string for compatibility
        name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Unnamed Contact',
        type: 'contact' as const,
        email: contact.email,
      })),
      ...filteredCompanies.map((company: any) => ({
        id: String(company.companyId), // Convert to string for compatibility
        name: company.companyName || 'Unnamed Company',
        type: 'company' as const,
        email: company.email,
      })),
    ];
  };

  const ContactSearchComponent = ({ 
    title, 
    searchTerm, 
    setSearchTerm, 
    selectedEntity, 
    setSelectedEntity 
  }: {
    title: string;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    selectedEntity: { id: number; name: string; type: "contact" | "company" } | null;
    setSelectedEntity: (entity: { id: number; name: string; type: "contact" | "company" } | null) => void;
  }) => (
    <div className="space-y-3">
      <FormLabel>{title}</FormLabel>
      
      {selectedEntity ? (
        <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
          {selectedEntity.type === "company" ? (
            <Building2 className="h-4 w-4 text-blue-600" />
          ) : (
            <User className="h-4 w-4 text-green-600" />
          )}
          <span className="font-medium">{selectedEntity.name}</span>
          <Badge variant={selectedEntity.type === "company" ? "default" : "secondary"}>
            {selectedEntity.type === "company" ? "Company" : "Contact"}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelectedEntity(null)}
            className="ml-auto"
          >
            Change
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search Contacts & Companies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {searchTerm && (
            <div className="max-h-48 overflow-y-auto border rounded-lg bg-white dark:bg-gray-800">
              {getSearchOptions(searchTerm).map((option) => (
                <button
                  key={`${option.type}-${option.id}`}
                  type="button"
                  onClick={() => {
                    setSelectedEntity(option);
                    setSearchTerm("");
                  }}
                  className="flex items-center gap-3 w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b last:border-b-0"
                >
                  {option.type === "company" ? (
                    <Building2 className="h-4 w-4 text-blue-600" />
                  ) : (
                    <User className="h-4 w-4 text-green-600" />
                  )}
                  <div>
                    <div className="font-medium">{option.name}</div>
                    {option.email && (
                      <div className="text-sm text-gray-500">{option.email}</div>
                    )}
                  </div>
                  <Badge variant={option.type === "company" ? "default" : "secondary"} className="ml-auto">
                    {option.type === "company" ? "Company" : "Contact"}
                  </Badge>
                </button>
              ))}
              {getSearchOptions(searchTerm).length === 0 && (
                <div className="p-3 text-center text-gray-500">
                  No matching contacts or companies found
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {editingLoan ? "Edit Loan" : "Create New Loan"}
        </h3>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Lender Section */}
          <ContactSearchComponent
            title="Lender"
            searchTerm={lenderSearchTerm}
            setSearchTerm={setLenderSearchTerm}
            selectedEntity={selectedLender}
            setSelectedEntity={setSelectedLender}
          />

          {/* Borrower Section */}
          <ContactSearchComponent
            title="Borrower"
            searchTerm={borrowerSearchTerm}
            setSearchTerm={setBorrowerSearchTerm}
            selectedEntity={selectedBorrower}
            setSelectedEntity={setSelectedBorrower}
          />

          {/* Divider */}
          <div className="border-t border-dashed border-gray-300 dark:border-gray-600"></div>

          {/* Principal Amount and Interest Rate */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="principalAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Principal Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="interestRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Interest Rate (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Interest Type and Term/Payment Frequency */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="interestType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Interés Simple o Compuesto</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="simple">Simple</SelectItem>
                      <SelectItem value="compound">Compound</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name="termMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Term (Months)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="12"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Frequency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Monthly" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annually">Annually</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Start Date */}
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input type="date" {...field} />
                    <CalendarIcon className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Purpose */}
          <FormField
            control={form.control}
            name="purpose"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purpose</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select purpose..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="home">Home</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="investment">Investment</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Collateral */}
          <FormField
            control={form.control}
            name="collateral"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Collateral (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter collateral description..."
                    className="resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Moratory Interests Module */}
          <div className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20">
            <h4 className="text-sm font-medium mb-3 text-yellow-800 dark:text-yellow-200">Moratory Interests</h4>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="moratoryInterestRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moratory Interest Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="2.50"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="moratoryInterestPeriod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moratory Period</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select period" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <Button
              type="submit"
              disabled={createLoanMutation.isPending || updateLoanMutation.isPending}
              className="px-8"
            >
              Create Loan
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}