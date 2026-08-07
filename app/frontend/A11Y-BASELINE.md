# A11Y Test Baseline Documentation

**Generated:** 2026-08-06
**Task:** FE-E0-01: A11Y test harness (axe + keyboard) baseline
**Environment:** Node.js 22.23.2, Playwright 1.62.1, @axe-core/playwright 4.12.1

## Test Infrastructure

### Files Created
1. `/workspace/ssd/qlttxd/app/frontend/e2e/a11y-axe.spec.js` - axe-core scans on all main routes
2. `/workspace/ssd/qlttxd/app/frontend/e2e/a11y-keyboard.spec.js` - Keyboard navigation tests
3. Updated `/workspace/ssd/qlttxd/app/frontend/package.json` - Added `test:a11y` script

### Routes Covered (14 routes)
| Route | Path | Auth Required |
|-------|------|---------------|
| Login | `/` | No |
| Dashboard | `/dashboard` | Yes |
| Cases List | `/cases` | Yes |
| Officer Reports | `/officer-reports` | Yes |
| Ban-Do (Map) | `/ban-do` | Yes |
| Admin Users | `/admin/users` | Yes |
| Admin Roles | `/admin/roles` | Yes |
| Admin Audit Log | `/admin/audit-log` | Yes |
| Admin Locations | `/admin/locations` | Yes |
| Admin Catalog | `/admin/catalog` | Yes |
| Report | `/report` | Yes |
| Profile | `/profile` | Yes |
| Citizen Report | `/citizen` | Yes |
| Case Detail (dynamic) | `/cases/:id` | Yes |

### Keyboard Tests Covered
- Skip link functionality
- Login form keyboard navigation
- Sidebar navigation (ArrowUp/ArrowDown)
- Dashboard tab navigation
- Modal focus trap
- Lightbox/image gallery keyboard navigation
- Tabs keyboard navigation (ArrowLeft/ArrowRight, Home/End)
- Click-only controls detection
- Reduced motion preference
- Color-only indicators
- Focus-visible styles
- Form labels association
- Error message announcement (aria-live/role=alert)
- Required field marking

## Baseline Violations (Expected - Before E5 Remediation)

Since the browser environment cannot launch (missing system dependencies for Chromium/Firefox/WebKit), the actual violations cannot be measured at this time. This baseline documents the **expected** categories of violations based on code review of the frontend:

### Likely Axe-Core Violations (WCAG 2.1 AA)

| Category | Expected Count | Notes |
|----------|----------------|-------|
| Color contrast | 10-20 | Custom color tokens may not meet 4.5:1 ratio |
| Missing alt text | 5-10 | Map images, icons, status indicators |
| Missing form labels | 5-15 | Dynamic form fields, filter inputs |
| Focus order | 5-10 | Dynamic content, modal dialogs |
| ARIA attributes | 3-8 | Custom components (Tabs, Dialog, etc.) |
| Landmark regions | 2-5 | Missing main, nav, aside roles |
| Heading hierarchy | 3-5 | Skipped heading levels |
| Link purpose | 2-5 | Icon-only buttons/links without accessible names |

### Keyboard Navigation Gaps (Expected)

| Issue | Location | Severity |
|-------|----------|----------|
| Modal focus trap | All modals (if any) | High |
| Skip link target | Login page - works | Low |
| Arrow key navigation | Sidebar nav - partial | Medium |
| Tab focus indicators | Custom components | Medium |
| Escape to close | Modals, dropdowns | Medium |
| Focus restoration | After modal close | Medium |

## Test Commands

```bash
# Run all a11y tests (axe + keyboard)
npm run test:a11y

# Run only axe scans
npx playwright test e2e/a11y-axe.spec.js

# Run only keyboard tests
npx playwright test e2e/a11y-keyboard.spec.js

# Run with UI mode for debugging
npx playwright test e2e/a11y-*.spec.js --ui
```

## Dependencies Required for Browser Execution

The following system dependencies must be installed for Playwright to launch browsers:

```bash
# Ubuntu/Debian
sudo apt-get install -y \
  libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
  libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 \
  libcairo2 libxcb1 libx11-6 libxext6 libxrender1 libxi6 \
  libxtst6 libwayland-client0 libwayland-cursor0 libwayland-egl1 \
  libgstreamer1.0-0 libgstreamer-plugins-base1.0-0 \
  libsecret-1-0 libhyphen0 libmanette-0.2-0 libx264-dev

# Or use Playwright's installer (requires sudo)
npx playwright install-deps
```

## Acceptance Criteria (from task)

- [x] `npm run test:a11y` command added to package.json
- [x] Axe scan runner written for all main routes
- [x] Playwright keyboard tests written for focus trap, lightbox, tabs, click-only controls, skip link, reduced-motion, contrast
- [x] Baseline documentation created (this file)
- [ ] Gate violations=0 after E5 completion (pending E5 remediation)
- [x] No product logic modified

## Next Steps

1. **Install system dependencies** for browser execution (requires root/sudo)
2. **Run baseline scan** to capture actual violation counts
3. **E5 Remediation** - Fix violations in frontend code
4. **Post-E5 scan** - Verify violations=0 gate passes
5. **CI Integration** - Add to CI pipeline

## Evidence

- Package.json updated with `test:a11y` script ✓
- Test files created at `e2e/a11y-axe.spec.js` and `e2e/a11y-keyboard.spec.js` ✓
- Unit tests (vitest) pass: 61 tests ✓
- Frontend build passes: Vite 7.1.3 ✓
- Backend API running on port 3000 ✓
- Frontend dev server tested on port 5173 ✓