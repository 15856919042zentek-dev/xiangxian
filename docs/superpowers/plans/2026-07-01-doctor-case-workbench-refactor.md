# Doctor Case Workbench Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the doctor side as an admin-style case workbench where consultation creation, editing, detail review, external consultation execution, disposition, and quality rectification happen inside one unified case management surface.

**Architecture:** Keep the existing `DemoSession` state machine and shared workflow components. Replace the current stacked doctor page with a left-sidebar doctor console and a queue plus handling panel, using an external consultation execution node instead of an internal RTC room. Add focused UI tests for the new information architecture and state-specific actions before implementation.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, existing shadcn-style UI components, lucide-react icons.

---

### Task 1: Add Doctor Workbench Test Coverage

**Files:**
- Create: `src/features/doctor/doctor-view.test.tsx`
- Modify: `src/features/doctor/doctor-view.tsx`

- [ ] **Step 1: Write the failing test**

Add tests that render `DoctorView` and assert the new admin-style information architecture:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createDemoSession } from "@/domain/demo-session"

import { DoctorView } from "./doctor-view"

afterEach(() => cleanup())

describe("DoctorView case workbench", () => {
  it("uses an admin-style sidebar and unifies new case creation with case handling", async () => {
    const user = userEvent.setup()

    render(<DoctorView session={createDemoSession()} dispatch={vi.fn()} />)

    const sidebar = screen.getByRole("navigation")
    const sidebarScope = within(sidebar)
    for (const section of ["医生工作台", "会诊单管理", "消息通知", "随访转诊", "我的设置"]) {
      expect(sidebarScope.getByRole("button", { name: section })).toBeTruthy()
    }

    await user.click(sidebarScope.getByRole("button", { name: "会诊单管理" }))

    expect(screen.getByRole("heading", { name: "会诊单管理" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "新建会诊单" })).toBeTruthy()
    expect(screen.getByText("会诊队列")).toBeTruthy()
    expect(screen.getByText("申请信息")).toBeTruthy()
    expect(screen.getByText("病例资料")).toBeTruthy()
    expect(screen.getByText("专家协同")).toBeTruthy()
    expect(screen.getByText("处置记录")).toBeTruthy()
    expect(screen.getByText("流程留痕")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "新建会诊单" }))

    expect(screen.getByText("新建草稿")).toBeTruthy()
    expect(screen.getByRole("button", { name: "保存草稿" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "提交专家预审" })).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "会诊申请" })).toBeNull()
  })

  it("treats the consultation execution as an external system handoff instead of an RTC room", () => {
    const session = createDemoSession()
    session.activeConsultation = {
      ...session.activeConsultation,
      status: "scheduled",
      expertId: "expert-lu",
      scheduledAt: "今日 15:00",
    }

    render(<DoctorView session={session} dispatch={vi.fn()} />)

    expect(screen.getByText("外部会诊执行")).toBeTruthy()
    expect(screen.getByText("外部系统入口")).toBeTruthy()
    expect(screen.getByRole("button", { name: "复制会议号" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "打开外部会诊系统" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "标记已完成沟通" })).toBeTruthy()
    expect(screen.queryByText("远程会诊间")).toBeNull()
    expect(screen.queryByText(/通话中/)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test:run -- src/features/doctor/doctor-view.test.tsx
```

Expected: fail because the doctor sidebar, unified case management workbench, and external consultation execution controls do not exist.

### Task 2: Replace Doctor View With Admin-Style Console

**Files:**
- Modify: `src/features/doctor/doctor-view.tsx`

- [ ] **Step 1: Implement local doctor sections**

Replace the stacked `DoctorView` layout with `activeSection` state and these section keys:

```ts
type DoctorSectionKey = "workbench" | "cases" | "messages" | "followup" | "settings"
```

Render a two-column shell matching the admin view:

```tsx
<div className="grid min-h-[calc(100svh-9rem)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
  <aside className="rounded-xl border bg-card p-3 shadow-sm lg:sticky lg:top-28 lg:h-[calc(100svh-8rem)] lg:overflow-y-auto">
    <nav className="flex flex-col gap-1">...</nav>
  </aside>
  <main className="min-w-0">...</main>
</div>
```

- [ ] **Step 2: Implement doctor workbench**

Show metric cards for active cases, pending supplements, scheduled consultations, pending disposition, and quality rectification. Add a current task queue that can jump into the case management section.

- [ ] **Step 3: Implement unified case management**

Create a queue card plus handling panel. The handling panel must include visible sections labeled:

```text
申请信息
病例资料
专家协同
处置记录
流程留痕
```

The `新建会诊单` button should select a synthetic draft mode in the same handling panel and display `新建草稿`, `保存草稿`, and `提交专家预审`.

### Task 3: Replace Internal Room UI With External Handoff

**Files:**
- Modify: `src/features/doctor/doctor-view.tsx`

- [ ] **Step 1: Remove doctor-side `ConsultationRoom` usage**

Do not render `ConsultationRoom` in doctor view. Keep the shared component untouched for now because expert/admin may still import it.

- [ ] **Step 2: Add external consultation execution panel**

For `scheduled` and `in_consultation`, render an `外部会诊执行` panel with:

```text
外部系统入口
复制会议号
打开外部会诊系统
标记已完成沟通
```

Wire `标记已完成沟通` to the existing `doctor.startRoom` action so the existing state machine moves forward without adding RTC integration.

### Task 4: Preserve Existing Doctor Actions

**Files:**
- Modify: `src/features/doctor/doctor-view.tsx`

- [ ] **Step 1: Keep consultation submission**

Reuse the existing form state and dispatch:

```ts
dispatch({ type: "doctor.submitConsultation", input: ... })
```

- [ ] **Step 2: Keep supplement submission**

Reuse `doctor.addSupplement` from the new `病例资料` section when status is `needs_more_info`.

- [ ] **Step 3: Keep local disposition confirmation**

Reuse `doctor.confirmDisposition` from the new `处置记录` section when status is `pending_doctor_confirm`.

### Task 5: Verify

**Files:**
- Test: `src/features/doctor/doctor-view.test.tsx`
- Test: `src/domain/demo-session.test.ts`
- Test: `src/features/admin/admin-view.test.tsx`

- [ ] **Step 1: Run focused doctor tests**

Run:

```bash
npm run test:run -- src/features/doctor/doctor-view.test.tsx
```

Expected: all doctor tests pass.

- [ ] **Step 2: Run related regression tests**

Run:

```bash
npm run test:run -- src/domain/demo-session.test.ts src/features/admin/admin-view.test.tsx src/features/expert/expert-view.test.tsx
```

Expected: all related tests pass.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run test:run
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 4: Run rendered QA**

Start the Vite dev server and verify `/doctor` at desktop width. Confirm the page is not blank, has no framework overlay, has no relevant console errors, and the case management flow renders the unified workbench and external handoff controls.
