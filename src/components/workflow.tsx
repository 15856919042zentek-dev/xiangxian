import {
  ActivityIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  FileTextIcon,
  MessageSquareTextIcon,
  PaperclipIcon,
  UserRoundIcon,
  VideoIcon,
} from "lucide-react"
import type { ComponentType } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { Consultation, ConsultationStatus, ExpertProfile } from "@/domain/types"
import type { AttachmentType, UserRole } from "@/domain/types"

const statusLabels: Record<ConsultationStatus, string> = {
  draft: "草稿",
  pending_expert: "待专家确认",
  needs_more_info: "待补充资料",
  scheduled: "已预约",
  in_consultation: "会诊中",
  pending_advice: "待专家建议",
  pending_doctor_confirm: "待医生确认",
  completed: "已完成",
  archived: "已归档",
  expert_declined: "专家拒绝",
  patient_cancelled: "患者取消",
  closed_incomplete: "资料不足关闭",
  offline_emergency: "转线下急诊",
}

export const attachmentTypeLabels: Record<AttachmentType, string> = {
  lab_report: "检验报告",
  imaging: "影像资料",
  tongue_face: "舌面照片",
  ecg: "心电图",
  medication_list: "用药清单",
  other: "其他资料",
}

const messageRoleLabels: Record<UserRole, string> = {
  doctor: "本地医生",
  expert: "会诊专家",
  admin: "运营人员",
}

export function StatusBadge({ status }: { status: ConsultationStatus }) {
  const variant =
    status === "archived" || status === "completed"
      ? "default"
      : status === "needs_more_info" || status === "offline_emergency"
        ? "destructive"
        : "secondary"

  return <Badge variant={variant}>{statusLabels[status]}</Badge>
}

