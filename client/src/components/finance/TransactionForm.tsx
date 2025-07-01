import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CalendarIcon, Calculator, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { insertTransactionSchema, type Account, type InsertTransaction, TRANSACTION_TYPES } from "@shared/finance-schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Extended schema for form validation
const transactionFormSchema = insertTransactionSchema.extend({
  transactionDate: z.date({
    required_error: "Transaction date is required.",
  }),
});

type TransactionFormData = z.infer<typeof transactionFormSchema>;

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// Using TRANSACTION_TYPES from shared schema with simplified double-entry logic

export function TransactionForm({ open, onClose, onSuccess, onCancel }: TransactionFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTransactionType, setSelectedTransactionType] = useState<string>("");

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      amount: "0.00",
      transactionType: "expense",
      description: "",
      transactionDate: new Date(),
      category: "",
      subcategory: "",
      debitAccountEntityId: "",
      creditAccountEntityId: "",
      vendorEntityId: "",
      projectEntityId: "",
      transactionSource: "manual",
      reference: "",
      reconciled: false,
      createdByEntityId: "7804247f-3ae8-4eb2-8c6d-2c44f967ad42", // Hardcoded user ID
    },
  });

  // Fetch accounts for dropdowns
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/cortex/finance/accounts"],
  });

  // Separate accounts by type for better UX
  const bankAccounts = accounts.filter(acc => 
    ["checking", "savings", "cash"].includes(acc.accountType)
  );
  const creditCardAccounts = accounts.filter(acc => 
    acc.accountType === "credit_card"
  );
  const expenseAccounts = accounts.filter(acc => 
    acc.accountType === "expense"
  );
  const incomeAccounts = accounts.filter(acc => 
    acc.accountType === "income"
  );
  const allPaymentAccounts = accounts.filter(acc => 
    ["checking", "savings", "cash", "credit_card"].includes(acc.accountType)
  );

  const createTransactionMutation = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      const payload = {
        ...data,
        transactionDate: data.transactionDate.toISOString().split('T')[0],
      };
      
      const response = await apiRequest("/api/cortex/finance/transactions", {
        method: "POST",
        body: payload,
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Transaction created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cortex/finance/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cortex/finance/accounts"] }); // Refresh balances
      onSuccess?.();
      onClose(); // Close the modal
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create transaction.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TransactionFormData) => {
    // Auto-complete missing account fields for income/expense transactions
    let processedData = { ...data };
    
    if (data.transactionType === "income") {
      // Income: Need a bank account to receive the money (debit) and income account (credit)
      // If only income account is selected, we need to find a default bank account
      if (!processedData.debitAccountEntityId && processedData.creditAccountEntityId) {
        const defaultBankAccount = allPaymentAccounts.find(acc => acc.accountType === "checking");
        if (defaultBankAccount) {
          processedData.debitAccountEntityId = defaultBankAccount.id;
        }
      }
    } else if (data.transactionType === "expense") {
      // Expense: Need expense account (debit) and payment account (credit)
      // If only expense account is selected, we need to find a default payment account
      if (processedData.debitAccountEntityId && !processedData.creditAccountEntityId) {
        const defaultPaymentAccount = allPaymentAccounts.find(acc => acc.accountType === "checking");
        if (defaultPaymentAccount) {
          processedData.creditAccountEntityId = defaultPaymentAccount.id;
        }
      }
    }
    
    createTransactionMutation.mutate(processedData);
  };

  const transactionType = form.watch("transactionType");
  const debitAccount = form.watch("debitAccountEntityId");
  const creditAccount = form.watch("creditAccountEntityId");
  
  // Get account details for validation
  const debitAccountDetails = accounts.find(acc => acc.id === debitAccount);
  const creditAccountDetails = accounts.find(acc => acc.id === creditAccount);

  // Simplified accounting logic: Income = Credit, Everything else = Debit, Credit cards inverted
  const getAccountingLogic = () => {
    if (transactionType === "income") {
      return {
        primaryAccount: "credit", // Income goes to credit side
        paymentAccount: "debit", // Bank account gets debited (money comes in)
        description: "Income: Credit income account, Debit bank account"
      };
    } else {
      return {
        primaryAccount: "debit", // Expenses/transfers go to debit side  
        paymentAccount: "credit", // Bank/credit card gets credited (money goes out)
        description: "Expense: Debit expense account, Credit payment account"
      };
    }
  };

  const validateAccounting = () => {
    if (!debitAccount || !creditAccount) return null;
    
    const logic = getAccountingLogic();
    
    // Check credit card inversion
    if (creditAccountDetails?.accountType === "credit_card") {
      if (transactionType === "expense") {
        return { type: "success", message: "✓ Credit card expense: Debit expense, Credit credit card (increases balance)" };
      }
    }
    
    if (debitAccountDetails?.accountType === "credit_card") {
      if (transactionType === "income" || transactionType === "transfer") {
        return { type: "success", message: "✓ Credit card payment: Debit credit card (reduces balance)" };
      }
    }

    return { type: "info", message: logic.description };
  };

  const accountingValidation = validateAccounting();

  // Get accounts based on simplified logic
  const getAccountsForField = (fieldType: "debit" | "credit") => {
    if (transactionType === "income") {
      if (fieldType === "debit") {
        return allPaymentAccounts; // Bank accounts that receive money
      } else {
        return incomeAccounts; // Income accounts to be credited
      }
    } else { // expense, transfer, adjustment
      if (fieldType === "debit") {
        return transactionType === "expense" ? expenseAccounts : allPaymentAccounts;
      } else {
        return allPaymentAccounts; // Payment accounts that give money
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Add Transaction
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Transaction Type Selection */}
        <FormField
          control={form.control}
          name="transactionType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Transaction Type</FormLabel>
              <Select onValueChange={(value) => {
                field.onChange(value);
                setSelectedTransactionType(value);
                // Clear account selections when type changes
                form.setValue("debitAccountEntityId", "");
                form.setValue("creditAccountEntityId", "");
              }} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select transaction type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(TRANSACTION_TYPES).map(([key, description]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex flex-col">
                        <span className="font-medium">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                        <span className="text-xs text-muted-foreground">{description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter transaction description..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          {/* Amount */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Transaction Date */}
          <FormField
            control={form.control}
            name="transactionDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Transaction Date</FormLabel>
                <Popover modal={true}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "pl-3 text-left font-normal",
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
                  <PopoverContent className="w-auto p-0 calendar-popover-max-z" align="start">
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
        </div>

        {/* Accounting Section - Conditional based on transaction type */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            <h4 className="text-sm font-medium">
              {transactionType === "transfer" ? "Double-Entry Accounting" : "Account Selection"}
            </h4>
          </div>
          
          {/* Conditional Account Fields based on Transaction Type */}
          {transactionType === "transfer" ? (
            // Transfer: Show both debit and credit accounts (double-entry)
            <div className="grid grid-cols-2 gap-4">
              {/* Debit Account */}
              <FormField
                control={form.control}
                name="debitAccountEntityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Debit Account</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select debit account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getAccountsForField("debit").map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex flex-col">
                              <span>{account.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {account.accountType} • Balance: ${account.balance}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground">
                      Account that receives the debit entry
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Credit Account */}
              <FormField
                control={form.control}
                name="creditAccountEntityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credit Account</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select credit account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {getAccountsForField("credit").map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex flex-col">
                              <span>{account.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {account.accountType} • Balance: ${account.balance}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground">
                      Account that receives the credit entry
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ) : transactionType === "income" ? (
            // Income: Show only credit account (money coming in)
            <FormField
              control={form.control}
              name="creditAccountEntityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Income Account</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select income account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {getAccountsForField("credit").map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          <div className="flex flex-col">
                            <span>{account.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {account.accountType} • Balance: ${account.balance}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">
                    Money coming in - creates credit entry
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            // Expense: Show only debit account (money going out)
            <FormField
              control={form.control}
              name="debitAccountEntityId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expense Account</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select expense account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {getAccountsForField("debit").map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          <div className="flex flex-col">
                            <span>{account.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {account.accountType} • Balance: ${account.balance}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">
                    Money going out - creates debit entry
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Accounting Logic Validation - Only show for transfers */}
          {transactionType === "transfer" && accountingValidation && (
            <Alert className={accountingValidation.type === "success" ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {accountingValidation.message}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Category */}
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Office Supplies" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Reference */}
          <FormField
            control={form.control}
            name="reference"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reference</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Check #1234" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={createTransactionMutation.isPending}>
            {createTransactionMutation.isPending ? "Creating..." : "Create Transaction"}
          </Button>
        </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}