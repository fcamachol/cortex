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

// Transactions table
export const cortexTransactions = cortexFinanceSchema.table("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  transactionType: varchar("transaction_type", { length: 20 }).notNull(), // income, expense, transfer, adjustment
  description: text("description").notNull(),
  transactionDate: date("transaction_date").notNull(),
  category: varchar("category", { length: 100 }),
  subcategory: varchar("subcategory", { length: 100 }),
  fromAccountEntityId: varchar("from_account_entity_id", { length: 50 }), // FK to accounts
  toAccountEntityId: varchar("to_account_entity_id", { length: 50 }), // FK to accounts
  vendorEntityId: varchar("vendor_entity_id", { length: 50 }), // FK to cortex_entities
  projectEntityId: varchar("project_entity_id", { length: 50 }), // FK to cortex_entities
  billPayableId: uuid("bill_payable_id").references(() => cortexBillsPayable.id),
  billReceivableId: uuid("bill_receivable_id").references(() => cortexBillsReceivable.id),
  transactionSource: varchar("transaction_source", { length: 50 }).default("manual").notNull(), // manual, automated, import
  reference: varchar("reference", { length: 255 }),
  createdByEntityId: varchar("created_by_entity_id", { length: 50 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  typeIdx: index("transactions_type_idx").on(table.transactionType),
  dateIdx: index("transactions_date_idx").on(table.transactionDate),
  fromAccountIdx: index("transactions_from_account_idx").on(table.fromAccountEntityId),
  toAccountIdx: index("transactions_to_account_idx").on(table.toAccountEntityId),
  vendorIdx: index("transactions_vendor_idx").on(table.vendorEntityId),
  billPayableIdx: index("transactions_bill_payable_idx").on(table.billPayableId),
  billReceivableIdx: index("transactions_bill_receivable_idx").on(table.billReceivableId),
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

export type RecurrenceType = z.infer<typeof recurrenceTypeEnum>;