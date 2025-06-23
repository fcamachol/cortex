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
import { Building2, User, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Enhanced loan schema matching the new design
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
  lenderContactId: z.number().optional(),
  lenderType: z.enum(["contact", "company"]).optional(),
  borrowerContactId: z.number().optional(),
  borrowerType: z.enum(["contact", "company"]).optional(),
  moratoryInterestRate: z.string().optional(),
  moratoryInterestPeriod: z.enum(["daily", "monthly", "yearly"]).optional(),
});

type LoanFormData = z.infer<typeof loanSchema>;

interface PolymorphicLoanFormProps {
  spaceId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
  editingLoan?: any;
}

export function PolymorphicLoanForm({ spaceId, onSuccess, onCancel, editingLoan }: PolymorphicLoanFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lenderSearchTerm, setLenderSearchTerm] = useState("");
  const [selectedLender, setSelectedLender] = useState<{
    id: number;
    name: string;
    type: "contact" | "company";
  } | null>(null);
  const [borrowerSearchTerm, setBorrowerSearchTerm] = useState("");
  const [selectedBorrower, setSelectedBorrower] = useState<{
    id: number;
    name: string;
    type: "contact" | "company";
  } | null>(null);

  // Fetch contacts for creditor selection
  const { data: contacts = [] } = useQuery({
    queryKey: ["/api/contacts", spaceId],
    enabled: !!spaceId,
  });

  // Fetch companies for creditor selection
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
      lenderContactId: editingLoan?.lenderContactId,
      lenderType: editingLoan?.lenderType,
      borrowerContactId: editingLoan?.borrowerContactId,
      borrowerType: editingLoan?.borrowerType,
      moratoryInterestRate: editingLoan?.moratoryInterestRate || "",
      moratoryInterestPeriod: editingLoan?.moratoryInterestPeriod || "monthly",
    },
  });

  const createLoanMutation = useMutation({
    mutationFn: (data: LoanFormData) => 
      apiRequest("POST", "/api/finance/loans", {
        ...data,
        lenderContactId: selectedLender?.id,
        lenderType: selectedLender?.type,
        borrowerContactId: selectedBorrower?.id,
        borrowerType: selectedBorrower?.type,
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
        creditorId: selectedCreditor?.id,
        creditorType: selectedCreditor?.type,
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
        id: contact.contactId,
        name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Unnamed Contact',
        type: 'contact' as const,
        email: contact.email,
      })),
      ...filteredCompanies.map((company: any) => ({
        id: company.companyId,
        name: company.companyName || 'Unnamed Company',
        type: 'company' as const,
        email: company.email,
      })),
    ];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {editingLoan ? "Edit Loan" : "Create New Loan"}
        </h3>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      placeholder="10000.00"
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
                      placeholder="5.50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="issueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Issue Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
          </div>

          {/* Polymorphic Creditor Selection */}
          <div className="space-y-3">
            <FormLabel>Lender / Creditor</FormLabel>
            
            {selectedCreditor ? (
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50 dark:bg-gray-800">
                {selectedCreditor.type === "company" ? (
                  <Building2 className="h-4 w-4 text-blue-600" />
                ) : (
                  <User className="h-4 w-4 text-green-600" />
                )}
                <span className="font-medium">{selectedCreditor.name}</span>
                <Badge variant={selectedCreditor.type === "company" ? "default" : "secondary"}>
                  {selectedCreditor.type === "company" ? "Company" : "Contact"}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCreditor(null)}
                  className="ml-auto"
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search contacts and companies..."
                    value={creditorSearchTerm}
                    onChange={(e) => setCreditorSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {creditorSearchTerm && (
                  <div className="max-h-48 overflow-y-auto border rounded-lg bg-white dark:bg-gray-800">
                    {getCreditorOptions().map((option) => (
                      <button
                        key={`${option.type}-${option.id}`}
                        type="button"
                        onClick={() => {
                          setSelectedCreditor(option);
                          setCreditorSearchTerm("");
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
                    {getCreditorOptions().length === 0 && (
                      <div className="p-3 text-center text-gray-500">
                        No matching contacts or companies found
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="defaulted">Defaulted</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

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

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Additional loan details..."
                    className="resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createLoanMutation.isPending || updateLoanMutation.isPending}
            >
              {editingLoan ? "Update Loan" : "Create Loan"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}