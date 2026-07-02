import {
  addSupplementalAttachments,
  acceptConsultation,
  archiveConsultation,
  completeExternalConsultation,
  completeConsultationAdvice,
  confirmDoctorDisposition,
  requestMoreInformation,
  startConsultation,
  submitConsultationApplication,
  type ConsultationApplicationInput,
} from "./consultation-workflow"
import type {
  Attachment,
  AttachmentType,
  Consultation,
  ExpertAdvice,
  LocalDisposition,
  OperationLog,
  UserRole,
} from "./types"
import { demoExperts, demoUsers, seedConsultation } from "@/mock/seed-data"

const ACTION_TIME = "2026-07-12T09:00:00+08:00"

export interface DemoNotification {
  id: string
  audience: UserRole
  title: string
  detail: string
}

export interface DemoSession {
  activeConsultation: Consultation
  experts: typeof demoExperts
  users: typeof demoUsers
  notifications: DemoNotification[]
  operationLogs: OperationLog[]
}

export type DemoAction =
  | { type: "doctor.submitConsultation"; input: ConsultationApplicationInput }
  | {
      type: "expert.requestMoreInfo"
      input: { message: string; requiredAttachmentTypes: AttachmentType[] }
    }
  | {
      type: "doctor.addSupplement"
      input: { attachments: Array<Omit<Attachment, "id" | "uploadedBy" | "uploadedAt">>; note: string }
    }
  | { type: "expert.accept"; input: { expertId: string; scheduledAt: string } }
  | { type: "doctor.startRoom" }
  | { type: "doctor.completeExternalConsultation" }
  | { type: "expert.submitAdvice"; input: Omit<ExpertAdvice, "submittedBy" | "submittedAt"> }
  | { type: "doctor.confirmDisposition"; input: Omit<LocalDisposition, "confirmedAt"> }
  | { type: "doctor.archive" }
  | {
      type: "admin.sendReminder"
      input: {
        targetRole: Exclude<UserRole, "admin">
        title: string
        detail: string
      }
    }
  | { type: "admin.addNote"; input: { title: string; detail: string } }
  | {
      type: "admin.updatePriority"
      input: { priority: Consultation["priority"]; reason: string }
    }
  | { type: "admin.archive" }
  | { type: "session.reset" }
  | { type: "session.restore"; session: DemoSession }

export interface DashboardStats {
  draftCount: number
  activeCount: number
  completedCount: number
  archivedCount: number
  availableExperts: number
}

export function createDemoSession(): DemoSession {
  return {
    activeConsultation: seedConsultation({ status: "draft" }),
    experts: demoExperts,
    users: demoUsers,
    notifications: [],
    operationLogs: [],
  }
}

function getExpertName(session: DemoSession, expertId: string | undefined): string {
  return session.experts.find((expert) => expert.id === expertId)?.name ?? "会诊专家"
}

function notify(
  session: DemoSession,
  audience: UserRole,
  title: string,
  detail: string,
): DemoSession {
  return {
    ...session,
    notifications: [
      ...session.notifications,
      {
        id: `notice-${session.notifications.length + 1}`,
        audience,
        title,
        detail,
      },
    ],
  }
}

function withConsultation(
  session: DemoSession,
  activeConsultation: Consultation,
): DemoSession {
  return {
    ...session,
    activeConsultation,
  }
}

function withOperationLog(
  session: DemoSession,
  input: Omit<OperationLog, "id" | "consultationId" | "actorRole" | "actorName" | "createdAt">,
): DemoSession {
  return {
    ...session,
    operationLogs: [
      ...session.operationLogs,
      {
        id: `op-${session.operationLogs.length + 1}`,
        consultationId: session.activeConsultation.id,
        actorRole: "admin",
        actorName: "何管理员",
        createdAt: ACTION_TIME,
        ...input,
      },
    ],
  }
}

