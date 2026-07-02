# Doctor Messages And Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the doctor-side messages and settings sections into practical work surfaces with actionable message routing and editable personal workflow preferences.

**Architecture:** Keep the existing doctor console in `DoctorView`. Rename the doctor menu item from `消息通知` to `消息中心`, render messages as a left list plus right detail/action panel, and replace static settings cards with grouped settings for profile, consultation preferences, reminders, templates, and account security. Use local component state only; do not add backend persistence or operations-side collaboration.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, existing UI components, lucide-react icons.

---

### Task 1: Capture Behavior With Failing Tests

**Files:**
- Modify: `src/features/doctor/doctor-view.test.tsx`

- [ ] **Step 1: Update menu expectations**

Expect the doctor menu order to be `工作台`, `会诊单管理`, `诊后管理`, `消息中心`, `我的设置`.

- [ ] **Step 2: Add message center test**

Open `消息中心` and assert:
- `消息列表`
- filters `全部`, `未读`, `待处理`, `会诊相关`, `诊后相关`
- detail fields `消息详情`, `关联会诊单`, `消息来源`
- actions `去补充资料`, `进入会诊办理`, `进入诊后管理`, `全部已读`, `归档已处理`

- [ ] **Step 3: Add settings test**

Open `我的设置` and assert:
- groups `医生资料`, `会诊偏好`, `消息提醒`, `常用模板`, `账号安全`
- edit entries `编辑资料`, `编辑会诊偏好`, `编辑提醒设置`, `新增模板`, `编辑模板`, `账号安全`
- toggling edit exposes save actions and editable fields.

- [ ] **Step 4: Verify RED**

Run:

```bash
npm run test:run -- src/features/doctor/doctor-view.test.tsx
```

Expected: fail because the current doctor messages and settings pages are static.

### Task 2: Implement Message Center

**Files:**
- Modify: `src/features/doctor/doctor-view.tsx`

- [ ] **Step 1: Rename menu**

Change `消息通知` to `消息中心`.

- [ ] **Step 2: Add local message records**

Create local message records covering consultation, post-care, coordination, and system messages.

- [ ] **Step 3: Render left list and right detail**

Use a two-column layout with message filters, message list, detail metadata, and action buttons.

- [ ] **Step 4: Wire action buttons locally**

`进入会诊办理` should call the existing `onOpenCase`. Other actions can render as local front-end buttons for this demo.

### Task 3: Implement Settings Center

**Files:**
- Modify: `src/features/doctor/doctor-view.tsx`

- [ ] **Step 1: Add grouped settings page**

Render doctor profile, consultation preferences, reminder preferences, templates, and account security.

- [ ] **Step 2: Add edit states**

Provide `编辑资料`, `编辑会诊偏好`, `编辑提醒设置`, `新增模板`, and `编辑模板` entries with visible editable fields and save buttons.

- [ ] **Step 3: Keep scope local**

Store edits in local React state only. Do not add persistence or new domain actions.

### Task 4: Verify

Run:

```bash
npm run test:run -- src/features/doctor/doctor-view.test.tsx
npm run test:run
npm run lint
npm run build
```

Expected: all commands exit 0.
