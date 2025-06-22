import { Request, Response } from 'express';

/**
 * @description This Map will hold the active connections to our frontend clients.
 * The key is a unique client ID, and the value is the Express Response object.
 */
const sseConnections = new Map<string, Response>();

/**
 * @class SseManager
 * @description Manages real-time updates pushed from the server to the client
 * using Server-Sent Events (SSE). This replaces inefficient polling.
 */
export const SseManager = {

    /**
     * Handles a new client connecting to the real-time event stream.
     * It sets the necessary headers and stores the connection.
     */
    handleNewConnection(req: Request, res: Response) {
        // Set headers for SSE connection
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders(); // Flush the headers to establish the connection

        const clientId = Date.now().toString() + Math.random().toString(36).substring(2);
        sseConnections.set(clientId, res);
        console.log(`📡 SSE Client connected: ${clientId}`);

        // Send a welcome message
        res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Welcome to the real-time event stream!' })}\n\n`);

        // Remove the client from the map when they disconnect
        req.on('close', () => {
            sseConnections.delete(clientId);
            console.log(`🔌 SSE Client disconnected: ${clientId}`);
        });

        req.on('aborted', () => {
            sseConnections.delete(clientId);
            console.log(`🔌 SSE Client aborted: ${clientId}`);
        });
    },

    /**
     * Pushes a new WhatsApp message to all connected clients.
     * This function should be called by your ActionService after a message is saved.
     * @param messageRecord - The clean message object to send to the frontend.
     */
    notifyClientsOfNewMessage(messageRecord: any) {
        if (sseConnections.size === 0) {
            return; // No clients to notify
        }
        
        console.log(`📡 Notifying ${sseConnections.size} connected clients of new message`);
        
        const messageData = JSON.stringify({
            type: 'new_message',
            payload: messageRecord
        });

        // Send the event to all connected clients
        for (const [clientId, res] of sseConnections.entries()) {
            try {
                res.write(`data: ${messageData}\n\n`);
            } catch (error) {
                console.error(`📡 Error sending to client ${clientId}:`, error);
                // Remove broken connection
                sseConnections.delete(clientId);
            }
        }
    },

    /**
     * Pushes a new task creation event to all connected clients.
     * This function should be called by the ActionService after a task is created.
     * @param taskRecord - The clean task object to send to the frontend.
     */
    notifyClientsOfNewTask(taskRecord: any) {
        if (sseConnections.size === 0) {
            return; // No clients to notify
        }
        
        console.log(`📡 Notifying ${sseConnections.size} connected clients of new task`);
        
        const taskData = JSON.stringify({
            type: 'new_task',
            payload: taskRecord
        });

        // Send the event to all connected clients
        for (const [clientId, res] of sseConnections.entries()) {
            try {
                res.write(`data: ${taskData}\n\n`);
            } catch (error) {
                console.error(`📡 Error sending to client ${clientId}:`, error);
                // Remove broken connection
                sseConnections.delete(clientId);
            }
        }
    },

    /**
     * Pushes a reaction event to all connected clients.
     * This function should be called by the ActionService after a reaction is processed.
     * @param reactionRecord - The clean reaction object to send to the frontend.
     */
    notifyClientsOfNewReaction(reactionRecord: any) {
        if (sseConnections.size === 0) {
            return; // No clients to notify
        }
        
        console.log(`📡 Notifying ${sseConnections.size} connected clients of new reaction`);
        
        const reactionData = JSON.stringify({
            type: 'new_reaction',
            payload: reactionRecord
        });

        // Send the event to all connected clients
        for (const [clientId, res] of sseConnections.entries()) {
            try {
                res.write(`data: ${reactionData}\n\n`);
            } catch (error) {
                console.error(`📡 Error sending to client ${clientId}:`, error);
                // Remove broken connection
                sseConnections.delete(clientId);
            }
        }
    },

    /**
     * Generic notification method for any type of event.
     * @param eventType - The type of event (e.g., 'action_completed', 'error', etc.)
     * @param payload - The data to send to clients
     */
    notifyClients(eventType: string, payload: any) {
        if (sseConnections.size === 0) {
            return; // No clients to notify
        }
        
        console.log(`📡 Notifying ${sseConnections.size} connected clients of ${eventType}`);
        
        const eventData = JSON.stringify({
            type: eventType,
            payload: payload
        });

        // Send the event to all connected clients
        for (const [clientId, res] of sseConnections.entries()) {
            try {
                res.write(`data: ${eventData}\n\n`);
            } catch (error) {
                console.error(`📡 Error sending to client ${clientId}:`, error);
                // Remove broken connection
                sseConnections.delete(clientId);
            }
        }
    },

    /**
     * Pushes a group update to all connected clients for immediate UI refresh.
     * This function should be called when group names change from Evolution API.
     */
    notifyClientsOfGroupUpdate(groupUpdate: any) {
        if (sseConnections.size === 0) {
            return; // No clients to notify
        }
        
        console.log(`📡 Notifying ${sseConnections.size} connected clients of group update: ${groupUpdate.subject}`);
        
        const groupData = JSON.stringify({
            type: 'group_update',
            payload: groupUpdate
        });

        // Send the event to all connected clients
        for (const [clientId, res] of sseConnections.entries()) {
            try {
                res.write(`data: ${groupData}\n\n`);
            } catch (error) {
                console.error(`📡 Error sending to client ${clientId}:`, error);
                // Remove broken connection
                sseConnections.delete(clientId);
            }
        }
    }
};

// Export the SseManager for compatibility
export const getSseManager = () => SseManager;

/**
 * @function setupSSE
 * @description Sets up the SSE endpoint to be used in Express routes.
 * Call this function from your main routes file to handle SSE connections.
 */
export function setupSSE(req: Request, res: Response) {
    SseManager.handleNewConnection(req, res);
}