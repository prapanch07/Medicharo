# Medicharo — Product Overview

## The Idea

Everyone has things they want — a new gadget, a guitar, a gaming console, a book collection, a trip fund. Friends often want to chip in for birthdays, festivals, or just because. But coordinating gift money is messy:

1. **No central place** — People ask "what do you want?" and get vague answers; wishlists are scattered across Amazon, phone notes, or mental memory
2. **Awkward follow-ups** — "Did you get my gift money?" or "How much more is needed?"
3. **No acknowledgment** — Contributors don't know if their contribution actually helped reach the goal
4. **No transparency** — Friends can't see how much has already been pooled together
5. **Payment verification** — No way for the wishlist owner to easily confirm who paid what

Existing solutions like Amazon Wishlist or registry sites are either locked to a single store, too formal, or require the gifter to buy the item themselves rather than contribute money.

## The Solution

**Medicharo** is a fun social wishlist platform where:
- Anyone can **create a wishlist** for anything they want (gadget, experience, hobby, travel)
- Friends, family, and the community can **browse wishes** and **contribute money directly** via UPI
- The wishlist owner **confirms payments** when received
- Contributors get **real-time feedback** on whether their money was accepted
- No platform fees — just direct UPI transfers between people

## How It Works — User Flow

### For Wisher (someone who needs help)

#### Step 1: First Visit — Onboarding
The first time you open Medicharo, a 4-step overlay greets you explaining how the platform works: create a wish → share the link → receive contributions → confirm payments. This only shows once.

#### Step 2: Sign Up / Sign In
Tap "Sign In" in the top-right corner. You have two options:
- **Google Sign-In** — One tap, no password needed. Your name and profile photo are pulled from Google.
- **Email & Password** — Enter your email, create a password. If you're new, you'll be prompted to enter your name after signing up.

After login, you're redirected back to where you were — if you were trying to create a wishlist, it proceeds immediately.

#### Step 3: Create a Wishlist
Tap "Create Wishlist" from the navbar. The form has the following fields:

| Field | Details |
|-------|---------|
| **Title** | What do you want? (e.g., "Sony WH-1000XM5 Headphones", "Goa Trip Fund") |
| **Amount Needed (₹)** | How much it costs or how much you need |
| **Story / Reason** | Why do you want this? Is it for a hobby, a milestone, a birthday? This is where people connect with your wish |
| **Category** | Choose from Electronics, Lifestyle, Music, Furniture, Books, Sports, Fashion, Health, or Other |
| **UPI ID** | Your UPI address (e.g., name@paytm) — where contributors send money directly |
| **Image URL (optional)** | Link to a photo of the item or something that represents your wish |
| **Product Link (optional)** | Link to the product page so contributors know exactly what they're contributing towards |

Tap "Create Wishlist" — your wish is now live.

#### Step 4: Share the Link
After creation, you land on your wishlist page. The URL is `https://medicharoo.web.app/wishlist/<unique-id>`. 

**How to share:**
- **WhatsApp** — Drop the link in a group or send to friends: "Hey this is my wishlist! 🎂 Birthday contributions welcome!"
- **Instagram / Facebook** — Post it on your story: "Adding to my wishlist fund!"
- **Direct message** — Send it to someone who asked what you want for your birthday/occasion

#### Step 5: Monitor Contributions (Real-time)
As people visit your wishlist and decide to contribute, you see everything update instantly:

1. A **🔔 badge** appears on the bell icon in your navbar with the unread count
2. Tap the bell → the notification modal slides down showing the 5 most recent notifications
3. Each notification shows: who contributed, how much (₹), and their personal message
4. The **Profile page** shows pending confirmations in a dedicated card

Behind the scenes, the raised amount on your wishlist card **does not increase yet** — the payment is still pending confirmation.

#### Step 6: Confirm or Reject a Payment
When someone contributes, they see your UPI QR code and transfer the money directly to your UPI ID. After they pay, they tap "I've Paid" on the app. You then get a notification and need to take action:

**To confirm:**
1. Open your UPI app (Google Pay, PhonePe, Paytm, etc.)
2. Check if the amount has actually arrived in your bank account
3. Go back to Medicharo → tap ✅ Confirm on the notification
4. The contribution status changes to "confirmed"
5. The wishlist's raised amount increases by the contribution amount
6. The contributor gets a ✅ "Payment confirmed" notification
7. The progress bar on your wishlist card updates for everyone to see

**To reject:**
1. Check your UPI app — if the money hasn't arrived
2. Tap ✕ Reject on the notification
3. A confirmation dialog asks "Reject this payment? The contributor will be notified." — tap OK
4. The contribution status changes to "rejected"
5. The contributor gets a ⚠️ "Payment rejected" notification
6. The contributor can then tap 🚩 Report Issue and upload a screenshot of their payment proof
7. You and the contributor can resolve the dispute offline

#### Step 7: Auto-confirmation (24-hour rule)
If you don't confirm or reject a pending contribution within 24 hours, the system automatically confirms it. This prevents contributions from getting stuck forever if the wisher is unavailable.

#### Step 8: Wish Fulfilled
Once the total raised amount meets or exceeds the goal amount:
- The wishlist status automatically changes to "completed"
- A 🎉 Fulfilled! badge appears on the wishlist card
- The wishlist moves from "Active" to "Completed" in your profile
- Contributors can see that the goal was reached

#### Step 9: Edit Your Profile
From your profile page, you can:
- **Edit Profile** — Change your display name and UPI ID
- **View Stats** — See total wishes created, total amount raised, active vs completed count
- **Sign Out** — Log out of your account

---

### For Contributor (someone who wants to help)

#### Step 1: Browse Wishes (No Login Required)
Anyone can browse wishlists without signing in. The home page shows:

- **Hero section** — A warm welcome with community stats (total wishes shared, total amount raised, fulfilled count)
- **Search bar** — Type any keyword to find wishes by title, story, or creator name
- **Category filters** — Click a category (Electronics, Books, Sports, etc.) to narrow down
- **Sort options** — Sort by Latest, Oldest, or Highest Price
- **Wishlist grid** — Cards showing the item title, creator name, category, progress bar, and amount raised

Click any card to see the full details.

#### Step 2: Read the Full Story
The wishlist detail page shows:

1. **Cover image** — Large hero image (or a placeholder ✨)
2. **Progress section** — Raised amount, remaining amount, completion percentage, visual progress bar
3. **Story section** — The wisher's full explanation of why they need help
4. **Creator profile** — The person behind the wish
5. **Recent contributors** — A list showing who else has contributed and their messages
6. **Contribute button** — The call to action to help

If you've already contributed and your payment is still pending, a persistent banner reminds you: "⏳ Payment Pending — The creator has been notified and will confirm your payment shortly."

#### Step 3: Sign In to Contribute
Tap "❤️ Contribute Now" — if you're not signed in, the login modal appears. Choose Google or Email sign-in. After successful login, the donation flow resumes automatically — you don't need to find the wishlist again.

#### Step 4: Enter Your Contribution
The donation modal opens with:

1. **Amount input** — Enter how much you want to contribute (₹). The app validates:
   - Amount must be greater than ₹0
   - Amount cannot exceed the remaining goal
   - If the wish is already fulfilled, contribution is blocked
2. **Your name** — Pre-filled from your account (editable)
3. **Message (optional)** — Write a personal note to the wisher (e.g., "Get well soon! 🙏")
4. **QR Code** — A dynamically generated UPI QR code with the wisher's UPI ID, amount, and your name encoded

#### Step 5: Scan & Pay via UPI
The QR code contains a full `upi://pay` deep link with:
- The wisher's UPI ID (payee)
- The exact amount
- Your name as the transaction note

