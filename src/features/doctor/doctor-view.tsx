import {
  ActivityIcon,
  BellRingIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileCheck2Icon,
  FilePlus2Icon,
  FileTextIcon,
  HistoryIcon,
  MessageSquareTextIcon,
  MonitorUpIcon,
  PaperclipIcon,
  Settings2Icon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react"
import {
  type ComponentType,
  type Dispatch,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  AdvicePanel,
  StatusBadge,
  attachmentTypeLabels,
} from "@/components/workflow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { DemoAction, DemoNotification, DemoSession } from "@/domain/demo-session"
import type { AttachmentType, Consultation, ConsultationStatus } from "@/domain/types"
import {
  type AdminCaseRecord,
  getAdminCaseRecords,
} from "@/features/admin/admin-data"
import { cn } from "@/lib/utils"

interface DoctorViewProps {
  session: DemoSession
  dispatch: Dispatch<DemoAction>
}

interface ConsultationFormState {
  patientName: string
  patientGender: "男" | "女"
  patientAge: string
  patientPhoneMasked: string
  patientIdNoMasked: string
  allergyHistory: string
  pastHistory: string
  department: string
  chiefComplaint: string
  consultationPurpose: string
  priority: "normal" | "urgent"
  expertId: string
}

type DoctorSectionKey = "workbench" | "cases" | "postCare" | "messages" | "settings"
type CaseMode = "active" | "new"
type PostCareStatus =
  | "plan"
  | "followup"
  | "cycle"
  | "referral"
  | "transferTracking"
  | "closure"
  | "closed"
type DoctorMessageFilter = "all" | "unread" | "pending" | "consultation" | "postCare"
type DoctorMessageCategory = "consultation" | "postCare" | "coordination" | "system"

interface PostCareRecord {
  id: string
  sourceCaseId: string
  patientName: string
  patientAge: number
  department: string
  expertName: string
  status: PostCareStatus
  riskLevel: "低风险" | "中风险" | "高风险"
  nextActionAt: string
  advice: {
    followUp: string
    referral: string
    riskNotice: string
  }
  plan: {
    disposition: string
    review: string
    medication: string
  }
  followUpPlan: {
    cycle: string
    totalTimes: number
    currentTimes: number
    nextDueAt: string
    method: string
    endCondition: string
  }
  schedule: Array<{
    id: string
    sequence: string
    dueAt: string
    method: string
    status: "已完成" | "待随访" | "未到期" | "逾期" | "已改期"
    result: string
  }>
  followUps: Array<{
    id: string
    at: string
    method: string
    result: string
  }>
  referral: {
    target: string
    reason: string
    status: string
  }
  closure: string
}

interface DoctorMessageRecord {
  id: string
  title: string
  detail: string
  source: string
  relatedCase: string
  patient: string
  time: string
  priority: "普通" | "重要" | "紧急"
  category: DoctorMessageCategory
  unread: boolean
  pending: boolean
  actions: Array<"supplement" | "case" | "postCare" | "external" | "readLater" | "archive">
}

const defaultAttachmentNames: Record<AttachmentType, string> = {
  lab_report: "检验报告.pdf",
  imaging: "影像资料.jpg",
  tongue_face: "舌面照片.jpg",
  ecg: "十二导联心电图.jpg",
  medication_list: "近期用药清单.pdf",
  other: "补充资料.pdf",
}

const doctorSections: Array<{
  key: DoctorSectionKey
  title: string
  icon: ComponentType<{ className?: string }>
}> = [
  { key: "workbench", title: "工作台", icon: ActivityIcon },
  { key: "cases", title: "会诊单管理", icon: ClipboardListIcon },
  { key: "postCare", title: "诊后管理", icon: FileCheck2Icon },
  { key: "messages", title: "消息中心", icon: BellRingIcon },
  { key: "settings", title: "我的设置", icon: Settings2Icon },
]

const statusLabels: Record<ConsultationStatus, string> = {
  draft: "草稿",
  pending_expert: "待专家预审",
  needs_more_info: "待补充资料",
  scheduled: "已预约",
  in_consultation: "外部会诊中",
  pending_advice: "待专家建议",
  pending_doctor_confirm: "待医生确认",
  completed: "已完成",
  archived: "已归档",
  expert_declined: "专家婉拒",
  patient_cancelled: "患者取消",
  closed_incomplete: "资料不足关闭",
  offline_emergency: "转线下急诊",
}

const caseFilters: Array<{ key: "all" | ConsultationStatus; label: string }> = [
  { key: "all", label: "全部" },
  { key: "draft", label: "草稿" },
  { key: "pending_expert", label: "待预审" },
  { key: "needs_more_info", label: "待补资料" },
  { key: "scheduled", label: "已预约" },
  { key: "pending_doctor_confirm", label: "待确认" },
  { key: "completed", label: "已完成" },
]

const postCareStatusLabels: Record<PostCareStatus, string> = {
  plan: "待制定计划",
  followup: "待随访",
  cycle: "周期随访中",
  referral: "待转诊",
  transferTracking: "转诊跟踪中",
  closure: "闭环待确认",
  closed: "已闭环",
}

const doctorMessageFilters: Array<{ key: DoctorMessageFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "unread", label: "未读" },
  { key: "pending", label: "待处理" },
  { key: "consultation", label: "会诊相关" },
  { key: "postCare", label: "诊后相关" },
]

const doctorMessageCategoryLabels: Record<DoctorMessageCategory, string> = {
  consultation: "会诊相关",
  postCare: "诊后相关",
  coordination: "协同消息",
  system: "系统消息",
}

