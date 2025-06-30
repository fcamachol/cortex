import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { X } from "lucide-react";

const loanSchema = z.object({
  lenderName: z.string().min(1, "Lender name is required"),
  principalAmount: z.string().min(1, "Principal amount is required").transform((val) => parseFloat(val)),
  interestRate: z.string().min(1, "Interest rate is required").transform((val) => parseFloat(val)),
  interestRateType: z.enum(["daily", "weekly", "monthly"], {
    required_error: "Please select interest rate type",
  }),
  termMonths: z.string().optional().transform((val) => val && val.trim() ? parseInt(val) : undefined),
  startDate: z.string().min(1, "Start date is required"),
  paymentDate: z.string().optional(),
  paymentFrequency: z.enum(["monthly", "quarterly", "annually"], {
    required_error: "Please select payment frequency",
  }),
  currency: z.enum(["USD", "MXN"], {
    required_error: "Please select currency",
  }),
  purpose: z.string().min(1, "Purpose is required"),
  collateral: z.string().optional(),
  notes: z.string().optional(),
  lenderContactId: z.string().optional(),
  borrowerContactId: z.string().optional(),
  // Moratory interests
  hasMoratoryInterest: z.boolean().optional(),
  moratoryRate: z.string().optional().transform((val) => val && val.trim() ? parseFloat(val) : undefined),
  moratoryRateType: z.enum(["daily", "weekly", "monthly"]).optional(),
  useCustomFormula: z.boolean().optional(),
  customFormula: z.string().optional(),
  customFormulaDescription: z.string().optional(),
});

type LoanFormData = z.infer<typeof loanSchema>;

interface LoanFormProps {
  open: boolean;
  onClose: () => void;
  editingLoan?: any;
}

