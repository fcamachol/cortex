import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Filter, MessageSquare, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface Transaction {
  transactionId: number;
  amount: number;
  type: "income" | "expense";
  description: string;
  transactionDate: string;
  categoryName?: string;
  contactName?: string;
  linkedToWhatsApp?: boolean;
}

export function FinanceTransactionList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  // Fetch transactions with filters
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["/api/finance/transactions", { 
      search: searchTerm, 
      type: typeFilter, 
      category: categoryFilter, 
      dateRange 
    }],
    staleTime: 30000,
  });

  // Fetch categories for filter dropdown
  const { data: categories } = useQuery({
    queryKey: ["/api/finance/categories"],
    staleTime: 300000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex space-x-4">
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction Log</CardTitle>
        
        {/* Filtering Bar */}
        <div className="flex flex-wrap gap-4 mt-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map((category: any) => (
                <SelectItem key={category.categoryId} value={category.categoryId.toString()}>
                  {category.categoryName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-32">Category</TableHead>
                <TableHead className="w-32 text-right">Amount</TableHead>
                <TableHead className="w-32">Contact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions?.map((transaction: Transaction) => (
                <TableRow key={transaction.transactionId}>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(transaction.transactionDate), "MMM dd")}
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{transaction.description}</span>
                      {transaction.linkedToWhatsApp && (
                        <MessageSquare className="h-4 w-4 text-green-600" title="Logged via WhatsApp" />
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {transaction.categoryName && (
                      <Badge variant="secondary" className="text-xs">
                        {transaction.categoryName}
                      </Badge>
                    )}
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <span className={`font-semibold ${
                      transaction.type === 'income' ? 'text-green-600' : 'text-gray-900'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}${transaction.amount.toLocaleString()}
                    </span>
                  </TableCell>
                  
                  <TableCell className="text-sm text-muted-foreground">
                    {transaction.contactName}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {(!transactions || transactions.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transactions found</p>
              <p className="text-sm">Try adjusting your filters or add your first transaction</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}