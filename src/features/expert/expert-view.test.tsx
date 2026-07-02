// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createDemoSession } from "@/domain/demo-session"

import { ExpertView } from "./expert-view"

afterEach(() => cleanup())

describe("ExpertView consultation detail", () => {
  it("omits auxiliary helper descriptions while keeping expert app controls", async () => {
    const user = userEvent.setup()

    render(<ExpertView session={createDemoSession()} dispatch={vi.fn()} />)

    expect(screen.getByText("专家登录")).toBeTruthy()
    expect(screen.getByLabelText("登录用户名")).toBeTruthy()
    expect(
      screen.queryByText("首次登录请填写邀请码完成专家身份绑定。"),
    ).toBeNull()
    expect(
      screen.queryByText("邀请码由运营人员或医院管理员发放。"),
    ).toBeNull()

    await user.click(screen.getByTestId("expert-login-submit"))
    await waitFor(() => expect(screen.getByText("今日工作台")).toBeTruthy())

    expect(screen.getByText("本周日程")).toBeTruthy()
    expect(screen.getByText("快捷入口")).toBeTruthy()
    expect(screen.queryByText("本周可约与已约会诊安排")).toBeNull()
    expect(screen.queryByText("常用服务工具")).toBeNull()

    await user.click(screen.getByRole("button", { name: "会诊" }))

    expect(screen.getByText("会诊管理")).toBeTruthy()
    expect(screen.getByTestId("consultation-category-all")).toBeTruthy()
    expect(
      screen.queryByText("按患者对象汇总专家相关会诊，便于快速进入明细处理。"),
    ).toBeNull()

    await user.click(screen.getByTestId("consultation-open-consult-20260712-101"))

    expect(screen.getByText("患者与诉求")).toBeTruthy()
    expect(screen.getByText("病例资料")).toBeTruthy()
    expect(screen.getByText("沟通记录")).toBeTruthy()
    expect(screen.getByText("流程留痕")).toBeTruthy()
    expect(
      screen.queryByText("由本地医生线下接诊后发起远程会诊"),
    ).toBeNull()
    expect(
      screen.queryByText("会诊所需检查报告、影像资料和补充材料"),
    ).toBeNull()
    expect(
      screen.queryByText("医生与专家围绕本次会诊的业务沟通"),
    ).toBeNull()
    expect(
      screen.queryByText("关键节点可追溯，便于运营监管和质控复盘"),
    ).toBeNull()
    expect(
      screen.queryByText(
        "提交后会形成专家预审确认节点，同步运营平台用于质控、催办接诊或跟进补充资料。",
      ),
    ).toBeNull()

    await user.click(screen.getByTestId("consultation-detail-back"))
    await user.click(screen.getByRole("button", { name: "我的" }))

    expect(screen.getByText("我的服务")).toBeTruthy()
    expect(screen.getByText("接诊状态")).toBeTruthy()
    expect(screen.getByText("可约时间")).toBeTruthy()
    expect(screen.getByText("常用模板")).toBeTruthy()
    expect(screen.queryByText("可接收新的会诊邀请")).toBeNull()
    expect(screen.queryByText("可新增、启停或删除服务时段")).toBeNull()
    expect(screen.queryByText("支持启停和编辑建议模板")).toBeNull()
  })

  it("starts on the expert app login homepage and enters the workbench", async () => {
    const user = userEvent.setup()

    render(<ExpertView session={createDemoSession()} dispatch={vi.fn()} />)

    expect(
      screen.getByRole("heading", { name: /漆园英贤\s*乡贤助医/ }),
    ).toBeTruthy()
    expect((screen.getByLabelText("登录用户名") as HTMLInputElement).value).toBe(
      "expert-lu",
    )
    expect((screen.getByLabelText("登录密码") as HTMLInputElement).value).toBe(
      "demo123456",
    )
    expect((screen.getByLabelText("首次登录邀请码") as HTMLInputElement).value).toBe(
      "QYXY-2026",
    )

    await user.click(screen.getByTestId("expert-login-submit"))

    await waitFor(() => expect(screen.getByText("今日工作台")).toBeTruthy())
  })

  it("submits an expert confirmation and reflects operation sync in the list", async () => {
    const user = userEvent.setup()

    render(
      <ExpertView
        session={createDemoSession()}
        dispatch={vi.fn()}
        initialAuthenticated
      />,
    )

    await user.click(screen.getByRole("button", { name: "会诊" }))
    await user.click(screen.getByTestId("consultation-open-consult-20260712-101"))

    expect(screen.getByText("提交专家确认")).toBeTruthy()
    expect(screen.queryByText("已提交专家确认")).toBeNull()

    await user.click(screen.getByTestId("expert-submit-confirmation"))

    expect(screen.getByText("已提交专家确认")).toBeTruthy()

    await user.click(screen.getByTestId("consultation-detail-back"))

    expect(screen.getByText("已提交运营")).toBeTruthy()
    expect(screen.getByText("专家确认已同步运营平台")).toBeTruthy()
  })

  it("marks submitted expert records as changed when edited again", async () => {
    const user = userEvent.setup()

    render(
      <ExpertView
        session={createDemoSession()}
        dispatch={vi.fn()}
        initialAuthenticated
      />,
    )

    await user.click(screen.getByRole("button", { name: "会诊" }))
    await user.click(screen.getByTestId("consultation-open-consult-20260712-101"))
    await user.click(screen.getByTestId("expert-submit-confirmation"))
    await user.click(screen.getByTestId("detail-note-edit"))
    await user.type(screen.getByTestId("expert-note-input"), "补充关注近期心电图动态变化。")

    expect(screen.getByText("已修改未提交")).toBeTruthy()
    expect(screen.getByText("重新提交专家确认")).toBeTruthy()
  })
})
