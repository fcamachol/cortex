import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CreditCard, Building2, Calendar, Percent, DollarSign } from "lucide-react";
import type { FinanceAccount, InsertFinanceAccount, InsertCreditCardDetails } from "@shared/schema";

const creditCardFormSchema = z.object({
  // Account Information
  accountName: z.string().min(1, "Account name is required"),
  institutionName: z.string().min(1, "Institution name is required"),
  last4Digits: z.string().length(4, "Must be exactly 4 digits").regex(/^\d{4}$/, "Must contain only digits"),
  currentBalance: z.string().min(1, "Current balance is required"),
  currency: z.string().default("USD"),
  notes: z.string().optional(),
  
  // Credit Card Specific Details
  creditLimit: z.string().min(1, "Credit limit is required"),
  apr: z.string().min(1, "APR is required"),
  statementClosingDay: z.string().min(1, "Statement closing day is required"),
  paymentDueDaysAfterStatement: z.string().default("21"),
});

type CreditCardFormData = z.infer<typeof creditCardFormSchema>;

interface CreditCardFormProps {
  spaceId: number;
  onSuccess?: () => void;
  editingAccount?: FinanceAccount;
}

export function CreditCardForm({ spaceId, onSuccess, editingAccount }: CreditCardFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreditCardFormData>({
    resolver: zodResolver(creditCardFormSchema),
    defaultValues: {
      accountName: editingAccount?.accountName || "",
      institutionName: editingAccount?.institutionName || "",
      last4Digits: editingAccount?.last4Digits || "",
      currentBalance: editingAccount?.currentBalance || "0.00",
      currency: editingAccount?.currency || "USD",
      notes: editingAccount?.notes || "",
      creditLimit: "",
      apr: "",
      statementClosingDay: "",
      paymentDueDaysAfterStatement: "21",
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: async (data: InsertFinanceAccount) => {
      return await apiRequest("POST", "/api/finance/accounts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/accounts"] });
    },
  });

  const createCreditCardMutation = useMutation({
    mutationFn: async (data: InsertCreditCardDetails) => {
      return await apiRequest("POST", "/api/finance/credit-cards", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/credit-cards"] });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async ({ accountId, data }: { accountId: number; data: Partial<InsertFinanceAccount> }) => {
      return await apiRequest("PUT", `/api/finance/accounts/${accountId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/accounts"] });
    },
  });

  const onSubmit = async (data: CreditCardFormData) => {
    try {
      setIsSubmitting(true);

      if (editingAccount) {
        // Update existing account
        await updateAccountMutation.mutateAsync({
          accountId: editingAccount.accountId,
          data: {
            accountName: data.accountName,
            institutionName: data.institutionName,
            last4Digits: data.last4Digits,
            currentBalance: data.currentBalance,
            currency: data.currency,
            notes: data.notes,
          },
        });
      } else {
        // Create new credit card account
        const accountData: InsertFinanceAccount = {
          spaceId,
          accountName: data.accountName,
          accountType: "credit_card" as const,
          institutionName: data.institutionName,
          last4Digits: data.last4Digits,
          currentBalance: data.currentBalance,
          currency: data.currency,
          isActive: true,
          notes: data.notes,
        };

        const newAccount = await createAccountMutation.mutateAsync(accountData);

        // Create credit card details
        const creditCardData: InsertCreditCardDetails = {
          accountId: newAccount.accountId,
          creditLimit: data.creditLimit,
          apr: data.apr,
          statementClosingDay: parseInt(data.statementClosingDay),
          paymentDueDaysAfterStatement: parseInt(data.paymentDueDaysAfterStatement),
        };

        await createCreditCardMutation.mutateAsync(creditCardData);
      }

      toast({
        title: "Success",
        description: editingAccount 
          ? "Credit card updated successfully" 
          : "Credit card created successfully",
      });

      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error("Error saving credit card:", error);
      toast({
        title: "Error",
        description: editingAccount 
          ? "Failed to update credit card" 
          : "Failed to create credit card",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate day options for statement closing day
  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {editingAccount ? "Edit Credit Card" : "Add Credit Card"}
        </CardTitle>
        <CardDescription>
          {editingAccount 
            ? "Update your credit card information" 
            : "Create a new credit card account for tracking purchases and statements"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Account Information Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Building2 className="h-4 w-4" />
                Account Information
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="accountName"
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
                  name="institutionName"
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
                      <FormLabel className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        Current Balance *
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="0.00" type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Credit Card Details Section */}
            {!editingAccount && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Percent className="h-4 w-4" />
                  Credit Card Details
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="creditLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          Credit Limit *
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="5000.00" type="number" step="0.01" {...field} />
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
                        <FormLabel className="flex items-center gap-1">
                          <Percent className="h-3 w-3" />
                          APR (%) *
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="24.99" type="number" step="0.01" {...field} />
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
                        <FormLabel className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Statement Closing Day *
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                          <Input placeholder="21" type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

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
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Button */}
            <div className="flex justify-end gap-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmitting ? "Saving..." : editingAccount ? "Update Credit Card" : "Create Credit Card"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}