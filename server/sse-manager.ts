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
        // Set headers for SSE connection with CORS support
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
        res.flushHeaders(); // Flush the headers to establish the connection

        const clientId = Date.now().toString() + Math.random().toString(36).substring(2);
        sseConnections.set(clientId, res);
        console.log(`📡 SSE Client connected: ${clientId}`);

        // Send a welcome message
        res.write(`data: ${JSON.stringify({ type: 'connected', clientId, message: 'Welcome to the real-time event stream!' })}\n\n`);

        // Set up heartbeat to keep connection alive
        const heartbeatInterval = setInterval(() => {
            try {
                res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
            } catch (error) {
                console.log(`🔌 Heartbeat failed for client ${clientId}, removing connection`);
                clearInterval(heartbeatInterval);
                sseConnections.delete(clientId);
            }
        }, 30000); // Send heartbeat every 30 seconds

        // Clean up function
        const cleanup = () => {
            clearInterval(heartbeatInterval);
            sseConnections.delete(clientId);
            console.log(`🔌 SSE Client disconnected: ${clientId}`);
        };

        // Remove the client from the map when they disconnect
        req.on('close', cleanup);
        req.on('aborted', cleanup);
        res.on('close', cleanup);
        res.on('finish', cleanup);
        res.on('error', (error) => {
            console.log(`🔌 SSE Connection error for ${clientId}:`, error.message);
            cleanup();
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
        for (const [clientId, res] of Array.from(sseConnections.entries())) {
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
        for (const [clientId, res] of Array.from(sseConnections.entries())) {
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
        for (const [clientId, res] of Array.from(sseConnections.entries())) {
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
     * Notifies clients of contact/chat updates that should refresh conversation list
     */
    notifyClientsOfChatUpdate(updateData: any) {
        if (sseConnections.size === 0) {
            return; // No clients to notify
        }
        
        console.log(`📡 Notifying ${sseConnections.size} connected clients of chat update`);
        
        const chatData = JSON.stringify({
            type: 'conversation_updated',
            payload: updateData
        });

        // Send the event to all connected clients
        for (const [clientId, res] of Array.from(sseConnections.entries())) {
            try {
                res.write(`data: ${chatData}\n\n`);
            } catch (error) {
                console.error(`📡 Error sending to client ${clientId}:`, error);
                // Remove broken connection
                sseConnections.delete(clientId);
            }
        }
    },

    /**
     * Notifies clients of contact information updates
     */
    notifyClientsOfContactUpdate(contactData: any) {
        this.notifyClients('contact_updated', contactData);
    },

    /**
     * Notifies clients of group metadata updates
     */
    notifyClientsOfGroupUpdate(groupData: any) {
        this.notifyClients('group_updated', groupData);
    },

    /**
     * Notifies clients of message status updates (read, delivered, etc.)
     */
    notifyClientsOfMessageStatusUpdate(statusData: any) {
        this.notifyClients('message_status_update', statusData);
    },

    /**
     * Notifies clients of draft message updates
     */
    notifyClientsOfDraftUpdate(draftData: any) {
        this.notifyClients('draft_updated', draftData);
    },

    /**
     * Notifies clients of waiting reply status changes
     */
    notifyClientsOfWaitingReplyUpdate(waitingData: any) {
        this.notifyClients(waitingData.action === 'added' ? 'waiting_reply_added' : 'waiting_reply_removed', waitingData);
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
        for (const [clientId, res] of Array.from(sseConnections.entries())) {
            try {
                res.write(`data: ${eventData}\n\n`);
            } catch (error) {
                console.error(`📡 Error sending to client ${clientId}:`, error);
                // Remove broken connection
                sseConnections.delete(clientId);
            }
        }
    },


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