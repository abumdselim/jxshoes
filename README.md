# Shopkeeper — Full Control CMS 🛍️

A complete, self-hostable e-commerce platform for shoe & bag retailers — a modern
customer-facing storefront **plus** a full back-office CMS (orders, inventory,
finance, AI assistant) running entirely on **Cloudflare's edge**, at near-zero cost.

> Live storefront: **https://shopkeeperbd.pages.dev**
> Admin panel: `https://shopkeeperbd.pages.dev/admin` *(direct URL only — no public links)*

---

## ✨ Highlights

### Storefront
- Product catalog with categories, search, filters & product detail pages
- Cart, checkout, coupon codes, flash-deal timer, header notice ticker
- Order confirmation pages, bKash/Nagad or Cash-on-Delivery payment info
- Fully responsive, Bengali-first UI

### Admin CMS (`/admin`)
- **Orders** — status pipeline (Pending → Delivered), invoices, courier notes,
  call/WhatsApp actions, POS quick-sale entries
- **Products** — multi-image gallery, barcode/SKU support, variants & stock
- **Media Gallery** — every product image in one grid with a built-in
  **canvas image editor**: free cropping, free-degree rotation, flips and
  color balance (brightness / contrast / saturation / warmth)
- **Inventory & Stock (ERP)** — stock movements, suppliers, restock, min-stock alerts
- **Customers & Due Ledger** — customer khata with partial payments & collections
- **Expenses** — categorized expense book
- **Finance & P&L** — real-time profit/loss from per-item cost snapshots, with
  period-based analytics: revenue & profit trends, payment/channel/city breakdowns,
  top products, and a day-by-day ledger — all rendered with dependency-free SVG charts
- **AI Assistant** — streaming chat grounded in real store data, daily briefing,
  deep business insights, voice commands (speech-to-text), auto-restock actions
- **Reports** — weekly/monthly AI reports delivered by email through a scheduled
  Cloudflare Worker

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) · React 18 · TypeScript |
| UI | Tailwind CSS · lucide-react · custom SVG charts (zero chart libs) |
| Hosting | Cloudflare Pages (edge runtime via `@cloudflare/next-on-pages`) |
| Database | Cloudflare KV (single JSON store with atomic save) |
| Media | Cloudflare R2 (REST API proxy at `/api/media/*`) |
| AI | Cloudflare Workers AI (chat/insights) · Google Gemini (voice) |
| Email | Cloudflare Email Service (report delivery) |
| CI/CD | GitHub Actions → Cloudflare Pages |

No external database server, no paid SaaS dependencies — everything runs inside
your Cloudflare account.

---

## 🚀 Deployment

Deploys automatically: every push to `main` runs
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which builds with
`@cloudflare/next-on-pages` and publishes to the Cloudflare Pages project
**`shopkeeperbd`**.

### Required GitHub repository secrets

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account |
| `CLOUDFLARE_API_TOKEN` | Token with **Pages: Edit**, **KV: Edit**, **Workers AI: Write**, **R2: Edit**, **Email: Send** permissions |
| `CLOUDFLARE_KV_ID` | KV namespace id used as the data store |
| `CRON_SECRET` | Shared secret between the report Worker and `/api/cron/report` |
| `GEMINI_API_KEY` | Google Gemini key for voice transcription |

### Cron worker (optional — email reports)

```bash
cd workers/report-cron
npx wrangler deploy                 # weekly + monthly schedules
npx wrangler secret put CRON_SECRET # must match the GitHub secret above
```

---

## 💻 Local Development

```bash
npm install
cp .env.example .env   # then fill in the values (same keys as the table above)
npm run dev            # http://localhost:3000
```

`.env` keys: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_KV_ID`,
`GEMINI_API_KEY` (+ `CRON_SECRET` when testing the cron endpoint locally).
Without credentials the store still runs locally with file-based storage
(`data/store.json`) and the admin UI shows graceful "not configured" hints.

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx            # storefront (home)
│   ├── cart|checkout|product|order-success
│   └── admin/              # CMS: dashboard, assistant, inventory, products,
│                           # gallery, orders, customers, expenses, finance,
│                           # reports, settings (incl. banner & coupon control)
├── components/             # storefront + admin UI (charts, image editor, sidebar)
├── lib/                    # store (KV), AI client, email, finance, utils
└── types/                  # shared domain types
workers/
└── report-cron/            # scheduled AI email reports (weekly/monthly)
```

---

## 🔐 Security Notes

- The admin panel is intentionally unlinked from the storefront; access it by
  direct URL. *(Adding authentication is recommended before exposing it.)*
- All third-party credentials live in GitHub repository secrets / Cloudflare —
  never committed. `.env` is git-ignored.
- Media uploads are proxied through `/api/media/*` so storage stays private.

---

Built with ❤️ for small retailers who want big-retail tooling.
