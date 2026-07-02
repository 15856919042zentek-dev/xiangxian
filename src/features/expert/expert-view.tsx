import {
  ActivityIcon,
  ArrowLeftIcon,
  AwardIcon,
  BellIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  Clock3Icon,
  FileQuestionIcon,
  FileTextIcon,
  HeartPulseIcon,
  HistoryIcon,
  HospitalIcon,
  HomeIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  MessageCircleIcon,
  NotebookPenIcon,
  PencilIcon,
  PhoneCallIcon,
  PlusIcon,
  PowerIcon,
  SaveIcon,
  SendIcon,
  SettingsIcon,
  ShieldCheckIcon,
  StarIcon,
  StethoscopeIcon,
  Trash2Icon,
  UserRoundIcon,
  VideoIcon,
  XIcon,
} from "lucide-react"
import {
  type ComponentType,
  type Dispatch,
  type FormEvent,
  useMemo,
  useState,
} from "react"

import {
  AdvicePanel,
  AttachmentList,
  CommunicationLog,
  ConsultationRoom,
  PatientSummary,
  StatusBadge,
  WorkflowTimeline,
  attachmentTypeLabels,
} from "@/components/workflow"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { DemoAction, DemoSession } from "@/domain/demo-session"
import type {
  AttachmentType,
  Consultation,
  ConsultationStatus,
  ExpertProfile,
} from "@/domain/types"
import { cn } from "@/lib/utils"

interface ExpertViewProps {
  session: DemoSession
  dispatch: Dispatch<DemoAction>
  initialAuthenticated?: boolean
}

type ExpertTab = "workbench" | "consultations" | "messages" | "profile"
type ServiceStatus = "available" | "busy" | "paused"
type ConsultationCategoryKey =
  | "all"
  | "pending_expert"
  | "needs_more_info"
  | "scheduled"
  | "waiting_consultation"
  | "pending_advice"
  | "completed"
type ExpertSubmissionStatus = "draft" | "changed" | "submitted"
type ExpertWorkspaceMap = Record<string, ExpertWorkspaceItem>
type ExpertWorkspaceChange = (
  updater: (item: ExpertWorkspaceItem) => ExpertWorkspaceItem,
) => void

interface ExpertWorkspaceItem {
  pinned: boolean
  note: string
  draftAdvice: string
  updatedAt: string
  submissionStatus: ExpertSubmissionStatus
  submittedAt: string
  prepItems: ExpertPrepItem[]
}

interface ExpertPrepItem {
  id: string
  label: string
  checked: boolean
}

const defaultRequiredTypes: AttachmentType[] = ["ecg", "medication_list"]
const workbenchCounts = {
  pendingReview: 2,
  pendingAdvice: 1,
  todayConsultation: 1,
  informationSupplement: 3,
}
const defaultPrepItems: ExpertPrepItem[] = [
  { id: "review-history", label: "核对主诉与既往史", checked: true },
  { id: "review-attachments", label: "确认关键检查资料", checked: false },
  { id: "prepare-advice", label: "准备会诊建议草稿", checked: false },
]
const serviceStatusLabels: Record<ServiceStatus, string> = {
  available: "可接诊",
  busy: "忙碌",
  paused: "暂停",
}

const expertLoginDefaults = {
  username: "expert-lu",
  password: "demo123456",
  inviteCode: "QYXY-2026",
}

const tabItems: Array<{
  value: ExpertTab
  label: string
  icon: ComponentType<{ className?: string }>
}> = [
  { value: "workbench", label: "工作台", icon: HomeIcon },
  { value: "consultations", label: "会诊", icon: ClipboardListIcon },
  { value: "messages", label: "消息", icon: BellIcon },
  { value: "profile", label: "我的", icon: UserRoundIcon },
]

const statusStageLabels: Record<ConsultationStatus, string> = {
  draft: "待医生提交",
  pending_expert: "待预审",
  needs_more_info: "待补充",
  scheduled: "已预约",
  in_consultation: "待会诊",
  pending_advice: "待建议",
  pending_doctor_confirm: "待医生确认",
  completed: "已完成",
  archived: "已归档",
  expert_declined: "已婉拒",
  patient_cancelled: "患者取消",
  closed_incomplete: "资料不足",
  offline_emergency: "线下急诊",
}

const consultationCategories: Array<{
  key: ConsultationCategoryKey
  label: string
}> = [
  {
    key: "all",
    label: "全部",
  },
  {
    key: "pending_expert",
    label: "待预审",
  },
  {
    key: "needs_more_info",
    label: "待补充",
  },
  {
    key: "scheduled",
    label: "已预约",
  },
  {
    key: "waiting_consultation",
    label: "待会诊",
  },
  {
    key: "pending_advice",
    label: "待建议",
  },
  {
    key: "completed",
    label: "已完成",
  },
]

