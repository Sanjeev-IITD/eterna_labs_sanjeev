/**
 * Solana DEX Order Execution Engine - Main Dashboard
 * Real-time order management with WebSocket status updates
 */

import { useState, useCallback } from 'react';
import { OrderForm } from './components/OrderForm';
import { OrderCard } from './components/OrderCard';
import { ConsoleLog } from './components/ConsoleLog';
import { useMultiWebSocket } from './hooks/useWebSocket';

interface ActiveOrder {
    orderId: string;
    tokenIn: string;
    tokenOut: string;
    amount: number;
}

function App() {
    const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
    const { orders, logs, connectOrder, clearOrder } = useMultiWebSocket();

    const handleOrderSubmitted = useCallback(
        (orderId: string, tokenIn: string, tokenOut: string, amount: number) => {
            // Add to active orders
            setActiveOrders((prev) => [
                { orderId, tokenIn, tokenOut, amount },
                ...prev,
            ]);

            // Connect WebSocket
            connectOrder(orderId);
        },
        [connectOrder]
    );

    const handleRemoveOrder = useCallback(
        (orderId: string) => {
            setActiveOrders((prev) => prev.filter((o) => o.orderId !== orderId));
            clearOrder(orderId);
        },
        [clearOrder]
    );

    return (
        <div className="min-h-screen p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
            {/* Header */}
            <header className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-text tracking-tight">
                        Solana DEX Engine
                    </h1>
                    <p className="text-text-muted mt-1 text-sm">
                        Real-time order execution with Raydium & Meteora routing
                    </p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface rounded-full border border-border">
                        <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
                        <span className="text-text-muted font-medium">
                            {activeOrders.length} Active
                        </span>
                    </div>
                    <div className="px-3 py-1.5 bg-primary/10 text-primary rounded-full border border-primary/20 font-medium">
                        Market Orders
                    </div>
                </div>
            </header>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left Column - Order Form & Console */}
                <div className="md:col-span-5 lg:col-span-4 space-y-6 flex flex-col">
                    <OrderForm
                        onOrderSubmitted={handleOrderSubmitted}
                        isLoading={false}
                    />
                    <div className="flex-1 min-h-[300px]">
                        <ConsoleLog logs={logs} />
                    </div>
                </div>

                {/* Right Column - Active Orders */}
                <div className="md:col-span-7 lg:col-span-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-text flex items-center gap-2">
                            Active Orders
                        </h2>
                        {activeOrders.length > 0 && (
                            <button
                                onClick={() => {
                                    activeOrders.forEach((o) => handleRemoveOrder(o.orderId));
                                }}
                                className="text-sm text-text-muted hover:text-error transition-colors font-medium"
                            >
                                Clear All
                            </button>
                        )}
                    </div>

                    {activeOrders.length === 0 ? (
                        <div className="card p-12 text-center border-dashed border-2 border-border bg-transparent">
                            <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-text mb-2">
                                No Active Orders
                            </h3>
                            <p className="text-text-muted text-sm max-w-xs mx-auto">
                                Submit a market order to start trading.
                                <br />
                                Use the "Submit 5 Orders" button for a demo.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {activeOrders.map((order) => (
                                <OrderCard
                                    key={order.orderId}
                                    orderId={order.orderId}
                                    tokenIn={order.tokenIn}
                                    tokenOut={order.tokenOut}
                                    amount={order.amount}
                                    status={orders.get(order.orderId)}
                                    onRemove={() => handleRemoveOrder(order.orderId)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <footer className="mt-12 pt-8 border-t border-border text-center text-text-muted text-xs">
                <p>
                    Solana DEX Order Execution Engine • Mock Implementation
                </p>
                <p className="mt-1 opacity-60">
                    Comparing Raydium vs Meteora • 10 Concurrent Orders • Exponential Retry
                </p>
            </footer>
        </div>
    );
}

export default App;
