# Doctor Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the doctor-side visual experience so it reads like a stable hospital back-office product while preserving existing functions, data, navigation, and workflows.

**Architecture:** Keep all business logic and page IA in `src/features/doctor/doctor-view.tsx`. Add a doctor-scoped root class and styling hooks, then implement scoped theme refinements in `src/index.css` so admin and expert surfaces are not changed. Verification uses existing behavior tests plus browser checks for desktop and mobile overflow.

**Tech Stack:** React 19, Vite, Tailwind CSS v4, shadcn-style local UI primitives, lucide-react, Vitest, oxlint.

---

### Task 1: Scope Doctor Visual Styling

**Files:**
- Modify: `src/features/doctor/doctor-view.tsx`

- [ ] **Step 1: Add a root doctor styling class**

Change the `DoctorView` root container from:

```tsx
<div className="grid min-h-[calc(100svh-9rem)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
```

to:

```tsx
<div className="doctor-console grid min-h-[calc(100svh-9rem)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
```

- [ ] **Step 2: Add consistent styling hooks without changing content**

Add these class hooks to existing containers:

```tsx
<aside className="doctor-sidebar rounded-xl border bg-card p-3 shadow-sm lg:sticky lg:top-28 lg:h-[calc(100svh-8rem)] lg:overflow-y-auto">
<main className="doctor-main min-w-0">
<div className="doctor-page flex flex-col gap-4">
<section className="doctor-split-layout grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
```

Use `doctor-page` on each top-level page wrapper in Workbench, Cases, Messages, PostCare, and Settings. Use `doctor-split-layout` on the two-column sections in Cases, Messages, and PostCare.

- [ ] **Step 3: Run focused tests**

Run:

```bash
npm run test:run -- src/features/doctor/doctor-view.test.tsx
```

Expected: all doctor tests pass.

### Task 2: Add Doctor-Scoped Visual System

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add doctor-scoped tokens and shared component polish**

Append CSS scoped under `.doctor-console`:

```css
.doctor-console {
    --doctor-surface: color-mix(in oklch, var(--card), var(--background) 10%);
    --doctor-soft: color-mix(in oklch, var(--secondary), white 34%);
    --doctor-line: color-mix(in oklch, var(--border), var(--primary) 8%);
    --doctor-hover: color-mix(in oklch, var(--secondary), white 42%);
    --doctor-selected: color-mix(in oklch, var(--primary), white 91%);
    --doctor-shadow: 0 14px 30px -26px color-mix(in oklch, var(--foreground), transparent 56%);
}

.doctor-console [data-slot="card"] {
    border-color: var(--doctor-line);
    background: color-mix(in oklch, var(--card), white 4%);
    box-shadow: var(--doctor-shadow);
}
```

- [ ] **Step 2: Add list, metric, status, form, and responsive polish**

Add scoped rules for:

```css
.doctor-sidebar
.doctor-main
.doctor-page > h2
.doctor-split-layout
.doctor-console [data-slot="button"]
.doctor-console [data-slot="badge"]
.doctor-console [data-slot="input"],
.doctor-console [data-slot="textarea"],
.doctor-console [data-slot="select-trigger"]
.doctor-card-row
.doctor-list-item
.doctor-metric-card
.doctor-info-box
```

Keep values restrained and aligned with the existing admin theme.

- [ ] **Step 3: Preserve reduced motion**

Add:

```css
@media (prefers-reduced-motion: reduce) {
    .doctor-console *,
    .doctor-console *::before,
    .doctor-console *::after {
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
    }
}
```

### Task 3: Apply Shared Hooks to Repeated Doctor Elements

**Files:**
- Modify: `src/features/doctor/doctor-view.tsx`

- [ ] **Step 1: Apply row hooks to repeated list and card-like items**

Add `doctor-list-item` to repeated clickable rows and list rows:

```tsx
className={cn("doctor-list-item rounded-lg border p-3 text-left transition hover:bg-muted/60", ...)}
```

Add `doctor-card-row` to non-clickable inner bordered rows:

```tsx
className="doctor-card-row rounded-lg border p-3"
```

- [ ] **Step 2: Apply specialized hooks to helper components**

Update helper wrappers:

```tsx
<div className="doctor-metric-card flex items-center justify-between gap-3 rounded-lg border p-3">
<div className="doctor-info-box rounded-lg border p-3">
```

- [ ] **Step 3: Keep labels and actions unchanged**

Do not add, remove, rename, or reorder visible strings, nav entries, buttons, filters, statuses, test ids, or dispatch calls.

### Task 4: Verify and Polish in Browser

**Files:**
- No planned source changes unless browser audit finds visual defects.

- [ ] **Step 1: Run code checks**

Run:

```bash
npm run test:run
npm run lint
npm run build
```

Expected: tests, lint, and build pass. Existing Vite large chunk warning may remain.

- [ ] **Step 2: Browser verify desktop**

Open `http://127.0.0.1:5177/doctor`. Check Workbench, 会诊单管理, 诊后管理, 消息中心, 我的设置. Confirm no horizontal overflow, no button or label collision, no text unreadability, and all current menu entries remain.

- [ ] **Step 3: Browser verify mobile**

Set viewport to 390x844 and reload `http://127.0.0.1:5177/doctor`. Confirm no horizontal overflow, buttons remain inside containers, and list/card content stacks cleanly.

- [ ] **Step 4: Polish any visual issues**

If browser checks show cramped actions, clipped labels, inconsistent card density, or weak contrast, adjust only scoped doctor visual CSS/classes and rerun checks.
