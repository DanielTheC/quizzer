# Quizzer Design System

Bold, graphic, poster-style design system for **Quizzer** — a pub-quiz discovery app and website based in the UK.

**Style:** Neo-brutalist — "gig poster meets British pub." Flat fills, thick black linework, a handful of loud accent colours, hard-offset black shadows that look like stickers pressed onto the page. No gradients, no soft UI, no glass. It should feel printed.

---

## Colour palette

| Token | Hex | Use |
|---|---|---|
| Yellow | `#FFD400` | Hero colour. Primary CTA, accent stripes, brand mark, active states |
| Black | `#000000` | Borders, shadows, primary text |
| White | `#FFFFFF` | Card backgrounds, inverse text |
| Cream | `#FFF8D6` | Page/section backgrounds — signals "different" without going grey |
| Pink | `#FF4F93` | Secondary action CTA ("Host a Quiz"), info-field rail |
| Green | `#00D26A` | Success, confirmed states, "what to expect" |
| Orange | `#FF8A00` | Tonight mode, warnings |
| Red | `#FF4D4D` | Danger, destructive actions, filled saved heart |
| Blue | `#3B82F6` | Location, maps, directions, distance sort accent |
| Purple | `#7C3AED` | Nearby toolbar accent CTA only — don't use elsewhere |
| Grey 100 | `#F5F5F5` | Subtle backgrounds |
| Grey 200 | `#EAEAEA` | Dividers |
| Grey 400 | `#BDBDBD` | Disabled states |
| Grey 700 | `#4F4F4F` | Secondary text, app shadow colour |

### Quiz Detail field tints (app)

| Panel | Background | Rail colour | Eyebrow ink | Purpose |
|---|---|---|---|---|
| Hero ticket | `#FFE8B3` | — | — | When / where / price |
| Location | `#CFE6FF` | Blue `#3B82F6` | `#1E40AF` | Address, maps |
| Info / rules | `#FFDCEE` | Pink `#FF4F93` | `#9D174D` | What to expect |
| Turn-up | `#C5F0DC` | Green `#00D26A` | `#047857` | Arrival guidance |

### Dark mode (app only)

Same accents, deeper ink backgrounds, lighter cream text. Key overrides:

| Token | Light | Dark |
|---|---|---|
| `bgPrimary` | `#FFFFFF` | `#1c1b19` |
| `bgSecondary` | `#FFF8D6` | `#121110` |
| `textPrimary` | `#000000` | `#F4F1EA` |
| `textSecondary` | `#4F4F4F` | `#A8A29E` |
| `borderPrimary` | `#000000` | `#E7DFD0` |

Yellow `#FFD400` is the same in both modes.

---

## Typography

**Anton 400** — the display face. Every heading, stat value, card title, nav wordmark. One weight. Never italicised. Never `font-weight: bold`. `letter-spacing: -0.01em` keeps it tight.

**Inter 400/500/600/700/800** (web) / **System SF/Roboto** (native) — body, buttons, chips, micro-labels. 800 is reserved for uppercase micro-labels on pills.

**Hierarchy:** large Anton heading → 16–17px body → 11–13px uppercase micro-label on pills. Never stack two Anton sizes in the same row.

### App type scale

| Name | Size | Weight | Font |
|---|---|---|---|
| `displayLarge` | 29px | 400 | Anton |
| `displayMedium` | 25px | 400 | Anton |
| `displaySmall` | 21px | 400 | Anton |
| `heading` | 19px | 400 | Anton |
| `body` | 17px | 400 | System |
| `bodyStrong` | 17px | 600 | System |
| `caption` | 15px | 500 | System |
| `captionStrong` | 15px | 700 | System |
| `label` | 13px | 600 | System |
| `labelUppercase` | 13px | 700, uppercase | System |

### Web type scale (CSS vars)

| Token | Size |
|---|---|
| `--fs-display-xl` | `clamp(2.5rem, 5vw, 4rem)` — hero H1 |
| `--fs-display-lg` | `clamp(2rem, 4vw, 3rem)` — page H1 |
| `--fs-h1` | 36px |
| `--fs-h2` | 30px |
| `--fs-h3` | 20px |
| `--fs-h4` | 18px |
| `--fs-body` | 16px |
| `--fs-body-sm` | 14px |
| `--fs-caption` | 12px |
| `--fs-micro` | 11px — brutal uppercase tags |

### Casing

