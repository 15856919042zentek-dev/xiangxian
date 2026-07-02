import { describe, expect, it } from "vitest"

import {
  createDemoSession,
  demoReducer,
  restoreDemoSession,
  serializeDemoSession,
} from "./demo-session"

describe("demo session persistence", () => {
  it("round-trips a progressed consultation session", () => {
    const progressed = demoReducer(
      demoReducer(createDemoSession(), {
        type: "doctor.submitConsultation",
        input: {
          patient: createDemoSession().activeConsultation.patient,
          department: "心血管内科",
          chiefComplaint: "间断胸闷胸痛。",
          consultationPurpose: "请专家协助判断是否需要上转。",
          priority: "normal",
          expertId: "expert-lu",
        },
      }),
      {
        type: "expert.requestMoreInfo",
        input: {
          message: "请补充近期心电图和用药清单后再安排会诊。",
          requiredAttachmentTypes: ["ecg", "medication_list"],
        },
      },
    )

    const restored = restoreDemoSession(serializeDemoSession(progressed))

    expect(restored.activeConsultation.status).toBe("needs_more_info")
    expect(restored.notifications.at(-1)?.title).toBe("专家要求补充资料")
  })

  it("falls back to a fresh session when saved data is invalid", () => {
    const restored = restoreDemoSession("{not-json")

    expect(restored.activeConsultation.status).toBe("draft")
    expect(restored.notifications).toEqual([])
  })
})
