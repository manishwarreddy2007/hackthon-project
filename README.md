# FoodLink

FoodLink connects food donors with nearby community organizations. The existing React/Vite interface uses Supabase Auth and the shared Supabase database for profiles, donations, requests, connections, and pickup status.

## Supabase Setup

Use the existing Supabase project. In its SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql). It creates missing tables and updates the existing RLS policies and lifecycle RPCs; it does not create a second set of donation tables.

Available pickup details are scoped to receivers registered in that city and the donor. Request and connection records are participant-only; profile phone/email fields remain masked until a request is accepted.

Deploy the existing `register-user` Edge Function:

```powershell
npx supabase functions deploy register-user --project-ref YOUR_PROJECT_REF
```

The function creates confirmed Auth users server-side, so registration does not send confirmation emails or depend on the email rate limit. It reads Supabase's built-in `SUPABASE_SERVICE_ROLE_KEY` as a fallback, along with the existing `SUPABASE_SECRET_KEY` / `SUPABASE_SECRET_KEYS` settings. Keep all of these keys server-side; never put a service-role or secret key in a `VITE_` variable.

Create `.env.local` in the project root (or use the existing `.env`) with the public client settings:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Only the project URL and publishable/anon key belong in the browser. Restart Vite after changing environment values. The committed `.env.example` contains placeholders only.

## Run And Verify

```powershell
npm install
npm run lint
npm run build
npm run dev -- --host 0.0.0.0
```

Open the Vite URL printed in the terminal. The donor and receiver must use the same Supabase project and select the same city. Use distinct email addresses and accounts:

1. On Laptop A, register a **Food Donor** account and sign in.
2. Choose **Donate Food**. Enter a food name, category, quantity, pickup address, pickup window, description, and any dietary notes; submit.
3. On Laptop B, register a **Food Receiver** account in the same city and sign in.
4. Open **Find Donations**. The new listing is loaded from Supabase; refresh or navigate away and back to fetch the shared rows again.
5. Request the donation. The receiver sees **Request Pending** under **My Requests**.
6. On Laptop A, return to the donor dashboard and accept the request. The donor and receiver can open the private connection.
7. In that connection, confirm the pickup time, confirm pickup, then complete the donation. Both dashboards read the persisted status from Supabase.

AI matching is not connected to an external AI service. The existing match panel is retained and explicitly labeled as a demo rule-based match using the saved city, profile verification, donation pickup window, and urgency. It does not invent distance or donation records.
