/**
 * WebSocket Manager Service
 * Manages WebSocket connections for real-time order status updates
 */

import type { WebSocket } from 'ws';
import type { OrderStatus } from '../types/order.js';

function timestamp(): string {
    return new Date().toISOString();
}

function log(message: string): void {
    console.log(`[${timestamp()}] [WebSocketManager] ${message}`);
}

export class WebSocketManager {
    // Map of orderId to set of connected WebSocket clients
    private rooms: Map<string, Set<WebSocket>> = new Map();

    // Track all connections for cleanup
    private allConnections: Set<WebSocket> = new Set();

    /**
     * Add a WebSocket connection to an order's room
     */
    joinRoom(orderId: string, ws: WebSocket): void {
        if (!this.rooms.has(orderId)) {
            this.rooms.set(orderId, new Set());
        }

        this.rooms.get(orderId)!.add(ws);
        this.allConnections.add(ws);

        log(`Client joined room for order ${orderId.slice(0, 8)}... (${this.rooms.get(orderId)!.size} clients)`);

        // Setup cleanup handlers
        ws.on('close', () => {
            this.leaveRoom(orderId, ws);
        });

        ws.on('error', (error) => {
            log(`WebSocket error in room ${orderId.slice(0, 8)}...: ${error.message}`);
            this.leaveRoom(orderId, ws);
        });
    }

    /**
     * Remove a WebSocket connection from an order's room
     */
    leaveRoom(orderId: string, ws: WebSocket): void {
        const room = this.rooms.get(orderId);

        if (room) {
            room.delete(ws);
            log(`Client left room for order ${orderId.slice(0, 8)}... (${room.size} clients remaining)`);

            // Clean up empty rooms
            if (room.size === 0) {
                this.rooms.delete(orderId);
                log(`Room for order ${orderId.slice(0, 8)}... removed (no clients)`);
            }
        }

        this.allConnections.delete(ws);
    }

    /**
     * Broadcast a status update to all clients watching an order
     */
    broadcast(orderId: string, message: OrderStatus): void {
        const room = this.rooms.get(orderId);

        if (!room || room.size === 0) {
            log(`No clients in room for order ${orderId.slice(0, 8)}... (message not sent)`);
            return;
        }

        const messageStr = JSON.stringify(message);
        let sentCount = 0;
        let failedCount = 0;

        for (const ws of room) {
            try {
                if (ws.readyState === 1) { // WebSocket.OPEN
                    ws.send(messageStr);
                    sentCount++;
                } else {
                    failedCount++;
                    // Remove closed connections
                    room.delete(ws);
                    this.allConnections.delete(ws);
                }
            } catch (error) {
                failedCount++;
                log(`Error sending to client: ${error instanceof Error ? error.message : 'Unknown error'}`);
                room.delete(ws);
                this.allConnections.delete(ws);
            }
        }

        log(`Broadcast ${message.status} to ${sentCount} clients for order ${orderId.slice(0, 8)}...` +
            (failedCount > 0 ? ` (${failedCount} failed)` : ''));
    }

    /**
     * Get the number of rooms (orders being watched)
     */
    getRoomCount(): number {
        return this.rooms.size;
    }

    /**
     * Get the total number of connected clients
     */
    getConnectionCount(): number {
        return this.allConnections.size;
    }

    /**
     * Get the number of clients watching a specific order
     */
    getRoomClientCount(orderId: string): number {
        return this.rooms.get(orderId)?.size || 0;
    }

    /**
     * Create an OrderStatus message
     */
    createStatusMessage(
        orderId: string,
        status: OrderStatus['status'],
        data?: OrderStatus['data']
    ): OrderStatus {
        return {
            orderId,
            status,
            data,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Clean up all connections (for graceful shutdown)
     */
    cleanup(): void {
        log(`Cleaning up ${this.allConnections.size} WebSocket connections...`);

        for (const ws of this.allConnections) {
            try {
                ws.close(1000, 'Server shutting down');
            } catch (error) {
                // Ignore errors during cleanup
            }
        }

        this.rooms.clear();
        this.allConnections.clear();

        log('WebSocket cleanup complete');
    }
}

// Export singleton instance
export const wsManager = new WebSocketManager();