export function demoReducer(session: DemoSession, action: DemoAction): DemoSession {
  switch (action.type) {
    case "doctor.submitConsultation":
      return notify(
        withConsultation(
          session,
          submitConsultationApplication(session.activeConsultation, action.input),
        ),
        "expert",
        "新的会诊邀请",
        `王医生提交了${action.input.department}会诊申请，请预审资料。`,
      )

    case "expert.requestMoreInfo":
      return notify(
        withConsultation(
          session,
          requestMoreInformation(session.activeConsultation, {
            expertId: session.activeConsultation.expertId ?? "expert-lu",
            expertName: getExpertName(session, session.activeConsultation.expertId),
            message: action.input.message,
            requiredAttachmentTypes: action.input.requiredAttachmentTypes,
          }),
        ),
        "doctor",
        "专家要求补充资料",
        action.input.message,
      )

    case "doctor.addSupplement": {
      const nextAttachments: Attachment[] = action.input.attachments.map(
        (attachment, index) => ({
          ...attachment,
          id: `att-${session.activeConsultation.attachments.length + index + 1}`,
          uploadedBy: session.activeConsultation.localDoctorId,
          uploadedAt: ACTION_TIME,
        }),
      )

      return notify(
        withConsultation(
          session,
          addSupplementalAttachments(session.activeConsultation, {
            attachments: nextAttachments,
            note: action.input.note,
          }),
        ),
        "expert",
        "资料已补充",
        "本地医生已补充资料，可继续预审并确认会诊。",
      )
    }

    case "expert.accept":
      return notify(
        withConsultation(
          session,
          acceptConsultation(session.activeConsultation, {
            expertId: action.input.expertId,
            scheduledAt: action.input.scheduledAt,
          }),
        ),
        "doctor",
        "专家已确认接诊",
        `会诊时间已确认为${action.input.scheduledAt}。`,
      )

    case "doctor.startRoom":
      return notify(
        withConsultation(session, startConsultation(session.activeConsultation)),
        "expert",
        "远程会诊已开始",
        "本地医生已进入远程会诊间，请按预约时间完成沟通。",
      )

    case "doctor.completeExternalConsultation":
      return notify(
        withConsultation(session, completeExternalConsultation(session.activeConsultation)),
        "expert",
        "外部会诊沟通已完成",
        "本地医生已完成外部系统会诊沟通，请提交结构化会诊建议。",
      )

    case "expert.submitAdvice":
      return notify(
        withConsultation(
          session,
          completeConsultationAdvice(session.activeConsultation, action.input),
        ),
        "doctor",
        "专家建议已提交",
        "请本地医生结合线下诊查确认最终处置。",
      )

    case "doctor.confirmDisposition":
      return notify(
        withConsultation(
          session,
          confirmDoctorDisposition(session.activeConsultation, action.input),
        ),
        "admin",
        "会诊已完成",
        "医生已确认本地处置，等待归档。",
      )

    case "doctor.archive":
      return notify(
        withConsultation(session, archiveConsultation(session.activeConsultation)),
        "admin",
        "会诊单已归档",
        "完整流程已形成可追溯记录。",
      )

    case "admin.sendReminder":
      return notify(
        withOperationLog(session, {
          action: "reminder",
          targetRole: action.input.targetRole,
          title: action.input.title,
          detail: action.input.detail,
        }),
        action.input.targetRole,
        action.input.title,
        action.input.detail,
      )

    case "admin.addNote":
      return withOperationLog(session, {
        action: "note",
        title: action.input.title,
        detail: action.input.detail,
      })

    case "admin.updatePriority":
      return notify(
        withOperationLog(
          withConsultation(session, {
            ...session.activeConsultation,
            priority: action.input.priority,
          }),
          {
            action: "priority",
            title: action.input.priority === "urgent" ? "运营标记紧急" : "运营恢复普通",
            detail: action.input.reason,
          },
        ),
        "admin",
        action.input.priority === "urgent" ? "已标记紧急会诊" : "已恢复普通会诊",
        action.input.reason,
      )

    case "admin.archive":
      return notify(
        withOperationLog(
          withConsultation(session, archiveConsultation(session.activeConsultation)),
          {
            action: "archive",
            title: "运营质控归档",
            detail: "运营已完成资料完整性、专家建议、医生处置和流程留痕检查。",
          },
        ),
        "admin",
        "会诊单已归档",
        "完整流程已形成可追溯记录。",
      )

    case "session.reset":
      return createDemoSession()

    case "session.restore":
      return action.session
  }
}

export function getDashboardStats(session: DemoSession): DashboardStats {
  const status = session.activeConsultation.status

  return {
    draftCount: status === "draft" ? 1 : 0,
    activeCount:
      status !== "draft" && status !== "completed" && status !== "archived"
        ? 1
        : 0,
    completedCount: status === "completed" ? 1 : 0,
    archivedCount: status === "archived" ? 1 : 0,
    availableExperts: session.experts.filter((expert) => expert.status === "available")
      .length,
  }
}

export function serializeDemoSession(session: DemoSession): string {
  return JSON.stringify(session)
}

export function restoreDemoSession(savedValue: string | null): DemoSession {
  if (!savedValue) return createDemoSession()

  try {
    const parsed = JSON.parse(savedValue) as Partial<DemoSession>

    if (!parsed.activeConsultation?.status || !Array.isArray(parsed.notifications)) {
      return createDemoSession()
    }

    return {
      activeConsultation: parsed.activeConsultation as Consultation,
      experts: parsed.experts ?? demoExperts,
      users: parsed.users ?? demoUsers,
      notifications: parsed.notifications,
      operationLogs: parsed.operationLogs ?? [],
    }
  } catch {
    return createDemoSession()
  }
}
