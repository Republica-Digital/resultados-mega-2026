import { Megaphone, Eye, MousePointerClick, DollarSign, TrendingUp, Film } from 'lucide-react'
import { KPICard, KPICardSkeleton } from '../ui/KPICard'
import { SectionHeader, EmptyState } from '../ui/SectionHeader'
import { ChartCard, DistributionDonut } from '../ui/Charts'
import { ObservacionesCard } from '../ui/ObservacionesCard'
import { DataTable } from '../ui/DataTable'
import { safeNumber, formatNumber, formatCurrency, formatDecimal } from '../../utils/format'
import { getGoogleObjective } from '../../utils/campaigns'

const ACCENT = '#f59e0b'

// Classify each row as 'Video' or 'Display' (accepts both tipo_red and tipo_objetivo)
function classifyRow(row) {
  const tipoValue = row.tipo_objetivo || row.tipo_red
  const obj = getGoogleObjective(tipoValue)
  return { ...row, _obj: obj || tipoValue || '—' }
}

// For Display rows the "result" metric shown is impresiones_visibles.
// For Video rows it's views (visualizaciones). CPR = inversion / resultado.
function getRowResult(row) {
  if (row._obj === 'Display') return safeNumber(row.impresiones_visibles) || safeNumber(row.impresiones)
  if (row._obj === 'Video')   return safeNumber(row.views)
  return safeNumber(row.impresiones)
}
function getResultLabel(obj) {
  if (obj === 'Display') return 'Impresiones visibles'
  if (obj === 'Video')   return 'Visualizaciones'
  return 'Resultado'
}

