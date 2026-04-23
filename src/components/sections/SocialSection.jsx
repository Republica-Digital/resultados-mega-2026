import { useMemo } from 'react'
import { Facebook, Instagram, Users, Eye, Heart, TrendingUp, Megaphone } from 'lucide-react'
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

const PLATFORM_CONFIG = {
  facebook:  { icon: Facebook,  accent: '#3b82f6', label: 'Facebook' },
  instagram: { icon: Instagram, accent: '#ec4899', label: 'Instagram' },
}

export function SocialSection({
  platform, data, campanas = [], topPosts = [], observaciones, historical = [], loading, theme,
  bucket = 'mensual', setBucket, availableBuckets = [],
}) {
  const cfg = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.facebook

  // Campaigns whose derived platform matches this section
  const relevantCampaigns = useMemo(
    () => (campanas || []).filter(c => (c._platform || c.plataforma) === platform),
    [campanas, platform]
  )

  const bucketCampaigns = useMemo(
    () => filterCampaignsByBucket(relevantCampaigns, bucket),
    [relevantCampaigns, bucket]
  )

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
        <SectionHeader icon={cfg.icon} title={cfg.label} subtitle="Sin datos para este mes" accentColor={cfg.accent} />
        <EmptyState icon={cfg.icon} title="Sin datos disponibles" message="No hay información registrada para esta plataforma en el mes seleccionado." />
      </div>
    )
  }

  // ── KPI derivation per bucket ─────────────────────────────────────────────
  // For "mensual" (AON): show monthly total MINUS the sum of all other buckets
  //                      (mundial + pal_norte + any custom extra).
  // For other buckets: aggregates come from the matching campaigns only.
  const sumFromCampaigns = (cs, key) => cs.reduce((a, c) => a + safeNumber(c[key]), 0)

  // All non-"mensual" campaigns (everything that is NOT AON)
  const nonMensualCampaigns = relevantCampaigns.filter(c => (c._bucket || 'mensual') !== 'mensual')

  let kpiInteracciones, kpiInversion, kpiAlcance, kpiPublicaciones
  if (bucket === 'mensual') {
    const extraInt = sumFromCampaigns(nonMensualCampaigns, 'resultado')
    const extraInv = sumFromCampaigns(nonMensualCampaigns, 'inversion')
    kpiInteracciones = Math.max(0, safeNumber(data.interacciones) - extraInt)
    kpiInversion     = Math.max(0, safeNumber(data.inversion)     - extraInv)
    kpiAlcance       = safeNumber(data.alcance)
    kpiPublicaciones = safeNumber(data.publicaciones)
  } else {
    const agg = aggregateCampaignMetrics(bucketCampaigns)
    kpiInteracciones = agg.resultado
    kpiInversion     = agg.inversion
    kpiAlcance       = safeNumber(data.alcance)
    kpiPublicaciones = bucketCampaigns.length
  }

  const engagement = (safeNumber(data.engagement_rate) * 100).toFixed(2)

  // Historical trend (always full series, unfiltered)
  const trendData = (historical || [])
    .filter(r => r.mes)
    .sort((a, b) => String(a.mes).localeCompare(String(b.mes)))
    .slice(-6)
    .map(r => ({ mes: r.mes, Seguidores: safeNumber(r.seguidores), Alcance: safeNumber(r.alcance), Interacciones: safeNumber(r.interacciones) }))

  return (
    <div className="space-y-6">
      <SectionHeader icon={cfg.icon} title={cfg.label} subtitle="Métricas de desempeño" accentColor={cfg.accent} />

      {/* Bucket filter */}
      <CampaignToggle
        buckets={availableBuckets}
        selected={bucket}
        onChange={setBucket}
        accentColor={cfg.accent}
      />

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Seguidores" value={safeNumber(data.seguidores)} icon={Users} accentColor={cfg.accent} delay={0} />
        <KPICard title={bucket === 'mensual' ? 'Alcance' : 'Alcance (Mes)'} value={kpiAlcance} icon={Eye} accentColor="#22d3ee" delay={1} />
        <KPICard title="Interacciones" value={kpiInteracciones} icon={Heart} accentColor="#ec4899" delay={2} />
        <KPICard title="Engagement" value={engagement} suffix="%" icon={TrendingUp} accentColor="#22c55e" delay={3} formatter={v => v} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Nuevos Seguidores" value={safeNumber(data.nuevos_seguidores)} icon={Users} accentColor={cfg.accent} delay={4} />
        <KPICard title={bucket === 'mensual' ? 'Publicaciones' : 'Campañas'} value={kpiPublicaciones} icon={Megaphone} accentColor="#a78bfa" delay={5} />
        <KPICard title="Inversión" value={kpiInversion} icon={Megaphone} accentColor="#f59e0b" formatter={v => formatCurrency(v)} delay={6} />
        <KPICard title="Impresiones" value={safeNumber(data.impresiones)} icon={Eye} accentColor="#22d3ee" delay={7} />
      </div>

      {/* Historical trend */}
      {trendData.length > 1 && (
        <ChartCard title="Tendencia Histórica" subtitle="Últimos 6 meses">
          {({ scale, expanded }) => (
            <TrendLineChart
              data={trendData}
              scale={scale}
              expanded={expanded}
              lines={[
                { key: 'Seguidores',    name: 'Seguidores',    color: cfg.accent },
                { key: 'Alcance',       name: 'Alcance',       color: '#22d3ee' },
                { key: 'Interacciones', name: 'Interacciones', color: '#ec4899' },
              ]}
            />
          )}
        </ChartCard>
      )}

      {/* Campaign table — split by objective */}
      {bucketCampaigns.length > 0 && (
        <ChartCard
          title="Desglose por Objetivo"
          subtitle={bucket === 'mensual' ? 'Campañas mensuales' : 'Resultados de la campaña'}
          allowLogScale={false}
        >
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

      {/* Top Posts (unfiltered by bucket — tops are monthly regardless) */}
      <TopPostsSection posts={topPosts} platform={platform} />

      {observaciones && <ObservacionesCard observacion={observaciones} accentColor={cfg.accent} />}
    </div>
  )
}