const postCareRecords: PostCareRecord[] = [
  {
    id: "post-care-001",
    sourceCaseId: "consult-20260712-002",
    patientName: "韩某某",
    patientAge: 76,
    department: "全科门诊",
    expertName: "陈医生",
    status: "plan",
    riskLevel: "中风险",
    nextActionAt: "今日 17:30",
    advice: {
      followUp: "一周后复诊，复核血压、血糖和用药依从性。",
      referral: "如胸痛持续或心电图动态改变，建议上转胸痛中心。",
      riskNotice: "持续胸痛、出汗、濒死感时需立即线下急诊。",
    },
    plan: {
      disposition: "继续本地随访，结合现场血压和用药禁忌调整治疗。",
      review: "3 日内电话随访，1 周内门诊复诊。",
      medication: "核对近期用药清单，提醒家属观察胸闷发作频次。",
    },
    followUpPlan: {
      cycle: "每 3 天一次",
      totalTimes: 4,
      currentTimes: 1,
      nextDueAt: "今日 17:30",
      method: "电话随访",
      endCondition: "完成 4 次随访且血压血糖稳定，或已完成转诊处理。",
    },
    schedule: [
      {
        id: "schedule-001-1",
        sequence: "第 1/4 次",
        dueAt: "今日 17:30",
        method: "电话随访",
        status: "待随访",
        result: "启动诊后计划后执行首次随访。",
      },
      {
        id: "schedule-001-2",
        sequence: "第 2/4 次",
        dueAt: "3 天后 09:00",
        method: "电话随访",
        status: "未到期",
        result: "根据首次随访结果自动进入队列。",
      },
    ],
    followUps: [
      {
        id: "follow-001",
        at: "待记录",
        method: "电话随访",
        result: "待医生完成首次诊后随访。",
      },
    ],
    referral: {
      target: "蒙城县中医院胸痛中心",
      reason: "胸痛持续、心电图动态改变或生命体征不稳时转诊。",
      status: "暂不转诊，先本地观察。",
    },
    closure: "待医生确认诊后计划并安排首次随访。",
  },
  {
    id: "post-care-002",
    sourceCaseId: "consult-20260711-014",
    patientName: "沈某某",
    patientAge: 67,
    department: "骨科",
    expertName: "卢主任",
    status: "followup",
    riskLevel: "低风险",
    nextActionAt: "明日 09:00",
    advice: {
      followUp: "48 小时内复核疼痛评分和活动受限情况。",
      referral: "若疼痛加重或出现神经压迫症状，建议骨科门诊进一步检查。",
      riskNotice: "出现下肢麻木、大小便异常需立即线下就诊。",
    },
    plan: {
      disposition: "继续本地镇痛和康复指导。",
      review: "明日上午电话随访，记录疼痛评分。",
      medication: "提醒按医嘱用药，避免自行加量。",
    },
    followUpPlan: {
      cycle: "48 小时一次",
      totalTimes: 3,
      currentTimes: 2,
      nextDueAt: "明日 09:00",
      method: "电话随访",
      endCondition: "完成 3 次随访且疼痛评分持续下降。",
    },
    schedule: [
      {
        id: "schedule-002-1",
        sequence: "第 1/3 次",
        dueAt: "昨日 18:20",
        method: "家属反馈",
        status: "已完成",
        result: "疼痛减轻，可短距离行走。",
      },
      {
        id: "schedule-002-2",
        sequence: "第 2/3 次",
        dueAt: "明日 09:00",
        method: "电话随访",
        status: "待随访",
        result: "需记录疼痛评分和活动受限情况。",
      },
    ],
    followUps: [
      {
        id: "follow-002",
        at: "昨日 18:20",
        method: "家属反馈",
        result: "疼痛较会诊前减轻，可短距离行走。",
      },
    ],
    referral: {
      target: "蒙城县中医院骨科门诊",
      reason: "症状反复或活动受限未改善时转诊。",
      status: "未触发转诊条件。",
    },
    closure: "完成明日随访后判断是否继续观察。",
  },
  {
    id: "post-care-003",
    sourceCaseId: "consult-20260710-021",
    patientName: "李某某",
    patientAge: 70,
    department: "心血管内科",
    expertName: "卢主任",
    status: "referral",
    riskLevel: "高风险",
    nextActionAt: "今日 15:40",
    advice: {
      followUp: "转诊后 24 小时内电话确认到院和检查结果。",
      referral: "建议尽快上转胸痛中心，完善冠脉 CTA 和心肌酶谱。",
      riskNotice: "持续胸痛、出汗、濒死感时立即急诊。",
    },
    plan: {
      disposition: "已向患者和家属解释转诊必要性。",
      review: "今日确认是否到达胸痛中心。",
      medication: "转诊途中携带现有病历、用药清单和心电图。",
    },
    followUpPlan: {
      cycle: "转诊后 24 小时内",
      totalTimes: 2,
      currentTimes: 1,
      nextDueAt: "今日 15:40",
      method: "电话确认",
      endCondition: "确认患者到院并回填初步检查结果。",
    },
    schedule: [
      {
        id: "schedule-003-1",
        sequence: "第 1/2 次",
        dueAt: "今日 14:10",
        method: "电话随访",
        status: "已完成",
        result: "家属已同意转诊，正在前往县医院。",
      },
      {
        id: "schedule-003-2",
        sequence: "第 2/2 次",
        dueAt: "今日 15:40",
        method: "到院确认",
        status: "待随访",
        result: "待确认是否到达胸痛中心。",
      },
    ],
    followUps: [
      {
        id: "follow-003",
        at: "今日 14:10",
        method: "电话随访",
        result: "家属已同意转诊，正在前往县医院。",
      },
    ],
    referral: {
      target: "蒙城县中医院胸痛中心",
      reason: "胸痛持续且活动耐量下降，需要线下进一步评估。",
      status: "患者同意，待确认到院。",
    },
    closure: "待回填转诊到院情况和初步检查结果。",
  },
  {
    id: "post-care-006",
    sourceCaseId: "consult-20260710-027",
    patientName: "吴某某",
    patientAge: 72,
    department: "心血管内科",
    expertName: "卢主任",
    status: "transferTracking",
    riskLevel: "高风险",
    nextActionAt: "今日 18:00",
    advice: {
      followUp: "转诊到院后补齐检查结果并判断是否转回本地随访。",
      referral: "已建议上转县医院心内科进一步评估。",
      riskNotice: "胸痛、气促或血压明显异常时按急诊流程处理。",
    },
    plan: {
      disposition: "已完成转诊登记，等待医院检查反馈。",
      review: "今日 18:00 前确认检查结果。",
      medication: "保持现有用药清单随转诊资料流转。",
    },
    followUpPlan: {
      cycle: "到院后 24 小时内",
      totalTimes: 2,
      currentTimes: 1,
      nextDueAt: "今日 18:00",
      method: "转诊结果回访",
      endCondition: "获得检查结果并明确转回本地随访或继续上级医院处理。",
    },
    schedule: [
      {
        id: "schedule-006-1",
        sequence: "第 1/2 次",
        dueAt: "今日 13:30",
        method: "到院确认",
        status: "已完成",
        result: "患者已到达县医院心内科。",
      },
      {
        id: "schedule-006-2",
        sequence: "第 2/2 次",
        dueAt: "今日 18:00",
        method: "检查结果回填",
        status: "待随访",
        result: "待补充心电图和心肌酶结果。",
      },
    ],
    followUps: [
      {
        id: "follow-006",
        at: "今日 13:30",
        method: "电话确认",
        result: "患者已到院，等待检查。",
      },
    ],
    referral: {
      target: "蒙城县第一人民医院心内科",
      reason: "胸闷反复，需线下完善检查。",
      status: "已到院，检查结果待回填。",
    },
    closure: "待医生补充检查结果后判断后续随访路径。",
  },
  {
    id: "post-care-007",
    sourceCaseId: "consult-20260710-033",
    patientName: "郑某某",
    patientAge: 68,
    department: "呼吸内科",
    expertName: "陈医生",
    status: "closure",
    riskLevel: "低风险",
    nextActionAt: "今日 16:20",
    advice: {
      followUp: "完成两次电话随访后，如症状稳定可闭环。",
      referral: "暂无转诊指征，症状反复时再评估。",
      riskNotice: "呼吸困难、发热加重时及时线下就诊。",
    },
    plan: {
      disposition: "已完成本地用药宣教和复诊提醒。",
      review: "两次电话随访均已完成。",
      medication: "患者按医嘱用药，未反馈明显不良反应。",
    },
    followUpPlan: {
      cycle: "每周一次",
      totalTimes: 2,
      currentTimes: 2,
      nextDueAt: "今日 16:20",
      method: "电话随访",
      endCondition: "两次随访稳定且患者无新增风险反馈。",
    },
    schedule: [
      {
        id: "schedule-007-1",
        sequence: "第 1/2 次",
        dueAt: "上周三 10:00",
        method: "电话随访",
        status: "已完成",
        result: "咳嗽减轻，无发热。",
      },
      {
        id: "schedule-007-2",
        sequence: "第 2/2 次",
        dueAt: "今日 16:20",
        method: "电话随访",
        status: "已完成",
        result: "症状稳定，具备闭环条件。",
      },
    ],
    followUps: [
      {
        id: "follow-007",
        at: "今日 16:20",
        method: "电话随访",
        result: "患者症状稳定，无新增异常。",
      },
    ],
    referral: {
      target: "暂无",
      reason: "症状稳定，无上转指征。",
      status: "无需转诊。",
    },
    closure: "达到周期随访结束条件，待医生确认闭环。",
  },
  {
    id: "post-care-004",
    sourceCaseId: "consult-20260709-016",
    patientName: "赵某某",
    patientAge: 63,
    department: "内分泌科",
    expertName: "陈医生",
    status: "cycle",
    riskLevel: "中风险",
    nextActionAt: "周五 10:00",
    advice: {
      followUp: "一周内复查空腹血糖和餐后血糖。",
      referral: "若血糖持续失控或出现酮症风险，建议内分泌专科就诊。",
      riskNotice: "乏力、口渴明显加重或意识改变需及时就医。",
    },
    plan: {
      disposition: "本地观察并调整饮食和用药依从性管理。",
      review: "周五门诊复查血糖记录。",
      medication: "核对降糖药使用时间，避免漏服。",
    },
    followUpPlan: {
      cycle: "每周一次",
      totalTimes: 4,
      currentTimes: 2,
      nextDueAt: "周五 10:00",
      method: "门诊复查",
      endCondition: "连续两次血糖记录稳定，且无酮症风险。",
    },
    schedule: [
      {
        id: "schedule-004-1",
        sequence: "第 1/4 次",
        dueAt: "周一 16:30",
        method: "门诊复诊",
        status: "已完成",
        result: "空腹血糖较前下降。",
      },
      {
        id: "schedule-004-2",
        sequence: "第 2/4 次",
        dueAt: "周五 10:00",
        method: "门诊复查",
        status: "未到期",
        result: "等待复查血糖记录。",
      },
    ],
    followUps: [
      {
        id: "follow-004",
        at: "周一 16:30",
        method: "门诊复诊",
        result: "空腹血糖较前下降，仍需观察餐后波动。",
      },
    ],
    referral: {
      target: "县医院内分泌科",
      reason: "连续两次复查仍明显异常时转诊。",
      status: "继续本地观察。",
    },
    closure: "观察至下次复查后再判断是否闭环。",
  },
  {
    id: "post-care-005",
    sourceCaseId: "consult-20260711-018",
    patientName: "马某某",
    patientAge: 61,
    department: "中医内科",
    expertName: "陈医生",
    status: "closed",
    riskLevel: "低风险",
    nextActionAt: "已完成",
    advice: {
      followUp: "两周后按需复诊。",
      referral: "暂无转诊指征。",
      riskNotice: "症状明显加重时及时回院。",
    },
    plan: {
      disposition: "采纳专家调理建议并完成用药宣教。",
      review: "已完成两次随访。",
      medication: "患者反馈睡眠改善，继续按医嘱观察。",
    },
    followUpPlan: {
      cycle: "两周一次",
      totalTimes: 2,
      currentTimes: 2,
      nextDueAt: "已完成",
      method: "电话随访",
      endCondition: "两次随访均稳定且患者认可当前方案。",
    },
    schedule: [
      {
        id: "schedule-005-1",
        sequence: "第 1/2 次",
        dueAt: "上周二 09:20",
        method: "电话随访",
        status: "已完成",
        result: "睡眠有所改善。",
      },
      {
        id: "schedule-005-2",
        sequence: "第 2/2 次",
        dueAt: "昨日 11:20",
        method: "电话随访",
        status: "已完成",
        result: "无明显心悸，诊后目标达成。",
      },
    ],
    followUps: [
      {
        id: "follow-005",
        at: "昨日 11:20",
        method: "电话随访",
        result: "睡眠改善，无明显心悸，患者认可当前方案。",
      },
    ],
    referral: {
      target: "暂无",
      reason: "症状缓解，无上转指征。",
      status: "无需转诊。",
    },
    closure: "诊后目标达成，已完成闭环。",
  },
]

