# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**I can eat (icaneat)** — a restaurant review/discovery service. The repository currently contains only the landing page (pre-launch email signup) plus the product docs that define it. No backend, build tooling, or app code exists yet.

- `icaneat_PRD.md` — product definition, feature roadmap (Phase 1–3), and the landing page section spec. Treat this as the source of truth for scope and copy direction.
- `icaneat_design.md` — visual/design system: mood (미니멀, Setlog-inspired), color rules, typography, layout references (Setlog for tone, Airbnb for card grids).
- `index.html` — the landing page itself, implemented per the two docs above.

When asked to change the landing page's copy, sections, or visuals, check `icaneat_PRD.md` and `icaneat_design.md` first — they encode decisions (section order, color/time-of-day logic, tone) that shouldn't be silently overridden.

## Running / previewing

`index.html` is a single self-contained static file (inline CSS + JS, Pretendard font loaded from a CDN `<link>`). There is no build step.

To preview with live reload of extension-based tooling (e.g. browser automation), serve it over HTTP rather than opening via `file://`:
```
npx --yes serve -l 8765 .
```
then open `http://localhost:8765/index.html`. (No Python is installed in this environment, so `python -m http.server` will not work — use the `npx serve` approach instead.)

There are no tests, linter, or build/deploy commands configured in this repo.

## Landing page architecture (`index.html`)

Everything lives in one file, structured as:

1. **CSS custom properties on `:root`** define the design tokens (`--bg`, `--text`, `--accent`, `--accent-soft`, `--accent-strong`, `--neutral`, radii). A second block under `html[data-daypart="dinner"]` overrides the `--accent*` tokens.
2. **Time-of-day accent switching**: a small inline `<script>` at the bottom checks `new Date().getHours()` on load and sets `data-daypart="lunch"` (06:00–17:00, pale orange) or `"dinner"` (17:00–06:00, pale sky blue) on `<html>`. All accent colors flow from this one attribute — don't hardcode orange/blue elsewhere.
3. **Sections**, in this fixed order (per PRD §4): Hero → 핵심 가치(3 value cards) → 기능 미리보기(icon+text feature grid, no real screenshots — icons stand in for product UI) → CTA(email-only signup form, client-side validation only, no backend) → FAQ(accordion) → Footer.
4. **Interaction JS** (also inline, bottom of file): FAQ accordion open/close, email regex validation + success/error message state on the CTA form, and an `IntersectionObserver`-driven `.reveal` fade-in for section entrances (falls back to instantly visible if `IntersectionObserver` is unsupported).

The CTA form has no server integration by design — it's a front-end-only placeholder (validates + shows a success message, does not persist or send the email anywhere). Don't wire up real submission without an explicit product decision, since Supabase/backend choices are still open per the PRD roadmap.

## Design constraints to preserve

- Background stays white/off-white regardless of time of day — only the accent (buttons, tags, icon chips, hero blob) switches between the lunch/dinner tones.
- Keep saturation low/pastel on accent colors and avoid adding a third brand color — the PRD explicitly limits the palette to the two time-based accents.
- Avoid heavy shadows/gradients or aggressive motion — the design doc calls for restrained, minimal micro-interactions (Setlog reference), not flashy ones.
- Feature-preview cards use icon + short text, not screenshots (product has no real UI yet).
