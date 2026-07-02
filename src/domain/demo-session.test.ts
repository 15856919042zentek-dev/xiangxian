import { describe, expect, it } from "vitest"

import { createDemoSession, demoReducer, getDashboardStats } from "./demo-session"

describe("demo session reducer", () => {
  it("keeps doctor, expert, and admin views synchronized through the consultation path", () => {
    const initial = createDemoSession()
    expect(initial.activeConsultation.status).toBe("draft")
    expect(getDashboardStats(initial).draftCount).toBe(1)

    const submitted = demoReducer(initial, {
      type: "doctor.submitConsultation",
      input: {
        patient: initial.activeConsultation.patient,
        department: initial.activeConsultation.department,
        chiefComplaint: initial.activeConsultation.chiefComplaint,
        consultationPurpose: initial.activeConsultation.consultationPurpose,
        priority: initial.activeConsultation.priority,
        expertId: "expert-lu",
      },
    })
    expect(submitted.activeConsultation.status).toBe("pending_expert")

    const requested = demoReducer(submitted, {
      type: "expert.requestMoreInfo",
      input: {
        message: "请补充近期心电图和用药清单后再安排会诊。",
        requiredAttachmentTypes: ["ecg", "medication_list"],
      },
    })
    expect(requested.activeConsultation.status).toBe("needs_more_info")
    expect(requested.notifications.at(-1)?.audience).toBe("doctor")

    const supplemented = demoReducer(requested, {
      type: "doctor.addSupplement",
      input: {
        note: "已补充心电图和近期用药清单。",
        attachments: [
          {
            type: "ecg",
            name: "十二导联心电图.jpg",
            description: "补充心电图。",
          },
          {
            type: "medication_list",
            name: "近期用药清单.pdf",
            description: "补充用药清单。",
          },
        ],
      },
    })
    expect(supplemented.activeConsultation.attachments.map((item) => item.type)).toContain("ecg")
    expect(supplemented.activeConsultation.status).toBe("pending_expert")

    const accepted = demoReducer(supplemented, {
      type: "expert.accept",
      input: {
        expertId: "expert-lu",
        scheduledAt: "今日 09:30",
      },
    })
    const inRoom = demoReducer(accepted, { type: "doctor.startRoom" })
    const advised = demoReducer(inRoom, {
      type: "expert.submitAdvice",
      input: {
        diagnosisSuggestion: "考虑稳定型心绞痛可能。",
        examinationSuggestion: "建议复查心电图和心肌酶。",
        treatmentSuggestion: "由本地医生结合现场情况调整治疗。",
        referralSuggestion: "指标异常时建议上转。",
        riskNotice: "持续胸痛立即急诊。",
        followUpSuggestion: "一周后复诊。",
      },
    })
    const confirmed = demoReducer(advised, {
      type: "doctor.confirmDisposition",
      input: {
        adopted: "partial",
        note: "采纳检查建议，处方由本地医生结合现场情况开具。",
      },
    })
    const archived = demoReducer(confirmed, { type: "admin.archive" })

    expect(archived.activeConsultation.status).toBe("archived")
    expect(getDashboardStats(archived).archivedCount).toBe(1)
    expect(archived.notifications.map((item) => item.audience)).toContain("admin")
    expect(archived.operationLogs.at(-1)?.action).toBe("archive")
  })
})