export function LoanForm({ open, onClose, editingLoan }: LoanFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Demo userId - matches what's used throughout the app
  const userId = "7804247f-3ae8-4eb2-8c6d-2c44f967ad42";

  // Fetch contacts for linking
  const { data: contacts = [], isLoading: contactsLoading, error: contactsError } = useQuery({
    queryKey: [`/api/contacts/${userId}`],
    enabled: open, // Only fetch when dialog is open
  });

  // Type the contacts properly
  const typedContacts = Array.isArray(contacts) ? contacts as any[] : [];

  // State for moratory interests section
  const [showMoratoryInterests, setShowMoratoryInterests] = useState(false);
  const [showCustomFormula, setShowCustomFormula] = useState(false);



  const form = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      lenderName: "",
      principalAmount: "0",
      interestRate: "0",
      interestRateType: "monthly",
      termMonths: "",
      startDate: new Date().toISOString().split('T')[0],
      paymentDate: "",
      paymentFrequency: "monthly",
      currency: "MXN",
      purpose: "",
      collateral: "",
      notes: "",
      lenderContactId: "",
      borrowerContactId: "",
      hasMoratoryInterest: false,
      moratoryRate: "0",
      moratoryRateType: "monthly",
    },
  });

  // Reset form when editingLoan changes or modal opens
  useEffect(() => {
    if (open) {
      if (editingLoan) {
        // Populate form with loan data for editing
        form.reset({
          lenderName: editingLoan.lender_name || "",
          principalAmount: editingLoan.principal_amount?.toString() || "0",
          interestRate: editingLoan.interest_rate?.toString() || "0",
          interestRateType: editingLoan.interest_rate_type || "monthly",
          termMonths: editingLoan.term_months?.toString() || "",
          startDate: editingLoan.start_date || new Date().toISOString().split('T')[0],
          paymentDate: editingLoan.payment_date || "",
          paymentFrequency: editingLoan.payment_frequency || "monthly",
          currency: editingLoan.currency || "MXN",
          purpose: editingLoan.purpose || "",
          collateral: editingLoan.collateral || "",
          notes: editingLoan.notes || "",
          lenderContactId: editingLoan.lender_entity_id || "",
          borrowerContactId: editingLoan.borrower_entity_id || "",
          hasMoratoryInterest: editingLoan.has_moratory_interest || false,
          moratoryRate: editingLoan.moratory_rate?.toString() || "0",
          moratoryRateType: editingLoan.moratory_rate_type || "monthly",
          useCustomFormula: editingLoan.use_custom_formula || false,
          customFormula: editingLoan.custom_formula || "",
          customFormulaDescription: editingLoan.custom_formula_description || "",
        });
        // Set moratory interests section visibility based on loan data
        setShowMoratoryInterests(editingLoan.has_moratory_interest || false);
      } else {
        // Reset to default values for new loan
        form.reset({
          lenderName: "",
          principalAmount: "0",
          interestRate: "0",
          interestRateType: "monthly",
          termMonths: "",
          startDate: new Date().toISOString().split('T')[0],
          paymentDate: "",
          paymentFrequency: "monthly",
          currency: "MXN",
          purpose: "",
          collateral: "",
          notes: "",
          lenderContactId: "",
          borrowerContactId: "",
          hasMoratoryInterest: false,
          moratoryRate: "0",
          moratoryRateType: "monthly",
        });
        // Reset moratory interests section for new loans
        setShowMoratoryInterests(false);
      }
    }
  }, [open, editingLoan, form]);

  const saveLoan = useMutation({
    mutationFn: async (data: LoanFormData) => {
      if (editingLoan) {
        return apiRequest("PUT", `/api/finance/loans/${editingLoan.id}`, data);
      } else {
        return apiRequest("POST", "/api/finance/loans", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/overview"] });
      toast({
        title: "Success",
        description: editingLoan ? "Loan updated successfully" : "Loan created successfully",
      });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || (editingLoan ? "Failed to update loan" : "Failed to create loan"),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoanFormData) => {
    // Convert empty strings to null for optional fields
    const processedData = {
      ...data,
      termMonths: data.termMonths === "" ? null : Number(data.termMonths),
      paymentDate: data.paymentDate === "" ? null : data.paymentDate,
      collateral: data.collateral === "" ? null : data.collateral,
      notes: data.notes === "" ? null : data.notes,
      lenderContactId: data.lenderContactId === "" ? null : data.lenderContactId,
      borrowerContactId: data.borrowerContactId === "" ? null : data.borrowerContactId,
    };
    saveLoan.mutate(processedData);
  };

  const purposes = [
    "Home Purchase",
    "Auto Purchase",
    "Business Investment",
    "Education",
    "Debt Consolidation",
    "Personal Use",
    "Equipment Purchase",
    "Working Capital",
    "Real Estate Investment",
    "Other",
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Loan</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="lenderName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lender Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter lender name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="lenderContactId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lender Contact</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select lender contact" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No contact linked</SelectItem>
                          {typedContacts.map((contact: any) => (
                            <SelectItem key={contact.id} value={contact.id.toString()}>
                              {contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="borrowerContactId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Borrower Contact</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select borrower contact" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No contact linked</SelectItem>
                          {typedContacts.map((contact: any) => (
                            <SelectItem key={contact.id} value={contact.id.toString()}>
                              {contact.name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="MXN">MXN ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interestRateType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interest Rate Type</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select rate type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="termMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Term (Months)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Optional"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value)}
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
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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

            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Final Payment Date (Optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} placeholder="Optional" />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    The date when the entire loan amount is due
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select purpose" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {purposes.map((purpose) => (
                        <SelectItem key={purpose} value={purpose}>
                          {purpose}
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
              name="collateral"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collateral (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Describe collateral if any" {...field} />
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
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Moratory Interests Section */}
            <div className="mt-6 border rounded-lg p-4">
              <div className="flex items-center justify-between w-full">
                <FormField
                  control={form.control}
                  name="hasMoratoryInterest"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          className="h-4 w-4"
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-medium cursor-pointer">
                        Add Moratory Interests (Optional)
                      </FormLabel>
                    </FormItem>
                  )}
                />
                {form.watch("hasMoratoryInterest") && (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                )}
                {!form.watch("hasMoratoryInterest") && (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              
              {form.watch("hasMoratoryInterest") && (
                <div className="mt-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Moratory interests are penalty charges applied to overdue payments.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="moratoryRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Moratory Interest Rate (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="moratoryRateType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Calculation Frequency</FormLabel>
                          <FormControl>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  {/* Custom Formula Section */}
                  <div className="mt-6 border-t pt-4">
                    <FormField
                      control={form.control}
                      name="useCustomFormula"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={(e) => field.onChange(e.target.checked)}
                              className="h-4 w-4"
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-medium cursor-pointer">
                            Use Custom Moratory Rate Formula
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                    
                    {form.watch("useCustomFormula") && (
                      <div className="mt-4 space-y-4">
                        <div className="text-sm text-muted-foreground space-y-2">
                          <p>Create a custom formula using existing loan information. Available variables:</p>
                          <div className="flex flex-wrap gap-2">
                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">principalAmount</span>
                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">interestRate</span>
                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">termMonths</span>
                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">daysOverdue</span>
                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">paymentFrequency</span>
                          </div>
                          <p className="text-xs"><strong>Examples with frequency calculation:</strong></p>
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs font-semibold">Daily rate from monthly interest:</p>
                              <div className="font-mono text-xs bg-gray-50 p-2 rounded border">
                                return principalAmount * (interestRate / 12 / 30) * daysOverdue;
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold">Daily penalty from monthly payment (Payment ÷ 30):</p>
                              <div className="font-mono text-xs bg-gray-50 p-2 rounded border">
                                const monthlyRate = interestRate / 12;
                                const monthlyPayment = principalAmount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1);
                                return (monthlyPayment / 30) * daysOverdue;
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold">Frequency-based penalty (2% per payment period):</p>
                              <div className="font-mono text-xs bg-gray-50 p-2 rounded border">
                                const periodsPerYear = paymentFrequency === 'monthly' ? 12 : paymentFrequency === 'quarterly' ? 4 : 1;
                                return principalAmount * 0.02 * Math.ceil(daysOverdue / (365 / periodsPerYear));
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <FormField
                          control={form.control}
                          name="customFormulaDescription"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Formula Description</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., 2% of principal amount for first 30 days overdue"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="customFormula"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Custom Formula</FormLabel>
                              <FormControl>
                                <textarea
                                  className="w-full min-h-[80px] p-2 border rounded-md text-sm font-mono"
                                  placeholder="e.g., if (daysOverdue <= 30) { return principalAmount * 0.02; } else { return principalAmount * 0.05; }"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                              <p className="text-xs text-muted-foreground mt-1">
                                Available variables: principalAmount, interestRate, termMonths, daysOverdue, paymentFrequency
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Math functions available: Math.ceil, Math.floor, Math.min, Math.max, etc.
                              </p>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveLoan.isPending}>
                {saveLoan.isPending ? (editingLoan ? "Updating..." : "Creating...") : (editingLoan ? "Update Loan" : "Create Loan")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}