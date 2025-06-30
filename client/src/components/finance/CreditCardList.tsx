import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  CreditCard, 
  Plus, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Calendar,
  TrendingUp,
  DollarSign,
  Percent,
  RefreshCw
} from "lucide-react";
import { CreditCardFormTrigger } from "./CreditCardForm";

interface CreditCardData {
  id: string;
  card_name: string;
  bank_name: string;
  last_4_digits: string;
  current_balance: string | number;
  credit_limit: string | number;
  available_credit: string | number;
  apr: string | number;
  statement_closing_day: number;
  payment_due_days_after_statement: number;
  currency: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export function CreditCardList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: creditCards = [], isLoading, error, refetch } = useQuery({
    queryKey: ["/api/finance/credit-cards"],
    staleTime: 0, // Always refetch
    gcTime: 0 // Don't cache
  });

  // Ensure creditCards is always an array
  const safeCreditCards = Array.isArray(creditCards) ? creditCards : [];
  
  console.log("Credit Cards Data:", creditCards);
  console.log("Safe Credit Cards:", safeCreditCards);
  console.log("Safe Credit Cards Length:", safeCreditCards.length);
  console.log("Is Loading:", isLoading);
  console.log("Error:", error);

  const deleteMutation = useMutation({
    mutationFn: async (cardId: string) => {
      await apiRequest("DELETE", `/api/finance/credit-cards/${cardId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/credit-cards"] });
      toast({
        title: "Success",
        description: "Credit card deleted successfully"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete credit card",
        variant: "destructive"
      });
    }
  });

  const handleDelete = (cardId: string) => {
    if (confirm("Are you sure you want to delete this credit card?")) {
      deleteMutation.mutate(cardId);
    }
  };

  const formatCurrency = (amount: string | number, currency: string = "MXN") => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency
    }).format(Number(amount));
  };

  const formatPercentage = (rate: string | number) => {
    return `${(Number(rate) * 100).toFixed(2)}%`;
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 90) return "text-red-600 dark:text-red-400";
    if (utilization >= 70) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  const calculateUtilization = (currentBalance: string | number, creditLimit: string | number) => {
    const balance = Number(currentBalance);
    const limit = Number(creditLimit);
    const utilization = (Math.abs(balance) / limit) * 100;
    return Math.min(utilization, 100);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="h-20 bg-gray-200 dark:bg-gray-700 rounded-t-lg"></CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Credit Cards</h2>
          <p className="text-muted-foreground">
            Manage your credit card accounts and track debt
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <CreditCardFormTrigger>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Credit Card
            </Button>
          </CreditCardFormTrigger>
        </div>
      </div>

      {/* Credit Cards Grid */}
      {safeCreditCards.length === 0 ? (
        <Card className="p-8 text-center">
          <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Credit Cards Yet</h3>
          <p className="text-muted-foreground mb-4">
            Add your first credit card to start tracking debt and statements
          </p>
          <CreditCardFormTrigger>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Credit Card
            </Button>
          </CreditCardFormTrigger>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {safeCreditCards.map((card: CreditCardData) => {
            const utilization = calculateUtilization(card.current_balance, card.credit_limit);
            const utilizationColor = getUtilizationColor(utilization);
            
            return (
              <Card key={card.id} className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg font-semibold">
                        {card.card_name}
                      </CardTitle>
                      <p className="text-blue-100 text-sm">
                        {card.bank_name} •••• {card.last_4_digits}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <CreditCardFormTrigger creditCard={card}>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                        </CreditCardFormTrigger>
                        <DropdownMenuItem 
                          onClick={() => handleDelete(card.id)}
                          className="text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {/* Current Balance */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current Balance</span>
                    <span className={`font-semibold ${card.current_balance < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {formatCurrency(card.current_balance, card.currency)}
                    </span>
                  </div>

                  {/* Credit Limit & Available Credit */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Credit Limit</span>
                      <span className="font-medium">
                        {formatCurrency(card.credit_limit, card.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Available Credit</span>
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(card.available_credit, card.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Utilization Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Utilization</span>
                      <span className={`font-medium ${utilizationColor}`}>
                        {utilization.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          utilization >= 90 ? 'bg-red-500' :
                          utilization >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* APR and Statement Info */}
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div className="text-center">
                      <div className="flex items-center justify-center text-muted-foreground mb-1">
                        <Percent className="h-3 w-3 mr-1" />
                        <span className="text-xs">APR</span>
                      </div>
                      <p className="font-semibold text-sm">
                        {formatPercentage(card.apr)}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center text-muted-foreground mb-1">
                        <Calendar className="h-3 w-3 mr-1" />
                        <span className="text-xs">Statement</span>
                      </div>
                      <p className="font-semibold text-sm">
                        Day {card.statement_closing_day}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex justify-between items-center pt-2">
                    <Badge variant={card.is_active ? "default" : "secondary"}>
                      {card.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Due: {card.payment_due_days_after_statement} days after statement
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}