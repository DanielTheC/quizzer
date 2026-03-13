# Quizzer CMS – Content setup guide

Use Sanity Studio at **/studio** to edit marketing content. Quiz and venue data stays in Supabase (or mock data) and is **not** managed here.

---

## Quick checklist

Do these in order. When you open each singleton for the first time, the form will be **pre-filled** with the recommended content below—review, tweak if needed, and **Publish**.

- [ ] **1. Site Settings** – Create doc with ID `siteSettings`, fill or keep defaults, Publish.
- [ ] **2. Home page** – Create doc with ID `homePage`, fill or keep defaults, Publish.
- [ ] **3. Host page** – Create doc with ID `hostPage`, fill or keep defaults, Publish.
- [ ] **4. Cities** – Create 5 city documents (London, Birmingham, Manchester, Glasgow, Edinburgh) with the slugs below, Publish each.
- [ ] **5. FAQs** – Create the FAQ documents listed below, set category and order, Publish each.

---

## 1. Site Settings (document ID: `siteSettings`)

**How to create:** In Studio sidebar click **Site settings**. If you see “Document not found”, create a new document and set its **Document ID** to `siteSettings` (in the document pane or when saving). The form will pre-fill with the values below.

| Field | Recommended content |
|-------|----------------------|
| **Site title** | Quizzer |
| **Default meta title** | Find Pub Quizzes Near You \| Quizzer |
| **Default meta description** | Discover pub quizzes near you, explore quiz nights across UK cities, and climb the leaderboard with Quizzer. |
| **Contact email** | hello@quizzerapp.co.uk |
| **Footer tagline** | Find. Play. Win. |
| **Footer copyright** | © 2025 Quizzer. All rights reserved. |
| **Social links** | Optional. Add label + URL for each profile. |

---

## 2. Home page (document ID: `homePage`)

**How to create:** In Studio click **Home page**. Create a new document with ID `homePage`. The form will pre-fill.

| Field | Recommended content |
|-------|----------------------|
| **Hero title** | Find a Pub Quiz Near You |
| **Hero subtitle** | Discover quiz nights across the UK, track your scores and climb the leaderboard with Quizzer. |
| **Stat items** | (4 items) Quizzes Listed, Cities Live, Teams Playing, Pubs Partnered (values e.g. 500+, 5, 10k+, 200+). |
| **Feature cards** | (3 cards) 1) Find quizzes nearby – Discover pub quizzes happening in your city tonight. 2) Play live quizzes – Join the game and see scores update live. 3) Climb the leaderboard – Compete against teams across your city. |
| **Host section title** | For venues |
| **Host section copy** | Run quiz nights that pull in crowds and keep them coming back. Quizzer helps you list your quiz, manage rounds, and let players join on their phones. More footfall, less admin. |
| **Final CTA title** | Ready to find your next quiz night? |
| **Final CTA copy** | Browse quizzes happening tonight near you. |
| **SEO title** | (optional) Overrides default when set. |
| **SEO description** | (optional) Overrides default when set. |

---

## 3. Host page (document ID: `hostPage`)

**How to create:** In Studio click **Host page**. Create a new document with ID `hostPage`. The form will pre-fill.

| Field | Recommended content |
|-------|----------------------|
| **Hero title** | Host smarter pub quizzes with Quizzer |
| **Hero intro** | Bring more people through the door with organised, engaging quiz nights powered by Quizzer. |
| **Benefits** | (4 items) Increase midweek footfall; Simplify quiz hosting; Engage customers with live scoring; Build a loyal quiz night crowd. (Bodies are pre-filled in the schema.) |
| **FAQ section intro title** | FAQ for hosts |
| **Bottom CTA title** | Interested in hosting a quiz night with Quizzer? |
| **Bottom CTA copy** | Find a Quiz |
| **Contact section title** | Get in touch |
| **Contact section copy** | Tell us about your venue and quiz night. We’ll get back to you with next steps. |
| **SEO title** | (optional) |
| **SEO description** | (optional) |

