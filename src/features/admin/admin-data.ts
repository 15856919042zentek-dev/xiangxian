import type { DemoSession } from "@/domain/demo-session"
import type {
  Consultation,
  ConsultationStatus,
  ExpertAdvice,
  LocalDisposition,
  OperationLog,
  Patient,
  UserRole,
} from "@/domain/types"
import { seedConsultation } from "@/mock/seed-data"

export type AdminSectionKey =
  | "workbench"
  | "cases"
  | "reminders"
  | "experts"
  | "quality"
  | "messages"
  | "reports"
  | "settings"

export interface AdminCaseRecord {
  consultation: Consultation
  isLive: boolean
  doctorName: string
  doctorOrg: string
  expertName: string
  expertOrg: string
  currentOwner: string
  currentOwnerRole?: Exclude<UserRole, "admin">
  waitTime: string
  slaLabel: string
  operationNeed: string
  riskLevel: "normal" | "warning" | "urgent" | "done"
}

export interface ReminderTemplate {
  id: string
  targetRole: Exclude<UserRole, "admin">
  title: string
  detail: string
  appliesTo: ConsultationStatus[]
}

export const adminStatusLabels: Record<ConsultationStatus, string> = {
  draft: "草稿",
  pending_expert: "待专家预审",
  needs_more_info: "待资料补充",
  scheduled: "待会诊",
  in_consultation: "会诊中",
  pending_advice: "待专家建议",
  pending_doctor_confirm: "待医生确认",
  completed: "待运营归档",
  archived: "已归档",
  expert_declined: "专家婉拒",
  patient_cancelled: "患者取消",
  closed_incomplete: "资料不足关闭",
  offline_emergency: "转线下急诊",
}

export const reminderTemplates: ReminderTemplate[] = [
  {
    id: "expert-review",
    targetRole: "expert",
    title: "请尽快预审会诊资料",
    detail: "运营提醒：该会诊申请已进入专家预审队列，请确认接诊或提出补充资料要求。",
    appliesTo: ["pending_expert"],
  },
  {
    id: "doctor-supplement",
    targetRole: "doctor",
    title: "请补充专家要求资料",
    detail: "运营提醒：专家已提出资料补充要求，请补齐后重新提交预审。",
    appliesTo: ["needs_more_info"],
  },
  {
    id: "doctor-room",
    targetRole: "doctor",
    title: "预约会诊即将开始",
    detail: "运营提醒：请本地医生提前进入远程会诊间，确认患者在场和资料可用。",
    appliesTo: ["scheduled"],
  },
  {
    id: "expert-advice",
    targetRole: "expert",
    title: "请提交结构化会诊建议",
    detail: "运营提醒：远程会诊已结束，请补充诊断、检查、治疗、转诊和随访建议。",
    appliesTo: ["pending_advice", "in_consultation"],
  },
  {
    id: "doctor-confirm",
    targetRole: "doctor",
    title: "请确认本地处置",
    detail: "运营提醒：专家建议已提交，请结合线下诊查确认最终处置并提交。",
    appliesTo: ["pending_doctor_confirm"],
  },
]

const expertAdvice: ExpertAdvice = {
  submittedBy: "expert-lu",
  submittedAt: "2026-07-12T10:18:00+08:00",
  diagnosisSuggestion: "结合症状和既往史，考虑冠心病稳定型心绞痛可能。",
  examinationSuggestion: "复查心电图、心肌酶谱，必要时完善冠脉 CTA。",
  treatmentSuggestion: "由本地医生结合现场情况调整抗血小板和调脂治疗。",
  referralSuggestion: "如胸痛持续或心电图动态改变，建议上转胸痛中心。",
  riskNotice: "持续胸痛、出汗、濒死感时需立即线下急诊。",
  followUpSuggestion: "一周后复诊，复核血压、血糖和用药依从性。",
}

const localDisposition: LocalDisposition = {
  adopted: "partial",
  note: "采纳检查和风险提示建议，暂由本地医生随访，异常时转县医院。",
  confirmedAt: "2026-07-12T10:45:00+08:00",
}

