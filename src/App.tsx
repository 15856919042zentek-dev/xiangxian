import { useEffect, useMemo, useReducer } from "react"

import { AppShell } from "@/components/app-shell"
import { TooltipProvider } from "@/components/ui/tooltip"
import { demoReducer, restoreDemoSession, serializeDemoSession } from "@/domain/demo-session"
import { AdminView } from "@/features/admin/admin-view"
import { DoctorView } from "@/features/doctor/doctor-view"
import { ExpertView } from "@/features/expert/expert-view"
import { HomeView } from "@/features/home/home-view"

const SESSION_STORAGE_KEY = "xianxian-consultation-session"
const LEGACY_SESSION_STORAGE_KEY = "xianxian-demo-session"
type Route = "home" | "doctor" | "expert" | "admin"

function routeFromPath(pathname: string): Route {
  if (pathname === "/" || pathname.startsWith("/home")) return "home"
  if (pathname.startsWith("/doctor")) return "doctor"
  if (pathname.startsWith("/expert")) return "expert"
  if (pathname.startsWith("/admin")) return "admin"
  return "home"
}

function readStoredSession() {
  return (
    window.localStorage.getItem(SESSION_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_SESSION_STORAGE_KEY)
  )
}

function App() {
  const [session, dispatch] = useReducer(demoReducer, undefined, () =>
    restoreDemoSession(readStoredSession()),
  )
  const route = useMemo(() => routeFromPath(window.location.pathname), [])

  useEffect(() => {
    window.localStorage.setItem(SESSION_STORAGE_KEY, serializeDemoSession(session))
    window.localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY)
  }, [session])

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== SESSION_STORAGE_KEY) return

      dispatch({
        type: "session.restore",
        session: restoreDemoSession(event.newValue),
      })
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  return (
    <TooltipProvider>
      <AppShell route={route} session={session} dispatch={dispatch}>
        {route === "doctor" && <DoctorView session={session} dispatch={dispatch} />}
        {route === "expert" && <ExpertView session={session} dispatch={dispatch} />}
        {route === "admin" && <AdminView session={session} dispatch={dispatch} />}
        {route === "home" && <HomeView session={session} />}
      </AppShell>
    </TooltipProvider>
  )
}

export default App
