import { BillToTaskService } from './bill-task-service';
import cron from 'node-cron';

/**
 * Scheduled Jobs Service
 * Handles daily processing of overdue bills and penalty calculations
 */
export class ScheduledJobsService {
  private static isRunning = false;

  /**
   * Start all scheduled jobs
   */
  static start() {
    if (this.isRunning) {
      console.log('⏰ Scheduled jobs already running');
      return;
    }

    this.isRunning = true;
    console.log('⏰ Starting scheduled jobs...');

    // Process overdue bills daily at 1:00 AM
    cron.schedule('0 1 * * *', async () => {
      console.log('🔄 Running daily overdue bills processing...');
      try {
        await BillToTaskService.processOverdueBills();
        console.log('✅ Daily overdue bills processing completed');
      } catch (error) {
        console.error('❌ Error in daily overdue bills processing:', error);
      }
    }, {
      timezone: 'America/Mexico_City' // Adjust timezone as needed
    });

    // Also run a check every 6 hours to catch any missed penalties
    cron.schedule('0 */6 * * *', async () => {
      console.log('🔄 Running 6-hourly overdue bills check...');
      try {
        await BillToTaskService.processOverdueBills();
        console.log('✅ 6-hourly overdue bills check completed');
      } catch (error) {
        console.error('❌ Error in 6-hourly overdue bills check:', error);
      }
    }, {
      timezone: 'America/Mexico_City'
    });

    console.log('✅ Scheduled jobs started successfully');
  }

  /**
   * Stop all scheduled jobs
   */
  static stop() {
    if (!this.isRunning) {
      console.log('⏰ Scheduled jobs not running');
      return;
    }

    cron.getTasks().forEach(task => task.stop());
    this.isRunning = false;
    console.log('🛑 Scheduled jobs stopped');
  }

  /**
   * Manual trigger for overdue bills processing (for testing)
   */
  static async triggerOverdueBillsProcessing() {
    console.log('🔄 Manually triggering overdue bills processing...');
    try {
      await BillToTaskService.processOverdueBills();
      console.log('✅ Manual overdue bills processing completed');
      return { success: true, message: 'Overdue bills processing completed' };
    } catch (error) {
      console.error('❌ Error in manual overdue bills processing:', error);
      return { success: false, error: error.message };
    }
  }
}