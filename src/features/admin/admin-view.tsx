import {
  ActivityIcon,
  AlarmClockIcon,
  ArchiveIcon,
  BarChart3Icon,
  BellRingIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  CopyIcon,
  FileCheck2Icon,
  HeartPulseIcon,
  KeyRoundIcon,
  MessageSquareTextIcon,
  SendIcon,
  Settings2Icon,
  StethoscopeIcon,
  UserPlusIcon,
} from "lucide-react"
import { type Dispatch, type FormEvent, useMemo, useState } from "react"

import {
  AdvicePanel,
  AttachmentList,
  CommunicationLog,
  WorkflowTimeline,
} from "@/components/workflow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type { DemoAction, DemoSession } from "@/domain/demo-session"
import type {
  ConsultationStatus,
  ExpertProfile,
  OperationLog,
  UserRole,
} from "@/domain/types"
import { cn } from "@/lib/utils"

import {
  type AdminCaseRecord,
  type AdminSectionKey,
  adminStatusLabels,
  getAdminCaseRecords,
  getDefaultOperationLogs,
  reminderTemplates,
} from "./admin-data"

interface AdminViewProps {
  session: DemoSession
  dispatch: Dispatch<DemoAction>
}

interface AdminCounts {
  active: number
  urgent: number
  waitingExpert: number
  waitingAdmin: number
  archived: number
  reminders: number
}

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

type InviteStatus = "not_generated" | "generated" | "sent" | "activated"

interface ExpertServiceRecord extends ExpertProfile {
  mobileMasked: string
  inviteCode: string
  inviteStatus: InviteStatus
  source: string
  createdAt: string
  lastInviteAt: string
}

interface ExpertFormState {
  name: string
  hospital: string
  department: string
  title: string
  specialties: string
  mobileMasked: string
  hometownTag: string
  slots: string
  source: string
}

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
type AdminCaseDetailActionKind =
  | "reminder"
  | "priority"
  | "archive"
  | "copy"
  | "external"
  | "note"
  | "passive"

interface AdminCaseDetailAction {
  label: string
  kind: AdminCaseDetailActionKind
  variant?: "default" | "outline" | "destructive" | "secondary"
}

interface AdminCaseDetailConfig {
  title: string
  objective: string
  adminFocus: string
  nextStep: string
  checks: string[]
  actions: AdminCaseDetailAction[]
}

interface QualityCheckItem {
  key: string
  group: "基础核查" | "诊疗过程核查" | "运营合规核查"
  label: string
  required: boolean
}

interface QualityIssue {
  id: string
  type:
    | "missing_attachment"
    | "incomplete_advice"
    | "missing_disposition"
    | "sla_overdue"
    | "risk_unclosed"
    | "insufficient_message"
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

const audienceLabels: Record<UserRole, string> = {
  doctor: "医生端",
  expert: "专家端",
  admin: "运营端",
}

const adminSections: Array<{
  key: AdminSectionKey
  title: string
  icon: typeof ActivityIcon
}> = [
  {
    key: "workbench",
    title: "运营工作台",
    icon: ActivityIcon,
  },
  {
    key: "cases",
    title: "会诊单管理",
    icon: ClipboardListIcon,
  },
  {
    key: "reminders",
    title: "流程催办",
    icon: BellRingIcon,
  },
  {
    key: "experts",
    title: "专家服务",
    icon: StethoscopeIcon,
  },
  {
    key: "quality",
    title: "质控归档",
    icon: ClipboardCheckIcon,
  },
  {
    key: "messages",
    title: "消息通知",
    icon: MessageSquareTextIcon,
  },
  {
    key: "reports",
    title: "统计分析",
    icon: BarChart3Icon,
  },
  {
    key: "settings",
    title: "系统设置",
    icon: Settings2Icon,
  },
]

const qualityCheckItems: QualityCheckItem[] = [
  { key: "application", group: "基础核查", label: "会诊申请信息完整", required: true },
  { key: "patient", group: "基础核查", label: "患者基础信息完整", required: true },
  { key: "purpose", group: "基础核查", label: "主诉和会诊目的明确", required: true },
  { key: "attachments", group: "基础核查", label: "必要病例资料已上传", required: true },
  { key: "requiredAttachments", group: "基础核查", label: "附件类型满足专家要求", required: false },
  { key: "expertReview", group: "诊疗过程核查", label: "专家预审节点完整", required: true },
  { key: "supplement", group: "诊疗过程核查", label: "资料补充节点完整", required: false },
  { key: "consultation", group: "诊疗过程核查", label: "预约/会诊节点完整", required: true },
  { key: "expertAdvice", group: "诊疗过程核查", label: "专家结构化建议完整", required: true },
  { key: "doctorDisposition", group: "诊疗过程核查", label: "医生本地处置已确认", required: true },
  { key: "riskClosed", group: "诊疗过程核查", label: "风险提示已闭环", required: true },
  { key: "sla", group: "运营合规核查", label: "SLA 未超时或已有说明", required: false },
  { key: "messages", group: "运营合规核查", label: "沟通记录可追溯", required: true },
  { key: "operationLogs", group: "运营合规核查", label: "催办和运营备注完整", required: false },
  { key: "archiveNote", group: "运营合规核查", label: "归档说明已填写", required: true },
  { key: "qualityConclusion", group: "运营合规核查", label: "质控结论明确", required: true },
]

const qualityGroups: QualityCheckItem["group"][] = [
  "基础核查",
  "诊疗过程核查",
  "运营合规核查",
]

const qualityStatusLabels: Record<QualityCaseStatus, string> = {
  pending_review: "待质控",
  missing_items: "有缺项",
  rectification: "整改中",
  ready_to_archive: "可归档",
  archived: "已归档",
  sampling: "抽检中",
  sample_passed: "抽检通过",
  sample_issue: "抽检发现问题",
}

const qualityFilterItems: Array<{ key: QualityFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "pending_review", label: "待质控单" },
  { key: "missing_items", label: "缺项" },
  { key: "rectification", label: "整改" },
  { key: "ready_to_archive", label: "可归档单" },
  { key: "archived", label: "已归档单" },
  { key: "sampling", label: "抽检中单" },
]

