import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit3, Calendar, DollarSign, Clock, Percent, FileText, Calculator } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { calculateCustomMoratoryInterest, calculateStandardMoratoryInterest } from "@/lib/loan-calculations";

interface LoanDetailModalProps {
  open: boolean;
  onClose: () => void;
  loan: any;
  onEdit: () => void;
}

export function LoanDetailModal({ open, onClose, loan, onEdit }: LoanDetailModalProps) {
  if (!loan) return null;

  // Calculate next payment date
  const getNextPaymentDate = () => {
    // Use start_date as the basis for monthly calculations since payment_date is often null
    const baseDate = loan.payment_date || loan.start_date;
    if (!baseDate) return "Not set";
    
    // Parse dates properly to avoid timezone issues
    const parseDate = (dateString: string) => {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day); // month is 0-indexed in JS
    };
    
    const paymentDate = parseDate(baseDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // If payment date is in the future, return it
    if (paymentDate > today) {
      return paymentDate.toLocaleDateString();
    }
    
    // Calculate next payment based on frequency, preserving the day of month
    let nextPayment = new Date(paymentDate);
    
    switch (loan.payment_frequency) {
      case "monthly":
        const originalDay = nextPayment.getDate();
        nextPayment.setMonth(nextPayment.getMonth() + 1);
        
        // Handle month-end edge cases (e.g., Jan 31 -> Feb 28/29)
        if (nextPayment.getDate() !== originalDay) {
          nextPayment.setDate(0); // Go to last day of previous month
        }
        break;
      case "quarterly":
        const originalDayQ = nextPayment.getDate();
        nextPayment.setMonth(nextPayment.getMonth() + 3);
        
        if (nextPayment.getDate() !== originalDayQ) {
          nextPayment.setDate(0);
        }
        break;
      case "annually":
        nextPayment.setFullYear(nextPayment.getFullYear() + 1);
        break;
    }
    
    return nextPayment.toLocaleDateString();
  };

  // Calculate monthly payment amount
  const calculateMonthlyPayment = () => {
    if (!loan.term_months || loan.term_months === 0) {
      // Interest-only payment for unlimited term
      const principal = parseFloat(loan.principal_amount) || 0;
      const rate = parseFloat(loan.interest_rate) || 0;
      
      let monthlyRate = rate / 100;
      if (loan.interest_rate_type === "daily") {
        monthlyRate = (rate / 100) * 30;
      } else if (loan.interest_rate_type === "weekly") {
        monthlyRate = (rate / 100) * 4.33;
      }
      
      return principal * monthlyRate;
    }
    
    // Standard payment calculation
    const principal = parseFloat(loan.principal_amount) || 0;
    const rate = parseFloat(loan.interest_rate) || 0;
    const termMonths = parseInt(loan.term_months) || 1;
    
    let monthlyRate = rate / 100;
    if (loan.interest_rate_type === "daily") {
      monthlyRate = (rate / 100) * 30;
    } else if (loan.interest_rate_type === "weekly") {
      monthlyRate = (rate / 100) * 4.33;
    }
    
    if (monthlyRate === 0) return principal / termMonths;
    
    return principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
           (Math.pow(1 + monthlyRate, termMonths) - 1);
  };

  const monthlyPayment = calculateMonthlyPayment();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-xl font-semibold">Loan Details</DialogTitle>
          <Button onClick={onEdit} variant="outline" size="sm">
            <Edit3 className="h-4 w-4 mr-2" />
            Edit Loan
          </Button>
        </DialogHeader>

        <div className="space-y-6">
          {/* Loan Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Loan Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Lender</p>
                  <p className="text-lg font-semibold">{loan.lender_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Principal Amount</p>
                  <p className="text-lg font-semibold">{formatCurrency(loan.principal_amount, loan.currency)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Interest Rate</p>
                  <p className="text-lg font-semibold">{loan.interest_rate}% {loan.interest_rate_type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Term</p>
                  <p className="text-lg font-semibold">
                    {loan.term_months ? `${loan.term_months} months` : "Unlimited"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Payment Frequency</p>
                  <p className="text-lg font-semibold capitalize">{loan.payment_frequency}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                  <p className="text-lg font-semibold">
                    {new Date(loan.start_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Monthly Payment</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(monthlyPayment, loan.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Next Payment Date</p>
                  <p className="text-lg font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {getNextPaymentDate()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Moratory Interest (if applicable) */}
          {(loan.moratory_rate > 0 || loan.moratoryRate > 0 || loan.has_moratory_interest || loan.hasMoratoryInterest || loan.custom_formula || loan.customFormula) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Moratory Interest
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Moratory Rate</p>
                    <p className="text-lg font-semibold">
                      {(loan.custom_formula || loan.customFormula) ? 
                        "Custom Formula" : 
                        `${loan.moratory_rate || loan.moratoryRate || 0}% ${loan.moratory_rate_type || loan.moratoryRateType || 'daily'}`
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                </div>

                {/* Custom Formula Section */}
                {(loan.custom_formula || loan.customFormula) && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Custom Formula</p>
                    {(loan.custom_formula_description || loan.customFormulaDescription) && (
                      <p className="text-sm mb-3 text-gray-700">
                        {loan.custom_formula_description || loan.customFormulaDescription}
                      </p>
                    )}
                    <div className="bg-white p-3 rounded border font-mono text-sm">
                      {loan.custom_formula || loan.customFormula || "No formula specified"}
                    </div>
                    <div className="mt-3 text-xs text-gray-600">
                      <p><strong>Available Variables:</strong> principalAmount, interestRate, termMonths, daysOverdue, paymentFrequency</p>
                      <p><strong>Payment Frequency:</strong> {loan.payment_frequency || loan.paymentFrequency} payments</p>
                    </div>
                    
                    {/* Calculation Breakdown */}
                    <div className="mt-4 p-3 bg-gray-50 rounded border">
                      <div className="text-sm text-gray-700">
                        {(() => {
                          try {
                            const testParams = {
                              principalAmount: loan.principal_amount || loan.principalAmount || 0,
                              interestRate: (loan.interest_rate || loan.interestRate || 0) / 100,
                              termMonths: loan.term_months || loan.termMonths || 12,
                              paymentFrequency: loan.payment_frequency || loan.paymentFrequency || 'monthly',
                              daysOverdue: 30,
                              monthlyPayment: calculateMonthlyPayment()
                            };
                            
                            // Use the custom formula to calculate the moratory interest
                            const customFormula = loan.custom_formula || loan.customFormula || '(monthlyPayment / 30) * daysOverdue';
                            const result = calculateCustomMoratoryInterest(customFormula, testParams);
                            
                            const monthlyPayment = testParams.monthlyPayment;
                            const dailyPenalty = monthlyPayment / 30;
                            
                            return (
                              <div className="space-y-1">
                                <p><strong>Calculation breakdown:</strong></p>
                                <p>• Monthly payment: {formatCurrency(monthlyPayment)}</p>
                                <p>• Daily penalty: {formatCurrency(dailyPenalty)} ({formatCurrency(monthlyPayment)}/30)</p>
                                <p>• For 30 days: {formatCurrency(dailyPenalty)} × 30 = {formatCurrency(result)}</p>
                              </div>
                            );
                          } catch (error) {
                            return (
                              <p className="text-red-600">
                                Formula error: {error instanceof Error ? error.message : 'Invalid formula'}
                              </p>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Additional Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Additional Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loan.purpose && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Purpose</p>
                  <p className="text-lg">{loan.purpose}</p>
                </div>
              )}
              {loan.collateral && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Collateral</p>
                  <p className="text-lg">{loan.collateral}</p>
                </div>
              )}
              {loan.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Notes</p>
                  <p className="text-lg">{loan.notes}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <p className="text-lg">{new Date(loan.created_at).toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>

          {/* Payment History Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Payment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No payments recorded yet</p>
                <p className="text-sm">Payment history will appear here once payments are made</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}