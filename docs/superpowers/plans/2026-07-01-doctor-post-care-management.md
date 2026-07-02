# Doctor Post-Care Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the low-value doctor-side follow-up/referral placeholder with a practical post-consultation management workspace and move message notifications below it in the doctor menu.

**Architecture:** Keep the doctor console and existing demo session state. Rename the menu item to `诊后管理`, move it before `消息通知`, and rebuild the page as a queue plus detail workspace for post-consultation plans, follow-up records, referral tracking, and closure confirmation. Add focused Testing Library coverage before implementation.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, existing shadcn-style UI components, lucide-react icons.

---

### Task 1: Capture Doctor Menu And Post-Care Behavior

**Files:**
- Modify: `src/features/doctor/doctor-view.test.tsx`

- [ ] **Step 1: Write failing tests**

Assert that the doctor menu order is `工作台`, `会诊单管理`, `诊后管理`, `消息通知`, `我的设置`, and that the old `随访转诊` menu label is gone.

Assert that opening `诊后管理` shows a post-care queue with statuses such as `待制定计划`, `待随访`, `待转诊`, `观察中`, and `已闭环`.

Assert that the detail area includes `专家建议引用`, `本地诊后计划`, `随访记录`, `转诊跟踪`, and bottom actions `保存记录`, `完成本次随访`, `确认闭环`.

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
npm run test:run -- src/features/doctor/doctor-view.test.tsx
```

Expected: fail because the current page is still named `随访转诊` and only displays static suggestion cards.

### Task 2: Rebuild Doctor Post-Care Page

**Files:**
- Modify: `src/features/doctor/doctor-view.tsx`

- [ ] **Step 1: Rename and reorder menu**

Change the doctor section title from `随访转诊` to `诊后管理` and place it above `消息通知`.

- [ ] **Step 2: Add post-care sample queue**

Create local post-care sample records derived from consultation data. Include plan, follow-up, referral, observation, and closed states.

- [ ] **Step 3: Replace `FollowupPage` content**

Render a left queue and right detail panel. The detail panel should show the expert advice reference, local post-care plan, follow-up records, referral tracking, and a closure summary.

- [ ] **Step 4: Keep scope local**

Do not add operations collaboration or external referral system integration. This version is doctor-side recording and workflow guidance only.

### Task 3: Verify

**Files:**
- Test: `src/features/doctor/doctor-view.test.tsx`

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test:run -- src/features/doctor/doctor-view.test.tsx
```

Expected: all doctor tests pass.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run test:run
npm run lint
npm run build
```

Expected: all commands exit 0.
