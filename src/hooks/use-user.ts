import { useEffect, useState } from 'react'
import { getContext } from '@microsoft/power-apps/app'

export function useUser() {
  const [fullName, setFullName] = useState<string | null>(null)

  useEffect(() => {
    getContext().then((ctx) => {
      setFullName(ctx.user.fullName ?? null)
    }).catch(() => {
      // Context unavailable outside Power Apps runtime (e.g. local dev)
    })
  }, [])

  const firstName = fullName?.split(' ')[0] ?? null

  return { fullName, firstName }
}
