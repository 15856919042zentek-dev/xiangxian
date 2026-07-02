import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

describe("Vercel SPA routing", () => {
  it("serves React routes from the Vite index document", () => {
    const configPath = join(process.cwd(), "vercel.json")

    expect(existsSync(configPath)).toBe(true)

    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      rewrites?: Array<{ source: string; destination: string }>
    }

    const expectedSources = [
      "/home",
      "/home/:path*",
      "/doctor",
      "/doctor/:path*",
      "/admin",
      "/admin/:path*",
      "/expert",
      "/expert/:path*",
    ]

    expect(config.rewrites).toEqual(
      expectedSources.map((source) => ({
        source,
        destination: "/index.html",
      })),
    )
  })
})
