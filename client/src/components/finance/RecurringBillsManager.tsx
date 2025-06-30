import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Repeat, 
  Calendar, 
  Clock, 
  Play, 
  DollarSign,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface RecurringBill {
  id: string;
  bill_number: string;
  vendor_name: string;
  amount: number;
  recurrence_type: string;
  recurrence_interval?: number;
  next_due_date: string;
  recurrence_end_date?: string;
  auto_pay_enabled: boolean;
  status: string;
  total_instances: number;
  last_generated_at?: string;
}

interface UpcomingBill {
  id: string;
  bill_number: string;
  vendor_name: string;
  amount: number;
  due_date: string;
  recurrence_type: string;
  parent_bill_id: string;
  days_until_due: number;
}

export function RecurringBillsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch recurring bill templates
  const { data: recurringBills, isLoading: loadingTemplates } = useQuery({
    queryKey: ["/api/finance/recurring-bills"],
    queryFn: async () => {
      const response = await fetch("/api/finance/recurring-bills");
      if (!response.ok) throw new Error("Failed to fetch recurring bills");
      return response.json();
    },
  });

  // Fetch upcoming bills
  const { data: upcomingBills, isLoading: loadingUpcoming } = useQuery({
    queryKey: ["/api/finance/recurring-bills/upcoming"],
    queryFn: async () => {
      const response = await fetch("/api/finance/recurring-bills/upcoming");
      if (!response.ok) throw new Error("Failed to fetch upcoming bills");
      return response.json();
    },
  });

  // Manual bill generation
  const generateBillMutation = useMutation({
    mutationFn: async (parentBillId: string) => {
      const response = await fetch(`/api/finance/recurring-bills/${parentBillId}/generate`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to generate bill");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/recurring-bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/payables"] });
      toast({
        title: "Success",
        description: "Bill generated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate bill",
        variant: "destructive",
      });
    },
  });

  // Process all due bills
  const processAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/finance/recurring-bills/process", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to process bills");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/recurring-bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/payables"] });
      toast({
        title: "Success",
        description: data.message || "Bills processed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process bills",
        variant: "destructive",
      });
    },
  });

  const getRecurrenceDisplay = (bill: RecurringBill) => {
    if (bill.recurrence_type === "custom") {
      return `Every ${bill.recurrence_interval} days`;
    }
    return bill.recurrence_type.charAt(0).toUpperCase() + bill.recurrence_type.slice(1);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { color: "bg-green-100 text-green-800", icon: CheckCircle2 },
      paused: { color: "bg-yellow-100 text-yellow-800", icon: AlertCircle },
      completed: { color: "bg-gray-100 text-gray-800", icon: CheckCircle2 },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Repeat className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-semibold">Recurring Bills</h2>
        </div>
        <Button 
          onClick={() => processAllMutation.mutate()}
          disabled={processAllMutation.isPending}
          className="flex items-center space-x-2"
        >
          <Play className="h-4 w-4" />
          <span>Process All Due Bills</span>
        </Button>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates" className="flex items-center space-x-2">
            <Repeat className="h-4 w-4" />
            <span>Templates</span>
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Upcoming Bills</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Repeat className="h-5 w-5" />
                <span>Recurring Bill Templates</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTemplates ? (
                <div className="text-center py-8">Loading templates...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill Number</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Next Due</TableHead>
                      <TableHead>Auto-Pay</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recurringBills?.map((bill: RecurringBill) => (
                      <TableRow key={bill.id}>
                        <TableCell className="font-medium">{bill.bill_number}</TableCell>
                        <TableCell>{bill.vendor_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span>${bill.amount.toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getRecurrenceDisplay(bill)}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4 text-blue-600" />
                            <span>{format(new Date(bill.next_due_date), "MMM dd, yyyy")}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {bill.auto_pay_enabled ? (
                            <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                          ) : (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(bill.status)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateBillMutation.mutate(bill.id)}
                            disabled={generateBillMutation.isPending}
                            className="flex items-center space-x-1"
                          >
                            <Play className="h-3 w-3" />
                            <span>Generate Now</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {recurringBills?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No recurring bills configured
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Upcoming Bills</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingUpcoming ? (
                <div className="text-center py-8">Loading upcoming bills...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bill Number</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Days Until Due</TableHead>
                      <TableHead>Frequency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingBills?.map((bill: UpcomingBill) => (
                      <TableRow key={bill.id}>
                        <TableCell className="font-medium">{bill.bill_number}</TableCell>
                        <TableCell>{bill.vendor_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span>${bill.amount.toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            <span>{format(new Date(bill.due_date), "MMM dd, yyyy")}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              bill.days_until_due <= 3 
                                ? "bg-red-100 text-red-800" 
                                : bill.days_until_due <= 7 
                                ? "bg-yellow-100 text-yellow-800" 
                                : "bg-green-100 text-green-800"
                            }
                          >
                            {bill.days_until_due} days
                          </Badge>
                        </TableCell>
                        <TableCell>{bill.recurrence_type}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {upcomingBills?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No upcoming bills scheduled
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}