- **Sentence case** for most UI and body copy
- Headings in Anton read loud because of the font, not because of ALL-CAPS
- Small utility labels on chips/pills/stat badges ARE uppercase with tracking (`uppercase tracking-wide`, `letterSpacing: 0.6`)

---

## Borders

Everything is `3px solid #000`. Full stop. 1px only for the thin accent bar at the top of a native QuizCard. When it's not 3px, it's not Quizzer.

---

## Shadows (hard offset — no blur)

### App

| Name | Offset | Colour |
|---|---|---|
| `small` | 3×3 | `#4F4F4F` |
| `medium` | 5×5 | `#4F4F4F` |
| `large` | 8×8 | `#4F4F4F` |

### Website (CSS vars)

| Token | Value |
|---|---|
| `--shadow-sm` | `3px 3px 0 #000` — hover state (card "presses in") |
| `--shadow-button` | `4px 4px 0 #000` — buttons at rest |
| `--shadow-card` / `--shadow-md` | `5px 5px 0 #000` — cards at rest |
| `--shadow-lg` | `8px 8px 0 #000` — hero cards / large CTAs |

Never use blur / rgba / elevation-style shadows.

---

## Border radius

| Token | App (px) | Website |
|---|---|---|
| `--radius-sm` | 6 | 6px |
| `--radius-md` / badge | 10 | 10px |
| `--radius-button` / `--radius-card` | — | 12px |
| `--radius-lg` | 14 | 14px |
| `--radius-xl` | 18 | 18px |
| `--radius-brutal` (app QuizCards) | 22 | 22px |
| `--radius-pill` (capsule tags) | 100 | 100px |

---

## Spacing

`xs: 4 · sm: 8 · md: 12 · lg: 16 · xl: 20 · 2xl: 24` (px)

Used in both app (`theme.ts`) and website (`--space-*` vars).

---

## Motion

- **Hover press:** `transform: translate(2px, 2px)` + shadow shrinks from 4/5px → 2/3px. `150ms ease`.
- **Heart save:** reanimated spring up to ~1.3× then back to 1.
- **Admin dashboards:** `admin-fade-in-up` and `admin-toast-in` — 320–400ms `cubic-bezier(0.16, 1, 0.3, 1)`. Respects `prefers-reduced-motion: reduce`.
- No bouncing, no parallax, no continuous ambient motion.

### Press states

- **Web:** `translate(2px, 2px)` + shadow shrinks from 4/5px → 2/3px. Never alpha-fade a button.
- **Native:** `transform: [{translateY: 2}]` + `shadowOffset.width/height: 1`.

### Hover states

- Buttons: shadow shrinks + translate (as above).
- Text links: `underline` appears (never change colour).
- Ghost buttons: swap to cream background.

---

## Component patterns

### Card
- White background (or accent fill), 3px black border, `rounded-[12px]` (web) / `radius.brutal` (app), `shadow-[5px_5px_0_#000]`, `p-6`.
- Hover: shadow → 3px + translate 2px.
- App QuizCards add a 7px coloured accent stripe across the top (yellow default / orange Tonight / blue Distance).

### Button — Primary
- Yellow background, 3px black border, `radius.medium` / `12px`.
- Web: `bg-quizzer-yellow border-2 border-quizzer-black shadow-[var(--shadow-button)] hover:translate-x-[1px] hover:translate-y-[1px]`

### Button — Secondary / Outline
- White background, same border + shadow.

### Button — Destructive
- Red background (`bg-red-600`), same border + shadow.

### Pill / tag
- Yellow fill, 3px black border, `radius.pill` (100/9999px), tight padding.
- App: `playerBrutalPill` from `theme.ts`.
- Text: 10–11px, weight 800, uppercase, `letterSpacing: 0.06em`.

### Badge
- 1px black border, `radius.small`, tight padding.

### Input fields
- 3px black border, `rounded-[12px]`, `px-3 py-2`.
- Focus: `ring-2 ring-quizzer-yellow`.

---

## Backgrounds & layout

- Flat colour fields, full-bleed sections (yellow / white / cream / black rotating down the page).
- Max content width `1200px`; side padding `16px → 24px → 32px` via `Container`.
- Grid: 1 col mobile → 2 col sm → 3 col lg for feature/quiz grids.
- Sticky navbar with its own 3px bottom border.
- Native app has a subtle `PaperGrainOverlay` paper-texture over the feed — very faint dotted noise, not heavy grunge.
- No gradients. No photo washes behind headings.

