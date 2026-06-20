import { lazy, Suspense, type ReactNode } from "react"
import { createBrowserRouter } from "react-router-dom"
import Layout from "@/pages/_layout"
import HomePage from "@/pages/home"
import NotFoundPage from "@/pages/not-found"

const MedicationsPage = lazy(() => import("@/pages/medications"))
const CalendarPage = lazy(() => import("@/pages/calendar"))
const AnalyticsPage = lazy(() => import("@/pages/analytics"))

function PageLoader({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" />
      </div>
    }>
      {children}
    </Suspense>
  )
}

// IMPORTANT: Do not remove or modify the code below!
// Normalize basename when hosted in Power Apps
const BASENAME = new URL(".", location.href).pathname
if (location.pathname.endsWith("/index.html")) {
  history.replaceState(null, "", BASENAME + location.search + location.hash);
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout showHeader={false} />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "medications",
        element: <PageLoader><MedicationsPage /></PageLoader>,
      },
      {
        path: "calendar",
        element: <PageLoader><CalendarPage /></PageLoader>,
      },
      {
        path: "analytics",
        element: <PageLoader><AnalyticsPage /></PageLoader>,
      },
    ],
  },
], {
  basename: BASENAME // IMPORTANT: Set basename for proper routing when hosted in Power Apps
})
