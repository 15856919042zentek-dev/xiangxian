# Quality Archive Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the thin admin quality archive page with a combined quality handling and audit center.

**Architecture:** Keep all changes scoped to the admin feature. Add local quality review state in `AdminView`, replace `QualityPage` with a queue + detail workbench, and reuse existing `admin.sendReminder` and `admin.archive` dispatch flows. Do not touch the expert service page state or invite-code logic.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, existing shadcn-style local UI components.

---

### Task 1: Add Quality Center Test Coverage

**Files:**
- Modify: `src/features/admin/admin-view.test.tsx`

- [ ] **Step 1: Write failing test for quality center navigation and queue**

Add this test to `src/features/admin/admin-view.test.tsx`:

```tsx
it("shows a quality archive center with queue, checks, issues, and sampling", async () => {
  const user = userEvent.setup()

  render(<AdminView session={createDemoSession()} dispatch={vi.fn()} />)

  await user.click(screen.getByRole("button", { name: "质控归档" }))

  expect(screen.getByRole("heading", { name: "质控归档中心" })).toBeTruthy()
  expect(screen.getByText("待质控")).toBeTruthy()
  expect(screen.getByText("有缺项")).toBeTruthy()
  expect(screen.getByText("整改中")).toBeTruthy()
  expect(screen.getByText("抽检通过率")).toBeTruthy()
  expect(screen.getByText("质控队列")).toBeTruthy()
  expect(screen.getByText("核查清单")).toBeTruthy()
  expect(screen.getByText("问题整改")).toBeTruthy()
  expect(screen.getByText("归档包")).toBeTruthy()
  expect(screen.getByText("抽检复核")).toBeTruthy()
  expect(screen.getByText("资料缺失")).toBeTruthy()
  expect(screen.getByRole("button", { name: "创建整改任务" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "发起抽检" })).toBeTruthy()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test:run -- src/features/admin/admin-view.test.tsx
```

Expected: fail because `质控归档中心`, queue filters, issue controls, and sampling controls do not exist.

### Task 2: Implement Quality Center State and Main Wiring

**Files:**
- Modify: `src/features/admin/admin-view.tsx`

- [ ] **Step 1: Add quality state types and constants**

Add local types near existing quality constants:

```ts
type QualityCaseStatus =
  | "pending_review"
  | "missing_items"
  | "rectification"
  | "ready_to_archive"
  | "archived"
  | "sampling"
  | "sample_passed"
  | "sample_issue"

type QualityCheckResult = "pass" | "fail" | "na"
type QualityFilter = "all" | QualityCaseStatus
type QualityPanelTab = "checklist" | "issues" | "archive" | "sampling"

interface QualityCheckItem {
  key: string
  group: "基础核查" | "诊疗过程核查" | "运营合规核查"
  label: string
  required: boolean
}

interface QualityIssue {
  id: string
  type: "missing_attachment" | "incomplete_advice" | "missing_disposition" | "sla_overdue" | "risk_unclosed" | "insufficient_message"
  label: string
  ownerRole: UserRole
  note: string
  status: "open" | "reminded" | "resolved"
}

interface QualityCaseState {
  status: QualityCaseStatus
  checks: Record<string, QualityCheckResult>
  issues: QualityIssue[]
  archiveNote: string
  samplingNote: string
  samplingStatus: "none" | "sampling" | "passed" | "issue"
}
```

Add grouped `qualityCheckItems`, `qualityIssueOptions`, labels, and helper state creators.

- [ ] **Step 2: Wire quality state in `AdminView`**

Replace the old `qualityChecks` state with:

```ts
const [qualityStates, setQualityStates] = useState<Record<string, QualityCaseState>>({})
const [selectedQualityCaseId, setSelectedQualityCaseId] = useState(session.activeConsultation.id)
```

Add helper callbacks:

