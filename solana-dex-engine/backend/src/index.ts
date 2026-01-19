/**
 * Solana DEX Order Execution Engine - Main Server
 * Fastify server with WebSocket support, BullMQ queue, and Prisma ORM
 */

import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { registerOrderRoutes } from './routes/orders.js';
import { createOrderWorker, createOrderQueue } from './workers/orderWorker.js';
import { wsManager } from './services/websocket.js';
import type { Worker, Queue } from 'bullmq';
import type { OrderJobData } from './types/order.js';

function timestamp(): string {
    return new Date().toISOString();
}

function log(message: string): void {
    console.log(`[${timestamp()}] [Server] ${message}`);
}

// Environment variables with defaults
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Parse Redis URL
function parseRedisUrl(url: string): { host: string; port: number } {
    try {
        const parsed = new URL(url);
        return {
            host: parsed.hostname,
            port: parseInt(parsed.port || '6379', 10),
        };
    } catch {
        return { host: 'localhost', port: 6379 };
    }
}

// Initialize Prisma client
const prisma = new PrismaClient({
    log: NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// Create Fastify instance
const fastify = Fastify({
    logger: {
        level: NODE_ENV === 'development' ? 'info' : 'warn',
        transport: NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
    },
});

// Global state
let orderWorker: Worker<OrderJobData> | null = null;
let orderQueue: Queue<OrderJobData> | null = null;

/**
 * Validate environment variables
 */
function validateEnv(): void {
    const requiredVars = ['DATABASE_URL'];
    const missing = requiredVars.filter((v) => !process.env[v]);

    if (missing.length > 0) {
        log(`Missing required environment variables: ${missing.join(', ')}`);
        log('Using default values for development...');
    }
}

/**
 * Register plugins and routes
 */
async function registerPlugins(): Promise<void> {
    // CORS plugin
    await fastify.register(fastifyCors, {
        origin: NODE_ENV === 'development'
            ? ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']
            : true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    });

    log('CORS plugin registered');

    // WebSocket plugin
    await fastify.register(fastifyWebsocket, {
        options: {
            maxPayload: 1048576, // 1MB
        },
    });

    log('WebSocket plugin registered');
}

/**
 * Register WebSocket route
 */
async function registerWebSocketRoute(): Promise<void> {
    fastify.get('/ws/:orderId', { websocket: true }, (socket, request) => {
        const orderId = (request.params as { orderId: string }).orderId;

        log(`WebSocket connection request for order: ${orderId.slice(0, 8)}...`);

        // Validate orderId format (UUID)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(orderId)) {
            log(`Invalid orderId format: ${orderId}`);
            socket.close(1008, 'Invalid orderId format');
            return;
        }

        // Join the order room
        wsManager.joinRoom(orderId, socket);

        // Send initial connection success message
        socket.send(JSON.stringify({
            type: 'connected',
            orderId,
            message: 'WebSocket connected successfully',
            timestamp: new Date().toISOString(),
        }));

        // Handle incoming messages (for future use, like cancel requests)
        socket.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                log(`Received message from client: ${JSON.stringify(data)}`);

                // Echo back for now
                socket.send(JSON.stringify({
                    type: 'ack',
                    received: data,
                    timestamp: new Date().toISOString(),
                }));
            } catch {
                // Ignore invalid JSON
            }
        });

        socket.on('close', () => {
            log(`WebSocket closed for order: ${orderId.slice(0, 8)}...`);
        });

        socket.on('error', (error) => {
            log(`WebSocket error for order ${orderId.slice(0, 8)}...: ${error.message}`);
        });
    });

    log('WebSocket route registered: /ws/:orderId');
}

/**
 * Initialize BullMQ queue and worker
 */
async function initializeQueue(): Promise<void> {
    const redisConnection = parseRedisUrl(REDIS_URL);

    log(`Connecting to Redis at ${redisConnection.host}:${redisConnection.port}`);

    // Create queue
    orderQueue = createOrderQueue(redisConnection);

    // Create worker
    orderWorker = createOrderWorker(prisma, redisConnection);

    log('BullMQ queue and worker initialized');
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
    log(`Received ${signal}, starting graceful shutdown...`);

    try {
        // Close WebSocket connections
        wsManager.cleanup();

        // Close worker
        if (orderWorker) {
            await orderWorker.close();
            log('Order worker closed');
        }

        // Close queue
        if (orderQueue) {
            await orderQueue.close();
            log('Order queue closed');
        }

        // Close Fastify
        await fastify.close();
        log('Fastify server closed');

        // Disconnect Prisma
        await prisma.$disconnect();
        log('Prisma disconnected');

        log('Graceful shutdown complete');
        process.exit(0);
    } catch (error) {
        log(`Error during shutdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
    }
}

/**
 * Main startup function
 */
async function main(): Promise<void> {
    try {
        log('Starting Solana DEX Order Execution Engine...');
        log(`Environment: ${NODE_ENV}`);

        // Validate environment
        validateEnv();

        // Connect to database
        await prisma.$connect();
        log('Connected to PostgreSQL database');

        // Register plugins
        await registerPlugins();

        // Initialize queue
        await initializeQueue();

        if (!orderQueue) {
            throw new Error('Failed to initialize order queue');
        }

        // Register routes
        await registerOrderRoutes(fastify, { prisma, orderQueue });
        await registerWebSocketRoute();

        // Setup shutdown handlers
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        // Start server
        await fastify.listen({ port: PORT, host: HOST });

        log(`Server running at http://${HOST}:${PORT}`);
        log(`WebSocket available at ws://${HOST}:${PORT}/ws/:orderId`);
        log(`Health check at http://${HOST}:${PORT}/api/health`);
        log('Ready to process orders!');
    } catch (error) {
        log(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(error);
        process.exit(1);
    }
}

// Start the server
main();
