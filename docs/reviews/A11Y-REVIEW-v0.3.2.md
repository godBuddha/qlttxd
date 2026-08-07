# A11Y REVIEW — QLTTXD v0.3.2 (WCAG 2.1 AA)

Date: 2026-08-06 · Reviewer: coder · Scope: `app/frontend/src` + `styles.css`
Evidence: source inspection of all 27 .jsx modules + styles.css; `npm test` 41/41 PASS.
Screenshots evaluated by source/structure: `docs/screenshots/v0.3.2/*.png` (32 images, all actors).

Method: static code review for WCAG 2.1 AA success criteria. Findings are evidence-based with
exact file:line references and actionable test recommendations. No source files were modified.

---

## Severity legend
- **CRIT** = automatic violation of a WCAG A criterion (keyboard / SR / focus)
- **HIGH** = AA criterion violation or functionally blocking for a keyboard/SR user
- **MED** = affects usability/comprehension, not a hard criterion fail
- **LOW** = polish / consistency / best practice
- **GOOD** = compliant pattern worth preserving

---

## A. Critical & High findings

### A1. CRIT — Modals are not ARIA dialogs; no focus trap / focus management / Escape (WCAG 2.4.3, 2.1.2, 4.1.2)
4 modals/sheets are all `<div class="modal-overlay">` + `<div class="modal">` with **no**
`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, no focus moved on open, **no focus trap**
(background stays tabbable), and **no Escape-to-close**:
- `src/admin/AdminUsersPage.jsx:134-196` (user create/edit)
- `src/admin/AdminCatalogPage.jsx:420-…` + `CatalogModal` (catalog editor)
- `src/admin/AdminLocationsPage.jsx:265-343` (district/ward editor)
- `src/pages/OfficerReportsPage.jsx:129-220` (report detail)

Impact: a keyboard user who opens any modal can Tab into background content; focus is never
moved into the dialog; the only escapes are clicking the overlay (opacity-reliant) or a cancel
button. Screen-reader users are not told a dialog opened.
Evidence: `grep` → **0** `role="dialog"`, **0** `aria-modal`, **0** `.focus()` across `src/`.

### A2. CRIT — Lightbox is not a dialog and its controls have no accessible names (WCAG 4.1.2, 2.1.1, 1.3.1)
`src/pages/CaseDetail.jsx:219-250` (EvidenceGallery):
- `.lightbox-overlay` is a plain `div` — no `role="dialog"`, no `aria-modal`, no label, **no focus trap**.
- Close (`×`, :221), prev (`‹`, :224), next (`›`, :239) buttons have **no `aria-label`** → SR reads a bare glyph or nothing.
- Focus is never moved into the lightbox; the ArrowLeft/Right/Escape handler (`:189-197`) only works if focus is already inside the page and Tab cycles behind the overlay.
- Thumbnails that open it (`<img onClick>` at `CaseDetail.jsx:209-217` via `EvidenceImage.jsx:45`) are **not keyboard-activatable** (no `role`/`tabIndex`).

### A3. HIGH — Click-only interactive elements are not keyboard-operable (WCAG 2.1.1)
Elements using `onClick` (or tr click) without native button semantics, `tabIndex`, or key handler:
- `src/admin/AdminRolesPage.jsx:56-65` `.role-list li` role selection — cursor:pointer, keyboard users cannot select a role.
- `src/admin/AdminLocationsPage.jsx:162-170` whole `<tr>` district selection (cursor:pointer, inline bg highlight) — not focusable; only the inner Sửa/Xóa buttons (with `stopPropagation`) are reachable.
- `src/components/BellNotification.jsx:171-181` notification `<li>` mark-as-read on click — not focusable; also the dropdown is not keyboard-openable.
- `src/pages/CaseDetail.jsx:209-217` evidence thumbnails → lightbox (see A2).

### A4. HIGH — Tabs are buttons without the Tabs ARIA pattern (WCAG 2.1.1, 4.1.2)
- `src/pages/CaseDetail.jsx:139-151`, `src/admin/AdminCatalogPage.jsx:63-72` use `<button>` with only `onClick`/`className="active"`; no `role="tab"`, `aria-selected`, `aria-controls`, `id`, roving `tabIndex`.
- Arrow-key navigation is implemented as a **global `window` keydown listener** (`CaseDetail.jsx:30-63`) — ArrowLeft/Right changes the tab regardless of where focus is, including on unrelated buttons. Not the WAI-ARIA tabs pattern; SR announces the buttons only as "button", with no selected state.

### A5. HIGH — Map interactions/layers not keyboard-operable; `aria-label` on plain div is inert (WCAG 2.1.1, 1.1.1, 1.4.1)
- `src/components/MapView.jsx:68` and `src/pages/BanDoPage.jsx:84-89`: `aria-label` sits on a `<div>` with no `role` → ignored by screen readers (a generic div has no accessible name role). Needs `role="img"`/`role="application"` + off-screen/fallback text.
- Markers (`MapView.jsx:39-45`, `BanDoPage.jsx:58-67`) are `L.circleMarker` — not focusable, not announced; popups (`bindPopup`) only reachable by clicking (A3).
- **Functional blocker:** `src/pages/CitizenPage.jsx:110` the citizen report form **requires** clicking the map to set coordinates (`onPick` at `MapView.jsx:22-23`; binary check `!point → notify('Vui lòng chọn vị trí…')` at `:64`). A keyboard-only citizen **cannot submit a report**. Must provide keyboard coordinate entry / address autocomplete fallback.

---

## B. Medium findings

### B1. HIGH — Landing logo `div role="button" tabIndex="0"` has no key handler (WCAG 2.1.1)
`src/main.jsx:198-205`: the QLTTXD logo is made focusable (`tabIndex="0"`, `role="button"`) but has **no `onKeyDown`** — focus lands on it and Enter/Space do nothing. Either add key handling or use a real button/link.

### B2. MED — No skip-to-content link / focus management on route change (WCAG 2.4.1 Bypass Blocks)
All navigation uses `<header>`/`<aside>` `<button>`s; no `<a class="skip-link">`, and focus is not moved to `<main class="content">` after `nav()` (`main.jsx:326`). Keyboard users re-Tab through the full sidebar on every page change.

### B3. MED — Color-only differentiation unsupported (WCAG 1.4.1)
- Map markers colored purely by status (`BanDoPage.jsx:42-54` colorMap; status only in the click-required popup) — color-blind/unable-to-click users cannot read status.
- Dashboard `Chart` bars (`src/components/Status.jsx:19-31`) use width + color, but each row also has the label text and numeric value, so data is present; **non-color** cue for current/active tab (`border-bottom` on `.tabs .active`, styles.css) is fine. Only the map fails outright.

### B4. MED — Form/notice announcements
- `Notice` (`src/components/Notice.jsx:4-8`) uses `aria-live="polite"` + `role="status/alert"` — **GOOD**; used for page-level toasts in main.jsx:327, pagination etc.
- But inline validation errors shown as `.field-error` are **not** `aria-live`: `src/components/Login.jsx:54`, `src/components/ForgotPassword.jsx:63,130`. SR users won't be told their login/reset failed.

### B5. MED — Loading & image placeholders
- `Loading` (`src/components/Loading.jsx`) renders static text "Đang tải dữ liệu…" — not `aria-live`; SR may not announce async loads.
- `EvidenceImage` renders `<span aria-hidden="true">` while loading/error (`src/components/EvidenceImage.jsx:43`) — SR hears nothing during image load; acceptable, but an `alt`-carrying live region would be better.

### B6. MED — Color contrast
- **Fail:** `.bell-list li small { color:#98a2b3 }` on white (`src/styles.css:97`) ≈ 2.8:1 — notification timestamps below AA (small text needs ≥4.5:1).
- `.empty #667085`, `.coordinate/.hint #667085` on white ≈ 4.6:1 — passes normal text (borderline, avoid smaller).
- Header `#104d92` with `#cfe2ff` small (`styles.css:32`) passes.
- Badges use text labels with distinct bg/fg pairs — **GOOD**.

### B7. LOW — Motion & dark mode
- No `@media (prefers-reduced-motion)`: `.evidence-img` `transition` + hover `scale(1.03)` (`src/styles.css:70-71`), `.role-list li:hover` bg. Harm-reduction gap (WCAG 2.2.2 not strictly violated — no auto-playing/seizure content).
- No dark mode / theme switching (not a WCAG requirement). Review item only.

### B8. LOW — Tables lack `<caption>` and `<th scope>`
All tables (e.g. `CaseList.jsx:103-142`, `AdminUsersPage.jsx:101-130`, `AdminLocationsPage.jsx:151-205`, `AdminAuditLogPage.jsx:65-110`, `OfficerReportsPage.jsx:58-125`, `CitizenPage.jsx:8-37`) have proper `thead/th/tbody` and empty-row `colSpan` (**GOOD**) but no `<caption>`, and header `<th>` have no `scope="col"` — minor SR ambiguity.

---

## C. Design tokens & component consistency

### GOOD
- Design tokens centralized in `:root` (`src/styles.css:1-29`): primary/neutral/status colors, radius, spacing, sidebar width. Single shared stylesheet; consistent `.panel`, `.stat`, `.badge`, `.notice`, `.field-error`, `.empty`.
- Touch targets: `button, input, select, textarea { min-height:44px }` (`styles.css:30`), body `min-width:320px`.
- Inputs: `input:focus, select:focus, textarea:focus` outline (`styles.css:36`), `:hover` states on nav/rows.
- Buttons disabled state (`button:disabled` opacity) — `styles.css:30`.
- Responsive: breakpoints at 1000px (`:98`) and 767px (`:99`); `.two-col/.detail-grid`, `.form-grid/.filters/.report-filters`, `.stat-grid/`.chart-grid`, modal-as-bottom-sheet (`place-items:end center`), tab overflow-x — solid mobile coverage.
- Print styles (`:100-108`) hide nav/buttons, keep content — **GOOD**.
- Semantic richness: `<fieldset>`+`<legend>` (login/catalog/decision/remedy), `<dl>` (case/report detail), `<ol>` timeline — **GOOD**.
- Label association: all inputs wrapped in `<label>` (implicit), login uses `autoComplete`/`required` — **GOOD**.
- Permission gating via `can()` hides unauthorized nav — **GOOD**; empty/loading/error states present on every list page.

### WEAKNESS
- **No shared Modal/Dialog/Tabs/Table components** — 4 duplicate modal implementations (A1), 2 duplicate tab bars (A4), 6 near-identical tables. Any a11y fix must be applied 4× unless a shared `Modal`/`Tabs` component is introduced.
- **Inline styles bypass the token system**: hard-coded hex/gaps/margins in `AdminCatalogPage.jsx:76-86,110-116,145-170,493-500`, `AdminLocationsPage.jsx:166-169,266-269`, `OfficerReportsPage.jsx:77-85,130`, `Dashboard.jsx:24`, `CaseDetail.jsx:107` → inconsistent, non-tokenized layout (spacing has no `--space-*` tokens; only colors/borders are tokenized).

---

## D. Test status & recommendations

Current: `npm test` → **41/41 PASS** (vitest). Coverage: Login, Loading, Status, BellNotification, constants, api. **No axe, no keyboard tests, no dialog/tab assertions, no reduced-motion or contrast checks.** Playwright e2e exists (`app/frontend/e2e/*.spec.js`) but contains no accessibility assertions; `@axe-core` is not installed.

### Recommended tests (in priority order)
1. **Automated axe-core over every route** (CRIT) — add `axe-core` (= ~each actor/page). Gate on `violations.length === 0`. Covers A1 (dialog role), A2 (button names), A4 (tab pattern), B1, B3 partially.
2. **Keyboard e2e for modals** — open each modal, assert focus enters the dialog, Tab cycles inside only, Escape closes and returns focus to trigger. (Playwright `locator.focus()` + key presses.) Covers A1.
3. **Keyboard e2e for lightbox** — focus a thumbnail, Enter opens, ArrowRight/Left cycles (no focus drift), Escape closes. Covers A2.
4. **Keyboard e2e for click-only controls** — role-list selection, tr selection, bell notification, logo link. Covers A3/B1.
5. **Contrast unit test** — assert fg/bg pairs on all roles hit ≥4.5:1 (esp. `.bell-list small` #98a2b3). Covers B6.
6. **Tab `aria` assertions** — `role=tab`/`aria-selected` toggling. Covers A4.
7. **Reduced-motion** — assert transitions are disabled under `prefers-reduced-motion: reduce`. Covers B7.
8. **Map accessibility** — verify a visible/`aria-hidden=false` fallback (off-screen text or data table) exists and the citizen form is submittable without pointer. Covers A5.

### Screenshots
`docs/screenshots/v0.3.2/*.png` (32) cover all actors (citizen, verifier, handler, leader, admin) + mobile (30-32). They are structural evidence only; static renders cannot prove keyboard/focus/SR behavior — pair them with the automated tests above.

---

## Summary tally
| Severity | # | Items |
|---|---|---|
| CRIT | 2 | A1 modals, A2 lightbox |
| HIGH | 4 | A3 click-only controls, A4 tabs, A5 maps/login-blocker, B1 logo |
| MED | 6 | B2 skip/focus, B3 color-only maps, B4 field-error a11y, B5 loading SR, B6 contrast, B7 motion/dark |
| LOW | 2 | B8 caption/scope, C inline styles/token gaps |

**Top 3 to fix first:** (1) shared accessible `Modal` component (role=dialog + focus trap + Escape) — fixes 4 dialogs + lightbox; (2) keyboard support for role-list/tr/li/thumbnail click targets; (3) map `role` + non-pointer coordinate entry for the citizen form.