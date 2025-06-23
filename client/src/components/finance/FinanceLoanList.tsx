import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CreditCard, TrendingDown, Calendar, DollarSign, Calculator } from "lucide-react";
import { format } from "date-fns";

interface Loan {
  loanId: number;
  loanName: string;
  originalAmount: number;
  currentBalance: number;
  interestRate: number;
  moratoryRate?: number;
  termMonths: number;
  paymentAmount: number;
  startDate: string;
  status: "active" | "paid_off" | "in_arrears";
  contactName?: string;
  notes?: string;
}

export function FinanceLoanList() {
  const [selectedLoan, setSelectedLoan] = useState<number | null>(null);

  // Fetch loans
  const { data: loans, isLoading } = useQuery({
    queryKey: ["/api/finance/loans"],
    staleTime: 30000,
  });

  // Fetch loan payments for selected loan
  const { data: loanPayments } = useQuery({
    queryKey: ["/api/finance/loan-payments", selectedLoan],
    enabled: !!selectedLoan,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex space-x-4 p-4 border rounded-lg">
                <div className="rounded-full bg-gray-200 h-12 w-12"></div>
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-2 bg-gray-200 rounded w-full"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded w-20"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeLoans = loans?.filter((loan: Loan) => loan.status === 'active') || [];
  const paidOffLoans = loans?.filter((loan: Loan) => loan.status === 'paid_off') || [];
  const arrearsLoans = loans?.filter((loan: Loan) => loan.status === 'in_arrears') || [];

  const getLoanStatusColor = (status: string) => {
    switch (status) {
      case 'paid_off': return 'default';
      case 'in_arrears': return 'destructive';
      default: return 'secondary';
    }
  };

  const getPayoffProgress = (loan: Loan) => {
    if (loan.originalAmount <= 0) return 0;
    return ((loan.originalAmount - loan.currentBalance) / loan.originalAmount) * 100;
  };

  const calculateMonthsRemaining = (loan: Loan) => {
    if (loan.currentBalance <= 0 || loan.paymentAmount <= 0) return 0;
    // Simple calculation - in real app you'd use proper amortization
    return Math.ceil(loan.currentBalance / loan.paymentAmount);
  };

  const LoanCard = ({ loan }: { loan: Loan }) => {
    const progressPercentage = getPayoffProgress(loan);
    const monthsRemaining = calculateMonthsRemaining(loan);
    const isSelected = selectedLoan === loan.loanId;

    return (
      <Card 
        className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500' : 'hover:shadow-md'}`}
        onClick={() => setSelectedLoan(isSelected ? null : loan.loanId)}
      >
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{loan.loanName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {loan.interestRate}% APR • {loan.termMonths} months
                  </p>
                </div>
              </div>
              <Badge variant={getLoanStatusColor(loan.status)}>
                {loan.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${loan.currentBalance.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Payment</p>
                <p className="text-2xl font-bold">
                  ${loan.paymentAmount.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Payoff Progress</span>
                <span>{Math.round(progressPercentage)}% Complete</span>
              </div>
              <Progress value={progressPercentage} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>${(loan.originalAmount - loan.currentBalance).toLocaleString()} paid</span>
                <span>${loan.originalAmount.toLocaleString()} total</span>
              </div>
            </div>

            {/* Additional Info */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Started {format(new Date(loan.startDate), "MMM yyyy")}</span>
              </div>
              {loan.status === 'active' && (
                <div className="flex items-center gap-1">
                  <TrendingDown className="h-4 w-4" />
                  <span>~{monthsRemaining} months left</span>
                </div>
              )}
            </div>

            {/* Contact and Moratory Rate */}
            {(loan.contactName || loan.moratoryRate) && (
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {loan.contactName && (
                  <span>Lender: {loan.contactName}</span>
                )}
                {loan.moratoryRate && (
                  <span>Late Rate: {loan.moratoryRate}%</span>
                )}
              </div>
            )}

            {/* Expanded Details */}
            {isSelected && (
              <div className="mt-6 pt-4 border-t space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Loan Details
                    </h4>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Original Amount:</span>
                        <span className="font-medium">${loan.originalAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Interest Rate:</span>
                        <span className="font-medium">{loan.interestRate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Term:</span>
                        <span className="font-medium">{loan.termMonths} months</span>
                      </div>
                      {loan.moratoryRate && (
                        <div className="flex justify-between">
                          <span>Late Payment Rate:</span>
                          <span className="font-medium">{loan.moratoryRate}%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Recent Payments</h4>
                    <div className="text-sm space-y-1">
                      {loanPayments?.slice(0, 3).map((payment: any) => (
                        <div key={payment.paymentId} className="flex justify-between">
                          <span>{format(new Date(payment.paymentDate), "MMM dd")}</span>
                          <span className="font-medium">${payment.amount.toLocaleString()}</span>
                        </div>
                      ))}
                      {(!loanPayments || loanPayments.length === 0) && (
                        <p className="text-muted-foreground">No payments recorded</p>
                      )}
                    </div>
                  </div>
                </div>

                {loan.notes && (
                  <div>
                    <h4 className="font-medium mb-2">Notes</h4>
                    <p className="text-sm text-muted-foreground">{loan.notes}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    Make Payment
                  </Button>
                  <Button size="sm" variant="outline">
                    View Amortization
                  </Button>
                  <Button size="sm" variant="outline">
                    Edit Loan
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Active Loans */}
      {activeLoans.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold">Active Loans</h2>
            <Badge variant="secondary">{activeLoans.length}</Badge>
          </div>
          <div className="grid gap-4">
            {activeLoans.map((loan: Loan) => (
              <LoanCard key={loan.loanId} loan={loan} />
            ))}
          </div>
        </div>
      )}

      {/* Loans in Arrears */}
      {arrearsLoans.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-red-600">
            <TrendingDown className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Loans in Arrears</h2>
            <Badge variant="destructive">{arrearsLoans.length}</Badge>
          </div>
          <div className="grid gap-4">
            {arrearsLoans.map((loan: Loan) => (
              <LoanCard key={loan.loanId} loan={loan} />
            ))}
          </div>
        </div>
      )}

      {/* Paid Off Loans */}
      {paidOffLoans.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600">
            <DollarSign className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Paid Off Loans</h2>
            <Badge variant="default">{paidOffLoans.length}</Badge>
          </div>
          <div className="grid gap-4">
            {paidOffLoans.map((loan: Loan) => (
              <LoanCard key={loan.loanId} loan={loan} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!loans || loans.length === 0) && (
        <Card>
          <CardContent className="text-center py-12">
            <CreditCard className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Loans</h3>
            <p className="text-muted-foreground mb-4">
              Track your loans, mortgages, and credit instruments here
            </p>
            <Button>Add First Loan</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}