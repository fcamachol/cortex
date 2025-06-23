import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, TrendingUp, TrendingDown, DollarSign, Calendar, Receipt, CreditCard } from "lucide-react";
import { FinanceTransactionForm } from "@/components/finance/FinanceTransactionForm";
import { FinancePayableForm } from "@/components/finance/FinancePayableForm";
import { FinanceLoanForm } from "@/components/finance/FinanceLoanForm";
import { FinanceTransactionList } from "@/components/finance/FinanceTransactionList";
import { FinancePayableList } from "@/components/finance/FinancePayableList";
import { FinanceLoanList } from "@/components/finance/FinanceLoanList";
import { FinanceDashboard } from "@/components/finance/FinanceDashboard";

export default function FinancePage() {
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showPayableForm, setShowPayableForm] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);

  // Fetch financial overview
  const { data: overview } = useQuery({
    queryKey: ["/api/finance/overview"],
    staleTime: 30000, // 30 seconds
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Finance</h1>
          <p className="text-muted-foreground">
            Manage your financial transactions, bills, and loans
          </p>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${overview?.totalIncome?.toLocaleString() || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              +{overview?.incomeChange || "0"}% from last month
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
              ${overview?.totalExpenses?.toLocaleString() || "0.00"}
            </div>
            <p className="text-xs text-muted-foreground">
              +{overview?.expenseChange || "0"}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Bills</CardTitle>
            <Receipt className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {overview?.pendingBills || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              ${overview?.pendingAmount?.toLocaleString() || "0.00"} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {overview?.activeLoans || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              ${overview?.totalLoanBalance?.toLocaleString() || "0.00"} balance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Finance Interface */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="payables">Bills & Payables</TabsTrigger>
          <TabsTrigger value="loans">Loans</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <FinanceDashboard />
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Transactions</h2>
            <Button onClick={() => setShowTransactionForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          </div>
          <FinanceTransactionList />
          {showTransactionForm && (
            <FinanceTransactionForm 
              onClose={() => setShowTransactionForm(false)} 
            />
          )}
        </TabsContent>

        <TabsContent value="payables" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Bills & Payables</h2>
            <Button onClick={() => setShowPayableForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Bill
            </Button>
          </div>
          <FinancePayableList />
          {showPayableForm && (
            <FinancePayableForm 
              onClose={() => setShowPayableForm(false)} 
            />
          )}
        </TabsContent>

        <TabsContent value="loans" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Loans</h2>
            <Button onClick={() => setShowLoanForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Loan
            </Button>
          </div>
          <FinanceLoanList />
          {showLoanForm && (
            <FinanceLoanForm 
              onClose={() => setShowLoanForm(false)} 
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}