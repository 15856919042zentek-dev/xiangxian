# Doctor Post-Care Cycles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade doctor-side post-care management from one-off notes to periodic follow-up management with status-specific actions.

**Architecture:** Keep the existing `诊后管理` menu, left queue/right detail layout, and demo-local data model in `src/features/doctor/doctor-view.tsx`. Extend `PostCareRecord` with follow-up plan and schedule fields, broaden post-care statuses, and render right-side sections/actions conditionally by status. Update `src/features/doctor/doctor-view.test.tsx` first to lock the expected behavior.

**Tech Stack:** React 19, TypeScript, Vite, local shadcn-style UI components, Vitest + Testing Library.

---

### Task 1: Specify Periodic Follow-Up Behavior in Tests

**Files:**
- Modify: `src/features/doctor/doctor-view.test.tsx`

- [x] **Step 1: Replace the existing post-care test expectations**

Update the `turns follow-up and referral into a doctor post-care management workspace` test so it expects these status labels:

```ts
["待制定计划", "待随访", "周期随访中", "待转诊", "转诊跟踪中", "闭环待确认", "已闭环"]
```

Expect the right detail to include `随访计划`, `随访日程`, `本次随访办理`, `第 1/4 次`, `每 3 天一次`, `结束条件`, and `启动随访`.

- [x] **Step 2: Add a status-specific action test**

Add a test that clicks records for `沈某某`, `李某某`, `吴某某`, and `郑某某`, then asserts the visible actions:

```ts
expect(screen.getByRole("button", { name: "完成并生成下次" })).toBeTruthy()
expect(screen.getByRole("button", { name: "改期随访" })).toBeTruthy()
expect(screen.getByRole("button", { name: "无法联系" })).toBeTruthy()
expect(screen.getByRole("button", { name: "登记转诊" })).toBeTruthy()
expect(screen.getByRole("button", { name: "确认到院" })).toBeTruthy()
expect(screen.getByRole("button", { name: "补充检查结果" })).toBeTruthy()
expect(screen.getByRole("button", { name: "转回本地随访" })).toBeTruthy()
expect(screen.getByRole("button", { name: "确认闭环" })).toBeTruthy()
expect(screen.getByRole("button", { name: "继续随访" })).toBeTruthy()
```

- [x] **Step 3: Run RED**

Run:

```bash
npm run test:run -- src/features/doctor/doctor-view.test.tsx
```

Expected: failing assertions for missing `周期随访中`, `随访计划`, `随访日程`, and new status actions.

### Task 2: Extend Post-Care Data and Statuses

**Files:**
- Modify: `src/features/doctor/doctor-view.tsx`

- [x] **Step 1: Broaden `PostCareStatus`**

Change:

```ts
type PostCareStatus = "plan" | "followup" | "referral" | "observing" | "closed"
```

to:

```ts
type PostCareStatus =
  | "plan"
  | "followup"
  | "cycle"
  | "referral"
  | "transferTracking"
  | "closure"
  | "closed"
```

- [x] **Step 2: Extend `PostCareRecord`**

Add:

```ts
followUpPlan: {
  cycle: string
  totalTimes: number
  currentTimes: number
  nextDueAt: string
  method: string
  endCondition: string
}
schedule: Array<{
  id: string
  sequence: string
  dueAt: string
  method: string
  status: "已完成" | "待随访" | "未到期" | "逾期" | "已改期"
  result: string
}>
```

- [x] **Step 3: Update demo records**

Convert `observing` to `cycle`, add one `transferTracking` example (`吴某某`) and one `closure` example (`郑某某`). Fill every record with `followUpPlan` and `schedule` values that match the tests.

### Task 3: Render Periodic Plan, Schedule, and Status Actions

**Files:**
- Modify: `src/features/doctor/doctor-view.tsx`

- [x] **Step 1: Replace one-off follow-up rendering**

In `PostCareDetail`, rename `本地诊后计划` to `诊后计划`, add a `随访计划` card, add a `随访日程` card, and keep existing expert advice, referral, and closure cards.

- [x] **Step 2: Add current follow-up handling card**

Render `本次随访办理` for statuses `plan`, `followup`, and `cycle`, with textarea label `本次随访记录`.

- [x] **Step 3: Add status-specific action helper**

Create `getPostCareActions(record.status)` returning:

```ts
plan: ["保存计划", "启动随访"]
followup: ["保存记录", "完成并生成下次", "改期随访", "无法联系", "转入转诊"]
cycle: ["提前随访", "调整计划", "暂停随访", "结束计划"]
referral: ["登记转诊", "确认患者同意", "确认到院"]
transferTracking: ["补充检查结果", "转回本地随访", "进入闭环确认"]
closure: ["确认闭环", "继续随访"]
closed: ["查看会诊单", "查看诊后记录"]
```

Render those labels in the bottom action card without changing external behavior.

### Task 4: Verify and Polish

**Files:**
- Modify only if checks fail: `src/features/doctor/doctor-view.tsx`

- [x] **Step 1: Run focused and full checks**

Run:

```bash
npm run test:run -- src/features/doctor/doctor-view.test.tsx
npm run test:run
npm run lint
npm run build
```

- [x] **Step 2: Browser verify**

Open `http://127.0.0.1:5177/doctor`, enter `诊后管理`, and verify desktop/mobile show no overflow, no action crowding, and no missing status labels.
