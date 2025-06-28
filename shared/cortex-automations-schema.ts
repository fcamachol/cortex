import { pgTable, uuid, varchar, text, boolean, integer, timestamp, jsonb, pgSchema, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Create cortex_automation schema
export const cortexAutomationSchema = pgSchema("cortex_automation");

// Enums for automation
export const triggerTypeEnum = pgEnum("trigger_type", [
  "whatsapp_message", "schedule", "entity_change", "manual", "webhook"
]);

export const operatorEnum = pgEnum("operator", [
  "equals", "not_equals", "contains", "not_contains", "starts_with", 
  "ends_with", "matches_regex", "greater_than", "less_than", "in_list"
]);

export const groupOperatorEnum = pgEnum("group_operator", ["AND", "OR"]);

export const actionTypeEnum = pgEnum("action_type", [
  "create_task", "create_note", "send_message", "create_reminder", 
  "update_entity", "send_email", "webhook_call", "create_event"
]);

export const executionStatusEnum = pgEnum("execution_status", [
  "success", "failed", "partial", "skipped"
]);

export const templateTypeEnum = pgEnum("template_type", [
  "message", "task", "note", "email", "document"
]);

export const stepTypeEnum = pgEnum("step_type", [
  "action", "condition", "wait", "human_approval", "loop", "parallel"
]);

// Automation Rules (replaces existing actions.rules)
export const automationRules = cortexAutomationSchema.table("rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  triggerType: varchar("trigger_type", { length: 50 }).notNull(),
  priority: integer("priority").default(100),
  createdBy: varchar("created_by", { length: 50 }).notNull(),
  spaceId: varchar("space_id", { length: 50 }),
  lastExecutedAt: timestamp("last_executed_at"),
  executionCount: integer("execution_count").default(0),
  successCount: integer("success_count").default(0),
  failureCount: integer("failure_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Rule Conditions
export const ruleConditions = cortexAutomationSchema.table("rule_conditions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id").notNull().references(() => automationRules.id, { onDelete: "cascade" }),
  conditionType: varchar("condition_type", { length: 50 }).notNull(),
  operator: varchar("operator", { length: 20 }).notNull(),
  fieldName: varchar("field_name", { length: 100 }),
  value: text("value"),
  conditionGroup: integer("condition_group").default(1),
  groupOperator: varchar("group_operator", { length: 3 }).default("AND"),
  isNegated: boolean("is_negated").default(false),
  createdAt: timestamp("created_at").defaultNow()
});

// Rule Actions
export const ruleActions = cortexAutomationSchema.table("rule_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id").notNull().references(() => automationRules.id, { onDelete: "cascade" }),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  actionOrder: integer("action_order").notNull(),
  targetEntityId: varchar("target_entity_id", { length: 50 }),
  parameters: jsonb("parameters").notNull().default({}),
  templateId: uuid("template_id"),
  isConditional: boolean("is_conditional").default(false),
  conditionExpression: text("condition_expression"),
  createdAt: timestamp("created_at").defaultNow()
});

// Rule Executions
export const ruleExecutions = cortexAutomationSchema.table("rule_executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id").notNull().references(() => automationRules.id),
  triggerData: jsonb("trigger_data"),
  executionResult: jsonb("execution_result"),
  status: varchar("status", { length: 20 }).notNull(),
  errorMessage: text("error_message"),
  actionsExecuted: integer("actions_executed").default(0),
  actionsFailed: integer("actions_failed").default(0),
  executionTimeMs: integer("execution_time_ms"),
  executedAt: timestamp("executed_at").defaultNow(),
  metadata: jsonb("metadata").default({})
});

