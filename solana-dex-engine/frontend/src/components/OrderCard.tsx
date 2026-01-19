/**
 * Order Card Component
 * Displays individual order status with real-time updates
 */

import type { OrderStatusData } from '../hooks/useWebSocket';

interface OrderCardProps {
    orderId: string;
    tokenIn: string;
    tokenOut: string;
    amount: number;
    status: OrderStatusData | undefined;
    onRemove?: () => void;
}

// Token symbol mapping
const TOKEN_SYMBOLS: Record<string, string> = {
    So11111111111111111111111111111111111111112: 'SOL',
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
    DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: 'BONK',
    '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 'RAY',
};

function getTokenSymbol(address: string): string {
    return TOKEN_SYMBOLS[address] || address.slice(0, 6);
}

function getStatusBadgeClass(status: string): string {
    const baseClasses = 'status-badge';
    switch (status) {
        case 'pending':
            return `${baseClasses} status-pending`;
        case 'routing':
            return `${baseClasses} status-routing`;
        case 'building':
            return `${baseClasses} status-building`;
        case 'submitted':
            return `${baseClasses} status-submitted`;
        case 'confirmed':
            return `${baseClasses} status-confirmed`;
        case 'failed':
            return `${baseClasses} status-failed`;
        default:
            return `${baseClasses} status-pending`;
    }
}

function getStatusIcon(status: string): string {
    return '';
}

export function OrderCard({
    orderId,
    tokenIn,
    tokenOut,
    amount,
    status,
    onRemove,
}: OrderCardProps) {
    const currentStatus = status?.status || 'pending';
    const data = status?.data;

    return (
        <div className="card p-5 animate-fade-in card-hover">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-base font-semibold text-text flex items-center gap-2">
                        <span>{getTokenSymbol(tokenIn)}</span>
                        <span className="text-text-muted">→</span>
                        <span>{getTokenSymbol(tokenOut)}</span>
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono text-text-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border">
                            {orderId.slice(0, 8)}...
                        </span>
                    </div>
                </div>
                {onRemove && (
                    <button
                        onClick={onRemove}
                        className="text-text-muted hover:text-error transition-colors p-1 rounded hover:bg-surface-2"
                        title="Remove order"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Amount & Status Row */}
            <div className="flex items-center justify-between mb-4">
                <div className="text-sm">
                    <span className="text-text-muted">Amount:</span>
                    <span className="ml-2 text-text font-medium">
                        {amount} {getTokenSymbol(tokenIn)}
                    </span>
                </div>
                <span className={getStatusBadgeClass(currentStatus)}>
                    {getStatusIcon(currentStatus)} {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
                </span>
            </div>

            {/* DEX Selection */}
            {data?.dex && (
                <div className="mb-3 p-3 bg-surface-2 rounded-lg border border-border/50">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-text-muted">Selected DEX</span>
                        <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${data.dex === 'Raydium'
                                ? 'bg-primary/10 text-primary border border-primary/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                }`}
                        >
                            {data.dex}
                        </span>
                    </div>
                </div>
            )
            }

            {/* Price Comparison */}
            {
                (data?.raydiumPrice || data?.meteoraPrice) && (
                    <div className="mb-3 space-y-2">
                        <div className="text-xs text-text-muted font-medium uppercase tracking-wider">Price Comparison</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div
                                className={`p-2.5 rounded-lg border ${data.dex === 'Raydium'
                                    ? 'bg-success/5 border-success/20'
                                    : 'bg-surface-2 border-border'
                                    }`}
                            >
                                <div className="text-xs text-text-muted mb-1">Raydium</div>
                                <div className={`font-medium ${data.dex === 'Raydium' ? 'text-success' : 'text-text'}`}>
                                    ${data.raydiumPrice?.toFixed(4) || '—'}
                                </div>
                            </div>
                            <div
                                className={`p-2.5 rounded-lg border ${data.dex === 'Meteora'
                                    ? 'bg-success/5 border-success/20'
                                    : 'bg-surface-2 border-border'
                                    }`}
                            >
                                <div className="text-xs text-text-muted mb-1">Meteora</div>
                                <div className={`font-medium ${data.dex === 'Meteora' ? 'text-success' : 'text-text'}`}>
                                    ${data.meteoraPrice?.toFixed(4) || '—'}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Executed Price */}
            {
                data?.executedPrice && currentStatus === 'confirmed' && (
                    <div className="mb-3 p-3 bg-success/5 border border-success/20 rounded-lg flex items-center justify-between">
                        <div className="text-xs text-success font-medium">Executed Price</div>
                        <div className="text-success font-bold font-mono">
                            ${data.executedPrice.toFixed(6)}
                        </div>
                    </div>
                )
            }

            {/* Transaction Hash */}
            {
                data?.txHash && (
                    <div className="mt-3 pt-3 border-t border-border flex justify-between items-center">
                        <span className="text-xs text-text-muted">Transaction</span>
                        <a
                            href={`https://solscan.io/tx/${data.txHash}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary-400 transition-colors"
                        >
                            <span className="font-mono">{data.txHash.slice(0, 8)}...{data.txHash.slice(-8)}</span>
                        </a>
                    </div>
                )
            }

            {/* Error Message */}
            {
                data?.error && (
                    <div className="mt-3 p-3 bg-error/10 border border-error/20 rounded-lg">
                        <div className="text-xs text-error font-medium mb-1">Error</div>
                        <div className="text-error text-xs opacity-90">{data.error}</div>
                    </div>
                )
            }

            {/* Timestamp */}
            {
                status?.timestamp && (
                    <div className="mt-2 text-[10px] text-text-muted text-right">
                        Updated: {new Date(status.timestamp).toLocaleTimeString()}
                    </div>
                )
            }
        </div >
    );
}