const fixtureCases: Array<{
  id: string
  status: ConsultationStatus
  patient: Pick<Patient, "name" | "gender" | "age">
  department: string
  chiefComplaint: string
  consultationPurpose: string
  priority: Consultation["priority"]
  doctorName: string
  doctorOrg: string
  expertName: string
  expertOrg: string
  waitTime: string
  slaLabel: string
  scheduledAt?: string
}> = [
  {
    id: "consult-20260712-006",
    status: "pending_expert",
    patient: { name: "刘某某", gender: "女", age: 72 },
    department: "神经内科",
    chiefComplaint: "反复头晕伴左侧肢体麻木 1 天。",
    consultationPurpose: "请专家协助判断是否需进一步卒中筛查或上转。",
    priority: "urgent",
    doctorName: "张医生",
    doctorOrg: "蒙城县中医院",
    expertName: "陈医生",
    expertOrg: "上海中医药大学附属医院",
    waitTime: "18 分钟",
    slaLabel: "紧急预审 30 分钟内",
  },
  {
    id: "consult-20260712-005",
    status: "needs_more_info",
    patient: { name: "周某某", gender: "男", age: 58 },
    department: "内分泌科",
    chiefComplaint: "血糖控制不佳，近期乏力口干明显。",
    consultationPurpose: "请专家协助调整慢病管理建议。",
    priority: "normal",
    doctorName: "王医生",
    doctorOrg: "蒙城县中医院",
    expertName: "卢主任",
    expertOrg: "安徽省立医院",
    waitTime: "1 小时 42 分钟",
    slaLabel: "待医生补充资料",
  },
  {
    id: "consult-20260712-004",
    status: "scheduled",
    patient: { name: "孙某某", gender: "女", age: 64 },
    department: "呼吸内科",
    chiefComplaint: "慢阻肺病史，近 2 天咳喘加重。",
    consultationPurpose: "请专家协助判断是否需要调整吸入治疗方案。",
    priority: "normal",
    doctorName: "李医生",
    doctorOrg: "蒙城县第二人民医院",
    expertName: "卢主任",
    expertOrg: "安徽省立医院",
    waitTime: "距会诊 26 分钟",
    slaLabel: "今日 15:00 会诊",
    scheduledAt: "今日 15:00",
  },
  {
    id: "consult-20260712-003",
    status: "pending_advice",
    patient: { name: "陈某某", gender: "男", age: 69 },
    department: "心血管内科",
    chiefComplaint: "胸闷后活动耐量下降。",
    consultationPurpose: "请专家补充检查和随访建议。",
    priority: "normal",
    doctorName: "王医生",
    doctorOrg: "蒙城县第一人民医院",
    expertName: "卢主任",
    expertOrg: "安徽省立医院",
    waitTime: "会诊后 34 分钟",
    slaLabel: "待专家建议",
  },
  {
    id: "consult-20260712-002",
    status: "completed",
    patient: { name: "韩某某", gender: "女", age: 76 },
    department: "全科门诊",
    chiefComplaint: "高血压合并夜间胸闷。",
    consultationPurpose: "请专家给出后续随访与转诊建议。",
    priority: "normal",
    doctorName: "李医生",
    doctorOrg: "漆园社区卫生服务中心",
    expertName: "陈医生",
    expertOrg: "上海中医药大学附属医院",
    waitTime: "待归档 21 分钟",
    slaLabel: "运营质控中",
  },
  {
    id: "consult-20260711-018",
    status: "archived",
    patient: { name: "马某某", gender: "男", age: 61 },
    department: "中医内科",
    chiefComplaint: "失眠伴心悸 2 周。",
    consultationPurpose: "请专家协助评估中西医结合调理方案。",
    priority: "normal",
    doctorName: "张医生",
    doctorOrg: "蒙城县中医院",
    expertName: "陈医生",
    expertOrg: "上海中医药大学附属医院",
    waitTime: "昨日归档",
    slaLabel: "已闭环",
  },
]