// Templates
export const automationTemplates = cortexAutomationSchema.table("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  templateType: varchar("template_type", { length: 50 }).notNull(),
  content: text("content").notNull(),
  variables: jsonb("variables").default([]),
  isActive: boolean("is_active").default(true),
  category: varchar("category", { length: 100 }),
  createdBy: varchar("created_by", { length: 50 }),
  usageCount: integer("usage_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Workflows (multi-step automation)
export const automationWorkflows = cortexAutomationSchema.table("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  triggerEvent: varchar("trigger_event", { length: 100 }).notNull(),
  isActive: boolean("is_active").default(true),
  version: integer("version").default(1),
  createdBy: varchar("created_by", { length: 50 }),
  totalExecutions: integer("total_executions").default(0),
  successfulExecutions: integer("successful_executions").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Workflow Steps
export const workflowSteps = cortexAutomationSchema.table("workflow_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").notNull().references(() => automationWorkflows.id, { onDelete: "cascade" }),
  stepOrder: integer("step_order").notNull(),
  stepName: varchar("step_name", { length: 255 }),
  stepType: varchar("step_type", { length: 50 }).notNull(),
  stepConfig: jsonb("step_config").notNull().default({}),
  successStepId: uuid("success_step_id"),
  failureStepId: uuid("failure_step_id"),
  timeoutSeconds: integer("timeout_seconds"),
  retryCount: integer("retry_count").default(0),
  createdAt: timestamp("created_at").defaultNow()
});

// Triggers
export const automationTriggers = cortexAutomationSchema.table("triggers", {
  id: uuid("id").primaryKey().defaultRandom(),
  triggerName: varchar("trigger_name", { length: 255 }).notNull(),
  triggerType: varchar("trigger_type", { length: 50 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }),
  eventType: varchar("event_type", { length: 50 }),
  conditions: jsonb("conditions").default({}),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow()
});

// Relations
export const automationRulesRelations = relations(automationRules, ({ many }) => ({
  conditions: many(ruleConditions),
  actions: many(ruleActions),
  executions: many(ruleExecutions)
}));

export const ruleConditionsRelations = relations(ruleConditions, ({ one }) => ({
  rule: one(automationRules, {
    fields: [ruleConditions.ruleId],
    references: [automationRules.id]
  })
}));

export const ruleActionsRelations = relations(ruleActions, ({ one }) => ({
  rule: one(automationRules, {
    fields: [ruleActions.ruleId],
    references: [automationRules.id]
  }),
  template: one(automationTemplates, {
    fields: [ruleActions.templateId],
    references: [automationTemplates.id]
  })
}));

export const ruleExecutionsRelations = relations(ruleExecutions, ({ one }) => ({
  rule: one(automationRules, {
    fields: [ruleExecutions.ruleId],
    references: [automationRules.id]
  })
}));

export const automationWorkflowsRelations = relations(automationWorkflows, ({ many }) => ({
  steps: many(workflowSteps)
}));

export const workflowStepsRelations = relations(workflowSteps, ({ one }) => ({
  workflow: one(automationWorkflows, {
    fields: [workflowSteps.workflowId],
    references: [automationWorkflows.id]
  })
}));

// Insert Schemas
export const insertAutomationRuleSchema = createInsertSchema(automationRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastExecutedAt: true,
  executionCount: true,
  successCount: true,
  failureCount: true
});

export const insertRuleConditionSchema = createInsertSchema(ruleConditions).omit({
  id: true,
  createdAt: true
});

export const insertRuleActionSchema = createInsertSchema(ruleActions).omit({
  id: true,
  createdAt: true
});

export const insertAutomationTemplateSchema = createInsertSchema(automationTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
  lastUsedAt: true
});

export const insertAutomationWorkflowSchema = createInsertSchema(automationWorkflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalExecutions: true,
  successfulExecutions: true
});

export const insertWorkflowStepSchema = createInsertSchema(workflowSteps).omit({
  id: true,
  createdAt: true
});

export const insertAutomationTriggerSchema = createInsertSchema(automationTriggers).omit({
  id: true,
  createdAt: true
});

// Types
export type AutomationRule = typeof automationRules.$inferSelect;
export type InsertAutomationRule = z.infer<typeof insertAutomationRuleSchema>;

export type RuleCondition = typeof ruleConditions.$inferSelect;
export type InsertRuleCondition = z.infer<typeof insertRuleConditionSchema>;

export type RuleAction = typeof ruleActions.$inferSelect;
export type InsertRuleAction = z.infer<typeof insertRuleActionSchema>;

export type RuleExecution = typeof ruleExecutions.$inferSelect;

export type AutomationTemplate = typeof automationTemplates.$inferSelect;
export type InsertAutomationTemplate = z.infer<typeof insertAutomationTemplateSchema>;

export type AutomationWorkflow = typeof automationWorkflows.$inferSelect;
export type InsertAutomationWorkflow = z.infer<typeof insertAutomationWorkflowSchema>;

export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type InsertWorkflowStep = z.infer<typeof insertWorkflowStepSchema>;

export type AutomationTrigger = typeof automationTriggers.$inferSelect;
export type InsertAutomationTrigger = z.infer<typeof insertAutomationTriggerSchema>;