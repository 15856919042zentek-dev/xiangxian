# Admin Reminder Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the admin “流程催办” page into a risk-first reminder workbench with top status metrics, a filterable reminder queue, quick templates, and recent reminder history.

**Architecture:** Keep the implementation inside the existing admin feature boundary. Add reminder-specific derived data helpers in `src/features/admin/admin-view.tsx`, then replace `RemindersPage` with a vertical workbench layout that reuses existing records, operation logs, reminder templates, badges, and dispatch callbacks.

**Tech Stack:** React 19, TypeScript, Vite, local shadcn-style UI components, lucide-react icons, Vitest + Testing Library.

---

## File Structure

- Modify: `src/features/admin/admin-view.test.tsx`
  - Add tests for the reminder workbench layout, metric filtering, risk-first ordering, node reminder dispatch, quick template availability, and reminder history.
- Modify: `src/features/admin/admin-view.tsx`
  - Add reminder filter and queue item types.
  - Add helper functions for reminder stats, queue derivation, filtering, sorting, primary action labels, last reminder lookup, and template lookup.
  - Replace the current `RemindersPage` layout.
  - Add small presentational helpers for metric filter cards, queue rows, and quick template rows.
- Read-only reference: `docs/superpowers/specs/2026-07-02-admin-reminder-workbench-design.md`
  - Source of product requirements.

## Task 1: Add Reminder Workbench Tests

**Files:**
- Modify: `src/features/admin/admin-view.test.tsx`

- [x] **Step 1: Add the failing test block**

Append these tests inside the existing `describe("AdminView navigation", () => { ... })` block, after the current admin status detail tests and before quality archive tests:

```tsx
  it("shows a risk-first reminder workbench with status filters and history", async () => {
    const user = userEvent.setup()

    render(<AdminView session={createDemoSession()} dispatch={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "流程催办" }))

    expect(screen.getByRole("heading", { name: "流程催办工作台" })).toBeTruthy()
    expect(screen.getByText("先处理逾期和高风险会诊单，再按状态批量催办。")).toBeTruthy()

    for (const metric of [
      "全部待催办",
      "逾期/风险",
      "待专家预审",
      "待医生补资料",
      "待专家建议",
      "待医生确认",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(metric) })).toBeTruthy()
    }

    const queue = screen.getByTestId("admin-reminder-queue")
    expect(within(queue).getByText("待催办队列")).toBeTruthy()
    expect(within(queue).getByText("刘某某")).toBeTruthy()
    expect(within(queue).getByText("周某某")).toBeTruthy()
    expect(within(queue).getByText("陈某某")).toBeTruthy()

    const queueText = queue.textContent ?? ""
    expect(queueText.indexOf("刘某某")).toBeLessThan(queueText.indexOf("周某某"))
    expect(queueText.indexOf("周某某")).toBeLessThan(queueText.indexOf("陈某某"))

    expect(within(queue).getByRole("button", { name: "催专家预审" })).toBeTruthy()
    expect(within(queue).getByRole("button", { name: "催医生补资料" })).toBeTruthy()
    expect(within(queue).getByRole("button", { name: "催专家提交建议" })).toBeTruthy()
    expect(within(queue).getAllByText("已催办").length).toBeGreaterThan(0)

    expect(screen.getByText("快捷模板")).toBeTruthy()
    expect(screen.getByRole("button", { name: "请尽快预审会诊资料" })).toBeTruthy()
    expect(screen.getByText("近期催办历史")).toBeTruthy()
    expect(screen.getByText("已提醒补充资料")).toBeTruthy()
    expect(screen.getByText("已提醒提交建议")).toBeTruthy()
  })

  it("filters the reminder queue when a status metric is selected", async () => {
    const user = userEvent.setup()

    render(<AdminView session={createDemoSession()} dispatch={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "流程催办" }))
    await user.click(screen.getByRole("button", { name: /待医生补资料/ }))

    const queue = screen.getByTestId("admin-reminder-queue")
    expect(within(queue).getByText("周某某")).toBeTruthy()
    expect(within(queue).queryByText("刘某某")).toBeNull()
    expect(within(queue).queryByText("陈某某")).toBeNull()
    expect(within(queue).getByText("当前筛选：待医生补资料")).toBeTruthy()
  })

  it("dispatches the current-node reminder from the reminder queue", async () => {
    const user = userEvent.setup()
    const dispatch = vi.fn()

    render(<AdminView session={createDemoSession()} dispatch={dispatch} />)

    await user.click(screen.getByRole("button", { name: "流程催办" }))

    const queue = screen.getByTestId("admin-reminder-queue")
    await user.click(within(queue).getByRole("button", { name: "催专家预审" }))

    expect(dispatch).toHaveBeenCalledWith({
      type: "admin.sendReminder",
      input: {
        targetRole: "expert",
        title: "专家处理提醒：待专家预审",
        detail: expect.stringContaining("刘某某"),
      },
    })
  })
```

