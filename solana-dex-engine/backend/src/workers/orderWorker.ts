/**
 * BullMQ Order Worker
 * Processes order execution jobs with concurrent processing,
 * retry logic, and real-time status updates via WebSocket
 */

import { Worker, Job, Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { dexRouter } from '../services/dexRouter.js';
import { wsManager } from '../services/websocket.js';
import type { OrderJobData, OrderStatus } from '../types/order.js';

const QUEUE_NAME = 'order-queue';
const CONCURRENCY = 10;

function timestamp(): string {
    return new Date().toISOString();
}

function log(message: string): void {
    console.log(`[${timestamp()}] [OrderWorker] ${message}`);
}

/**
 * Update order status in database and broadcast via WebSocket
 */
async function updateOrderStatus(
    prisma: PrismaClient,
    orderId: string,
    status: OrderStatus['status'],
    data?: Partial<{
        dex: string;
        txHash: string;
        price: number;
        error: string;
    }>,
    wsData?: OrderStatus['data']
): Promise<void> {
    // Update database
    await prisma.order.update({
        where: { id: orderId },
        data: {
            status,
            ...(data?.dex && { dex: data.dex }),
            ...(data?.txHash && { txHash: data.txHash }),
            ...(data?.price && { price: data.price }),
            ...(data?.error && { error: data.error }),
        },
    });

    // Broadcast via WebSocket
    const message = wsManager.createStatusMessage(orderId, status, wsData);
    wsManager.broadcast(orderId, message);
}

/**
 * Process a single order job
 */
async function processOrder(job: Job<OrderJobData>, prisma: PrismaClient): Promise<void> {
    const { orderId, tokenIn, tokenOut, amount } = job.data;

    log(`Processing order ${orderId.slice(0, 8)}... (attempt ${job.attemptsMade + 1}/${job.opts.attempts || 1})`);

    try {
        // Step 1: Emit pending status
        await updateOrderStatus(prisma, orderId, 'pending', undefined, undefined);
        log(`Order ${orderId.slice(0, 8)}... status: pending`);

        // Step 2: Route order - compare DEX prices
        await updateOrderStatus(prisma, orderId, 'routing', undefined, undefined);
        log(`Order ${orderId.slice(0, 8)}... status: routing`);

        const routingResult = await dexRouter.compareAndRoute(tokenIn, tokenOut, amount);

        // Emit routing result with both prices
        await updateOrderStatus(
            prisma,
            orderId,
            'routing',
            { dex: routingResult.selectedDex },
            {
                dex: routingResult.selectedDex,
                raydiumPrice: routingResult.raydiumQuote.price,
                meteoraPrice: routingResult.meteoraQuote.price,
            }
        );
        log(`Order ${orderId.slice(0, 8)}... routed to ${routingResult.selectedDex}`);

        // Step 3: Building transaction
        await updateOrderStatus(prisma, orderId, 'building', undefined, {
            dex: routingResult.selectedDex,
            raydiumPrice: routingResult.raydiumQuote.price,
            meteoraPrice: routingResult.meteoraQuote.price,
        });
        log(`Order ${orderId.slice(0, 8)}... status: building`);

        // Get the quoted price for the selected DEX
        const quotedPrice = routingResult.selectedDex === 'Raydium'
            ? routingResult.raydiumQuote.price
            : routingResult.meteoraQuote.price;

        // Step 4: Execute swap
        await updateOrderStatus(prisma, orderId, 'submitted', undefined, {
            dex: routingResult.selectedDex,
            raydiumPrice: routingResult.raydiumQuote.price,
            meteoraPrice: routingResult.meteoraQuote.price,
        });
        log(`Order ${orderId.slice(0, 8)}... status: submitted`);

        const swapResult = await dexRouter.executeSwap(
            tokenIn,
            tokenOut,
            amount,
            routingResult.selectedDex,
            quotedPrice
        );

        if (swapResult.success) {
            // Step 5: Confirmed
            await updateOrderStatus(
                prisma,
                orderId,
                'confirmed',
                {
                    dex: swapResult.dex,
                    txHash: swapResult.txHash,
                    price: swapResult.executedPrice,
                },
                {
                    dex: swapResult.dex,
                    txHash: swapResult.txHash,
                    executedPrice: swapResult.executedPrice,
                    raydiumPrice: routingResult.raydiumQuote.price,
                    meteoraPrice: routingResult.meteoraQuote.price,
                }
            );
            log(`Order ${orderId.slice(0, 8)}... CONFIRMED - TX: ${swapResult.txHash.slice(0, 16)}...`);
        } else {
            throw new Error('Swap execution failed on the selected DEX');
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log(`Order ${orderId.slice(0, 8)}... FAILED: ${errorMessage}`);

        // Only mark as failed if we've exhausted retries
        const maxAttempts = job.opts.attempts || 3;
        if (job.attemptsMade + 1 >= maxAttempts) {
            await updateOrderStatus(
                prisma,
                orderId,
                'failed',
                { error: errorMessage },
                { error: errorMessage }
            );
        }

        throw error; // Re-throw to trigger retry
    }
}

/**
 * Create and start the order worker
 */
export function createOrderWorker(
    prisma: PrismaClient,
    redisConnection: { host: string; port: number }
): Worker<OrderJobData> {
    log(`Creating worker with concurrency: ${CONCURRENCY}`);

    const worker = new Worker<OrderJobData>(
        QUEUE_NAME,
        async (job) => {
            await processOrder(job, prisma);
        },
        {
            connection: {
                ...redisConnection,
                maxRetriesPerRequest: null,
            },
            concurrency: CONCURRENCY,
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 100 },
        }
    );

    worker.on('active', (job) => {
        log(`Job ${job.id} started processing`);
    });

    worker.on('completed', (job) => {
        log(`Job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, error) => {
        if (job) {
            log(`Job ${job.id} failed: ${error.message}`);
        } else {
            log(`Job failed: ${error.message}`);
        }
    });

    worker.on('error', (error) => {
        log(`Worker error: ${error.message}`);
    });

    worker.on('stalled', (jobId) => {
        log(`Job ${jobId} stalled`);
    });

    log('Order worker created and listening for jobs');

    return worker;
}

/**
 * Create the order queue
 */
export function createOrderQueue(
    redisConnection: { host: string; port: number }
): Queue<OrderJobData> {
    const queue = new Queue<OrderJobData>(QUEUE_NAME, {
        connection: {
            ...redisConnection,
            maxRetriesPerRequest: null,
        },
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000, // 1s, 3s, 9s
            },
            removeOnComplete: 100,
            removeOnFail: 100,
        },
    });

    log('Order queue created');

    return queue;
}

export { QUEUE_NAME, CONCURRENCY };