---

## Transparency & blur

Used **only** for secondary text opacity — `text-quizzer-black/80`, `text-quizzer-white/60`. No backdrop-filter. No frosted glass. No fade-to-transparent gradients. The thick black border is the protection.

---

## Imagery

Photos are real venue interiors — warm, pub-lit, amber/low-light, no filters. Always sit inside a thick black border with a hard shadow, so they read as ticket-like.

---

## Iconography

**Native app:** `@expo/vector-icons` **MaterialCommunityIcons**. Key icons:
- `glass-mug-variant` — venue/pub
- `heart` / `heart-outline` — save
- `fire` — Tonight mode
- `map-search-outline`, `weather-night` — empty states
- `chevron-down`, `magnify`, `tune` — toolbar
- Sizing: 22px default; 14–18px in pills; 44px in empty states.
- Colour: always `semantic.textPrimary` or an accent hex — never a grey mid-tone.

**Website:** Very restrained. Nav toggle uses `☰` / `✕` unicode. Accordion uses `+` rotating 45°. If a new icon is needed, use **Lucide** (CDN) at `stroke-width: 2`, black stroke, 24px default.

**Emoji:** Avoid in-product. The single documented use is 📍 in native share-sheet text. Don't add more.

---

## Content & voice

**Voice:** Friendly, plain-spoken British English. Short punchy sentences. Second person (*you*) with occasional *we* when speaking as Quizzer. Reads like a pub landlord explaining something over the bar — warm, no fluff, zero corporate.

**Tone:** Enthusiastic but not shouty. Confident, clear, useful. Marketing copy leans a little cheeky ("Turn up & play", "Climb the board"). Operational copy (admin, errors) is matter-of-fact.

**Spelling:** British — *favourite*, *organise*, *colour*. Prices in pounds (`£5`, `Free`).

**Punctuation:** Oxford comma optional. En-dash ` – ` or middle-dot ` · ` to separate facts ("Tuesday · 8pm"). Ampersands in section headings ("Find & Play").

**Forbidden:** Jargon, corporate waffle ("leverage", "solutions", "seamlessly"), emoji as decoration, exclamation-mark spam.

**Example strings:**
- Hero H1: *"Find a Pub Quiz Near You"*
- Hero subhead: *"Discover quiz nights at pubs near you. Play live, climb the leaderboard, and never miss a round."*
- Feature titles: *"Find quizzes nearby"*, *"Play live quizzes"*, *"Climb the leaderboard"*
- Empty state: *"Widen filters, clear search, or check the map — your next quiz might be a street away."*
- Tonight pill: *"TONIGHT"* (all-caps micro label next to a 🔥 icon)

---

## Logo assets

All logo variants live in `apps/website/public/brand/`. The Q mark is a magnifying glass — circle + inner ring + angled handle.

| File | Description | Use |
|---|---|---|
| `quizzer-wordmark.svg` | "QUIZZER" in Anton with pink underline bar (1200×400) | Website header, marketing, social banners |
| `quizzer-app-icon-ios.svg` | Yellow rounded square with Q mark (1024×1024) | iOS App Store icon, Android adaptive icon |
| `quizzer-mark-yellow.svg` | Black Q mark on yellow background (1024×1024) | Default brand mark, social avatar |
| `quizzer-mark-black.svg` | Yellow Q mark on black background (1024×1024) | Dark backgrounds, dark mode contexts |
| `quizzer-mark-mono-black.svg` | Black Q mark on white background (1024×1024) | Print, monochrome contexts |
| `quizzer-mark-mono-white.svg` | White Q mark on black background (1024×1024) | Reversed monochrome, dark print |

Favicons (`/favicon.svg`, `/apple-touch-icon.svg`) are separate smaller versions in `public/`.

---

## Source files

| File | Platform | Purpose |
|---|---|---|
| `apps/app/src/theme.ts` | Mobile (React Native) | All native design tokens |
| `apps/website/src/styles/globals.css` | Website (Tailwind v4) | Web tokens + utilities |
| `apps/app/src/components/QuizCard.tsx` | Mobile | Canonical card component |
| `apps/app/src/components/ScreenTitle.tsx` | Mobile | Screen heading component |
| `apps/app/src/lib/heartPressAnimation.ts` | Mobile | Heart spring constants |
