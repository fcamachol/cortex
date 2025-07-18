import { pgSchema, uuid, varchar, text, numeric, date, boolean, integer, timestamp, jsonb, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Cortex Finance Schema
export const cortexFinanceSchema = pgSchema("cortex_finance");

// Recurrence type enum
export const recurrenceTypeEnum = z.enum(['monthly', 'quarterly', 'annual', 'weekly', 'biweekly', 'custom']);

// Bills Payable with recurring functionality
export const cortexBillsPayable = cortexFinanceSchema.table("bills_payable", {
  id: uuid("id").primaryKey().defaultRandom(),
  billNumber: varchar("bill_number", { length: 100 }),
  vendorEntityId: varchar("vendor_entity_id", { length: 50 }), // FK to cortex_entities
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  billDate: date("bill_date").notNull(),
  dueDate: date("due_date").notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  category: varchar("category", { length: 100 }),
  subcategory: varchar("subcategory", { length: 100 }),
  projectEntityId: varchar("project_entity_id", { length: 50 }), // FK to cortex_entities
  accountEntityId: varchar("account_entity_id", { length: 50 }), // FK to cortex_entities
  amountPaid: numeric("amount_paid", { precision: 15, scale: 2 }).default("0.00"),
  paidDate: date("paid_date"),
  createdByEntityId: varchar("created_by_entity_id", { length: 50 }).notNull(),
  
  // Recurring fields
  isRecurring: boolean("is_recurring").default(false).notNull(),
  recurrenceType: varchar("recurrence_type", { length: 20 }), // monthly, quarterly, annual, weekly, biweekly, custom
  recurrenceInterval: integer("recurrence_interval").default(1),
  recurrenceStartDate: date("recurrence_start_date"), // When the recurring pattern starts
  recurrenceEndDate: date("recurrence_end_date"),
  nextDueDate: date("next_due_date"),
  parentBillId: uuid("parent_bill_id").references(() => cortexBillsPayable.id),
  instanceNumber: integer("instance_number").default(1),
  autoPayEnabled: boolean("auto_pay_enabled").default(false).notNull(),
  autoPayAccountId: varchar("auto_pay_account_id", { length: 50 }), // FK to accounts
  daysToPay: integer("days_to_pay"), // Number of days between bill date and due date
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  billNumberIdx: index("bills_payable_bill_number_idx").on(table.billNumber),
  vendorIdx: index("bills_payable_vendor_idx").on(table.vendorEntityId),
  statusIdx: index("bills_payable_status_idx").on(table.status),
  dueDateIdx: index("bills_payable_due_date_idx").on(table.dueDate),
  recurringIdx: index("bills_payable_recurring_idx").on(table.isRecurring, table.nextDueDate),
  parentIdx: index("bills_payable_parent_idx").on(table.parentBillId),
  autoPayIdx: index("bills_payable_auto_pay_idx").on(table.autoPayEnabled, table.nextDueDate),
}));

