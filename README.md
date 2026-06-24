# Medicharo

A social wishlist platform where anyone can post wishes and let friends, family, or the community contribute money directly via UPI — zero platform fees, fully transparent, real-time updates.

## 🌐 Live

[medicharoo.web.app](https://medicharoo.web.app/)

## What It Does

- **Create a Wishlist** — Post anything you want (gadget, trip, hobby item) with a goal amount, story, and your UPI ID.
- **Contribute via UPI** — Contributors scan a dynamically generated UPI QR code and pay directly — no payment gateway, no fees.
- **Payment Verification** — Wishlist owners confirm or reject contributions after checking their UPI app. Auto-confirms after 24 hours if no action is taken.
- **Real-time Notifications** — Instant bell-icon alerts for new contributions, confirmations, and rejections — all powered by Firestore `onSnapshot` listeners.
- **Dispute Resolution** — Wrongly rejected contributors can submit a report with payment proof (screenshot upload).
- **Progress Tracking** — Visual progress bars on every wishlist card; auto-marks as fulfilled when the goal is met.
- **Browse Without Login** — Anyone can search, filter by category, and explore wishlists. Login is only required to create or contribute.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5 |
| Routing | React Router v6 (SPA) |
| State Management | React Context API |
| Backend | Firebase v10 (serverless) |
| Auth | Firebase Auth (Google, Email/Password) |
| Database | Cloud Firestore (NoSQL, real-time) |
| Payments | UPI QR codes (`qrcode` npm package) |
| Hosting | Firebase Hosting |

**Architecture:** Fully client-side SPA with a serverless Firebase backend — no custom server, all data operations via Firestore client SDK with real-time subscriptions.

## Key Features

| Feature | Description |
|---------|------------|
| 🔔 Real-time Notifications | Instant updates via Firestore listeners |
| 📱 UPI QR Payments | Direct peer-to-peer, zero fees |
| ✅ Payment Confirmation | Manual confirm/reject + 24-hour auto-confirm |
| 🚩 Dispute Reports | Screenshot proof upload for rejected payments |
| 🌙 Dark / Light Mode | Theme toggle with CSS custom properties |
| 🔍 Search & Filters | Keyword search + category filters + sort (latest, oldest, highest price) |
| 📊 Progress Bars | Visual goal tracking on every wishlist |
| 🎉 Auto-Fulfillment | Wishlist auto-completes when goal amount is reached |
| 📖 Onboarding | 4-step first-visit tutorial overlay |
| ⚡ Code Splitting | Lazy-loaded routes for faster initial load |

## Design Decisions

- **Vite + React over Next.js** — Fully client-side app; Firebase SDKs don't benefit from SSR.
- **`onSnapshot` over `getDocs`** — Real-time listeners push instant updates (raised amounts, notification badges, contribution statuses) without page refreshes.
- **Firebase over custom backend** — Zero server management; Firestore real-time listeners + client-side security rules match the app's requirements.
- **CSS Custom Properties** — Design tokens in `design-tokens.css`; dark/light theme via `[data-theme]` attribute on `<html>`. Mobile-first responsive (480px, 768px, 1024px breakpoints).
- **UPI QR (client-generated)** — No payment gateway dependency; `upi://pay` deep links work with any UPI app.