- [x] **Step 2: Run RED**

Run:

```bash
npm run test:run -- src/features/admin/admin-view.test.tsx
```

Expected: FAIL because `流程催办工作台`, metric filter buttons, `admin-reminder-queue`, and state-specific queue action labels do not exist yet.

## Task 2: Add Reminder Data Derivation Helpers

**Files:**
- Modify: `src/features/admin/admin-view.tsx`

- [x] **Step 1: Add reminder filter and derived item types**

Add these types near `AdminCounts`:

```ts
type ReminderFilter =
  | "all"
  | "risk"
  | "pending_expert"
  | "needs_more_info"
  | "pending_advice"
  | "pending_doctor_confirm"

interface ReminderMetric {
  key: ReminderFilter
  label: string
  value: number
  helper: string
  tone?: "default" | "warning" | "danger"
}

interface ReminderQueueItem {
  record: AdminCaseRecord
  targetRole: Exclude<UserRole, "admin">
  primaryActionLabel: string
  filterKey: ReminderFilter
  lastReminderAt?: string
  hasRecentReminder: boolean
  priorityScore: number
}
```

- [x] **Step 2: Add reminder helper functions**

Add these helpers near `getAdminCounts`:

```ts
function getReminderTargetRole(record: AdminCaseRecord): Exclude<UserRole, "admin"> | undefined {
  if (record.consultation.status === "in_consultation") return "expert"
  return record.currentOwnerRole
}

function getReminderPrimaryActionLabel(status: ConsultationStatus) {
  const labels: Partial<Record<ConsultationStatus, string>> = {
    draft: "催医生提交",
    pending_expert: "催专家预审",
    needs_more_info: "催医生补资料",
    scheduled: "提醒医生/专家",
    in_consultation: "提醒双方",
    pending_advice: "催专家提交建议",
    pending_doctor_confirm: "催医生确认处置",
  }

  return labels[status] ?? "节点催办"
}

function getReminderFilterKey(status: ConsultationStatus): ReminderFilter {
  if (status === "pending_expert") return "pending_expert"
  if (status === "needs_more_info") return "needs_more_info"
  if (status === "pending_advice" || status === "in_consultation") return "pending_advice"
  if (status === "pending_doctor_confirm") return "pending_doctor_confirm"
  return "all"
}

function getLastReminderAt(record: AdminCaseRecord, reminderLogs: OperationLog[]) {
  return reminderLogs
    .filter((log) => log.consultationId === record.consultation.id)
    .at(-1)?.createdAt
}

function getReminderPriorityScore(record: AdminCaseRecord, hasRecentReminder: boolean) {
  let score = 0

  if (record.riskLevel === "urgent") score += 100
  if (record.riskLevel === "warning") score += 70
  if (record.consultation.priority === "urgent") score += 30
  if (record.consultation.status === "scheduled") score += 25
  if (record.consultation.status === "pending_advice") score += 20
  if (record.currentOwnerRole === "expert") score += 10
  if (hasRecentReminder) score -= 18

  return score
}

function getReminderQueueItems(records: AdminCaseRecord[], operationLogs: OperationLog[]) {
  const reminderLogs = operationLogs.filter((log) => log.action === "reminder")

  return records
    .map((record): ReminderQueueItem | null => {
      const targetRole = getReminderTargetRole(record)
      if (!targetRole) return null

      const lastReminderAt = getLastReminderAt(record, reminderLogs)
      const hasRecentReminder = Boolean(lastReminderAt)

      return {
        record,
        targetRole,
        primaryActionLabel: getReminderPrimaryActionLabel(record.consultation.status),
        filterKey: getReminderFilterKey(record.consultation.status),
        lastReminderAt,
        hasRecentReminder,
        priorityScore: getReminderPriorityScore(record, hasRecentReminder),
      }
    })
    .filter((item): item is ReminderQueueItem => Boolean(item))
    .sort((a, b) => b.priorityScore - a.priorityScore)
}

function filterReminderQueueItems(items: ReminderQueueItem[], activeFilter: ReminderFilter) {
  if (activeFilter === "all") return items
  if (activeFilter === "risk") {
    return items.filter(
      (item) =>
        item.record.riskLevel === "urgent" ||
        item.record.riskLevel === "warning" ||
        item.record.consultation.priority === "urgent",
    )
  }
  return items.filter((item) => item.filterKey === activeFilter)
}

function getReminderMetrics(items: ReminderQueueItem[]): ReminderMetric[] {
  const riskCount = filterReminderQueueItems(items, "risk").length

  return [
    {
      key: "all",
      label: "全部待催办",
      value: items.length,
      helper: "医生和专家待处理",
    },
    {
      key: "risk",
      label: "逾期/风险",
      value: riskCount,
      helper: "优先跟进",
      tone: "danger",
    },
    {
      key: "pending_expert",
      label: "待专家预审",
      value: items.filter((item) => item.filterKey === "pending_expert").length,
      helper: "催专家确认",
    },
    {
      key: "needs_more_info",
      label: "待医生补资料",
      value: items.filter((item) => item.filterKey === "needs_more_info").length,
      helper: "催医生补齐",
      tone: "warning",
    },
    {
      key: "pending_advice",
      label: "待专家建议",
      value: items.filter((item) => item.filterKey === "pending_advice").length,
      helper: "会诊后建议",
      tone: "warning",
    },
    {
      key: "pending_doctor_confirm",
      label: "待医生确认",
      value: items.filter((item) => item.filterKey === "pending_doctor_confirm").length,
      helper: "处置确认",
    },
  ]
}
```