const adminCaseDetailConfigs: Record<ConsultationStatus, AdminCaseDetailConfig> = {
  draft: {
    title: "草稿跟进",
    objective: "推动本地医生补齐会诊申请并提交专家预审。",
    adminFocus: "关注草稿停留时间、申请资料完整度和是否需要运营电话提醒。",
    nextStep: "医生提交后进入专家预审队列。",
    checks: ["确认申请医生和机构", "查看主诉与会诊目的是否已填写", "判断是否需要标记紧急"],
    actions: [
      { label: "催医生提交", kind: "reminder", variant: "default" },
      { label: "记录备注", kind: "note" },
      { label: "调整优先级", kind: "priority" },
    ],
  },
  pending_expert: {
    title: "专家预审跟进",
    objective: "确保专家及时完成预审，明确接诊、改约或补资料要求。",
    adminFocus: "重点看专家等待时长、紧急程度、资料是否足够支撑预审。",
    nextStep: "专家接诊后进入预约会诊；若婉拒则运营协助改派。",
    checks: ["核查专家是否在线可约", "确认预审 SLA", "确认资料包可打开"],
    actions: [
      { label: "催专家预审", kind: "reminder", variant: "default" },
      { label: "改派专家", kind: "passive" },
      { label: "标记紧急", kind: "priority" },
    ],
  },
  needs_more_info: {
    title: "资料补充跟进",
    objective: "推动本地医生按专家要求补齐资料并重新提交。",
    adminFocus: "关注缺失资料类型、专家补充要求是否明确、医生是否已收到提醒。",
    nextStep: "资料补齐后回到专家预审。",
    checks: ["查看专家补充要求", "核查缺失附件类型", "确认医生补充时限"],
    actions: [
      { label: "催医生补资料", kind: "reminder", variant: "default" },
      { label: "查看补充要求", kind: "passive" },
      { label: "记录电话沟通", kind: "note" },
    ],
  },
  scheduled: {
    title: "会诊准备确认",
    objective: "确保医生、专家、患者按预约时间进入外部会诊系统。",
    adminFocus: "关注预约时间、会议号、双方到场准备和患者是否在场。",
    nextStep: "双方进入外部系统后开始会诊。",
    checks: ["确认外部会议号", "提醒医生确认患者在场", "提醒专家按时进入"],
    actions: [
      { label: "复制会议号", kind: "copy" },
      { label: "打开外部系统", kind: "external", variant: "default" },
      { label: "提醒医生/专家", kind: "reminder" },
      { label: "标记会诊异常", kind: "note", variant: "destructive" },
    ],
  },
  in_consultation: {
    title: "会诊过程监控",
    objective: "监控外部会诊是否顺利完成，及时记录中断或异常。",
    adminFocus: "关注会诊开始时间、进行时长、双方在线状态和沟通异常。",
    nextStep: "会诊完成后进入专家建议提交。",
    checks: ["确认会诊已开始", "关注沟通是否中断", "记录外部系统异常"],
    actions: [
      { label: "记录会诊异常", kind: "note", variant: "destructive" },
      { label: "提醒双方", kind: "reminder" },
      { label: "标记沟通完成", kind: "passive", variant: "default" },
    ],
  },
  pending_advice: {
    title: "专家建议跟进",
    objective: "推动专家在会诊后及时提交结构化建议。",
    adminFocus: "关注会诊结束时间、专家建议 SLA、是否已发生催办。",
    nextStep: "专家建议提交后进入医生本地处置确认。",
    checks: ["确认会诊已结束", "核查建议提交时限", "查看近期催办记录"],
    actions: [
      { label: "催专家提交建议", kind: "reminder", variant: "default" },
      { label: "标记逾期", kind: "note", variant: "destructive" },
      { label: "记录催办", kind: "note" },
    ],
  },
  pending_doctor_confirm: {
    title: "医生处置确认",
    objective: "推动本地医生结合专家建议完成本地处置确认。",
    adminFocus: "关注专家建议摘要、风险提示是否被医生确认、处置记录是否完整。",
    nextStep: "医生确认后进入运营质控归档。",
    checks: ["查看专家建议", "核查风险提示", "确认医生处置 SLA"],
    actions: [
      { label: "催医生确认处置", kind: "reminder", variant: "default" },
      { label: "查看专家建议", kind: "passive" },
      { label: "记录跟进", kind: "note" },
    ],
  },
  completed: {
    title: "运营质控归档",
    objective: "完成会诊单完整性核查，形成可归档闭环记录。",
    adminFocus: "关注专家建议、医生处置、附件、流程留痕和风险闭环是否完整。",
    nextStep: "质控通过后归档；缺项则退回医生端整改。",
    checks: ["核查申请资料完整", "核查专家建议完整", "核查医生处置和风险闭环"],
    actions: [
      { label: "质控通过并归档", kind: "archive", variant: "default" },
      { label: "退回整改", kind: "note", variant: "destructive" },
      { label: "填写归档说明", kind: "note" },
    ],
  },
  archived: {
    title: "归档复盘",
    objective: "查看已归档会诊包，支持复盘、抽检和统计。",
    adminFocus: "关注归档时间、质控结论、流程包是否可追溯。",
    nextStep: "按运营规则进入抽检或统计分析。",
    checks: ["查看归档节点", "查看质控结论", "确认流程记录可追溯"],
    actions: [
      { label: "查看归档包", kind: "passive", variant: "default" },
      { label: "发起抽检", kind: "passive" },
      { label: "复制归档记录", kind: "copy" },
    ],
  },
  expert_declined: {
    title: "专家婉拒处理",
    objective: "协助医生重新选择专家，避免会诊单停滞。",
    adminFocus: "关注婉拒原因、替代专家资源和医生是否已知晓。",
    nextStep: "改派专家后重新进入专家预审。",
    checks: ["查看专家婉拒原因", "查找可替代专家", "同步医生端处理意见"],
    actions: [
      { label: "改派专家", kind: "passive", variant: "default" },
      { label: "通知医生", kind: "reminder" },
      { label: "关闭会诊单", kind: "note", variant: "destructive" },
    ],
  },
  patient_cancelled: {
    title: "患者取消记录",
    objective: "补齐取消原因和通知记录，避免流程悬空。",
    adminFocus: "关注取消发起方、取消原因、是否已通知专家与医生。",
    nextStep: "原因记录完整后关闭流程。",
    checks: ["记录取消原因", "确认医生知晓", "确认专家无需继续处理"],
    actions: [
      { label: "记录取消原因", kind: "note", variant: "default" },
      { label: "通知专家/医生", kind: "reminder" },
      { label: "关闭流程", kind: "note", variant: "destructive" },
    ],
  },
  closed_incomplete: {
    title: "资料不足关闭",
    objective: "明确资料不足关闭依据，支持后续重新发起。",
    adminFocus: "关注缺失资料、专家意见和医生是否已收到关闭原因。",
    nextStep: "资料补齐后可重新发起会诊。",
    checks: ["记录缺失资料", "确认关闭依据", "同步医生端"],
    actions: [
      { label: "记录关闭原因", kind: "note", variant: "default" },
      { label: "通知医生", kind: "reminder" },
      { label: "重新开启", kind: "passive" },
    ],
  },
  offline_emergency: {
    title: "线下急诊跟踪",
    objective: "跟踪高风险患者线下急诊处置结果，确保线上流程有闭环。",
    adminFocus: "关注转线下原因、目标机构、到院确认和医生回填结果。",
    nextStep: "线下结果回填后关闭线上会诊或进入诊后管理。",
    checks: ["确认转线下原因", "跟踪患者到院情况", "催医生回填急诊结果"],
    actions: [
      { label: "记录急诊跟踪", kind: "note", variant: "default" },
      { label: "催医生回填结果", kind: "reminder" },
      { label: "关闭线上会诊", kind: "note", variant: "destructive" },
    ],
  },
}

const emptyExpertForm: ExpertFormState = {
  name: "张主任",
  hospital: "蚌埠医科大学第一附属医院",
  department: "消化内科",
  title: "主任医师",
  specialties: "消化道疾病、慢病随访、基层用药指导",
  mobileMasked: "136****8901",
  hometownTag: "蒙城籍乡贤专家",
  slots: "周三 19:30、周六 09:00",
  source: "乡贤推荐",
}

const reportMetrics = {
  total: 126,
  completionRate: "79%",
  supplementRate: "18%",
  avgResponse: "16 分钟",
}

const reportStatusCounts: Array<{ status: ConsultationStatus; count: number }> = [
  { status: "archived", count: 92 },
  { status: "completed", count: 7 },
  { status: "pending_doctor_confirm", count: 5 },
  { status: "pending_advice", count: 6 },
  { status: "scheduled", count: 5 },
  { status: "in_consultation", count: 1 },
  { status: "needs_more_info", count: 6 },
  { status: "pending_expert", count: 3 },
  { status: "draft", count: 1 },
]

