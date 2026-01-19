/**
 * Mock DEX Router Service
 * Simulates price comparison between Raydium and Meteora DEXes
 * with realistic price variance, fees, and execution delays
 */

import { nanoid } from 'nanoid';
import {
    DexQuote,
    RoutingResult,
    SwapResult,
    BASE_PRICES,
    getTokenSymbol,
} from '../types/order.js';

function timestamp(): string {
    return new Date().toISOString();
}

function log(message: string): void {
    console.log(`[${timestamp()}] [DexRouter] ${message}`);
}

/**
 * Generates a random price with variance
 * @param basePrice - The base price to vary
 * @param minMultiplier - Minimum multiplier (e.g., 0.97 for -3%)
 * @param maxMultiplier - Maximum multiplier (e.g., 1.03 for +3%)
 */
function getVariedPrice(basePrice: number, minMultiplier: number, maxMultiplier: number): number {
    const variance = minMultiplier + Math.random() * (maxMultiplier - minMultiplier);
    return basePrice * variance;
}

/**
 * Simulates network delay
 * @param ms - Milliseconds to delay
 */
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exchange rate between two tokens
 * @param tokenIn - Input token address
 * @param tokenOut - Output token address
 * @returns Exchange rate (how much tokenOut per 1 tokenIn)
 */
function getBaseExchangeRate(tokenIn: string, tokenOut: string): number {
    const priceIn = BASE_PRICES[tokenIn] || 1.0;
    const priceOut = BASE_PRICES[tokenOut] || 1.0;
    return priceIn / priceOut;
}

export class MockDexRouter {
    /**
     * Get a quote from Raydium DEX
     * Raydium characteristics:
     * - Fee: 0.3%
     * - Price variance: 0.98-1.02x of base rate
     * - Higher liquidity score for SOL pairs
     */
    async getRaydiumQuote(tokenIn: string, tokenOut: string, amount: number): Promise<DexQuote> {
        const startTime = Date.now();

        // Simulate API latency (150-250ms)
        await delay(150 + Math.random() * 100);

        const baseRate = getBaseExchangeRate(tokenIn, tokenOut);
        const price = getVariedPrice(baseRate, 0.98, 1.02);
        const fee = 0.003; // 0.3% fee

        // Calculate liquidity score (higher for SOL pairs)
        const isSolPair = tokenIn.includes('So11') || tokenOut.includes('So11');
        const liquidityScore = isSolPair ? 0.85 + Math.random() * 0.1 : 0.7 + Math.random() * 0.15;

        const quote: DexQuote = {
            dex: 'Raydium',
            price: Number(price.toFixed(8)),
            fee,
            liquidityScore: Number(liquidityScore.toFixed(3)),
        };

        log(`Raydium quote for ${amount} ${getTokenSymbol(tokenIn)} → ${getTokenSymbol(tokenOut)}: ` +
            `${quote.price.toFixed(6)} (fee: ${(fee * 100).toFixed(2)}%, liquidity: ${(quote.liquidityScore * 100).toFixed(1)}%) ` +
            `[${Date.now() - startTime}ms]`);

        return quote;
    }

    /**
     * Get a quote from Meteora DEX
     * Meteora characteristics:
     * - Fee: 0.2% (lower than Raydium)
     * - Price variance: 0.97-1.02x of base rate (wider spread)
     * - Generally lower liquidity but better fees
     */
    async getMeteorQuote(tokenIn: string, tokenOut: string, amount: number): Promise<DexQuote> {
        const startTime = Date.now();

        // Simulate API latency (150-250ms)
        await delay(150 + Math.random() * 100);

        const baseRate = getBaseExchangeRate(tokenIn, tokenOut);
        const price = getVariedPrice(baseRate, 0.97, 1.02);
        const fee = 0.002; // 0.2% fee (lower than Raydium)

        // Calculate liquidity score (slightly lower than Raydium on average)
        const liquidityScore = 0.65 + Math.random() * 0.2;

        const quote: DexQuote = {
            dex: 'Meteora',
            price: Number(price.toFixed(8)),
            fee,
            liquidityScore: Number(liquidityScore.toFixed(3)),
        };

        log(`Meteora quote for ${amount} ${getTokenSymbol(tokenIn)} → ${getTokenSymbol(tokenOut)}: ` +
            `${quote.price.toFixed(6)} (fee: ${(fee * 100).toFixed(2)}%, liquidity: ${(quote.liquidityScore * 100).toFixed(1)}%) ` +
            `[${Date.now() - startTime}ms]`);

        return quote;
    }

