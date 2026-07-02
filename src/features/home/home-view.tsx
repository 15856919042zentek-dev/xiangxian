import {
  ArrowRightIcon,
  ClipboardListIcon,
  MonitorIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  StethoscopeIcon,
} from "lucide-react"

import { StatusBadge } from "@/components/workflow"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { DemoSession } from "@/domain/demo-session"

export function HomeView({ session }: { session: DemoSession }) {
  const consultation = session.activeConsultation

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="flex flex-col justify-center gap-4 rounded-2xl border bg-card p-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={consultation.status} />
            <span className="text-sm text-muted-foreground">
              当前会诊单：{consultation.id}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="max-w-3xl text-3xl font-semibold tracking-tight lg:text-4xl">
              乡贤助医远程问诊协同工作台
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
              面向基层医生、乡贤专家和运营管理人员，支撑远程会诊申请、专家预审、资料补充、远程沟通、建议确认和流程归档。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href="/doctor">
                <MonitorIcon data-icon="inline-start" />
                进入医生端
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="/expert">
                <SmartphoneIcon data-icon="inline-start" />
                进入专家端
              </a>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>当前会诊概况</CardTitle>
            <CardDescription>医生端、专家端与运营端共享同一业务状态。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <InfoLine label="患者" value={`${consultation.patient.name} · ${consultation.patient.age}岁`} />
            <InfoLine label="申请科室" value={consultation.department} />
            <InfoLine label="会诊目的" value={consultation.consultationPurpose} />
            <InfoLine label="附件数量" value={`${consultation.attachments.length} 份`} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <EntryCard
          href="/doctor"
          title="医生端"
          description="建单、录入病情、补充资料、陪同会诊、确认本地处置。"
          icon={MonitorIcon}
        />
        <EntryCard
          href="/expert"
          title="专家端 App"
          description="移动端预审资料、确认会诊时间、提交结构化会诊建议。"
          icon={SmartphoneIcon}
        />
        <EntryCard
          href="/admin"
          title="运营管理端"
          description="监管会诊进度、专家排班、流程留痕和协同通知。"
          icon={StethoscopeIcon}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <CapabilityCard
          title="端侧协同"
          description="医生端提交、专家端处理、运营端监管，关键状态实时落到同一会诊单。"
          icon={ClipboardListIcon}
        />
        <CapabilityCard
          title="专家预审"
          description="专家可在接诊前要求补充资料，避免信息不足造成低效会诊。"
          icon={StethoscopeIcon}
        />
        <CapabilityCard
          title="流程留痕"
          description="申请、补充、接诊、建议、处置、归档节点可追溯。"
          icon={ShieldCheckIcon}
        />
      </section>
    </div>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm leading-6">{value}</div>
    </div>
  )
}

function EntryCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string
  title: string
  description: string
  icon: typeof ClipboardListIcon
}) {
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <a href={href}>
            进入
            <ArrowRightIcon data-icon="inline-end" />
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}

function CapabilityCard({
  title,
  description,
  icon: Icon,
}: {
  title: string
  description: string
  icon: typeof ClipboardListIcon
}) {
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}
