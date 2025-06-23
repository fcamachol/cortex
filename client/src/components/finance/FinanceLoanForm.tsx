import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

const loanSchema = z.object({
  loanName: z.string().min(1, "Loan name is required"),
  originalAmount: z.string().min(1, "Original amount is required"),
  currentBalance: z.string().min(1, "Current balance is required"),
  interestRate: z.string().min(1, "Interest rate is required"),
  moratoryRate: z.string().optional(),
  termMonths: z.string().min(1, "Term in months is required"),
  paymentAmount: z.string().min(1, "Payment amount is required"),
  startDate: z.date(),
  status: z.enum(["active", "paid_off", "in_arrears"]).default("active"),
  contactId: z.string().optional(),
  notes: z.string().optional(),
});

interface FinanceLoanFormProps {
  onClose: () => void;
  loan?: any;
}

export function FinanceLoanForm({ onClose, loan }: FinanceLoanFormProps) {
  const queryClient = useQueryClient();

  // Fetch contacts for dropdown
  const { data: contacts } = useQuery({
    queryKey: ["/api/contacts"],
    staleTime: 300000,
  });

  const form = useForm<z.infer<typeof loanSchema>>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      loanName: loan?.loanName || "",
      originalAmount: loan?.originalAmount?.toString() || "",
      currentBalance: loan?.currentBalance?.toString() || "",
      interestRate: loan?.interestRate?.toString() || "",
      moratoryRate: loan?.moratoryRate?.toString() || "",
      termMonths: loan?.termMonths?.toString() || "",
      paymentAmount: loan?.paymentAmount?.toString() || "",
      startDate: loan?.startDate ? new Date(loan.startDate) : new Date(),
      status: loan?.status || "active",
      contactId: loan?.contactId?.toString() || "",
      notes: loan?.notes || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof loanSchema>) => {
      const payload = {
        ...data,
        originalAmount: parseFloat(data.originalAmount),
        currentBalance: parseFloat(data.currentBalance),
        interestRate: parseFloat(data.interestRate),
        moratoryRate: data.moratoryRate ? parseFloat(data.moratoryRate) : null,
        termMonths: parseInt(data.termMonths),
        paymentAmount: parseFloat(data.paymentAmount),
        contactId: data.contactId ? parseInt(data.contactId) : null,
        startDate: format(data.startDate, "yyyy-MM-dd"),
      };
      return loan?.loanId
        ? apiRequest("PATCH", `/api/finance/loans/${loan.loanId}`, payload)
        : apiRequest("POST", "/api/finance/loans", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/loan-balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/overview"] });
      onClose();
    },
  });

  const onSubmit = (data: z.infer<typeof loanSchema>) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {loan ? "Edit Loan" : "Add Loan"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="loanName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loan Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Home Mortgage, Car Loan"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="originalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Original Amount</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-muted-foreground">$</span>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="pl-8"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currentBalance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Balance</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-muted-foreground">$</span>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="pl-8"
                        />
                      </div>
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
                        {...field}
                        type="number"
                        step="0.01"
                        placeholder="5.25"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="moratoryRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Late Payment Rate (%) - Optional</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        placeholder="2.00"
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
                name="termMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Term (Months)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        placeholder="360"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Payment</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-muted-foreground">$</span>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="pl-8"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        <SelectItem value="paid_off">Paid Off</SelectItem>
                        <SelectItem value="in_arrears">In Arrears</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="contactId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lender Contact</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select contact" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">No contact</SelectItem>
                      {contacts?.map((contact: any) => (
                        <SelectItem key={contact.contactId} value={contact.contactId.toString()}>
                          {contact.firstName} {contact.lastName} - {contact.phoneNumber}
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Additional loan details..."
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? (loan ? "Updating..." : "Creating...")
                  : (loan ? "Update Loan" : "Create Loan")
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}