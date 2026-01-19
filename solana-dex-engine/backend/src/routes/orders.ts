/**
 * Order Routes
 * REST API endpoints for order execution
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Queue } from 'bullmq';
import type { PrismaClient } from '@prisma/client';
import type { OrderJobData, CreateOrderResponse, ErrorResponse } from '../types/order.js';
import { TOKEN_ADDRESSES, getTokenSymbol } from '../types/order.js';

function timestamp(): string {
    return new Date().toISOString();
}

function log(message: string): void {
    console.log(`[${timestamp()}] [OrderRoutes] ${message}`);
}

// Validation schema for order input
const OrderInputSchema = z.object({
    tokenIn: z.string().min(32).max(50),
    tokenOut: z.string().min(32).max(50),
    amount: z.number().positive().min(0.01),
    type: z.literal('market').optional().default('market'),
}).refine(
    (data) => data.tokenIn !== data.tokenOut,
    { message: 'tokenIn and tokenOut must be different' }
);

type OrderInputType = z.infer<typeof OrderInputSchema>;

interface RouteContext {
    prisma: PrismaClient;
    orderQueue: Queue<OrderJobData>;
}

/**
 * Register order routes
 */
export async function registerOrderRoutes(
    fastify: FastifyInstance,
    { prisma, orderQueue }: RouteContext
): Promise<void> {
    /**
     * POST /api/orders/execute
     * Submit a market order for execution
     */
    fastify.post<{
        Body: OrderInputType;
        Reply: CreateOrderResponse | ErrorResponse;
    }>('/api/orders/execute', async (request, reply) => {
        const startTime = Date.now();

        try {
            // Validate input
            const validationResult = OrderInputSchema.safeParse(request.body);

            if (!validationResult.success) {
                const errors = validationResult.error.errors.map((e) => e.message).join(', ');
                log(`Validation failed: ${errors}`);

                return reply.status(400).send({
                    error: 'Validation Error',
                    message: errors,
                });
            }

            const { tokenIn, tokenOut, amount, type } = validationResult.data;

            log(`Received order: ${amount} ${getTokenSymbol(tokenIn)} → ${getTokenSymbol(tokenOut)}`);

            // Create order in database
            const order = await prisma.order.create({
                data: {
                    type,
                    status: 'pending',
                    tokenIn,
                    tokenOut,
                    amount,
                },
            });

            log(`Order created in database: ${order.id.slice(0, 8)}...`);

            // Add job to queue
            await orderQueue.add(
                order.id,
                {
                    orderId: order.id,
                    tokenIn,
                    tokenOut,
                    amount,
                },
                {
                    jobId: order.id,
                }
            );

            log(`Order added to queue: ${order.id.slice(0, 8)}... (took ${Date.now() - startTime}ms)`);

            return reply.status(201).send({
                orderId: order.id,
                status: 'pending',
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            log(`Error creating order: ${errorMessage}`);

            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Failed to create order',
            });
        }
    });

    /**
     * GET /api/orders/:orderId
     * Get order status
     */
    fastify.get<{
        Params: { orderId: string };
    }>('/api/orders/:orderId', async (request, reply) => {
        try {
            const { orderId } = request.params;

            const order = await prisma.order.findUnique({
                where: { id: orderId },
            });

            if (!order) {
                return reply.status(404).send({
                    error: 'Not Found',
                    message: 'Order not found',
                });
            }

            return reply.send(order);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            log(`Error fetching order: ${errorMessage}`);

            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Failed to fetch order',
            });
        }
    });

    /**
     * GET /api/orders
     * Get recent orders
     */
    fastify.get<{
        Querystring: { limit?: string };
    }>('/api/orders', async (request, reply) => {
        try {
            const limit = parseInt(request.query.limit || '20', 10);

            const orders = await prisma.order.findMany({
                orderBy: { createdAt: 'desc' },
                take: Math.min(limit, 100),
            });

            return reply.send(orders);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            log(`Error fetching orders: ${errorMessage}`);

            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Failed to fetch orders',
            });
        }
    });

    /**
     * GET /api/health
     * Health check endpoint
     */
    fastify.get('/api/health', async (request, reply) => {
        try {
            // Check database connection
            await prisma.$queryRaw`SELECT 1`;

            // Check queue connection
            const queueStats = await orderQueue.getJobCounts();

            return reply.send({
                status: 'healthy',
                database: 'connected',
                queue: {
                    active: queueStats.active,
                    waiting: queueStats.waiting,
                    completed: queueStats.completed,
                    failed: queueStats.failed,
                },
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            return reply.status(503).send({
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            });
        }
    });

    /**
     * GET /api/tokens
     * Get supported token list
     */
    fastify.get('/api/tokens', async (request, reply) => {
        return reply.send({
            tokens: Object.entries(TOKEN_ADDRESSES).map(([symbol, address]) => ({
                symbol,
                address,
            })),
        });
    });

    log('Order routes registered');
}
