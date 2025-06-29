import { db } from "./db";
import { cortexBills, crmTasks } from "@shared/schema";
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
   */
  static async createTaskForBill(payableId: number, options: BillToTaskOptions) {
    try {
      // Get the bill details
      const [payable] = await db
        .select()
        .from(financePayables)
        .where(eq(financePayables.payableId, payableId));

      if (!payable) {
        throw new Error(`Payable with ID ${payableId} not found`);
      }

      // Calculate total amount owed (original + penalties)
      const totalOwed = parseFloat(payable.totalAmount) + parseFloat(payable.penaltyBalance);
      
      // Create the companion task
      const taskTitle = `Pay ${payable.description} ($${totalOwed.toFixed(2)})`;
      const taskDescription = `Bill Payment Due: ${payable.dueDate}\nOriginal Amount: $${payable.totalAmount}\nPenalties: $${payable.penaltyBalance}`;

      const [task] = await db
        .insert(crmTasks)
        .values({
          instanceId: options.instanceId,
          title: taskTitle,
          description: taskDescription,
          status: "to_do",
          priority: "medium",
          taskType: "bill_payment",
          dueDate: new Date(payable.dueDate + "T23:59:59Z"), // End of due date
          linkedPayableId: payableId,
          createdByUserId: options.createdByUserId,
          spaceId: options.spaceId,
        })
        .returning();

      console.log(`✅ Created companion task (ID: ${task.taskId}) for bill: ${payable.description}`);
      return task;
    } catch (error) {
      console.error("❌ Error creating companion task for bill:", error);
      throw error;
    }
  }

  /**
   * Updates the companion task when bill status changes
   */
  static async updateTaskForBill(payableId: number) {
    try {
      // Get the bill and its linked task
      const [payable] = await db
        .select()
        .from(financePayables)
        .where(eq(financePayables.payableId, payableId));

      if (!payable) return;

      const [task] = await db
        .select()
        .from(crmTasks)
        .where(eq(crmTasks.linkedPayableId, payableId));

      if (!task) return;

      // Calculate total amount owed
      const totalOwed = parseFloat(payable.totalAmount) + parseFloat(payable.penaltyBalance);
      const amountPaid = parseFloat(payable.amountPaid);
      const remainingAmount = totalOwed - amountPaid;

      // Update task based on bill status
      let taskStatus = task.status;
      let taskTitle = task.title;

      if (payable.status === "paid") {
        taskStatus = "done";
        taskTitle = `✅ Paid: ${payable.description} ($${totalOwed.toFixed(2)})`;
      } else if (payable.status === "partially_paid") {
        taskTitle = `Pay ${payable.description} ($${remainingAmount.toFixed(2)} remaining)`;
      } else if (payable.status === "overdue") {
        taskTitle = `⚠️ OVERDUE: ${payable.description} ($${totalOwed.toFixed(2)})`;
      } else {
        taskTitle = `Pay ${payable.description} ($${totalOwed.toFixed(2)})`;
      }

      // Update the task
      await db
        .update(crmTasks)
        .set({
          title: taskTitle,
          status: taskStatus,
          description: `Bill Payment Status: ${payable.status.toUpperCase()}\nDue Date: ${payable.dueDate}\nOriginal Amount: $${payable.totalAmount}\nAmount Paid: $${payable.amountPaid}\nPenalties: $${payable.penaltyBalance}\nRemaining: $${remainingAmount.toFixed(2)}`,
          priority: payable.status === "overdue" ? "high" : task.priority,
          updatedAt: new Date(),
        })
        .where(eq(crmTasks.taskId, task.taskId));

      console.log(`✅ Updated companion task for bill: ${payable.description}`);
    } catch (error) {
      console.error("❌ Error updating companion task for bill:", error);
      throw error;
    }
  }

  /**
   * Processes moratory interest for overdue bills
   * This should be run daily as a scheduled job
   */
  static async processOverdueBills() {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Find all overdue bills that are not fully paid
      const overdueBills = await db
        .select()
        .from(financePayables)
        .where(
          and(
            lt(financePayables.dueDate, today),
            eq(financePayables.status, "unpaid")
          )
        );

      console.log(`📋 Processing ${overdueBills.length} overdue bills for moratory interest...`);

      for (const bill of overdueBills) {
        // Calculate days overdue
        const dueDate = new Date(bill.dueDate);
        const currentDate = new Date();
        const daysOverdue = Math.floor((currentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOverdue > 0 && parseFloat(bill.moratoryRate || "0") > 0) {
          // Calculate daily moratory interest
          const principalAmount = parseFloat(bill.totalAmount);
          const dailyRate = parseFloat(bill.moratoryRate || "0");
          const dailyPenalty = principalAmount * dailyRate;
          
          // Add today's penalty to the existing penalty balance
          const currentPenaltyBalance = parseFloat(bill.penaltyBalance);
          const newPenaltyBalance = currentPenaltyBalance + dailyPenalty;

          // Update the bill
          await db
            .update(financePayables)
            .set({
              penaltyBalance: newPenaltyBalance.toFixed(2),
              status: "overdue",
              updatedAt: new Date(),
            })
            .where(eq(financePayables.payableId, bill.payableId));

          console.log(`💰 Added $${dailyPenalty.toFixed(2)} penalty to bill: ${bill.description} (${daysOverdue} days overdue)`);

          // Update the companion task
          await this.updateTaskForBill(bill.payableId);
        }
      }

      console.log(`✅ Completed processing overdue bills for moratory interest`);
    } catch (error) {
      console.error("❌ Error processing overdue bills:", error);
      throw error;
    }
  }

  /**
   * Processes payment application with penalty priority
   * Payments are applied to penalties first, then principal
   */
  static async applyPaymentToBill(payableId: number, paymentAmount: number) {
    try {
      const [payable] = await db
        .select()
        .from(financePayables)
        .where(eq(financePayables.payableId, payableId));

      if (!payable) {
        throw new Error(`Payable with ID ${payableId} not found`);
      }

      const currentPenaltyBalance = parseFloat(payable.penaltyBalance);
      const currentAmountPaid = parseFloat(payable.amountPaid);
      const totalAmount = parseFloat(payable.totalAmount);
      
      let newPenaltyBalance = currentPenaltyBalance;
      let newAmountPaid = currentAmountPaid;
      let remainingPayment = paymentAmount;

      // Step 1: Apply payment to penalties first
      if (remainingPayment > 0 && currentPenaltyBalance > 0) {
        const penaltyPayment = Math.min(remainingPayment, currentPenaltyBalance);
        newPenaltyBalance = currentPenaltyBalance - penaltyPayment;
        remainingPayment -= penaltyPayment;
        console.log(`💳 Applied $${penaltyPayment.toFixed(2)} to penalties`);
      }

      // Step 2: Apply remaining payment to principal
      if (remainingPayment > 0) {
        const unpaidPrincipal = totalAmount - currentAmountPaid;
        const principalPayment = Math.min(remainingPayment, unpaidPrincipal);
        newAmountPaid = currentAmountPaid + principalPayment;
        console.log(`💳 Applied $${principalPayment.toFixed(2)} to principal`);
      }

      // Determine new status
      let newStatus = payable.status;
      const totalOwed = totalAmount + newPenaltyBalance;
      const totalPaid = newAmountPaid + (currentPenaltyBalance - newPenaltyBalance);

      if (totalPaid >= totalOwed) {
        newStatus = "paid";
      } else if (newAmountPaid > 0 || newPenaltyBalance < currentPenaltyBalance) {
        newStatus = "partially_paid";
      }

      // Update the bill
      await db
        .update(financePayables)
        .set({
          amountPaid: newAmountPaid.toFixed(2),
          penaltyBalance: newPenaltyBalance.toFixed(2),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(financePayables.payableId, payableId));

      console.log(`✅ Payment applied to bill: ${payable.description} (New status: ${newStatus})`);

      // Update the companion task
      await this.updateTaskForBill(payableId);

      return {
        payableId,
        paymentAmount,
        penaltyPaid: currentPenaltyBalance - newPenaltyBalance,
        principalPaid: newAmountPaid - currentAmountPaid,
        newStatus,
        remainingBalance: totalAmount + newPenaltyBalance - newAmountPaid - (currentPenaltyBalance - newPenaltyBalance),
      };
    } catch (error) {
      console.error("❌ Error applying payment to bill:", error);
      throw error;
    }
  }
}