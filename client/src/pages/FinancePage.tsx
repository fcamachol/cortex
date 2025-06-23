import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransactionForm } from "@/components/finance/TransactionForm";
import { LoanForm } from "@/components/finance/LoanForm";
import { AccountForm } from "@/components/finance/AccountForm";
import { AccountList } from "@/components/finance/AccountList";
import { Plus, TrendingUp, TrendingDown, DollarSign, Calendar, Receipt, CreditCard, Filter, Building2 } from "lucide-react";

export default function FinancePage() {
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showPayableForm, setShowPayableForm] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [dateFilter, setDateFilter] = useState("this-month");

  // Fetch financial overview
  const { data: overview = {} } = useQuery({
    queryKey: ["/api/finance/overview", dateFilter],
    staleTime: 30000, // 30 seconds
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/finance/categories"],
    staleTime: 30000,
  });

  // Fetch transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ["/api/finance/transactions", dateFilter],
    staleTime: 30000,
  });

  // Fetch payables
  const { data: payables = [] } = useQuery({
    queryKey: ["/api/finance/payables", dateFilter],
    staleTime: 30000,
  });

  // Fetch loans
  const { data: loans = [] } = useQuery({
    queryKey: ["/api/finance/loans", dateFilter],
    staleTime: 30000,
  });

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 p-6 border-b bg-background">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Finance</h1>
            <p className="text-muted-foreground">
              Manage your financial transactions, bills, and loans
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this-week">This Week</SelectItem>
                  <SelectItem value="last-week">Last Week</SelectItem>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="this-quarter">This Quarter</SelectItem>
                  <SelectItem value="last-quarter">Last Quarter</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                  <SelectItem value="last-year">Last Year</SelectItem>
                  <SelectItem value="all-time">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Financial Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ${(overview as any)?.totalIncome?.toLocaleString() || "0.00"}
                </div>
                <p className="text-xs text-muted-foreground">
                  +{(overview as any)?.incomeChange || "0"}% from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  ${(overview as any)?.totalExpenses?.toLocaleString() || "0.00"}
                </div>
                <p className="text-xs text-muted-foreground">
                  +{(overview as any)?.expenseChange || "0"}% from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Bills</CardTitle>
                <Receipt className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(overview as any)?.pendingBills || "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  ${(overview as any)?.pendingAmount?.toLocaleString() || "0.00"} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
                <CreditCard className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(overview as any)?.activeLoans || "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  ${(overview as any)?.totalLoanBalance?.toLocaleString() || "0.00"} balance
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="payables">Bills</TabsTrigger>
              <TabsTrigger value="loans">Loans</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Financial Dashboard</CardTitle>
                  <CardDescription>
                    Overview of your financial activity and key metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium">Recent Transactions</h4>
                      <div className="space-y-2">
                        {transactions.slice(0, 5).map((transaction: any, index: number) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                            <div>
                              <p className="text-sm font-medium">{transaction.description || "Transaction"}</p>
                              <p className="text-xs text-muted-foreground">{transaction.date || "Today"}</p>
                            </div>
                            <div className={`text-sm font-medium ${
                              transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transaction.type === 'income' ? '+' : '-'}${transaction.amount || "0.00"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium">Upcoming Bills</h4>
                      <div className="space-y-2">
                        {payables.slice(0, 5).map((payable: any, index: number) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                            <div>
                              <p className="text-sm font-medium">{payable.description || "Bill"}</p>
                              <p className="text-xs text-muted-foreground">{payable.dueDate || "Due soon"}</p>
                            </div>
                            <Badge variant={payable.status === 'overdue' ? 'destructive' : 'secondary'}>
                              ${payable.amount || "0.00"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Transactions</h3>
                <Button onClick={() => setShowTransactionForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Transaction
                </Button>
              </div>
              
              <Card>
                <CardContent className="p-6">
                  {transactions.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No transactions found.</p>
                      <Button className="mt-4" onClick={() => setShowTransactionForm(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Transaction
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {transactions.map((transaction: any, index: number) => (
                        <div key={index} className="flex justify-between items-center p-4 border rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{transaction.description || "Transaction"}</p>
                            <p className="text-sm text-muted-foreground">
                              {transaction.category || "Uncategorized"} • {transaction.date || "Today"}
                            </p>
                          </div>
                          <div className={`text-lg font-medium ${
                            transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'income' ? '+' : '-'}${transaction.amount || "0.00"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payables" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Bills & Payables</h3>
                <Button onClick={() => setShowPayableForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Bill
                </Button>
              </div>
              
              <Card>
                <CardContent className="p-6">
                  {payables.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No bills found.</p>
                      <Button className="mt-4" onClick={() => setShowPayableForm(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Bill
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {payables.map((payable: any, index: number) => (
                        <div key={index} className="flex justify-between items-center p-4 border rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{payable.description || "Bill"}</p>
                            <p className="text-sm text-muted-foreground">
                              Due: {payable.dueDate || "Not specified"}
                            </p>
                          </div>
                          <div className="flex items-center space-x-4">
                            <Badge variant={payable.status === 'overdue' ? 'destructive' : 'secondary'}>
                              {payable.status || "pending"}
                            </Badge>
                            <span className="text-lg font-medium">${payable.amount || "0.00"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="loans" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Loans</h3>
                <Button onClick={() => setShowLoanForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Loan
                </Button>
              </div>
              
              <Card>
                <CardContent className="p-6">
                  {loans.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No loans found.</p>
                      <Button className="mt-4" onClick={() => setShowLoanForm(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Loan
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {loans.map((loan: any, index: number) => (
                        <div key={index} className="flex justify-between items-center p-4 border rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{loan.description || "Loan"}</p>
                            <p className="text-sm text-muted-foreground">
                              {loan.interestRate || "0"}% interest • {loan.termMonths || "0"} months
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-medium">${loan.currentBalance || "0.00"}</p>
                            <p className="text-sm text-muted-foreground">
                              of ${loan.principalAmount || "0.00"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Financial Reports</CardTitle>
                  <CardDescription>
                    Analyze your financial data with detailed reports and insights
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Reports feature coming soon.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      We're working on comprehensive financial reporting tools.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Transaction Form Modal */}
      <TransactionForm 
        open={showTransactionForm} 
        onClose={() => setShowTransactionForm(false)} 
      />

      {/* Loan Form Modal */}
      <LoanForm 
        open={showLoanForm} 
        onClose={() => setShowLoanForm(false)} 
      />
    </div>
  );
}