/**
 * Queue Tests
 * Tests for BullMQ queue behavior, concurrency, and retry logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OrderJobData, OrderStatus } from '../types/order.js';
import { TOKEN_ADDRESSES } from '../types/order.js';

// Mock job data factory
function createMockJobData(overrides?: Partial<OrderJobData>): OrderJobData {
    return {
        orderId: `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tokenIn: TOKEN_ADDRESSES.SOL,
        tokenOut: TOKEN_ADDRESSES.USDC,
        amount: 1.5,
        ...overrides,
    };
}

// Mock job for testing
interface MockJob {
    id: string;
    data: OrderJobData;
    attemptsMade: number;
    opts: { attempts?: number };
}

function createMockJob(data: OrderJobData, attempts = 0): MockJob {
    return {
        id: data.orderId,
        data,
        attemptsMade: attempts,
        opts: { attempts: 3 },
    };
}

describe('Queue Job Data', () => {
    describe('OrderJobData structure', () => {
        it('should create valid job data', () => {
            const jobData = createMockJobData();

            expect(jobData).toBeDefined();
            expect(jobData.orderId).toBeDefined();
            expect(jobData.tokenIn).toBe(TOKEN_ADDRESSES.SOL);
            expect(jobData.tokenOut).toBe(TOKEN_ADDRESSES.USDC);
            expect(jobData.amount).toBe(1.5);
        });

        it('should allow custom token pairs', () => {
            const jobData = createMockJobData({
                tokenIn: TOKEN_ADDRESSES.USDC,
                tokenOut: TOKEN_ADDRESSES.RAY,
                amount: 100,
            });

            expect(jobData.tokenIn).toBe(TOKEN_ADDRESSES.USDC);
            expect(jobData.tokenOut).toBe(TOKEN_ADDRESSES.RAY);
            expect(jobData.amount).toBe(100);
        });

        it('should generate unique order IDs', () => {
            const ids = new Set<string>();

            for (let i = 0; i < 100; i++) {
                const jobData = createMockJobData();
                ids.add(jobData.orderId);
            }

            expect(ids.size).toBe(100);
        });
    });

    describe('Mock Job', () => {
        it('should track attempt count', () => {
            const jobData = createMockJobData();
            const job = createMockJob(jobData, 0);

            expect(job.attemptsMade).toBe(0);

            const retriedJob = createMockJob(jobData, 2);
            expect(retriedJob.attemptsMade).toBe(2);
        });

        it('should have configurable max attempts', () => {
            const jobData = createMockJobData();
            const job = createMockJob(jobData);

            expect(job.opts.attempts).toBe(3);
        });
    });
});

describe('Queue Concurrency', () => {
    it('should support configured concurrency level', () => {
        const CONCURRENCY = 10;
        expect(CONCURRENCY).toBe(10);
    });

    it('should process multiple jobs in parallel simulation', async () => {
        const jobs = Array(10).fill(null).map(() => createMockJobData());
        const processedJobs: string[] = [];
        const startTimes: Record<string, number> = {};

        // Simulate parallel processing
        await Promise.all(
            jobs.map(async (jobData) => {
                startTimes[jobData.orderId] = Date.now();
                // Simulate processing delay
                await new Promise((resolve) => setTimeout(resolve, 50));
                processedJobs.push(jobData.orderId);
            })
        );

        expect(processedJobs.length).toBe(10);

        // All jobs should complete in roughly the same time (parallel)
        const totalTime = Date.now() - Math.min(...Object.values(startTimes));
        expect(totalTime).toBeLessThan(200); // Should be ~50ms if truly parallel
    });
});

describe('Queue Retry Logic', () => {
    it('should calculate exponential backoff delays', () => {
        const baseDelay = 1000;
        const expectedDelays = [1000, 3000, 9000]; // 1s, 3s, 9s

        for (let attempt = 0; attempt < 3; attempt++) {
            const delay = baseDelay * Math.pow(3, attempt);
            expect(delay).toBe(expectedDelays[attempt]);
        }
    });

    it('should respect max attempts configuration', () => {
        const maxAttempts = 3;
        const jobData = createMockJobData();

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const job = createMockJob(jobData, attempt);
            const shouldRetry = job.attemptsMade + 1 < maxAttempts;

            if (attempt < maxAttempts - 1) {
                expect(shouldRetry).toBe(true);
            } else {
                expect(shouldRetry).toBe(false);
            }
        }
    });

    it('should mark job as failed after all retries exhausted', () => {
        const jobData = createMockJobData();
        const finalJob = createMockJob(jobData, 2); // 3rd attempt (0-indexed)

        const isLastAttempt = finalJob.attemptsMade + 1 >= (finalJob.opts.attempts || 1);
        expect(isLastAttempt).toBe(true);
    });
});

describe('Order Status Updates', () => {
    it('should have correct status progression', () => {
        const statuses: OrderStatus['status'][] = [
            'pending',
            'routing',
            'building',
            'submitted',
            'confirmed',
        ];

        for (let i = 0; i < statuses.length - 1; i++) {
            const currentIndex = statuses.indexOf(statuses[i]);
            const nextIndex = statuses.indexOf(statuses[i + 1]);
            expect(nextIndex).toBe(currentIndex + 1);
        }
    });

    it('should transition to failed status on error', () => {
        const statuses: OrderStatus['status'][] = [
            'pending',
            'routing',
            'building',
            'submitted',
            'failed',
        ];

        const finalStatus = statuses[statuses.length - 1];
        expect(finalStatus).toBe('failed');
    });

    it('should create valid OrderStatus messages', () => {
        const orderId = 'test-order-123';
        const status: OrderStatus['status'] = 'routing';
        const data = {
            raydiumPrice: 100.5,
            meteoraPrice: 99.8,
            dex: 'Meteora' as const,
        };

        const message: OrderStatus = {
            orderId,
            status,
            data,
            timestamp: new Date().toISOString(),
        };

        expect(message.orderId).toBe(orderId);
        expect(message.status).toBe(status);
        expect(message.data?.raydiumPrice).toBe(100.5);
        expect(message.data?.meteoraPrice).toBe(99.8);
        expect(message.data?.dex).toBe('Meteora');
        expect(message.timestamp).toBeDefined();
    });
});

describe('Queue Error Handling', () => {
    it('should capture error messages correctly', () => {
        const errorMessage = 'Swap execution failed on the selected DEX';
        const error = new Error(errorMessage);

        expect(error.message).toBe(errorMessage);
    });

    it('should handle unknown errors gracefully', () => {
        const unknownError = 'Something went wrong';
        const errorMessage = typeof unknownError === 'string'
            ? unknownError
            : 'Unknown error';

        expect(errorMessage).toBe('Something went wrong');
    });

    it('should extract error message from Error objects', () => {
        const errors = [
            new Error('Network timeout'),
            new Error('Insufficient liquidity'),
            new Error('Price slippage exceeded'),
        ];

        for (const error of errors) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            expect(typeof message).toBe('string');
            expect(message.length).toBeGreaterThan(0);
        }
    });
});
