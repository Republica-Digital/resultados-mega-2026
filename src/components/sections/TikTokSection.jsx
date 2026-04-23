import { useMemo } from 'react'
import { Music2, Users, Eye, Heart, TrendingUp, Megaphone, Play } from 'lucide-react'
import { KPICard, KPICardSkeleton } from '../ui/KPICard'
import { SectionHeader, EmptyState } from '../ui/SectionHeader'
import { ChartCard, TrendLineChart } from '../ui/Charts'
import { ObservacionesCard } from '../ui/ObservacionesCard'
import { TopPostsSection } from '../ui/PostCard'
import { DataTable } from '../ui/DataTable'
import { CampaignToggle } from '../ui/CampaignToggle'
import { safeNumber, formatNumber, formatCurrency } from '../../utils/format'
import {
  filterCampaignsByBucket, aggregateCampaignMetrics,
} from '../../utils/campaigns'

const ACCENT = '#22d3ee'

export function TikTokSection({
  data, campanas = [], topPosts = [], observaciones, historical = [], loading,
  bucket = 'mensual', setBucket, availableBuckets = [],
}) {
  const relevantCampaigns = useMemo(
    () => (campanas || []).filter(c => (c._platform || c.plataforma) === 'tiktok'),
    [campanas]
  )
  const bucketCampaigns  = useMemo(() => filterCampaignsByBucket(relevantCampaigns, bucket), [relevantCampaigns, bucket])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <KPICardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <SectionHeader icon={Music2} title="TikTok" subtitle="Sin datos para este mes" accentColor={ACCENT} />
        <EmptyState icon={Music2} title="Sin datos disponibles" message="No hay información registrada para TikTok en el mes seleccionado." />
      </div>
    )
  }

  // KPI derivation per bucket — generalized (AON = total - todos los extras)
  const sumFromCampaigns = (cs, key) => cs.reduce((a, c) => a + safeNumber(c[key]), 0)
  const nonMensualCampaigns = relevantCampaigns.filter(c => (c._bucket || 'mensual') !== 'mensual')

  let kpiInteracciones, kpiInversion, kpiViews, kpiPublicaciones
  if (bucket === 'mensual') {
    const extraInt = sumFromCampaigns(nonMensualCampaigns, 'resultado')
    const extraInv = sumFromCampaigns(nonMensualCampaigns, 'inversion')
    kpiInteracciones = Math.max(0, safeNumber(data.interacciones) - extraInt)
    kpiInversion     = Math.max(0, safeNumber(data.inversion)     - extraInv)
    kpiViews         = safeNumber(data.views)
    kpiPublicaciones = safeNumber(data.publicaciones)
  } else {
    const agg = aggregateCampaignMetrics(bucketCampaigns)
    kpiInteracciones = agg.resultado
    kpiInversion     = agg.inversion
    kpiViews         = safeNumber(data.views)
    kpiPublicaciones = bucketCampaigns.length
  }

  const engagement = (safeNumber(data.engagement_rate) * 100).toFixed(2)

  const trendData = (historical || [])
    .filter(r => r.mes)
    .sort((a, b) => String(a.mes).localeCompare(String(b.mes)))
    .slice(-6)
    .map(r => ({ mes: r.mes, Seguidores: safeNumber(r.seguidores), Views: safeNumber(r.views), Interacciones: safeNumber(r.interacciones) }))

  return (
    <div className="space-y-6">
      <SectionHeader icon={Music2} title="TikTok" subtitle="Métricas de video corto" accentColor={ACCENT} />

      <CampaignToggle buckets={availableBuckets} selected={bucket} onChange={setBucket} accentColor={ACCENT} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Seguidores" value={safeNumber(data.seguidores)} icon={Users} accentColor={ACCENT} delay={0} />
        <KPICard title="Views" value={kpiViews} icon={Play} accentColor="#ec4899" delay={1} />
        <KPICard title="Views 6s+" value={safeNumber(data.views_6s)} icon={Eye} accentColor="#a78bfa" delay={2} />
        <KPICard title="Interacciones" value={kpiInteracciones} icon={Heart} accentColor="#f43f5e" delay={3} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Engagement" value={engagement} suffix="%" icon={TrendingUp} accentColor="#22c55e" formatter={v => v} delay={4} />
        <KPICard title="Nuevos Seguidores" value={safeNumber(data.nuevos_seguidores)} icon={Users} accentColor={ACCENT} delay={5} />
        <KPICard title={bucket === 'mensual' ? 'Publicaciones' : 'Campañas'} value={kpiPublicaciones} icon={Megaphone} accentColor="#a78bfa" delay={6} />
        <KPICard title="Inversión" value={kpiInversion} icon={Megaphone} accentColor="#f59e0b" formatter={v => formatCurrency(v)} delay={7} />
      </div>

      {trendData.length > 1 && (
        <ChartCard title="Tendencia Histórica" subtitle="Últimos 6 meses">
          {({ scale, expanded }) => (
            <TrendLineChart
              data={trendData}
              scale={scale}
              expanded={expanded}
              lines={[
                { key: 'Seguidores',    name: 'Seguidores',    color: ACCENT },
                { key: 'Views',         name: 'Views',         color: '#ec4899' },
                { key: 'Interacciones', name: 'Interacciones', color: '#f43f5e' },
              ]}
            />
          )}
        </ChartCard>
      )}

      {bucketCampaigns.length > 0 && (
        <ChartCard title="Desglose por Objetivo" subtitle={bucket === 'mensual' ? 'Campañas mensuales' : 'Resultados de la campaña'} allowLogScale={false}>
          <DataTable
            columns={[
              { key: '_objective', label: 'Objetivo', bold: true },
              { key: 'resultado',  label: 'Resultado',  align: 'right', render: v => formatNumber(v) },
              { key: 'meta',       label: 'Meta',       align: 'right', render: v => formatNumber(v) },
              {
                key: 'variacion_pct', label: 'Variación', align: 'right',
                render: (_, r) => {
                  const meta = safeNumber(r.meta); const res = safeNumber(r.resultado)
                  if (!meta) return '-'
                  const pct = ((res / meta) - 1) * 100
                  const col = pct >= 0 ? 'text-emerald-300' : 'text-red-300'
                  return <span className={col}>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</span>
                }
              },
              { key: 'inversion',  label: 'Inversión',  align: 'right', render: v => formatCurrency(v) },
            ]}
            data={bucketCampaigns}
          />
        </ChartCard>
      )}

      <TopPostsSection posts={topPosts} platform="tiktok" />
      {observaciones && <ObservacionesCard observacion={observaciones} accentColor={ACCENT} />}
    </div>
  )
}
