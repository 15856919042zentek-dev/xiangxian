import { Building2Icon, MonitorIcon, RotateCcwIcon, SmartphoneIcon, StethoscopeIcon } from "lucide-react"
import type { Dispatch, ReactNode } from "react"

import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { DemoAction, DemoSession } from "@/domain/demo-session"
import { StatusBadge } from "@/components/workflow"

type Route = "home" | "doctor" | "expert" | "admin"

interface AppShellProps {
  route: Route
  session: DemoSession
  dispatch: Dispatch<DemoAction>
  children: ReactNode
}

const navItems = [
  { href: "/home", label: "工作台总览", route: "home", icon: Building2Icon },
  { href: "/doctor", label: "医生端", route: "doctor", icon: MonitorIcon },
  { href: "/expert", label: "专家端 App", route: "expert", icon: SmartphoneIcon },
  { href: "/admin", label: "运营管理端", route: "admin", icon: StethoscopeIcon },
] as const

export function AppShell({ route, session, dispatch, children }: AppShellProps) {
  if (route === "expert") {
    return (
      <div className="expert-app-theme min-h-screen min-h-svh bg-background px-3 py-4">
        {children}
      </div>
    )
  }

  const isConsoleRoute = route === "admin" || route === "doctor"
  const title =
    route === "admin"
      ? "乡贤助医 运营管理端"
      : route === "doctor"
        ? "乡贤助医 医生工作台"
        : "漆园英贤·乡贤助医远程问诊平台"
  const subtitle = isConsoleRoute ? "" : "本地医生发起、乡贤专家协同、运营全程监管"

  return (
    <div className={isConsoleRoute ? "admin-app-theme min-h-screen min-h-svh bg-background" : "min-h-screen min-h-svh bg-background"}>
      <header className={isConsoleRoute ? "console-header sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/78" : "sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"}>
        <div className={isConsoleRoute ? "mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-3 lg:px-6" : "mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-4 lg:px-6"}>
          <div className={isConsoleRoute ? "console-header-row flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between" : "flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"}>
            <div className={isConsoleRoute ? "console-brand flex items-center gap-3" : "flex items-center gap-3"}>
              <div className={isConsoleRoute ? "flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"}>
                <StethoscopeIcon className="size-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <h1 className="text-lg font-semibold tracking-tight">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-sm text-muted-foreground">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            {isConsoleRoute ? (
              <ConsoleUserProfile />
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={session.activeConsultation.status} />
                <Button variant="outline" onClick={() => dispatch({ type: "session.reset" })}>
                  <RotateCcwIcon data-icon="inline-start" />
                  新建会诊单
                </Button>
              </div>
            )}
          </div>
          {!isConsoleRoute && (
            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = route === item.route

                return (
                  <Button key={item.href} asChild variant={active ? "default" : "outline"}>
                    <a href={item.href}>
                      <Icon data-icon="inline-start" />
                      {item.label}
                    </a>
                  </Button>
                )
              })}
            </nav>
          )}
        </div>
        {!isConsoleRoute && <Separator />}
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-5 lg:px-6">{children}</main>
    </div>
  )
}

function ConsoleUserProfile() {
  return (
    <div
      aria-label="当前登录用户"
      role="group"
      className="console-user-profile flex w-full items-center gap-3 rounded-xl border border-border/80 bg-card/80 px-3 py-2 shadow-sm lg:w-auto lg:min-w-72 lg:justify-end"
    >
      <Avatar size="lg" className="ring-2 ring-primary/10">
        <AvatarFallback className="bg-primary/10 font-semibold text-primary">王</AvatarFallback>
        <AvatarBadge />
      </Avatar>
      <div className="min-w-0 flex-1 lg:flex-none">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium leading-none">王医生</span>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            已登录
          </span>
        </div>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          蒙城县中医院 · 全科门诊
        </div>
      </div>
    </div>
  )
}
