/**
 * WebSocket Hook
 * Custom React hook for WebSocket connections with automatic reconnection
 */

import { useEffect, useState, useRef, useCallback } from 'react';

export interface OrderStatusData {
    orderId: string;
    status: 'pending' | 'routing' | 'building' | 'submitted' | 'confirmed' | 'failed';
    data?: {
        dex?: 'Raydium' | 'Meteora';
        raydiumPrice?: number;
        meteoraPrice?: number;
        txHash?: string;
        executedPrice?: number;
        error?: string;
    };
    timestamp: string;
}

interface WebSocketState {
    status: OrderStatusData | null;
    isConnected: boolean;
    error: string | null;
}

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 2000;

export function useWebSocket(orderId: string | null) {
    const [state, setState] = useState<WebSocketState>({
        status: null,
        isConnected: false,
        error: null,
    });

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

    const connect = useCallback(() => {
        if (!orderId) return;

        // Determine WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = import.meta.env.DEV
            ? `ws://localhost:3001/ws/${orderId}`
            : `${protocol}//${host}/ws/${orderId}`;

        console.log(`[WebSocket] Connecting to ${wsUrl}`);

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log(`[WebSocket] Connected for order ${orderId.slice(0, 8)}...`);
                reconnectAttemptsRef.current = 0;
                setState((prev) => ({ ...prev, isConnected: true, error: null }));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log(`[WebSocket] Message received:`, data);

                    // Handle order status updates
                    if (data.orderId && data.status) {
                        setState((prev) => ({
                            ...prev,
                            status: data as OrderStatusData,
                        }));
                    }
                } catch (err) {
                    console.error('[WebSocket] Failed to parse message:', err);
                }
            };

            ws.onerror = (event) => {
                console.error('[WebSocket] Error:', event);
                setState((prev) => ({
                    ...prev,
                    error: 'WebSocket connection error',
                }));
            };

            ws.onclose = (event) => {
                console.log(`[WebSocket] Closed (code: ${event.code})`);
                setState((prev) => ({ ...prev, isConnected: false }));

                // Attempt reconnection if not a normal close
                if (event.code !== 1000 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttemptsRef.current++;
                    console.log(
                        `[WebSocket] Reconnecting (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`
                    );

                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, RECONNECT_DELAY);
                }
            };
        } catch (err) {
            console.error('[WebSocket] Failed to create connection:', err);
            setState((prev) => ({
                ...prev,
                error: 'Failed to create WebSocket connection',
            }));
        }
    }, [orderId]);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }

        if (wsRef.current) {
            wsRef.current.close(1000, 'Component unmounted');
            wsRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (orderId) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [orderId, connect, disconnect]);

    return {
        status: state.status,
        isConnected: state.isConnected,
        error: state.error,
    };
}

/**
 * Multi-order WebSocket manager
 * Manages multiple WebSocket connections for concurrent orders
 */
export function useMultiWebSocket() {
    const [orders, setOrders] = useState<Map<string, OrderStatusData>>(new Map());
    const [logs, setLogs] = useState<Array<{ timestamp: string; orderId: string; message: string }>>([]);
    const [connectionCount, setConnectionCount] = useState(0);

    // Use refs for connections to avoid re-renders causing disconnections
    const connectionsRef = useRef<Map<string, WebSocket>>(new Map());

    const addLog = useCallback((orderId: string, message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs((prev) => {
            const newLogs = [...prev, { timestamp, orderId: orderId.slice(0, 8), message }];
            // Keep only last 50 entries
            return newLogs.slice(-50);
        });
    }, []);

    const connectOrder = useCallback((orderId: string) => {
        if (connectionsRef.current.has(orderId)) {
            console.log(`[MultiWS] Already connected to ${orderId.slice(0, 8)}...`);
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = import.meta.env.DEV
            ? `ws://localhost:3001/ws/${orderId}`
            : `${protocol}//${host}/ws/${orderId}`;

        console.log(`[MultiWS] Creating connection for ${orderId.slice(0, 8)}...`);

        try {
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log(`[MultiWS] Connected to ${orderId.slice(0, 8)}...`);
                connectionsRef.current.set(orderId, ws);
                setConnectionCount(connectionsRef.current.size);
                addLog(orderId, 'WebSocket connected');
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.orderId && data.status) {
                        const statusData = data as OrderStatusData;
                        setOrders((prev) => new Map(prev).set(orderId, statusData));

                        // Log routing decisions
                        if (statusData.status === 'routing' && statusData.data) {
                            const { raydiumPrice, meteoraPrice, dex } = statusData.data;
                            if (raydiumPrice && meteoraPrice && dex) {
                                addLog(
                                    orderId,
                                    `Selected ${dex}: $${dex === 'Meteora' ? meteoraPrice.toFixed(4) : raydiumPrice.toFixed(4)} vs ${dex === 'Meteora' ? 'Raydium' : 'Meteora'}: $${dex === 'Meteora' ? raydiumPrice.toFixed(4) : meteoraPrice.toFixed(4)}`
                                );
                            }
                        }

                        if (statusData.status === 'confirmed') {
                            addLog(orderId, `✅ Confirmed - TX: ${statusData.data?.txHash?.slice(0, 16)}...`);
                        }

                        if (statusData.status === 'failed') {
                            addLog(orderId, `❌ Failed - ${statusData.data?.error || 'Unknown error'}`);
                        }
                    }
                } catch (err) {
                    console.error('[MultiWS] Parse error:', err);
                }
            };

            ws.onclose = (event) => {
                console.log(`[MultiWS] Disconnected from ${orderId.slice(0, 8)}... (code: ${event.code})`);
                connectionsRef.current.delete(orderId);
                setConnectionCount(connectionsRef.current.size);
            };

            ws.onerror = (error) => {
                console.error(`[MultiWS] Error for ${orderId.slice(0, 8)}...`, error);
            };

            // Store immediately to prevent duplicate connections
            connectionsRef.current.set(orderId, ws);
            setConnectionCount(connectionsRef.current.size);
        } catch (err) {
            console.error('[MultiWS] Failed to connect:', err);
        }
    }, [addLog]);

    const disconnectOrder = useCallback((orderId: string) => {
        const ws = connectionsRef.current.get(orderId);
        if (ws) {
            ws.close(1000, 'Order removed');
            connectionsRef.current.delete(orderId);
            setConnectionCount(connectionsRef.current.size);
        }
    }, []);

    const clearOrder = useCallback((orderId: string) => {
        disconnectOrder(orderId);
        setOrders((prev) => {
            const newMap = new Map(prev);
            newMap.delete(orderId);
            return newMap;
        });
    }, [disconnectOrder]);

    // Cleanup on unmount only
    useEffect(() => {
        const connections = connectionsRef.current;
        return () => {
            connections.forEach((ws) => {
                ws.close(1000, 'Component unmounted');
            });
        };
    }, []); // Empty deps - only run on unmount

    return {
        orders,
        logs,
        connectOrder,
        disconnectOrder,
        clearOrder,
        connectionCount,
    };
}