export function PatientSummary({
  consultation,
  showDescription = true,
}: {
  consultation: Consultation
  showDescription?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>患者与诉求</CardTitle>
        {showDescription && (
          <CardDescription>由本地医生线下接诊后发起远程会诊</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-3">
          <InfoItem label="患者" value={`${consultation.patient.name} · ${consultation.patient.gender} · ${consultation.patient.age}岁`} />
          <InfoItem label="联系电话" value={consultation.patient.phoneMasked} />
          <InfoItem label="身份证" value={consultation.patient.idNoMasked} />
        </div>
        <Separator />
        <div className="grid gap-3 md:grid-cols-2">
          <InfoItem label="主诉" value={consultation.chiefComplaint} />
          <InfoItem label="会诊目的" value={consultation.consultationPurpose} />
          <InfoItem label="既往史" value={consultation.patient.pastHistory} />
          <InfoItem label="过敏史" value={consultation.patient.allergyHistory} />
        </div>
      </CardContent>
    </Card>
  )
}

export function ExpertCard({ expert }: { expert: ExpertProfile }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              <AvatarFallback>{expert.name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{expert.name}</CardTitle>
              <CardDescription>
                {expert.hospital} · {expert.title}
              </CardDescription>
            </div>
          </div>
          <Badge variant={expert.status === "available" ? "default" : "secondary"}>
            {expert.status === "available" ? "可预约" : "忙碌"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{expert.hometownTag}</Badge>
          <Badge variant="outline">{expert.department}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{expert.specialties.join(" / ")}</p>
        <div className="flex flex-wrap gap-2">
          {expert.slots.map((slot) => (
            <Badge key={slot} variant="secondary">{slot}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function AttachmentList({
  consultation,
  showDescription = true,
}: {
  consultation: Consultation
  showDescription?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>病例资料</CardTitle>
        {showDescription && (
          <CardDescription>会诊所需检查报告、影像资料和补充材料</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {consultation.attachments.map((attachment) => (
          <div key={attachment.id} className="flex items-start gap-3 rounded-lg border p-3">
            <PaperclipIcon className="mt-0.5 size-4 text-muted-foreground" />
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{attachment.name}</span>
                <Badge variant="outline">{attachmentTypeLabels[attachment.type]}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{attachment.description}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function WorkflowTimeline({
  consultation,
  showDescription = true,
}: {
  consultation: Consultation
  showDescription?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>流程留痕</CardTitle>
        {showDescription && (
          <CardDescription>关键节点可追溯，便于运营监管和质控复盘</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {consultation.timeline.map((item) => (
          <div key={item.id} className="grid grid-cols-[auto_1fr] gap-3">
            <div className="mt-1 size-2 rounded-full bg-primary" />
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{item.label}</span>
                <StatusBadge status={item.status} />
              </div>
              <span className="text-xs text-muted-foreground">{item.at}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function CommunicationLog({
  consultation,
  showDescription = true,
}: {
  consultation: Consultation
  showDescription?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>沟通记录</CardTitle>
        {showDescription && (
          <CardDescription>医生与专家围绕本次会诊的业务沟通</CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {consultation.messages.map((message) => (
          <div key={message.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{messageRoleLabels[message.fromRole]}</Badge>
                <span className="text-sm font-medium">{message.fromName}</span>
              </div>
              <span className="text-xs text-muted-foreground">{message.createdAt}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{message.content}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function ConsultationRoom({ consultation }: { consultation: Consultation }) {
  return (
    <Card size="sm" className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <VideoIcon className="size-4 text-primary" />
          远程会诊间
        </CardTitle>
        <CardDescription>
          {consultation.patient.name} · {consultation.department} · {consultation.scheduledAt ?? "待确认"}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex min-h-64 flex-col justify-between rounded-xl border border-primary/15 bg-secondary/60 p-3">
          <div className="flex items-center justify-between">
            <Badge>
              <ActivityIcon data-icon="inline-start" />
              通话中 08:26
            </Badge>
            <Badge variant="secondary">远程会诊</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <VideoTile name="王医生" role="本地医生 / 陪同患者" />
            <VideoTile name="卢主任" role="乡贤专家 / 心内科" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Alert>
            <MessageSquareTextIcon className="size-4" />
            <AlertTitle>病历摘要</AlertTitle>
            <AlertDescription>{consultation.consultationPurpose}</AlertDescription>
          </Alert>
          <Alert>
            <PaperclipIcon className="size-4" />
            <AlertTitle>影像附件</AlertTitle>
            <AlertDescription>
              {consultation.attachments.length}份资料已上传，包含检查报告与影像截图。
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  )
}

export function AdvicePanel({
  consultation,
  showDescription = true,
}: {
  consultation: Consultation
  showDescription?: boolean
}) {
  const advice = consultation.expertAdvice

  if (!advice) {
    return (
      <Alert>
        <ClipboardListIcon className="size-4" />
        <AlertTitle>等待专家建议</AlertTitle>
        {showDescription && (
          <AlertDescription>专家提交后，医生端会进入确认处置环节。</AlertDescription>
        )}
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>远程会诊建议</CardTitle>
        {showDescription && (
          <CardDescription>专家仅提供参考建议，最终诊疗和处方由本地医生确认</CardDescription>
        )}
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <InfoItem label="倾向意见" value={advice.diagnosisSuggestion} icon={FileTextIcon} />
        <InfoItem label="检查建议" value={advice.examinationSuggestion} icon={CalendarClockIcon} />
        <InfoItem label="治疗参考" value={advice.treatmentSuggestion} icon={CheckCircle2Icon} />
        <InfoItem label="转诊建议" value={advice.referralSuggestion} icon={UserRoundIcon} />
        <InfoItem label="风险提示" value={advice.riskNotice} />
        <InfoItem label="随访建议" value={advice.followUpSuggestion} />
      </CardContent>
    </Card>
  )
}

function InfoItem({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon?: ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </div>
      <div className="text-sm leading-6">{value}</div>
    </div>
  )
}

function VideoTile({ name, role }: { name: string; role: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-lg border bg-card p-4 text-center shadow-sm">
      <Avatar size="lg">
        <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1">
        <span className="font-medium">{name}</span>
        <span className="text-sm text-muted-foreground">{role}</span>
      </div>
    </div>
  )
}
