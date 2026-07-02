# Admin Case Status Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin consultation detail panel show state-specific content and operations for each consultation workflow status.

**Architecture:** Keep the current admin case list and right-side detail layout. Add a status configuration layer in `src/features/admin/admin-view.tsx` that maps each `ConsultationStatus` to the current-node title, focus fields, checks, and action buttons. Tests in `src/features/admin/admin-view.test.tsx` lock the expected status-specific behavior before implementation.

**Tech Stack:** React 19, TypeScript, Vite, local shadcn-style UI components, Vitest + Testing Library.

---

### Task 1: Specify Status-Specific Admin Detail Behavior

**Files:**
- Modify: `src/features/admin/admin-view.test.tsx`

- [x] **Step 1: Add a failing test for core active states**

Add a test that opens `会诊单管理`, confirms the default draft detail shows `当前节点处理`, `草稿跟进`, `催医生提交`, and does not show `质控通过并归档`; then clicks `刘某某`, `周某某`, `孙某某`, `陈某某`, and `韩某某` rows and checks for their state-specific actions.

- [x] **Step 2: Add a failing test for terminal or abnormal live states**

Render the admin view with `session.activeConsultation.status` set to `offline_emergency`, open `会诊单管理`, and assert the detail shows `线下急诊跟踪`, `记录急诊跟踪`, `催医生回填结果`, and `关闭线上会诊`.

- [x] **Step 3: Run RED**

Run:

```bash
npm run test:run -- src/features/admin/admin-view.test.tsx
```

Expected: tests fail because the current detail panel has only generic buttons.

### Task 2: Add Admin Status Detail Configuration

**Files:**
- Modify: `src/features/admin/admin-view.tsx`

- [x] **Step 1: Define action and detail config types**

Create `AdminCaseDetailAction` and `AdminCaseDetailConfig` near the admin constants.

- [x] **Step 2: Add config for every `ConsultationStatus`**

Map statuses to current-node title, focus, next step, checks, and actions. Include all statuses from `ConsultationStatus`, not only current fixture rows.

- [x] **Step 3: Add action helper functions**

Add helpers for action button icons, variants, and click dispatching. Reminder actions call existing `onSendReminder`; archive action calls `onArchive`; priority actions call `onTogglePriority`; other demo actions remain UI-only.

### Task 3: Render the State-Specific Detail Panel

**Files:**
- Modify: `src/features/admin/admin-view.tsx`

- [x] **Step 1: Replace generic operation buttons**

In `CaseDetailPanel`, replace the generic `催办责任方 / 调整优先级 / 质控通过并归档` block with a `当前节点处理` card driven by the status config.

- [x] **Step 2: Keep fixed supporting sections**

Keep patient summary, application detail, timeline, attachment list, advice panel, communication log, operation notes, and operation records.

- [x] **Step 3: Run focused GREEN**

Run:

```bash
npm run test:run -- src/features/admin/admin-view.test.tsx
```

Expected: new and existing admin tests pass.

### Task 4: Verify All Checks

**Files:**
- Modify only if checks fail: `src/features/admin/admin-view.tsx`, `src/features/admin/admin-view.test.tsx`

- [x] **Step 1: Run full checks**

Run:

```bash
npm run test:run
npm run lint
npm run build
```

- [x] **Step 2: Browser verify**

Open `http://127.0.0.1:5177/admin`, enter `会诊单管理`, click several statuses, and verify the right detail actions change without layout overflow.