export function ExpertView({
  session,
  dispatch,
  initialAuthenticated = false,
}: ExpertViewProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuthenticated)
  const [activeTab, setActiveTab] = useState<ExpertTab>("workbench")
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>("available")
  const [workspaceItems, setWorkspaceItems] = useState<ExpertWorkspaceMap>({})
  const consultation = session.activeConsultation
  const expert =
    session.experts.find((item) => item.id === consultation.expertId) ??
    session.experts[0]
  const pendingCount = getWorkbenchPendingCount()

  function updateWorkspaceItem(
    consultationId: string,
    updater: (item: ExpertWorkspaceItem) => ExpertWorkspaceItem,
  ) {
    setWorkspaceItems((current) => {
      const previous = current[consultationId] ?? createDefaultWorkspaceItem()

      return {
        ...current,
        [consultationId]: updater(previous),
      }
    })
  }

  return (
    <div className="mx-auto max-w-[430px] text-[15px]">
      <div className="rounded-[2rem] border border-border/80 bg-card p-2 shadow-2xl shadow-primary/10 ring-1 ring-primary/10">
        <div className="flex h-[860px] max-h-[calc(100svh-2rem)] flex-col overflow-hidden rounded-[1.5rem] bg-background">
          <PhoneStatusBar />
          {!isAuthenticated ? (
            <ExpertLoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />
          ) : (
            <>
          <ExpertAppHeader
            expert={expert}
            pendingCount={pendingCount}
            serviceStatus={serviceStatus}
          />

          <main key={activeTab} className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
            {activeTab === "workbench" && (
              <WorkbenchTab
                session={session}
                setActiveTab={setActiveTab}
              />
            )}
            {activeTab === "consultations" && (
              <ConsultationsTab
                session={session}
                expert={expert}
                workspaceItems={workspaceItems}
                updateWorkspaceItem={updateWorkspaceItem}
                dispatch={dispatch}
              />
            )}
            {activeTab === "messages" && <MessagesTab session={session} />}
            {activeTab === "profile" && (
              <ProfileTab
                expert={expert}
                consultation={consultation}
                serviceStatus={serviceStatus}
                setServiceStatus={setServiceStatus}
              />
            )}
          </main>

          <ExpertBottomNav
            activeTab={activeTab}
            pendingCount={pendingCount}
            onChange={setActiveTab}
          />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function PhoneStatusBar() {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between px-6 text-xs font-medium text-muted-foreground">
      <span>9:41</span>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2.5 w-3.5 rounded-sm border border-current" />
        <span className="h-2.5 w-3.5 rounded-sm bg-current" />
        <span className="h-2.5 w-6 rounded-sm border border-current">
          <span className="block h-full w-4 rounded-sm bg-current" />
        </span>
      </div>
    </div>
  )
}

function ExpertLoginScreen({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [username, setUsername] = useState(expertLoginDefaults.username)
  const [password, setPassword] = useState(expertLoginDefaults.password)
  const [inviteCode, setInviteCode] = useState(expertLoginDefaults.inviteCode)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!username.trim() || !password.trim()) {
      setError("请输入登录用户名和密码。")
      return
    }

    setError("")
    setIsSubmitting(true)
    window.setTimeout(() => {
      onLoginSuccess()
    }, 350)
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background px-4 pb-5">
      <section className="flex min-h-full flex-col gap-5 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
              <StethoscopeIcon className="size-6" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">专家端 App</div>
              <div className="text-sm font-semibold">乡贤助医远程问诊</div>
            </div>
          </div>
          <Badge className="bg-accent text-accent-foreground" variant="secondary">
            邀请制
          </Badge>
        </div>

        <div className="rounded-xl border border-primary/15 bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-xs font-medium text-primary">
            <ShieldCheckIcon className="size-4" />
            蒙城县漆园英贤
          </div>
          <h1 className="text-3xl font-semibold leading-tight tracking-normal">
            漆园英贤
            <br />
            乡贤助医
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            面向乡贤专家的远程问诊工作台
          </p>
        </div>

        <Card className="mt-auto rounded-xl border-primary/10 bg-card/95 shadow-xl shadow-primary/10 ring-primary/10">
          <CardHeader className="gap-2">
            <CardTitle className="text-xl">专家登录</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="expert-login-username">
                    <UserRoundIcon className="size-4" />
                    登录用户名
                  </FieldLabel>
                  <Input
                    id="expert-login-username"
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="手机号或专家账号"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="expert-login-password">
                    <LockKeyholeIcon className="size-4" />
                    登录密码
                  </FieldLabel>
                  <Input
                    id="expert-login-password"
                    autoComplete="current-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="请输入登录密码"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="expert-login-invite-code">
                    <KeyRoundIcon className="size-4" />
                    首次登录邀请码
                  </FieldLabel>
                  <Input
                    id="expert-login-invite-code"
                    autoComplete="one-time-code"
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value)}
                    placeholder="首次登录必填，非首次可留空"
                  />
                </Field>
              </FieldGroup>

              {error && (
                <Alert variant="destructive">
                  <ActivityIcon className="size-4" />
                  <AlertTitle>登录信息不完整</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                data-testid="expert-login-submit"
                className="h-11 rounded-lg text-base"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "登录中..." : "登录进入"}
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}

function ExpertAppHeader({
  expert,
  pendingCount,
  serviceStatus,
}: {
  expert: ExpertProfile
  pendingCount: number
  serviceStatus: ServiceStatus
}) {
  return (
    <header className="shrink-0 px-3 pb-3">
      <div className="rounded-xl border border-primary/15 bg-card p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar size="lg" className="ring-2 ring-primary/15">
              <AvatarFallback>{expert.name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-semibold">{expert.name}</h2>
                <Badge className="bg-secondary text-secondary-foreground" variant="secondary">
                  {serviceStatusLabels[serviceStatus]}
                </Badge>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {expert.department} · {expert.title}
              </p>
            </div>
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <StethoscopeIcon className="size-5" />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <HeaderMetric label="待办" value={pendingCount} />
          <HeaderMetric label="今日" value={workbenchCounts.todayConsultation} />
          <HeaderMetric label="完成" value={18} />
        </div>
      </div>
    </header>
  )
}

function HeaderMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 rounded-lg bg-secondary/80 px-3 py-2 text-center text-secondary-foreground">
      <div className="text-lg font-semibold leading-none">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function WorkbenchTab({
  session,
  setActiveTab,
}: {
  session: DemoSession
  setActiveTab: Dispatch<ExpertTab>
}) {
  const consultation = session.activeConsultation
  const cards = getWorkbenchCards()

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader title="今日工作台" action="6项待处理" />
      <TodayFocusCard
        consultation={consultation}
        onOpen={() => setActiveTab("consultations")}
      />
      <div className="grid grid-cols-2 gap-2">
        {cards.map((card) => (
          <WorkbenchMetricCard key={card.label} {...card} />
        ))}
      </div>

      <UrgentConsultationCard
        consultation={consultation}
        onOpen={() => setActiveTab("consultations")}
      />

      <ScheduleCalendarPreview consultation={consultation} />

      <ServiceContributionCard />

      <Card size="sm" className="border-primary/10">
        <CardHeader>
          <CardTitle>本周日程</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ScheduleItem
            time={consultation.scheduledAt ?? "今日待确认"}
            title={`${consultation.department} · ${consultation.patient.name}`}
            description="蒙城县中医院"
            active={consultation.status === "scheduled" || consultation.status === "in_consultation"}
          />
          <ScheduleItem
            time="今日 15:00"
            title="慢病用药复核"
            description="乡贤助医服务中心"
            active
          />
          <ScheduleItem
            time="周三 19:30"
            title="胸痛风险复盘"
            description="蒙城县第一人民医院"
          />
          <ScheduleItem
            time="周五 10:00"
            title="高血压随访指导"
            description="漆园社区卫生服务站"
          />
        </CardContent>
      </Card>

      <Card size="sm" className="border-primary/10">
        <CardHeader>
          <CardTitle>快捷入口</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-4 gap-2">
          <QuickAction icon={CalendarClockIcon} label="排班" />
          <QuickAction icon={NotebookPenIcon} label="模板" />
          <QuickAction icon={HistoryIcon} label="历史" />
          <QuickAction icon={SettingsIcon} label="设置" />
        </CardContent>
      </Card>
    </div>
  )
}

function TodayFocusCard({
  consultation,
  onOpen,
}: {
  consultation: Consultation
  onOpen: () => void
}) {
  return (
    <Card size="sm" className="border-primary/20 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <HeartPulseIcon className="size-4 text-primary" />
            今日待接诊
          </span>
          <Badge variant={consultation.priority === "urgent" ? "destructive" : "secondary"}>
            {consultation.priority === "urgent" ? "重点风险" : "常规"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="rounded-xl border border-primary/15 bg-secondary/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium text-primary">
                <VideoIcon className="size-4" />
                即将开始的视频问诊
              </div>
              <div className="mt-2 truncate text-base font-semibold">
                {consultation.department} · {consultation.patient.name}
              </div>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {consultation.consultationPurpose}
              </p>
            </div>
            <Button
              data-testid="today-focus-open"
              size="sm"
              onClick={onOpen}
            >
              进入
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <InfoPill icon={Clock3Icon} label={consultation.scheduledAt ?? "待确认"} />
          <InfoPill icon={FileTextIcon} label={`${consultation.attachments.length}份资料`} />
          <InfoPill icon={NotebookPenIcon} label="待复审" />
        </div>
      </CardContent>
    </Card>
  )
}

function WorkbenchMetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: ComponentType<{ className?: string }>
  tone: "primary" | "secondary"
}) {
  return (
    <div
      data-testid={`workbench-metric-${label}`}
      className={cn(
        "rounded-xl border p-3 shadow-sm",
        tone === "primary"
          ? "border-primary/20 bg-primary text-primary-foreground"
          : "border-primary/10 bg-card",
      )}
    >
      <div className="flex items-center justify-between">
        <Icon className="size-4" />
        <span className="text-2xl font-semibold leading-none">{value}</span>
      </div>
      <div
        className={cn(
          "mt-2 text-xs",
          tone === "primary" ? "text-primary-foreground/80" : "text-muted-foreground",
        )}
      >
        {label}
      </div>
    </div>
  )
}