```ts
function updateQualityCase(
  consultationId: string,
  updater: (current: QualityCaseState) => QualityCaseState,
) {
  setQualityStates((current) => {
    const record = records.find((item) => item.consultation.id === consultationId)
    const previous = current[consultationId] ?? createDefaultQualityCaseState(record)

    return {
      ...current,
      [consultationId]: updater(previous),
    }
  })
}

function archiveQualityCase(record: AdminCaseRecord) {
  if (record.isLive) {
    archiveLiveCase()
    return
  }

  updateQualityCase(record.consultation.id, (current) => ({
    ...current,
    status: "archived",
  }))
}
```

Pass `records`, `qualityStates`, `selectedQualityCaseId`, `onSelectCase`, `onUpdateCase`, `onSendReminder`, and `onArchive` to `QualityPage`.

### Task 3: Replace `QualityPage` with Combined Center

**Files:**
- Modify: `src/features/admin/admin-view.tsx`

- [ ] **Step 1: Replace `QualityPage` props and layout**

`QualityPage` should accept:

```ts
function QualityPage({
  records,
  qualityStates,
  selectedCaseId,
  onSelectCase,
  onUpdateCase,
  onSendReminder,
  onArchive,
}: {
  records: AdminCaseRecord[]
  qualityStates: Record<string, QualityCaseState>
  selectedCaseId: string
  onSelectCase: (id: string) => void
  onUpdateCase: (
    consultationId: string,
    updater: (current: QualityCaseState) => QualityCaseState,
  ) => void
  onSendReminder: (
    targetRole: Exclude<UserRole, "admin">,
    title: string,
    detail: string,
  ) => void
  onArchive: (record: AdminCaseRecord) => void
}) {
  // local filter + tab state
}
```

Layout:

```tsx
<div className="flex flex-col gap-4">
  <SectionIntro title="质控归档中心" icon={ClipboardCheckIcon} />
  <QualityOverviewCards ... />
  <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
    <QualityQueue ... />
    <QualityCasePanel ... />
  </div>
</div>
```

- [ ] **Step 2: Add queue and filters**

Implement `QualityQueue` with filter buttons and records. Each queue item should show patient, department, doctor/expert, quality status, missing count, issue count, and wait/SLA.

- [ ] **Step 3: Add overview cards**

Implement `QualityOverviewCards` showing:

- 待质控
- 有缺项
- 整改中
- 可归档
- 今日归档
- 抽检通过率

### Task 4: Implement Checklist, Issues, Archive, and Sampling Panels

**Files:**
- Modify: `src/features/admin/admin-view.tsx`

- [ ] **Step 1: Implement checklist tab**

Group `qualityCheckItems` by group. Each row has label, required badge, and buttons: `通过`, `不通过`, `不适用`.

- [ ] **Step 2: Implement issues tab**

Show existing issues. Provide issue type selector buttons and a textarea for issue note. `创建整改任务` creates an issue on the selected case. Add buttons for `发送提醒` and `标记解决`.

- [ ] **Step 3: Implement archive tab**

Show archive readiness summary, archive note textarea, compact timeline/advice preview, and `质控通过并归档` button. Disable archive when required checks include `fail`, archive note is empty, or open issues remain.

- [ ] **Step 4: Implement sampling tab**

Show sampling status and note textarea. `发起抽检` moves status to `sampling`; `抽检通过` moves status to `sample_passed`; `发现问题` moves status to `sample_issue`.

### Task 5: Verify and Polish

**Files:**
- Modify: `src/features/admin/admin-view.tsx`
- Modify: `src/features/admin/admin-view.test.tsx`

- [ ] **Step 1: Run focused admin tests**

Run:

```bash
npm run test:run -- src/features/admin/admin-view.test.tsx
```

Expected: all admin tests pass.

- [ ] **Step 2: Run full test/lint/build**

Run:

```bash
npm run test:run
npm run lint
npm run build
```

Expected: all pass.

- [ ] **Step 3: Browser verify**

Open `http://127.0.0.1:5173/admin`, click `质控归档`, and verify:

- Page title shows `质控归档中心`.
- Queue and detail panel render.
- Creating a整改 task updates the issue list.
- Sampling actions update visible state.
- Expert service page still opens and shows `新专家录入` and `邀请码管理`.
