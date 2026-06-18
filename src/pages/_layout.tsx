import { Outlet, NavLink } from "react-router-dom"
import { Home, Pill, CalendarDays, BarChart2 } from "lucide-react"

type LayoutProps = { showHeader?: boolean }

export default function Layout({ showHeader = true }: LayoutProps) {
  const navItems = [
    { to: "/", label: "Home", Icon: Home, end: true },
    { to: "/medications", label: "Medications", Icon: Pill, end: false },
    { to: "/calendar", label: "Calendar", Icon: CalendarDays, end: false },
    { to: "/analytics", label: "Analytics", Icon: BarChart2, end: false },
  ]

  return (
    <div className="min-h-dvh flex">
      {/* Tablet sidebar (≥ 768 px) */}
      <aside className="hidden md:flex flex-col w-16 lg:w-56 border-r shrink-0">
        <div className="p-4 hidden lg:block">
          <span className="font-semibold text-sm">MedTrack</span>
        </div>
        <nav className="flex flex-col gap-1 px-2 py-4 flex-1">
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`
              }
              aria-label={label}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="hidden lg:block">{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {showHeader && (
          <header className="h-14 border-b flex items-center px-4">
            <span className="font-semibold text-sm">MedTrack</span>
          </header>
        )}

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom nav (< 768 px) */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t bg-background flex items-center"
          aria-label="Main navigation"
        >
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-xs transition-colors ${
                  isActive ? "text-primary font-semibold" : "text-muted-foreground"
                }`
              }
              aria-label={label}
            >
              {({ isActive }) => (
                <>
                  <span className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors ${isActive ? "bg-primary/15" : ""}`}>
                    <Icon className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`} aria-hidden="true" />
                  </span>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