export function getAdminCaseRecords(session: DemoSession): AdminCaseRecord[] {
  const liveConsultation = session.activeConsultation
  const liveDoctor = session.users.find((user) => user.id === liveConsultation.localDoctorId)
  const liveExpert = session.experts.find((expert) => expert.id === liveConsultation.expertId)

  return [
    toCaseRecord(liveConsultation, {
      isLive: true,
      doctorName: liveDoctor?.name ?? "王医生",
      doctorOrg: liveDoctor?.orgName ?? "蒙城县中医院",
      expertName: liveExpert?.name ?? "待选择专家",
      expertOrg: liveExpert?.hospital ?? "专家库",
      waitTime: getLiveWaitTime(liveConsultation.status),
      slaLabel: getLiveSlaLabel(liveConsultation.status),
    }),
    ...fixtureCases.map((item) =>
      toCaseRecord(createFixtureConsultation(item), {
        isLive: false,
        doctorName: item.doctorName,
        doctorOrg: item.doctorOrg,
        expertName: item.expertName,
        expertOrg: item.expertOrg,
        waitTime: item.waitTime,
        slaLabel: item.slaLabel,
      }),
    ),
  ]
}

export function getDefaultOperationLogs(session: DemoSession): OperationLog[] {
  return [
    {
      id: "op-seed-1",
      consultationId: "consult-20260712-005",
      action: "reminder",
      actorRole: "admin",
      actorName: "何管理员",
      targetRole: "doctor",
      title: "已提醒补充资料",
      detail: "专家要求补充近期用药清单，运营已电话同步本地医生。",
      createdAt: "2026-07-12T09:12:00+08:00",
    },
    {
      id: "op-seed-2",
      consultationId: "consult-20260712-003",
      action: "reminder",
      actorRole: "admin",
      actorName: "何管理员",
      targetRole: "expert",
      title: "已提醒提交建议",
      detail: "会诊结束后 30 分钟仍未提交结构化建议，系统记录运营催办。",
      createdAt: "2026-07-12T10:36:00+08:00",
    },
    ...session.operationLogs,
  ]
}

function createFixtureConsultation(
  item: (typeof fixtureCases)[number],
): Consultation {
  const seed = seedConsultation({ status: item.status, expertId: "expert-lu" })

  return {
    ...seed,
    id: item.id,
    status: item.status,
    patient: {
      ...seed.patient,
      ...item.patient,
      id: `patient-${item.id}`,
      phoneMasked: "139****" + item.id.slice(-4),
      idNoMasked: "342622********" + item.id.slice(-4),
    },
    localDoctorId: item.doctorName === "王医生" ? "doctor-wang" : `doctor-${item.doctorName}`,
    department: item.department,
    chiefComplaint: item.chiefComplaint,
    consultationPurpose: item.consultationPurpose,
    priority: item.priority,
    scheduledAt: item.scheduledAt,
    requiredAttachmentTypes: item.status === "needs_more_info" ? ["ecg", "medication_list"] : [],
    expertAdvice: ["completed", "archived"].includes(item.status) ? expertAdvice : undefined,
    localDisposition: ["completed", "archived"].includes(item.status) ? localDisposition : undefined,
    timeline: createTimeline(item.status),
  }
}

function toCaseRecord(
  consultation: Consultation,
  meta: Omit<AdminCaseRecord, "consultation" | "currentOwner" | "currentOwnerRole" | "operationNeed" | "riskLevel">,
): AdminCaseRecord {
  const owner = getOwner(consultation.status)

  return {
    consultation,
    ...meta,
    currentOwner: owner.label,
    currentOwnerRole: owner.role,
    operationNeed: getOperationNeed(consultation.status),
    riskLevel: getRiskLevel(consultation.status, consultation.priority),
  }
}

function getOwner(status: ConsultationStatus): { label: string; role?: Exclude<UserRole, "admin"> } {
  if (["pending_expert", "pending_advice"].includes(status)) {
    return { label: "专家处理", role: "expert" }
  }
  if (["needs_more_info", "scheduled", "pending_doctor_confirm", "draft"].includes(status)) {
    return { label: "医生处理", role: "doctor" }
  }
  if (status === "in_consultation") return { label: "医生与专家协同" }
  if (status === "completed") return { label: "运营质控" }
  return { label: "流程闭环" }
}

