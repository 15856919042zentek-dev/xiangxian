import { describe, expect, it } from "vitest"

import {
  acceptConsultation,
  addSupplementalAttachments,
  archiveConsultation,
  completeExternalConsultation,
  completeConsultationAdvice,
  confirmDoctorDisposition,
  requestMoreInformation,
  startConsultation,
  submitConsultationApplication,
} from "./consultation-workflow"
import { seedConsultation } from "@/mock/seed-data"

describe("consultation workflow", () => {
  it("submits an editable consultation application for expert pre-review", () => {
    const draft = seedConsultation({ status: "draft" })

    const submitted = submitConsultationApplication(draft, {
      patient: {
        ...draft.patient,
        name: "赵某某",
        age: 68,
      },
      department: "心血管内科",
      chiefComplaint: "胸闷胸痛加重 1 天。",
      consultationPurpose: "请专家协助判断是否需要上转。",
      priority: "urgent",
      expertId: "expert-lu",
    })

    expect(submitted.status).toBe("pending_expert")
    expect(submitted.patient.age).toBe(68)
    expect(submitted.priority).toBe("urgent")
    expect(submitted.expertId).toBe("expert-lu")
  })

  it("moves a new consultation through expert request, scheduling, advice, doctor confirmation, and archive", () => {
    const pending = seedConsultation({ status: "pending_expert" })

    const scheduled = acceptConsultation(pending, {
      expertId: "expert-lu",
      scheduledAt: "2026-07-12T09:30:00+08:00",
    })
    expect(scheduled.status).toBe("scheduled")
    expect(scheduled.timeline.at(-1)?.label).toBe("专家已确认接诊")

    const inConsultation = startConsultation(scheduled)
    expect(inConsultation.status).toBe("in_consultation")

    const pendingDoctor = completeConsultationAdvice(inConsultation, {
      diagnosisSuggestion: "考虑稳定型心绞痛可能，建议结合心电图和心肌酶进一步判断。",
      examinationSuggestion: "补充十二导联心电图、心肌酶谱、血脂和血糖。",
      treatmentSuggestion: "如无禁忌，可由本地医生结合现场情况调整抗血小板和调脂治疗。",
      referralSuggestion: "如胸痛持续或心电图动态改变，建议转县医院胸痛中心。",
      riskNotice: "出现持续胸痛、出汗、濒死感时立即线下急诊。",
      followUpSuggestion: "一周后复诊，复核用药依从性和血压控制。",
    })
    expect(pendingDoctor.status).toBe("pending_doctor_confirm")
    expect(pendingDoctor.expertAdvice?.submittedBy).toBe("expert-lu")

    const completed = confirmDoctorDisposition(pendingDoctor, {
      adopted: "partial",
      note: "已采纳检查建议，处方由本地医生结合患者现场情况开具。",
    })
    expect(completed.status).toBe("completed")
    expect(completed.localDisposition?.adopted).toBe("partial")

    const archived = archiveConsultation(completed)
    expect(archived.status).toBe("archived")
    expect(archived.timeline.map((item) => item.status)).toContain("archived")
  })

  it("marks external consultation communication complete and waits for expert advice", () => {
    const consultation = seedConsultation({
      status: "scheduled",
      expertId: "expert-lu",
    })

    const completed = completeExternalConsultation(consultation)

    expect(completed.status).toBe("pending_advice")
    expect(completed.timeline.at(-1)?.label).toBe("外部会诊沟通完成")
  })

  it("lets an expert request additional materials before accepting", () => {
    const pending = seedConsultation({ status: "pending_expert" })

    const needsMoreInfo = requestMoreInformation(pending, {
      expertId: "expert-lu",
      expertName: "卢主任",
      message: "请补充近期心电图和用药清单后再安排会诊。",
      requiredAttachmentTypes: ["ecg", "medication_list"],
    })

    expect(needsMoreInfo.status).toBe("needs_more_info")
    expect(needsMoreInfo.messages.at(-1)?.content).toContain("心电图")
    expect(needsMoreInfo.requiredAttachmentTypes).toEqual([
      "ecg",
      "medication_list",
    ])

    const supplemented = addSupplementalAttachments(needsMoreInfo, {
      note: "已补充心电图和近期用药清单。",
      attachments: [
        {
          id: "att-ecg",
          type: "ecg",
          name: "十二导联心电图.jpg",
          uploadedBy: "doctor-wang",
          uploadedAt: "2026-07-12T09:00:00+08:00",
          description: "补充心电图。",
        },
        {
          id: "att-medication",
          type: "medication_list",
          name: "近期用药清单.pdf",
          uploadedBy: "doctor-wang",
          uploadedAt: "2026-07-12T09:00:00+08:00",
          description: "补充近期用药。",
        },
      ],
    })

    expect(supplemented.status).toBe("pending_expert")
    expect(supplemented.requiredAttachmentTypes).toEqual([])
    expect(supplemented.messages.at(-1)?.fromRole).toBe("doctor")
  })
})
