# Daraz Affiliate & WhatsApp Marketing Automation Engine

> Enterprise-grade automation platform for e-commerce affiliate marketing, AI copywriting, Server-to-Server (S2S) postback tracking, real-time verified revenue analytics, and WhatsApp broadcast management.

[![Docker](https://img.shields.io/badge/Docker-Compose_Microservices-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Fastify](https://img.shields.io/badge/Backend-Fastify_TypeScript-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js_14_App_Router-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_16_Prisma-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Queues-Redis_7_BullMQ-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Caddy](https://img.shields.io/badge/Reverse_Proxy-Caddy_Auto_HTTPS-1F88C0?logo=caddy&logoColor=white)](https://caddyserver.com/)
[![Gemini](https://img.shields.io/badge/AI_Engine-Google_Gemini-8E75B2?logo=google&logoColor=white)](https://aistudio.google.com/)

---

## 📖 Overview

The **Daraz Affiliate & WhatsApp Marketing Automation Engine** is an automated marketing infrastructure designed for digital publishers and affiliate marketers. It streamlines the end-to-end workflow of discovering e-commerce deals, generating persuasive bilingual (Tamil & Sinhala) marketing copy with generative AI, acquiring instant approval via WhatsApp polls, broadcasting targeted promotions to segregated Tamil and Sinhala WhatsApp communities, and tracking verified buyer conversions and cash payouts in real-time via official Daraz Server-to-Server (S2S) Postback Webhooks.

---

## 🌟 Key Capabilities

### 1. Bilingual AI Copywriting & Multi-Language Segmentation
- **Dual-Language Generation:** Concurrently drafts tailored promotional copy in both Tamil (Tanglish) and Sinhala (Singlish) using Google Gemini AI.
- **Language-Targeted Dispatch:** Automatically routes Tamil promotional ads to Tamil subscriber groups and Sinhala ads to Sinhala groups.
- **Smart Group Classification:** Dashboard and automated ingester support segmenting groups into Tamil, Sinhala, or Bilingual destinations.
- **Zero-Dashboard Operation:** Manage the entire marketing lifecycle directly within WhatsApp.
- **Dynamic Control Menus:** Interactive voting polls for initiating deals, updating community links, and checking performance metrics.
- **Product Extraction:** Automatically parses product titles, original prices, discounted prices, discount percentages, and media assets.
- **Clean Authentic Photos:** Dispatches clean, high-resolution original product images without artificial overlays, maximizing buyer click-through and authenticity.
- **Interactive Approval Gates:** Generates ad previews with commission estimates; broadcast only triggers upon admin confirmation via interactive WhatsApp polls.

### 2. Direct Official Affiliate Links & Sub-Tracking
- **Direct Official Daraz Links:** Delivers trusted `s.daraz.lk` URLs directly in WhatsApp copy, maximizing user trust and ensuring seamless mobile app deep-linking.
- **Automated Sub-Tracking Parameters:** Dynamically appends tracking tags to every shared link:
  - `sub_aff_id=wa_tam` / `wa_sin` (Affiliate channel & language identification)
  - `sub_id1=${post.id}` (Internal Deal / Post tracking ID)
  - `sub_id2=${language}` (Target audience language)

### 3. Server-to-Server (S2S) Postback Webhook Engine
- **Dedicated S2S Webhook:** Fast, reliable endpoint (`/api/webhooks/daraz/postback`) capturing all Daraz pre-defined and custom macros:
  - Order Identifiers: `{_p_transaction}`, `{_p_sub_transaction}`
  - Financials: `{_p_pay_amount}`, `{_p_payout}`, `{_p_com_rate}`, `{_p_currency}`
  - Product & Catalog: `{_p_purchased_item_id}`, `{_p_sku_daraz}`, `{_p_cate_name_lv1}`, `{_p_cate_name_lv2}`
  - Buyer Context: `{_device_os}`, `{_p_platform}`, `{_p_new_user}`, `{_p_status}`, `{_p_conversion_time}`
  - Attribution Tags: `{sub_aff_id}`, `{sub_id1}`, `{sub_id2}`
- **Automatic Deal Attribution:** Matches incoming conversions with the original broadcasted Post, updating post orders count, actual revenue, and verified net commission.
- **Instant Admin WhatsApp Notification:** Automatically alerts the administrator on WhatsApp as soon as an order is confirmed on Daraz, detailing the purchased item, sale amount, and earned commission.
- **Test Ping Compatibility:** Intelligently identifies and accepts Daraz Adsense connectivity checks (`Run Test`), returning standard `{ code: 0, msg: "success", data: "success" }` responses.

### 4. 100% Verified Revenue & Performance Analytics
- **Zero Guesswork:** Replaced theoretical estimation models with 100% verified real webhook metrics:
  - **Confirmed Orders:** Real count of webhook purchases attributed to your broadcasts.
  - **Total Sales Volume (GMV):** Actual value of goods sold through your links.
  - **Actual Commission Earned:** Real cash net earnings verified by Daraz postback.
- **Live Verified Daraz Orders Table:** Full audit table showing transaction details, category, device type, platform, customer status (New vs Existing), order value, and net payout.
- **Buyer Engagement Heatmap (24h x 7d Matrix):** Aggregates buyer activity across days and hours normalized to local time, pinpointing peak conversion windows.

### 5. Anti-Ban Broadcast Safeguards
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
┌─────────────────────────────┐          ┌──────────────┐
│  Daraz Affiliate Adsense    │          │ WAHA Gateway │
│  (S2S Postback Webhook)     │          └──────┬───────┘
└──────────────┬──────────────┘                 │
               │ Macro Payloads                 │ Inbound Events & Polls
               ▼                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Reverse Proxy (HTTPS)                           │
└──────────────────────┬───────────────────────────────┬──────────────────────┘
                       │                               │
                       ▼                               ▼
        ┌─────────────────────────────┐  ┌───────────────────────────┐
        │  Fastify REST API & Engine  │  │   Next.js 14 Dashboard    │
        │  - S2S Postback Receiver    │  │   - Real-Time Orders      │
        │  - Sub-Tracking Injector    │  │   - Verified GMV & Cash   │
        │  - Bilingual Copywriter     │  │   - Buyer Heatmap         │
        └──────────────┬──────────────┘  └───────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
  ┌────────────┐ ┌───────────┐ ┌───────────┐
  │ PostgreSQL │ │  Redis 7  │ │ MinIO S3  │
  │ (Orders &  │ │ (BullMQ   │ │ (Assets)  │
  │  Posts)    │ │  Queues)  │ │           │
  └────────────┘ └─────┬─────┘ └───────────┘
                       │
                       ▼
        ┌─────────────────────────────┐
        │   Background Queue Worker   │
        │   - Scraper & Gemini AI     │
        │   - Direct s.daraz.lk Links │
        │   - Rate-Limited Dispatch   │
        └──────────────┬──────────────┘
                       │
                       ▼
        ┌─────────────────────────────┐
        │ Targeted WhatsApp Community │
        │ (Tamil & Sinhala Groups)    │
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
3. Paste any Daraz product or affiliate URL (e.g., `https://www.daraz.lk/products/...` or `https://s.daraz.lk/s.XXX`).
4. Select your preferred media mode (auto-scraped image, custom upload, or text-only).
5. Enter the estimated or actual commission amount in LKR when prompted.
6. Review the Gemini AI-generated bilingual promotional copy.
7. Confirm via the interactive approval poll (`1️⃣ ஆம், குரூப்களுக்கு அனுப்புக`) to queue rate-limited broadcasts to your configured destination channels.

### 3. Configuring Daraz S2S Postback
1. Log in to the [Daraz Affiliate Adsense Portal](https://adsense.daraz.lk/) and navigate to **Integration > Postback URL**.
2. Click **Add New** and enter:
   - **Name:** e.g., `KH Live Tracker`
   - **Type:** `Order`
   - **URL:** Copy the pre-configured Postback URL from your Dashboard:
     ```
     https://<your-domain>/api/webhooks/daraz/postback?order_id={_p_transaction}&sub_order_id={_p_sub_transaction}&amount={_p_pay_amount}&payout={_p_payout}&commission_rate={_p_com_rate}&currency={_p_currency}&status={_p_status}&item_id={_p_purchased_item_id}&sku={_p_sku_daraz}&category1={_p_cate_name_lv1}&category2={_p_cate_name_lv2}&device_os={_device_os}&platform={_p_platform}&is_new_user={_p_new_user}&conversion_time={_p_conversion_time}&sub_aff_id={sub_aff_id}&post_id={sub_id1}&language={sub_id2}
     ```
3. Save and click **Activate**.
4. Use the built-in **Run Test** tool to verify connectivity. The server returns `{ code: 0, msg: "success", data: "success" }`.

### 4. Monitoring Real-Time Conversions & Payouts
1. Open the analytics dashboard at `/analytics`.
2. View 100% real-time verified metrics:
   - **Total Deals Broadcasted:** Count of active broadcast campaigns.
   - **Confirmed Orders:** Actual verified orders attributed via webhook.
   - **Total Sales Volume (GMV):** Real total value of goods sold on Daraz.
   - **Actual Commission Earned:** Net verified cash payout from confirmed transactions.
3. Inspect recent transactions in the **Live Verified Daraz Orders Table** for full item, SKU, category, and device attribution.
4. Consult the **Buyer Engagement Heatmap** to analyze peak purchasing windows and optimize broadcast schedules.

---

## 🔒 Security Best Practices

- **Network Isolation:** Internal services (PostgreSQL, Redis, MinIO) are bound to private Docker networks or localhost, preventing public internet exposure.
- **Access Control:** Dashboard routes are protected by authentication middleware.
- **Sender Verification:** WhatsApp bot commands are restricted strictly to configured administrator numbers.
- **Secret Management:** Production credentials and API keys should reside exclusively in `.env` files and never be checked into version control.

---

## 📄 License
This project is proprietary and intended for authorized affiliate marketing operations. All rights reserved.