import { useMemo } from 'react'
import { Music2, Users, Eye, Heart, TrendingUp, Megaphone, Play } from 'lucide-react'
import { KPICard, KPICardSkeleton } from '../ui/KPICard'
import { SectionHeader, EmptyState } from '../ui/SectionHeader'
import { ChartCard, TrendLineChart } from '../ui/Charts'
import { ObservacionesCard } from '../ui/ObservacionesCard'
import { TopPostsSection } from '../ui/PostCard'
import { safeNumber } from '../../utils/format'
import { PaidMediaSection } from './SocialSection'

const ACCENT = '#22d3ee'

export function TikTokSection({
  data, campanas = [], proyecciones = [], topPosts = [],
  observaciones, historical = [], loading,
}) {
  const activeMonth = data?.mes || null

  const monthProy = useMemo(
    () => proyecciones.filter(p => p.mes === activeMonth),
    [proyecciones, activeMonth]
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
        <SectionHeader icon={Music2} title="TikTok" subtitle="Sin datos para este mes" accentColor={ACCENT} />
        <EmptyState icon={Music2} title="Sin datos disponibles"
          message="No hay información registrada para TikTok en el mes seleccionado." />
      </div>
    )
  }

  const engagement = (safeNumber(data.engagement_rate) * 100).toFixed(2)

  const trendData = (historical || [])
    .filter(r => r.mes)
    .sort((a, b) => String(a.mes).localeCompare(String(b.mes)))
    .slice(-6)
    .map(r => ({
      mes: r.mes,
      Seguidores: safeNumber(r.seguidores),
      Views: safeNumber(r.views),
      Interacciones: safeNumber(r.interacciones),
    }))

  return (
    <div className="space-y-6">
      <SectionHeader icon={Music2} title="TikTok" subtitle="Métricas de video corto" accentColor={ACCENT} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Seguidores"       value={safeNumber(data.seguidores)}        icon={Users}      accentColor={ACCENT}     delay={0} />
        <KPICard title="Views"            value={safeNumber(data.views)}             icon={Play}       accentColor="#ec4899"    delay={1} />
        <KPICard title="Views 6s+"        value={safeNumber(data.views_6s)}          icon={Eye}        accentColor="#a78bfa"    delay={2} />
        <KPICard title="Interacciones"    value={safeNumber(data.interacciones)}     icon={Heart}      accentColor="#f43f5e"    delay={3} />
      </div>

      {[
        safeNumber(data.engagement_rate) > 0,
        safeNumber(data.nuevos_seguidores) > 0,
        safeNumber(data.publicaciones) > 0,
      ].some(Boolean) && (
        <div className="grid grid-cols-3 gap-4">
          {safeNumber(data.engagement_rate) > 0 && (
            <KPICard title="Engagement" value={engagement} suffix="%" icon={TrendingUp}
              accentColor="#22c55e" formatter={v => v} delay={4} />
          )}
          {safeNumber(data.nuevos_seguidores) > 0 && (
            <KPICard title="Nuevos Seguidores" value={safeNumber(data.nuevos_seguidores)}
              icon={Users} accentColor={ACCENT} delay={5} />
          )}
          {safeNumber(data.publicaciones) > 0 && (
            <KPICard title="Publicaciones" value={safeNumber(data.publicaciones)}
              icon={Megaphone} accentColor="#a78bfa" delay={6} />
          )}
        </div>
      )}

      {trendData.length > 1 && (
        <ChartCard title="Tendencia Histórica" subtitle="Últimos 6 meses">
          {({ scale, expanded }) => (
            <TrendLineChart data={trendData} scale={scale} expanded={expanded}
              lines={[
                { key: 'Seguidores',    name: 'Seguidores',    color: ACCENT },
                { key: 'Views',         name: 'Views',         color: '#ec4899' },
                { key: 'Interacciones', name: 'Interacciones', color: '#f43f5e' },
              ]}
            />
          )}
        </ChartCard>
      )}

      <PaidMediaSection
        platform="tiktok"
        month={activeMonth}
        campanas={campanas}
        proyecciones={monthProy}
        accent={ACCENT}
      />

      <TopPostsSection posts={topPosts} platform="tiktok" />
      {observaciones && <ObservacionesCard observacion={observaciones} accentColor={ACCENT} />}
    </div>
  )
}