export function DoctorView({ session, dispatch }: DoctorViewProps) {
  const [activeSection, setActiveSection] = useState<DoctorSectionKey>("workbench")
  const [caseMode, setCaseMode] = useState<CaseMode>("active")
  const consultation = session.activeConsultation

  function openCases(nextMode: CaseMode = "active") {
    setCaseMode(nextMode)
    setActiveSection("cases")
  }

  return (
    <div className="doctor-console grid min-h-[calc(100vh-9rem)] min-h-[calc(100svh-9rem)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="doctor-sidebar rounded-xl border bg-card p-3 shadow-sm lg:sticky lg:top-28 lg:h-[calc(100vh-8rem)] lg:h-[calc(100svh-8rem)] lg:overflow-y-auto">
        <nav className="flex flex-col gap-1">
          {doctorSections.map((section) => (
            <DoctorSidebarItem
              key={section.key}
              section={section}
              active={activeSection === section.key}
              onClick={() => setActiveSection(section.key)}
            />
          ))}
        </nav>
      </aside>

      <main className="doctor-main min-w-0">
        {activeSection === "workbench" && (
          <DoctorWorkbench
            session={session}
            onOpenCase={() => openCases("active")}
            onOpenMessages={() => setActiveSection("messages")}
            dispatch={dispatch}
          />
        )}
        {activeSection === "cases" && (
          <CasesPage
            session={session}
            dispatch={dispatch}
            caseMode={caseMode}
            onCaseModeChange={setCaseMode}
          />
        )}
        {activeSection === "messages" && (
          <MessagesPage
            notifications={session.notifications}
            consultation={consultation}
            onOpenCase={() => openCases("active")}
            onOpenPostCare={() => setActiveSection("postCare")}
          />
        )}
        {activeSection === "postCare" && (
          <PostCarePage onOpenCase={() => openCases("active")} />
        )}
        {activeSection === "settings" && <SettingsPage />}
      </main>
    </div>
  )
}

function DoctorSidebarItem({
  section,
  active,
  onClick,
}: {
  section: (typeof doctorSections)[number]
  active: boolean
  onClick: () => void
}) {
  const Icon = section.icon

  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-foreground hover:bg-muted",
      )}
      onClick={onClick}
      type="button"
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-primary-foreground/15" : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{section.title}</span>
      </span>
    </button>
  )
}