function getOperationNeed(status: ConsultationStatus) {
  const needs: Record<ConsultationStatus, string> = {
    draft: "等待医生提交",
    pending_expert: "关注专家预审时效",
    needs_more_info: "催医生补齐资料",
    scheduled: "确认双方按时进入会诊",
    in_consultation: "监控会诊是否顺利完成",
    pending_advice: "催专家提交结构化建议",
    pending_doctor_confirm: "催医生确认本地处置",
    completed: "执行质控并归档",
    archived: "可用于复盘统计",
    expert_declined: "协助医生重新选择专家",
    patient_cancelled: "记录取消原因",
    closed_incomplete: "记录资料不足原因",
    offline_emergency: "跟踪线下急诊转诊结果",
  }

  return needs[status]
}

function getRiskLevel(
  status: ConsultationStatus,
  priority: Consultation["priority"],
): AdminCaseRecord["riskLevel"] {
  if (status === "archived") return "done"
  if (priority === "urgent") return "urgent"
  if (["needs_more_info", "pending_advice", "completed"].includes(status)) return "warning"
  return "normal"
}

function getLiveWaitTime(status: ConsultationStatus) {
  const labels: Record<ConsultationStatus, string> = {
    draft: "未提交",
    pending_expert: "等待 12 分钟",
    needs_more_info: "待补 28 分钟",
    scheduled: "距会诊 30 分钟",
    in_consultation: "通话 8 分钟",
    pending_advice: "会诊后 18 分钟",
    pending_doctor_confirm: "待确认 16 分钟",
    completed: "待归档 9 分钟",
    archived: "已归档",
    expert_declined: "待改派",
    patient_cancelled: "已取消",
    closed_incomplete: "已关闭",
    offline_emergency: "线下处置中",
  }

  return labels[status]
}

function getLiveSlaLabel(status: ConsultationStatus) {
  const labels: Record<ConsultationStatus, string> = {
    draft: "医生草稿",
    pending_expert: "专家预审 2 小时内",
    needs_more_info: "补充资料 4 小时内",
    scheduled: "预约前 10 分钟提醒",
    in_consultation: "会诊进行中",
    pending_advice: "建议 30 分钟内",
    pending_doctor_confirm: "处置确认 2 小时内",
    completed: "运营归档 24 小时内",
    archived: "已闭环",
    expert_declined: "运营改派",
    patient_cancelled: "记录原因",
    closed_incomplete: "记录原因",
    offline_emergency: "急诊跟踪",
  }

  return labels[status]
}

function createTimeline(status: ConsultationStatus): Consultation["timeline"] {
  const steps: Array<{ status: ConsultationStatus; label: string; at: string }> = [
    { status: "pending_expert", label: "医生提交会诊申请", at: "2026-07-12T08:30:00+08:00" },
  ]

  if (status === "needs_more_info") {
    steps.push({
      status: "needs_more_info",
      label: "专家要求补充资料",
      at: "2026-07-12T08:48:00+08:00",
    })
  }

  if (["scheduled", "in_consultation", "pending_advice", "pending_doctor_confirm", "completed", "archived"].includes(status)) {
    steps.push({
      status: "scheduled",
      label: "专家已确认接诊",
      at: "2026-07-12T09:02:00+08:00",
    })
  }

  if (["in_consultation", "pending_advice", "pending_doctor_confirm", "completed", "archived"].includes(status)) {
    steps.push({
      status: "in_consultation",
      label: "远程会诊开始",
      at: "2026-07-12T09:30:00+08:00",
    })
  }

  if (["pending_advice", "pending_doctor_confirm", "completed", "archived"].includes(status)) {
    steps.push({
      status: "pending_advice",
      label: "远程会诊结束，待专家建议",
      at: "2026-07-12T10:05:00+08:00",
    })
  }

  if (["pending_doctor_confirm", "completed", "archived"].includes(status)) {
    steps.push({
      status: "pending_doctor_confirm",
      label: "专家已提交会诊建议",
      at: "2026-07-12T10:18:00+08:00",
    })
  }

  if (["completed", "archived"].includes(status)) {
    steps.push({
      status: "completed",
      label: "本地医生已确认处置",
      at: "2026-07-12T10:45:00+08:00",
    })
  }

  if (status === "archived") {
    steps.push({
      status: "archived",
      label: "运营质控归档",
      at: "2026-07-12T11:10:00+08:00",
    })
  }

  return steps.map((item, index) => ({
    id: `${item.status}-${index}`,
    ...item,
  }))
}
