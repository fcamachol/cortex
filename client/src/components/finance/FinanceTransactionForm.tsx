import { useState } from "react";
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
import { CalendarIcon, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

const transactionSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  type: z.enum(["income", "expense"]),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  transactionDate: z.date(),
  contactId: z.string().optional(),
});

interface FinanceTransactionFormProps {
  onClose: () => void;
  transaction?: any;
}

export function FinanceTransactionForm({ onClose, transaction }: FinanceTransactionFormProps) {
  const queryClient = useQueryClient();

  // Fetch categories for dropdown
  const { data: categories } = useQuery({
    queryKey: ["/api/finance/categories"],
    staleTime: 300000, // 5 minutes
  });

  // Fetch contacts for dropdown
  const { data: contacts } = useQuery({
    queryKey: ["/api/contacts"],
    staleTime: 300000, // 5 minutes
  });

  // Fetch accounts for dropdown
  const { data: accounts } = useQuery({
    queryKey: ["/api/finance/accounts"],
    queryFn: async () => {
      const response = await fetch("/api/finance/accounts?spaceId=1");
      if (!response.ok) throw new Error('Failed to fetch accounts');
      return response.json();
    },
    staleTime: 300000, // 5 minutes
  });

  const form = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      amount: transaction?.amount?.toString() || "",
      type: transaction?.type || "expense",
      description: transaction?.description || "",
      categoryId: transaction?.categoryId?.toString() || "",
      accountId: transaction?.accountId?.toString() || "",
      transactionDate: transaction?.transactionDate ? new Date(transaction.transactionDate) : new Date(),
      contactId: transaction?.contactId?.toString() || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof transactionSchema>) => {
      const payload = {
        ...data,
        amount: parseFloat(data.amount),
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        accountId: data.accountId ? parseInt(data.accountId) : null,
        contactId: data.contactId ? parseInt(data.contactId) : null,
        transactionDate: format(data.transactionDate, "yyyy-MM-dd"),
      };
      return transaction?.transactionId
        ? apiRequest("PATCH", `/api/finance/transactions/${transaction.transactionId}`, payload)
        : apiRequest("POST", "/api/finance/transactions", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/overview"] });
      onClose();
    },
  });

  const onSubmit = (data: z.infer<typeof transactionSchema>) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {transaction ? "Edit Transaction" : "Add Transaction"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="pl-9"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="transactionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
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
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
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
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">No category</SelectItem>
                      {categories?.map((category: any) => (
                        <SelectItem key={category.categoryId} value={category.categoryId.toString()}>
                          {category.categoryName}
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
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">No account</SelectItem>
                      {accounts?.map((account: any) => (
                        <SelectItem key={account.accountId} value={account.accountId.toString()}>
                          {account.accountName} ({account.accountType})
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
              name="contactId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact</FormLabel>
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Transaction description..."
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
                  ? (transaction ? "Updating..." : "Creating...") 
                  : (transaction ? "Update Transaction" : "Create Transaction")
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}