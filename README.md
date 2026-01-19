# Solana DEX Order Execution Engine

A production-grade mock DEX order execution engine with real-time WebSocket updates, concurrent processing, and intelligent routing between Raydium and Meteora.

![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Node.js](https://img.shields.io/badge/Node.js-20+-green)
![React](https://img.shields.io/badge/React-18-blue)
![Fastify](https://img.shields.io/badge/Fastify-4-black)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Live Demo

**Demo Video**: [https://youtu.be/your-video-id](https://youtu.be/your-video-id)

---

## Overview

This engine demonstrates a complete order execution workflow for Solana DEX trading:

1. **Submit Order** → Market order submitted via REST API
2. **Queue Processing** → BullMQ handles concurrent execution (10 orders/sec capacity)
3. **DEX Routing** → Compare prices between Raydium and Meteora
4. **Transaction Execution** → Execute swap on the best-priced DEX
5. **Real-time Updates** → WebSocket streams status: pending → routing → building → submitted → confirmed/failed

---

## Why Market Orders?

**Market orders** execute immediately at the best available price, making them ideal for demonstrating real-time DEX routing and WebSocket streaming. The architecture cleanly separates concerns, allowing straightforward extension to other order types:

- **Limit Orders**: Add price threshold checks in the routing logic and monitor price feeds until conditions are met before triggering execution
- **Sniper Orders**: Integrate Solana token launch event listeners (Raydium pool creation events) and execute trades within the same block using priority fees

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Frontend (React)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  OrderForm   │  │  OrderCards  │  │      ConsoleLog          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│           │                 ▲                    ▲                  │
│           │ POST            │ WebSocket          │                  │
└───────────│─────────────────│────────────────────│──────────────────┘
            │                 │                    │
            ▼                 │                    │
┌─────────────────────────────────────────────────────────────────────┐
│                        Backend (Fastify)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ REST Routes  │  │  WebSocket   │  │     BullMQ Worker        │  │
│  │   /api/*     │  │  /ws/:id     │  │   (10 concurrent)        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│           │                 ▲                    │                  │
│           ▼                 │                    ▼                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   Prisma     │  │ WS Manager   │  │     MockDexRouter        │  │
│  │ PostgreSQL   │  │   Rooms      │  │ Raydium vs Meteora       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
            │                                      │
            ▼                                      ▼
┌──────────────────┐                  ┌──────────────────────────────┐
│    PostgreSQL    │                  │           Redis              │
│  Order Storage   │                  │      Job Queue               │
└──────────────────┘                  └──────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend Runtime** | Node.js 20+ |
| **Backend Framework** | Fastify 4 with WebSocket support |
| **Queue** | BullMQ 5 with Redis |
| **Database** | PostgreSQL with Prisma ORM |
| **Language** | TypeScript 5 (strict mode) |
| **Validation** | Zod |
| **Frontend** | React 18 + Vite 5 |
| **Styling** | TailwindCSS 3 |

---

## Local Development

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-username/solana-dex-engine.git
cd solana-dex-engine

# Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL and REDIS_URL

# Run database migrations
npx prisma migrate dev --name init
npx prisma generate

# Start backend (runs on port 3001)
npm run dev

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev
# Opens on http://localhost:5173
```

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/dex_engine
REDIS_URL=redis://localhost:6379
PORT=3001
NODE_ENV=development
```

---

## API Reference

### POST /api/orders/execute
Submit a market order for execution.

**Request:**
```json
{
  "tokenIn": "So11111111111111111111111111111111111111112",
  "tokenOut": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amount": 1.5,
  "type": "market"
}
```

**Response:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending"
}
```

### WebSocket /ws/:orderId
Receive real-time order status updates.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:3001/ws/550e8400-e29b-41d4-a716-446655440000');

ws.onmessage = (event) => {
  const status = JSON.parse(event.data);
  console.log(status);
};
```

**Message Format:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "routing",
  "data": {
    "raydiumPrice": 100.23,
    "meteoraPrice": 99.87,
    "selectedDex": "Meteora"
  },
  "timestamp": "2026-01-19T12:34:56.789Z"
}
```

**Status Progression:**
| Status | Description |
|--------|-------------|
| `pending` | Order received and queued |
| `routing` | Comparing DEX prices |
| `building` | Building transaction |
| `submitted` | Transaction sent to network |
| `confirmed` | Transaction successful (includes txHash) |
| `failed` | Execution failed (includes error message) |

### GET /api/orders/:orderId
Get order details by ID.

### GET /api/orders
Get recent orders (query: `?limit=20`).

### GET /api/health
Health check endpoint.

### GET /api/tokens
Get supported token list.

---

## Supported Token Pairs

| Symbol | Address |
|--------|---------|
| SOL | `So11111111111111111111111111111111111111112` |
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| BONK | `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` |
| RAY | `4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R` |

---

## Testing

```bash
cd backend
npm test

# Run with coverage
npm test -- --coverage
```

**Test Coverage (10+ tests):**
- DEX router quote generation and variance
- Price comparison and routing logic
- Order input validation (Zod schemas)
- Queue concurrency and retry behavior
- WebSocket message lifecycle
- Error handling and failure scenarios

---

## Mock DEX Implementation

The `MockDexRouter` simulates realistic DEX behavior with configurable parameters:

### Raydium Mock
| Parameter | Value |
|-----------|-------|
| Fee | 0.3% |
| Price Variance | ±2% from base rate |
| Latency | 150-250ms |
| Liquidity Score | 85-95% (higher for SOL pairs) |

### Meteora Mock
| Parameter | Value |
|-----------|-------|
| Fee | 0.2% (lower than Raydium) |
| Price Variance | -3% to +2% from base rate |
| Latency | 150-250ms |
| Liquidity Score | 65-85% |

### Routing Logic
1. Fetch quotes from both DEXes in parallel
2. Calculate effective price after fees
3. For large orders (>100 units), factor in liquidity score
4. Select DEX with best effective price
5. Execute swap with simulated slippage (-0.5% to +0.2%)

---

## Queue Configuration

| Setting | Value |
|---------|-------|
| Concurrency | 10 simultaneous orders |
| Throughput | 100+ orders/minute |
| Success Rate | 95% (simulated network conditions) |

**Retry Strategy (Exponential Backoff):**
| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 second |
| 3 | 3 seconds |
| 4 (final) | 9 seconds |

After 3 failed retries, the order is marked as `failed` with error details persisted for post-mortem analysis.

---

## Deployment

### Production URLs
- **Frontend**: Deployed on Vercel/Netlify
- **Backend**: Deployed on Railway
- **Database**: Railway PostgreSQL
- **Cache**: Railway Redis

### Railway Deployment

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
cd backend
railway up
```

### Environment Variables (Production)

```env
DATABASE_URL=<railway-postgresql-url>
REDIS_URL=<railway-redis-url>
PORT=3001
NODE_ENV=production
```

---

## Demo Video

**YouTube**: [Watch the Demo](https://youtu.be/your-video-id)

The demo showcases:
- Submitting 5 simultaneous orders
- Real-time WebSocket status updates (pending → routing → confirmed)
- DEX routing decisions in the console log
- Price comparison between Raydium and Meteora
- Order confirmation with mock transaction hash
- Queue processing multiple concurrent orders

---

## Project Structure

```
solana-dex-engine/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Fastify server entry
│   │   ├── routes/orders.ts      # REST API routes
│   │   ├── services/
│   │   │   ├── dexRouter.ts      # Mock DEX comparison
│   │   │   └── websocket.ts      # WebSocket manager
│   │   ├── workers/orderWorker.ts # BullMQ processor
│   │   ├── types/order.ts        # TypeScript types
│   │   └── __tests__/            # Vitest tests
│   ├── prisma/schema.prisma      # Database schema
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Main dashboard
│   │   ├── components/
│   │   │   ├── OrderForm.tsx     # Order submission
│   │   │   ├── OrderCard.tsx     # Order status card
│   │   │   └── ConsoleLog.tsx    # Routing log
│   │   └── hooks/useWebSocket.ts # WebSocket hook
│   └── package.json
├── postman/collection.json       # API testing collection
└── README.md
```
