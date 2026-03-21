# Quizzer app — authentication setup (full walkthrough)

This guide explains **every step** to connect Supabase Auth (email + Google) to the Quizzer Expo app.

---

## Part A — What you are wiring together (read this first)

1. **Your app** opens a browser so the user can sign in with Google. Google sends the user back to your app using a **redirect URL** (a special link like `quizzer://auth/callback`).
2. **Supabase** sits in the middle: it talks to Google’s servers, issues tokens, and your app uses those tokens so Supabase knows who is logged in.
3. **Google Cloud** only cares about one redirect for this flow: **Supabase’s** callback URL (`https://xxxxx.supabase.co/auth/v1/callback`). You do **not** put `quizzer://...` in Google Cloud for the standard Supabase + mobile browser flow.
4. **Supabase’s “Redirect URLs” list** is where you allow **`quizzer://auth/callback`** (and sometimes an Expo Go URL). If a URL is not allowed here, Supabase will reject the OAuth flow.

So you configure:

| Where              | What you add |
|--------------------|--------------|
| **Google Cloud**   | Supabase’s HTTPS callback only |
| **Supabase**       | Email + Google credentials + list of app redirect URLs (`quizzer://...`) |

---

## Part B — Supabase: find your project URL and reference

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. Open your **Quizzer** project (or create one).
3. Click **Project Settings** (gear icon, usually bottom left).
4. Under **Data API** (or **General**), note:
   - **Project URL** — looks like `https://abcdefghijklmnop.supabase.co`
   - The random part (`abcdefghijklmnop`) is your **project reference** (sometimes called **ref**).

You will use this exact URL in:

- Your app’s `.env` as `EXPO_PUBLIC_SUPABASE_URL`
- Google Cloud as the **authorised redirect URI** (see Part D)

---

## Part C — Supabase: turn on the Email provider

1. In the Supabase dashboard, open your project.
2. In the left sidebar, click **Authentication**.
3. Click **Providers** (or **Sign In / Providers** depending on UI version).
4. Find **Email** in the list.
5. Turn **Email** **on** (toggle enabled).
6. Optional but useful for **development**:
   - Find **Confirm email** (or similar wording).
   - If you **disable** confirmation, users can sign in immediately after sign-up without clicking a link in email.
   - For **production**, you normally **enable** confirmation so only real email addresses can register.

7. Click **Save** if the dashboard shows a save button.

**What this does:** Allows `signUp` / `signInWithPassword` with email and password from the app.

---

## Part D — Google Cloud: create OAuth credentials (step by step)

### D1 — Create or pick a Google Cloud project

