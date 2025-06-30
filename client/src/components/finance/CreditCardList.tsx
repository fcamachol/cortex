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
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { CreditCardFormTrigger } from "./CreditCardForm";
import { 
  CreditCardData,
  calculateDebt,
  calculateUtilization,
  formatCurrency,
  getUtilizationStatus,
  getPaymentDueDate,
  formatDate,
  getCardStatus
} from "@/lib/credit-card-utils";

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

  const formatPercentage = (rate: string | number) => {
    return `${(Number(rate) * 100).toFixed(2)}%`;
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
            const utilizationStatus = getUtilizationStatus(utilization);
            const debt = calculateDebt(card.current_balance);
            const cardStatus = getCardStatus(card.current_balance, card.credit_limit);
            const paymentDueDate = getPaymentDueDate(card.statement_closing_day, card.payment_due_days_after_statement);
            
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
                  {/* Current Balance / Debt */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {debt > 0 ? 'Current Debt' : 'Current Balance'}
                    </span>
                    <span className={`font-semibold ${cardStatus.color}`}>
                      {formatCurrency(debt > 0 ? debt : card.current_balance, card.currency)}
                    </span>
                  </div>
                  
                  {/* Debt Warning */}
                  {debt > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <span className="text-sm text-red-700 dark:text-red-300">
                        Over limit by {formatCurrency(debt - Math.abs(Number(card.current_balance)), card.currency)}
                      </span>
                    </div>
                  )}

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
                      <span className={`font-medium ${utilizationStatus.color}`}>
                        {utilization.toFixed(1)}% - {utilizationStatus.label}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${utilizationStatus.barColor}`}
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

                  {/* Payment Due Date */}
                  <div className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        Next Payment Due
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                      {formatDate(paymentDueDate)}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="flex justify-between items-center pt-2">
                    <Badge variant={card.is_active ? "default" : "secondary"}>
                      {card.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant={cardStatus.status === 'overlimit' ? 'destructive' : 'secondary'}>
                      {cardStatus.label}
                    </Badge>
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