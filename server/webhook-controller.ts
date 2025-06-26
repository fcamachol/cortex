import { Request, Response } from 'express';
import { WebhookApiAdapter } from './whatsapp-api-adapter'; // Import the next layer
import { webhookReliability } from './webhook-reliability';
import { messageRecovery } from './message-recovery-system';

/**
 * @class WebhookController
 * @description The "Front Door" of the application. Its only job is to receive
 * raw HTTP requests from the Evolution API, perform basic validation, and hand
 * off the processing to the adapter/service layer. It responds immediately to
 * the API to prevent timeouts.
 */
export const WebhookController = {
    async handleIncomingEvent(req: Request, res: Response): Promise<void> {
        try {
            const instanceName = req.params.instanceName;
            const eventType = req.params.eventType;
            const eventPayload = req.body;

            // Basic validation
            if (!instanceName || !eventType || !eventPayload) {
                console.warn('⚠️ Received invalid webhook payload.');
                res.status(400).json({ error: 'Invalid payload' });
                return;
            }

            // 1. Acknowledge receipt immediately.
            res.status(200).json({ status: "received" });

            // 2. Capture event with reliability system FIRST for guaranteed persistence
            const eventId = await webhookReliability.captureWebhookEvent(
                instanceName, 
                eventType, 
                eventPayload
            );

            // 3. Create standardized event payload for our adapter
            const standardizedEvent = {
                event: eventType.replace('-', '.'), // Convert "messages-upsert" to "messages.upsert"
                data: eventPayload.data || eventPayload, // Extract nested data if present
                instanceId: instanceName,
                reliabilityId: eventId
            };

            console.log(`🎯 [${instanceName}] Processing webhook: ${eventType} -> ${standardizedEvent.event} [${eventId}]`);

            // --- LOUD WEBHOOK DIAGNOSTICS FOR ALL EVENT TYPES ---
            console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
            console.log(`!!!    WEBHOOK EVENT: ${standardizedEvent.event.toUpperCase().padEnd(25)} !!!`);
            console.log(`!!!    INSTANCE: ${instanceName.padEnd(30)} !!!`);
            console.log(`!!!    RELIABILITY ID: ${eventId.padEnd(25)} !!!`);
            console.log(`!!!    DATA TYPE: ${typeof standardizedEvent.data}                      !!!`);
            console.log(`!!!    RAW EVENT: ${eventType.padEnd(27)} !!!`);
            console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');

            // 4. Pass the raw payload to the next layer for processing asynchronously.
            // We don't `await` this, allowing the HTTP response to be sent instantly.
            // But we wrap it to capture any processing failures for recovery
            WebhookApiAdapter.processIncomingEvent(instanceName, standardizedEvent)
                .catch(async (processingError) => {
                    console.error(`❌ [${instanceName}] Processing failed:`, processingError);
                    
                    // Capture failed message for recovery
                    await messageRecovery.captureFailedMessage(
                        instanceName,
                        eventType,
                        eventPayload,
                        processingError.message || 'Processing error'
                    ).catch(recoveryError => {
                        console.error('❌ Failed to capture message for recovery:', recoveryError);
                    });
                    
                    console.log(`💾 [${instanceName}] Captured failed event for recovery: ${eventType}`);
                });

        } catch (error) {
            console.error('❌ Critical error in webhook handler:', error);
            
            // Capture critical errors for recovery if possible
            try {
                await messageRecovery.captureFailedMessage(
                    instanceName || 'unknown',
                    eventType || 'unknown',
                    eventPayload || {},
                    error.message || 'Critical webhook error'
                );
            } catch (recoveryError) {
                console.error('❌ Failed to capture critical error for recovery:', recoveryError);
            }
        }
    }
};

/**
 * HOW TO USE THIS IN YOUR EXPRESS APP (e.g., in index.ts):
 * 
 * import express from 'express';
 * import { WebhookController } from './webhook-controller';
 * 
 * const app = express();
 * app.use(express.json({ limit: '50mb' })); // Use a large limit for media
 * 
 * // This single route handles all events for all instances
 * app.post(
 *   '/api/whatsapp/webhook/:instanceName',
 *   WebhookController.handleIncomingEvent
 * );
 * 
 * app.listen(5000, () => console.log('Server running on port 5000'));
 */