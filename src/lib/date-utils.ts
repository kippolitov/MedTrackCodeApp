import {
  startOfDay,
  endOfDay,
  isSameDay,
  differenceInCalendarWeeks,
  parseISO,
} from 'date-fns'

export function startOfLocalDay(d: Date): Date {
  return startOfDay(d)
}

export function endOfLocalDay(d: Date): Date {
  return endOfDay(d)
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return isSameDay(a, b)
}

export function weeksBetween(start: Date, end: Date): number {
  return Math.abs(differenceInCalendarWeeks(end, start))
}

export function parseISOLocal(iso: string): Date {
  return parseISO(iso)
}
