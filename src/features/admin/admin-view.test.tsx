// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createDemoSession } from "@/domain/demo-session"

import { AdminView } from "./admin-view"

afterEach(() => cleanup())

describe("AdminView navigation", () => {
  it("removes doctor coordination and sidebar metric pills", () => {
    render(<AdminView session={createDemoSession()} dispatch={vi.fn()} />)

    const sidebar = screen.getByRole("navigation")
    const sidebarScope = within(sidebar)
    const expectedSections = [
      "运营工作台",
      "会诊单管理",
      "流程催办",
      "专家服务",
      "质控归档",
      "消息通知",
      "统计分析",
      "系统设置",
    ]

    for (const section of expectedSections) {
      expect(sidebarScope.getByRole("button", { name: section })).toBeTruthy()
    }

    expect(sidebarScope.queryByText("医生协同")).toBeNull()
    expect(
      sidebarScope
        .getAllByRole("button")
        .map((button) => button.textContent?.trim())
        .filter(Boolean),
    ).toEqual(expectedSections)
  })

  it("creates a new expert and generates an invite code", async () => {
    const user = userEvent.setup()

    render(<AdminView session={createDemoSession()} dispatch={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "专家服务" }))

    expect(screen.queryByText("专家服务管理")).toBeNull()
    expect(screen.getByText("专家总数")).toBeTruthy()

    const form = screen.getByText("新专家录入").closest("form")
    expect(form).toBeTruthy()

    const formScope = within(form as HTMLElement)
    await user.clear(formScope.getByLabelText("姓名"))
    await user.type(formScope.getByLabelText("姓名"), "王主任")
    await user.clear(formScope.getByLabelText("联系方式"))
    await user.type(formScope.getByLabelText("联系方式"), "137****8108")
    await user.click(formScope.getByRole("button", { name: "录入并生成邀请码" }))

    const expertRow = screen.getByText("王主任 · 主任医师").closest("tr")
    expect(expertRow).toBeTruthy()
    expect(expertRow?.textContent).not.toContain("单 /")
    expect(expertRow?.textContent).not.toContain("待处理")
    expect(within(expertRow as HTMLElement).getByText("已生成")).toBeTruthy()
    expect(within(expertRow as HTMLElement).getByRole("button", { name: /QYXY-/ })).toBeTruthy()
    expect(within(expertRow as HTMLElement).getByText("未开通")).toBeTruthy()
    expect(within(expertRow as HTMLElement).queryByRole("button", { name: "可约" })).toBeNull()
    expect(within(expertRow as HTMLElement).queryByRole("button", { name: "忙碌" })).toBeNull()
    expect(within(expertRow as HTMLElement).queryByRole("button", { name: "暂停" })).toBeNull()
  })

  it("does not expose service controls or activation actions before expert app activation", async () => {
    const user = userEvent.setup()

    render(<AdminView session={createDemoSession()} dispatch={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "专家服务" }))

    expect(screen.queryByRole("button", { name: "激活" })).toBeNull()

    const invitedExpertRow = screen.getByText("陈医生 · 副主任医师").closest("tr")
    expect(invitedExpertRow).toBeTruthy()
    expect(invitedExpertRow?.textContent).not.toContain("单 /")
    expect(invitedExpertRow?.textContent).not.toContain("待处理")
    const rowScope = within(invitedExpertRow as HTMLElement)
    expect(rowScope.getByText("已邀约")).toBeTruthy()
    expect(rowScope.getByText("未开通")).toBeTruthy()
    expect(rowScope.queryByRole("button", { name: "可约" })).toBeNull()
    expect(rowScope.queryByRole("button", { name: "忙碌" })).toBeNull()
    expect(rowScope.queryByRole("button", { name: "暂停" })).toBeNull()
  })

  it("keeps activated expert service column to status controls only", async () => {
    const user = userEvent.setup()

    render(<AdminView session={createDemoSession()} dispatch={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "专家服务" }))

    const activatedExpertRow = screen.getByText("卢主任 · 主任医师").closest("tr")
    expect(activatedExpertRow).toBeTruthy()
    expect(activatedExpertRow?.textContent).not.toContain("单 /")
    expect(activatedExpertRow?.textContent).not.toContain("待处理")

    const rowScope = within(activatedExpertRow as HTMLElement)
    expect(rowScope.getByRole("button", { name: "可约" })).toBeTruthy()
    expect(rowScope.getByRole("button", { name: "忙碌" })).toBeTruthy()
    expect(rowScope.getByRole("button", { name: "暂停" })).toBeTruthy()
  })

  it("shows realistic report metrics without the section intro card", async () => {
    const user = userEvent.setup()

    render(<AdminView session={createDemoSession()} dispatch={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "统计分析" }))

    expect(screen.queryByRole("heading", { name: "统计分析" })).toBeNull()
    expect(screen.getByText("会诊总量")).toBeTruthy()
    expect(screen.getByText("126")).toBeTruthy()
    expect(screen.getByText("闭环率")).toBeTruthy()
    expect(screen.getByText("79%")).toBeTruthy()
    expect(screen.getByText("资料补充率")).toBeTruthy()
    expect(screen.getByText("18%")).toBeTruthy()
    expect(screen.getByText("平均响应")).toBeTruthy()
    expect(screen.getByText("16 分钟")).toBeTruthy()

    const statusCard = screen.getByText("状态分布").closest("[data-slot='card']")
    expect(statusCard).toBeTruthy()
    const statusScope = within(statusCard as HTMLElement)
    expect(statusScope.getByText("已归档")).toBeTruthy()
    expect(statusScope.getByText("92 单")).toBeTruthy()
    expect(statusScope.getByText("待运营归档")).toBeTruthy()
    expect(statusScope.getByText("7 单")).toBeTruthy()
    expect(statusScope.getByText("会诊中")).toBeTruthy()
    expect(statusScope.getAllByText("1 单").length).toBeGreaterThan(0)
  })

  it("changes case detail handling by consultation status", async () => {
    const user = userEvent.setup()

    render(<AdminView session={createDemoSession()} dispatch={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "会诊单管理" }))

    expect(screen.getByText("当前节点处理")).toBeTruthy()
    expect(screen.getByText("草稿跟进")).toBeTruthy()
    expect(screen.getByRole("button", { name: "催医生提交" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "质控通过并归档" })).toBeNull()

    const table = screen.getByRole("table")

    await user.click(within(table).getByText("刘某某").closest("tr") as HTMLTableRowElement)
    expect(screen.getByText("专家预审跟进")).toBeTruthy()
    expect(screen.getByRole("button", { name: "催专家预审" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "改派专家" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "标记紧急" })).toBeTruthy()

    await user.click(within(table).getByText("周某某").closest("tr") as HTMLTableRowElement)
    expect(screen.getByText("资料补充跟进")).toBeTruthy()
    expect(screen.getByRole("button", { name: "催医生补资料" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "查看补充要求" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "记录电话沟通" })).toBeTruthy()

    await user.click(within(table).getByText("孙某某").closest("tr") as HTMLTableRowElement)
    expect(screen.getByText("会诊准备确认")).toBeTruthy()
    expect(screen.getByRole("button", { name: "复制会议号" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "打开外部系统" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "提醒医生/专家" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "标记会诊异常" })).toBeTruthy()

    await user.click(within(table).getByText("陈某某").closest("tr") as HTMLTableRowElement)
    expect(screen.getByText("专家建议跟进")).toBeTruthy()
    expect(screen.getByRole("button", { name: "催专家提交建议" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "标记逾期" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "记录催办" })).toBeTruthy()

    await user.click(within(table).getByText("韩某某").closest("tr") as HTMLTableRowElement)
    expect(screen.getByText("运营质控归档")).toBeTruthy()
    expect(screen.getByRole("button", { name: "质控通过并归档" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "退回整改" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "填写归档说明" })).toBeTruthy()
  })

  it("shows emergency handoff handling for offline emergency cases", async () => {
    const user = userEvent.setup()
    const session = createDemoSession()
    session.activeConsultation = {
      ...session.activeConsultation,
      status: "offline_emergency",
      priority: "urgent",
      expertId: "expert-lu",
    }

    render(<AdminView session={session} dispatch={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "会诊单管理" }))

    expect(screen.getByText("线下急诊跟踪")).toBeTruthy()
    expect(screen.getByRole("button", { name: "记录急诊跟踪" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "催医生回填结果" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "关闭线上会诊" })).toBeTruthy()
  })

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

  it("shows a quality archive center with queue, checks, and archive package", async () => {
    const user = userEvent.setup()

    render(<AdminView session={createDemoSession()} dispatch={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "质控归档" }))

    expect(screen.getByRole("heading", { name: "质控归档中心" })).toBeTruthy()
    expect(screen.getByText("待质控")).toBeTruthy()
    expect(screen.getAllByText("有缺项").length).toBeGreaterThan(0)
    expect(screen.getAllByText("整改中").length).toBeGreaterThan(0)
    expect(screen.getByText("抽检通过率")).toBeTruthy()
    expect(screen.getByText("质控队列")).toBeTruthy()
    expect(screen.getByText("核查清单")).toBeTruthy()
    expect(screen.getByText("归档包")).toBeTruthy()
    expect(screen.queryByText("问题整改")).toBeNull()
    expect(screen.queryByText("抽检复核")).toBeNull()
    expect(screen.queryByText("资料缺失")).toBeNull()
    expect(screen.queryByRole("button", { name: "创建整改任务" })).toBeNull()
    expect(screen.queryByRole("button", { name: "发起抽检" })).toBeNull()
  })

  it("places doctor rejection directly below the checklist for missing quality cases", async () => {
    const user = userEvent.setup()
    const dispatch = vi.fn()

    render(<AdminView session={createDemoSession()} dispatch={dispatch} />)

    await user.click(screen.getByRole("button", { name: "质控归档" }))

    const checklistCard = screen.getByText("核查清单").closest("[data-slot='card']")
    expect(checklistCard).toBeTruthy()

    const checklist = within(checklistCard as HTMLElement)
    const rejectButton = checklist.getByRole("button", { name: "驳回医生端补充" })
    expect(rejectButton).toBeTruthy()

    await user.click(rejectButton)

    expect(dispatch).toHaveBeenCalledWith({
      type: "admin.sendReminder",
      input: {
        targetRole: "doctor",
        title: "质控驳回：请补充会诊资料",
        detail: expect.stringContaining("赵某某"),
      },
    })
  })

  it("places archive action directly below the checklist for archivable quality cases", async () => {
    const user = userEvent.setup()

    render(<AdminView session={createDemoSession()} dispatch={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: "质控归档" }))
    await user.click(screen.getByText("韩某某 · 全科门诊").closest("button") as HTMLButtonElement)

    const checklistCard = screen.getByText("核查清单").closest("[data-slot='card']")
    expect(checklistCard).toBeTruthy()

    const checklist = within(checklistCard as HTMLElement)
    expect(checklist.getByText("可归档")).toBeTruthy()

    await user.click(checklist.getByRole("button", { name: "归档" }))

    const caseHeader = screen.getByText("韩某某 质控办理").closest("[data-slot='card']")
    expect(caseHeader).toBeTruthy()
    expect(within(caseHeader as HTMLElement).getByText("已归档")).toBeTruthy()
    expect(checklist.queryByRole("button", { name: "归档" })).toBeNull()
  })
})
