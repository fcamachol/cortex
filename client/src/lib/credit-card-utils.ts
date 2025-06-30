// Credit Card Utility Functions
// Handles specialized credit card calculations and formatting

export interface CreditCardData {
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

// Convert string/number values to proper numbers
export function parseNumericValue(value: string | number): number {
  if (typeof value === 'number') return value;
  return parseFloat(value) || 0;
}

// Calculate debt amount for credit cards
// Positive current_balance means you owe money (debt)
// Negative current_balance means credit/overpayment
export function calculateDebt(currentBalance: string | number): number {
  const balance = parseNumericValue(currentBalance);
  return Math.max(0, balance); // Only return positive debt amounts
}

// Calculate available credit
// Credit limit minus current balance
export function calculateAvailableCredit(creditLimit: string | number, currentBalance: string | number): number {
  const limit = parseNumericValue(creditLimit);
  const balance = parseNumericValue(currentBalance);
  return limit - balance;
}

// Calculate credit utilization percentage
export function calculateUtilization(currentBalance: string | number, creditLimit: string | number): number {
  const balance = parseNumericValue(currentBalance);
  const limit = parseNumericValue(creditLimit);
  if (limit === 0) return 0;
  return Math.max(0, (balance / limit) * 100);
}

// Format currency for display
export function formatCurrency(amount: string | number, currency: string = 'MXN'): string {
  const numericAmount = parseNumericValue(amount);
  const formatter = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  });
  return formatter.format(numericAmount);
}

// Get utilization status with color coding
export function getUtilizationStatus(utilization: number): {
  status: 'low' | 'medium' | 'high' | 'over-limit';
  color: string;
  label: string;
} {
  if (utilization <= 30) {
    return { status: 'low', color: 'text-green-600', label: 'Excelente' };
  } else if (utilization <= 60) {
    return { status: 'medium', color: 'text-yellow-600', label: 'Moderado' };
  } else if (utilization <= 100) {
    return { status: 'high', color: 'text-orange-600', label: 'Alto' };
  } else {
    return { status: 'over-limit', color: 'text-red-600', label: 'Sobre el límite' };
  }
}

// Calculate next statement date
export function getNextStatementDate(closingDay: number): Date {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  let statementDate = new Date(currentYear, currentMonth, closingDay);
  
  // If we've passed this month's closing day, move to next month
  if (today.getDate() >= closingDay) {
    statementDate = new Date(currentYear, currentMonth + 1, closingDay);
  }
  
  return statementDate;
}

// Calculate payment due date based on statement closing
export function getPaymentDueDate(closingDay: number, daysAfterStatement: number): Date {
  const statementDate = getNextStatementDate(closingDay);
  const dueDate = new Date(statementDate);
  dueDate.setDate(dueDate.getDate() + daysAfterStatement);
  return dueDate;
}

// Format date for display
export function formatDate(date: Date): string {
  return date.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// Get card status based on debt and limits
export function getCardStatus(currentBalance: string | number, creditLimit: string | number): {
  status: 'active' | 'over-limit' | 'near-limit' | 'low-usage';
  message: string;
} {
  const balance = parseNumericValue(currentBalance);
  const limit = parseNumericValue(creditLimit);
  const utilization = calculateUtilization(balance, limit);
  
  if (utilization > 100) {
    return { status: 'over-limit', message: 'Sobre el límite de crédito' };
  } else if (utilization > 80) {
    return { status: 'near-limit', message: 'Cerca del límite' };
  } else if (utilization < 30) {
    return { status: 'low-usage', message: 'Uso bajo del crédito' };
  } else {
    return { status: 'active', message: 'Uso normal' };
  }
}