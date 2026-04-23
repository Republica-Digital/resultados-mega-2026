import { Users } from 'lucide-react'
import { SectionHeader, EmptyState } from '../ui/SectionHeader'
import { ChartCard, ComparisonBarChart } from '../ui/Charts'
import { ObservacionesCard } from '../ui/ObservacionesCard'
import { DataTable } from '../ui/DataTable'
import { safeNumber, formatNumber } from '../../utils/format'

const ACCENT = '#a78bfa'
const RED_COLORS = {
  facebook: '#3b82f6',
  instagram: '#ec4899',
  tiktok: '#22d3ee',
}

export function CompetenciaSection({ data = [], observaciones, loading }) {
  if (loading) {
    return <div className="rounded-2xl skeleton h-96" />
  }

  if (!data?.length) {
    return (
      <div className="space-y-6">
        <SectionHeader icon={Users} title="Competencia" subtitle="Sin datos para este mes" accentColor={ACCENT} />
        <EmptyState icon={Users} title="Sin análisis competitivo" message="No hay datos de competidores registrados para este mes." />
      </div>
    )
  }

  const redes = [...new Set(data.map(d => d.red).filter(Boolean))]

  return (
    <div className="space-y-6">
      <SectionHeader icon={Users} title="Competencia" subtitle="Análisis del entorno competitivo" accentColor={ACCENT} />

      {redes.map((red, idx) => {
        const subset = data.filter(d => d.red === red)
        const chartData = subset.map(s => ({
          name: s.competidor,
          Seguidores: safeNumber(s.seguidores),
        }))

        return (
          <ChartCard
            key={red}
            title={`Competencia en ${red.charAt(0).toUpperCase() + red.slice(1)}`}
            subtitle={`${subset.length} competidores monitoreados`}
            delay={idx}
          >
            {({ scale, expanded }) => (
              <div className="space-y-5">
                <ComparisonBarChart
                  data={chartData}
                  scale={scale}
                  expanded={expanded}
                  bars={[{ key: 'Seguidores', name: 'Seguidores', color: RED_COLORS[red] || ACCENT }]}
                />
                <DataTable
                  columns={[
                    { key: 'competidor', label: 'Competidor', bold: true },
                    { key: 'seguidores', label: 'Seguidores', align: 'right', render: v => formatNumber(v) },
                    {
                      key: 'variacion_pct', label: 'Variación', align: 'right',
                      render: v => {
                        const num = parseFloat(v)
                        if (isNaN(num)) return '-'
                        const pct = num * 100
                        return (
                          <span className={pct >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                            {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                          </span>
                        )
                      }
                    },
                    { key: 'posts', label: 'Posts', align: 'right', render: v => formatNumber(v) },
                    {
                      key: 'engagement_pct', label: 'Engagement', align: 'right',
                      render: v => {
                        const num = parseFloat(v)
                        if (isNaN(num)) return '-'
                        return `${(num * 100).toFixed(2)}%`
                      }
                    },
                  ]}
                  data={subset}
                />
              </div>
            )}
          </ChartCard>
        )
      })}

      {observaciones && <ObservacionesCard observacion={observaciones} accentColor={ACCENT} />}
    </div>
  )
}
