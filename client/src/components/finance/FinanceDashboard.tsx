import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, DollarSign, Calendar, Receipt, CreditCard, ArrowUp, ArrowDown } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function FinanceDashboard() {
  const [dateRange, setDateRange] = useState("this-month");

  // Fetch financial overview data
  const { data: overview, isLoading } = useQuery({
    queryKey: ["/api/finance/overview", dateRange],
    staleTime: 30000,
  });

  // Fetch cash flow data for chart
  const { data: cashFlow } = useQuery({
    queryKey: ["/api/finance/cash-flow", dateRange],
    staleTime: 30000,
  });

  // Fetch expense breakdown for pie chart
  const { data: expenseBreakdown } = useQuery({
    queryKey: ["/api/finance/expense-breakdown", dateRange],
    staleTime: 30000,
  });

  // Fetch upcoming bills
  const { data: upcomingBills } = useQuery({
    queryKey: ["/api/finance/upcoming-bills"],
    staleTime: 30000,
  });

  // Fetch loan balances
  const { data: loanBalances } = useQuery({
    queryKey: ["/api/finance/loan-balances"],
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-0 pb-2">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const netAmount = (overview?.totalIncome || 0) - (overview?.totalExpenses || 0);
  const isProfit = netAmount >= 0;

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Financial Dashboard</h2>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select time period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this-week">This Week</SelectItem>
            <SelectItem value="this-month">This Month</SelectItem>
            <SelectItem value="this-quarter">This Quarter</SelectItem>
            <SelectItem value="year-to-date">Year to Date</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Total Income</CardTitle>
            <div className="flex items-center text-green-600">
              <ArrowUp className="h-4 w-4 mr-1" />
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              ${overview?.totalIncome?.toLocaleString() || "0.00"}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <ArrowUp className="h-3 w-3 mr-1 text-green-500" />
              +{overview?.incomeChange || "0"}% from last period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Total Expenses</CardTitle>
            <div className="flex items-center text-red-600">
              <ArrowDown className="h-4 w-4 mr-1" />
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              ${overview?.totalExpenses?.toLocaleString() || "0.00"}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <ArrowUp className="h-3 w-3 mr-1 text-red-500" />
              +{overview?.expenseChange || "0"}% from last period
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit/Loss</CardTitle>
            <DollarSign className={`h-4 w-4 ${isProfit ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
              ${Math.abs(netAmount).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isProfit ? 'Profit' : 'Loss'} for {dateRange.replace('-', ' ')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Flow Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Cash Flow Trend</CardTitle>
            <CardDescription>Monthly income vs expenses over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cashFlow || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [`$${value.toLocaleString()}`, name === 'income' ? 'Income' : 'Expenses']}
                />
                <Bar dataKey="income" fill="#22c55e" name="income" />
                <Bar dataKey="expenses" fill="#ef4444" name="expenses" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expense Breakdown Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
            <CardDescription>Spending by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expenseBreakdown || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {(expenseBreakdown || []).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Amount']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row - Upcoming Bills and Loans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Bills Widget */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-orange-600" />
              Upcoming Bills
            </CardTitle>
            <CardDescription>Next bills due</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingBills?.slice(0, 5).map((bill: any) => (
              <div key={bill.payableId} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{bill.description}</p>
                  <p className="text-sm text-muted-foreground">
                    Due in {bill.daysUntilDue} days • {new Date(bill.dueDate).toLocaleDateString()}
                  </p>
                  {bill.amountPaid > 0 && (
                    <Progress 
                      value={(bill.amountPaid / bill.totalAmount) * 100} 
                      className="mt-2 h-2"
                    />
                  )}
                </div>
                <div className="text-right ml-4">
                  <p className="font-semibold">${bill.totalAmount.toLocaleString()}</p>
                  <Badge 
                    variant={
                      bill.status === 'overdue' ? 'destructive' : 
                      bill.status === 'paid' ? 'default' : 
                      bill.status === 'partially_paid' ? 'secondary' : 'outline'
                    }
                  >
                    {bill.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))}
            {(!upcomingBills || upcomingBills.length === 0) && (
              <p className="text-muted-foreground text-center py-4">No upcoming bills</p>
            )}
          </CardContent>
        </Card>

        {/* Loan Balances Widget */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              Active Loans
            </CardTitle>
            <CardDescription>Current loan balances</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loanBalances?.map((loan: any) => (
              <div key={loan.loanId} className="p-3 border rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium">{loan.loanName}</p>
                    <p className="text-sm text-muted-foreground">
                      {loan.interestRate}% APR
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${loan.currentBalance.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">
                      of ${loan.originalAmount.toLocaleString()}
                    </p>
                  </div>
                </div>
                <Progress 
                  value={((loan.originalAmount - loan.currentBalance) / loan.originalAmount) * 100} 
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round(((loan.originalAmount - loan.currentBalance) / loan.originalAmount) * 100)}% paid off
                </p>
              </div>
            ))}
            {(!loanBalances || loanBalances.length === 0) && (
              <p className="text-muted-foreground text-center py-4">No active loans</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}