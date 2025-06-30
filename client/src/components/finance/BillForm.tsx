import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Repeat, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VendorSelect } from "./VendorSelect";

const billFormSchema = z.object({
  bill_number: z.string().min(1, "Bill number is required"),
  vendor_entity_id: z.string().min(1, "Vendor is required"),
  amount: z.number().min(0, "Amount must be positive"),
  bill_date: z.date(),
  due_date: z.date(),
  description: z.string().optional(),
  status: z.enum(["draft", "pending", "paid", "unpaid", "overdue"]).default("pending"),
  // Recurring fields
  is_recurring: z.boolean().default(false),
  recurrence_type: z.enum(["monthly", "quarterly", "annual", "weekly", "biweekly", "custom"]).optional(),
  recurrence_interval: z.number().min(1).optional(),
  recurrence_end_date: z.date().optional(),
  auto_pay_enabled: z.boolean().default(false),
  auto_pay_account_id: z.string().optional(),
});

type BillFormData = z.infer<typeof billFormSchema>;

interface BillFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function BillForm({ onSuccess, onCancel }: BillFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<BillFormData>({
    resolver: zodResolver(billFormSchema),
    defaultValues: {
      bill_number: `BILL-${Date.now()}`,
      vendor_entity_id: "",
      amount: 0,
      bill_date: new Date(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      description: "",
      status: "pending",
      is_recurring: false,
      recurrence_type: undefined,
      recurrence_interval: 1,
      recurrence_end_date: undefined,
      auto_pay_enabled: false,
      auto_pay_account_id: undefined,
    },
  });

  const createBillMutation = useMutation({
    mutationFn: async (data: BillFormData) => {
      // Choose the appropriate endpoint based on whether it's recurring
      const endpoint = data.is_recurring 
        ? "/api/finance/recurring-payables" 
        : "/api/finance/payables";

      const requestData = {
        ...data,
        bill_date: data.bill_date.toISOString().split('T')[0],
        due_date: data.due_date.toISOString().split('T')[0],
        recurrence_end_date: data.recurrence_end_date 
          ? data.recurrence_end_date.toISOString().split('T')[0] 
          : undefined,
        // Remove undefined values to clean up the request
        recurrence_type: data.is_recurring ? data.recurrence_type : undefined,
        recurrence_interval: data.is_recurring ? data.recurrence_interval : undefined,
        auto_pay_account_id: data.auto_pay_enabled ? data.auto_pay_account_id : undefined,
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });
      if (!response.ok) {
        throw new Error("Failed to create bill");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate both payables and recurring bills queries
      queryClient.invalidateQueries({ queryKey: ["/api/finance/payables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/recurring-bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/bills-with-recurrence"] });
      
      const billType = form.getValues("is_recurring") ? "recurring bill" : "bill";
      toast({
        title: "Success",
        description: `${billType} created successfully`,
      });
      onSuccess?.();
    },
    onError: (error) => {
      const billType = form.getValues("is_recurring") ? "recurring bill" : "bill";
      toast({
        title: "Error",
        description: `Failed to create ${billType}`,
        variant: "destructive",
      });
      console.error("Error creating bill:", error);
    },
  });

  const onSubmit = (data: BillFormData) => {
    createBillMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="bill_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bill Number</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="vendor_entity_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vendor</FormLabel>
                <FormControl>
                  <VendorSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder="Select vendor..."
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
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
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
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="bill_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Bill Date</FormLabel>
                <Popover>
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
            name="due_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Due Date</FormLabel>
                <Popover>
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
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Recurring Bills Section */}
        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center space-x-2">
            <Repeat className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-medium">Recurring Bill Settings</h3>
          </div>
          
          <FormField
            control={form.control}
            name="is_recurring"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Make this a recurring bill</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Automatically create new bills based on schedule
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {form.watch("is_recurring") && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="recurrence_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recurrence Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="biweekly">Bi-weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("recurrence_type") === "custom" && (
                  <FormField
                    control={form.control}
                    name="recurrence_interval"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Interval (days)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <FormField
                control={form.control}
                name="recurrence_end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date (Optional)</FormLabel>
                    <Popover>
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
                              <span>No end date (continues indefinitely)</span>
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
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t pt-4">
                <div className="flex items-center space-x-2 mb-3">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <h4 className="font-medium">Auto-Pay Settings</h4>
                </div>
                
                <FormField
                  control={form.control}
                  name="auto_pay_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable Auto-Pay</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Automatically pay bills when due
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch("auto_pay_enabled") && (
                  <FormField
                    control={form.control}
                    name="auto_pay_account_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Account</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select account for auto-pay" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="account1">Main Checking Account</SelectItem>
                            <SelectItem value="account2">Business Account</SelectItem>
                            <SelectItem value="account3">Savings Account</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </>
          )}
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Bill description..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={createBillMutation.isPending}>
            {createBillMutation.isPending ? "Creating..." : "Create Bill"}
          </Button>
        </div>
      </form>
    </Form>
  );
}