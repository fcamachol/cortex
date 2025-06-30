/**
 * Loan calculation utilities including custom moratory interest formula evaluation
 */

interface LoanData {
  principalAmount: number;
  interestRate: number;
  termMonths?: number;
  paymentFrequency: 'monthly' | 'quarterly' | 'annually';
  customFormula?: string;
  moratoryRate?: number;
}

interface MoratoryCalculationParams {
  principalAmount: number;
  interestRate: number;
  termMonths: number;
  paymentFrequency: string;
  daysOverdue: number;
  monthlyPayment?: number;
}

/**
 * Safely evaluate a custom moratory interest formula
 */
export function calculateCustomMoratoryInterest(
  formula: string,
  params: MoratoryCalculationParams
): number {
  try {
    // Create a safe evaluation context with the available variables
    const context = {
      principalAmount: params.principalAmount,
      interestRate: params.interestRate,
      termMonths: params.termMonths,
      paymentFrequency: params.paymentFrequency,
      daysOverdue: params.daysOverdue,
      monthlyPayment: params.monthlyPayment || 0,
      Math: Math, // Allow Math functions
    };

    // Clean the formula - remove 'return' statement if present and ensure it's an expression
    let cleanFormula = formula.trim();
    if (cleanFormula.startsWith('return ')) {
      cleanFormula = cleanFormula.substring(7);
    }
    if (cleanFormula.endsWith(';')) {
      cleanFormula = cleanFormula.slice(0, -1);
    }

    // Create a function that evaluates the formula in the given context
    const evalFunction = new Function(
      ...Object.keys(context),
      `return ${cleanFormula}`
    );

    // Execute the formula with the context values
    const result = evalFunction(...Object.values(context));

    // Validate the result
    if (typeof result !== 'number' || isNaN(result) || result < 0) {
      throw new Error('Formula must return a positive number');
    }

    return result;
  } catch (error) {
    console.error('Error evaluating custom formula:', error);
    throw new Error(`Invalid formula: ${error}`);
  }
}

/**
 * Calculate payment frequency multiplier for period-based calculations
 */
export function getPaymentFrequencyMultiplier(frequency: string): number {
  switch (frequency) {
    case 'monthly':
      return 12; // 12 payments per year
    case 'quarterly':
      return 4;  // 4 payments per year
    case 'annually':
      return 1;  // 1 payment per year
    default:
      return 12; // Default to monthly
  }
}

/**
 * Calculate days per payment period based on frequency
 */
export function getDaysPerPaymentPeriod(frequency: string): number {
  const multiplier = getPaymentFrequencyMultiplier(frequency);
  return Math.round(365 / multiplier);
}

/**
 * Calculate standard moratory interest (non-custom formula)
 */
export function calculateStandardMoratoryInterest(
  loanData: LoanData,
  daysOverdue: number
): number {
  if (!loanData.moratoryRate || daysOverdue <= 0) {
    return 0;
  }

  // Simple daily calculation based on moratory rate
  const dailyRate = loanData.moratoryRate / 100 / 365;
  return loanData.principalAmount * dailyRate * daysOverdue;
}

/**
 * Get example formulas for different scenarios
 */
export function getExampleFormulas() {
  return {
    dailyFromMonthly: {
      name: "Daily rate from monthly interest",
      formula: "principalAmount * (interestRate / 12 / 30) * daysOverdue",
      description: "Converts monthly interest rate to daily and applies per day overdue"
    },
    frequencyBased: {
      name: "Frequency-based penalty (2% per payment period)",
      formula: `const periodsPerYear = paymentFrequency === 'monthly' ? 12 : paymentFrequency === 'quarterly' ? 4 : 1;
return principalAmount * 0.02 * Math.ceil(daysOverdue / (365 / periodsPerYear));`,
      description: "2% penalty for each missed payment period"
    },
    tieredPenalty: {
      name: "Tiered penalty based on days overdue",
      formula: `if (daysOverdue <= 30) return principalAmount * 0.01 * (daysOverdue / 30);
else if (daysOverdue <= 90) return principalAmount * 0.01 + principalAmount * 0.02 * ((daysOverdue - 30) / 60);
else return principalAmount * 0.03 * (daysOverdue / 30);`,
      description: "1% for first 30 days, 2% for 31-90 days, 3% thereafter"
    }
  };
}

/**
 * Validate a custom formula before saving
 */
export function validateCustomFormula(formula: string): { isValid: boolean; error?: string } {
  try {
    // Test with sample data
    const testParams: MoratoryCalculationParams = {
      principalAmount: 10000,
      interestRate: 0.12,
      termMonths: 12,
      paymentFrequency: 'monthly',
      daysOverdue: 30
    };

    const result = calculateCustomMoratoryInterest(formula, testParams);
    
    if (result < 0) {
      return { isValid: false, error: "Formula cannot return negative values" };
    }
    
    if (result > testParams.principalAmount * 10) {
      return { isValid: false, error: "Formula result seems unreasonably high" };
    }

    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: `Formula error: ${error}` };
  }
}