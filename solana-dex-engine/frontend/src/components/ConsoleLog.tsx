/**
 * Console Log Component
 * Displays real-time routing decisions and order events
 */

import { useEffect, useRef } from 'react';

interface LogEntry {
    timestamp: string;
    orderId: string;
    message: string;
}

interface ConsoleLogProps {
    logs: LogEntry[];
}

function getLogIcon(message: string): string {
    return '';
}

function getLogColor(message: string): string {
    if (message.includes('Selected Raydium')) return 'text-primary';
    if (message.includes('Selected Meteora')) return 'text-blue-400';
    if (message.includes('✅') || message.includes('Confirmed')) return 'text-success';
    if (message.includes('❌') || message.includes('Failed')) return 'text-error';
    if (message.includes('connected')) return 'text-primary';
    return 'text-text-muted';
}

export function ConsoleLog({ logs }: ConsoleLogProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new logs
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="card p-4 h-full flex flex-col bg-surface">
            <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2 border-b border-border pb-2">
                Routing Decisions
                <span className="ml-auto text-xs text-text-muted font-normal bg-surface-2 px-2 py-0.5 rounded-full">
                    {logs.length} entries
                </span>
            </h3>

            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto space-y-0.5 font-mono text-xs min-h-[200px] max-h-[400px] pr-1"
            >
                {logs.length === 0 ? (
                    <div className="text-text-muted text-center py-12 flex flex-col items-center">
                        <p>No routing decisions yet.</p>
                        <p className="text-[10px] opacity-70">Submit an order to see activity.</p>
                    </div>
                ) : (
                    logs.map((log, index) => (
                        <div
                            key={index}
                            className="flex items-start gap-2 py-1.5 px-2 hover:bg-surface-2 rounded transition-colors animate-fade-in border-b border-border/30 last:border-0"
                        >
                            <span className="text-text-muted whitespace-nowrap opacity-70">
                                {log.timestamp}
                            </span>
                            <span className="text-primary/70 font-mono">
                                [{log.orderId}]
                            </span>
                            <span className={`flex-1 ${getLogColor(log.message)}`}>
                                {getLogIcon(log.message)} {log.message}
                            </span>
                        </div>
                    ))
                )}
            </div>

            {/* Clear indicator when scrolled */}
            {logs.length > 10 && (
                <div className="mt-2 text-[10px] text-center text-text-muted border-t border-border pt-2">
                    Showing last {Math.min(logs.length, 50)} of {logs.length} entries
                </div>
            )}
        </div>
    );
}
