/**
 * DEX Router Tests
 * Tests for MockDexRouter price comparison and routing logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockDexRouter } from '../services/dexRouter.js';
import { TOKEN_ADDRESSES } from '../types/order.js';

describe('MockDexRouter', () => {
    let router: MockDexRouter;

    beforeEach(() => {
        router = new MockDexRouter();
    });

    describe('getRaydiumQuote', () => {
        it('should return a valid quote with correct structure', async () => {
            const quote = await router.getRaydiumQuote(
                TOKEN_ADDRESSES.SOL,
                TOKEN_ADDRESSES.USDC,
                1.0
            );

            expect(quote).toBeDefined();
            expect(quote.dex).toBe('Raydium');
            expect(typeof quote.price).toBe('number');
            expect(quote.price).toBeGreaterThan(0);
            expect(quote.fee).toBe(0.003);
            expect(quote.liquidityScore).toBeGreaterThanOrEqual(0);
            expect(quote.liquidityScore).toBeLessThanOrEqual(1);
        });

        it('should return price within expected variance range (0.98-1.02x)', async () => {
            const quotes = await Promise.all(
                Array(10).fill(null).map(() =>
                    router.getRaydiumQuote(TOKEN_ADDRESSES.SOL, TOKEN_ADDRESSES.USDC, 1.0)
                )
            );

            // Base rate for SOL/USDC is ~100
            for (const quote of quotes) {
                expect(quote.price).toBeGreaterThanOrEqual(98);
                expect(quote.price).toBeLessThanOrEqual(102);
            }
        });

        it('should have higher liquidity score for SOL pairs', async () => {
            const solQuotes = await Promise.all(
                Array(5).fill(null).map(() =>
                    router.getRaydiumQuote(TOKEN_ADDRESSES.SOL, TOKEN_ADDRESSES.USDC, 1.0)
                )
            );

            const avgLiquidity = solQuotes.reduce((sum, q) => sum + q.liquidityScore, 0) / solQuotes.length;
            expect(avgLiquidity).toBeGreaterThan(0.8);
        });
    });

    describe('getMeteorQuote', () => {
        it('should return a valid quote with correct structure', async () => {
            const quote = await router.getMeteorQuote(
                TOKEN_ADDRESSES.SOL,
                TOKEN_ADDRESSES.USDC,
                1.0
            );

            expect(quote).toBeDefined();
            expect(quote.dex).toBe('Meteora');
            expect(typeof quote.price).toBe('number');
            expect(quote.price).toBeGreaterThan(0);
            expect(quote.fee).toBe(0.002); // Lower fee than Raydium
            expect(quote.liquidityScore).toBeGreaterThanOrEqual(0);
            expect(quote.liquidityScore).toBeLessThanOrEqual(1);
        });

        it('should return price within expected variance range (0.97-1.02x)', async () => {
            const quotes = await Promise.all(
                Array(10).fill(null).map(() =>
                    router.getMeteorQuote(TOKEN_ADDRESSES.SOL, TOKEN_ADDRESSES.USDC, 1.0)
                )
            );

            // Base rate for SOL/USDC is ~100, Meteora has wider variance
            for (const quote of quotes) {
                expect(quote.price).toBeGreaterThanOrEqual(97);
                expect(quote.price).toBeLessThanOrEqual(102);
            }
        });

        it('should have lower fee than Raydium', async () => {
            const raydiumQuote = await router.getRaydiumQuote(
                TOKEN_ADDRESSES.SOL,
                TOKEN_ADDRESSES.USDC,
                1.0
            );
            const meteoraQuote = await router.getMeteorQuote(
                TOKEN_ADDRESSES.SOL,
                TOKEN_ADDRESSES.USDC,
                1.0
            );

            expect(meteoraQuote.fee).toBeLessThan(raydiumQuote.fee);
        });
    });

    describe('compareAndRoute', () => {
        it('should return routing result with both quotes', async () => {
            const result = await router.compareAndRoute(
                TOKEN_ADDRESSES.SOL,
                TOKEN_ADDRESSES.USDC,
                1.0
            );

            expect(result).toBeDefined();
            expect(result.selectedDex).toBeDefined();
            expect(['Raydium', 'Meteora']).toContain(result.selectedDex);
            expect(result.raydiumQuote).toBeDefined();
            expect(result.meteoraQuote).toBeDefined();
            expect(result.reason).toBeDefined();
            expect(typeof result.reason).toBe('string');
        });

        it('should select DEX with best effective price', async () => {
            const result = await router.compareAndRoute(
                TOKEN_ADDRESSES.SOL,
                TOKEN_ADDRESSES.USDC,
                1.0
            );

            const raydiumEffective = result.raydiumQuote.price * (1 - result.raydiumQuote.fee);
            const meteoraEffective = result.meteoraQuote.price * (1 - result.meteoraQuote.fee);

            // The selected DEX should have better or equal effective price
            // (or better liquidity for large orders with similar prices)
            if (result.selectedDex === 'Raydium') {
                expect(raydiumEffective).toBeGreaterThanOrEqual(meteoraEffective * 0.99);
            } else {
                expect(meteoraEffective).toBeGreaterThanOrEqual(raydiumEffective * 0.99);
            }
        });

        it('should work with different token pairs', async () => {
            const pairs = [
                [TOKEN_ADDRESSES.SOL, TOKEN_ADDRESSES.USDC],
                [TOKEN_ADDRESSES.USDC, TOKEN_ADDRESSES.SOL],
                [TOKEN_ADDRESSES.SOL, TOKEN_ADDRESSES.BONK],
                [TOKEN_ADDRESSES.USDC, TOKEN_ADDRESSES.RAY],
            ];

            for (const [tokenIn, tokenOut] of pairs) {
                const result = await router.compareAndRoute(tokenIn, tokenOut, 1.0);
                expect(result.selectedDex).toBeDefined();
            }
        });
    });

    describe('executeSwap', () => {
        it('should return swap result with transaction hash', async () => {
            const routingResult = await router.compareAndRoute(
                TOKEN_ADDRESSES.SOL,
                TOKEN_ADDRESSES.USDC,
                1.0
            );

            const quotedPrice = routingResult.selectedDex === 'Raydium'
                ? routingResult.raydiumQuote.price
                : routingResult.meteoraQuote.price;

            const swapResult = await router.executeSwap(
                TOKEN_ADDRESSES.SOL,
                TOKEN_ADDRESSES.USDC,
                1.0,
                routingResult.selectedDex,
                quotedPrice
            );

            expect(swapResult).toBeDefined();
            expect(typeof swapResult.txHash).toBe('string');
            expect(swapResult.txHash.length).toBeGreaterThan(10);
            expect(swapResult.dex).toBe(routingResult.selectedDex);
            expect(typeof swapResult.executedPrice).toBe('number');
            expect(typeof swapResult.slippage).toBe('number');
        });

        it('should have executed price within slippage bounds', async () => {
            const quotedPrice = 100;

            const swapResult = await router.executeSwap(
                TOKEN_ADDRESSES.SOL,
                TOKEN_ADDRESSES.USDC,
                1.0,
                'Raydium',
                quotedPrice
            );

            // Slippage is -0.5% to +0.2%
            expect(swapResult.executedPrice).toBeGreaterThanOrEqual(quotedPrice * 0.99);
            expect(swapResult.executedPrice).toBeLessThanOrEqual(quotedPrice * 1.01);
        });

        it('should generate unique transaction hashes', async () => {
            const hashes = new Set<string>();

            for (let i = 0; i < 5; i++) {
                const result = await router.executeSwap(
                    TOKEN_ADDRESSES.SOL,
                    TOKEN_ADDRESSES.USDC,
                    1.0,
                    'Raydium',
                    100
                );
                hashes.add(result.txHash);
            }

            expect(hashes.size).toBe(5);
        });
    });
});
