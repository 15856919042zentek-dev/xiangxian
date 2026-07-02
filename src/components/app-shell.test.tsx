// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createDemoSession } from "@/domain/demo-session"

import { AppShell } from "./app-shell"

afterEach(() => cleanup())

describe("AppShell console routes", () => {
  it("uses the operations-style chrome for the doctor route", () => {
    render(
      <AppShell route="doctor" session={createDemoSession()} dispatch={vi.fn()}>
        <div>医生端内容</div>
      </AppShell>,
    )

    expect(screen.getByRole("heading", { name: "乡贤助医 医生工作台" })).toBeTruthy()
    expect(screen.getByText("医生端内容")).toBeTruthy()
    expect(screen.getByLabelText("当前登录用户").textContent).toContain("王医生")
    expect(screen.getByLabelText("当前登录用户").textContent).toContain("蒙城县中医院")
    expect(screen.queryByRole("link", { name: "专家端 App" })).toBeNull()
    expect(screen.queryByRole("button", { name: "新建会诊单" })).toBeNull()
  })

  it("shows the signed-in doctor user on the operations route", () => {
    render(
      <AppShell route="admin" session={createDemoSession()} dispatch={vi.fn()}>
        <div>运营端内容</div>
      </AppShell>,
    )

    expect(screen.getByRole("heading", { name: "乡贤助医 运营管理端" })).toBeTruthy()
    expect(screen.getByText("运营端内容")).toBeTruthy()
    expect(screen.getByLabelText("当前登录用户").textContent).toContain("王医生")
    expect(screen.getByLabelText("当前登录用户").textContent).toContain("已登录")
  })
})