function UrgentConsultationCard({
  consultation,
  onOpen,
}: {
  consultation: Consultation
  onOpen: () => void
}) {
  return (
    <Card size="sm" className="border-primary/20 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>病例复审队列</span>
          <Badge variant={consultation.priority === "urgent" ? "destructive" : "secondary"}>
            {consultation.priority === "urgent" ? "紧急" : "待关注"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div
          className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-primary/15 bg-secondary/50 p-3 text-left"
        >
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BellIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {consultation.department} · {consultation.patient.name}
            </div>
            <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {consultation.consultationPurpose}
            </div>
          </div>
          <Button
            data-testid="urgent-consultation-card"
            size="icon-sm"
            variant="ghost"
            onClick={onOpen}
          >
            <ChevronRightIcon />
            <span className="sr-only">进入会诊</span>
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <MiniStat label="资料" value={consultation.attachments.length} />
          <MiniStat label="沟通" value={consultation.messages.length} />
          <MiniStat label="节点" value={consultation.timeline.length} />
        </div>
      </CardContent>
    </Card>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted px-2 py-2">
      <div className="text-base font-semibold leading-none">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function ScheduleCalendarPreview({ consultation }: { consultation: Consultation }) {
  const days = [
    { date: "07/01", week: "三", status: "可接诊", tone: "available" },
    { date: "07/02", week: "四", status: "已预约", tone: "booked" },
    { date: "07/03", week: "五", status: "不可用", tone: "blocked" },
    { date: "07/04", week: "六", status: "待确认", tone: "pending" },
  ] as const

  return (
    <Card size="sm" className="border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDaysIcon className="size-4 text-primary" />
          排班日历
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          {days.map((day) => (
            <ScheduleDay key={day.date} {...day} />
          ))}
        </div>
        <div className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-xl border border-primary/10 bg-card p-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarClockIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {consultation.scheduledAt ?? "今日待确认"} · {consultation.patient.name}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {consultation.department}视频问诊
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ScheduleDay({
  date,
  week,
  status,
  tone,
}: {
  date: string
  week: string
  status: string
  tone: "available" | "booked" | "blocked" | "pending"
}) {
  return (
    <div
      className={cn(
        "flex min-h-20 flex-col justify-between rounded-lg border p-2 text-center",
        tone === "available" && "border-primary/20 bg-primary/10 text-primary",
        tone === "booked" && "border-primary/30 bg-primary text-primary-foreground",
        tone === "blocked" && "border-border bg-muted text-muted-foreground",
        tone === "pending" && "border-accent bg-accent text-accent-foreground",
      )}
    >
      <div className="text-[11px]">{week}</div>
      <div className="text-sm font-semibold">{date}</div>
      <div className="text-[11px] font-medium">{status}</div>
    </div>
  )
}

function ServiceContributionCard() {
  return (
    <Card size="sm" className="border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AwardIcon className="size-4 text-primary" />
          服务贡献
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-2">
        <ContributionMetric label="服务次数" value="26" />
        <ContributionMetric label="患者评价" value="4.9" />
        <ContributionMetric label="贡献积分" value="1280" accent />
      </CardContent>
    </Card>
  )
}

function ContributionMetric({
  label,
  value,
  accent = false,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2 py-3 text-center",
        accent
          ? "border-accent bg-accent text-accent-foreground"
          : "border-primary/10 bg-secondary/60",
      )}
    >
      <div className="text-lg font-semibold leading-none">{value}</div>
      <div
        className={cn(
          "mt-1 text-[11px] font-medium",
          accent ? "text-accent-foreground/80" : "text-muted-foreground",
        )}
      >
        {label}
      </div>
    </div>
  )
}

function ConsultationsTab({
  session,
  expert,
  workspaceItems,
  updateWorkspaceItem,
  dispatch,
}: {
  session: DemoSession
  expert: ExpertProfile
  workspaceItems: ExpertWorkspaceMap
  updateWorkspaceItem: (
    consultationId: string,
    updater: (item: ExpertWorkspaceItem) => ExpertWorkspaceItem,
  ) => void
  dispatch: Dispatch<DemoAction>
}) {
  const [selectedCategory, setSelectedCategory] =
    useState<ConsultationCategoryKey>("all")
  const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(
    null,
  )
  const consultations = useMemo(
    () => getExpertConsultationQueue(session.activeConsultation, expert.id),
    [expert.id, session.activeConsultation],
  )
  const filteredConsultations = useMemo(
    () =>
      consultations.filter((consultation) =>
        isConsultationInCategory(consultation, selectedCategory),
      ),
    [consultations, selectedCategory],
  )
  const selectedConsultation = selectedConsultationId
    ? consultations.find((consultation) => consultation.id === selectedConsultationId)
    : undefined
  const selectedCategoryMeta = getConsultationCategoryMeta(selectedCategory)

  function handleCategoryChange(category: ConsultationCategoryKey) {
    setSelectedCategory(category)
    setSelectedConsultationId(null)
  }

  if (selectedConsultation) {
    return (
      <ConsultationDetailScreen
        consultation={selectedConsultation}
        expert={expert}
        dispatch={dispatch}
        isCurrentConsultation={selectedConsultation.id === session.activeConsultation.id}
        doctorLabel={getLocalDoctorLabel(session, selectedConsultation)}
        workspaceItem={getWorkspaceItem(workspaceItems, selectedConsultation.id)}
        onWorkspaceChange={(updater) =>
          updateWorkspaceItem(selectedConsultation.id, updater)
        }
        onBack={() => setSelectedConsultationId(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader title="会诊管理" action={`${filteredConsultations.length}个对象`} />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {consultationCategories.map((category) => (
          <button
            key={category.key}
            data-testid={`consultation-category-${category.key}`}
            className={cn(
              "flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              selectedCategory === category.key
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground",
            )}
            onClick={() => handleCategoryChange(category.key)}
            type="button"
          >
            <span>{category.label}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px]",
                selectedCategory === category.key
                  ? "bg-primary-foreground/15"
                  : "bg-muted",
              )}
            >
              {getConsultationCategoryCount(consultations, category.key)}
            </span>
          </button>
        ))}
      </div>

      <Card size="sm" className="border-primary/20 bg-secondary/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardListIcon className="size-4 text-primary" />
            {selectedCategoryMeta.label}
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="flex flex-col gap-2">
        {filteredConsultations.map((consultation) => (
          <ConsultationObjectCard
            key={consultation.id}
            consultation={consultation}
            doctorLabel={getLocalDoctorLabel(session, consultation)}
            workspaceItem={getWorkspaceItem(workspaceItems, consultation.id)}
            onTogglePinned={() =>
              updateWorkspaceItem(consultation.id, (item) => ({
                ...item,
                pinned: !item.pinned,
                updatedAt: "刚刚",
              }))
            }
            onOpen={() => setSelectedConsultationId(consultation.id)}
          />
        ))}
      </div>
    </div>
  )
}

function ConsultationObjectCard({
  consultation,
  doctorLabel,
  workspaceItem,
  onTogglePinned,
  onOpen,
}: {
  consultation: Consultation
  doctorLabel: string
  workspaceItem: ExpertWorkspaceItem
  onTogglePinned: () => void
  onOpen: () => void
}) {
  const category = getConsultationCategoryMeta(
    getConsultationCategoryKey(consultation),
  )
  const completedPrepCount = workspaceItem.prepItems.filter((item) => item.checked).length
  const submitted = workspaceItem.submissionStatus === "submitted"
  const changed = workspaceItem.submissionStatus === "changed"

  return (
    <div
      data-testid={`consultation-object-${consultation.id}`}
      className="rounded-xl border border-primary/10 bg-card p-3 shadow-sm"
    >
      <button
        data-testid={`consultation-open-${consultation.id}`}
        className="grid w-full grid-cols-[auto_1fr_auto] items-start gap-3 text-left"
        onClick={onOpen}
        type="button"
      >
        <Avatar className="size-11 ring-2 ring-secondary">
          <AvatarFallback>{consultation.patient.name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold">
              {consultation.patient.name} · {consultation.patient.gender} ·{" "}
              {consultation.patient.age}岁
            </div>
            {consultation.priority === "urgent" && (
              <Badge variant="destructive">紧急</Badge>
            )}
            {workspaceItem.pinned && <Badge>重点</Badge>}
            {submitted && <Badge variant="secondary">已提交运营</Badge>}
            {changed && <Badge variant="outline">待重新提交</Badge>}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{doctorLabel}</p>
          <p className="mt-2 line-clamp-2 text-xs leading-5">
            {consultation.chiefComplaint}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{category.label}</Badge>
            <Badge variant="outline">{consultation.department}</Badge>
            <Badge variant="outline">
              {consultation.scheduledAt ?? "待约定"}
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <ObjectMetric label="资料" value={consultation.attachments.length} />
            <ObjectMetric label="沟通" value={consultation.messages.length} />
            <ObjectMetric label="节点" value={consultation.timeline.length} />
          </div>
        </div>
        <ChevronRightIcon className="mt-1 size-4 text-muted-foreground" />
      </button>
      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
        <div className="min-w-0 text-xs text-muted-foreground">
          <div className="truncate">
            {submitted
              ? "专家确认已同步运营平台"
              : changed
                ? "专家记录已修改，待重新提交"
                : workspaceItem.note || `准备 ${completedPrepCount}/${workspaceItem.prepItems.length}`}
          </div>
          <div className="mt-1">
            {submitted ? `提交 ${workspaceItem.submittedAt}` : `更新 ${workspaceItem.updatedAt}`}
          </div>
        </div>
        <Button
          data-testid={`consultation-pin-${consultation.id}`}
          size="sm"
          variant={workspaceItem.pinned ? "default" : "outline"}
          onClick={onTogglePinned}
        >
          <ShieldCheckIcon data-icon="inline-start" />
          {workspaceItem.pinned ? "已关注" : "关注"}
        </Button>
      </div>
    </div>
  )
}

function ObjectMetric({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-lg bg-secondary/70 px-2 py-1 text-center text-[11px] text-muted-foreground">
      <span className="font-semibold text-foreground">{value}</span> {label}
    </span>
  )
}

function ConsultationDetailScreen({
  consultation,
  expert,
  dispatch,
  isCurrentConsultation,
  doctorLabel,
  workspaceItem,
  onWorkspaceChange,
  onBack,
}: {
  consultation: Consultation
  expert: ExpertProfile
  dispatch: Dispatch<DemoAction>
  isCurrentConsultation: boolean
  doctorLabel: string
  workspaceItem: ExpertWorkspaceItem
  onWorkspaceChange: ExpertWorkspaceChange
  onBack: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 -mx-3 bg-background/95 px-3 pb-2 pt-1 backdrop-blur">
        <Button
          data-testid="consultation-detail-back"
          size="sm"
          variant="ghost"
          onClick={onBack}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          返回列表
        </Button>
      </div>

      <ConsultationDetailHeader
        consultation={consultation}
        doctorLabel={doctorLabel}
      />
      <ConsultationSummaryCard consultation={consultation} />
      <ClinicalRiskPanel consultation={consultation} />
      {["scheduled", "in_consultation", "pending_advice"].includes(consultation.status) && (
        <ConsultationRoom consultation={consultation} />
      )}
      {isCurrentConsultation ? (
        <ExpertActionPanel
          consultation={consultation}
          expert={expert}
          dispatch={dispatch}
        />
      ) : (
        <ConsultationStatusPanel consultation={consultation} />
      )}
      <ExpertWorkspacePanel
        consultation={consultation}
        workspaceItem={workspaceItem}
        onWorkspaceChange={onWorkspaceChange}
      />
      <PatientSummary consultation={consultation} showDescription={false} />
      <AttachmentList consultation={consultation} showDescription={false} />
      <CommunicationLog consultation={consultation} showDescription={false} />
      <AdvicePanel consultation={consultation} showDescription={false} />
      <WorkflowTimeline consultation={consultation} showDescription={false} />
    </div>
  )
}

function ConsultationDetailHeader({
  consultation,
  doctorLabel,
}: {
  consultation: Consultation
  doctorLabel: string
}) {
  const category = getConsultationCategoryMeta(
    getConsultationCategoryKey(consultation),
  )

  return (
    <Card size="sm" className="border-primary/20 bg-card">
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2">
          <span className="flex items-center gap-2">
            <HeartPulseIcon className="size-4 text-primary" />
            {consultation.patient.name} · {consultation.patient.gender} ·{" "}
            {consultation.patient.age}岁
          </span>
          <Badge variant="secondary">{category.label}</Badge>
        </CardTitle>
        <CardDescription>
          {doctorLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="rounded-xl border border-primary/10 bg-secondary/60 p-3 text-sm leading-6">
          {consultation.chiefComplaint}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <HeaderMetric label="资料" value={consultation.attachments.length} />
          <HeaderMetric label="沟通" value={consultation.messages.length} />
          <HeaderMetric label="节点" value={consultation.timeline.length} />
        </div>
      </CardContent>
    </Card>
  )
}

function ConsultationStatusPanel({ consultation }: { consultation: Consultation }) {
  return (
    <Card size="sm" className="border-primary/20">
      <CardHeader>
        <CardTitle>当前状态</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <StatusNotice
          title={getReadonlyStatusTitle(consultation.status)}
        />
        <div className="grid grid-cols-3 gap-2">
          <InfoPill icon={Clock3Icon} label={consultation.scheduledAt ?? "待约定"} />
          <InfoPill icon={FileTextIcon} label={`${consultation.attachments.length}份资料`} />
          <InfoPill icon={MessageCircleIcon} label={`${consultation.messages.length}条沟通`} />
        </div>
      </CardContent>
    </Card>
  )
}

function ClinicalRiskPanel({ consultation }: { consultation: Consultation }) {
  const urgent = consultation.priority === "urgent"

  return (
    <Card
      size="sm"
      className={cn(
        "border-primary/20",
        urgent ? "border-destructive/25 bg-destructive/5" : "bg-card",
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <ActivityIcon
              className={cn("size-4", urgent ? "text-destructive" : "text-primary")}
            />
            风险提示
          </span>
          <Badge variant={urgent ? "destructive" : "secondary"}>
            {urgent ? "需优先处理" : "常规复核"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <InfoLine label="既往史" value={consultation.patient.pastHistory} />
        <InfoLine label="过敏史" value={consultation.patient.allergyHistory} />
        <InfoLine label="当前诉求" value={consultation.consultationPurpose} />
      </CardContent>
    </Card>
  )
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-2 rounded-lg border bg-card px-3 py-2 text-sm leading-6">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function ExpertWorkspacePanel({
  consultation,
  workspaceItem,
  onWorkspaceChange,
}: {
  consultation: Consultation
  workspaceItem: ExpertWorkspaceItem
  onWorkspaceChange: ExpertWorkspaceChange
}) {
  const [editingNote, setEditingNote] = useState(false)
  const [editingDraft, setEditingDraft] = useState(false)
  const completedPrepCount = workspaceItem.prepItems.filter((item) => item.checked).length
  const submissionPlan = getExpertSubmissionPlan(consultation)
  const submitted = workspaceItem.submissionStatus === "submitted"
  const changed = workspaceItem.submissionStatus === "changed"
  const readyToSubmit =
    completedPrepCount > 0 ||
    workspaceItem.note.trim().length > 0 ||
    workspaceItem.draftAdvice.trim().length > 0

  function updateNote(note: string) {
    onWorkspaceChange((item) => markWorkspaceEdited(item, { note }))
  }

  function updateDraft(draftAdvice: string) {
    onWorkspaceChange((item) => markWorkspaceEdited(item, { draftAdvice }))
  }

  function togglePinned() {
    onWorkspaceChange((item) => ({
      ...item,
      pinned: !item.pinned,
      updatedAt: "刚刚",
    }))
  }

  function togglePrepItem(itemId: string) {
    onWorkspaceChange((item) =>
      markWorkspaceEdited(item, {
        prepItems: item.prepItems.map((prepItem) =>
          prepItem.id === itemId
            ? { ...prepItem, checked: !prepItem.checked }
            : prepItem,
        ),
      }),
    )
  }

  function submitExpertConfirmation() {
    onWorkspaceChange((item) => ({
      ...item,
      submissionStatus: "submitted",
      submittedAt: "刚刚",
      updatedAt: "刚刚",
    }))
    setEditingNote(false)
    setEditingDraft(false)
  }

  return (
    <Card size="sm" className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>专家工作记录</span>
          <Button
            size="sm"
            variant={workspaceItem.pinned ? "default" : "outline"}
            onClick={togglePinned}
          >
            <ShieldCheckIcon data-icon="inline-start" />
            {workspaceItem.pinned ? "已重点" : "重点关注"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {workspaceItem.prepItems.map((item) => (
            <button
              key={item.id}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                item.checked
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "bg-muted/40 text-muted-foreground",
              )}
              onClick={() => togglePrepItem(item.id)}
              type="button"
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border",
                  item.checked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background",
                )}
              >
                {item.checked && <CheckIcon className="size-3" />}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium">专家备注</div>
            <Button
              data-testid="detail-note-edit"
              size="sm"
              variant="ghost"
              onClick={() => setEditingNote((current) => !current)}
            >
              {editingNote ? (
                <SaveIcon data-icon="inline-start" />
              ) : (
                <PencilIcon data-icon="inline-start" />
              )}
              {editingNote ? "保存" : "编辑"}
            </Button>
          </div>
          {editingNote ? (
            <Textarea
              data-testid="expert-note-input"
              value={workspaceItem.note}
              onChange={(event) => updateNote(event.target.value)}
              placeholder="记录本次会诊的预审判断、沟通重点或风险提示"
            />
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              {workspaceItem.note || "暂无备注。"}
            </p>
          )}
        </div>

        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium">建议草稿</div>
            <Button
              data-testid="detail-draft-edit"
              size="sm"
              variant="ghost"
              onClick={() => setEditingDraft((current) => !current)}
            >
              {editingDraft ? (
                <SaveIcon data-icon="inline-start" />
              ) : (
                <PencilIcon data-icon="inline-start" />
              )}
              {editingDraft ? "保存" : "编辑"}
            </Button>
          </div>
          {editingDraft ? (
            <Textarea
              data-testid="expert-draft-input"
              value={workspaceItem.draftAdvice}
              onChange={(event) => updateDraft(event.target.value)}
              placeholder="先记录待完善的专家建议，正式提交前可继续修改"
            />
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              {workspaceItem.draftAdvice || "暂无建议草稿。"}
            </p>
          )}
        </div>

        <div
          className={cn(
            "flex flex-col gap-3 rounded-xl border p-3",
            submitted ? "border-primary/30 bg-primary/5" : "bg-card",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                <SendIcon className="size-4 text-primary" />
                {submissionPlan.title}
              </div>
            </div>
            <Badge
              variant={
                submitted ? "secondary" : changed ? "outline" : "default"
              }
            >
              {getExpertSubmissionStatusLabel(workspaceItem.submissionStatus)}
            </Badge>
          </div>
          {submitted && (
            <StatusNotice
              title="已提交专家确认"
            />
          )}
          {changed && (
            <StatusNotice
              title="已修改未提交"
            />
          )}
          <Button
            data-testid="expert-submit-confirmation"
            disabled={!readyToSubmit || submitted}
            onClick={submitExpertConfirmation}
            variant={submitted ? "secondary" : "default"}
          >
            {submitted ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <SendIcon data-icon="inline-start" />
            )}
            {submitted
              ? "已提交运营"
              : changed
                ? "重新提交专家确认"
                : "提交专家确认"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ConsultationSummaryCard({ consultation }: { consultation: Consultation }) {
  return (
    <Card size="sm" className="border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>病例摘要</span>
          <StatusBadge status={consultation.status} />
        </CardTitle>
        <CardDescription>
          {consultation.department} · {consultation.priority === "urgent" ? "紧急" : "普通"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Alert>
          <FileTextIcon className="size-4" />
          <AlertTitle>会诊诉求</AlertTitle>
          <AlertDescription>{consultation.consultationPurpose}</AlertDescription>
        </Alert>
        <div className="grid grid-cols-3 gap-2">
          <InfoPill icon={Clock3Icon} label={consultation.scheduledAt ?? "待约定"} />
          <InfoPill icon={FileTextIcon} label={`${consultation.attachments.length}份资料`} />
          <InfoPill icon={MessageCircleIcon} label={`${consultation.messages.length}条沟通`} />
        </div>
      </CardContent>
    </Card>
  )
}

function ExpertActionPanel({
  consultation,
  expert,
  dispatch,
}: {
  consultation: Consultation
  expert: ExpertProfile
  dispatch: Dispatch<DemoAction>
}) {
  return (
    <Card size="sm" className="border-primary/20">
      <CardHeader>
        <CardTitle>当前操作</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {consultation.status === "pending_expert" && (
          <ExpertPreReviewActions
            expertId={expert.id}
            slots={expert.slots}
            dispatch={dispatch}
          />
        )}
        {consultation.status === "needs_more_info" && (
          <StatusNotice
            title="已发送补充资料要求"
          />
        )}
        {consultation.status === "scheduled" && (
          <StatusNotice
            title="已确认会诊安排"
          />
        )}
        {consultation.status === "in_consultation" && (
          <ExpertAdviceForm enabled dispatch={dispatch} />
        )}
        {consultation.status === "pending_advice" && (
          <ExpertAdviceForm enabled dispatch={dispatch} />
        )}
        {consultation.status === "pending_doctor_confirm" && (
          <StatusNotice
            title="建议已提交"
          />
        )}
        {(consultation.status === "completed" || consultation.status === "archived") && (
          <StatusNotice
            title="会诊已完成"
          />
        )}
        {consultation.status === "draft" && (
          <StatusNotice
            title="暂无待处理邀请"
          />
        )}
      </CardContent>
    </Card>
  )
}

function MessagesTab({ session }: { session: DemoSession }) {
  const consultation = session.activeConsultation
  const messages = useMemo(
    () => [
      {
        id: "current-status",
        icon: BellIcon,
        title: statusStageLabels[consultation.status],
        description: getStatusHint(consultation.status),
        time: "刚刚",
      },
      ...session.notifications.slice(-4).map((notification) => ({
        id: notification.id,
        icon: MessageCircleIcon,
        title: notification.title,
        description: notification.detail,
        time: "今日",
      })),
      {
        id: "operation",
        icon: ShieldCheckIcon,
        title: "运营提醒",
        description: "请按预约时间完成远程会诊，建议提交后将同步给本地医生。",
        time: "08:30",
      },
    ],
    [consultation.status, session.notifications],
  )

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader title="消息中心" action={`${messages.length}条`} />
      {messages.map((message) => (
        <MessageRow key={message.id} {...message} />
      ))}
    </div>
  )
}

function ProfileTab({
  expert,
  consultation,
  serviceStatus,
  setServiceStatus,
}: {
  expert: ExpertProfile
  consultation: Consultation
  serviceStatus: ServiceStatus
  setServiceStatus: Dispatch<ServiceStatus>
}) {
  const [editingProfile, setEditingProfile] = useState(false)
  const [profile, setProfile] = useState({
    name: expert.name,
    hospital: expert.hospital,
    department: expert.department,
    title: expert.title,
    specialties: expert.specialties.join("、"),
  })
  const [slots, setSlots] = useState(
    expert.slots.map((slot, index) => ({
      id: `slot-${index}`,
      label: slot,
      enabled: index !== 1,
    })),
  )
  const [newSlot, setNewSlot] = useState("周六 09:00")
  const [templates, setTemplates] = useState([
    {
      id: "template-risk",
      title: "心血管风险提示模板",
      content: "胸痛持续、出汗、气短或心电图动态改变时，建议立即线下急诊。",
      enabled: true,
      editing: false,
    },
    {
      id: "template-follow-up",
      title: "慢病复诊建议模板",
      content: "建议一周后复诊，复核血压、血糖、症状变化和用药依从性。",
      enabled: true,
      editing: false,
    },
  ])
  const pendingTasks = getPendingTaskCount(consultation.status)

  function updateProfile(key: keyof typeof profile, value: string) {
    setProfile((current) => ({ ...current, [key]: value }))
  }

  function addSlot() {
    const label = newSlot.trim()
    if (!label) return

    setSlots((current) => [
      ...current,
      { id: `slot-${Date.now()}`, label, enabled: true },
    ])
    setNewSlot("")
  }

  function toggleSlot(slotId: string) {
    setSlots((current) =>
      current.map((slot) =>
        slot.id === slotId ? { ...slot, enabled: !slot.enabled } : slot,
      ),
    )
  }

  function removeSlot(slotId: string) {
    setSlots((current) => current.filter((slot) => slot.id !== slotId))
  }

  function updateTemplate(
    templateId: string,
    changes: Partial<{ title: string; content: string; enabled: boolean; editing: boolean }>,
  ) {
    setTemplates((current) =>
      current.map((template) =>
        template.id === templateId ? { ...template, ...changes } : template,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Card size="sm" className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>我的服务</span>
            <Button
              size="sm"
              variant={editingProfile ? "default" : "outline"}
              onClick={() => setEditingProfile((current) => !current)}
            >
              {editingProfile ? (
                <SaveIcon data-icon="inline-start" />
              ) : (
                <PencilIcon data-icon="inline-start" />
              )}
              {editingProfile ? "保存" : "编辑"}
            </Button>
          </CardTitle>
          <CardDescription>{profile.hospital}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="rounded-xl border border-primary/15 bg-secondary/50 p-3">
            <div className="flex items-start gap-3">
              <Avatar size="lg" className="ring-2 ring-primary/15">
                <AvatarFallback>{profile.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold">{profile.name}</div>
                  <Badge className="bg-accent text-accent-foreground" variant="secondary">
                    乡贤荣誉服务
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <HospitalIcon className="size-4" />
                  <span className="truncate">{profile.hospital}</span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {profile.department} · {profile.title}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge>{serviceStatusLabels[serviceStatus]}</Badge>
                <Badge variant="outline">待办 {pendingTasks}</Badge>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">{expert.hometownTag}</Badge>
              {profile.specialties.split("、").map((specialty) => (
                <Badge key={specialty} variant="secondary">
                  {specialty}
                </Badge>
              ))}
            </div>
          </div>
          {editingProfile && (
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="expertName">姓名</FieldLabel>
                <Input
                  id="expertName"
                  value={profile.name}
                  onChange={(event) => updateProfile("name", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="expertHospital">所在医院</FieldLabel>
                <Input
                  id="expertHospital"
                  value={profile.hospital}
                  onChange={(event) =>
                    updateProfile("hospital", event.target.value)
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="expertTitle">科室与职称</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    id="expertTitle"
                    value={profile.department}
                    onChange={(event) =>
                      updateProfile("department", event.target.value)
                    }
                  />
                  <Input
                    value={profile.title}
                    onChange={(event) => updateProfile("title", event.target.value)}
                  />
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="expertSpecialties">擅长方向</FieldLabel>
                <Textarea
                  id="expertSpecialties"
                  value={profile.specialties}
                  onChange={(event) =>
                    updateProfile("specialties", event.target.value)
                  }
                />
              </Field>
            </FieldGroup>
          )}
          <div className="grid grid-cols-3 gap-2">
            <ArchiveMetric icon={ClipboardCheckIcon} label="服务次数" value="26" />
            <ArchiveMetric icon={StarIcon} label="患者评价" value="4.9" />
            <ArchiveMetric icon={AwardIcon} label="贡献积分" value="1280" accent />
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>接诊状态</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2">
          {(["available", "busy", "paused"] as const).map((status) => (
            <button
              key={status}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-2 rounded-lg border p-3 text-xs transition-colors",
                serviceStatus === status
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-muted/40 text-muted-foreground",
              )}
              onClick={() => setServiceStatus(status)}
              type="button"
            >
              <PowerIcon className="size-4" />
              <span>{serviceStatusLabels[status]}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>可约时间</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              value={newSlot}
              onChange={(event) => setNewSlot(event.target.value)}
              placeholder="例如 周六 09:00"
            />
            <Button size="icon" onClick={addSlot}>
              <PlusIcon />
              <span className="sr-only">新增时段</span>
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {slots.map((slot) => (
              <div
                key={slot.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-xl border border-primary/10 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{slot.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {slot.enabled ? "对医生可预约" : "已关闭预约"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={slot.enabled ? "outline" : "default"}
                  onClick={() => toggleSlot(slot.id)}
                >
                  {slot.enabled ? "停用" : "启用"}
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => removeSlot(slot.id)}
                >
                  <Trash2Icon />
                  <span className="sr-only">删除时段</span>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>常用模板</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {templates.map((template) => (
            <div key={template.id} className="rounded-xl border border-primary/10 p-3">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-primary">
                  <NotebookPenIcon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  {template.editing ? (
                    <Input
                      value={template.title}
                      onChange={(event) =>
                        updateTemplate(template.id, { title: event.target.value })
                      }
                    />
                  ) : (
                    <div className="truncate text-sm font-medium">
                      {template.title}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {template.enabled ? "启用中" : "已停用"}
                  </div>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() =>
                    updateTemplate(template.id, { editing: !template.editing })
                  }
                >
                  {template.editing ? <SaveIcon /> : <PencilIcon />}
                  <span className="sr-only">编辑模板</span>
                </Button>
              </div>
              {template.editing ? (
                <Textarea
                  className="mt-3"
                  value={template.content}
                  onChange={(event) =>
                    updateTemplate(template.id, { content: event.target.value })
                  }
                />
              ) : (
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {template.content}
                </p>
              )}
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  variant={template.enabled ? "outline" : "default"}
                  onClick={() =>
                    updateTemplate(template.id, { enabled: !template.enabled })
                  }
                >
                  {template.enabled ? (
                    <XIcon data-icon="inline-start" />
                  ) : (
                    <CheckIcon data-icon="inline-start" />
                  )}
                  {template.enabled ? "停用" : "启用"}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function ArchiveMetric({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2 py-3 text-center",
        accent
          ? "border-accent bg-accent text-accent-foreground"
          : "border-primary/10 bg-card",
      )}
    >
      <Icon className={cn("mx-auto mb-2 size-4", accent ? "" : "text-primary")} />
      <div className="text-lg font-semibold leading-none">{value}</div>
      <div
        className={cn(
          "mt-1 text-[11px] font-medium",
          accent ? "text-accent-foreground/80" : "text-muted-foreground",
        )}
      >
        {label}
      </div>
    </div>
  )
}

function ExpertBottomNav({
  activeTab,
  pendingCount,
  onChange,
}: {
  activeTab: ExpertTab
  pendingCount: number
  onChange: Dispatch<ExpertTab>
}) {
  return (
    <nav className="shrink-0 border-t bg-card/95 px-2 py-2 shadow-[0_-8px_24px] shadow-primary/5">
      <div className="grid grid-cols-4 gap-1">
        {tabItems.map((item) => {
          const Icon = item.icon
          const active = activeTab === item.value

          return (
            <button
              key={item.value}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg py-2 text-xs transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
              onClick={() => onChange(item.value)}
              type="button"
            >
              <Icon className="size-5" />
              <span>{item.label}</span>
              {item.value === "workbench" && pendingCount > 0 && (
                <span className="absolute right-5 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] text-primary-foreground">
                  {pendingCount}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function ExpertPreReviewActions({
  expertId,
  slots,
  dispatch,
}: {
  expertId: string
  slots: string[]
  dispatch: Dispatch<DemoAction>
}) {
  const [requestMessage, setRequestMessage] = useState(
    "请补充近期心电图和用药清单后再安排会诊。",
  )
  const [scheduledAt, setScheduledAt] = useState(slots[0] ?? "今日 09:30")

  function handleRequestMore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    dispatch({
      type: "expert.requestMoreInfo",
      input: {
        message: requestMessage,
        requiredAttachmentTypes: defaultRequiredTypes,
      },
    })
  }

  function handleAccept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    dispatch({
      type: "expert.accept",
      input: {
        expertId,
        scheduledAt,
      },
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-3"
        onSubmit={handleRequestMore}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileQuestionIcon className="size-4" />
          补充资料
        </div>
        <div className="flex flex-wrap gap-2">
          {defaultRequiredTypes.map((type) => (
            <Badge key={type} variant="secondary">
              {attachmentTypeLabels[type]}
            </Badge>
          ))}
        </div>
        <Textarea
          value={requestMessage}
          onChange={(event) => setRequestMessage(event.target.value)}
        />
        <Button type="submit" variant="outline">
          <FileQuestionIcon data-icon="inline-start" />
          要求补充资料
        </Button>
      </form>

      <form
        className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-secondary/60 p-3"
        onSubmit={handleAccept}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <CalendarCheckIcon className="size-4" />
          接受会诊
        </div>
        <Select value={scheduledAt} onValueChange={setScheduledAt}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {slots.map((slot) => (
              <SelectItem key={slot} value={slot}>
                {slot}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit">
          <CheckIcon data-icon="inline-start" />
          接受会诊
        </Button>
      </form>
    </div>
  )
}

function ExpertAdviceForm({
  enabled,
  dispatch,
}: {
  enabled: boolean
  dispatch: Dispatch<DemoAction>
}) {
  const [diagnosisSuggestion, setDiagnosisSuggestion] = useState(
    "考虑稳定型心绞痛可能，需排除急性冠脉综合征。",
  )
  const [examinationSuggestion, setExaminationSuggestion] = useState(
    "建议复查心电图、心肌酶谱，并完善血脂和血糖。",
  )
  const [treatmentSuggestion, setTreatmentSuggestion] = useState(
    "由本地医生结合现场血压、用药史和禁忌情况调整治疗方案。",
  )
  const [referralSuggestion, setReferralSuggestion] = useState(
    "若胸痛持续或指标异常，建议转县医院胸痛中心。",
  )
  const [riskNotice, setRiskNotice] = useState(
    "出现持续胸痛、出汗、濒死感时立即急诊。",
  )
  const [followUpSuggestion, setFollowUpSuggestion] = useState(
    "一周后复诊，评估症状变化和用药依从性。",
  )

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!enabled) return

    dispatch({
      type: "expert.submitAdvice",
      input: {
        diagnosisSuggestion,
        examinationSuggestion,
        treatmentSuggestion,
        referralSuggestion,
        riskNotice,
        followUpSuggestion,
      },
    })
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="diagnosisSuggestion">倾向意见</FieldLabel>
          <Textarea
            id="diagnosisSuggestion"
            value={diagnosisSuggestion}
            disabled={!enabled}
            onChange={(event) => setDiagnosisSuggestion(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="examinationSuggestion">检查建议</FieldLabel>
          <Textarea
            id="examinationSuggestion"
            value={examinationSuggestion}
            disabled={!enabled}
            onChange={(event) => setExaminationSuggestion(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="treatmentSuggestion">治疗参考</FieldLabel>
          <Textarea
            id="treatmentSuggestion"
            value={treatmentSuggestion}
            disabled={!enabled}
            onChange={(event) => setTreatmentSuggestion(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="referralSuggestion">转诊建议</FieldLabel>
          <Textarea
            id="referralSuggestion"
            value={referralSuggestion}
            disabled={!enabled}
            onChange={(event) => setReferralSuggestion(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="riskNotice">风险提示</FieldLabel>
          <Textarea
            id="riskNotice"
            value={riskNotice}
            disabled={!enabled}
            onChange={(event) => setRiskNotice(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="followUpSuggestion">随访建议</FieldLabel>
          <Textarea
            id="followUpSuggestion"
            value={followUpSuggestion}
            disabled={!enabled}
            onChange={(event) => setFollowUpSuggestion(event.target.value)}
          />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={!enabled}>
        <SendIcon data-icon="inline-start" />
        提交远程会诊建议
      </Button>
    </form>
  )
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <div className="flex items-center justify-between px-1">
      <h3 className="text-base font-semibold tracking-normal">{title}</h3>
      {action && <span className="text-xs text-muted-foreground">{action}</span>}
    </div>
  )
}

function QuickAction({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <button
      className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg bg-secondary/70 px-2 py-3 text-xs transition-colors hover:bg-secondary"
      type="button"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-card text-primary shadow-sm">
        <Icon className="size-4" />
      </span>
      <span>{label}</span>
    </button>
  )
}

function ScheduleItem({
  time,
  title,
  description,
  active = false,
}: {
  time: string
  title: string
  description: string
  active?: boolean
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-3">
      <div
        className={cn(
          "mt-1 size-3 rounded-full ring-4",
          active ? "bg-primary ring-primary/15" : "bg-muted-foreground/40 ring-muted",
        )}
      />
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-medium">{title}</span>
          <Badge variant={active ? "default" : "secondary"}>{time}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function InfoPill({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <div className="flex min-h-14 flex-col items-center gap-1 rounded-lg bg-secondary/70 px-2 py-2 text-center text-xs">
      <Icon className="size-4 text-primary" />
      <span className="line-clamp-1">{label}</span>
    </div>
  )
}

function MessageRow({
  icon: Icon,
  title,
  description,
  time,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  time: string
}) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-xl border border-primary/10 bg-card p-3">
      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{title}</div>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      <span className="text-xs text-muted-foreground">{time}</span>
    </div>
  )
}

function StatusNotice({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="rounded-xl border bg-muted/50 p-3">
      <div className="text-sm font-medium">{title}</div>
      {description && (
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

function getExpertConsultationQueue(
  activeConsultation: Consultation,
  expertId: string,
) {
  const fixtures = createExpertQueueFixtures(expertId)

  if (activeConsultation.status === "draft") {
    return fixtures
  }

  return capConsultationQueueByWorkbenchCounts([
    {
      ...activeConsultation,
      expertId: activeConsultation.expertId ?? expertId,
    },
    ...fixtures.filter((consultation) => consultation.id !== activeConsultation.id),
  ])
}

function capConsultationQueueByWorkbenchCounts(consultations: Consultation[]) {
  const caps: Partial<Record<ConsultationCategoryKey, number>> = {
    pending_expert: workbenchCounts.pendingReview,
    needs_more_info: workbenchCounts.informationSupplement,
    pending_advice: workbenchCounts.pendingAdvice,
  }
  const seen: Partial<Record<ConsultationCategoryKey, number>> = {}

  return consultations.filter((consultation) => {
    const category = getConsultationCategoryKey(consultation)
    const cap = caps[category]

    if (!cap) return true

    const nextCount = (seen[category] ?? 0) + 1
    seen[category] = nextCount

    return nextCount <= cap
  })
}

function getConsultationCategoryKey(
  consultation: Consultation,
): ConsultationCategoryKey {
  switch (consultation.status) {
    case "pending_expert":
      return "pending_expert"
    case "needs_more_info":
      return "needs_more_info"
    case "scheduled":
      return "scheduled"
    case "in_consultation":
      return "waiting_consultation"
    case "pending_advice":
      return "pending_advice"
    case "completed":
    case "archived":
    case "pending_doctor_confirm":
      return "completed"
    default:
      return "all"
  }
}

function getConsultationCategoryMeta(key: ConsultationCategoryKey) {
  return (
    consultationCategories.find((category) => category.key === key) ??
    consultationCategories[0]
  )
}

function isConsultationInCategory(
  consultation: Consultation,
  category: ConsultationCategoryKey,
) {
  if (category === "all") return true

  return getConsultationCategoryKey(consultation) === category
}

function getConsultationCategoryCount(
  consultations: Consultation[],
  category: ConsultationCategoryKey,
) {
  return consultations.filter((consultation) =>
    isConsultationInCategory(consultation, category),
  ).length
}

function getLocalDoctorLabel(session: DemoSession, consultation: Consultation) {
  const doctor = session.users.find((user) => user.id === consultation.localDoctorId)

  if (!doctor) return consultation.localDoctorId

  return `${doctor.orgName} · ${doctor.name}`
}

function getReadonlyStatusTitle(status: ConsultationStatus) {
  const titles: Record<ConsultationStatus, string> = {
    draft: "等待提交",
    pending_expert: "等待专家预审",
    needs_more_info: "等待医生补充",
    scheduled: "已确认预约",
    in_consultation: "待进入会诊",
    pending_advice: "等待提交建议",
    pending_doctor_confirm: "等待医生确认",
    completed: "会诊已完成",
    archived: "会诊已归档",
    expert_declined: "专家已婉拒",
    patient_cancelled: "患者已取消",
    closed_incomplete: "资料不足关闭",
    offline_emergency: "已转线下急诊",
  }

  return titles[status]
}

interface QueueFixtureInput {
  id: string
  status: ConsultationStatus
  patientName: string
  gender: "男" | "女"
  age: number
  department: string
  chiefComplaint: string
  consultationPurpose: string
  priority: Consultation["priority"]
  createdAt: string
  scheduledAt?: string
  localDoctorId: string
  localDoctorName: string
  attachmentCount: number
  messageCount: number
  requiredAttachmentTypes?: AttachmentType[]
  pastHistory?: string
  allergyHistory?: string
}

function createExpertQueueFixtures(expertId: string): Consultation[] {
  const inputs: QueueFixtureInput[] = [
    {
      id: "consult-20260712-101",
      status: "pending_expert",
      patientName: "张某某",
      gender: "女",
      age: 72,
      department: "心血管内科",
      chiefComplaint: "夜间胸闷伴心悸 2 天，晨起后症状加重。",
      consultationPurpose: "协助判断心律失常风险，并指导下一步检查与用药调整。",
      priority: "urgent",
      createdAt: "2026-07-12T08:46:00+08:00",
      localDoctorId: "doctor-wang",
      localDoctorName: "王医生",
      attachmentCount: 4,
      messageCount: 2,
      pastHistory: "高血压 15 年，阵发性房颤病史 3 年。",
    },
    {
      id: "consult-20260712-102",
      status: "pending_expert",
      patientName: "李某",
      gender: "男",
      age: 59,
      department: "心血管内科",
      chiefComplaint: "活动后气短 1 周，血压控制不稳定。",
      consultationPurpose: "请评估慢病用药方案，判断是否需要进一步心功能检查。",
      priority: "normal",
      createdAt: "2026-07-12T09:05:00+08:00",
      localDoctorId: "doctor-wang",
      localDoctorName: "王医生",
      attachmentCount: 3,
      messageCount: 1,
      pastHistory: "高血压 10 年，长期口服降压药。",
    },
    {
      id: "consult-20260711-201",
      status: "needs_more_info",
      patientName: "周某某",
      gender: "男",
      age: 64,
      department: "心血管内科",
      chiefComplaint: "胸痛后自行缓解，外院心电图提示 ST-T 改变。",
      consultationPurpose: "补齐资料后请专家判断是否按胸痛中心流程处理。",
      priority: "urgent",
      createdAt: "2026-07-11T18:20:00+08:00",
      localDoctorId: "doctor-wang",
      localDoctorName: "王医生",
      attachmentCount: 2,
      messageCount: 3,
      requiredAttachmentTypes: ["ecg", "medication_list"],
      pastHistory: "吸烟 30 年，血脂异常。",
    },
    {
      id: "consult-20260711-202",
      status: "needs_more_info",
      patientName: "陈某",
      gender: "女",
      age: 68,
      department: "心血管内科",
      chiefComplaint: "反复头晕乏力，家庭血压波动明显。",
      consultationPurpose: "请补充近期用药清单后评估降压方案。",
      priority: "normal",
      createdAt: "2026-07-11T16:10:00+08:00",
      localDoctorId: "doctor-wang",
      localDoctorName: "王医生",
      attachmentCount: 2,
      messageCount: 2,
      requiredAttachmentTypes: ["medication_list"],
      pastHistory: "高血压、慢性胃炎。",
    },
    {
      id: "consult-20260712-301",
      status: "scheduled",
      patientName: "王某某",
      gender: "男",
      age: 70,
      department: "心血管内科",
      chiefComplaint: "胸闷半年，加重伴下肢水肿 3 天。",
      consultationPurpose: "请专家协助评估心衰风险和转诊必要性。",
      priority: "urgent",
      createdAt: "2026-07-12T07:30:00+08:00",
      scheduledAt: "今日 15:00",
      localDoctorId: "doctor-wang",
      localDoctorName: "王医生",
      attachmentCount: 5,
      messageCount: 4,
      pastHistory: "冠心病支架术后 5 年，糖尿病 8 年。",
    },
    {
      id: "consult-20260712-302",
      status: "scheduled",
      patientName: "刘某",
      gender: "女",
      age: 61,
      department: "心血管内科",
      chiefComplaint: "心前区不适伴焦虑，近期睡眠差。",
      consultationPurpose: "请结合检查结果判断是否需调整慢病管理方案。",
      priority: "normal",
      createdAt: "2026-07-12T08:10:00+08:00",
      scheduledAt: "明日 09:30",
      localDoctorId: "doctor-wang",
      localDoctorName: "王医生",
      attachmentCount: 4,
      messageCount: 2,
      pastHistory: "高血压 6 年，焦虑状态。",
    },
    {
      id: "consult-20260712-401",
      status: "in_consultation",
      patientName: "孙某某",
      gender: "男",
      age: 76,
      department: "心血管内科",
      chiefComplaint: "胸痛伴冷汗 30 分钟后缓解，当前生命体征平稳。",
      consultationPurpose: "医生已陪同患者在诊室，请专家协助判断急诊转运策略。",
      priority: "urgent",
      createdAt: "2026-07-12T09:12:00+08:00",
      scheduledAt: "正在候诊",
      localDoctorId: "doctor-wang",
      localDoctorName: "王医生",
      attachmentCount: 6,
      messageCount: 5,
      pastHistory: "冠心病、高血压、长期吸烟。",
      allergyHistory: "未发现明确药物过敏史。",
    },
    {
      id: "consult-20260712-402",
      status: "in_consultation",
      patientName: "胡某",
      gender: "女",
      age: 58,
      department: "心血管内科",
      chiefComplaint: "阵发性心悸，动态心电图提示频发早搏。",
      consultationPurpose: "本地医生已完成初步评估，请专家在线确认处理建议。",
      priority: "normal",
      createdAt: "2026-07-12T09:20:00+08:00",
      scheduledAt: "今日 10:30",
      localDoctorId: "doctor-wang",
      localDoctorName: "王医生",
      attachmentCount: 4,
      messageCount: 4,
      pastHistory: "甲状腺结节病史，近期咖啡摄入较多。",
    },
    {
      id: "consult-20260712-501",
      status: "pending_advice",
      patientName: "郑某某",
      gender: "男",
      age: 66,
      department: "心血管内科",
      chiefComplaint: "慢性胸闷复诊，血脂控制仍不达标。",
      consultationPurpose: "会诊沟通已完成，请专家补充结构化用药和随访建议。",
      priority: "normal",
      createdAt: "2026-07-12T08:00:00+08:00",
      scheduledAt: "今日 09:30",
      localDoctorId: "doctor-wang",
      localDoctorName: "王医生",
      attachmentCount: 5,
      messageCount: 6,
      pastHistory: "冠心病、高脂血症。",
    },
    {
      id: "consult-20260711-502",
      status: "needs_more_info",
      patientName: "黄某",
      gender: "女",
      age: 63,
      department: "心血管内科",
      chiefComplaint: "血压晨峰明显，偶有头痛。",
      consultationPurpose: "请补充连续 7 天家庭血压记录后，再评估降压药调整方案。",
      priority: "normal",
      createdAt: "2026-07-11T19:40:00+08:00",
      localDoctorId: "doctor-wang",
      localDoctorName: "王医生",
      attachmentCount: 3,
      messageCount: 5,
      requiredAttachmentTypes: ["medication_list", "other"],
      pastHistory: "高血压 12 年。",
    },
    {
      id: "consult-20260710-601",
      status: "completed",
      patientName: "马某某",
      gender: "男",
      age: 69,
      department: "心血管内科",
      chiefComplaint: "胸闷复查，近期症状较前减轻。",
      consultationPurpose: "已完成专家建议，本地医生已确认继续门诊随访。",
      priority: "normal",
      createdAt: "2026-07-10T09:15:00+08:00",
      scheduledAt: "07-10 10:00",
      localDoctorId: "doctor-wang",
      localDoctorName: "王医生",
      attachmentCount: 4,
      messageCount: 5,
      pastHistory: "高血压、冠心病。",
    },
    {
      id: "consult-20260709-602",
      status: "archived",
      patientName: "许某",
      gender: "女",
      age: 57,
      department: "心血管内科",
      chiefComplaint: "长期心悸复诊，检查未见急性风险。",
      consultationPurpose: "会诊已归档，用于后续慢病管理复盘。",
      priority: "normal",
      createdAt: "2026-07-09T15:30:00+08:00",
      scheduledAt: "07-09 16:30",
      localDoctorId: "doctor-wang",
      localDoctorName: "王医生",
      attachmentCount: 3,
      messageCount: 4,
      pastHistory: "阵发性心悸 2 年。",
    },
  ]

  return inputs.map((input) => createQueueConsultation(input, expertId))
}

function createQueueConsultation(
  input: QueueFixtureInput,
  expertId: string,
): Consultation {
  const expertAdvice =
    input.status === "completed" || input.status === "archived"
      ? {
          submittedBy: expertId,
          submittedAt: input.scheduledAt ?? input.createdAt,
          diagnosisSuggestion: "结合现有资料，暂未见必须立即上转的明确证据。",
          examinationSuggestion: "建议按风险分层复查心电图、心肌酶和血脂指标。",
          treatmentSuggestion: "由本地医生结合血压、禁忌证和既往用药调整治疗。",
          referralSuggestion: "如出现持续胸痛、指标异常或生命体征不稳，立即转诊。",
          riskNotice: "胸痛持续不缓解、出汗或气短时需立即急诊处理。",
          followUpSuggestion: "建议 1 周内复诊，评估症状变化和用药依从性。",
        }
      : undefined

  return {
    id: input.id,
    status: input.status,
    patient: {
      id: `patient-${input.id}`,
      name: input.patientName,
      gender: input.gender,
      age: input.age,
      phoneMasked: "138****" + input.id.slice(-4),
      idNoMasked: "342622********" + input.id.slice(-4),
      allergyHistory: input.allergyHistory ?? "未述特殊药物过敏史",
      pastHistory:
        input.pastHistory ?? "本地医生已完成既往史采集，暂无特殊补充。",
    },
    localDoctorId: input.localDoctorId,
    expertId,
    department: input.department,
    chiefComplaint: input.chiefComplaint,
    consultationPurpose: input.consultationPurpose,
    priority: input.priority,
    scheduledAt: input.scheduledAt,
    createdAt: input.createdAt,
    attachments: createQueueAttachments(input),
    messages: createQueueMessages(input),
    timeline: createQueueTimeline(input),
    requiredAttachmentTypes: input.requiredAttachmentTypes ?? [],
    expertAdvice,
    localDisposition:
      input.status === "completed" || input.status === "archived"
        ? {
            adopted: "partial",
            note: "本地医生已结合线下查体采纳主要检查和随访建议。",
            confirmedAt: input.scheduledAt ?? input.createdAt,
          }
        : undefined,
  }
}

function createQueueAttachments(input: QueueFixtureInput) {
  const types: AttachmentType[] = [
    "lab_report",
    "ecg",
    "imaging",
    "medication_list",
    "tongue_face",
    "other",
  ]

  return Array.from({ length: input.attachmentCount }, (_, index) => {
    const type = types[index % types.length]

    return {
      id: `${input.id}-att-${index + 1}`,
      type,
      name: `${attachmentTypeLabels[type]} ${index + 1}`,
      uploadedBy: input.localDoctorId,
      uploadedAt: input.createdAt,
      description: `本地医生上传的${attachmentTypeLabels[type]}，用于专家快速判断当前风险。`,
    }
  })
}

function createQueueMessages(input: QueueFixtureInput) {
  return Array.from({ length: input.messageCount }, (_, index) => {
    const fromExpert = index % 2 === 1

    return {
      id: `${input.id}-msg-${index + 1}`,
      fromRole: fromExpert ? ("expert" as const) : ("doctor" as const),
      fromName: fromExpert ? "卢主任" : input.localDoctorName,
      content: fromExpert
        ? "已查看现有资料，请关注症状变化和关键检查结果。"
        : "患者当前在诊室，已完成线下问诊和知情沟通。",
      createdAt: input.createdAt,
    }
  })
}

function createQueueTimeline(input: QueueFixtureInput): Consultation["timeline"] {
  const steps: Array<{ status: ConsultationStatus; label: string; at: string }> = [
    {
      status: "pending_expert",
      label: "医生提交会诊申请",
      at: input.createdAt,
    },
  ]

  if (
    [
      "needs_more_info",
      "scheduled",
      "in_consultation",
      "pending_advice",
      "pending_doctor_confirm",
      "completed",
      "archived",
    ].includes(input.status)
  ) {
    steps.push({
      status: input.status === "needs_more_info" ? "needs_more_info" : "scheduled",
      label:
        input.status === "needs_more_info" ? "专家要求补充资料" : "专家已确认接诊",
      at: input.scheduledAt ?? input.createdAt,
    })
  }

  if (
    ["in_consultation", "pending_advice", "pending_doctor_confirm", "completed", "archived"].includes(
      input.status,
    )
  ) {
    steps.push({
      status: "in_consultation",
      label: "医生进入远程会诊间",
      at: input.scheduledAt ?? input.createdAt,
    })
  }

  if (["pending_advice", "pending_doctor_confirm", "completed", "archived"].includes(input.status)) {
    steps.push({
      status: "pending_advice",
      label: "等待专家提交结构化建议",
      at: input.scheduledAt ?? input.createdAt,
    })
  }

  if (["completed", "archived"].includes(input.status)) {
    steps.push({
      status: "completed",
      label: "医生确认本地处置",
      at: input.scheduledAt ?? input.createdAt,
    })
  }

  if (input.status === "archived") {
    steps.push({
      status: "archived",
      label: "会诊单归档",
      at: input.scheduledAt ?? input.createdAt,
    })
  }

  return steps.map((step, index) => ({
    id: `${input.id}-timeline-${index + 1}`,
    ...step,
  }))
}

function createDefaultWorkspaceItem(): ExpertWorkspaceItem {
  return {
    pinned: false,
    note: "",
    draftAdvice: "",
    updatedAt: "未更新",
    submissionStatus: "draft",
    submittedAt: "",
    prepItems: defaultPrepItems.map((item) => ({ ...item })),
  }
}

function markWorkspaceEdited(
  item: ExpertWorkspaceItem,
  changes: Partial<Pick<ExpertWorkspaceItem, "note" | "draftAdvice" | "prepItems">>,
) {
  return {
    ...item,
    ...changes,
    updatedAt: "刚刚",
    submissionStatus:
      item.submissionStatus === "submitted" ? "changed" : item.submissionStatus,
  }
}

function getExpertSubmissionStatusLabel(status: ExpertSubmissionStatus) {
  const labels: Record<ExpertSubmissionStatus, string> = {
    draft: "待提交",
    changed: "待重新提交",
    submitted: "已提交运营",
  }

  return labels[status]
}

function getExpertSubmissionPlan(consultation: Consultation) {
  switch (consultation.status) {
    case "pending_expert":
      return {
        title: "预审确认",
      }
    case "needs_more_info":
      return {
        title: "补充跟进确认",
      }
    case "scheduled":
      return {
        title: "预约准备确认",
      }
    case "in_consultation":
      return {
        title: "会诊过程确认",
      }
    case "pending_advice":
      return {
        title: "建议提交确认",
      }
    case "pending_doctor_confirm":
      return {
        title: "建议流转确认",
      }
    case "completed":
    case "archived":
      return {
        title: "复盘确认",
      }
    default:
      return {
        title: "专家确认",
      }
  }
}

function getWorkspaceItem(
  workspaceItems: ExpertWorkspaceMap,
  consultationId: string,
) {
  return workspaceItems[consultationId] ?? createDefaultWorkspaceItem()
}

function getWorkbenchPendingCount() {
  return (
    workbenchCounts.pendingReview +
    workbenchCounts.pendingAdvice +
    workbenchCounts.informationSupplement
  )
}

function getPendingTaskCount(status: ConsultationStatus) {
  if (["pending_expert", "in_consultation"].includes(status)) return 1
  if (status === "needs_more_info" || status === "scheduled") return 0
  return 0
}

function getWorkbenchCards() {
  return [
    {
      label: "待预审",
      value: workbenchCounts.pendingReview,
      icon: ClipboardCheckIcon,
      tone: "primary" as const,
    },
    {
      label: "待建议",
      value: workbenchCounts.pendingAdvice,
      icon: NotebookPenIcon,
      tone: "secondary" as const,
    },
    {
      label: "今日会诊",
      value: workbenchCounts.todayConsultation,
      icon: PhoneCallIcon,
      tone: "secondary" as const,
    },
    {
      label: "资料补充",
      value: workbenchCounts.informationSupplement,
      icon: FileQuestionIcon,
      tone: "secondary" as const,
    },
  ]
}

function getStatusHint(status: ConsultationStatus) {
  const hints: Record<ConsultationStatus, string> = {
    draft: "等待本地医生提交会诊申请",
    pending_expert: "请预审资料并选择接受会诊或要求补充资料",
    needs_more_info: "已向本地医生发出补充资料要求",
    scheduled: "已确认会诊时间，等待医生进入会诊间",
    in_consultation: "会诊进行中，可整理并提交专家建议",
    pending_advice: "请尽快提交结构化专家建议",
    pending_doctor_confirm: "专家建议已提交，等待医生确认处置",
    completed: "医生已确认本地处置",
    archived: "会诊单已归档",
    expert_declined: "已婉拒该会诊邀请",
    patient_cancelled: "患者已取消本次会诊",
    closed_incomplete: "资料不足，会诊已关闭",
    offline_emergency: "患者已转线下急诊处理",
  }

  return hints[status]
}