export function AdminView({ session, dispatch }: AdminViewProps) {
  const [activeSection, setActiveSection] = useState<AdminSectionKey>("workbench")
  const [selectedCaseId, setSelectedCaseId] = useState(session.activeConsultation.id)
  const [selectedQualityCaseId, setSelectedQualityCaseId] = useState(session.activeConsultation.id)
  const [qualityStates, setQualityStates] = useState<Record<string, QualityCaseState>>({})
  const [note, setNote] = useState("已电话同步双方按预约时间进入会诊间。")
  const [expertRecords, setExpertRecords] = useState<ExpertServiceRecord[]>(() =>
    createInitialExpertRecords(session.experts),
  )

  const records = useMemo(() => getAdminCaseRecords(session), [session])
  const operationLogs = useMemo(() => getDefaultOperationLogs(session), [session])
  const counts = useMemo(() => getAdminCounts(records, operationLogs), [records, operationLogs])
  const selectedRecord =
    records.find((record) => record.consultation.id === selectedCaseId) ?? records[0]
  const liveRecord = records[0]
  const liveQualityState = getQualityCaseState(liveRecord, qualityStates)
  const canArchive = canArchiveQualityCase(liveRecord, liveQualityState)

  function sendReminder(
    targetRole: Exclude<UserRole, "admin">,
    title: string,
    detail: string,
  ) {
    dispatch({
      type: "admin.sendReminder",
      input: { targetRole, title, detail },
    })
    setActiveSection("messages")
  }

  function sendContextReminder(record: AdminCaseRecord) {
    const targetRole = getReminderTargetRole(record)
    if (!targetRole) return

    sendReminder(
      targetRole,
      `${record.currentOwner}提醒：${adminStatusLabels[record.consultation.status]}`,
      `运营提醒：${record.consultation.patient.name}的会诊单${record.operationNeed}，请及时处理。`,
    )
  }

  function addOperationNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    dispatch({
      type: "admin.addNote",
      input: {
        title: "运营备注",
        detail: note,
      },
    })
    setNote("")
    setActiveSection("messages")
  }

  function togglePriority() {
    const nextPriority = session.activeConsultation.priority === "urgent" ? "normal" : "urgent"

    dispatch({
      type: "admin.updatePriority",
      input: {
        priority: nextPriority,
        reason:
          nextPriority === "urgent"
            ? "运营根据病情描述和等待时长，将该会诊标记为紧急优先处理。"
            : "运营确认当前风险可控，将该会诊恢复为普通优先级。",
      },
    })
  }

  function archiveLiveCase() {
    if (!canArchive) return
    dispatch({ type: "admin.archive" })
    setActiveSection("messages")
  }

  function updateQualityCase(
    consultationId: string,
    updater: (current: QualityCaseState) => QualityCaseState,
  ) {
    setQualityStates((current) => {
      const record = records.find((item) => item.consultation.id === consultationId)
      const previous = current[consultationId] ?? createDefaultQualityCaseState(record)
      const next = normalizeQualityCaseState(updater(previous))

      return {
        ...current,
        [consultationId]: next,
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

  return (
    <div className="grid min-h-[calc(100svh-8.5rem)] gap-4 lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-border/80 bg-card/95 p-2.5 shadow-[0_18px_40px_-32px_rgba(30,64,175,0.55)] lg:sticky lg:top-24 lg:h-[calc(100svh-7rem)] lg:overflow-y-auto">
        <nav className="flex flex-col gap-1.5">
          {adminSections.map((section) => (
            <SidebarItem
              key={section.key}
              section={section}
              active={activeSection === section.key}
              onClick={() => setActiveSection(section.key)}
            />
          ))}
        </nav>
      </aside>

      <main className="min-w-0">
        {activeSection === "workbench" && (
          <WorkbenchPage
            records={records}
            liveRecord={liveRecord}
            counts={counts}
            onSelectCase={(id) => {
              setSelectedCaseId(id)
              setActiveSection("cases")
            }}
            onSendReminder={sendContextReminder}
            onTogglePriority={togglePriority}
          />
        )}
        {activeSection === "cases" && (
          <CasesPage
            records={records}
            selectedRecord={selectedRecord}
            operationLogs={operationLogs}
            note={note}
            onNoteChange={setNote}
            onSubmitNote={addOperationNote}
            onSelectCase={setSelectedCaseId}
            onSendReminder={sendContextReminder}
            onTogglePriority={togglePriority}
            onArchive={archiveLiveCase}
            canArchive={canArchive}
          />
        )}
        {activeSection === "reminders" && (
          <RemindersPage
            records={records}
            operationLogs={operationLogs}
            onSendReminder={sendReminder}
            onSendContextReminder={sendContextReminder}
          />
        )}
        {activeSection === "experts" && (
          <ExpertsPage
            experts={expertRecords}
            onChangeExperts={setExpertRecords}
            onSendReminder={sendReminder}
          />
        )}
        {activeSection === "quality" && (
          <QualityPage
            records={records}
            qualityStates={qualityStates}
            selectedCaseId={selectedQualityCaseId}
            onSelectCase={setSelectedQualityCaseId}
            onUpdateCase={updateQualityCase}
            onSendReminder={sendReminder}
            onArchive={archiveQualityCase}
          />
        )}
        {activeSection === "messages" && (
          <MessagesPage session={session} operationLogs={operationLogs} />
        )}
        {activeSection === "reports" && <ReportsPage />}
        {activeSection === "settings" && <SettingsPage />}
      </main>
    </div>
  )
}

function SidebarItem({
  section,
  active,
  onClick,
}: {
  section: (typeof adminSections)[number]
  active: boolean
  onClick: () => void
}) {
  const Icon = section.icon

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
        active
          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
          : "text-foreground hover:bg-secondary/70",
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-primary-foreground/20" : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{section.title}</span>
      </span>
    </button>
  )
}

function WorkbenchPage({
  records,
  liveRecord,
  counts,
  onSelectCase,
  onSendReminder,
  onTogglePriority,
}: {
  records: AdminCaseRecord[]
  liveRecord: AdminCaseRecord
  counts: AdminCounts
  onSelectCase: (id: string) => void
  onSendReminder: (record: AdminCaseRecord) => void
  onTogglePriority: () => void
}) {
  const pendingRecords = records.filter((record) => record.consultation.status !== "archived")
  const riskRecords = records.filter((record) => record.riskLevel !== "normal" && record.riskLevel !== "done")

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard title="流转中" value={counts.active} icon={ActivityIcon} />
        <MetricCard title="紧急/风险" value={counts.urgent} icon={HeartPulseIcon} tone="danger" />
        <MetricCard title="待运营" value={counts.waitingAdmin} icon={ClipboardCheckIcon} tone="warning" />
        <MetricCard title="今日催办" value={counts.reminders} icon={BellRingIcon} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>今日待办队列</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {pendingRecords.slice(0, 6).map((record) => (
              <CaseQueueRow
                key={record.consultation.id}
                record={record}
                onOpen={() => onSelectCase(record.consultation.id)}
                onSendReminder={() => onSendReminder(record)}
              />
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>当前实时会诊单</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <CaseMiniSummary record={liveRecord} />
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={onTogglePriority}>
                  <HeartPulseIcon data-icon="inline-start" />
                  {liveRecord.consultation.priority === "urgent" ? "恢复普通" : "标记紧急"}
                </Button>
                <Button variant="outline" onClick={() => onSendReminder(liveRecord)}>
                  <BellRingIcon data-icon="inline-start" />
                  节点催办
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>风险提醒</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {riskRecords.slice(0, 4).map((record) => (
                <button
                  key={record.consultation.id}
                  type="button"
                  className="rounded-xl border border-border/80 bg-card/70 p-3 text-left shadow-sm shadow-primary/5 transition hover:bg-secondary/45"
                  onClick={() => onSelectCase(record.consultation.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {record.consultation.patient.name} · {record.consultation.department}
                    </span>
                    <RiskBadge risk={record.riskLevel} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {record.operationNeed}，{record.waitTime}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

function CasesPage({
  records,
  selectedRecord,
  operationLogs,
  note,
  canArchive,
  onNoteChange,
  onSubmitNote,
  onSelectCase,
  onSendReminder,
  onTogglePriority,
  onArchive,
}: {
  records: AdminCaseRecord[]
  selectedRecord: AdminCaseRecord
  operationLogs: OperationLog[]
  note: string
  canArchive: boolean
  onNoteChange: (value: string) => void
  onSubmitNote: (event: FormEvent<HTMLFormElement>) => void
  onSelectCase: (id: string) => void
  onSendReminder: (record: AdminCaseRecord) => void
  onTogglePriority: () => void
  onArchive: () => void
}) {
  const [filter, setFilter] = useState<"all" | "active" | "risk" | "archive">("all")
  const filteredRecords = records.filter((record) => {
    if (filter === "active") return record.consultation.status !== "archived"
    if (filter === "risk") return record.riskLevel === "urgent" || record.riskLevel === "warning"
    if (filter === "archive") return ["completed", "archived"].includes(record.consultation.status)
    return true
  })

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Card className="min-w-0">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>会诊单管理</CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ["all", "全部"],
                ["active", "进行中"],
                ["risk", "风险"],
                ["archive", "归档"],
              ].map(([key, label]) => (
                <Button
                  key={key}
                  variant={filter === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(key as typeof filter)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-border/80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>会诊对象</TableHead>
                  <TableHead>申请方</TableHead>
                  <TableHead>专家</TableHead>
                  <TableHead>当前状态</TableHead>
                  <TableHead>责任方</TableHead>
                  <TableHead>等待</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow
                    key={record.consultation.id}
                    className={cn(
                      "cursor-pointer",
                      selectedRecord.consultation.id === record.consultation.id && "bg-muted/70",
                    )}
                    onClick={() => onSelectCase(record.consultation.id)}
                  >
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{record.consultation.patient.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {record.consultation.id} · {record.consultation.department}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm">{record.doctorName}</span>
                        <span className="text-xs text-muted-foreground">{record.doctorOrg}</span>
                      </div>
                    </TableCell>
                    <TableCell>{record.expertName}</TableCell>
                    <TableCell><AdminStatusBadge status={record.consultation.status} /></TableCell>
                    <TableCell>{record.currentOwner}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <RiskDot risk={record.riskLevel} />
                        <span className="text-sm">{record.waitTime}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CaseDetailPanel
        record={selectedRecord}
        operationLogs={operationLogs}
        note={note}
        canArchive={canArchive}
        onNoteChange={onNoteChange}
        onSubmitNote={onSubmitNote}
        onSendReminder={() => onSendReminder(selectedRecord)}
        onTogglePriority={onTogglePriority}
        onArchive={onArchive}
      />
    </div>
  )
}

function CaseDetailPanel({
  record,
  operationLogs,
  note,
  canArchive,
  onNoteChange,
  onSubmitNote,
  onSendReminder,
  onTogglePriority,
  onArchive,
}: {
  record: AdminCaseRecord
  operationLogs: OperationLog[]
  note: string
  canArchive: boolean
  onNoteChange: (value: string) => void
  onSubmitNote: (event: FormEvent<HTMLFormElement>) => void
  onSendReminder: () => void
  onTogglePriority: () => void
  onArchive: () => void
}) {
  const logs = operationLogs.filter((log) => log.consultationId === record.consultation.id)
  const detailConfig = adminCaseDetailConfigs[record.consultation.status]

  function handleDetailAction(action: AdminCaseDetailAction) {
    if (action.kind === "reminder") {
      onSendReminder()
      return
    }

    if (action.kind === "priority") {
      onTogglePriority()
      return
    }

    if (action.kind === "archive" && record.isLive && canArchive) {
      onArchive()
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>{record.consultation.patient.name} 会诊明细</CardTitle>
              <div className="mt-1 text-sm text-muted-foreground">{record.consultation.id}</div>
            </div>
            {record.isLive && <Badge>实时联动</Badge>}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <CaseMiniSummary record={record} />
          <Separator />
          <DetailLine label="主诉" value={record.consultation.chiefComplaint} />
          <DetailLine label="会诊目的" value={record.consultation.consultationPurpose} />
          <DetailLine label="运营关注" value={record.operationNeed} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>当前节点处理</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="rounded-xl border border-border/80 bg-secondary/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">{detailConfig.title}</div>
              <AdminStatusBadge status={record.consultation.status} />
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {detailConfig.objective}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoBox label="运营重点" value={detailConfig.adminFocus} />
            <InfoBox label="下一步" value={detailConfig.nextStep} />
            <InfoBox label="责任方" value={record.currentOwner} />
            <InfoBox label="时效要求" value={record.slaLabel} />
          </div>

          <div className="rounded-xl border border-border/80 bg-card/80 p-3">
            <div className="text-sm font-medium">核查事项</div>
            <div className="mt-3 grid gap-2">
              {detailConfig.checks.map((check) => (
                <div key={check} className="flex items-start gap-2 text-sm leading-6">
                  <CheckCircle2Icon className="mt-1 size-3.5 shrink-0 text-primary" />
                  <span>{check}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {detailConfig.actions.map((action) => (
              <Button
                key={action.label}
                type="button"
                variant={action.variant ?? "outline"}
                onClick={() => handleDetailAction(action)}
              >
                <AdminCaseActionIcon action={action} />
                {action.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <form onSubmit={onSubmitNote}>
        <Card>
          <CardHeader>
            <CardTitle>运营备注</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="输入运营跟进记录"
              rows={3}
            />
            <Button type="submit" disabled={!record.isLive || note.trim().length === 0}>
              <FileCheck2Icon data-icon="inline-start" />
              保存备注
            </Button>
          </CardContent>
        </Card>
      </form>

      <WorkflowTimeline consultation={record.consultation} showDescription={false} />
      <AttachmentList consultation={record.consultation} showDescription={false} />
      <AdvicePanel consultation={record.consultation} showDescription={false} />
      <CommunicationLog consultation={record.consultation} showDescription={false} />

      <Card>
        <CardHeader>
          <CardTitle>运营记录</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {logs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-secondary/40 p-3 text-sm text-muted-foreground">
              当前会诊对象暂无运营记录。
            </div>
          ) : (
            logs.map((log) => <OperationLogItem key={log.id} log={log} />)
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AdminCaseActionIcon({ action }: { action: AdminCaseDetailAction }) {
  if (action.kind === "reminder") return <BellRingIcon data-icon="inline-start" />
  if (action.kind === "priority") return <HeartPulseIcon data-icon="inline-start" />
  if (action.kind === "archive") return <ArchiveIcon data-icon="inline-start" />
  if (action.kind === "copy") return <CopyIcon data-icon="inline-start" />
  if (action.kind === "external") return <SendIcon data-icon="inline-start" />
  if (action.kind === "note") return <FileCheck2Icon data-icon="inline-start" />

  return <ClipboardListIcon data-icon="inline-start" />
}

function RemindersPage({
  records,
  operationLogs,
  onSendReminder,
  onSendContextReminder,
}: {
  records: AdminCaseRecord[]
  operationLogs: OperationLog[]
  onSendReminder: (
    targetRole: Exclude<UserRole, "admin">,
    title: string,
    detail: string,
  ) => void
  onSendContextReminder: (record: AdminCaseRecord) => void
}) {
  const [activeFilter, setActiveFilter] = useState<ReminderFilter>("all")
  const reminderLogs = operationLogs.filter((log) => log.action === "reminder")
  const queueItems = getReminderQueueItems(records, operationLogs)
  const filteredQueueItems = filterReminderQueueItems(queueItems, activeFilter)
  const metrics = getReminderMetrics(queueItems)
  const activeMetric = metrics.find((metric) => metric.key === activeFilter) ?? metrics[0]

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-border/80 bg-card p-5 shadow-sm shadow-primary/5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">流程催办工作台</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              先处理逾期和高风险会诊单，再按状态批量催办。
            </p>
          </div>
          <Badge className="w-fit border-red-200 bg-red-50 text-red-700" variant="outline">
            风险优先
          </Badge>
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
        <div className="flex min-w-0 flex-col gap-4">
          <Card data-testid="admin-reminder-queue">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>待催办队列</CardTitle>
                  <div className="mt-1 text-sm text-muted-foreground">
                    当前筛选：{activeMetric.label}
                  </div>
                </div>
                <Badge variant="outline">{filteredQueueItems.length} 单</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {filteredQueueItems.length === 0 ? (
                <EmptyState title="当前筛选下暂无待催办单" />
              ) : (
                filteredQueueItems.map((item) => (
                  <ReminderQueueRow
                    key={item.record.consultation.id}
                    item={item}
                    onSendReminder={() => onSendContextReminder(item.record)}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>近期催办历史</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {reminderLogs.length === 0 ? (
                <EmptyState title="暂无催办历史" />
              ) : (
                reminderLogs.slice(-8).reverse().map((log) => (
                  <OperationLogItem key={log.id} log={log} />
                ))
              )}
            </CardContent>
          </Card>
        </div>

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
    </div>
  )
}

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
        "rounded-xl border border-border/80 bg-card p-4 text-left shadow-sm shadow-primary/5 transition hover:bg-secondary/45",
        active && "border-primary/70 bg-primary/5 ring-2 ring-primary/15",
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{metric.label}</span>
        <RiskDot risk={metric.tone === "danger" ? "urgent" : metric.tone === "warning" ? "warning" : "normal"} />
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{metric.value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{metric.helper}</div>
    </button>
  )
}

function ReminderQueueRow({
  item,
  onSendReminder,
}: {
  item: ReminderQueueItem
  onSendReminder: () => void
}) {
  const record = item.record

  return (
    <div className="rounded-xl border border-border/80 bg-card/80 p-4 shadow-sm shadow-primary/5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{record.consultation.patient.name}</span>
            <AdminStatusBadge status={record.consultation.status} />
            <RiskBadge risk={record.riskLevel} />
            {item.hasRecentReminder && (
              <Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">
                已催办
              </Badge>
            )}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {record.consultation.id} · {record.consultation.department}
          </div>
        </div>
        <Button className="w-full lg:w-auto" size="sm" onClick={onSendReminder}>
          <BellRingIcon data-icon="inline-start" />
          {item.primaryActionLabel}
        </Button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <InfoBox label="责任方" value={record.currentOwner} />
        <InfoBox label="等待时间" value={record.waitTime} />
        <InfoBox label="时效要求" value={record.slaLabel} />
      </div>
      {item.lastReminderAt && (
        <div className="mt-3 text-xs text-muted-foreground">
          最近催办：{item.lastReminderAt}
        </div>
      )}
    </div>
  )
}

function ReminderTemplateRow({
  template,
  onSendReminder,
}: {
  template: (typeof reminderTemplates)[number]
  onSendReminder: () => void
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card/80 p-3 shadow-sm shadow-primary/5">
      <div className="flex flex-wrap gap-2">
        {template.appliesTo.map((status) => (
          <Badge key={status} variant="outline">
            {adminStatusLabels[status]}
          </Badge>
        ))}
      </div>
      <div className="mt-3 text-xs text-muted-foreground">
        发送至 {audienceLabels[template.targetRole]}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{template.detail}</p>
      <Button className="mt-3 w-full justify-start" variant="outline" onClick={onSendReminder}>
        <SendIcon data-icon="inline-start" />
        {template.title}
      </Button>
    </div>
  )
}

function ExpertsPage({
  experts,
  onChangeExperts,
  onSendReminder,
}: {
  experts: ExpertServiceRecord[]
  onChangeExperts: Dispatch<ExpertServiceRecord[] | ((current: ExpertServiceRecord[]) => ExpertServiceRecord[])>
  onSendReminder: (
    targetRole: Exclude<UserRole, "admin">,
    title: string,
    detail: string,
  ) => void
}) {
  const [form, setForm] = useState<ExpertFormState>(emptyExpertForm)
  const [copiedInviteCode, setCopiedInviteCode] = useState("")
  const availableCount = experts.filter(
    (expert) => expert.inviteStatus === "activated" && expert.status === "available",
  ).length
  const pendingInviteCount = experts.filter((expert) =>
    ["not_generated", "generated", "sent"].includes(expert.inviteStatus),
  ).length
  const activatedCount = experts.filter((expert) => expert.inviteStatus === "activated").length

  function updateForm(key: keyof ExpertFormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateExpert(expertId: string, patch: Partial<ExpertServiceRecord>) {
    onChangeExperts((current) =>
      current.map((expert) => (expert.id === expertId ? { ...expert, ...patch } : expert)),
    )
  }

  function createExpert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextIndex = experts.length + 1
    const inviteCode = generateExpertInviteCode(nextIndex)
    const nextExpert: ExpertServiceRecord = {
      id: `expert-added-${nextIndex}`,
      name: form.name.trim() || "新专家",
      hospital: form.hospital.trim() || "待完善医院",
      department: form.department.trim() || "待完善科室",
      title: form.title.trim() || "医师",
      specialties: splitList(form.specialties),
      status: "offline",
      slots: splitList(form.slots),
      hometownTag: form.hometownTag.trim() || "乡贤专家",
      mobileMasked: form.mobileMasked.trim() || "待补充",
      inviteCode,
      inviteStatus: "generated",
      source: form.source.trim() || "运营录入",
      createdAt: "2026-07-12 11:20",
      lastInviteAt: "未发送",
    }

    onChangeExperts((current) => [nextExpert, ...current])
    setForm({
      ...emptyExpertForm,
      name: "",
      mobileMasked: "",
      specialties: "",
      slots: "",
    })
  }

  function generateInvite(expertId: string) {
    updateExpert(expertId, {
      inviteCode: generateExpertInviteCode(experts.length + 1),
      inviteStatus: "generated",
      lastInviteAt: "未发送",
    })
  }

  function sendInvite(expert: ExpertServiceRecord) {
    const inviteCode = expert.inviteCode || generateExpertInviteCode(experts.length + 1)
    updateExpert(expert.id, {
      inviteCode,
      inviteStatus: "sent",
      lastInviteAt: "2026-07-12 11:30",
    })
  }

  function copyInvite(inviteCode: string) {
    if (!inviteCode) return
    void navigator.clipboard?.writeText(inviteCode)
    setCopiedInviteCode(inviteCode)
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard title="专家总数" value={experts.length} icon={StethoscopeIcon} />
        <MetricCard title="可服务" value={availableCount} icon={CheckCircle2Icon} />
        <MetricCard title="待邀约" value={pendingInviteCount} icon={BellRingIcon} tone="warning" />
        <MetricCard title="已激活" value={activatedCount} icon={KeyRoundIcon} />
      </section>

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>专家档案</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-xl border border-border/80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>专家</TableHead>
                      <TableHead>医院科室</TableHead>
                      <TableHead>服务状态</TableHead>
                      <TableHead>邀约状态</TableHead>
                      <TableHead>邀请码</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {experts.map((expert) => {
                      const isActivated = expert.inviteStatus === "activated"

                      return (
                        <TableRow key={expert.id}>
                          <TableCell>
                            <div className="font-medium">{expert.name} · {expert.title}</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {expert.specialties.slice(0, 2).map((item) => (
                                <Badge key={item} variant="outline">{item}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>{expert.hospital}</div>
                            <div className="text-xs text-muted-foreground">{expert.department}</div>
                          </TableCell>
                          <TableCell>
                            {isActivated ? (
                              <div className="flex flex-wrap gap-1">
                                {(["available", "busy", "offline"] as const).map((status) => (
                                  <Button
                                    key={status}
                                    size="sm"
                                    variant={expert.status === status ? "default" : "outline"}
                                    onClick={() => updateExpert(expert.id, { status })}
                                  >
                                    {getExpertStatusLabel(status)}
                                  </Button>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">未开通</span>
                            )}
                          </TableCell>
                          <TableCell><InviteStatusBadge status={expert.inviteStatus} /></TableCell>
                          <TableCell>
                            {expert.inviteCode ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-secondary/35 px-2 py-1 text-xs font-medium text-foreground transition hover:bg-secondary/60"
                                onClick={() => copyInvite(expert.inviteCode)}
                              >
                                <CopyIcon className="size-3" />
                                {copiedInviteCode === expert.inviteCode ? "已复制" : expert.inviteCode}
                              </button>
                            ) : (
                              <Badge variant="outline">未生成</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => generateInvite(expert.id)}
                              >
                                <KeyRoundIcon data-icon="inline-start" />
                                {expert.inviteCode ? "重生成" : "生成"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => sendInvite(expert)}
                              >
                                <SendIcon data-icon="inline-start" />
                                邀约
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>邀约跟进</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {experts.map((expert) => (
                <div key={expert.id} className="rounded-xl border border-border/80 bg-card/80 p-3 shadow-sm shadow-primary/5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{expert.name}</div>
                    <InviteStatusBadge status={expert.inviteStatus} />
                  </div>
                  <div className="mt-2 grid gap-2 text-sm">
                    <InfoInline label="来源" value={expert.source} />
                    <InfoInline label="手机" value={expert.mobileMasked} />
                    <InfoInline label="邀请码" value={expert.inviteCode || "未生成"} />
                    <InfoInline label="最近邀约" value={expert.lastInviteAt} />
                  </div>
                  <Button
                    className="mt-3 w-full"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onSendReminder(
                        "expert",
                        "专家服务提醒",
                        `${expert.name}当前邀约状态：${getInviteStatusLabel(expert.inviteStatus)}。`,
                      )
                    }
                  >
                    <SendIcon data-icon="inline-start" />
                    服务提醒
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <form onSubmit={createExpert}>
            <Card>
              <CardHeader>
                <CardTitle>新专家录入</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <FieldInput label="姓名" value={form.name} onChange={(value) => updateForm("name", value)} />
                <FieldInput label="医院" value={form.hospital} onChange={(value) => updateForm("hospital", value)} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldInput label="科室" value={form.department} onChange={(value) => updateForm("department", value)} />
                  <FieldInput label="职称" value={form.title} onChange={(value) => updateForm("title", value)} />
                </div>
                <FieldInput label="联系方式" value={form.mobileMasked} onChange={(value) => updateForm("mobileMasked", value)} />
                <FieldInput label="乡贤标签" value={form.hometownTag} onChange={(value) => updateForm("hometownTag", value)} />
                <FieldInput label="来源" value={form.source} onChange={(value) => updateForm("source", value)} />
                <label className="grid gap-2">
                  <span className="text-sm font-medium">擅长方向</span>
                  <Textarea
                    value={form.specialties}
                    rows={3}
                    onChange={(event) => updateForm("specialties", event.target.value)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">可约时段</span>
                  <Textarea
                    value={form.slots}
                    rows={2}
                    onChange={(event) => updateForm("slots", event.target.value)}
                  />
                </label>
                <Button type="submit">
                  <UserPlusIcon data-icon="inline-start" />
                  录入并生成邀请码
                </Button>
              </CardContent>
            </Card>
          </form>

          <Card>
            <CardHeader>
              <CardTitle>邀请码管理</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {experts.map((expert) => (
                <div key={expert.id} className="rounded-xl border border-border/80 bg-card/80 p-3 shadow-sm shadow-primary/5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{expert.name}</span>
                    <InviteStatusBadge status={expert.inviteStatus} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="font-mono text-sm">{expert.inviteCode || "未生成"}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generateInvite(expert.id)}
                    >
                      <KeyRoundIcon data-icon="inline-start" />
                      生成
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

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
  const [filter, setFilter] = useState<QualityFilter>("all")
  const selectedRecord =
    records.find((record) => record.consultation.id === selectedCaseId) ?? records[0]
  const visibleRecords = records.filter((record) => {
    if (filter === "all") return true

    return getQualityCaseState(record, qualityStates).status === filter
  })

  return (
    <div className="flex flex-col gap-4">
      <SectionIntro title="质控归档中心" icon={ClipboardCheckIcon} />
      <QualityOverviewCards records={records} qualityStates={qualityStates} />

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <QualityQueue
          activeFilter={filter}
          qualityStates={qualityStates}
          records={visibleRecords}
          selectedCaseId={selectedRecord.consultation.id}
          onFilterChange={setFilter}
          onSelectCase={onSelectCase}
        />
        <QualityCasePanel
          record={selectedRecord}
          state={getQualityCaseState(selectedRecord, qualityStates)}
          onUpdate={(updater) => onUpdateCase(selectedRecord.consultation.id, updater)}
          onSendReminder={onSendReminder}
          onArchive={() => onArchive(selectedRecord)}
        />
      </div>
    </div>
  )
}

function QualityOverviewCards({
  records,
  qualityStates,
}: {
  records: AdminCaseRecord[]
  qualityStates: Record<string, QualityCaseState>
}) {
  const states = records.map((record) => getQualityCaseState(record, qualityStates))
  const archived = states.filter((state) =>
    ["archived", "sampling", "sample_passed", "sample_issue"].includes(state.status),
  ).length
  const sampled = states.filter((state) => state.samplingStatus !== "none")
  const samplePassed = sampled.filter((state) => state.samplingStatus === "passed").length
  const sampleRate = sampled.length === 0 ? "0%" : `${Math.round((samplePassed / sampled.length) * 100)}%`

  return (
    <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      <MetricCard title="待质控" value={states.filter((state) => state.status === "pending_review").length} icon={ClipboardCheckIcon} />
      <MetricCard title="有缺项" value={states.filter((state) => state.status === "missing_items").length} icon={FileCheck2Icon} tone="warning" />
      <MetricCard title="整改中" value={states.filter((state) => state.status === "rectification").length} icon={BellRingIcon} tone="warning" />
      <MetricCard title="可归档" value={states.filter((state) => state.status === "ready_to_archive").length} icon={ArchiveIcon} />
      <MetricCard title="今日归档" value={archived} icon={CheckCircle2Icon} />
      <MetricCard title="抽检通过率" value={sampleRate} icon={BarChart3Icon} />
    </section>
  )
}

function QualityQueue({
  records,
  qualityStates,
  selectedCaseId,
  activeFilter,
  onFilterChange,
  onSelectCase,
}: {
  records: AdminCaseRecord[]
  qualityStates: Record<string, QualityCaseState>
  selectedCaseId: string
  activeFilter: QualityFilter
  onFilterChange: (filter: QualityFilter) => void
  onSelectCase: (id: string) => void
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>质控队列</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {qualityFilterItems.map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant={activeFilter === item.key ? "default" : "outline"}
              onClick={() => onFilterChange(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {records.map((record) => {
            const state = getQualityCaseState(record, qualityStates)
            const missingCount = getQualityMissingCount(state)
            const openIssueCount = state.issues.filter((issue) => issue.status !== "resolved").length

            return (
              <button
                key={record.consultation.id}
                type="button"
                className={cn(
                  "rounded-xl border border-border/80 bg-card/80 p-3 text-left shadow-sm shadow-primary/5 transition hover:bg-secondary/45",
                  selectedCaseId === record.consultation.id && "border-primary/45 bg-primary/5",
                )}
                onClick={() => onSelectCase(record.consultation.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {record.consultation.patient.name} · {record.consultation.department}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {record.doctorName} / {record.expertName}
                    </div>
                  </div>
                  <QualityStatusBadge status={state.status} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <span>缺项 {missingCount}</span>
                  <span>问题 {openIssueCount}</span>
                  <span>{record.waitTime}</span>
                </div>
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function QualityCasePanel({
  record,
  state,
  onUpdate,
  onSendReminder,
  onArchive,
}: {
  record: AdminCaseRecord
  state: QualityCaseState
  onUpdate: (updater: (current: QualityCaseState) => QualityCaseState) => void
  onSendReminder: (
    targetRole: Exclude<UserRole, "admin">,
    title: string,
    detail: string,
  ) => void
  onArchive: () => void
}) {
  const canArchive = canArchiveQualityCase(record, state)
  const isArchived = state.status === "archived"
  const failedRequiredItems = getFailedRequiredQualityItems(state)
  const missingLabels = failedRequiredItems.map((item) => item.label).join("、")

  function setCheckResult(key: string, result: QualityCheckResult) {
    onUpdate((current) => ({
      ...current,
      checks: {
        ...current.checks,
        [key]: result,
      },
    }))
  }

  function rejectToDoctor() {
    const detail = `运营质控驳回${record.consultation.patient.name}的会诊单，需医生端补充或确认：${missingLabels || "会诊质控资料"}。请补齐后重新提交质控。`

    onUpdate((current) => ({
      ...current,
      issues: [
        ...current.issues,
        {
          id: `issue-${current.issues.length + 1}`,
          type: "missing_attachment",
          label: "质控驳回",
          ownerRole: "doctor",
          note: `缺项：${missingLabels || "会诊质控资料"}。请医生端补充后重新提交质控。`,
          status: "reminded",
        },
      ],
    }))
    onSendReminder("doctor", "质控驳回：请补充会诊资料", detail)
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{record.consultation.patient.name} 质控办理</CardTitle>
              <div className="mt-1 text-sm text-muted-foreground">
                {record.consultation.id} · {record.doctorOrg} · {record.expertName}
              </div>
            </div>
            <QualityStatusBadge status={state.status} />
          </div>
        </CardHeader>
        <CardContent>
          <CaseMiniSummary record={record} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>核查清单</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {qualityGroups.map((group) => (
            <div key={group} className="flex flex-col gap-2">
              <div className="text-sm font-medium">{group}</div>
              {qualityCheckItems
                .filter((item) => item.group === group)
                .map((item) => (
                  <div key={item.key} className="grid gap-2 rounded-xl border border-border/80 bg-card/80 p-3 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm">{item.label}</span>
                      {item.required && <Badge variant="secondary">必检</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(["pass", "fail", "na"] as const).map((result) => (
                        <Button
                          key={result}
                          size="sm"
                          variant={state.checks[item.key] === result ? "default" : "outline"}
                          onClick={() => setCheckResult(item.key, result)}
                        >
                          {getQualityCheckResultLabel(result)}
                        </Button>
                      ))}
                    </div>
                  </div>
              ))}
            </div>
          ))}
          <QualityChecklistAction
            canArchive={canArchive}
            isArchived={isArchived}
            missingLabels={missingLabels}
            missingRequiredCount={failedRequiredItems.length}
            onArchive={onArchive}
            onReject={rejectToDoctor}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>归档包</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col gap-3">
            <InfoBox
              label="归档条件"
              value={
                isArchived
                  ? "已完成归档"
                  : canArchive
                    ? "已满足归档条件"
                    : "仍有未完成质控项或整改任务"
              }
            />
            <Textarea
              value={state.archiveNote}
              rows={3}
              onChange={(event) =>
                onUpdate((current) => ({ ...current, archiveNote: event.target.value }))
              }
              placeholder="填写归档说明"
            />
          </div>
          <QualityArchivePreview record={record} />
        </CardContent>
      </Card>
    </div>
  )
}

function QualityChecklistAction({
  canArchive,
  isArchived,
  missingLabels,
  missingRequiredCount,
  onArchive,
  onReject,
}: {
  canArchive: boolean
  isArchived: boolean
  missingLabels: string
  missingRequiredCount: number
  onArchive: () => void
  onReject: () => void
}) {
  if (isArchived) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">核查结论</span>
              <Badge>已归档</Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              质控已完成，归档包可用于后续复盘。
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (canArchive) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">核查结论</span>
              <Badge>可归档</Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              必检项已通过，归档说明已填写。
            </p>
          </div>
          <Button onClick={onArchive}>
            <ArchiveIcon data-icon="inline-start" />
            归档
          </Button>
        </div>
      </div>
    )
  }

  if (missingRequiredCount > 0) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">核查结论</span>
              <Badge variant="destructive">有缺项</Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              缺项：{missingLabels || "会诊质控资料"}
            </p>
          </div>
          <Button variant="destructive" onClick={onReject}>
            <SendIcon data-icon="inline-start" />
            驳回医生端补充
          </Button>
        </div>
      </div>
    )
  }

  return null
}

function QualityArchivePreview({ record }: { record: AdminCaseRecord }) {
  const advice = record.consultation.expertAdvice
  const latestTimeline = record.consultation.timeline.slice(-4)

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-border/80 bg-card/80 p-3">
        <div className="text-sm font-medium">流程留痕</div>
        <div className="mt-3 flex flex-col gap-3">
          {latestTimeline.map((item) => (
            <div key={item.id} className="grid grid-cols-[auto_1fr] gap-3">
              <div className="mt-1.5 size-2 rounded-full bg-primary" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">{item.label}</span>
                  <AdminStatusBadge status={item.status} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{item.at}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card/80 p-3">
        <div className="text-sm font-medium">远程会诊建议</div>
        {advice ? (
          <div className="mt-3 grid gap-2 text-sm leading-6">
            <InfoBox label="倾向意见" value={advice.diagnosisSuggestion} />
            <InfoBox label="治疗参考" value={advice.treatmentSuggestion} />
            <InfoBox label="风险提示" value={advice.riskNotice} />
          </div>
        ) : (
          <div className="mt-3 rounded-xl bg-secondary/50 p-3 text-sm text-muted-foreground">
            等待专家提交会诊建议
          </div>
        )}
      </div>
    </div>
  )
}

function MessagesPage({
  session,
  operationLogs,
}: {
  session: DemoSession
  operationLogs: OperationLog[]
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>消息通知中心</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {session.notifications.length === 0 ? (
            <EmptyState title="暂无协同通知" />
          ) : (
            session.notifications.slice().reverse().map((notification) => (
              <div key={notification.id} className="rounded-xl border border-border/80 bg-card/80 p-3 shadow-sm shadow-primary/5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{notification.title}</span>
                  <Badge variant="outline">{audienceLabels[notification.audience]}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {notification.detail}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>运营记录</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {operationLogs.slice().reverse().map((log) => (
            <OperationLogItem key={log.id} log={log} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function ReportsPage() {
  const statusRows = getReportStatusRows()

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard title="会诊总量" value={reportMetrics.total} icon={ClipboardListIcon} />
        <MetricCard title="闭环率" value={reportMetrics.completionRate} icon={CheckCircle2Icon} />
        <MetricCard title="资料补充率" value={reportMetrics.supplementRate} icon={FileCheck2Icon} />
        <MetricCard title="平均响应" value={reportMetrics.avgResponse} icon={AlarmClockIcon} />
      </section>
      <Card>
        <CardHeader>
          <CardTitle>状态分布</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {statusRows.map((row) => (
            <div key={row.status} className="grid gap-2 md:grid-cols-[130px_1fr_48px] md:items-center">
              <div className="text-sm font-medium">{adminStatusLabels[row.status]}</div>
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${row.percent}%` }}
                />
              </div>
              <div className="text-sm text-muted-foreground">{row.count} 单</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function SettingsPage() {
  const [settings, setSettings] = useState({
    expertReview: "120",
    urgentReview: "30",
    adviceSubmit: "30",
    archiveHours: "24",
    invitePrefix: "QYXY",
  })

  function updateSetting(key: keyof typeof settings, value: string) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="grid max-w-2xl gap-4">
      <Card>
        <CardHeader>
          <CardTitle>系统设置</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <SettingInput
            label="普通专家预审时限（分钟）"
            value={settings.expertReview}
            onChange={(value) => updateSetting("expertReview", value)}
          />
          <SettingInput
            label="紧急预审时限（分钟）"
            value={settings.urgentReview}
            onChange={(value) => updateSetting("urgentReview", value)}
          />
          <SettingInput
            label="专家建议提交时限（分钟）"
            value={settings.adviceSubmit}
            onChange={(value) => updateSetting("adviceSubmit", value)}
          />
          <SettingInput
            label="运营归档时限（小时）"
            value={settings.archiveHours}
            onChange={(value) => updateSetting("archiveHours", value)}
          />
          <SettingInput
            label="专家邀请码前缀"
            value={settings.invitePrefix}
            onChange={(value) => updateSetting("invitePrefix", value)}
          />
        </CardContent>
      </Card>

    </div>
  )
}

function CaseQueueRow({
  record,
  onOpen,
  onSendReminder,
}: {
  record: AdminCaseRecord
  onOpen: () => void
  onSendReminder: () => void
}) {
  return (
    <div className="grid gap-3 rounded-xl border border-border/80 bg-card/80 p-3 shadow-sm shadow-primary/5 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{record.consultation.patient.name}</span>
          <AdminStatusBadge status={record.consultation.status} />
          {record.consultation.priority === "urgent" && <Badge variant="destructive">紧急</Badge>}
        </div>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {record.doctorOrg} · {record.doctorName} / {record.expertName}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {record.operationNeed} · {record.waitTime}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <Button size="sm" variant="outline" onClick={onOpen}>
          查看
          <ChevronRightIcon data-icon="inline-end" />
        </Button>
        <Button size="sm" onClick={onSendReminder} disabled={!record.currentOwnerRole}>
          <BellRingIcon data-icon="inline-start" />
          催办
        </Button>
      </div>
    </div>
  )
}

function CaseMiniSummary({ record }: { record: AdminCaseRecord }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <InfoBox
        label="患者"
        value={`${record.consultation.patient.name} · ${record.consultation.patient.gender} · ${record.consultation.patient.age}岁`}
      />
      <InfoBox label="当前状态" value={adminStatusLabels[record.consultation.status]} />
      <InfoBox label="本地医生" value={`${record.doctorOrg} · ${record.doctorName}`} />
      <InfoBox label="会诊专家" value={`${record.expertOrg} · ${record.expertName}`} />
      <InfoBox label="当前责任方" value={record.currentOwner} />
      <InfoBox label="SLA" value={record.slaLabel} />
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
  tone = "default",
}: {
  title: string
  value: number | string
  icon: typeof ActivityIcon
  tone?: "default" | "warning" | "danger"
}) {
  return (
    <Card className="relative min-h-[112px] overflow-hidden">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          tone === "danger"
            ? "bg-destructive"
            : tone === "warning"
              ? "bg-amber-400"
              : "bg-primary",
        )}
      />
      <CardHeader className="pb-1.5 pt-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">{title}</CardTitle>
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-lg ring-1 ring-inset",
              tone === "danger"
                ? "bg-destructive/10 text-destructive ring-destructive/15"
                : tone === "warning"
                  ? "bg-amber-100 text-amber-700 ring-amber-200"
                  : "bg-primary/10 text-primary ring-primary/15",
            )}
          >
            <Icon className="size-4" />
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold leading-none tracking-tight text-foreground">{value}</div>
      </CardContent>
    </Card>
  )
}

function SectionIntro({
  title,
  icon: Icon,
}: {
  title: string
  icon: typeof ActivityIcon
}) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        </div>
      </div>
    </section>
  )
}

function OperationLogItem({ log }: { log: OperationLog }) {
  return (
    <div className="rounded-xl border border-border/80 bg-card/80 p-3 shadow-sm shadow-primary/5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <OperationIcon action={log.action} />
          <span className="text-sm font-medium">{log.title}</span>
        </div>
        <Badge variant="outline">{getOperationActionLabel(log.action)}</Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{log.detail}</p>
      <div className="mt-2 text-xs text-muted-foreground">
        {log.actorName} · {log.createdAt}
        {log.targetRole && ` · 发送至${audienceLabels[log.targetRole]}`}
      </div>
    </div>
  )
}

function FieldInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function SettingInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function InfoInline({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-secondary/35 p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm leading-6 text-foreground">{value}</div>
    </div>
  )
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <p className="mt-1 text-sm leading-6">{value}</p>
    </div>
  )
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/80 bg-secondary/40 p-4 text-center">
      <MessageSquareTextIcon className="mx-auto size-6 text-muted-foreground" />
      <div className="mt-2 text-sm font-medium">{title}</div>
    </div>
  )
}

function RiskBadge({ risk }: { risk: AdminCaseRecord["riskLevel"] }) {
  if (risk === "urgent") {
    return <Badge className="border-red-200 bg-red-50 text-red-700" variant="outline">紧急</Badge>
  }
  if (risk === "warning") {
    return <Badge className="border-amber-200 bg-amber-50 text-amber-700" variant="outline">需关注</Badge>
  }
  if (risk === "done") {
    return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">已闭环</Badge>
  }
  return <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">正常</Badge>
}

function AdminStatusBadge({ status }: { status: ConsultationStatus }) {
  const className =
    status === "archived"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "completed"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : ["needs_more_info", "offline_emergency", "expert_declined"].includes(status)
          ? "border-red-200 bg-red-50 text-red-700"
          : ["pending_advice", "pending_doctor_confirm", "closed_incomplete"].includes(status)
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : status === "scheduled" || status === "in_consultation"
              ? "border-cyan-200 bg-cyan-50 text-cyan-700"
              : status === "patient_cancelled"
                ? "border-slate-200 bg-slate-50 text-slate-600"
                : "border-blue-200 bg-blue-50 text-blue-700"

  return <Badge className={className} variant="outline">{adminStatusLabels[status]}</Badge>
}

function QualityStatusBadge({ status }: { status: QualityCaseStatus }) {
  const className =
    status === "missing_items" || status === "sample_issue"
      ? "border-red-200 bg-red-50 text-red-700"
      : status === "rectification" || status === "sampling"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : status === "pending_review"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"

  return <Badge className={className} variant="outline">{qualityStatusLabels[status]}</Badge>
}

function RiskDot({ risk }: { risk: AdminCaseRecord["riskLevel"] }) {
  return (
    <span
      className={cn(
        "size-2 rounded-full",
        risk === "urgent"
          ? "bg-destructive"
          : risk === "warning"
            ? "bg-amber-500"
            : risk === "done"
              ? "bg-primary"
              : "bg-muted-foreground",
      )}
    />
  )
}

function InviteStatusBadge({ status }: { status: InviteStatus }) {
  if (status === "activated") {
    return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">已激活</Badge>
  }
  if (status === "sent") {
    return <Badge className="border-cyan-200 bg-cyan-50 text-cyan-700" variant="outline">已邀约</Badge>
  }
  if (status === "generated") {
    return <Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">已生成</Badge>
  }
  return <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">未生成</Badge>
}

function OperationIcon({ action }: { action: OperationLog["action"] }) {
  const Icon =
    action === "reminder"
      ? BellRingIcon
      : action === "archive"
        ? ArchiveIcon
        : action === "priority"
          ? HeartPulseIcon
          : action === "quality"
            ? ClipboardCheckIcon
            : MessageSquareTextIcon

  return (
    <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <Icon className="size-3.5" />
    </span>
  )
}

function getAdminCounts(records: AdminCaseRecord[], logs: OperationLog[]): AdminCounts {
  return {
    active: records.filter((record) => record.consultation.status !== "archived").length,
    urgent: records.filter((record) => record.riskLevel === "urgent" || record.riskLevel === "warning").length,
    waitingExpert: records.filter((record) => record.currentOwnerRole === "expert").length,
    waitingAdmin: records.filter((record) => record.consultation.status === "completed").length,
    archived: records.filter((record) => record.consultation.status === "archived").length,
    reminders: logs.filter((log) => log.action === "reminder").length,
  }
}

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
  if (record.consultation.status === "needs_more_info") score += 28
  if (record.consultation.status === "scheduled") score += 24
  if (record.consultation.status === "pending_advice") score += 12
  if (record.currentOwnerRole === "expert") score += 8
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
      value: filterReminderQueueItems(items, "risk").length,
      helper: "紧急或需关注",
      tone: "danger",
    },
    {
      key: "pending_expert",
      label: "待专家预审",
      value: items.filter((item) => item.filterKey === "pending_expert").length,
      helper: "专家接诊前",
      tone: "warning",
    },
    {
      key: "needs_more_info",
      label: "待医生补资料",
      value: items.filter((item) => item.filterKey === "needs_more_info").length,
      helper: "资料退回后",
      tone: "warning",
    },
    {
      key: "pending_advice",
      label: "待专家建议",
      value: items.filter((item) => item.filterKey === "pending_advice").length,
      helper: "会诊后建议",
    },
    {
      key: "pending_doctor_confirm",
      label: "待医生确认",
      value: items.filter((item) => item.filterKey === "pending_doctor_confirm").length,
      helper: "处置闭环前",
    },
  ]
}

function getExpertStatusLabel(status: ExpertProfile["status"]) {
  const labels: Record<ExpertProfile["status"], string> = {
    available: "可约",
    busy: "忙碌",
    offline: "暂停",
  }

  return labels[status]
}

function getInviteStatusLabel(status: InviteStatus) {
  const labels: Record<InviteStatus, string> = {
    not_generated: "未生成",
    generated: "已生成",
    sent: "已邀约",
    activated: "已激活",
  }

  return labels[status]
}

function getOperationActionLabel(action: OperationLog["action"]) {
  const labels: Record<OperationLog["action"], string> = {
    reminder: "催办",
    note: "备注",
    priority: "优先级",
    quality: "质控",
    archive: "归档",
  }

  return labels[action]
}

function getQualityCaseState(
  record: AdminCaseRecord,
  qualityStates: Record<string, QualityCaseState>,
) {
  return qualityStates[record.consultation.id] ?? createDefaultQualityCaseState(record)
}

function createDefaultQualityCaseState(record?: AdminCaseRecord): QualityCaseState {
  const checks = createDefaultQualityChecks(record)
  const completedOrArchived = ["completed", "archived"].includes(record?.consultation.status ?? "")
  const archiveNote =
    completedOrArchived
      ? "资料、建议、医生处置和流程留痕已复核，建议归档。"
      : ""

  return normalizeQualityCaseState({
    status: record?.consultation.status === "archived" ? "archived" : "pending_review",
    checks: {
      ...checks,
      archiveNote: archiveNote ? "pass" : checks.archiveNote,
      qualityConclusion: archiveNote ? "pass" : checks.qualityConclusion,
    },
    issues: [],
    archiveNote,
    samplingNote: "",
    samplingStatus: "none",
  })
}

function createDefaultQualityChecks(record?: AdminCaseRecord) {
  const consultation = record?.consultation
  const hasAttachments = (consultation?.attachments.length ?? 0) > 0
  const hasRequiredAttachments =
    (consultation?.requiredAttachmentTypes.length ?? 0) === 0 || hasAttachments
  const hasExpertAdvice = Boolean(consultation?.expertAdvice)
  const hasDisposition = Boolean(consultation?.localDisposition)
  const hasMessages = (consultation?.messages.length ?? 0) > 0
  const hasTimeline = (consultation?.timeline.length ?? 0) > 0
  const completedOrArchived = ["completed", "archived"].includes(consultation?.status ?? "")
  const started = Boolean(consultation && consultation.status !== "draft")

  return {
    application: consultation ? "pass" : "fail",
    patient: consultation?.patient ? "pass" : "fail",
    purpose: consultation?.consultationPurpose ? "pass" : "fail",
    attachments: hasAttachments ? "pass" : "fail",
    requiredAttachments: hasRequiredAttachments ? "pass" : "fail",
    expertReview: started ? "pass" : "fail",
    supplement: "na",
    consultation: hasTimeline ? "pass" : "fail",
    expertAdvice: hasExpertAdvice ? "pass" : "fail",
    doctorDisposition: hasDisposition ? "pass" : "fail",
    riskClosed: hasDisposition || completedOrArchived ? "pass" : "fail",
    sla: record?.riskLevel === "urgent" ? "fail" : "pass",
    messages: hasMessages ? "pass" : "fail",
    operationLogs: "na",
    archiveNote: completedOrArchived ? "pass" : "fail",
    qualityConclusion: completedOrArchived ? "pass" : "fail",
  } satisfies Record<string, QualityCheckResult>
}

function normalizeQualityCaseState(state: QualityCaseState): QualityCaseState {
  if (state.samplingStatus === "sampling") return { ...state, status: "sampling" }
  if (state.samplingStatus === "passed") return { ...state, status: "sample_passed" }
  if (state.samplingStatus === "issue") return { ...state, status: "sample_issue" }
  if (state.status === "archived") return state
  if (state.issues.some((issue) => issue.status !== "resolved")) {
    return { ...state, status: "rectification" }
  }
  if (hasRequiredQualityFailures(state)) return { ...state, status: "missing_items" }
  if (state.archiveNote.trim()) return { ...state, status: "ready_to_archive" }

  return { ...state, status: "pending_review" }
}

function hasRequiredQualityFailures(state: QualityCaseState) {
  return qualityCheckItems.some(
    (item) => item.required && state.checks[item.key] === "fail",
  )
}

function getFailedRequiredQualityItems(state: QualityCaseState) {
  return qualityCheckItems.filter(
    (item) => item.required && state.checks[item.key] === "fail",
  )
}

function getQualityMissingCount(state: QualityCaseState) {
  return qualityCheckItems.filter((item) => state.checks[item.key] === "fail").length
}

function canArchiveQualityCase(record: AdminCaseRecord, state: QualityCaseState) {
  if (state.status === "archived") return false

  const archiveCandidate =
    record.consultation.status === "completed" || state.status === "ready_to_archive"
  const openIssues = state.issues.some((issue) => issue.status !== "resolved")

  return (
    archiveCandidate &&
    state.archiveNote.trim().length > 0 &&
    !openIssues &&
    !hasRequiredQualityFailures(state)
  )
}

function getQualityCheckResultLabel(result: QualityCheckResult) {
  const labels: Record<QualityCheckResult, string> = {
    pass: "通过",
    fail: "不通过",
    na: "不适用",
  }

  return labels[result]
}

function createInitialExpertRecords(experts: ExpertProfile[]): ExpertServiceRecord[] {
  return experts.map((expert, index) => ({
    ...expert,
    mobileMasked: index === 0 ? "139****2601" : "138****5108",
    inviteCode: index === 0 ? "QYXY-2026" : "QYXY-CHEN",
    inviteStatus: index === 0 ? "activated" : "sent",
    source: index === 0 ? "乡贤人才库" : "乡贤推荐",
    createdAt: index === 0 ? "2026-07-01 09:20" : "2026-07-03 14:15",
    lastInviteAt: index === 0 ? "2026-07-01 09:35" : "2026-07-03 14:30",
  }))
}

function splitList(value: string) {
  return value
    .split(/[、,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function generateExpertInviteCode(seed: number) {
  const suffix = String((Date.now() + seed) % 10000).padStart(4, "0")
  return `QYXY-${suffix}`
}

function getReportStatusRows() {
  return reportStatusCounts.map((row) => ({
    ...row,
    percent: Math.max(4, Math.round((row.count / reportMetrics.total) * 100)),
  }))
}
