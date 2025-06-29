import { db } from "./db";
import { cortexBills } from "../shared/cortex-schema";
import { crmTasks } from "@shared/schema";
import { eq, and, lt } from "drizzle-orm";

export interface BillToTaskOptions {
  instanceId: string;
  spaceId: number;
  createdByUserId?: string;
}

/**
 * Automatic Bill-to-Task Creation Service
 * 
 * When a bill (payable) is created, this service automatically creates
 * a companion task that serves as the user-friendly reminder to pay the bill.
 */
export class BillToTaskService {
  
  /**
   * Creates a companion task for a newly created bill
   * NOTE: Simplified version using cortexBills schema
   */
  static async createTaskForBill(billId: string, options: BillToTaskOptions) {
    try {
      // Get the bill details
      const [bill] = await db
        .select()
        .from(cortexBills)
        .where(eq(cortexBills.id, billId));

      if (!bill) {
        throw new Error(`Bill with ID ${billId} not found`);
      }

      // Create the companion task
      const taskTitle = `Pay ${bill.title} ($${bill.amount})`;
      const taskDescription = `Bill Payment Due: ${bill.dueDate}\nAmount: $${bill.amount}`;

      const [task] = await db
        .insert(crmTasks)
        .values({
          title: taskTitle,
          description: taskDescription,
          status: "to_do",
          priority: "medium",
          taskType: "bill_payment",
          dueDate: bill.dueDate ? new Date(bill.dueDate + "T23:59:59Z") : null,
          createdByUserId: options.createdByUserId,
          userId: options.createdByUserId,
        })
        .returning();

      console.log(`✅ Created companion task (ID: ${task.id}) for bill: ${bill.title}`);
      return task;
    } catch (error) {
      console.error("❌ Error creating companion task for bill:", error);
      throw error;
    }
  }

  /**
   * Updates the companion task when bill status changes
   * NOTE: Simplified version - complex payment tracking will be added with full cortex finance
   */
  static async updateTaskForBill(billId: string) {
    try {
      console.log(`📝 Bill update for ${billId} - Full implementation pending cortex finance completion`);
      // This will be implemented when cortex finance includes payment tracking
    } catch (error) {
      console.error("❌ Error updating companion task for bill:", error);
      throw error;
    }
  }

  /**
   * Processes moratory interest for overdue bills
   * NOTE: Disabled until cortex finance includes payment tracking
   */
  static async processOverdueBills() {
    try {
      console.log("📋 Process overdue bills - Full implementation pending cortex finance completion");
      // This will be implemented when cortex finance includes payment tracking
    } catch (error) {
      console.error("❌ Error processing overdue bills:", error);
      throw error;
    }
  }

  /**
   * Processes payment application with penalty priority
   * NOTE: Disabled until cortex finance includes payment tracking
   */
  static async applyPaymentToBill(billId: string, paymentAmount: number) {
    try {
      console.log(`💳 Payment application for ${billId} - Full implementation pending cortex finance completion`);
      // This will be implemented when cortex finance includes payment tracking
      return {
        billId,
        paymentAmount,
        newStatus: "pending",
        message: "Payment tracking will be available with full cortex finance implementation"
      };
    } catch (error) {
      console.error("❌ Error applying payment to bill:", error);
      throw error;
    }
  }
}