import type { Ppa_intakelogsppa_injectionsite } from '@/generated/models/Ppa_intakelogsModel'
import { INJECTION_SITES, getSiteLabel } from '@/lib/injection-sites'
import { cn } from '@/lib/utils'

// Dot positions as percentages of the SVG container (x%, y%)
const SITE_POSITIONS: Record<Ppa_intakelogsppa_injectionsite, { x: number; y: number }> = {
  894250000: { x: 62, y: 72 }, // Right Hip (anatomical right = visual left of figure)
  894250001: { x: 38, y: 72 }, // Left Hip
  894250002: { x: 58, y: 55 }, // Abdominal Right
  894250003: { x: 50, y: 55 }, // Abdominal Center
  894250004: { x: 42, y: 55 }, // Abdominal Left
}

interface BodyMapProps {
  recentSites: Ppa_intakelogsppa_injectionsite[]
  selectedSite: Ppa_intakelogsppa_injectionsite | undefined
  onSiteSelect: (site: Ppa_intakelogsppa_injectionsite | undefined) => void
}

export default function BodyMap({ recentSites, selectedSite, onSiteSelect }: BodyMapProps) {
  const recentSet = new Set(recentSites)

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Human silhouette SVG */}
      <div className="relative w-32 h-48 select-none">
        <svg
          viewBox="0 0 100 150"
          className="w-full h-full"
          aria-hidden="true"
        >
          {/* Simplified body outline */}
          <ellipse cx="50" cy="15" rx="12" ry="13" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4" />
          <rect x="34" y="27" width="32" height="45" rx="8" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4" />
          <rect x="20" y="28" width="12" height="38" rx="5" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4" />
          <rect x="68" y="28" width="12" height="38" rx="5" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4" />
          <rect x="34" y="72" width="14" height="50" rx="6" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4" />
          <rect x="52" y="72" width="14" height="50" rx="6" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4" />

          {/* Orange dots for recently-used sites (skip if also selected) */}
          {INJECTION_SITES.filter((s) => recentSet.has(s) && s !== selectedSite).map((site) => (
            <circle
              key={site}
              cx={SITE_POSITIONS[site].x}
              cy={SITE_POSITIONS[site].y}
              r="5"
              fill="orange"
              opacity="0.85"
              className="pointer-events-none"
            />
          ))}

          {/* Selected site indicator */}
          {selectedSite !== undefined && (
            <circle
              cx={SITE_POSITIONS[selectedSite].x}
              cy={SITE_POSITIONS[selectedSite].y}
              r="7"
              style={{ fill: 'var(--primary)', stroke: 'var(--background)', strokeWidth: 2 }}
              className="pointer-events-none"
            />
          )}
        </svg>
      </div>

      {/* Chip buttons — Row 1: hips, Row 2: abdominal */}
      <div className="flex flex-col items-center gap-2">
        {[INJECTION_SITES.slice(0, 2), INJECTION_SITES.slice(2)].map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-2">
            {row.map((site) => {
              const isSelected = selectedSite === site
              const isRecent = recentSet.has(site)
              const label = getSiteLabel(site) + (isRecent ? ' (recent)' : '')

              return (
                <button
                  key={site}
                  type="button"
                  onClick={() => onSiteSelect(isSelected ? undefined : site)}
                  aria-pressed={isSelected}
                  aria-label={label}
                  className={cn(
                    'min-h-[44px] px-4 py-2 rounded-full border text-sm font-medium transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-input hover:bg-muted'
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
