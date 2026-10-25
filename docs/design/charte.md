# REGLO design charter (web app)

Source: REGLO charter 2026 (PDF) + design system https://claude.ai/artifact/QnA1SzQJQEgK9M3KEidUmG.
Tagline: "Humain en mouvement vers l'avenir". Items marked DERIVED are not in the charter: to validate by the DAs.

## Rules for the UI (humans and Claude Code)
1. Use only Tailwind theme tokens from `web/src/app/theme.css`. Never hard-code colours.
2. Body text is `text-ink` on white / `bg-surface-subtle`; secondary text `text-ink-muted`.
3. Never use `brand-green` (3.4:1), `brand-blue` or `brand-yellow` as text on white. Green text = `green-700`. Blue and yellow are fills with `text-brand-teal`.
4. Primary button: `bg-brand-teal text-white`. Highlight button: `bg-brand-yellow text-brand-teal`.
5. Domain colours: quality = teal, hygiene = blue, safety = yellow, environment = green (to confirm). Use for chips, tab underlines, chart series. A state always has a word or icon.
   Domain icons are drawn entirely in the domain colour (decorative: the label is always next to them).
   Buttons and links are flat: bordered at rest when secondary, very light green (`green-50`) on hover. No inner shadow.
   Text links use the `link-underline` utility (`globals.css`): the underline draws from left to right on hover and keyboard focus. DERIVED.
   Standalone small links (footer, navigation) have no underline: `rounded-md px-1 py-1`, `green-50` background on hover. DERIVED.
6. Font: Outfit for all UI text (`font-sans`, self-hosted with `next/font`). FinalSix only for display titles (`font-display`). Its licence is not confirmed yet: the file stays local in `web/public/fonts/final-six/` (git-ignored) and titles fall back to Outfit without it.
7. Controls >= 40px high (WCAG 2.2 AA asks 24px), input border `border-border-strong` (on focus: `green-600` border and a soft `brand-green` halo, DERIVED), visible focus ring, mobile first. Small radii (4 / 8 / 12 / 16px), no pill shapes on controls.
8. UI copy in French (sentence case, "vous"); code and keys in English (`quality`, `hygiene`, `safety`, `environment`).
9. Logos in `web/public/brand/` (primary logo by default on white; never recolour). Only the symbol (`reglo-symbol.png`) is available for now; the wordmark is written as text until the full logo is delivered. Favicon: `web/src/app/icon.png` and `apple-icon.png`.

## Contrast checked (WCAG)
teal/white 11.8; green-700/white 6.0; blue-700/white 6.6; ink-muted/white 6.2; teal on blue 7.2; teal on yellow 9.1; white on teal 11.8.

## UX principles (reference: Shopify admin)
1. **Fluid navigation**: client-side routing (Next.js `<Link>`), no full reloads. Use `loading.tsx` / Suspense skeletons, never a blank page.
2. **Top loading bar** on every page change (thin 3px bar, `brand-green`, fixed at top, e.g. `nextjs-toploader`).
3. **Sidebar** (collapsible on mobile): one entry per section, each with a 20px outline icon (Lucide) + label. Active entry: `bg-green-50`, `text-ink`, icon in `green-700`.
4. **Breadcrumb** on every page below the top level: `[icon] Section / [icon] Page / Detail`, each item a link with its page icon, last item not clickable, text `ink-muted`, separator `/`.
5. **Page header**: title (h1), short description, primary action on the right (one `btn-primary` only).
6. **Lists**: table with search, filters as chips, sortable columns, row click opens detail; empty state with an illustration-free message + one action.
7. **Feedback**: toast after save (bottom, 4s), skeletons while loading, inline errors on forms, confirmation dialog before destructive actions.
8. **Density**: calm, lots of white space, white bordered cards (no shadow) on `surface-subtle`, content uses the full width next to the sidebar.
9. **Responsive**: mobile first; sidebar becomes a drawer, tables become cards under 768px.
10. **Accessibility**: keyboard navigation everywhere, visible focus, 40px targets, `aria-current="page"` on active nav and breadcrumb.
