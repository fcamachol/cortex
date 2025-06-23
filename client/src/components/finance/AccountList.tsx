import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AccountForm } from "./AccountForm";
import { 
  Building2, 
  CreditCard, 
  Wallet, 
  TrendingUp, 
  MoreHorizontal, 
  Edit, 
  Trash2,
  Eye,
  EyeOff,
  DollarSign
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AccountListProps {
  spaceId: number;
}

const getAccountIcon = (accountType: string) => {
  switch (accountType) {
    case "checking":
    case "savings":
      return <Building2 className="h-4 w-4" />;
    case "credit_card":
      return <CreditCard className="h-4 w-4" />;
    case "investment":
    case "retirement":
      return <TrendingUp className="h-4 w-4" />;
    case "cash":
    case "crypto":
      return <Wallet className="h-4 w-4" />;
    default:
      return <DollarSign className="h-4 w-4" />;
  }
};

const getAccountTypeLabel = (accountType: string) => {
  const types: { [key: string]: string } = {
    checking: "Checking",
    savings: "Savings",
    credit_card: "Credit Card",
    investment: "Investment",
    loan: "Loan",
    mortgage: "Mortgage",
    business: "Business",
    cash: "Cash",
    crypto: "Cryptocurrency",
    retirement: "Retirement",
    other: "Other"
  };
  return types[accountType] || accountType;
};

export function AccountList({ spaceId }: AccountListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [showEditForm, setShowEditForm] = useState(false);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["/api/finance/accounts", spaceId],
    queryFn: () => apiRequest(`/api/finance/accounts?spaceId=${spaceId}`),
    staleTime: 25000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (accountId: number) => {
      return await apiRequest(`/api/finance/accounts/${accountId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/accounts"] });
      toast({
        title: "Success",
        description: "Account deleted successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete account",
        variant: "destructive"
      });
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ accountId, isActive }: { accountId: number; isActive: boolean }) => {
      return await apiRequest(`/api/finance/accounts/${accountId}`, "PUT", { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/accounts"] });
      toast({
        title: "Success",
        description: "Account updated successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update account",
        variant: "destructive"
      });
    }
  });

  const formatCurrency = (amount: string | number, currency: string = "USD") => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2
    }).format(num);
  };

  const handleEdit = (account: any) => {
    setEditingAccount(account);
    setShowEditForm(true);
  };

  const handleCloseEditForm = () => {
    setEditingAccount(null);
    setShowEditForm(false);
  };

  const handleToggleActive = (account: any) => {
    toggleActiveMutation.mutate({
      accountId: account.accountId,
      isActive: !account.isActive
    });
  };

  const handleDelete = (accountId: number) => {
    deleteMutation.mutate(accountId);
  };

  // Calculate totals
  const activeAccounts = Array.isArray(accounts) ? accounts.filter((account: any) => account.isActive) : [];
  const totalBalance = activeAccounts.reduce((sum: number, account: any) => {
    return sum + parseFloat(account.currentBalance || "0");
  }, 0);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading accounts...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Accounts Overview
            </span>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Total Balance</div>
              <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">{activeAccounts.length}</div>
              <div className="text-sm text-muted-foreground">Active Accounts</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">
                {activeAccounts.filter((a: any) => a.accountType === "checking" || a.accountType === "savings").length}
              </div>
              <div className="text-sm text-muted-foreground">Bank Accounts</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">
                {activeAccounts.filter((a: any) => a.accountType === "credit_card").length}
              </div>
              <div className="text-sm text-muted-foreground">Credit Cards</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {!Array.isArray(accounts) || accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No accounts found</p>
              <p className="text-sm">Create your first account to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account: any) => (
                  <TableRow key={account.accountId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {getAccountIcon(account.accountType)}
                        <div>
                          <div className="font-medium">{account.accountName}</div>
                          {account.accountNumber && (
                            <div className="text-sm text-muted-foreground">
                              ****{account.accountNumber.slice(-4)}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getAccountTypeLabel(account.accountType)}
                      </Badge>
                    </TableCell>
                    <TableCell>{account.institutionName || "-"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(account.currentBalance, account.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.isActive ? "default" : "secondary"}>
                        {account.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(account)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(account)}>
                            {account.isActive ? (
                              <>
                                <EyeOff className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Account</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{account.accountName}"? 
                                  This action cannot be undone and will affect any linked transactions.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(account.accountId)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Account Form */}
      {showEditForm && editingAccount && (
        <AccountForm
          open={showEditForm}
          onClose={handleCloseEditForm}
          spaceId={spaceId}
          account={editingAccount}
        />
      )}
    </div>
  );
}