    /**
     * Compare quotes from both DEXes and route to the best one
     * Selection criteria:
     * 1. Effective price after fees (primary)
     * 2. Liquidity score (secondary for large orders)
     */
    async compareAndRoute(
        tokenIn: string,
        tokenOut: string,
        amount: number
    ): Promise<RoutingResult> {
        log(`Starting route comparison for ${amount} ${getTokenSymbol(tokenIn)} → ${getTokenSymbol(tokenOut)}`);

        // Fetch quotes in parallel
        const [raydiumQuote, meteoraQuote] = await Promise.all([
            this.getRaydiumQuote(tokenIn, tokenOut, amount),
            this.getMeteorQuote(tokenIn, tokenOut, amount),
        ]);

        // Calculate effective prices (price after fees)
        const raydiumEffective = raydiumQuote.price * (1 - raydiumQuote.fee);
        const meteoraEffective = meteoraQuote.price * (1 - meteoraQuote.fee);

        log(`Effective prices - Raydium: ${raydiumEffective.toFixed(6)}, Meteora: ${meteoraEffective.toFixed(6)}`);

        let selectedDex: 'Raydium' | 'Meteora';
        let reason: string;

        // For large orders (>100 units), consider liquidity more heavily
        const isLargeOrder = amount > 100;
        const liquidityThreshold = 0.8;

        if (isLargeOrder) {
            // For large orders, prefer higher liquidity if price difference is small (<1%)
            const priceDiffPercent = Math.abs(raydiumEffective - meteoraEffective) / Math.max(raydiumEffective, meteoraEffective) * 100;

            if (priceDiffPercent < 1.0 && raydiumQuote.liquidityScore > liquidityThreshold &&
                raydiumQuote.liquidityScore > meteoraQuote.liquidityScore) {
                selectedDex = 'Raydium';
                reason = `Large order - Raydium has better liquidity (${(raydiumQuote.liquidityScore * 100).toFixed(1)}% vs ${(meteoraQuote.liquidityScore * 100).toFixed(1)}%) with similar price`;
            } else if (priceDiffPercent < 1.0 && meteoraQuote.liquidityScore > liquidityThreshold &&
                meteoraQuote.liquidityScore > raydiumQuote.liquidityScore) {
                selectedDex = 'Meteora';
                reason = `Large order - Meteora has better liquidity (${(meteoraQuote.liquidityScore * 100).toFixed(1)}% vs ${(raydiumQuote.liquidityScore * 100).toFixed(1)}%) with similar price`;
            } else {
                // Fall back to best price
                selectedDex = raydiumEffective >= meteoraEffective ? 'Raydium' : 'Meteora';
                reason = `Best effective price: ${selectedDex} (${selectedDex === 'Raydium' ? raydiumEffective.toFixed(6) : meteoraEffective.toFixed(6)})`;
            }
        } else {
            // For normal orders, just pick the best price
            selectedDex = raydiumEffective >= meteoraEffective ? 'Raydium' : 'Meteora';
            reason = `Best effective price: ${selectedDex} (${selectedDex === 'Raydium' ? raydiumEffective.toFixed(6) : meteoraEffective.toFixed(6)})`;
        }

        log(`ROUTING DECISION: Selected ${selectedDex} - ${reason}`);
        log(`   Raydium: ${raydiumQuote.price.toFixed(6)} (effective: ${raydiumEffective.toFixed(6)}, fee: ${(raydiumQuote.fee * 100).toFixed(2)}%)`);
        log(`   Meteora: ${meteoraQuote.price.toFixed(6)} (effective: ${meteoraEffective.toFixed(6)}, fee: ${(meteoraQuote.fee * 100).toFixed(2)}%)`);

        return {
            selectedDex,
            raydiumQuote,
            meteoraQuote,
            reason,
        };
    }

    /**
     * Execute a swap on the selected DEX
     * Simulates:
     * - Transaction building (500ms)
     * - Submission to network (1-2s)
     * - Confirmation (1-2s)
     * - Final price with slippage
     */
    async executeSwap(
        tokenIn: string,
        tokenOut: string,
        amount: number,
        dex: 'Raydium' | 'Meteora',
        quotedPrice: number
    ): Promise<SwapResult> {
        const startTime = Date.now();

        log(`Executing swap on ${dex}: ${amount} ${getTokenSymbol(tokenIn)} → ${getTokenSymbol(tokenOut)}`);

        // Simulate transaction building and execution (2-3 seconds total)
        const executionTime = 2000 + Math.random() * 1000;
        await delay(executionTime);

        // Simulate slippage (-0.5% to +0.2%)
        const slippage = -0.005 + Math.random() * 0.007;
        const executedPrice = quotedPrice * (1 + slippage);

        // Generate mock transaction hash (Solana-style base58)
        const txHash = `${dex.toLowerCase().slice(0, 3)}${nanoid(44)}`;

        // 95% success rate
        const success = Math.random() > 0.05;

        if (success) {
            log(`Swap executed successfully on ${dex}`);
            log(`   TX Hash: ${txHash}`);
            log(`   Quoted: ${quotedPrice.toFixed(6)}, Executed: ${executedPrice.toFixed(6)}, Slippage: ${(slippage * 100).toFixed(3)}%`);
            log(`   Execution time: ${Date.now() - startTime}ms`);
        } else {
            log(`Swap failed on ${dex} - Simulated network error`);
        }

        return {
            success,
            txHash,
            executedPrice: Number(executedPrice.toFixed(8)),
            dex,
            slippage: Number(slippage.toFixed(6)),
        };
    }
}

// Export singleton instance
export const dexRouter = new MockDexRouter();