**Payment options:**
- **Scan the QR code** using any UPI app's scanner
- **Auto-open UPI app** — On mobile, tapping the QR code opens your default UPI app with all details pre-filled
- Supported apps: Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, and any UPI-enabled app

#### Step 6: Tap "I've Paid"
After you complete the payment in your UPI app, come back to Medicharo and tap **"I've Paid, Notify Creator"**. This:

1. Creates a pending contribution in the system
2. Sends an instant notification to the wisher: "💰 [Your Name] contributed ₹[amount]"
3. The wisher's bell badge lights up with a count
4. A persistent banner appears on the wishlist page: "⏳ Payment Pending — The creator has been notified"
5. The button disables to prevent double-clicks

**Important:** The button is disabled after the first click to prevent accidental duplicate notifications.

#### Step 7: Wait for Confirmation
Now the ball is in the wisher's court:

1. They check their UPI app to verify the money arrived
2. They tap ✅ Confirm on their end
3. You get a 🔔 notification: "✅ Payment confirmed — ₹[amount] for [wishlist title] was confirmed"
4. Your name appears in the "Recent Contributors" list with a ✅ checkmark
5. The raised amount on the wishlist increases

If the wisher doesn't confirm within 24 hours, the system automatically confirms the contribution.

#### Step 8: If Your Payment Gets Rejected
If the wisher taps ✕ Reject (meaning they didn't receive the money):

1. You get a ⚠️ "Payment rejected" notification
2. On the wishlist page, a "⚠️ Your contribution was rejected" section appears
3. A 🚩 Report Issue button is available

**What to do if your payment was wrongly rejected:**
1. Take a screenshot of the successful payment from your UPI app (showing the transaction ID, amount, date, and recipient UPI ID)
2. Tap 🚩 Report Issue
3. In the report form:
   - Write a brief explanation of what happened
   - Upload the screenshot of your payment proof
4. Submit the report — it's stored securely and can be reviewed

#### Step 9: View Your Contribution History
On your profile page (visible after sign-in):
- Your stats are shown (total created wishes, etc.)
- Your own wishlists are listed in Active and Completed tabs
- You can see which of your contributions were confirmed vs pending

Since notifications auto-clear when you open the bell, you can always check the full history on the `/notifications` page.

---

### Notification Lifecycle (End to End)

```
Contributor taps "I've Paid"
    ↓
Pending contribution created
    ↓
Wisher receives notification (bell badge +1)
    ↓
Wisher taps bell → modal opens (badge cleared automatically)
    ↓
Modal shows: "💰 [Name] contributed ₹[amount]"
    ↓
Wisher checks UPI app
    ↓
┌─────────────────┬─────────────────────┐
│ Money received  │ Money NOT received  │
│   ↓             │   ↓                 │
│ Tap ✅ Confirm  │ Tap ✕ Reject       │
│   ↓             │   ↓                 │
│ Contribution    │ Contribution        │
│ status:         │ status:             │
│ confirmed       │ rejected            │
│   ↓             │   ↓                 │
│ Raised amount   │ Contributor gets    │
│ increases       │ notification:       │
│   ↓             │ "⚠️ Payment         │
│ Contributor     │ rejected"           │
│ gets:           │   ↓                 │
│ "✅ Payment     │ Contributor sees    │
│ confirmed"      │ 🚩 Report button   │
│   ↓             │   ↓                 │
│ Name appears    │ Contributor can     │
│ in contributor  │ upload screenshot   │
│ list with ✅    │ as proof           │
│   ↓             │   ↓                 │
│ If goal met →   │ Report stored in    │
│ wishlist =      │ reports collection  │
│ completed 🎉    │ for review          │
└─────────────────┴─────────────────────┘
│ If 24 hours pass without action     │
│ → Auto-confirmed (system handles)   │
└─────────────────────────────────────┘
```

### Edge Cases & Behaviors

| Scenario | What Happens |
|----------|-------------|
| Non-logged-in user taps "Contribute" | Login modal appears; after login, contribution modal opens automatically |
| Non-logged-in user taps "Create Wishlist" | Login modal appears; after login, navigates to create form automatically |
| Contribution exceeds remaining amount | Blocked with error: "Amount exceeds remaining" |
| Wishlist already fulfilled when contributing | Blocked with error: "Already fulfilled" |
| User reloads page after paying but before tapping "I've Paid" | No data lost — the contribution was never created; user can pay again |
| Double tap on "I've Paid" | Button disables after first click, preventing duplicate notifications |
| Wisher is offline when contribution comes in | Notification waits in Firestore; when wisher opens the app, badge updates instantly via real-time listener |
| Contributor taps bell before wisher confirms | Auto-clears badge; notifications remain in modal/page for reference |
| Contribution is rejected but contributor didn't actually pay | Contributor can choose to not file a report; no further action needed |
| User has multiple wishlists | Each appears in Profile under Active/Completed tabs; pending contributions tracked per wishlist |
| UPI ID is incorrect in wishlist | Money goes to wrong account; wisher can edit UPI ID in profile settings for future wishes |

### Key Features

| Feature | What It Does |
|---------|-------------|
| 🔔 Real-time Notifications | Bell icon with badge — new contribution, confirmed, or rejected — instant updates |
| 📱 UPI QR Payments | Scan & pay directly — no payment gateway, no fees |
| ✅ Payment Confirmation | Wisher confirms receipt — builds trust and accountability |
| 🚩 Report Issue | If payment was wrongly rejected, contributor can submit proof |
| 🌙 Dark Mode | Toggle between light and dark themes |
| 🔍 Search & Filter | Find wishes by keyword or category |
| 📊 Progress Tracking | Visual progress bar on every wishlist card |
| 📖 Story Section | Each wishlist has a personal story explaining the need |

## Design Philosophy

The UI is built around fun and warmth — the color palette uses soothing greens and warm accents, not cold corporate blues. Typography is rounded and friendly.

Every interaction is designed to be:

- **Instant** — Contributions, confirmations, and notifications all update in real-time without page refreshes
- **Transparent** — Everyone can see how much has been raised toward a wish, who contributed, and whether payments are confirmed
- **Social** — Share your wishlist, get friends to chip in together for birthdays, festivals, or just because
- **Mobile-first** — The entire experience works great on phones, since most sharing happens on WhatsApp and Instagram

## Comparison to Alternatives

| Platform | Purpose | UPI Direct | Real-time Updates | Social Sharing | Platform Fees |
|----------|---------|-----------|-------------------|----------------|--------------|
| **Medicharo** | Social wishlists — anything you want | ✅ Direct to person | ✅ Instant | ✅ Shareable link | ❌ Zero |
| Amazon Wishlist | Product registry | ❌ Store-locked | ❌ No | ✅ Shareable | ❌ Free |
| Registries (Shaadi, etc.) | Wedding gifts | ❌ Store-locked | ❌ No | ❌ Event-only | ⚠️ Varies |
| WhatsApp / Google Pay | Direct money transfer | ✅ Direct | ❌ No tracking | ⚠️ Manual | ❌ Zero |
| Crowdfunding platforms | Fundraising campaigns | ❌ Gateway | ⚠️ Delayed | ✅ Shareable | ⚠️ 5-10% |

Medicharo fills the gap between formal registries and informal money transfers — combining the structure of a wishlist with the simplicity of direct UPI payments, all in a fun, social package.

## Future Possibilities

- **Community feed** — See a timeline of fulfilled wishes, celebrations, and thank-you posts
- **Birthday / event pooling** — Dedicated pages where multiple friends can chip in for a single gift
- **Teams** — Allow multiple people to manage a single wishlist (group gift coordination)
- **Milestone updates** — Wisher posts updates when they get the item (unboxing, trip photos, etc.)
- **Volunteer matching** — Let people offer non-monetary help (gift wrapping, delivery, recommendations)
- **Public leaderboards** — Most generous contributors, most fulfilled wishes, etc.
