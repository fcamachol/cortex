import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, CreditCard } from "lucide-react";

const creditCardSchema = z.object({
  cardName: z.string().min(1, "Card name is required").max(200),
  bankName: z.string().min(1, "Bank/Institution is required").max(200),
  last4Digits: z.string().min(4, "Last 4 digits required").max(4, "Only 4 digits").regex(/^\d{4}$/, "Must be 4 digits"),
  currentBalance: z.string().refine(val => !isNaN(parseFloat(val)), "Must be a valid number"),
  creditLimit: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Must be a positive number"),
  apr: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Must be a positive number"),
  statementClosingDay: z.string().refine(val => {
    const num = parseInt(val);
    return !isNaN(num) && num >= 1 && num <= 31;
  }, "Must be between 1 and 31"),
  paymentDueDaysAfterStatement: z.string().refine(val => {
    const num = parseInt(val);
    return !isNaN(num) && num >= 1 && num <= 60;
  }, "Must be between 1 and 60 days"),
  currency: z.string().default("MXN"),
  isActive: z.boolean().default(true),
  notes: z.string().optional()
});

type CreditCardFormData = z.infer<typeof creditCardSchema>;

interface CreditCardFormProps {
  open: boolean;
  onClose: () => void;
  creditCard?: any; // For editing existing credit cards
}

export function CreditCardForm({ open, onClose, creditCard }: CreditCardFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreditCardFormData>({
    resolver: zodResolver(creditCardSchema),
    defaultValues: {
      cardName: creditCard?.card_name || "",
      bankName: creditCard?.bank_name || "",
      last4Digits: creditCard?.last_4_digits || "",
      currentBalance: creditCard?.current_balance?.toString() || "0.00",
      creditLimit: creditCard?.credit_limit?.toString() || "",
      apr: creditCard?.apr?.toString() || "",
      statementClosingDay: creditCard?.statement_closing_day?.toString() || "",
      paymentDueDaysAfterStatement: creditCard?.payment_due_days_after_statement?.toString() || "21",
      currency: creditCard?.currency || "MXN",
      isActive: creditCard?.is_active ?? true,
      notes: creditCard?.notes || ""
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreditCardFormData) => {
      const payload = {
        card_name: data.cardName,
        bank_name: data.bankName,
        last_4_digits: data.last4Digits,
        current_balance: parseFloat(data.currentBalance),
        credit_limit: parseFloat(data.creditLimit),
        apr: parseFloat(data.apr) / 100, // Convert percentage to decimal
        statement_closing_day: parseInt(data.statementClosingDay),
        payment_due_days_after_statement: parseInt(data.paymentDueDaysAfterStatement),
        currency: data.currency,
        is_active: data.isActive,
        notes: data.notes
      };
      
      if (creditCard) {
        return await apiRequest("PUT", `/api/finance/credit-cards/${creditCard.id}`, payload);
      } else {
        return await apiRequest("POST", "/api/finance/credit-cards", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/credit-cards"] });
      toast({
        title: "Success",
        description: creditCard ? "Credit card updated successfully" : "Credit card created successfully"
      });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save credit card",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: CreditCardFormData) => {
    createMutation.mutate(data);
  };

  // Generate day options for statement closing day
  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {creditCard ? "Edit Credit Card" : "Add Credit Card"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Create a new credit card account for tracking purchases and statements
          </p>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Account Information Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="h-4 w-4" />
                <h3 className="text-sm font-medium">Account Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cardName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Card Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Chase Sapphire Reserve" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank/Institution *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Chase Bank" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="last4Digits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last 4 Digits *</FormLabel>
                      <FormControl>
                        <Input placeholder="1234" maxLength={4} {...field} />
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
                      <FormLabel>$ Current Balance *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="0.00" 
                          {...field} 
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Negative values represent debt (e.g., -500.00)
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Credit Card Details Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm">%</span>
                <h3 className="text-sm font-medium">Credit Card Details</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="creditLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>$ Credit Limit *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="5000.00" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="apr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>% APR (%) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          placeholder="24.99" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="statementClosingDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Statement Closing Day *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select day" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {dayOptions.map((day) => (
                            <SelectItem key={day} value={day.toString()}>
                              {day}
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
                  name="paymentDueDaysAfterStatement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Days Until Payment Due</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="21" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Notes Section */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any additional notes about this credit card..."
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : creditCard ? "Update Credit Card" : "Create Credit Card"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface CreditCardFormTriggerProps {
  creditCard?: any;
  children?: React.ReactNode;
}

export function CreditCardFormTrigger({ creditCard, children }: CreditCardFormTriggerProps) {
  const [open, setOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <div onClick={handleClick} className="cursor-pointer w-full">
        {children || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Credit Card
          </Button>
        )}
      </div>
      <CreditCardForm 
        open={open} 
        onClose={() => setOpen(false)} 
        creditCard={creditCard}
      />
    </>
  );
}