- [x] **Step 3: Run TypeScript check through tests**

Run:

```bash
npm run test:run -- src/features/admin/admin-view.test.tsx
```

Expected: still FAIL because UI is not wired yet, but there should be no TypeScript parser error.

## Task 3: Replace the Reminder Page Layout

**Files:**
- Modify: `src/features/admin/admin-view.tsx`

- [x] **Step 1: Add filter state and derived data in `RemindersPage`**

Replace the top of `RemindersPage` with:

```tsx
  const [activeFilter, setActiveFilter] = useState<ReminderFilter>("all")
  const reminderLogs = operationLogs.filter((log) => log.action === "reminder")
  const queueItems = getReminderQueueItems(records, operationLogs)
  const filteredQueueItems = filterReminderQueueItems(queueItems, activeFilter)
  const metrics = getReminderMetrics(queueItems)
  const activeMetric = metrics.find((metric) => metric.key === activeFilter) ?? metrics[0]
```

Remove the old `pendingRecords` constant.

- [x] **Step 2: Replace the returned JSX**

Replace the current `return (...)` body of `RemindersPage` with:

```tsx
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-border/80 bg-card/95 p-4 shadow-sm shadow-primary/5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">流程催办工作台</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              先处理逾期和高风险会诊单，再按状态批量催办。
            </p>
          </div>
          <Badge variant="outline">风险优先</Badge>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => (
          <ReminderMetricCard
            key={metric.key}
            metric={metric}
            active={activeFilter === metric.key}
            onClick={() => setActiveFilter(metric.key)}
          />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card data-testid="admin-reminder-queue">
          <CardHeader className="gap-2">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>待催办队列</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  当前筛选：{activeMetric.label}
                </p>
              </div>
              <Badge variant="outline">{filteredQueueItems.length} 单</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {filteredQueueItems.map((item) => (
              <ReminderQueueRow
                key={item.record.consultation.id}
                item={item}
                onSendReminder={() => onSendContextReminder(item.record)}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>快捷模板</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {reminderTemplates.map((template) => (
              <ReminderTemplateRow
                key={template.id}
                template={template}
                onSendReminder={() =>
                  onSendReminder(template.targetRole, template.title, template.detail)
                }
              />
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>近期催办历史</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {reminderLogs.slice(-8).reverse().map((log) => (
            <OperationLogItem key={log.id} log={log} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
```

- [x] **Step 3: Add `ReminderMetricCard`**

Add this component after `RemindersPage`:

```tsx
function ReminderMetricCard({
  metric,
  active,
  onClick,
}: {
  metric: ReminderMetric
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-xl border bg-card p-3 text-left shadow-sm shadow-primary/5 transition hover:bg-secondary/45",
        active ? "border-primary ring-2 ring-primary/15" : "border-border/80",
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{metric.label}</span>
        {metric.tone === "danger" && <RiskDot risk="urgent" />}
        {metric.tone === "warning" && <RiskDot risk="warning" />}
      </div>
      <div className="mt-2 text-2xl font-semibold leading-none">{metric.value}</div>
      <div className="mt-2 text-xs text-muted-foreground">{metric.helper}</div>
    </button>
  )
}
```

