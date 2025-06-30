import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit3, Calendar, DollarSign, Clock, Percent, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

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
    if (!loan.payment_date) return "Not set";
    
    const paymentDate = new Date(loan.payment_date);
    const today = new Date();
    
    // If payment date is in the future, return it
    if (paymentDate > today) {
      return paymentDate.toLocaleDateString();
    }
    
    // Calculate next payment based on frequency
    let nextPayment = new Date(paymentDate);
    
    switch (loan.payment_frequency) {
      case "monthly":
        nextPayment.setMonth(nextPayment.getMonth() + 1);
        break;
      case "quarterly":
        nextPayment.setMonth(nextPayment.getMonth() + 3);
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
          {loan.has_moratory_interest && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Moratory Interest
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Moratory Rate</p>
                    <p className="text-lg font-semibold">{loan.moratory_rate}% {loan.moratory_rate_type}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                </div>
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