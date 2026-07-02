import type { Consultation, ConsultationStatus, ExpertProfile, User } from "@/domain/types"

export const demoUsers: User[] = [
  {
    id: "doctor-wang",
    name: "王医生",
    role: "doctor",
    orgName: "蒙城县中医院",
    department: "全科门诊",
    title: "主治医师",
    avatarInitials: "王",
  },
  {
    id: "expert-lu",
    name: "卢主任",
    role: "expert",
    orgName: "安徽省立医院",
    department: "心血管内科",
    title: "主任医师",
    avatarInitials: "卢",
  },
  {
    id: "admin-he",
    name: "何管理员",
    role: "admin",
    orgName: "项目运营中心",
    department: "远程问诊运营",
    title: "运营负责人",
    avatarInitials: "何",
  },
]

export const demoExperts: ExpertProfile[] = [
  {
    id: "expert-lu",
    name: "卢主任",
    hospital: "安徽省立医院",
    department: "心血管内科",
    title: "主任医师",
    specialties: ["胸痛评估", "冠心病", "高血压慢病管理"],
    status: "available",
    slots: ["今日 09:30", "今日 15:00", "明日 19:30"],
    hometownTag: "蒙城籍乡贤专家",
  },
  {
    id: "expert-chen",
    name: "陈医生",
    hospital: "上海中医药大学附属医院",
    department: "中医内科",
    title: "副主任医师",
    specialties: ["舌象辨证", "慢病调理", "中西医结合"],
    status: "busy",
    slots: ["明日 10:00", "周五 20:00"],
    hometownTag: "乡贤推荐专家",
  },
]

export function seedConsultation(
  overrides: Partial<Pick<Consultation, "status" | "expertId">> = {},
): Consultation {
  const status: ConsultationStatus = overrides.status ?? "draft"

  return {
    id: "consult-20260712-001",
    status,
    patient: {
      id: "patient-zhao",
      name: "赵某某",
      gender: "男",
      age: 67,
      phoneMasked: "138****2635",
      idNoMasked: "342622********2718",
      allergyHistory: "青霉素过敏",
      pastHistory: "高血压 12 年，2 型糖尿病 6 年，长期服用降压药。",
    },
    localDoctorId: "doctor-wang",
    expertId: overrides.expertId,
    department: "心血管内科",
    chiefComplaint: "间断胸闷胸痛 3 天，活动后明显。",
    consultationPurpose: "请乡贤专家协助判断是否需要上转，并给出检查和治疗建议。",
    priority: "normal",
    createdAt: "2026-07-12T08:20:00+08:00",
    attachments: [
      {
        id: "att-lab",
        type: "lab_report",
        name: "血常规与生化检查报告.pdf",
        uploadedBy: "doctor-wang",
        uploadedAt: "2026-07-12T08:26:00+08:00",
        description: "本地医院当日检验报告，肌钙蛋白待复查。",
      },
      {
        id: "att-image",
        type: "imaging",
        name: "胸部 CT 关键截图.jpg",
        uploadedBy: "doctor-wang",
        uploadedAt: "2026-07-12T08:28:00+08:00",
        description: "影像关键层面截图，供专家快速预览。",
      },
    ],
    messages: [
      {
        id: "msg-1",
        fromRole: "doctor",
        fromName: "王医生",
        content: "患者本人在诊室，已完成线下接诊和知情告知。",
        createdAt: "2026-07-12T08:32:00+08:00",
      },
    ],
    timeline: [
      {
        id: "created",
        status,
        label: status === "draft" ? "医生创建草稿" : "医生提交会诊申请",
        at: "2026-07-12T08:20:00+08:00",
      },
    ],
    requiredAttachmentTypes: [],
  }
}
