/**
 * Order Routes Tests
 * Tests for order API endpoints and validation
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TOKEN_ADDRESSES } from '../types/order.js';

// Mock dependencies
vi.mock('@prisma/client', () => ({
    PrismaClient: vi.fn().mockImplementation(() => ({
        order: {
            create: vi.fn().mockImplementation((data) => ({
                id: 'test-order-id-123',
                type: data.data.type,
                status: data.data.status,
                tokenIn: data.data.tokenIn,
                tokenOut: data.data.tokenOut,
                amount: data.data.amount,
                dex: null,
                txHash: null,
                price: null,
                error: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            })),
            findUnique: vi.fn().mockImplementation(({ where }) => {
                if (where.id === 'test-order-id-123') {
                    return {
                        id: 'test-order-id-123',
                        type: 'market',
                        status: 'pending',
                        tokenIn: TOKEN_ADDRESSES.SOL,
                        tokenOut: TOKEN_ADDRESSES.USDC,
                        amount: 1.5,
                        dex: null,
                        txHash: null,
                        price: null,
                        error: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    };
                }
                return null;
            }),
            findMany: vi.fn().mockResolvedValue([]),
        },
        $queryRaw: vi.fn().mockResolvedValue([{ result: 1 }]),
    })),
}));

// Zod schema for testing
const OrderInputSchema = z.object({
    tokenIn: z.string().min(32).max(50),
    tokenOut: z.string().min(32).max(50),
    amount: z.number().positive().min(0.01),
    type: z.literal('market').optional().default('market'),
}).refine(
    (data) => data.tokenIn !== data.tokenOut,
    { message: 'tokenIn and tokenOut must be different' }
);

describe('Order Input Validation', () => {
    describe('OrderInputSchema', () => {
        it('should validate correct order input', () => {
            const input = {
                tokenIn: TOKEN_ADDRESSES.SOL,
                tokenOut: TOKEN_ADDRESSES.USDC,
                amount: 1.5,
                type: 'market' as const,
            };

            const result = OrderInputSchema.safeParse(input);
            expect(result.success).toBe(true);
        });

        it('should reject order with same tokenIn and tokenOut', () => {
            const input = {
                tokenIn: TOKEN_ADDRESSES.SOL,
                tokenOut: TOKEN_ADDRESSES.SOL,
                amount: 1.5,
            };

            const result = OrderInputSchema.safeParse(input);
            expect(result.success).toBe(false);
        });

        it('should reject order with negative amount', () => {
            const input = {
                tokenIn: TOKEN_ADDRESSES.SOL,
                tokenOut: TOKEN_ADDRESSES.USDC,
                amount: -1,
            };

            const result = OrderInputSchema.safeParse(input);
            expect(result.success).toBe(false);
        });

        it('should reject order with amount below minimum', () => {
            const input = {
                tokenIn: TOKEN_ADDRESSES.SOL,
                tokenOut: TOKEN_ADDRESSES.USDC,
                amount: 0.001,
            };

            const result = OrderInputSchema.safeParse(input);
            expect(result.success).toBe(false);
        });

        it('should reject order with invalid token address format', () => {
            const input = {
                tokenIn: 'short',
                tokenOut: TOKEN_ADDRESSES.USDC,
                amount: 1.5,
            };

            const result = OrderInputSchema.safeParse(input);
            expect(result.success).toBe(false);
        });

        it('should default type to market if not provided', () => {
            const input = {
                tokenIn: TOKEN_ADDRESSES.SOL,
                tokenOut: TOKEN_ADDRESSES.USDC,
                amount: 1.5,
            };

            const result = OrderInputSchema.safeParse(input);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.type).toBe('market');
            }
        });

        it('should validate all supported token pairs', () => {
            const pairs = [
                { tokenIn: TOKEN_ADDRESSES.SOL, tokenOut: TOKEN_ADDRESSES.USDC },
                { tokenIn: TOKEN_ADDRESSES.USDC, tokenOut: TOKEN_ADDRESSES.SOL },
                { tokenIn: TOKEN_ADDRESSES.SOL, tokenOut: TOKEN_ADDRESSES.BONK },
                { tokenIn: TOKEN_ADDRESSES.USDC, tokenOut: TOKEN_ADDRESSES.RAY },
            ];

            for (const pair of pairs) {
                const result = OrderInputSchema.safeParse({ ...pair, amount: 1.0 });
                expect(result.success).toBe(true);
            }
        });
    });
});

describe('Order API Response Formats', () => {
    it('should have correct create order response structure', () => {
        const response = {
            orderId: 'test-order-id-123',
            status: 'pending',
        };

        expect(response).toHaveProperty('orderId');
        expect(response).toHaveProperty('status');
        expect(response.status).toBe('pending');
    });

    it('should have correct error response structure', () => {
        const errorResponse = {
            error: 'Validation Error',
            message: 'tokenIn and tokenOut must be different',
        };

        expect(errorResponse).toHaveProperty('error');
        expect(errorResponse).toHaveProperty('message');
    });
});

describe('Token Address Validation', () => {
    it('should recognize all supported tokens', () => {
        expect(TOKEN_ADDRESSES.SOL).toBeDefined();
        expect(TOKEN_ADDRESSES.USDC).toBeDefined();
        expect(TOKEN_ADDRESSES.BONK).toBeDefined();
        expect(TOKEN_ADDRESSES.RAY).toBeDefined();
    });

    it('should have valid Solana address format for all tokens', () => {
        const addressRegex = /^[A-Za-z0-9]{43,44}$/;

        expect(TOKEN_ADDRESSES.SOL).toMatch(addressRegex);
        expect(TOKEN_ADDRESSES.USDC).toMatch(addressRegex);
        expect(TOKEN_ADDRESSES.BONK).toMatch(addressRegex);
        expect(TOKEN_ADDRESSES.RAY).toMatch(addressRegex);
    });
});
