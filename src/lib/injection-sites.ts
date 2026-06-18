import type { Ppa_intakelogs } from '@/generated/models/Ppa_intakelogsModel'
import type { Ppa_intakelogsppa_injectionsite } from '@/generated/models/Ppa_intakelogsModel'

export const INJECTION_SITES: Ppa_intakelogsppa_injectionsite[] = [
  894250000, // RightHip
  894250001, // LeftHip
  894250002, // AbdominalRight
  894250003, // AbdominalCenter
  894250004, // AbdominalLeft
]

const SITE_LABELS: Record<Ppa_intakelogsppa_injectionsite, string> = {
  894250000: 'Right Hip',
  894250001: 'Left Hip',
  894250002: 'Abdominal Right',
  894250003: 'Abdominal Center',
  894250004: 'Abdominal Left',
}

export function getSiteLabel(site: Ppa_intakelogsppa_injectionsite): string {
  return SITE_LABELS[site]
}

export function getRecentSites(
  logs: Ppa_intakelogs[],
  now: Date
): Ppa_intakelogsppa_injectionsite[] {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const sites = new Set<Ppa_intakelogsppa_injectionsite>()

  for (const log of logs) {
    if (log.ppa_injectionsite == null) continue
    const logDate = new Date(log.ppa_loggedat)
    if (logDate >= sevenDaysAgo && logDate <= now) {
      sites.add(log.ppa_injectionsite)
    }
  }

  return Array.from(sites)
}
