# Medicharo — Technical Architecture

## Stack Overview

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + Vite 5 | Component-based UI, fast builds, HMR |
| Routing | React Router v6 | Client-side SPA routing |
| State | React Context (UserContext, ToastContext) | Auth state, notifications, toast messages |
| Backend | Firebase v10 Modular SDK | Fully serverless — no custom backend |
| Auth | Firebase Auth (Google, Email/Password) | Authentication |
| Database | Firestore (NoSQL) | All persistent data |
| Hosting | Firebase Hosting | Static asset serving + SPA rewrites |
| Payments | UPI QR (qrcode npm package) | Client-generated QR codes with upi:// links |
| Build | Vite 5 + @vitejs/plugin-react | ESBuild transforms, Rollup bundling |

## Project Structure

```
medicharo/
├── index.html                      # Vite entry point
├── vite.config.js                  # Vite config with React plugin
├── firebase.json                   # Firebase Hosting config (rewrites for SPA)
├── firestore.rules                 # Firestore security rules
├── package.json                    # Dependencies
├── public/
│   └── css/
│       ├── design-tokens.css       # CSS variables (colors, spacing, typography)
│       └── styles.css              # All UI component styles
├── src/
│   ├── main.jsx                    # React DOM render entry
│   ├── App.jsx                     # Root: Router, Context providers, Onboarding
│   ├── firebase.js                 # Firebase SDK — all CRUD + subscription functions
│   ├── hooks/
│   │   └── useScrollAnimation.js   # IntersectionObserver + viewport fallback
│   └── components/
│       ├── Navbar.jsx              # Logo, nav links, theme toggle, bell icon, avatar
│       ├── Home.jsx                # Hero, stats, search, filters, wishlist grid
│       ├── Detail.jsx              # Wishlist detail, donation, contributor list
│       ├── Profile.jsx             # User profile, stats, pending confirmations, wishlists
│       ├── CreateWishlist.jsx      # Wishlist creation form
│       ├── DonateModal.jsx         # QR code payment modal with "I've Paid" submit
│       ├── LoginModal.jsx          # Google + Email sign-in / sign-up
│       ├── ReportModal.jsx         # Rejection report form with screenshot upload
│       ├── NotificationModal.jsx   # Bell dropdown — 5 latest notifications
│       ├── NotificationsPage.jsx   # Full /notifications page — all notifications
│       ├── EditProfileModal.jsx    # Edit name and UPI ID
│       ├── Toast.jsx               # Toast notification component
│       ├── Onboarding.jsx          # 4-step first-visit tutorial overlay
│       └── Footer.jsx              # Site footer
```

## Data Flow

### Firestore Collections

```
wishlists/
  ├── creatorUid         string      # Owner's Firebase Auth UID
  ├── creatorName        string
  ├── title              string
  ├── price              number
  ├── raised             number      # Accumulated confirmed amount
  ├── reason             string
  ├── category           string
  ├── upiId              string      # Creator's UPI ID for payments
  ├── image              string      # Optional image URL
  ├── productLink        string      # Optional product URL
  ├── status             enum        # 'active' | 'completed'
  └── createdAt          Timestamp

contributions/
  ├── wishlistId         string
  ├── wishlistCreatorUid string      # For direct pending query
  ├── contributorUid     string|null # Null for anonymous
  ├── contributorName    string
  ├── amount             number
  ├── message            string
  ├── status             enum        # 'pending' | 'confirmed' | 'rejected'
  └── createdAt          Timestamp

notifications/
  ├── toUid              string      # Recipient
  ├── type               enum        # 'new_contribution' | 'confirmed' | 'rejected'
  ├── fromName           string
  ├── fromUid            string|null
  ├── wishlistId         string
  ├── wishlistTitle      string
  ├── amount             number
  ├── message            string
  ├── contributionId     string      # For confirm/reject/report actions
  ├── read               boolean
  └── createdAt          Timestamp

reports/
  ├── contributionId     string
  ├── wishlistId         string
  ├── reason             string
  ├── screenshot         string      # Base64 or URL
  ├── status             enum        # 'open'
  ├── reportedBy         string
  └── createdAt          Timestamp

users/
  ├── name               string
  ├── email              string
  ├── photo              string
  ├── upiId              string
  └── [merged with auth UID as doc ID]
```

### Contribution Lifecycle

```
User taps "I've Paid" (DonateModal)
  → addContribution() writes pending contribution
  → notification created for wisher (type: new_contribution)
  → Wisher sees badge on bell icon (real-time via onSnapshot)
  
Wisher opens bell → NotificationModal mounts
  → markAllNotificationsRead() → badge clears
  → Latest 5 notifications displayed with Confirm/Reject buttons
  
Wisher taps Confirm
  → confirmContribution() updates contribution to 'confirmed'
  → wishlist.raised += amount
  → if raised >= price, wishlist.status = 'completed'
  → notification created for contributor (type: confirmed)
  → All users see raised amount update instantly (onSnapshot)

Wisher taps Reject
  → rejectContribution() updates contribution to 'rejected'
  → notification created for contributor (type: rejected)
  → Contributor sees badge → taps bell → sees rejected notification with 🚩 Report button

Contributor taps 🚩 Report Issue
  → ReportModal opens with textarea + file upload
  → submitReport() writes to reports collection
```

### Real-time Subscriptions (onSnapshot)

All critical data reads use Firestore `onSnapshot` listeners instead of one-time `getDocs()`:

| Data | Component | Listener |
|------|-----------|----------|
| Wishlist list | Home.jsx | `subscribeWishlists` |
| Single wishlist | Detail.jsx | `subscribeWishlist` |
| My wishlists | Profile.jsx | `subscribeMyWishlists` |
| Notifications | NotificationModal, NotificationsPage | `subscribeNotifications` |
| Unread count | App.jsx → UserContext | `subscribeUnreadCount` |
| Contributions | Detail.jsx | `subscribeContributions` |
| Pending confirmations | Profile.jsx | `subscribePendingForUser` (queries by `wishlistCreatorUid`) |

Each subscription returns an unsubscribe function called in `useEffect` cleanup, preventing memory leaks.

### Auth Flow

```
App.jsx: onAuthChanged listener
  → sets UserContext.user
  → starts subscribeUnreadCount for the user
  
Protected actions (create wishlist, contribute):
  1. User taps action without being signed in
  2. pendingLogin stores the intended action
  3. LoginModal opens
  4. On success → stored action executes automatically
  5. pendingLogin cleared
```

## Key Design Decisions

### Why not Next.js?
The app is fully client-side — Firebase Auth and Firestore are client SDKs that don't benefit from SSR. Vite + React Router gives faster builds and simpler deployment to Firebase Hosting.

### Why onSnapshot over getDocs?
Firestore listeners push updates instantly when any document changes:
- A wishlist completion updates every user's Home grid without refresh
- A contribution confirmation updates the creator's pending list in real-time
- The badge count decrements the moment `read: true` is written

### Why Firebase over a custom backend?
Zero server management, built-in auth, Firestore real-time listeners match the app's need for instant updates. The entire data model fits in a single Firestore database with client-side rules.

### CSS Strategy
- `design-tokens.css`: All CSS variables (colors, spacing, typography, shadows, breakpoints)
- `styles.css`: All component styles using those variables
- Dark/light theme via `[data-theme="dark"]` attribute on `<html>`
- Mobile-first responsive with breakpoints at 480px, 768px, 1024px

## Deployment

```bash
npm run build          # → dist/
firebase deploy        # → Firebase Hosting
```

Firebase config (`firebase.json`):
```json
{
  "hosting": {
    "public": "dist",
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  }
}
```
