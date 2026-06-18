import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import type { AdherenceDataPoint } from '@/lib/adherence'

export interface AdherenceChartProps {
  data: AdherenceDataPoint[]
  isLoading: boolean
}

export default function AdherenceChart({ data, isLoading }: AdherenceChartProps) {
  if (isLoading) {
    return <Skeleton className="w-full h-64" />
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v: number) => [`${v}%`, 'Adherence']} />
        <Bar dataKey="adherencePercent" fill="#3b82f6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
