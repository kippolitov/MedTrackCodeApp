import { lazy, Suspense } from "react"
import { createBrowserRouter } from "react-router-dom"
import Layout from "@/pages/_layout"
import HomePage from "@/pages/home"
import NotFoundPage from "@/pages/not-found"

const MedicationsPage = lazy(() => import("@/pages/medications"))
const CalendarPage = lazy(() => import("@/pages/calendar"))
const AnalyticsPage = lazy(() => import("@/pages/analytics"))

const pageFallback = (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" />
  </div>
)

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
        element: <Suspense fallback={pageFallback}><MedicationsPage /></Suspense>,
      },
      {
        path: "calendar",
        element: <Suspense fallback={pageFallback}><CalendarPage /></Suspense>,
      },
      {
        path: "analytics",
        element: <Suspense fallback={pageFallback}><AnalyticsPage /></Suspense>,
      },
    ],
  },
], {
  basename: BASENAME // IMPORTANT: Set basename for proper routing when hosted in Power Apps
})