// Bills Receivable with recurring functionality
export const cortexBillsReceivable = cortexFinanceSchema.table("bills_receivable", {
  id: uuid("id").primaryKey().defaultRandom(),
  billNumber: varchar("bill_number", { length: 100 }),
  customerEntityId: varchar("customer_entity_id", { length: 50 }), // FK to cortex_entities
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  billDate: date("bill_date").notNull(),
  dueDate: date("due_date").notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  category: varchar("category", { length: 100 }),
  subcategory: varchar("subcategory", { length: 100 }),
  projectEntityId: varchar("project_entity_id", { length: 50 }), // FK to cortex_entities
  accountEntityId: varchar("account_entity_id", { length: 50 }), // FK to cortex_entities
  amountReceived: numeric("amount_received", { precision: 15, scale: 2 }).default("0.00"),
  receivedDate: date("received_date"),
  createdByEntityId: varchar("created_by_entity_id", { length: 50 }).notNull(),
  
  // Recurring fields
  isRecurring: boolean("is_recurring").default(false).notNull(),
  recurrenceType: varchar("recurrence_type", { length: 20 }), // monthly, quarterly, annual, weekly, biweekly, custom
  recurrenceInterval: integer("recurrence_interval").default(1),
  recurrenceStartDate: date("recurrence_start_date"), // When the recurring pattern starts
  recurrenceEndDate: date("recurrence_end_date"),
  nextDueDate: date("next_due_date"),
  parentBillId: uuid("parent_bill_id").references(() => cortexBillsReceivable.id),
  instanceNumber: integer("instance_number").default(1),
  daysToPay: integer("days_to_pay"), // Number of days between bill date and due date
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  billNumberIdx: index("bills_receivable_bill_number_idx").on(table.billNumber),
  customerIdx: index("bills_receivable_customer_idx").on(table.customerEntityId),
  statusIdx: index("bills_receivable_status_idx").on(table.status),
  dueDateIdx: index("bills_receivable_due_date_idx").on(table.dueDate),
  recurringIdx: index("bills_receivable_recurring_idx").on(table.isRecurring, table.nextDueDate),
  parentIdx: index("bills_receivable_parent_idx").on(table.parentBillId),
}));

