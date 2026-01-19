/**
 * Solana DEX Engine Type Definitions
 * Complete TypeScript interfaces for order management and DEX routing
 */

// Known Solana token addresses
export const TOKEN_ADDRESSES = {
    SOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
} as const;

export type TokenAddress = (typeof TOKEN_ADDRESSES)[keyof typeof TOKEN_ADDRESSES];

// Order input for API requests
export interface OrderInput {
    tokenIn: string;
    tokenOut: string;
    amount: number;
    type?: 'market';
}

// Order status enum
export type OrderStatusType =
    | 'pending'
    | 'routing'
    | 'building'
    | 'submitted'
    | 'confirmed'
    | 'failed';

// Order status update payload for WebSocket
export interface OrderStatus {
    orderId: string;
    status: OrderStatusType;
    data?: OrderStatusData;
    timestamp: string;
}

// Data payload included with status updates
export interface OrderStatusData {
    dex?: 'Raydium' | 'Meteora';
    raydiumPrice?: number;
    meteoraPrice?: number;
    txHash?: string;
    executedPrice?: number;
    error?: string;
}

// DEX quote response
export interface DexQuote {
    dex: 'Raydium' | 'Meteora';
    price: number;
    fee: number;
    liquidityScore: number;
}

// Routing result from DEX comparison
export interface RoutingResult {
    selectedDex: 'Raydium' | 'Meteora';
    raydiumQuote: DexQuote;
    meteoraQuote: DexQuote;
    reason: string;
}

// Swap execution result
export interface SwapResult {
    success: boolean;
    txHash: string;
    executedPrice: number;
    dex: 'Raydium' | 'Meteora';
    slippage: number;
}

// Order job data for BullMQ
export interface OrderJobData {
    orderId: string;
    tokenIn: string;
    tokenOut: string;
    amount: number;
}

// API response types
export interface CreateOrderResponse {
    orderId: string;
    status: 'pending';
}

export interface ErrorResponse {
    error: string;
    message: string;
}

// Database order type (mirrors Prisma model)
export interface DbOrder {
    id: string;
    type: string;
    status: string;
    tokenIn: string;
    tokenOut: string;
    amount: number;
    dex: string | null;
    txHash: string | null;
    price: number | null;
    error: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// Token symbol mapping
export const TOKEN_SYMBOLS: Record<string, string> = {
    [TOKEN_ADDRESSES.SOL]: 'SOL',
    [TOKEN_ADDRESSES.USDC]: 'USDC',
    [TOKEN_ADDRESSES.BONK]: 'BONK',
    [TOKEN_ADDRESSES.RAY]: 'RAY',
};

// Get token symbol from address
export function getTokenSymbol(address: string): string {
    return TOKEN_SYMBOLS[address] || address.slice(0, 8);
}

// Base prices for mock calculations (in USDC)
export const BASE_PRICES: Record<string, number> = {
    [TOKEN_ADDRESSES.SOL]: 100.0,
    [TOKEN_ADDRESSES.USDC]: 1.0,
    [TOKEN_ADDRESSES.BONK]: 0.00001,
    [TOKEN_ADDRESSES.RAY]: 0.5,
};
