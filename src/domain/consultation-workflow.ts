import type {
  Attachment,
  AttachmentType,
  Consultation,
  ConsultationStatus,
  ExpertAdvice,
  LocalDisposition,
  Message,
  Patient,
  TimelineItem,
} from "./types"

const DEMO_NOW = "2026-07-12T09:00:00+08:00"

function timelineItem(
  status: ConsultationStatus,
  label: string,
  at = DEMO_NOW,
): TimelineItem {
  return {
    id: `${status}-${at}-${label}`,
    status,
    label,
    at,
  }
}

function withTimeline(
  consultation: Consultation,
  status: ConsultationStatus,
  label: string,
): Consultation {
  return {
    ...consultation,
    status,
    timeline: [...consultation.timeline, timelineItem(status, label)],
  }
}

export interface ConsultationApplicationInput {
  patient: Patient
  department: string
  chiefComplaint: string
  consultationPurpose: string
  priority: Consultation["priority"]
  expertId: string
}

export function submitConsultationApplication(
  consultation: Consultation,
  input: ConsultationApplicationInput,
): Consultation {
  return withTimeline(
    {
      ...consultation,
      patient: input.patient,
      department: input.department,
      chiefComplaint: input.chiefComplaint,
      consultationPurpose: input.consultationPurpose,
      priority: input.priority,
      expertId: input.expertId,
      requiredAttachmentTypes: [],
    },
    "pending_expert",
    "医生提交会诊申请",
  )
}

export function acceptConsultation(
  consultation: Consultation,
  input: { expertId: string; scheduledAt: string },
): Consultation {
  return {
    ...withTimeline(consultation, "scheduled", "专家已确认接诊"),
    expertId: input.expertId,
    scheduledAt: input.scheduledAt,
    requiredAttachmentTypes: [],
  }
}

export function requestMoreInformation(
  consultation: Consultation,
  input: {
    expertId: string
    expertName: string
    message: string
    requiredAttachmentTypes: AttachmentType[]
  },
): Consultation {
  const expertMessage: Message = {
    id: `msg-${consultation.messages.length + 1}`,
    fromRole: "expert",
    fromName: input.expertName,
    content: input.message,
    createdAt: DEMO_NOW,
  }

  return {
    ...withTimeline(consultation, "needs_more_info", "专家要求补充资料"),
    expertId: input.expertId,
    messages: [...consultation.messages, expertMessage],
    requiredAttachmentTypes: input.requiredAttachmentTypes,
  }
}

export function addSupplementalAttachments(
  consultation: Consultation,
  input: {
    attachments: Attachment[]
    note: string
  },
): Consultation {
  const uploadedTypes = new Set(input.attachments.map((attachment) => attachment.type))
  const requiredAttachmentTypes = consultation.requiredAttachmentTypes.filter(
    (type) => !uploadedTypes.has(type),
  )
  const nextStatus = requiredAttachmentTypes.length > 0 ? "needs_more_info" : "pending_expert"
  const doctorMessage: Message | null = input.note
    ? {
        id: `msg-${consultation.messages.length + 1}`,
        fromRole: "doctor",
        fromName: "王医生",
        content: input.note,
        createdAt: DEMO_NOW,
      }
    : null

  return {
    ...withTimeline(
      consultation,
      nextStatus,
      nextStatus === "pending_expert" ? "医生已补充资料" : "医生补充部分资料",
    ),
    attachments: [...consultation.attachments, ...input.attachments],
    messages: doctorMessage
      ? [...consultation.messages, doctorMessage]
      : consultation.messages,
    requiredAttachmentTypes,
  }
}

export function startConsultation(consultation: Consultation): Consultation {
  return withTimeline(consultation, "in_consultation", "远程会诊开始")
}

export function completeExternalConsultation(consultation: Consultation): Consultation {
  return withTimeline(consultation, "pending_advice", "外部会诊沟通完成")
}

export function completeConsultationAdvice(
  consultation: Consultation,
  advice: Omit<ExpertAdvice, "submittedBy" | "submittedAt">,
): Consultation {
  const expertAdvice: ExpertAdvice = {
    ...advice,
    submittedBy: consultation.expertId ?? "expert-lu",
    submittedAt: DEMO_NOW,
  }

  return {
    ...withTimeline(consultation, "pending_doctor_confirm", "专家已提交会诊建议"),
    expertAdvice,
  }
}

export function confirmDoctorDisposition(
  consultation: Consultation,
  disposition: Omit<LocalDisposition, "confirmedAt">,
): Consultation {
  return {
    ...withTimeline(consultation, "completed", "本地医生已确认处置"),
    localDisposition: {
      ...disposition,
      confirmedAt: DEMO_NOW,
    },
  }
}

export function archiveConsultation(consultation: Consultation): Consultation {
  return withTimeline(consultation, "archived", "会诊单已归档")
}
