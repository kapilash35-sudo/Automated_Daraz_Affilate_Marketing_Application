# Daraz Affiliate & WhatsApp Marketing Automation Engine

> Enterprise-grade automation platform for e-commerce affiliate marketing, AI copywriting, real-time click tracking, buyer analytics, and WhatsApp broadcast management.

[![Docker](https://img.shields.io/badge/Docker-Compose_Microservices-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Fastify](https://img.shields.io/badge/Backend-Fastify_TypeScript-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js_14_App_Router-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_16_Prisma-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Queues-Redis_7_BullMQ-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Caddy](https://img.shields.io/badge/Reverse_Proxy-Caddy_Auto_HTTPS-1F88C0?logo=caddy&logoColor=white)](https://caddyserver.com/)
[![Gemini](https://img.shields.io/badge/AI_Engine-Google_Gemini-8E75B2?logo=google&logoColor=white)](https://aistudio.google.com/)

---

## 📖 Overview

The **Daraz Affiliate & WhatsApp Marketing Automation Engine** is an automated marketing infrastructure designed for digital publishers and affiliate marketers. It streamlines the end-to-end workflow of discovering e-commerce deals, generating persuasive bilingual (Tamil & Sinhala) marketing copy with generative AI, acquiring instant approval via WhatsApp polls, broadcasting targeted promotions to segregated Tamil and Sinhala WhatsApp communities, and tracking buyer conversions in real-time.

---

## 🌟 Key Capabilities

### 1. Bilingual AI Copywriting & Multi-Language Segmentation
- **Dual-Language Generation:** Concurrently drafts tailored promotional copy in both Tamil (Tanglish) and Sinhala (Singlish) using Google Gemini AI.
- **Language-Targeted Dispatch:** Automatically routes Tamil promotional ads to Tamil subscriber groups and Sinhala ads to Sinhala groups.
- **Smart Group Classification:** Dashboard and automated ingester support segmenting groups into Tamil, Sinhala, or Bilingual destinations.
- **Zero-Dashboard Operation:** Manage the entire marketing lifecycle directly within WhatsApp.
- **Dynamic Control Menus:** Interactive voting polls for initiating deals, updating community links, and checking performance metrics.
- **Product Extraction:** Automatically parses product titles, original prices, discounted prices, discount percentages, and media assets.
- **Photo Preferences:** Support for automated product image scraping, custom manual photo uploads, or text-only promotions.
- **Interactive Approval Gates:** Generates ad previews with commission estimates; broadcast only triggers upon admin confirmation via interactive WhatsApp polls.

### 2. Click Tracking & Direct Deep Linking
- **Precision Attribution:** Dedicated redirect engine (`/r/:postId`) records visitor IP, device type, user agent, and timestamp before instant redirection.
- **Affiliate Preservation:** Drops the publisher's affiliate parameters and seamlessly deep-links mobile users into the e-commerce app.
- **Zero Latency:** High-throughput redirection via Fastify and indexed relational lookups.

### 3. Buyer Engagement Heatmap (24h x 7d Matrix)
- **Timezone-Aware Scheduling:** Aggregates link clicks across days and hours, normalized to local market time.
- **Peak Engagement Insights:** Identifies prime buyer activity windows (e.g., lunch breaks, evening leisure hours) to schedule high-ticket deal broadcasts for maximum conversion.
- **Interactive Analytics:** Includes revenue calculators and deal performance rankings.

### 4. Anti-Ban Broadcast Safeguards
- **Paced Dispatches:** Mandatory configurable delays (e.g., 30s) between group deliveries to adhere to messaging rate limits.
- **Queue Throttling:** Background job management via BullMQ and Redis with automatic retry backoff.
- **Duplicate Prevention:** Semantic similarity checks and link deduplication to prevent spamming channels with repeated deals.

---

## 🏗️ Architecture

```
                          ┌───────────────────────────┐
                          │   Admin WhatsApp Client   │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │ WAHA Gateway │
                                 └──────┬───────┘
                                        │ Inbound Webhooks
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Reverse Proxy (HTTPS)                           │
└──────────────────────┬───────────────────────────────┬──────────────────────┘
                       │                               │
                       ▼                               ▼
        ┌─────────────────────────────┐  ┌───────────────────────────┐
        │  Fastify REST API & Engine  │  │   Next.js 14 Dashboard    │
        │  (Node.js 22 + TypeScript)  │  │   (Analytics & Controls)  │
        └──────────────┬──────────────┘  └───────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
  ┌────────────┐ ┌───────────┐ ┌───────────┐
  │ PostgreSQL │ │  Redis 7  │ │ MinIO S3  │
  │  (Prisma)  │ │ (BullMQ)  │ │ (Storage) │
  └────────────┘ └─────┬─────┘ └───────────┘
                       │
                       ▼
        ┌─────────────────────────────┐
        │   Background Queue Worker   │
        │   - Scraper & Gemini AI     │
        │   - Tracking URL Injector   │
        │   - Rate-Limited Dispatch   │
        └─────────────────────────────┘
```

---

## 🛠️ Technology Stack

| Layer | Component | Technologies |
|---|---|---|
| **Web Server** | Caddy 2 | Automated TLS / Reverse Proxy / HTTP/2 & HTTP/3 |
| **Frontend** | Next.js 14 | React 18, TypeScript, Tailwind CSS, Lucide Icons |
| **Security** | Edge Middleware | HTTP Basic Authentication |
| **Backend API** | Fastify 4 | Node.js 22, TypeScript, Zod Validation |
| **Database** | PostgreSQL 16 | Relational Storage, Prisma ORM 5.22 |
| **Queues & Cache** | Redis 7 + BullMQ | Distributed task queues, rate limiters, session state |
| **Object Storage** | MinIO | S3-compatible self-hosted asset bucket |
| **WhatsApp Gateway**| WAHA | WhatsApp HTTP API automation engine |
| **AI Copywriter** | Google Gemini | Generative promotional copy and deduplication |

---

## 📁 Repository Structure

```
.
├── docker-compose.yml           # Production Docker multi-container orchestration
├── Caddyfile                    # Reverse proxy routing & HTTPS configuration
├── .env.example                 # Environment configuration template
│
├── backend/                     # Fastify API & BullMQ Background Workers
│   ├── Dockerfile               # Node.js production container
│   ├── prisma/                  # Schema definitions & migrations
│   └── src/
│       ├── config/              # Prisma, Redis, S3 & environment validation
│       ├── routes/              # API endpoints (Analytics, Deals, Webhooks, Redirects)
│       ├── queues/              # BullMQ queue managers & worker jobs
│       └── services/            # Scraping, AI copywriting, WAHA client, Bot state machine
│
└── frontend/                    # Next.js 14 Analytics Dashboard
    ├── Dockerfile               # Optimized standalone build container
    └── src/
        ├── app/                 # App Router (Analytics, Approvals, Settings)
        ├── components/          # Heatmap, KPI cards, QR manager, Tables
        └── lib/                 # Typed API client & data definitions
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Docker Engine & Docker Compose Plugin installed.
- Domain name configured with DNS pointing to your host (for production HTTPS).

### 2. Configuration
Copy the configuration template and populate your credentials:

```bash
cp .env.example .env
```

Key environment categories in `.env`:
- **Database:** PostgreSQL credentials and connection string.
- **Queues:** Redis port and connection URL.
- **Storage:** MinIO root credentials, bucket configuration, and public asset URL.
- **WhatsApp (WAHA):** Gateway port, session name, and API authorization key.
- **AI Engine:** Google Gemini API key (obtain from [Google AI Studio](https://aistudio.google.com/)).
- **Web & Dashboard:** Host ports, redirect base URL, and dashboard credentials.

### 3. Launching the Services
Start all containers in detached mode:

```bash
docker compose up -d --build
```

Verify service status:

```bash
docker compose ps
```

All services should report healthy and running:
- `waha_caddy`
- `waha_frontend`
- `waha_backend`
- `waha_whatsapp`
- `waha_postgres`
- `waha_redis`
- `waha_minio`

---

## 📱 User Workflows

### 1. WhatsApp Connection
1. Access the web dashboard under `/settings`.
2. Generate a pairing QR code under **WhatsApp Session & QR Connect**.
3. In WhatsApp on your device, navigate to **Linked Devices > Link a Device** and scan the QR code.
4. The dashboard will update the session status to active once connected.

### 2. Posting Deals via WhatsApp Bot
1. From the authorized administrator phone number, send a message (e.g. `hi`) to the connected number.
2. Select **Post Ad** from the interactive menu poll.
3. Paste any product URL (e.g., `https://www.daraz.lk/products/...`).
4. Select your preferred media mode (auto-scraped image, custom upload, or text-only).
5. Review the AI-generated promotional copy and estimated commission.
6. Confirm via the approval poll to queue the broadcast to your configured destination channels.

### 3. Monitoring Real-Time Conversions
1. Open the analytics dashboard at `/analytics`.
2. View key metrics: total broadcasted promotions, real-time affiliate link clicks, and projected earnings.
3. Consult the **Buyer Engagement Heatmap** to analyze peak click periods and optimize future broadcast schedules.

---

## 🔒 Security Best Practices

- **Network Isolation:** Internal services (PostgreSQL, Redis, MinIO) are bound to private Docker networks or localhost, preventing public internet exposure.
- **Access Control:** Dashboard routes are protected by authentication middleware.
- **Sender Verification:** WhatsApp bot commands are restricted strictly to configured administrator numbers.
- **Secret Management:** Production credentials and API keys should reside exclusively in `.env` files and never be checked into version control.

---

## 📄 License
This project is proprietary and intended for authorized affiliate marketing operations. All rights reserved.