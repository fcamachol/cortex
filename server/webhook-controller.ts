import { Request, Response } from 'express';
import { WebhookApiAdapter } from './whatsapp-api-adapter'; // Import the next layer

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

            // 2. Create standardized event payload for our adapter
            const standardizedEvent = {
                event: eventType.replace('-', '.'), // Convert "messages-upsert" to "messages.upsert"
                data: eventPayload.data || eventPayload, // Extract nested data if present
                instanceId: instanceName
            };

            console.log(`🎯 [${instanceName}] Processing webhook: ${eventType} -> ${standardizedEvent.event}`);

            // 3. Pass the raw payload to the next layer for processing asynchronously.
            // We don't `await` this, allowing the HTTP response to be sent instantly.
            WebhookApiAdapter.processIncomingEvent(instanceName, standardizedEvent);

        } catch (error) {
            console.error('❌ Critical error in webhook handler:', error);
            // The response has likely already been sent, so we just log the error.
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