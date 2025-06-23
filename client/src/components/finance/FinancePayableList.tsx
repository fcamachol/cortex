import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Receipt, Calendar, DollarSign, AlertTriangle } from "lucide-react";
import { format, isAfter, differenceInDays } from "date-fns";

interface Payable {
  payableId: number;
  description: string;
  totalAmount: number;
  amountPaid: number;
  dueDate: string;
  status: "unpaid" | "partially_paid" | "paid" | "overdue";
  categoryName?: string;
  contactName?: string;
}

export function FinancePayableList() {
  // Fetch payables
  const { data: payables, isLoading } = useQuery({
    queryKey: ["/api/finance/payables"],
    staleTime: 30000,
  });

  // Fetch recurring bills
  const { data: recurringBills } = useQuery({
    queryKey: ["/api/finance/recurring-bills"],
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bills & Payables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex space-x-4 p-4 border rounded-lg">
                <div className="rounded-full bg-gray-200 h-10 w-10"></div>
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded w-20"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const upcomingBills = payables?.filter((bill: Payable) => 
    bill.status === 'unpaid' || bill.status === 'partially_paid'
  ) || [];

  const paidBills = payables?.filter((bill: Payable) => bill.status === 'paid') || [];
  const overdueBills = payables?.filter((bill: Payable) => bill.status === 'overdue') || [];

  const getBillStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'default';
      case 'partially_paid': return 'secondary';
      case 'overdue': return 'destructive';
      default: return 'outline';
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    const days = differenceInDays(new Date(dueDate), new Date());
    if (days < 0) return `${Math.abs(days)} days overdue`;
    if (days === 0) return 'Due today';
    return `Due in ${days} days`;
  };

  const PayableCard = ({ bill }: { bill: Payable }) => {
    const progressPercentage = bill.totalAmount > 0 ? (bill.amountPaid / bill.totalAmount) * 100 : 0;
    const isOverdue = isAfter(new Date(), new Date(bill.dueDate)) && bill.status !== 'paid';

    return (
      <div className="p-4 border rounded-lg space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{bill.description}</h3>
              {isOverdue && <AlertTriangle className="h-4 w-4 text-red-500" />}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {getDaysUntilDue(bill.dueDate)}
              </span>
              {bill.categoryName && (
                <Badge variant="outline" className="text-xs">
                  {bill.categoryName}
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold">${bill.totalAmount.toLocaleString()}</div>
            {bill.amountPaid > 0 && (
              <div className="text-sm text-muted-foreground">
                ${bill.amountPaid.toLocaleString()} paid
              </div>
            )}
            <Badge variant={getBillStatusColor(bill.status)} className="mt-1">
              {bill.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </div>

        {bill.amountPaid > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Payment Progress</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        )}

        {bill.contactName && (
          <div className="text-sm text-muted-foreground">
            Contact: {bill.contactName}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upcoming" className="relative">
            Upcoming Bills
            {upcomingBills.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {upcomingBills.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="recurring">
            Recurring Templates
          </TabsTrigger>
          <TabsTrigger value="history">
            Payment History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Upcoming Bills
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {overdueBills.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Overdue Bills</span>
                  </div>
                  {overdueBills.map((bill: Payable) => (
                    <PayableCard key={bill.payableId} bill={bill} />
                  ))}
                </div>
              )}

              {upcomingBills.length > 0 ? (
                <div className="space-y-4">
                  {overdueBills.length > 0 && <hr />}
                  {upcomingBills.map((bill: Payable) => (
                    <PayableCard key={bill.payableId} bill={bill} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No upcoming bills</p>
                  <p className="text-sm">All bills are paid or add your first bill</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recurring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recurring Bill Templates</CardTitle>
            </CardHeader>
            <CardContent>
              {recurringBills && recurringBills.length > 0 ? (
                <div className="space-y-4">
                  {recurringBills.map((template: any) => (
                    <div key={template.recurringBillId} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{template.description}</h3>
                          <p className="text-sm text-muted-foreground">
                            ${template.amount.toLocaleString()} • {template.frequency}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Next due: {format(new Date(template.nextDueDate), "MMM dd, yyyy")}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {template.isActive ? 'Active' : 'Paused'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recurring bill templates</p>
                  <p className="text-sm">Set up recurring bills to automate your payments</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {paidBills.length > 0 ? (
                <div className="space-y-4">
                  {paidBills.map((bill: Payable) => (
                    <PayableCard key={bill.payableId} bill={bill} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No payment history</p>
                  <p className="text-sm">Paid bills will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}