// Accounts table
export const cortexAccounts = cortexFinanceSchema.table("accounts", {
  id: varchar("id", { length: 50 }).primaryKey(), // ca_ prefixed entity ID
  name: varchar("name", { length: 200 }).notNull(),
  accountType: varchar("account_type", { length: 50 }).notNull(), // checking, savings, credit_card, etc.
  accountNumber: varchar("account_number", { length: 100 }),
  bankName: varchar("bank_name", { length: 200 }),
  balance: numeric("balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  description: text("description"),
  contactEntityId: varchar("contact_entity_id", { length: 50 }), // FK to cortex_entities
  createdByEntityId: varchar("created_by_entity_id", { length: 50 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  nameIdx: index("accounts_name_idx").on(table.name),
  typeIdx: index("accounts_type_idx").on(table.accountType),
  activeIdx: index("accounts_active_idx").on(table.isActive),
}));

// Credit Cards - Dedicated table for credit card accounts
export const cortexCreditCards = cortexFinanceSchema.table("credit_cards", {
  id: varchar("id", { length: 50 }).primaryKey(), // cc_ prefixed entity ID
  cardName: varchar("card_name", { length: 200 }).notNull(),
  bankName: varchar("bank_name", { length: 200 }).notNull(),
  last4Digits: varchar("last_4_digits", { length: 4 }).notNull(),
  currentBalance: numeric("current_balance", { precision: 15, scale: 2 }).default("0.00").notNull(), // Negative = debt
  creditLimit: numeric("credit_limit", { precision: 15, scale: 2 }).notNull(),
  availableCredit: numeric("available_credit", { precision: 15, scale: 2 }).notNull(), // creditLimit + currentBalance (since balance is negative)
  apr: numeric("apr", { precision: 6, scale: 4 }).notNull(), // Annual Percentage Rate (e.g., 24.99% stored as 0.2499)
  statementClosingDay: integer("statement_closing_day").notNull(), // Day of month (1-31)
  paymentDueDaysAfterStatement: integer("payment_due_days_after_statement").default(21).notNull(),
  currency: varchar("currency", { length: 3 }).default("MXN").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  contactEntityId: varchar("contact_entity_id", { length: 50 }), // FK to cortex_entities
  createdByEntityId: varchar("created_by_entity_id", { length: 50 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  cardNameIdx: index("credit_cards_card_name_idx").on(table.cardName),
  bankNameIdx: index("credit_cards_bank_name_idx").on(table.bankName),
  creditLimitIdx: index("credit_cards_credit_limit_idx").on(table.creditLimit),
  aprIdx: index("credit_cards_apr_idx").on(table.apr),
  activeIdx: index("credit_cards_active_idx").on(table.isActive),
  balanceIdx: index("credit_cards_balance_idx").on(table.currentBalance),
}));

// Transactions table with proper double-entry accounting
export const cortexTransactions = cortexFinanceSchema.table("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  transactionType: varchar("transaction_type", { length: 20 }).notNull(), // income, expense, transfer, adjustment
  description: text("description").notNull(),
  transactionDate: date("transaction_date").notNull(),
  category: varchar("category", { length: 100 }),
  subcategory: varchar("subcategory", { length: 100 }),
  
  // Double-entry accounting: every transaction has debit and credit accounts
  debitAccountEntityId: varchar("debit_account_entity_id", { length: 50 }).notNull(), // Account being debited
  creditAccountEntityId: varchar("credit_account_entity_id", { length: 50 }).notNull(), // Account being credited
  
  vendorEntityId: varchar("vendor_entity_id", { length: 50 }), // FK to cortex_entities
  projectEntityId: varchar("project_entity_id", { length: 50 }), // FK to cortex_entities
  billPayableId: uuid("bill_payable_id").references(() => cortexBillsPayable.id),
  billReceivableId: uuid("bill_receivable_id").references(() => cortexBillsReceivable.id),
  transactionSource: varchar("transaction_source", { length: 50 }).default("manual").notNull(), // manual, automated, import
  reference: varchar("reference", { length: 255 }),
  
  // For reconciliation
  reconciled: boolean("reconciled").default(false).notNull(),
  reconciledDate: date("reconciled_date"),
  
  createdByEntityId: varchar("created_by_entity_id", { length: 50 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  typeIdx: index("transactions_type_idx").on(table.transactionType),
  dateIdx: index("transactions_date_idx").on(table.transactionDate),
  debitAccountIdx: index("transactions_debit_account_idx").on(table.debitAccountEntityId),
  creditAccountIdx: index("transactions_credit_account_idx").on(table.creditAccountEntityId),
  vendorIdx: index("transactions_vendor_idx").on(table.vendorEntityId),
  billPayableIdx: index("transactions_bill_payable_idx").on(table.billPayableId),
  billReceivableIdx: index("transactions_bill_receivable_idx").on(table.billReceivableId),
  reconciledIdx: index("transactions_reconciled_idx").on(table.reconciled),
}));

// =====================================================
// INSERT SCHEMAS (Zod validation)
// =====================================================

export const insertBillPayableSchema = createInsertSchema(cortexBillsPayable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  recurrenceType: recurrenceTypeEnum.optional(),
});

export const insertBillReceivableSchema = createInsertSchema(cortexBillsReceivable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  recurrenceType: recurrenceTypeEnum.optional(),
});

export const insertAccountSchema = createInsertSchema(cortexAccounts).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(cortexTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreditCardSchema = createInsertSchema(cortexCreditCards).omit({
  createdAt: true,
  updatedAt: true,
});

// =====================================================
// TYPE EXPORTS
// =====================================================

export type BillPayable = typeof cortexBillsPayable.$inferSelect;
export type InsertBillPayable = z.infer<typeof insertBillPayableSchema>;

export type BillReceivable = typeof cortexBillsReceivable.$inferSelect;
export type InsertBillReceivable = z.infer<typeof insertBillReceivableSchema>;

export type Account = typeof cortexAccounts.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;

export type Transaction = typeof cortexTransactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type CreditCard = typeof cortexCreditCards.$inferSelect;
export type InsertCreditCard = z.infer<typeof insertCreditCardSchema>;

export type RecurrenceType = z.infer<typeof recurrenceTypeEnum>;

// =====================================================
// TRANSACTION TYPES FOR SIMPLIFIED ACCOUNTING
// =====================================================

export const TRANSACTION_TYPES = {
  expense: "Money going out - creates debit entry",
  income: "Money coming in - creates credit entry", 
  transfer: "Moving money between accounts"
} as const;