export function GoogleAdsSection({ data = [], ciudades = [], keywords = [], observaciones, loading }) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <KPICardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (!data?.length) {
    return (
      <div className="space-y-6">
        <SectionHeader icon={Megaphone} title="Google Ads" subtitle="Sin datos para este mes" accentColor={ACCENT} />
        <EmptyState icon={Megaphone} title="Sin datos disponibles" message="No hay campañas de Google Ads en este mes." />
      </div>
    )
  }

  const rows = data.map(classifyRow)

  // ── Aggregate KPIs (totals across all campaigns for the month) ─────────────
  const totals = rows.reduce((acc, r) => ({
    views:                acc.views               + safeNumber(r.views),
    clics:                acc.clics               + safeNumber(r.clics),
    impresiones_visibles: acc.impresiones_visibles + safeNumber(r.impresiones_visibles),
    impresiones:          acc.impresiones         + safeNumber(r.impresiones),
    inversion:            acc.inversion           + safeNumber(r.inversion),
  }), { views: 0, clics: 0, impresiones_visibles: 0, impresiones: 0, inversion: 0 })

  // CTR = clics / impresiones (standard)
  const ctr = totals.impresiones > 0 ? (totals.clics / totals.impresiones) * 100 : 0

  // Donut distribution by objective
  const byObjective = {}
  rows.forEach(r => {
    byObjective[r._obj] = (byObjective[r._obj] || 0) + safeNumber(r.inversion)
  })
  const OBJ_COLORS = { Video: '#ef4444', Display: '#3b82f6', Search: '#22c55e' }
  const distribution = Object.entries(byObjective)
    .filter(([, v]) => v > 0)
    .map(([name, value], i) => ({
      name, value,
      color: OBJ_COLORS[name] || ['#a78bfa', '#22d3ee', '#f59e0b'][i % 3],
    }))

  return (
    <div className="space-y-6">
      <SectionHeader icon={Megaphone} title="Google Ads" subtitle="Performance de campañas pagadas" accentColor={ACCENT} />

      {/* KPI overview — Views / Clics / ImpVisibles / CTR */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Views Totales"           value={totals.views}                icon={Eye}              accentColor="#22d3ee" delay={0} />
        <KPICard title="Clics Totales"           value={totals.clics}                icon={MousePointerClick} accentColor="#3b82f6" delay={1} />
        <KPICard title="Imp. Visibles Totales"   value={totals.impresiones_visibles} icon={Eye}              accentColor="#a78bfa" delay={2} />
        <KPICard title="CTR%"                    value={ctr.toFixed(2)} suffix="%"   icon={TrendingUp}       accentColor="#22c55e" formatter={v => v} delay={3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {distribution.length > 0 && (
          <ChartCard title="Inversión por Objetivo" subtitle="Distribución del presupuesto" allowLogScale={false}>
            {({ expanded }) => (
              <DistributionDonut
                data={distribution}
                centerLabel="Total"
                centerValue={formatCurrency(totals.inversion)}
                expanded={expanded}
              />
            )}
          </ChartCard>
        )}

        <ChartCard
          title="Desglose por Objetivo"
          subtitle="Una fila por objetivo (Video / Display)"
          className={distribution.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}
          allowLogScale={false}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-white/10">
                  <th className="py-2 px-3 text-[11px] uppercase tracking-wider text-white/55 font-semibold">Objetivo</th>
                  <th className="py-2 px-3 text-[11px] uppercase tracking-wider text-white/55 font-semibold text-right">Resultado</th>
                  <th className="py-2 px-3 text-[11px] uppercase tracking-wider text-white/55 font-semibold text-right">CPR</th>
                  <th className="py-2 px-3 text-[11px] uppercase tracking-wider text-white/55 font-semibold text-right">VTR</th>
                  <th className="py-2 px-3 text-[11px] uppercase tracking-wider text-white/55 font-semibold text-right">Inversión</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const result = getRowResult(r)
                  const cpr = result > 0 ? safeNumber(r.inversion) / result : 0
                  const vtr = r._obj === 'Video' && safeNumber(r.views) > 0
                    ? (safeNumber(r.interacciones ?? 0) / safeNumber(r.views)) * 100
                    : null
                  const resultLabel = getResultLabel(r._obj)
                  return (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {r._obj === 'Video' ? (
                            <Film className="w-4 h-4 text-red-400" />
                          ) : (
                            <Eye className="w-4 h-4 text-blue-400" />
                          )}
                          <span className="text-sm font-semibold text-white">{r._obj}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="text-sm font-mono font-semibold text-white">{formatNumber(result)}</div>
                        <div className="text-[10px] text-white/45 mt-0.5">{resultLabel}</div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="text-sm font-mono text-white/90">${formatDecimal(cpr, 2)}</div>
                        <div className="text-[10px] text-white/45 mt-0.5">por resultado</div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {vtr !== null ? (
                          <>
                            <div className="text-sm font-mono text-emerald-300">{vtr.toFixed(2)}%</div>
                            <div className="text-[10px] text-white/45 mt-0.5">Interacción / Views</div>
                          </>
                        ) : (
                          <span className="text-white/30 text-sm">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="text-sm font-mono text-amber-300 font-semibold">{formatCurrency(r.inversion)}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {/* Top cities (kept for completeness) */}
      {ciudades.length > 0 && (
        <ChartCard title="Top Ciudades" subtitle="Concentración geográfica" allowLogScale={false}>
          <DataTable
            columns={[
              { key: 'ciudad',      label: 'Ciudad',      bold: true },
              { key: 'tipo_red',    label: 'Objetivo' },
              { key: 'impresiones', label: 'Impresiones', align: 'right', render: v => formatNumber(v) },
              { key: 'clics',       label: 'Clics',       align: 'right', render: v => formatNumber(v) },
              { key: 'inversion',   label: 'Inversión',   align: 'right', render: v => formatCurrency(v) },
            ]}
            data={ciudades}
          />
        </ChartCard>
      )}

      {keywords.length > 0 && (
        <ChartCard title="Top Keywords" subtitle="Términos de mayor performance" allowLogScale={false}>
          <DataTable
            columns={[
              { key: 'keyword',     label: 'Keyword',     bold: true },
              { key: 'impresiones', label: 'Impresiones', align: 'right', render: v => formatNumber(v) },
              { key: 'clics',       label: 'Clics',       align: 'right', render: v => formatNumber(v) },
              { key: 'ctr',         label: 'CTR',         align: 'right', render: v => v ? `${formatDecimal(v, 2)}%` : '-' },
              { key: 'cpc',         label: 'CPC',         align: 'right', render: v => v ? `$${formatDecimal(v, 2)}` : '-' },
              { key: 'inversion',   label: 'Inversión',   align: 'right', render: v => formatCurrency(v) },
            ]}
            data={keywords}
          />
        </ChartCard>
      )}

      {observaciones && <ObservacionesCard observacion={observaciones} accentColor={ACCENT} />}
    </div>
  )
}