function DoctorWorkbench({
  session,
  onOpenCase,
  onOpenMessages,
  dispatch,
}: {
  session: DemoSession
  onOpenCase: () => void
  onOpenMessages: () => void
  dispatch: Dispatch<DemoAction>
}) {
  const consultation = session.activeConsultation
  const taskRecords = useMemo(() => getAdminCaseRecords(session), [session])
  const counts = useMemo(() => getWorkbenchCounts(taskRecords), [taskRecords])
  const doctorNotifications = session.notifications.filter((item) => item.audience === "doctor")
  const latestMessage = doctorNotifications.at(-1)

  function remindExpert(record: AdminCaseRecord) {
    dispatch({
      type: "admin.sendReminder",
      input: {
        targetRole: "expert",
        title: getExpertReminderTitle(record.consultation.status),
        detail: `医生工作台提醒：${record.consultation.patient.name}的会诊单${statusLabels[record.consultation.status]}，请专家及时处理。`,
      },
    })
  }

  return (
    <div className="doctor-page flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>待办概览</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="待提交草稿" value={counts.draft} icon={FileTextIcon} />
          <MetricCard title="待补资料" value={counts.supplement} icon={PaperclipIcon} tone="warning" />
          <MetricCard title="待外部会诊" value={counts.scheduled} icon={CalendarClockIcon} />
          <MetricCard title="待确认处置" value={counts.disposition} icon={ClipboardCheckIcon} tone="danger" />
          <MetricCard title="质控退回" value={counts.qualityReturn} icon={BellRingIcon} tone="warning" />
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle role="heading" aria-level={2}>今日待办队列</CardTitle>
              <Badge variant="secondary">{taskRecords.length} 项会诊事项</Badge>
            </div>
          </CardHeader>
          <CardContent
            className="flex flex-col gap-3"
            data-testid="doctor-workbench-task-queue"
          >
            {taskRecords.map((record) => (
              <DoctorWorkbenchTaskItem
                key={record.consultation.id}
                record={record}
                onOpenCase={onOpenCase}
                onRemindExpert={() => remindExpert(record)}
              />
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <ExternalScheduleReminder consultation={consultation} dispatch={dispatch} />
          <MessageTaskCard
            messageTitle={latestMessage?.title ?? statusLabels[consultation.status]}
            messageDetail={latestMessage?.detail ?? getStatusActionHint(consultation.status)}
            onOpenMessages={onOpenMessages}
          />
        </div>
      </section>
    </div>
  )
}

function DoctorWorkbenchTaskItem({
  record,
  onOpenCase,
  onRemindExpert,
}: {
  record: AdminCaseRecord
  onOpenCase: () => void
  onRemindExpert: () => void
}) {
  const consultation = record.consultation
  const canRemindExpert = canSendExpertReminder(consultation.status)

  return (
    <div
      className={cn(
        "doctor-list-item rounded-lg border p-3 transition",
        record.isLive ? "border-primary/30 bg-primary/5" : "bg-card hover:bg-muted/40",
      )}
      data-testid={getDoctorTaskTestId(record)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">
            {consultation.patient.name} · {consultation.department}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {consultation.id} · {record.currentOwner} · {record.waitTime}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={getDoctorStatusBadgeVariant(consultation.status)}>
            {statusLabels[consultation.status]}
          </Badge>
          {consultation.priority === "urgent" && <Badge variant="destructive">紧急</Badge>}
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {record.operationNeed}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Badge variant="outline">时效 {record.slaLabel}</Badge>
        {canRemindExpert ? (
          <Button size="sm" variant="outline" type="button" onClick={onRemindExpert}>
            <BellRingIcon data-icon="inline-start" />
            运营催办专家
          </Button>
        ) : (
          <Button
            size="sm"
            variant={record.isLive ? "default" : "outline"}
            type="button"
            onClick={onOpenCase}
          >
            <ClipboardListIcon data-icon="inline-start" />
            {record.isLive ? "进入会诊办理" : "查看事项"}
          </Button>
        )}
      </div>
    </div>
  )
}

function UpcomingExternalConsultationCard() {
  return (
    <div className="doctor-card-row rounded-lg border border-primary/20 bg-secondary/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarClockIcon className="size-4 text-primary" />
            即将进行
          </div>
          <div className="mt-2 font-medium">孙某某 · 呼吸内科</div>
          <div className="mt-1 text-sm text-muted-foreground">
            卢主任 · 今日 15:00 · 26 分钟后
          </div>
        </div>
        <Badge variant="secondary">外部系统</Badge>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <InfoBox label="会议号" value="QY-1500" />
        <InfoBox label="患者在场" value="由本地医生确认" />
      </div>
      <div className="mt-3 text-sm font-medium">会议号 QY-1500</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button variant="outline" type="button">
          <CopyIcon data-icon="inline-start" />
          复制会议号
        </Button>
        <Button variant="outline" type="button">
          <ExternalLinkIcon data-icon="inline-start" />
          打开外部会诊系统
        </Button>
      </div>
    </div>
  )
}

const weeklyExternalConsultations = [
  {
    time: "周四 09:30",
    patient: "沈某某",
    department: "骨科",
    expert: "陈医生",
    meetingCode: "QY-1507",
  },
  {
    time: "周五 19:30",
    patient: "李某某",
    department: "中医内科",
    expert: "陈医生",
    meetingCode: "QY-1512",
  },
]

function WeeklyExternalConsultationCalendar() {
  return (
    <div className="doctor-card-row rounded-lg border p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CalendarClockIcon className="size-4 text-primary" />
        本周会诊日历
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {weeklyExternalConsultations.map((item) => (
          <div
            key={item.meetingCode}
            className="doctor-card-row grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[88px_1fr_auto]"
          >
            <div className="text-sm font-medium">{item.time}</div>
            <div className="min-w-0 text-sm">
              <span className="font-medium">{item.patient} · {item.department}</span>
              <span className="ml-2 text-muted-foreground">{item.expert}</span>
            </div>
            <Badge variant="outline">{item.meetingCode}</Badge>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExternalScheduleReminder({
  consultation,
  dispatch,
}: {
  consultation: Consultation
  dispatch: Dispatch<DemoAction>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>外部会诊提醒</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {["scheduled", "in_consultation"].includes(consultation.status) ? (
          <ExternalConsultationPanel consultation={consultation} dispatch={dispatch} />
        ) : (
          <UpcomingExternalConsultationCard />
        )}
        <WeeklyExternalConsultationCalendar />
      </CardContent>
    </Card>
  )
}

function MessageTaskCard({
  messageTitle,
  messageDetail,
  onOpenMessages,
}: {
  messageTitle: string
  messageDetail: string
  onOpenMessages: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>消息任务</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="doctor-card-row rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MessageSquareTextIcon className="size-4 text-primary" />
            {messageTitle}
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {messageDetail}
          </p>
        </div>
        <Button variant="outline" onClick={onOpenMessages}>
          <BellRingIcon data-icon="inline-start" />
          查看消息任务
        </Button>
      </CardContent>
    </Card>
  )
}

function CasesPage({
  session,
  dispatch,
  caseMode,
  onCaseModeChange,
}: {
  session: DemoSession
  dispatch: Dispatch<DemoAction>
  caseMode: CaseMode
  onCaseModeChange: Dispatch<CaseMode>
}) {
  const [filter, setFilter] = useState<"all" | ConsultationStatus>("all")
  const records = useMemo(() => getAdminCaseRecords(session), [session])
  const [selectedCaseId, setSelectedCaseId] = useState(session.activeConsultation.id)
  const visibleRecords = records.filter(
    (record) => filter === "all" || filter === record.consultation.status,
  )
  const selectedRecord =
    records.find((record) => record.consultation.id === selectedCaseId) ?? records[0]

  function selectRecord(record: AdminCaseRecord) {
    setSelectedCaseId(record.consultation.id)
    onCaseModeChange("active")
  }

  return (
    <div className="doctor-page flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-xl font-semibold tracking-tight">会诊单管理</h2>
        <Button onClick={() => onCaseModeChange("new")}>
          <FilePlus2Icon data-icon="inline-start" />
          新建会诊单
        </Button>
      </div>

      <section className="doctor-split-layout grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>会诊队列</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3" data-testid="doctor-case-list">
            <div className="flex flex-wrap gap-2">
              {caseFilters.map((item) => (
                <Button
                  key={item.key}
                  size="sm"
                  variant={filter === item.key ? "default" : "outline"}
                  onClick={() => setFilter(item.key)}
                >
                  {item.label}
                </Button>
              ))}
            </div>

            {visibleRecords.map((record) => {
              const consultation = record.consultation
              const selected =
                caseMode === "active" && consultation.id === selectedRecord.consultation.id

              return (
                <button
                  key={consultation.id}
                  aria-label={`${consultation.patient.name} · ${consultation.department}`}
                  className={cn(
                    "doctor-list-item rounded-lg border p-3 text-left transition hover:bg-muted/60",
                    selected && "border-primary bg-primary/5",
                  )}
                  onClick={() => selectRecord(record)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {consultation.patient.name} · {consultation.department}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {consultation.id}
                      </div>
                    </div>
                    <StatusBadge status={consultation.status} />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {consultation.consultationPurpose}
                  </p>
                </button>
              )
            })}

            {caseMode === "new" && (
              <button
                className="doctor-list-item rounded-lg border border-primary bg-primary/5 p-3 text-left"
                type="button"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">新建中的草稿</span>
                  <Badge>编辑中</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  在右侧办理面板补齐患者信息和会诊诉求。
                </p>
              </button>
            )}
          </CardContent>
        </Card>

        <CaseHandlingPanel
          session={session}
          dispatch={dispatch}
          record={selectedRecord}
          mode={caseMode}
        />
      </section>
    </div>
  )
}

function CaseHandlingPanel({
  session,
  dispatch,
  record,
  mode,
}: {
  session: DemoSession
  dispatch: Dispatch<DemoAction>
  record: AdminCaseRecord
  mode: CaseMode
}) {
  const consultation = mode === "new" ? session.activeConsultation : record.consultation
  const isNewDraft = mode === "new"
  const isDraft = isNewDraft || consultation.status === "draft"
  const canEditApplication = isNewDraft || (record.isLive && consultation.status === "draft")
  const showDisposition = ["pending_doctor_confirm", "completed", "archived"].includes(
    consultation.status,
  )
  const formId = "doctor-consultation-application-form"

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle role="heading" aria-level={2}>
                {isNewDraft ? "新建草稿" : `${consultation.patient.name} 会诊办理`}
              </CardTitle>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={isNewDraft ? "draft" : consultation.status} />
                <Badge variant="outline">
                  {isNewDraft ? "待选择专家" : record.expertName}
                </Badge>
                <Badge variant={consultation.priority === "urgent" ? "destructive" : "secondary"}>
                  {consultation.priority === "urgent" ? "紧急" : "普通"}
                </Badge>
              </div>
            </div>
            <div className="doctor-card-row rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {isNewDraft ? "填写后提交专家预审" : getStatusActionHint(consultation.status)}
            </div>
          </div>
        </CardHeader>
      </Card>

      <ApplicationSection
        consultation={consultation}
        experts={session.experts}
        dispatch={dispatch}
        canEdit={canEditApplication}
        formId={formId}
      />
      <MaterialsSection
        consultation={consultation}
        dispatch={dispatch}
        canUpload={isDraft || consultation.status === "needs_more_info"}
      />
      <ExpertCoordinationSection
        consultation={consultation}
        dispatch={dispatch}
        experts={session.experts}
        isDraft={isDraft}
      />
      {showDisposition && <DispositionSection consultation={consultation} dispatch={dispatch} />}
      <TimelineSection consultation={consultation} />
      {canEditApplication && (
        <Card data-testid="case-action-footer">
          <CardContent className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline">
              <FileTextIcon data-icon="inline-start" />
              保存草稿
            </Button>
            <Button type="submit" form={formId}>
              <FilePlus2Icon data-icon="inline-start" />
              提交专家预审
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ApplicationSection({
  consultation,
  experts,
  dispatch,
  canEdit,
  formId,
}: {
  consultation: Consultation
  experts: DemoSession["experts"]
  dispatch: Dispatch<DemoAction>
  canEdit: boolean
  formId: string
}) {
  const [form, setForm] = useState<ConsultationFormState>(() =>
    toConsultationFormState(consultation, experts[0]?.id ?? ""),
  )

  useEffect(() => {
    setForm(toConsultationFormState(consultation, experts[0]?.id ?? ""))
  }, [consultation, experts])

  function updateForm<K extends keyof ConsultationFormState>(
    key: K,
    value: ConsultationFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canEdit) return

    dispatch({
      type: "doctor.submitConsultation",
      input: {
        patient: {
          ...consultation.patient,
          name: form.patientName,
          gender: form.patientGender,
          age: Number.parseInt(form.patientAge, 10) || consultation.patient.age,
          phoneMasked: form.patientPhoneMasked,
          idNoMasked: form.patientIdNoMasked,
          allergyHistory: form.allergyHistory,
          pastHistory: form.pastHistory,
        },
        department: form.department,
        chiefComplaint: form.chiefComplaint,
        consultationPurpose: form.consultationPurpose,
        priority: form.priority,
        expertId: form.expertId,
      },
    })
  }

  return (
    <Card data-testid="application-section">
      <CardHeader>
        <CardTitle>申请信息</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" id={formId} onSubmit={handleSubmit}>
          <FieldGroup className="grid gap-4 lg:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="patientName">患者姓名</FieldLabel>
              <Input
                id="patientName"
                value={form.patientName}
                disabled={!canEdit}
                onChange={(event) => updateForm("patientName", event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>性别</FieldLabel>
              <Select
                value={form.patientGender}
                disabled={!canEdit}
                onValueChange={(value) =>
                  updateForm("patientGender", value as ConsultationFormState["patientGender"])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="男">男</SelectItem>
                  <SelectItem value="女">女</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="patientAge">年龄</FieldLabel>
              <Input
                id="patientAge"
                inputMode="numeric"
                value={form.patientAge}
                disabled={!canEdit}
                onChange={(event) => updateForm("patientAge", event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="patientPhone">联系电话</FieldLabel>
              <Input
                id="patientPhone"
                value={form.patientPhoneMasked}
                disabled={!canEdit}
                onChange={(event) =>
                  updateForm("patientPhoneMasked", event.target.value)
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="patientIdNo">身份证号</FieldLabel>
              <Input
                id="patientIdNo"
                value={form.patientIdNoMasked}
                disabled={!canEdit}
                onChange={(event) =>
                  updateForm("patientIdNoMasked", event.target.value)
                }
              />
            </Field>
            <Field>
              <FieldLabel>优先级</FieldLabel>
              <Select
                value={form.priority}
                disabled={!canEdit}
                onValueChange={(value) =>
                  updateForm("priority", value as ConsultationFormState["priority"])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">普通</SelectItem>
                  <SelectItem value="urgent">紧急</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="department">申请科室</FieldLabel>
              <Input
                id="department"
                value={form.department}
                disabled={!canEdit}
                onChange={(event) => updateForm("department", event.target.value)}
              />
            </Field>
            <Field className="lg:col-span-2">
              <FieldLabel>拟邀专家</FieldLabel>
              <Select
                value={form.expertId}
                disabled={!canEdit}
                onValueChange={(value) => updateForm("expertId", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {experts.map((expert) => (
                    <SelectItem key={expert.id} value={expert.id}>
                      {expert.name} · {expert.department} · {expert.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="lg:col-span-3">
              <FieldLabel htmlFor="chiefComplaint">主诉</FieldLabel>
              <Textarea
                id="chiefComplaint"
                value={form.chiefComplaint}
                disabled={!canEdit}
                onChange={(event) => updateForm("chiefComplaint", event.target.value)}
              />
            </Field>
            <Field className="lg:col-span-3">
              <FieldLabel htmlFor="purpose">会诊目的</FieldLabel>
              <Textarea
                id="purpose"
                value={form.consultationPurpose}
                disabled={!canEdit}
                onChange={(event) =>
                  updateForm("consultationPurpose", event.target.value)
                }
              />
            </Field>
            <Field className="lg:col-span-3">
              <FieldLabel htmlFor="pastHistory">既往史</FieldLabel>
              <Textarea
                id="pastHistory"
                value={form.pastHistory}
                disabled={!canEdit}
                onChange={(event) => updateForm("pastHistory", event.target.value)}
              />
            </Field>
            <Field className="lg:col-span-3">
              <FieldLabel htmlFor="allergyHistory">过敏史</FieldLabel>
              <Input
                id="allergyHistory"
                value={form.allergyHistory}
                disabled={!canEdit}
                onChange={(event) => updateForm("allergyHistory", event.target.value)}
              />
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function MaterialsSection({
  consultation,
  dispatch,
  canUpload,
}: {
  consultation: Consultation
  dispatch: Dispatch<DemoAction>
  canUpload: boolean
}) {
  const uploadLabel =
    consultation.status === "needs_more_info" ? "上传补充资料" : "上传病例资料"

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>病例资料</CardTitle>
          {canUpload && (
            <Button size="sm" variant="outline" type="button">
              <UploadIcon data-icon="inline-start" />
              {uploadLabel}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-3 md:grid-cols-2">
          {consultation.attachments.map((attachment) => (
            <div key={attachment.id} className="doctor-card-row rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <PaperclipIcon className="size-4 text-primary" />
                <span className="min-w-0 truncate text-sm font-medium">{attachment.name}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">{attachmentTypeLabels[attachment.type]}</Badge>
                <Badge variant="secondary">{attachment.uploadedAt}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {attachment.description}
              </p>
            </div>
          ))}
        </div>
        {consultation.status === "needs_more_info" && (
          <SupplementMaterialsForm consultation={consultation} dispatch={dispatch} />
        )}
        {consultation.status !== "needs_more_info" && (
          <div className="doctor-card-row rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            当前资料已随会诊单流转，如专家或运营退回补充，补充入口将在此处显示。
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ExpertCoordinationSection({
  consultation,
  dispatch,
  experts,
  isDraft,
}: {
  consultation: Consultation
  dispatch: Dispatch<DemoAction>
  experts: DemoSession["experts"]
  isDraft: boolean
}) {
  if (isDraft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>专家协同</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-3">
            <InfoBox label="当前状态" value="草稿待提交" />
            <InfoBox label="拟邀专家" value="提交前可调整" />
            <InfoBox label="接单状态" value="提交后由专家预审" />
          </div>
          <Button className="w-fit" variant="outline" type="button">
            <CalendarClockIcon data-icon="inline-start" />
            查阅专家可预约时间
          </Button>
          <div className="grid gap-3 md:grid-cols-2">
            {experts.map((expert) => (
              <div key={expert.id} className="doctor-card-row rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {expert.name} · {expert.department}
                  </div>
                  <Badge variant={expert.status === "available" ? "default" : "secondary"}>
                    {expert.status === "available" ? "可预约" : "忙碌"}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {expert.slots.map((slot) => (
                    <Badge key={slot} variant="outline">
                      {slot}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasExternalMeeting = [
    "scheduled",
    "in_consultation",
    "pending_advice",
    "pending_doctor_confirm",
    "completed",
    "archived",
  ].includes(consultation.status)

  return (
    <Card>
      <CardHeader>
        <CardTitle>专家协同</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-3 md:grid-cols-3">
          <InfoBox label="当前状态" value={statusLabels[consultation.status]} />
          <InfoBox label="预约时间" value={consultation.scheduledAt ?? "待专家确认"} />
          {hasExternalMeeting && (
            <InfoBox label="外部会议号" value={getMeetingCode(consultation)} />
          )}
        </div>
        {["scheduled", "in_consultation"].includes(consultation.status) ? (
          <ExternalConsultationPanel consultation={consultation} dispatch={dispatch} />
        ) : (
          <div className="doctor-card-row rounded-lg border bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">
            {getStatusActionHint(consultation.status)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ExternalConsultationPanel({
  consultation,
  dispatch,
}: {
  consultation: Consultation
  dispatch: Dispatch<DemoAction>
}) {
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle>外部会诊执行</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="doctor-card-row rounded-lg border bg-secondary/60 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MonitorUpIcon className="size-4 text-primary" />
            外部系统入口
          </div>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            <InfoBox label="会议号" value={getMeetingCode(consultation)} />
            <InfoBox label="预约时间" value={consultation.scheduledAt ?? "待确认"} />
            <InfoBox label="患者在场" value="由本地医生确认" />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="outline" type="button">
            <CopyIcon data-icon="inline-start" />
            复制会议号
          </Button>
          <Button variant="outline" type="button">
            <ExternalLinkIcon data-icon="inline-start" />
            打开外部会诊系统
          </Button>
          <Button
            type="button"
            onClick={() =>
              dispatch({ type: "doctor.completeExternalConsultation" })
            }
          >
            <CheckCircle2Icon data-icon="inline-start" />
            标记已完成沟通
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DispositionSection({
  consultation,
  dispatch,
}: {
  consultation: Consultation
  dispatch: Dispatch<DemoAction>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>处置记录</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <AdvicePanel consultation={consultation} showDescription={false} />
        {consultation.status === "pending_doctor_confirm" && (
          <DispositionForm dispatch={dispatch} />
        )}
        {consultation.localDisposition && (
          <div className="doctor-card-row rounded-lg border bg-muted/40 p-3">
            <div className="text-sm font-medium">本地处置已确认</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {consultation.localDisposition.note}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TimelineSection({ consultation }: { consultation: Consultation }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>流程留痕</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {consultation.timeline.map((item) => (
          <div key={item.id} className="grid grid-cols-[auto_1fr] gap-3">
            <div className="mt-1 flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <HistoryIcon className="size-3.5" />
            </div>
            <div className="doctor-card-row min-w-0 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{item.label}</span>
                <Badge variant="secondary">{statusLabels[item.status]}</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{item.at}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function SupplementMaterialsForm({
  consultation,
  dispatch,
}: {
  consultation: Consultation
  dispatch: Dispatch<DemoAction>
}) {
  const requiredTypes =
    consultation.requiredAttachmentTypes.length > 0
      ? consultation.requiredAttachmentTypes
      : (["other"] satisfies AttachmentType[])
  const [note, setNote] = useState("已按专家要求补充资料，请复核。")

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    dispatch({
      type: "doctor.addSupplement",
      input: {
        note,
        attachments: requiredTypes.map((type) => ({
          type,
          name: defaultAttachmentNames[type],
          description: `${attachmentTypeLabels[type]}已补充，供专家预审。`,
        })),
      },
    })
  }

  return (
    <form className="doctor-card-row flex flex-col gap-3 rounded-lg border border-primary/20 p-3" onSubmit={handleSubmit}>
      <div className="text-sm font-medium">专家要求补充</div>
      <div className="flex flex-wrap gap-2">
        {requiredTypes.map((type) => (
          <Badge key={type} variant="secondary">
            {attachmentTypeLabels[type]}
          </Badge>
        ))}
      </div>
      <Field>
        <FieldLabel htmlFor="supplementNote">补充说明</FieldLabel>
        <Textarea
          id="supplementNote"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      <Button type="submit">
        <UploadIcon data-icon="inline-start" />
        确认补充资料
      </Button>
    </form>
  )
}

function DispositionForm({ dispatch }: { dispatch: Dispatch<DemoAction> }) {
  const [adopted, setAdopted] = useState<"yes" | "partial" | "no">("partial")
  const [note, setNote] = useState(
    "采纳检查和风险提示建议，处方由本地医生结合患者现场情况开具。",
  )

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    dispatch({
      type: "doctor.confirmDisposition",
      input: {
        adopted,
        note,
      },
    })
  }

  return (
    <form className="doctor-card-row flex flex-col gap-3 rounded-lg border border-primary/20 p-3" onSubmit={handleSubmit}>
      <Field>
        <FieldLabel>采纳情况</FieldLabel>
        <Select
          value={adopted}
          onValueChange={(value) => setAdopted(value as "yes" | "partial" | "no")}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">全部采纳</SelectItem>
            <SelectItem value="partial">部分采纳</SelectItem>
            <SelectItem value="no">未采纳</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor="dispositionNote">本地处置记录</FieldLabel>
        <Textarea
          id="dispositionNote"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      <Button type="submit">
        <CheckCircle2Icon data-icon="inline-start" />
        确认本地处置
      </Button>
    </form>
  )
}

function MessagesPage({
  notifications,
  consultation,
  onOpenCase,
  onOpenPostCare,
}: {
  notifications: DemoNotification[]
  consultation: Consultation
  onOpenCase: () => void
  onOpenPostCare: () => void
}) {
  const [filter, setFilter] = useState<DoctorMessageFilter>("all")
  const records = useMemo(
    () => createDoctorMessages(consultation, notifications),
    [consultation, notifications],
  )
  const visibleMessages = records.filter((message) => {
    if (filter === "all") return true
    if (filter === "unread") return message.unread
    if (filter === "pending") return message.pending
    return message.category === filter
  })
  const [selectedMessageId, setSelectedMessageId] = useState(records[0]?.id ?? "")
  const selectedMessage =
    records.find((message) => message.id === selectedMessageId) ?? records[0]

  useEffect(() => {
    if (!records.some((message) => message.id === selectedMessageId)) {
      setSelectedMessageId(records[0]?.id ?? "")
    }
  }, [records, selectedMessageId])

  function runMessageAction(action: DoctorMessageRecord["actions"][number]) {
    if (action === "case" || action === "supplement" || action === "external") {
      onOpenCase()
      return
    }
    if (action === "postCare") {
      onOpenPostCare()
    }
  }

  if (!selectedMessage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>消息中心</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="doctor-card-row rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            暂无医生侧协同消息。
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="doctor-page flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-xl font-semibold tracking-tight">消息中心</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" type="button">
            <CheckCircle2Icon data-icon="inline-start" />
            全部已读
          </Button>
          <Button variant="outline" type="button">
            <FileTextIcon data-icon="inline-start" />
            归档已处理
          </Button>
        </div>
      </div>

      <section className="doctor-split-layout grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle>消息列表</CardTitle>
              <Badge variant="secondary">{visibleMessages.length} 条</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {doctorMessageFilters.map((item) => (
                <Button
                  key={item.key}
                  size="sm"
                  variant={filter === item.key ? "default" : "outline"}
                  onClick={() => setFilter(item.key)}
                  type="button"
                >
                  {item.label}
                </Button>
              ))}
            </div>

            {visibleMessages.map((message) => (
              <button
                key={message.id}
                className={cn(
                  "doctor-list-item rounded-lg border p-3 text-left transition hover:bg-muted/60",
                  selectedMessage.id === message.id && "border-primary bg-primary/5",
                )}
                onClick={() => setSelectedMessageId(message.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {message.unread && <span className="size-2 rounded-full bg-primary" />}
                      <span className="truncate text-sm font-medium">{message.title}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {message.patient} · {message.time}
                    </div>
                  </div>
                  <Badge variant={message.priority === "紧急" ? "destructive" : "secondary"}>
                    {message.priority}
                  </Badge>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {message.detail}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle role="heading" aria-level={2}>消息详情</CardTitle>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {doctorMessageCategoryLabels[selectedMessage.category]}
                  </Badge>
                  <Badge variant={selectedMessage.pending ? "destructive" : "secondary"}>
                    {selectedMessage.pending ? "待处理" : "已同步"}
                  </Badge>
                </div>
              </div>
              <Badge variant={selectedMessage.unread ? "default" : "secondary"}>
                {selectedMessage.unread ? "未读" : "已读"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <div className="text-base font-semibold">{selectedMessage.title}</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {selectedMessage.detail}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <InfoBox label="关联会诊单" value={selectedMessage.relatedCase} />
              <InfoBox label="消息来源" value={selectedMessage.source} />
              <InfoBox label="患者" value={selectedMessage.patient} />
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedMessage.actions.map((action) => (
                <Button
                  key={action}
                  variant={getDoctorMessageActionVariant(action, selectedMessage.actions[0])}
                  onClick={() => runMessageAction(action)}
                  type="button"
                >
                  {getDoctorMessageActionIcon(action)}
                  {getDoctorMessageActionLabel(action)}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function createDoctorMessages(
  consultation: Consultation,
  notifications: DemoNotification[],
): DoctorMessageRecord[] {
  const notificationMessages: DoctorMessageRecord[] = notifications
    .filter((notification) => notification.audience === "doctor")
    .map((notification) => ({
      id: notification.id,
      title: notification.title,
      detail: notification.detail,
      source: "协同通知",
      relatedCase: consultation.id,
      patient: consultation.patient.name,
      time: "今日",
      priority: "重要",
      category: "coordination",
      unread: true,
      pending: true,
      actions: ["case", "readLater", "archive"],
    }))

  return [
    {
      id: "doctor-message-supplement",
      title: "专家要求补充资料",
      detail: "专家侧提出补充近期用药清单和心电图，请补齐后重新提交预审。",
      source: "专家端",
      relatedCase: "consult-20260712-005",
      patient: "周某某",
      time: "09:12",
      priority: "紧急",
      category: "consultation",
      unread: true,
      pending: true,
      actions: ["supplement", "case", "postCare", "readLater", "archive"],
    },
    {
      id: "doctor-message-advice",
      title: "专家建议已提交",
      detail: "陈某某会诊已完成专家结构化建议，请本地医生确认处置。",
      source: "专家端",
      relatedCase: "consult-20260712-003",
      patient: "陈某某",
      time: "10:18",
      priority: "重要",
      category: "consultation",
      unread: true,
      pending: true,
      actions: ["case", "postCare", "archive"],
    },
    {
      id: "doctor-message-external",
      title: "外部会诊即将开始",
      detail: "孙某某呼吸内科会诊将在今日 15:00 开始，请提前确认患者在场和会议号。",
      source: "外部会诊系统",
      relatedCase: "consult-20260712-004",
      patient: "孙某某",
      time: "14:30",
      priority: "重要",
      category: "coordination",
      unread: false,
      pending: true,
      actions: ["external", "case", "readLater"],
    },
    {
      id: "doctor-message-post-care",
      title: "诊后随访到期",
      detail: "韩某某需要完成首次诊后随访，记录症状变化和用药依从性。",
      source: "诊后管理",
      relatedCase: "consult-20260712-002",
      patient: "韩某某",
      time: "今日 17:30",
      priority: "普通",
      category: "postCare",
      unread: false,
      pending: true,
      actions: ["postCare", "archive"],
    },
    {
      id: "doctor-message-system",
      title: "提醒设置已同步",
      detail: "会诊前提醒、专家建议提醒和诊后随访提醒已按医生端设置生效。",
      source: "系统消息",
      relatedCase: "无",
      patient: "无",
      time: "昨日",
      priority: "普通",
      category: "system",
      unread: false,
      pending: false,
      actions: ["archive"],
    },
    ...notificationMessages,
  ]
}

function getDoctorMessageActionLabel(action: DoctorMessageRecord["actions"][number]) {
  const labels: Record<DoctorMessageRecord["actions"][number], string> = {
    supplement: "去补充资料",
    case: "进入会诊办理",
    postCare: "进入诊后管理",
    external: "打开外部会诊系统",
    readLater: "稍后提醒",
    archive: "归档",
  }

  return labels[action]
}

function getDoctorMessageActionIcon(action: DoctorMessageRecord["actions"][number]) {
  if (action === "supplement") return <UploadIcon data-icon="inline-start" />
  if (action === "case") return <ClipboardListIcon data-icon="inline-start" />
  if (action === "postCare") return <FileCheck2Icon data-icon="inline-start" />
  if (action === "external") return <ExternalLinkIcon data-icon="inline-start" />
  if (action === "readLater") return <BellRingIcon data-icon="inline-start" />
  return <FileTextIcon data-icon="inline-start" />
}

function getDoctorMessageActionVariant(
  action: DoctorMessageRecord["actions"][number],
  primaryAction: DoctorMessageRecord["actions"][number],
) {
  if (action === primaryAction && action !== "readLater" && action !== "archive") {
    return "default"
  }

  return "outline"
}

function PostCarePage({ onOpenCase }: { onOpenCase: () => void }) {
  const [selectedRecordId, setSelectedRecordId] = useState(postCareRecords[0]?.id ?? "")
  const selectedRecord =
    postCareRecords.find((record) => record.id === selectedRecordId) ?? postCareRecords[0]

  return (
    <div className="doctor-page flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-xl font-semibold tracking-tight">诊后管理</h2>
        <Button variant="outline" onClick={onOpenCase}>
          <ClipboardListIcon data-icon="inline-start" />
          回到会诊单
        </Button>
      </div>

      <section className="doctor-split-layout grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle>诊后队列</CardTitle>
              <Badge variant="secondary">{postCareRecords.length} 位患者</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(postCareStatusLabels).map(([status, label]) => (
                <Badge key={status} variant="outline">
                  {label}
                </Badge>
              ))}
            </div>
            {postCareRecords.map((record) => (
              <button
                key={record.id}
                aria-label={`${record.patientName} · ${postCareStatusLabels[record.status]}`}
                className={cn(
                  "doctor-list-item rounded-lg border p-3 text-left transition hover:bg-muted/60",
                  selectedRecord.id === record.id && "border-primary bg-primary/5",
                )}
                onClick={() => setSelectedRecordId(record.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {record.patientName} · {record.department}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {record.sourceCaseId} · {record.nextActionAt}
                    </div>
                  </div>
                  <PostCareStatusBadge status={record.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant={record.riskLevel === "高风险" ? "destructive" : "secondary"}>
                    {record.riskLevel}
                  </Badge>
                  <Badge variant="outline">{record.expertName}</Badge>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <PostCareDetail record={selectedRecord} />
      </section>
    </div>
  )
}

function PostCareDetail({ record }: { record: PostCareRecord }) {
  const showCurrentFollowup = ["plan", "followup", "cycle"].includes(record.status)
  const actions = getPostCareActions(record.status)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle role="heading" aria-level={2}>
                {record.patientName} 诊后办理
              </CardTitle>
              <div className="mt-2 flex flex-wrap gap-2">
                <PostCareStatusBadge status={record.status} />
                <Badge variant={record.riskLevel === "高风险" ? "destructive" : "secondary"}>
                  {record.riskLevel}
                </Badge>
                <Badge variant="outline">{record.expertName}</Badge>
              </div>
            </div>
            <div className="doctor-card-row rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              下次动作：{record.nextActionAt}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>专家建议引用</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <InfoBox label="随访建议" value={record.advice.followUp} />
          <InfoBox label="转诊建议" value={record.advice.referral} />
          <InfoBox label="风险提示" value={record.advice.riskNotice} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>诊后计划</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <InfoBox label="本地处置" value={record.plan.disposition} />
          <InfoBox label="复查安排" value={record.plan.review} />
          <InfoBox label="用药观察" value={record.plan.medication} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>随访计划</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <InfoBox label="随访周期" value={record.followUpPlan.cycle} />
          <InfoBox
            label="随访进度"
            value={`${record.followUpPlan.currentTimes}/${record.followUpPlan.totalTimes}`}
          />
          <InfoBox label="下次随访" value={record.followUpPlan.nextDueAt} />
          <InfoBox label="随访方式" value={record.followUpPlan.method} />
          <div className="doctor-info-box rounded-lg border p-3 md:col-span-2">
            <div className="text-xs text-muted-foreground">结束条件</div>
            <div className="mt-1 text-sm leading-6">{record.followUpPlan.endCondition}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>随访日程</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {record.schedule.map((item) => (
            <div
              key={item.id}
              className="doctor-card-row grid gap-3 rounded-lg border p-3 md:grid-cols-[96px_1fr_auto]"
            >
              <div className="text-sm font-medium">{item.sequence}</div>
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2 text-sm">
                  <span>{item.dueAt}</span>
                  <span className="text-muted-foreground">{item.method}</span>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {item.result}
                </p>
              </div>
              <Badge variant={getPostCareScheduleBadgeVariant(item.status)}>
                {item.status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {showCurrentFollowup && (
        <Card>
          <CardHeader>
            <CardTitle>本次随访办理</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {record.followUps.map((followUp) => (
              <div key={followUp.id} className="doctor-card-row rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">{followUp.method}</div>
                  <Badge variant="secondary">{followUp.at}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {followUp.result}
                </p>
              </div>
            ))}
            <Field>
              <FieldLabel htmlFor="postCareFollowupNote">本次随访记录</FieldLabel>
              <Textarea
                id="postCareFollowupNote"
                defaultValue="记录患者症状变化、用药依从性、复查结果和异常风险。"
              />
            </Field>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>转诊跟踪</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <InfoBox label="目标机构" value={record.referral.target} />
          <InfoBox label="转诊原因" value={record.referral.reason} />
          <InfoBox label="当前状态" value={record.referral.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>闭环确认</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="doctor-card-row rounded-lg border bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">
            {record.closure}
          </div>
          <Field>
            <FieldLabel htmlFor="postCareClosureNote">闭环说明</FieldLabel>
            <Textarea
              id="postCareClosureNote"
              defaultValue="确认专家建议采纳情况、随访结果、转诊结果和后续风险说明。"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap justify-end gap-2">
          {actions.map((action, index) => (
            <Button
              key={action}
              type="button"
              variant={getPostCareActionVariant(action, index)}
            >
              <PostCareActionIcon action={action} />
              {action}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function getPostCareActions(status: PostCareStatus) {
  const actions: Record<PostCareStatus, string[]> = {
    plan: ["保存计划", "启动随访"],
    followup: ["保存记录", "完成并生成下次", "改期随访", "无法联系", "转入转诊"],
    cycle: ["提前随访", "调整计划", "暂停随访", "结束计划"],
    referral: ["登记转诊", "确认患者同意", "确认到院"],
    transferTracking: ["补充检查结果", "转回本地随访", "进入闭环确认"],
    closure: ["确认闭环", "继续随访"],
    closed: ["查看会诊单", "查看诊后记录"],
  }

  return actions[status]
}

function getPostCareActionVariant(action: string, index: number): "default" | "outline" {
  if (["启动随访", "完成并生成下次", "确认到院", "进入闭环确认", "确认闭环"].includes(action)) {
    return "default"
  }

  if (index === 0 && action.startsWith("查看")) return "default"

  return "outline"
}

function PostCareActionIcon({ action }: { action: string }) {
  if (action.includes("转诊") || action.includes("到院")) {
    return <ExternalLinkIcon data-icon="inline-start" />
  }

  if (action.includes("闭环") || action.includes("完成") || action.includes("启动")) {
    return <CheckCircle2Icon data-icon="inline-start" />
  }

  if (action.includes("改期") || action.includes("提前") || action.includes("调整")) {
    return <CalendarClockIcon data-icon="inline-start" />
  }

  return <FileTextIcon data-icon="inline-start" />
}

function getPostCareScheduleBadgeVariant(
  status: PostCareRecord["schedule"][number]["status"],
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "已完成") return "default"
  if (status === "逾期") return "destructive"
  if (status === "待随访") return "secondary"

  return "outline"
}

function PostCareStatusBadge({ status }: { status: PostCareStatus }) {
  const variant =
    status === "closed"
      ? "default"
      : status === "referral" || status === "transferTracking"
        ? "destructive"
        : "secondary"

  return <Badge variant={variant}>{postCareStatusLabels[status]}</Badge>
}

function SettingsPage() {
  const [editingProfile, setEditingProfile] = useState(false)
  const [editingConsultationSettings, setEditingConsultationSettings] = useState(false)
  const [editingReminder, setEditingReminder] = useState(false)
  const [profile, setProfile] = useState({
    name: "王医生",
    title: "主治医师",
    org: "蒙城县中医院",
    department: "全科门诊",
    phone: "139****2026",
  })
  const [consultationSettings, setConsultationSettings] = useState({
    defaultDepartment: "全科门诊",
    collaborationMode: "外部系统远程会诊",
    materialTypes: "检验报告、影像、心电图、用药清单",
    frequentExperts: [
      {
        id: "expert-lu",
        name: "卢主任",
        department: "心血管内科",
        org: "安徽省中医院",
      },
      {
        id: "expert-chen",
        name: "陈教授",
        department: "内分泌科",
        org: "蚌埠医科大学第一附属医院",
      },
      {
        id: "expert-zhou",
        name: "周主任",
        department: "神经内科",
        org: "蒙城县医共体专家库",
      },
    ],
  })
  const [reminder, setReminder] = useState({
    consultationAhead: "15 分钟前",
    supplement: "开启",
    advice: "开启",
    postCare: "当天 09:00",
  })
  const [templates, setTemplates] = useState([
    {
      id: "case-template",
      title: "胸痛会诊申请模板",
      content: "主诉、现病史、心电图、心肌酶谱和既往用药需完整填写。",
      enabled: true,
      editing: false,
    },
    {
      id: "supplement-template",
      title: "补充资料说明模板",
      content: "已按专家要求补充资料，请复核是否满足预审要求。",
      enabled: true,
      editing: false,
    },
    {
      id: "post-care-template",
      title: "诊后随访记录模板",
      content: "记录症状变化、用药依从性、复查结果、转诊情况和风险提示。",
      enabled: true,
      editing: false,
    },
  ])

  function updateProfile(key: keyof typeof profile, value: string) {
    setProfile((current) => ({ ...current, [key]: value }))
  }

  function updateConsultationSettings(
    key: "defaultDepartment" | "collaborationMode" | "materialTypes",
    value: string,
  ) {
    setConsultationSettings((current) => ({ ...current, [key]: value }))
  }

  function updateFrequentExpert(
    expertId: string,
    key: "name" | "department" | "org",
    value: string,
  ) {
    setConsultationSettings((current) => ({
      ...current,
      frequentExperts: current.frequentExperts.map((expert) =>
        expert.id === expertId ? { ...expert, [key]: value } : expert,
      ),
    }))
  }

  function addFrequentExpert() {
    setConsultationSettings((current) => ({
      ...current,
      frequentExperts: [
        ...current.frequentExperts,
        {
          id: `expert-${Date.now()}`,
          name: "待填写专家",
          department: "待填写专科",
          org: "协作医院",
        },
      ],
    }))
  }

  function removeFrequentExpert(expertId: string) {
    setConsultationSettings((current) => ({
      ...current,
      frequentExperts: current.frequentExperts.filter((expert) => expert.id !== expertId),
    }))
  }

  function updateReminder(key: keyof typeof reminder, value: string) {
    setReminder((current) => ({ ...current, [key]: value }))
  }

  function addTemplate() {
    setTemplates((current) => [
      ...current,
      {
        id: `template-${Date.now()}`,
        title: "新模板",
        content: "填写常用文本内容。",
        enabled: true,
        editing: true,
      },
    ])
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
    <div className="doctor-page flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">我的设置</h2>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>医生资料</CardTitle>
            <Button
              variant={editingProfile ? "default" : "outline"}
              onClick={() => setEditingProfile((current) => !current)}
              type="button"
            >
              <Settings2Icon data-icon="inline-start" />
              {editingProfile ? "保存资料" : "编辑资料"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {editingProfile ? (
            <>
              <Field>
                <FieldLabel htmlFor="doctorProfileName">医生姓名</FieldLabel>
                <Input
                  id="doctorProfileName"
                  value={profile.name}
                  onChange={(event) => updateProfile("name", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="doctorProfilePhone">联系电话</FieldLabel>
                <Input
                  id="doctorProfilePhone"
                  value={profile.phone}
                  onChange={(event) => updateProfile("phone", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="doctorProfileDepartment">科室</FieldLabel>
                <Input
                  id="doctorProfileDepartment"
                  value={profile.department}
                  onChange={(event) => updateProfile("department", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="doctorProfileTitle">职称</FieldLabel>
                <Input
                  id="doctorProfileTitle"
                  value={profile.title}
                  onChange={(event) => updateProfile("title", event.target.value)}
                />
              </Field>
            </>
          ) : (
            <>
              <InfoBox label="医生" value={`${profile.name} · ${profile.title}`} />
              <InfoBox label="机构" value={profile.org} />
              <InfoBox label="科室" value={profile.department} />
              <InfoBox label="联系电话" value={profile.phone} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>会诊设置</CardTitle>
            <Button
              variant={editingConsultationSettings ? "default" : "outline"}
              onClick={() => setEditingConsultationSettings((current) => !current)}
              type="button"
            >
              <Settings2Icon data-icon="inline-start" />
              {editingConsultationSettings ? "保存会诊设置" : "编辑会诊设置"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {editingConsultationSettings ? (
            <>
              <Field>
                <FieldLabel htmlFor="defaultDepartment">默认申请科室</FieldLabel>
                <Input
                  id="defaultDepartment"
                  value={consultationSettings.defaultDepartment}
                  onChange={(event) =>
                    updateConsultationSettings("defaultDepartment", event.target.value)
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="collaborationMode">默认协同方式</FieldLabel>
                <Input
                  id="collaborationMode"
                  value={consultationSettings.collaborationMode}
                  onChange={(event) =>
                    updateConsultationSettings("collaborationMode", event.target.value)
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="materialTypes">常用资料类型</FieldLabel>
                <Input
                  id="materialTypes"
                  value={consultationSettings.materialTypes}
                  onChange={(event) => updateConsultationSettings("materialTypes", event.target.value)}
                />
              </Field>
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel>常用拟邀专家</FieldLabel>
                  <Button variant="outline" size="sm" type="button" onClick={addFrequentExpert}>
                    <FilePlus2Icon data-icon="inline-start" />
                    新增常用专家
                  </Button>
                </div>
                <ul aria-label="常用拟邀专家列表" className="grid gap-2">
                  {consultationSettings.frequentExperts.map((expert) => (
                    <li key={expert.id} className="doctor-card-row rounded-lg border bg-muted/20 p-3">
                      <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                        <Field>
                          <FieldLabel htmlFor={`frequentExpertName-${expert.id}`}>
                            专家姓名
                          </FieldLabel>
                          <Input
                            id={`frequentExpertName-${expert.id}`}
                            value={expert.name}
                            onChange={(event) =>
                              updateFrequentExpert(expert.id, "name", event.target.value)
                            }
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={`frequentExpertDepartment-${expert.id}`}>
                            专家专科
                          </FieldLabel>
                          <Input
                            id={`frequentExpertDepartment-${expert.id}`}
                            value={expert.department}
                            onChange={(event) =>
                              updateFrequentExpert(expert.id, "department", event.target.value)
                            }
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={`frequentExpertOrg-${expert.id}`}>
                            所属机构
                          </FieldLabel>
                          <Input
                            id={`frequentExpertOrg-${expert.id}`}
                            value={expert.org}
                            onChange={(event) =>
                              updateFrequentExpert(expert.id, "org", event.target.value)
                            }
                          />
                        </Field>
                        <Button
                          variant="destructive"
                          size="sm"
                          type="button"
                          onClick={() => removeFrequentExpert(expert.id)}
                        >
                          <Trash2Icon data-icon="inline-start" />
                          移除专家
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <>
              <InfoBox label="默认申请科室" value={consultationSettings.defaultDepartment} />
              <InfoBox label="默认协同方式" value={consultationSettings.collaborationMode} />
              <InfoBox label="常用资料类型" value={consultationSettings.materialTypes} />
              <div className="space-y-2 md:col-span-2">
                <div className="text-sm font-medium">常用拟邀专家</div>
                <ul aria-label="常用拟邀专家列表" className="grid gap-2 md:grid-cols-3">
                  {consultationSettings.frequentExperts.map((expert) => (
                    <li key={expert.id} className="doctor-card-row rounded-lg border bg-muted/20 p-3">
                      <div className="flex flex-col gap-2">
                        <div className="font-medium text-foreground">{expert.name}</div>
                        <div className="text-sm text-muted-foreground">{expert.org}</div>
                        <Badge variant="secondary" className="w-fit">
                          {expert.department}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>消息提醒</CardTitle>
            <Button
              variant={editingReminder ? "default" : "outline"}
              onClick={() => setEditingReminder((current) => !current)}
              type="button"
            >
              <BellRingIcon data-icon="inline-start" />
              {editingReminder ? "保存提醒设置" : "编辑提醒设置"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {editingReminder ? (
            <>
              <Field>
                <FieldLabel htmlFor="consultationAheadReminder">会诊前提醒</FieldLabel>
                <Input
                  id="consultationAheadReminder"
                  value={reminder.consultationAhead}
                  onChange={(event) => updateReminder("consultationAhead", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="postCareDueReminder">诊后随访到期提醒</FieldLabel>
                <Input
                  id="postCareDueReminder"
                  value={reminder.postCare}
                  onChange={(event) => updateReminder("postCare", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="supplementReminder">专家补资料提醒</FieldLabel>
                <Input
                  id="supplementReminder"
                  value={reminder.supplement}
                  onChange={(event) => updateReminder("supplement", event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="adviceReminder">专家建议提交提醒</FieldLabel>
                <Input
                  id="adviceReminder"
                  value={reminder.advice}
                  onChange={(event) => updateReminder("advice", event.target.value)}
                />
              </Field>
            </>
          ) : (
            <>
              <InfoBox label="会诊前提醒" value={reminder.consultationAhead} />
              <InfoBox label="诊后随访到期提醒" value={reminder.postCare} />
              <InfoBox label="专家补资料提醒" value={reminder.supplement} />
              <InfoBox label="专家建议提交提醒" value={reminder.advice} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>常用模板</CardTitle>
            <Button variant="outline" onClick={addTemplate} type="button">
              <FilePlus2Icon data-icon="inline-start" />
              新增模板
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-3">
          {templates.map((template) => (
            <div key={template.id} className="doctor-card-row rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {template.editing ? (
                    <Input
                      value={template.title}
                      onChange={(event) =>
                        updateTemplate(template.id, { title: event.target.value })
                      }
                    />
                  ) : (
                    <div className="truncate text-sm font-medium">{template.title}</div>
                  )}
                  <div className="mt-2">
                    <Badge variant={template.enabled ? "default" : "secondary"}>
                      {template.enabled ? "启用中" : "已停用"}
                    </Badge>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateTemplate(template.id, { editing: !template.editing })
                  }
                  type="button"
                >
                  {template.editing ? "保存模板" : "编辑模板"}
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
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                  {template.content}
                </p>
              )}
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    updateTemplate(template.id, { enabled: !template.enabled })
                  }
                  type="button"
                >
                  {template.enabled ? "停用" : "启用"}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>账号与安全</CardTitle>
            <Button variant="outline" type="button">
              <Settings2Icon data-icon="inline-start" />
              账号安全
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <InfoBox label="登录手机号" value={profile.phone} />
          <InfoBox label="最近登录" value="今日 08:12 · 医生端控制台" />
          <InfoBox label="安全状态" value="已绑定本机构医生身份" />
        </CardContent>
      </Card>
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
  value: number
  icon: ComponentType<{ className?: string }>
  tone?: "default" | "warning" | "danger"
}) {
  return (
    <div className="doctor-metric-card flex items-center justify-between gap-3 rounded-lg border p-3">
      <div>
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="mt-2 text-2xl font-semibold leading-none">{value}</div>
      </div>
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-lg",
          tone === "danger"
            ? "bg-destructive/10 text-destructive"
            : tone === "warning"
              ? "bg-accent text-accent-foreground"
              : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="size-5" />
      </span>
    </div>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="doctor-info-box rounded-lg border p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm leading-6">{value}</div>
    </div>
  )
}

function getWorkbenchCounts(records: AdminCaseRecord[]) {
  const statuses = records.map((record) => record.consultation.status)

  return {
    draft: statuses.filter((status) => status === "draft").length,
    supplement: statuses.filter((status) => status === "needs_more_info").length,
    scheduled: statuses.filter((status) =>
      ["scheduled", "in_consultation"].includes(status),
    ).length,
    disposition: statuses.filter((status) => status === "pending_doctor_confirm").length,
    qualityReturn: statuses.filter((status) => status === "closed_incomplete").length,
  }
}

function getStatusActionHint(status: ConsultationStatus) {
  const hints: Record<ConsultationStatus, string> = {
    draft: "补齐申请信息后提交专家预审。",
    pending_expert: "等待专家预审，可先核对病例资料完整性。",
    needs_more_info: "专家已提出补充要求，请在病例资料中补齐。",
    scheduled: "按预约时间打开外部会诊系统并确认患者在场。",
    in_consultation: "外部会诊沟通进行中，完成后等待专家建议。",
    pending_advice: "外部沟通已完成，等待专家提交结构化建议。",
    pending_doctor_confirm: "专家建议已提交，请确认本地处置。",
    completed: "本地处置已确认，等待运营质控归档。",
    archived: "会诊单已归档，可用于复盘和随访。",
    expert_declined: "专家已婉拒，请重新选择专家或联系运营协调。",
    patient_cancelled: "患者已取消，请记录取消原因。",
    closed_incomplete: "资料不足关闭，请按需重新建单。",
    offline_emergency: "已转线下急诊，请补充急诊处置结果。",
  }

  return hints[status]
}

function canSendExpertReminder(status: ConsultationStatus) {
  return ["pending_expert", "scheduled", "in_consultation", "pending_advice"].includes(status)
}

function getExpertReminderTitle(status: ConsultationStatus) {
  const titles: Partial<Record<ConsultationStatus, string>> = {
    pending_expert: "运营催办专家预审",
    scheduled: "运营提醒专家参会",
    in_consultation: "运营催办专家会诊",
    pending_advice: "运营催办专家建议",
  }

  return titles[status] ?? "运营催办专家处理"
}

function getDoctorTaskTestId(record: AdminCaseRecord) {
  if (record.isLive) return "doctor-task-current"

  return `doctor-task-${record.consultation.status.replaceAll("_", "-")}`
}

function getDoctorStatusBadgeVariant(status: ConsultationStatus) {
  if (status === "completed" || status === "archived") return "default"
  if (status === "needs_more_info" || status === "closed_incomplete") {
    return "destructive"
  }

  return "secondary"
}

function getMeetingCode(consultation: Consultation) {
  return `QY-${consultation.id.slice(-3)}`
}

function toConsultationFormState(
  consultation: Consultation,
  fallbackExpertId: string,
): ConsultationFormState {
  return {
    patientName: consultation.patient.name,
    patientGender: consultation.patient.gender,
    patientAge: String(consultation.patient.age),
    patientPhoneMasked: consultation.patient.phoneMasked,
    patientIdNoMasked: consultation.patient.idNoMasked,
    allergyHistory: consultation.patient.allergyHistory,
    pastHistory: consultation.patient.pastHistory,
    department: consultation.department,
    chiefComplaint: consultation.chiefComplaint,
    consultationPurpose: consultation.consultationPurpose,
    priority: consultation.priority,
    expertId: consultation.expertId ?? fallbackExpertId,
  }
}