- [x] **Step 4: Add `ReminderQueueRow`**

Add this component after `ReminderMetricCard`:

```tsx
function ReminderQueueRow({
  item,
  onSendReminder,
}: {
  item: ReminderQueueItem
  onSendReminder: () => void
}) {
  const { record } = item

  return (
    <div className="grid gap-3 rounded-xl border border-border/80 bg-card/80 p-3 shadow-sm shadow-primary/5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{record.consultation.patient.name}</span>
          <AdminStatusBadge status={record.consultation.status} />
          <RiskBadge risk={record.riskLevel} />
          {item.hasRecentReminder && <Badge variant="outline">已催办</Badge>}
        </div>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {record.consultation.id} · {record.consultation.department}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {record.currentOwner} · {record.waitTime} · {record.slaLabel}
        </p>
        <p className="text-xs text-muted-foreground">
          上次催办：{item.lastReminderAt ?? "未催办"}
        </p>
      </div>
      <Button size="sm" onClick={onSendReminder}>
        <BellRingIcon data-icon="inline-start" />
        {item.primaryActionLabel}
      </Button>
    </div>
  )
}
```

- [x] **Step 5: Add `ReminderTemplateRow`**

Add this component after `ReminderQueueRow`:

```tsx
function ReminderTemplateRow({
  template,
  onSendReminder,
}: {
  template: (typeof reminderTemplates)[number]
  onSendReminder: () => void
}) {
  return (
    <button
      type="button"
      className="rounded-xl border border-border/80 bg-card/80 p-3 text-left shadow-sm shadow-primary/5 transition hover:bg-secondary/45"
      onClick={onSendReminder}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{template.title}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            发送至 {audienceLabels[template.targetRole]}
          </div>
        </div>
        <SendIcon className="size-4 text-primary" />
      </div>
      <div className="mt-2 text-xs leading-5 text-muted-foreground">
        {template.appliesTo.map((status) => adminStatusLabels[status]).join(" / ")}
      </div>
    </button>
  )
}
```

- [x] **Step 6: Run focused GREEN**

Run:

```bash
npm run test:run -- src/features/admin/admin-view.test.tsx
```

Expected: PASS for the new reminder tests and existing admin tests.

## Task 4: Final Verification, Commit, Push, and Production Check

**Files:**
- Modify if checks fail: `src/features/admin/admin-view.tsx`
- Modify if checks fail: `src/features/admin/admin-view.test.tsx`

- [x] **Step 1: Run full local checks**

Run:

```bash
npm run test:run
npm run lint
npm run build
```

Expected:

- Vitest reports all test files and tests passed.
- Oxlint exits with code 0.
- Vite production build exits with code 0.

- [ ] **Step 2: Commit implementation**

Run:

```bash
git status -sb
git add src/features/admin/admin-view.tsx src/features/admin/admin-view.test.tsx
git commit -m "Improve admin reminder workbench"
```

Expected: commit succeeds with only admin view and admin view test changes.

- [ ] **Step 3: Push and let Vercel deploy**

Run:

```bash
GIT_SSH_COMMAND='ssh -o BatchMode=yes -o ConnectTimeout=20' git push
```

Expected: `main` pushes to `git@github.com:15856919042zentek-dev/xiangxian.git`; Vercel starts a new production deployment.

- [ ] **Step 4: Verify production route**

Poll the deployed admin route:

```bash
for attempt in {1..20}; do
  code=$(HTTPS_PROXY=http://127.0.0.1:7890 HTTP_PROXY=http://127.0.0.1:7890 curl -sS -o /tmp/xiangxian-admin.html -w '%{http_code}' --max-time 20 https://xiangxian.vercel.app/admin)
  has_title=$(rg -c "乡贤助医远程问诊平台" /tmp/xiangxian-admin.html || true)
  echo "attempt=$attempt code=$code title_matches=$has_title"
  if [ "$code" = "200" ] && [ "$has_title" != "0" ]; then exit 0; fi
  sleep 15
done
exit 1
```

Expected: exits 0 with `code=200`.

- [ ] **Step 5: Browser spot check**

Open `https://xiangxian.vercel.app/admin`, enter “流程催办”, and verify:

- Top metric cards are visible.
- Default queue is risk-first.
- Clicking “待医生补资料” filters to the supplement queue.
- Recent reminder history is below the queue.
- Layout does not overflow at desktop width.
