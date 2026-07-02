export type ConsultationStatus =
  | "draft"
  | "pending_expert"
  | "needs_more_info"
  | "scheduled"
  | "in_consultation"
  | "pending_advice"
  | "pending_doctor_confirm"
  | "completed"
  | "archived"
  | "expert_declined"
  | "patient_cancelled"
  | "closed_incomplete"
  | "offline_emergency"

export type AttachmentType =
  | "lab_report"
  | "imaging"
  | "tongue_face"
  | "ecg"
  | "medication_list"
  | "other"

export type UserRole = "doctor" | "expert" | "admin"

export interface User {
  id: string
  name: string
  role: UserRole
  orgName: string
  department: string
  title: string
  avatarInitials: string
}

export interface ExpertProfile {
  id: string
  name: string
  hospital: string
  department: string
  title: string
  specialties: string[]
  status: "available" | "busy" | "offline"
  slots: string[]
  hometownTag: string
}

export interface Patient {
  id: string
  name: string
  gender: "男" | "女"
  age: number
  phoneMasked: string
  idNoMasked: string
  allergyHistory: string
  pastHistory: string
}

export interface Attachment {
  id: string
  type: AttachmentType
  name: string
  uploadedBy: string
  uploadedAt: string
  description: string
}

export interface Message {
  id: string
  fromRole: UserRole
  fromName: string
  content: string
  createdAt: string
}

export interface TimelineItem {
  id: string
  status: ConsultationStatus
  label: string
  at: string
}

export interface ExpertAdvice {
  submittedBy: string
  submittedAt: string
  diagnosisSuggestion: string
  examinationSuggestion: string
  treatmentSuggestion: string
  referralSuggestion: string
  riskNotice: string
  followUpSuggestion: string
}

export interface LocalDisposition {
  adopted: "yes" | "partial" | "no"
  note: string
  confirmedAt: string
}

export interface OperationLog {
  id: string
  consultationId: string
  action: "reminder" | "note" | "priority" | "quality" | "archive"
  actorRole: UserRole
  actorName: string
  targetRole?: UserRole
  title: string
  detail: string
  createdAt: string
}

export interface Consultation {
  id: string
  status: ConsultationStatus
  patient: Patient
  localDoctorId: string
  expertId?: string
  department: string
  chiefComplaint: string
  consultationPurpose: string
  priority: "normal" | "urgent"
  scheduledAt?: string
  createdAt: string
  attachments: Attachment[]
  messages: Message[]
  timeline: TimelineItem[]
  requiredAttachmentTypes: AttachmentType[]
  expertAdvice?: ExpertAdvice
  localDisposition?: LocalDisposition
}
