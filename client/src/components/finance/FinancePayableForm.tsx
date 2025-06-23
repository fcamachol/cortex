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
import { CalendarIcon, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

const payableSchema = z.object({
  description: z.string().min(1, "Description is required"),
  totalAmount: z.string().min(1, "Amount is required"),
  dueDate: z.date(),
  categoryId: z.string().optional(),
  contactId: z.string().optional(),
  status: z.enum(["unpaid", "partially_paid", "paid", "overdue"]).default("unpaid"),
});

interface FinancePayableFormProps {
  onClose: () => void;
  payable?: any;
}

export function FinancePayableForm({ onClose, payable }: FinancePayableFormProps) {
  const queryClient = useQueryClient();

  // Fetch categories for dropdown
  const { data: categories } = useQuery({
    queryKey: ["/api/finance/categories"],
    staleTime: 300000,
  });

  // Fetch contacts for dropdown
  const { data: contacts } = useQuery({
    queryKey: ["/api/contacts"],
    staleTime: 300000,
  });

  const form = useForm<z.infer<typeof payableSchema>>({
    resolver: zodResolver(payableSchema),
    defaultValues: {
      description: payable?.description || "",
      totalAmount: payable?.totalAmount?.toString() || "",
      dueDate: payable?.dueDate ? new Date(payable.dueDate) : new Date(),
      categoryId: payable?.categoryId?.toString() || "",
      contactId: payable?.contactId?.toString() || "",
      status: payable?.status || "unpaid",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof payableSchema>) => {
      const payload = {
        ...data,
        totalAmount: parseFloat(data.totalAmount),
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        contactId: data.contactId ? parseInt(data.contactId) : null,
        dueDate: format(data.dueDate, "yyyy-MM-dd"),
      };
      return payable?.payableId
        ? apiRequest("PATCH", `/api/finance/payables/${payable.payableId}`, payload)
        : apiRequest("POST", "/api/finance/payables", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/payables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/upcoming-bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/overview"] });
      onClose();
    },
  });

  const onSubmit = (data: z.infer<typeof payableSchema>) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {payable ? "Edit Bill" : "Add Bill"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Electricity Bill, Rent Payment"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="totalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Amount</FormLabel>
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
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                        <SelectItem value="partially_paid">Partially Paid</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
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
                        disabled={(date) => date < new Date("1900-01-01")}
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
                      <SelectItem value="none">No category</SelectItem>
                      {(categories || []).map((category: any) => (
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
                      <SelectItem value="none">No contact</SelectItem>
                      {(contacts || []).map((contact: any) => (
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

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? (payable ? "Updating..." : "Creating...")
                  : (payable ? "Update Bill" : "Create Bill")
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}