---

## 4. Cities (5 documents)

Create **one document per city**. The **slug** must be exactly as below (lowercase, no spaces). Use **Generate** from the city name, then set the slug to match.

| City name | Slug (required) |
|-----------|------------------|
| London | london |
| Birmingham | birmingham |
| Manchester | manchester |
| Glasgow | glasgow |
| Edinburgh | edinburgh |

**Recommended pattern** (use for each city; replace “[City]” and “[city]” with the actual name):

| Field | Example (London) |
|-------|-------------------|
| **City name** | London |
| **Slug** | london |
| **Hero title** | Pub Quizzes in London |
| **Hero intro** | London has one of the most exciting pub quiz scenes in the UK. Quizzer helps you discover quiz nights across the capital, from relaxed neighbourhood trivia to competitive team battles. |
| **Why use Quizzer section title** | Why use Quizzer in London? |
| **Why use Quizzer cards** | (3 cards) e.g. “See what’s on” / “Play on your phone” / “Never miss a night” with short body copy. For London you could use: “Track your scores, discover new venues and compete with teams across London.” |
| **Popular quiz nights intro** | Here are some of the most popular quiz nights happening in London. |
| **SEO title** | Pub Quizzes in London \| Quizzer |
| **SEO description** | Find pub quizzes in London, explore quiz nights near you and plan your next team night out with Quizzer. |

Repeat the same pattern for **Birmingham**, **Manchester**, **Glasgow**, and **Edinburgh**, adjusting city name, slug, and copy for each.

---

## 5. FAQs

Create one **FAQ** document per row below. Set **Category** and **Order** as shown. Order: lower number = higher on the page.

| Question | Answer | Category | Order |
|----------|--------|----------|-------|
| How do I find a pub quiz near me? | Use Quizzer to browse quiz nights by city and discover venues hosting pub quizzes near you. | general | 0 |
| Do I need the app to play? | Some venues allow walk-in teams, but the Quizzer app gives you the full experience including live scoring and leaderboards. | players | 10 |
| Is every quiz free to enter? | No. Entry fees vary by venue, so always check the quiz listing before attending. | players | 20 |
| How does Quizzer help venues? | Quizzer helps venues run organised quiz nights that attract players and create a better experience for customers. | hosts | 0 |
| Can I host a quiz at my pub? | Yes. If you run a venue and want to host quiz nights through Quizzer, use the Host a Quiz page to get started. | hosts | 10 |

- **General** and **Players** FAQs appear only on **/faq**.
- **Hosts** FAQs appear on **/faq** and on the **Host a Quiz** page.

---

## Environment variables

In `apps/website/.env.local`:

- `NEXT_PUBLIC_SANITY_PROJECT_ID` – from [sanity.io/manage](https://sanity.io/manage)
- `NEXT_PUBLIC_SANITY_DATASET` – usually `production`
- `NEXT_PUBLIC_SANITY_API_VERSION` – optional, e.g. `2024-01-01`

---

## What the frontend uses

| Page / area | Sanity content | Fallback if missing |
|-------------|----------------|---------------------|
| **Layout** (header, footer, default SEO) | Site Settings | Hardcoded “Quizzer”, default tagline and meta |
| **/** (home) | Home page + FAQs (preview) | Default hero, stats, features, CTA, FAQ list in code |
| **/host-a-quiz** | Host page + FAQs (category: hosts) | Default hero, benefits, FAQ list in code |
| **/faq** | All FAQs | Default FAQ list in code |
| **/find-a-quiz/[city]** | City by slug | Static city name/description from app data |
| **/contact-us** | Site Settings (contact email) | hello@quizzer.app |

Quiz listings on **/find-a-quiz** and **/find-a-quiz/[city]** always come from the app (mock data or future Supabase), not from Sanity.