1. Go to [https://console.cloud.google.com/](https://console.cloud.google.com/).
2. At the top, open the **project** dropdown.
3. Click **New project**, give it a name (e.g. “Quizzer Auth”), and create it — **or** select an existing project.

### D2 — Configure the OAuth consent screen (required once per project)

1. In the left menu: **APIs & Services** → **OAuth consent screen**.
2. Choose **External** (unless you have a Google Workspace with Internal only) → **Create**.
3. Fill in the minimum:
   - **App name** — e.g. Quizzer
   - **User support email** — your email
   - **Developer contact** — your email
4. **Scopes** — you can skip adding extra scopes for basic “Sign in with Google”; Supabase uses standard OpenID scopes.
5. **Test users** — if the app is in **Testing** mode, add your own Gmail address as a test user so you can sign in until you publish the app.
6. Save and continue through any remaining steps.

### D3 — Create OAuth **Web application** credentials

1. Go to **APIs & Services** → **Credentials**.
2. Click **+ Create credentials** → **OAuth client ID**.
3. If prompted, choose **Web application** as the application type.
4. **Name** — e.g. “Supabase Google Auth”.
5. **Authorised redirect URIs** — click **Add URI** and paste **exactly** (replace with your real project ref from Part B):

   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```

   Example (fake ref):

   ```
   https://abcdefghijklmnop.supabase.co/auth/v1/callback
   ```

   **Important:** There must be **no** trailing slash unless Google copied one; match Supabase’s documented callback path.

6. **Authorised JavaScript origins** — for this mobile + Supabase flow you can often leave empty, or add `https://YOUR_PROJECT_REF.supabase.co` if Google asks for it.

7. Click **Create**.
8. A dialog shows **Client ID** and **Client secret**. **Copy both** — you will paste them into Supabase next.

**What this does:** Google trusts Supabase to receive the OAuth response at that single HTTPS URL. Your phone app never talks to Google directly with a custom `quizzer://` URL for this step.

---

## Part E — Supabase: turn on Google and paste Client ID / Secret

1. Supabase dashboard → **Authentication** → **Providers**.
2. Open **Google**.
3. Enable the provider (toggle **on**).
4. Paste:
   - **Client ID** (from Google Cloud)
   - **Client Secret** (from Google Cloud)
5. Save.

**What this does:** When your app calls Supabase `signInWithOAuth({ provider: 'google' })`, Supabase uses these credentials to complete the Google login.

---

## Part F — Supabase: URL configuration (redirect URLs for the app)

1. Supabase dashboard → **Authentication** → **URL Configuration** (wording may be “Redirect URLs” or under **Site URL** settings).
2. Find **Redirect URLs** (allow list).

Add **at least**:

```
quizzer://auth/callback
```

**Why:** Your Expo app is configured with `scheme: "quizzer"` in `app.config.ts`. The app builds a return URL like `quizzer://auth/callback` so the browser can hand control back to the app after Google finishes.

### Expo Go (development)

If you use **Expo Go** on a physical device or emulator, the return URL is often **not** `quizzer://...` but something like:

```
exp://192.168.x.x:8081/--/auth/callback
```

or

```
exp://127.0.0.1:8081/--/auth/callback
```

**How to get the exact value (recommended once):**

1. Temporarily add in your app (e.g. after `Linking` import):

   ```ts
   import * as Linking from "expo-linking";
   console.log("Auth redirect:", Linking.createURL("auth/callback"));
   ```

2. Run the app, read the Metro/console output, copy the printed URL.
3. Add that **exact** string to Supabase **Redirect URLs**.
4. Remove the `console.log` when done.

Add **each** variant you use (home Wi‑Fi IP can change, so you may add several `exp://...` lines for dev).

### Site URL (optional note)

**Site URL** in Supabase is often your website. For a mobile-only V1 you can leave it as default or set it to your Supabase project URL; the critical part for mobile OAuth is the **Redirect URLs** allow list.

---

## Part G — Your app environment variables

In **`apps/app/.env`** (next to `package.json`):

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

- **URL** — from Supabase **Project Settings → API** (same as Part B).
- **Anon key** — **Project Settings → API → Project API keys → `anon` `public`**. This is safe to ship in the app; it is not the **service_role** key.

Restart Expo:

```bash
npx expo start --clear
```

---

## Part H — Quick checklist

- [ ] Supabase **Email** provider enabled.
- [ ] Google Cloud **OAuth client** (Web) created with redirect  
      `https://<project-ref>.supabase.co/auth/v1/callback`
- [ ] Supabase **Google** provider enabled with that client’s ID and secret.
- [ ] Supabase **Redirect URLs** includes `quizzer://auth/callback` (+ Expo `exp://...` if using Expo Go).
- [ ] App `.env` has correct `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] If consent screen is in **Testing**, your Gmail is added as a **test user**.

---

## Part I — Troubleshooting (plain English)

| Symptom | What to check |
|--------|----------------|
| “Redirect URL not allowed” | Supabase **Redirect URLs** must include the **exact** URL the app uses (`quizzer://auth/callback` or logged `Linking.createURL` value). |
| Google error about redirect | Google Cloud **Authorised redirect URIs** must include **only** the Supabase `https://....supabase.co/auth/v1/callback` URL — not `quizzer://`. |
| “Access blocked” / “app not verified” | OAuth consent screen: add yourself as **test user** while in Testing, or complete verification for production. |
| Email sign-up works but cannot sign in | **Confirm email** may be on — check inbox or disable for dev in Supabase Email settings. |
| Invalid API key in app | Wrong anon key or `.env` not loaded — restart with `--clear`. |

---

## App behaviour (reminder)

- No session → **Sign in** / **Create account**.
- After login → **role** picker (player/host), then main app.
- **Settings → Sign out** → session cleared; stored role cleared so next sign-in shows role picker again.

Sessions persist via **AsyncStorage** in `src/lib/supabase.ts`.
