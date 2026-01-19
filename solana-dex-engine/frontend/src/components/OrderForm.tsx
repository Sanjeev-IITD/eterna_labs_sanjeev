/**
 * Order Form Component
 * Submit market orders with token pair selection and amount input
 */

import { useState } from 'react';

interface OrderFormProps {
    onOrderSubmitted: (orderId: string, tokenIn: string, tokenOut: string, amount: number) => void;
    isLoading?: boolean;
}

// Token pair configurations
const TOKEN_PAIRS = [
    {
        label: 'SOL → USDC',
        tokenIn: 'So11111111111111111111111111111111111111112',
        tokenOut: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    },
    {
        label: 'USDC → SOL',
        tokenIn: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        tokenOut: 'So11111111111111111111111111111111111111112',
    },
    {
        label: 'SOL → BONK',
        tokenIn: 'So11111111111111111111111111111111111111112',
        tokenOut: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    },
    {
        label: 'USDC → RAY',
        tokenIn: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        tokenOut: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    },
];

export function OrderForm({ onOrderSubmitted, isLoading = false }: OrderFormProps) {
    const [selectedPair, setSelectedPair] = useState(0);
    const [amount, setAmount] = useState('1.0');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount < 0.01) {
            setError('Amount must be at least 0.01');
            return;
        }

        const pair = TOKEN_PAIRS[selectedPair];
        setIsSubmitting(true);

        try {
            const apiUrl = import.meta.env.DEV
                ? 'http://localhost:3001/api/orders/execute'
                : '/api/orders/execute';

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tokenIn: pair.tokenIn,
                    tokenOut: pair.tokenOut,
                    amount: parsedAmount,
                    type: 'market',
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('[OrderForm] Order created:', data);

            onOrderSubmitted(data.orderId, pair.tokenIn, pair.tokenOut, parsedAmount);
        } catch (err) {
            console.error('[OrderForm] Submit error:', err);
            setError(err instanceof Error ? err.message : 'Failed to submit order');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBatchSubmit = async () => {
        setError(null);
        setIsSubmitting(true);

        try {
            // Submit 5 orders in parallel
            const promises = TOKEN_PAIRS.slice(0, 4).map(async (pair, index) => {
                const orderAmount = 1 + index * 0.5; // Vary amounts: 1, 1.5, 2, 2.5

                const apiUrl = import.meta.env.DEV
                    ? 'http://localhost:3001/api/orders/execute'
                    : '/api/orders/execute';

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tokenIn: pair.tokenIn,
                        tokenOut: pair.tokenOut,
                        amount: orderAmount,
                        type: 'market',
                    }),
                });

                if (!response.ok) throw new Error(`Order ${index + 1} failed`);
                return response.json();
            });

            // Add one more order for the 5th
            promises.push(
                fetch(
                    import.meta.env.DEV
                        ? 'http://localhost:3001/api/orders/execute'
                        : '/api/orders/execute',
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            tokenIn: TOKEN_PAIRS[0].tokenIn,
                            tokenOut: TOKEN_PAIRS[0].tokenOut,
                            amount: 3.0,
                            type: 'market',
                        }),
                    }
                ).then((r) => r.json())
            );

            const results = await Promise.all(promises);
            console.log('[OrderForm] Batch orders created:', results);

            results.forEach((data, index) => {
                const pair = index < 4 ? TOKEN_PAIRS[index] : TOKEN_PAIRS[0];
                const orderAmount = index < 4 ? 1 + index * 0.5 : 3.0;
                onOrderSubmitted(data.orderId, pair.tokenIn, pair.tokenOut, orderAmount);
            });
        } catch (err) {
            console.error('[OrderForm] Batch submit error:', err);
            setError(err instanceof Error ? err.message : 'Failed to submit batch orders');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="card p-6">
            <h2 className="text-lg font-semibold text-text mb-6 flex items-center gap-2">
                New Market Order
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Token Pair Selection */}
                <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">
                        Token Pair
                    </label>
                    <div className="relative">
                        <select
                            className="select-field"
                            value={selectedPair}
                            onChange={(e) => setSelectedPair(parseInt(e.target.value))}
                            disabled={isSubmitting || isLoading}
                        >
                            {TOKEN_PAIRS.map((pair, index) => (
                                <option key={index} value={index}>
                                    {pair.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Amount Input */}
                <div>
                    <label className="block text-sm font-medium text-text-muted mb-2">
                        Amount
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            className="input-field"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            min="0.01"
                            step="0.01"
                            placeholder="Enter amount..."
                            disabled={isSubmitting || isLoading}
                        />
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm flex items-start gap-2">
                        {error}
                    </div>
                )}

                {/* Submit Buttons */}
                <div className="space-y-3 pt-2">
                    <button
                        type="submit"
                        className="btn-primary w-full flex items-center justify-center gap-2"
                        disabled={isSubmitting || isLoading}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full"></span>
                                Submitting...
                            </>
                        ) : (
                            <>
                                Submit Order
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={handleBatchSubmit}
                        className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
                        disabled={isSubmitting || isLoading}
                    >
                        Submit 5 Orders (Demo)
                    </button>
                </div>
            </form>
        </div>
    );
}
