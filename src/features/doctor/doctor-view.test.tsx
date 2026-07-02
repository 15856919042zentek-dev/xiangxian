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
    const menuLabels = sidebarScope
      .getAllByRole("button")
      .map((item) => item.textContent?.trim())
    expect(menuLabels).toEqual(["工作台", "会诊单管理", "诊后管理", "消息中心", "我的设置"])
    for (const section of ["工作台", "会诊单管理", "诊后管理", "消息中心", "我的设置"]) {
      expect(sidebarScope.getByRole("button", { name: section })).toBeTruthy()
    }
    expect(sidebarScope.queryByRole("button", { name: "医生工作台" })).toBeNull()
    expect(sidebarScope.queryByRole("button", { name: "随访转诊" })).toBeNull()
    expect(sidebarScope.queryByRole("button", { name: "消息通知" })).toBeNull()

    await user.click(sidebarScope.getByRole("button", { name: "会诊单管理" }))

    expect(screen.getByRole("heading", { name: "会诊单管理" })).toBeTruthy()
    expect(
      screen.queryByText("新建、补资料、外部会诊执行和本地处置统一在当前办理面板完成。"),
    ).toBeNull()
    expect(screen.getByRole("button", { name: "新建会诊单" })).toBeTruthy()
    expect(screen.getByText("会诊队列")).toBeTruthy()
    expect(screen.getByText("申请信息")).toBeTruthy()
    expect(screen.getByText("病例资料")).toBeTruthy()
    expect(screen.getByText("专家协同")).toBeTruthy()
    expect(screen.queryByText("处置记录")).toBeNull()
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

  it("shows a consultation-only workbench queue with external meeting and message tasks separated", () => {
    const session = createDemoSession()
    session.notifications = [
      {
        id: "notice-doctor-1",
        audience: "doctor",
        title: "专家要求补充资料",
        detail: "请补充近期用药清单后重新提交预审。",
      },
    ]

    render(<DoctorView session={session} dispatch={vi.fn()} />)

    expect(screen.getByRole("heading", { name: "待办概览" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "今日待办队列" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "外部会诊提醒" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "消息任务" })).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "当前重点会诊" })).toBeNull()
    expect(screen.queryByRole("button", { name: "新建会诊单" })).toBeNull()

    expect(screen.getByText("待提交草稿")).toBeTruthy()
    expect(screen.getByText("待补资料").parentElement?.textContent).toContain("1")
    expect(screen.getByText("待外部会诊").parentElement?.textContent).toContain("1")
    expect(screen.getByText("质控退回")).toBeTruthy()
    expect(screen.getByText("刘某某 · 神经内科")).toBeTruthy()
    expect(screen.getByText("待专家预审")).toBeTruthy()
    expect(screen.getByText("陈某某 · 心血管内科")).toBeTruthy()
    expect(screen.getByText("待专家建议")).toBeTruthy()
    expect(screen.getAllByRole("button", { name: "运营催办专家" }).length).toBeGreaterThan(0)
    expect(screen.getByText("即将进行")).toBeTruthy()
    expect(screen.getByText("会议号 QY-1500")).toBeTruthy()
    expect(screen.getByText("本周会诊日历")).toBeTruthy()
    expect(screen.getByText("周四 09:30")).toBeTruthy()
    expect(screen.getByText("周五 19:30")).toBeTruthy()
    expect(
      screen.queryByText("聚合医生侧办理事项和需运营催办专家的会诊节点。"),
    ).toBeNull()

    const queue = screen.getByTestId("doctor-workbench-task-queue")
    expect(within(queue).queryByText("专家要求补充资料")).toBeNull()
    expect(screen.getByText("专家要求补充资料")).toBeTruthy()
    expect(screen.getByRole("button", { name: "查看消息任务" })).toBeTruthy()
  })

  it("routes expert reminders from the doctor workbench through the admin reminder action", async () => {
    const user = userEvent.setup()
    const dispatch = vi.fn()

    render(<DoctorView session={createDemoSession()} dispatch={dispatch} />)

    const pendingExpertTask = screen.getByTestId("doctor-task-pending-expert")
    await user.click(within(pendingExpertTask).getByRole("button", { name: "运营催办专家" }))

    expect(dispatch).toHaveBeenCalledWith({
      type: "admin.sendReminder",
      input: {
        targetRole: "expert",
        title: "运营催办专家预审",
        detail: "医生工作台提醒：刘某某的会诊单待专家预审，请专家及时处理。",
      },
    })
  })

  it("shows multi-status consultation records and trims draft details to draft-only work", async () => {
    const user = userEvent.setup()

    render(<DoctorView session={createDemoSession()} dispatch={vi.fn()} />)

    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: "会诊单管理" }))

    const queue = screen.getByTestId("doctor-case-list")
    expect(within(queue).getByText("赵某某 · 心血管内科")).toBeTruthy()
    expect(within(queue).getByText("刘某某 · 神经内科")).toBeTruthy()
    expect(within(queue).getByText("周某某 · 内分泌科")).toBeTruthy()
    expect(within(queue).getByText("孙某某 · 呼吸内科")).toBeTruthy()
    expect(within(queue).getByText("陈某某 · 心血管内科")).toBeTruthy()

    expect(screen.getByRole("heading", { name: "赵某某 会诊办理" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "查阅专家可预约时间" })).toBeTruthy()
    expect(screen.getByText("今日 09:30")).toBeTruthy()
    expect(screen.getByText("今日 15:00")).toBeTruthy()
    expect(screen.queryByText("外部会议号")).toBeNull()
    expect(screen.queryByText("处置记录")).toBeNull()

    const applicationSection = screen.getByTestId("application-section")
    expect(within(applicationSection).queryByRole("button", { name: "保存草稿" })).toBeNull()
    expect(within(applicationSection).queryByRole("button", { name: "提交专家预审" })).toBeNull()
    const actionFooter = screen.getByTestId("case-action-footer")
    expect(within(actionFooter).getByRole("button", { name: "保存草稿" })).toBeTruthy()
    expect(within(actionFooter).getByRole("button", { name: "提交专家预审" })).toBeTruthy()
  })

  it("changes the right detail sections for records that need material upload", async () => {
    const user = userEvent.setup()

    render(<DoctorView session={createDemoSession()} dispatch={vi.fn()} />)

    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: "会诊单管理" }))
    await user.click(screen.getByRole("button", { name: "周某某 · 内分泌科" }))

    expect(screen.getByRole("heading", { name: "周某某 会诊办理" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "上传补充资料" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "确认补充资料" })).toBeTruthy()
    expect(screen.queryByText("处置记录")).toBeNull()
  })

  it("turns follow-up and referral into a doctor post-care management workspace", async () => {
    const user = userEvent.setup()

    render(<DoctorView session={createDemoSession()} dispatch={vi.fn()} />)

    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: "诊后管理" }))

    expect(screen.getByRole("heading", { name: "诊后管理" })).toBeTruthy()
    expect(screen.getByText("诊后队列")).toBeTruthy()
    for (const status of [
      "待制定计划",
      "待随访",
      "周期随访中",
      "待转诊",
      "转诊跟踪中",
      "闭环待确认",
      "已闭环",
    ]) {
      expect(screen.getAllByText(status).length).toBeGreaterThan(0)
    }

    expect(screen.getByText("专家建议引用")).toBeTruthy()
    expect(screen.getByText("诊后计划")).toBeTruthy()
    expect(screen.getByText("随访计划")).toBeTruthy()
    expect(screen.getByText("随访日程")).toBeTruthy()
    expect(screen.getByText("本次随访办理")).toBeTruthy()
    expect(screen.getByText("第 1/4 次")).toBeTruthy()
    expect(screen.getByText("每 3 天一次")).toBeTruthy()
    expect(screen.getByText("结束条件")).toBeTruthy()
    expect(screen.getByText("转诊跟踪")).toBeTruthy()
    expect(screen.getByText("闭环确认")).toBeTruthy()
    expect(screen.getByRole("button", { name: "保存计划" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "启动随访" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "完成本次随访" })).toBeNull()
    expect(
      screen.queryByText("一期先记录随访和转诊结果，不接入外部预约挂号或医保系统。"),
    ).toBeNull()
  })

  it("changes post-care actions according to each patient's status", async () => {
    const user = userEvent.setup()

    render(<DoctorView session={createDemoSession()} dispatch={vi.fn()} />)

    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: "诊后管理" }))

    await user.click(screen.getByRole("button", { name: "沈某某 · 待随访" }))
    expect(screen.getByRole("button", { name: "完成并生成下次" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "改期随访" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "无法联系" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "转入转诊" })).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "李某某 · 待转诊" }))
    expect(screen.getByRole("button", { name: "登记转诊" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "确认患者同意" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "确认到院" })).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "吴某某 · 转诊跟踪中" }))
    expect(screen.getByRole("button", { name: "补充检查结果" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "转回本地随访" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "进入闭环确认" })).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "郑某某 · 闭环待确认" }))
    expect(screen.getByRole("button", { name: "确认闭环" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "继续随访" })).toBeTruthy()
  })

  it("shows actionable doctor messages with cross-section entry points", async () => {
    const user = userEvent.setup()

    render(<DoctorView session={createDemoSession()} dispatch={vi.fn()} />)

    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: "消息中心" }))

    expect(screen.getByRole("heading", { name: "消息中心" })).toBeTruthy()
    expect(screen.getByText("消息列表")).toBeTruthy()
    for (const filter of ["全部", "未读", "待处理", "会诊相关", "诊后相关"]) {
      expect(screen.getByRole("button", { name: filter })).toBeTruthy()
    }
    expect(screen.getByText("消息详情")).toBeTruthy()
    expect(screen.getByText("关联会诊单")).toBeTruthy()
    expect(screen.getByText("消息来源")).toBeTruthy()
    expect(screen.getByRole("button", { name: "去补充资料" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "进入会诊办理" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "进入诊后管理" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "全部已读" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "归档已处理" })).toBeTruthy()
  })

  it("provides editable doctor settings for profile, consultation settings, reminders, templates, and account", async () => {
    const user = userEvent.setup()

    render(<DoctorView session={createDemoSession()} dispatch={vi.fn()} />)

    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: "我的设置" }))

    expect(screen.getByRole("heading", { name: "我的设置" })).toBeTruthy()
    for (const section of ["医生资料", "会诊设置", "消息提醒", "常用模板", "账号安全"]) {
      expect(screen.getByText(section)).toBeTruthy()
    }
    expect(screen.getByRole("button", { name: "编辑资料" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "编辑会诊设置" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "编辑提醒设置" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "新增模板" })).toBeTruthy()
    expect(screen.getAllByRole("button", { name: "编辑模板" }).length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "账号安全" })).toBeTruthy()
    expect(within(screen.getByRole("list", { name: "常用拟邀专家列表" })).getAllByRole("listitem")).toHaveLength(3)

    await user.click(screen.getByRole("button", { name: "编辑资料" }))
    expect(screen.getByRole("button", { name: "保存资料" })).toBeTruthy()
    expect(screen.getByLabelText("医生姓名")).toBeTruthy()
    expect(screen.getByLabelText("联系电话")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "编辑提醒设置" }))
    expect(screen.getByRole("button", { name: "保存提醒设置" })).toBeTruthy()
    expect(screen.getByLabelText("会诊前提醒")).toBeTruthy()
    expect(screen.getByLabelText("诊后随访到期提醒")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "编辑会诊设置" }))
    expect(screen.getByRole("button", { name: "保存会诊设置" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "新增常用专家" })).toBeTruthy()
    expect(screen.getAllByRole("button", { name: "移除专家" }).length).toBeGreaterThan(0)
  })
})
