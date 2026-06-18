import { lazy, Suspense } from "react"
import { createBrowserRouter } from "react-router-dom"
import Layout from "@/pages/_layout"
import HomePage from "@/pages/home"
import NotFoundPage from "@/pages/not-found"

const MedicationsPage = lazy(() => import("@/pages/medications"))
const CalendarPage = lazy(() => import("@/pages/calendar"))
const AnalyticsPage = lazy(() => import("@/pages/analytics"))

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
        element: (
          <Suspense fallback={<div />}>
            <MedicationsPage />
          </Suspense>
        ),
      },
      {
        path: "calendar",
        element: (
          <Suspense fallback={<div />}>
            <CalendarPage />
          </Suspense>
        ),
      },
      {
        path: "analytics",
        element: (
          <Suspense fallback={<div />}>
            <AnalyticsPage />
          </Suspense>
        ),
      },
    ],
  },
], {
  basename: BASENAME // IMPORTANT: Set basename for proper routing when hosted in Power Apps
})
