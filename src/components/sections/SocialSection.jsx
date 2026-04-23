import { useMemo, useState } from 'react'
import { Facebook, Instagram, Users, Eye, Heart, TrendingUp, Megaphone, DollarSign, BarChart2, ChevronDown, ChevronUp } from 'lucide-react'
import { KPICard, KPICardSkeleton } from '../ui/KPICard'
import { SectionHeader, EmptyState } from '../ui/SectionHeader'
import { ChartCard, TrendLineChart } from '../ui/Charts'
import { ObservacionesCard } from '../ui/ObservacionesCard'
import { TopPostsSection } from '../ui/PostCard'
import { DataTable } from '../ui/DataTable'
import { CampaignToggle } from '../ui/CampaignToggle'
import { safeNumber, formatNumber, formatCurrency } from '../../utils/format'
import { tipoCampanaToBucket, bucketToLabel } from '../../utils/campaigns'
 
const PLATFORM_CONFIG = {
  facebook:  { icon: Facebook,  accent: '#3b82f6', label: 'Facebook' },
  instagram: { icon: Instagram, accent: '#ec4899', label: 'Instagram' },
}
 
// ─────────────────────────────────────────────────────────────────────────────
// Helpers para Proyecciones
// ─────────────────────────────────────────────────────────────────────────────
 
// Filtra proyecciones por marca+mes+plataforma (ya vienen filtradas por marca desde el hook)
function filterProy(proyecciones, platform, month) {
  return proyecciones.filter(p =>
    String(p.plataforma || '').toLowerCase() === platform &&
    p.mes === month
  )
}
 
// Lista de grupos únicos presentes en las proyecciones
function getGroups(rows) {
  const seen = new Map()
  for (const r of rows) {
    const tipo = r.tipo_campana || 'AON'
    const key  = tipoCampanaToBucket(tipo)
    if (!seen.has(key)) seen.set(key, tipo)
  }
  // Ordenar: mensual primero
  const order = ['mensual']
  const others = [...seen.keys()].filter(k => k !== 'mensual').sort()
  return [...order, ...others]
    .filter(k => seen.has(k))
    .map(k => ({ key: k, label: bucketToLabel(k, seen.get(k)) }))
}
 
// Suma todos los 'real' de un grupo de filas de proyecciones
function sumReal(rows) {
  return rows.reduce((a, r) => a + safeNumber(r.real), 0)
}
 
// Suma inversión desde campañas para un tipo_campana dado
function sumInversion(campanas, platform, bucket) {
  return campanas
    .filter(c => {
      const cPlat   = String(c._platform || c.plataforma || '').toLowerCase()
      const cBucket = c._bucket || tipoCampanaToBucket(c.tipo_campana)
      return cPlat === platform && cBucket === bucket
    })
    .reduce((a, c) => a + safeNumber(c.inversion), 0)
}
 
// ─────────────────────────────────────────────────────────────────────────────
// PaidMediaSection
// ─────────────────────────────────────────────────────────────────────────────
function PaidMediaSection({ platform, month, campanas, proyecciones, accent }) {
  const [bucket, setBucket] = useState('mensual')
  const [open, setOpen]     = useState(false)
 
  // Proyecciones de esta plataforma y mes
  const platProy = useMemo(
    () => filterProy(proyecciones, platform, month),
    [proyecciones, platform, month]
  )
 
  // Inversión total del mes desde campañas (todas las de esta plataforma)
  const inversionTotal = useMemo(
    () => campanas
      .filter(c => String(c._platform || c.plataforma || '').toLowerCase() === platform)
      .reduce((a, c) => a + safeNumber(c.inversion), 0),
    [campanas, platform]
  )
 
  // Grupos disponibles
  const groups = useMemo(() => getGroups(platProy), [platProy])
 
  // Totales del mes (suma de todos los 'real')
  const totalReal = useMemo(() => sumReal(platProy), [platProy])
 
  // Filas del grupo seleccionado, ordenadas por resultado desc
  const groupRows = useMemo(
    () => platProy
        .filter(r => tipoCampanaToBucket(r.tipo_campana || 'AON') === bucket)
        .sort((a, b) => safeNumber(b.real) - safeNumber(a.real)),
    [platProy, bucket]
  )
 
  // Inversión del grupo seleccionado
  const groupInversion = useMemo(
    () => sumInversion(campanas, platform, bucket),
    [campanas, platform, bucket]
  )
 
  // Totales del grupo
  const groupReal = useMemo(() => sumReal(groupRows), [groupRows])
  const groupMeta = useMemo(
    () => groupRows.reduce((a, r) => a + safeNumber(r.meta), 0),
    [groupRows]
  )
 
  // Si no hay proyecciones ni campañas de esta plataforma, no renderizar
  if (platProy.length === 0 && inversionTotal === 0) return null
 
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${accent}33` }}>
      {/* Header colapsable */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        style={{ background: `${accent}14` }}
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ background: `${accent}25` }}>
            <BarChart2 className="w-4 h-4" style={{ color: accent }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Paid Media</p>
            <p className="text-[11px] text-white/50">
              {inversionTotal > 0 ? `${formatCurrency(inversionTotal)} inversión` : ''}
              {inversionTotal > 0 && totalReal > 0 ? ' · ' : ''}
              {totalReal > 0 ? `${formatNumber(totalReal)} resultados totales` : ''}
              {groups.length > 1 ? ` · ${groups.length} grupos` : ''}
            </p>
          </div>
        </div>
        <button className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          {open ? <ChevronUp className="w-4 h-4 text-white/60" /> : <ChevronDown className="w-4 h-4 text-white/60" />}
        </button>
      </div>
 
      {open && (
        <div className="p-5 space-y-6" style={{ background: 'rgba(0,0,0,0.28)' }}>
 
          {/* ── Totales del mes ── */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-3">
              Totales del mes
            </p>
            <div className="grid grid-cols-2 gap-3">
              {inversionTotal > 0 && (
                <KPICard title="Inversión Total" value={inversionTotal} icon={DollarSign} accentColor="#f59e0b" formatter={formatCurrency} delay={0} />
              )}
              {totalReal > 0 && (
                <KPICard title="Resultados Totales" value={totalReal} icon={Heart} accentColor="#ec4899" delay={1} />
              )}
            </div>
          </div>
 
          {/* ── Desglose por grupo ── */}
          {groups.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-3">
                Resultados por grupo
              </p>
 
              {/* Toggle solo si hay más de un grupo */}
              {groups.length > 1 && (
                <div className="mb-4">
                  <CampaignToggle
                    buckets={groups}
                    selected={bucket}
                    onChange={setBucket}
                    accentColor={accent}
                  />
                </div>
              )}
 
              {/* KPIs del grupo */}
              {(groupInversion > 0 || groupReal > 0) && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {groupInversion > 0 && (
                    <KPICard title="Inversión del Grupo" value={groupInversion} icon={DollarSign} accentColor="#f59e0b" formatter={formatCurrency} delay={0} />
                  )}
                  {groupReal > 0 && (
                    <KPICard title="Resultados del Grupo" value={groupReal} icon={Heart} accentColor="#ec4899" delay={1} />
                  )}
                </div>
              )}
 
              {/* Tabla objetivo por objetivo */}
              {groupRows.length > 0 && (
                <DataTable
                  columns={[
                    { key: 'objetivo', label: 'Objetivo', bold: true,
                      render: v => <span className="capitalize">{v || '—'}</span> },
                    { key: 'real', label: 'Real', align: 'right',
                      render: v => safeNumber(v) > 0 ? formatNumber(v) : <span className="text-white/30">—</span> },
                    { key: 'meta', label: 'Meta', align: 'right',
                      render: v => safeNumber(v) > 0 ? formatNumber(v) : <span className="text-white/30">—</span> },
                    { key: '_vs', label: 'vs Meta', align: 'right',
                      render: (_, r) => {
                        const meta = safeNumber(r.meta)
                        const real = safeNumber(r.real)
                        if (!meta || !real) return <span className="text-white/30">—</span>
                        const pct = ((real / meta) - 1) * 100
                        return (
                          <span className={pct >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                            {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                          </span>
                        )
                      }
                    },
                  ]}
                  data={groupRows}
                />
              )}
 
              {groupRows.length === 0 && (
                <p className="text-white/40 text-sm text-center py-4">
                  Sin datos de proyección para este grupo en el mes seleccionado
                </p>
              )}
            </div>
          )}
 
        </div>
      )}
    </div>
  )
}
 
// ─────────────────────────────────────────────────────────────────────────────
// SocialSection principal
// ─────────────────────────────────────────────────────────────────────────────
export function SocialSection({
  platform, data, campanas = [], proyecciones = [], topPosts = [],
  observaciones, historical = [], loading, theme,
}) {
  const cfg = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.facebook
 
  // Mes activo (viene del objeto data del sheet Facebook/Instagram)
  const activeMonth = data?.mes || null
 
  // Proyecciones filtradas por marca ya vienen del hook; solo filtramos por mes aquí
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
        <SectionHeader icon={cfg.icon} title={cfg.label} subtitle="Sin datos para este mes" accentColor={cfg.accent} />
        <EmptyState icon={cfg.icon} title="Sin datos disponibles" message="No hay información registrada para esta plataforma en el mes seleccionado." />
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
      Alcance: safeNumber(r.alcance),
      Interacciones: safeNumber(r.interacciones),
    }))
 
  const primaryKpis = [
    { key: 'seguidores',    title: 'Seguidores',    value: safeNumber(data.seguidores),    icon: Users,      accent: cfg.accent },
    { key: 'alcance',       title: 'Alcance',       value: safeNumber(data.alcance),       icon: Eye,        accent: '#22d3ee' },
    { key: 'interacciones', title: 'Interacciones', value: safeNumber(data.interacciones), icon: Heart,      accent: '#ec4899' },
    { key: 'engagement',    title: 'Engagement',    value: engagement,                     icon: TrendingUp, accent: '#22c55e', suffix: '%', fmt: v => v },
  ]
 
  const secondaryKpis = [
    { key: 'nuevos_seguidores', title: 'Nuevos Seguidores', value: safeNumber(data.nuevos_seguidores), icon: Users,     accent: cfg.accent },
    { key: 'publicaciones',     title: 'Publicaciones',     value: safeNumber(data.publicaciones),     icon: Megaphone, accent: '#a78bfa' },
    { key: 'impresiones',       title: 'Impresiones',       value: safeNumber(data.impresiones),       icon: Eye,       accent: '#22d3ee' },
  ].filter(k => k.value > 0)
 
  return (
    <div className="space-y-6">
      <SectionHeader icon={cfg.icon} title={cfg.label} subtitle="Métricas de desempeño" accentColor={cfg.accent} />
 
      {/* KPIs primarios */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryKpis.map((k, i) => (
          <KPICard key={k.key} title={k.title} value={k.value} icon={k.icon}
            accentColor={k.accent} suffix={k.suffix} formatter={k.fmt} delay={i} />
        ))}
      </div>
 
      {/* KPIs secundarios */}
      {secondaryKpis.length > 0 && (
        <div className={`grid gap-4 ${
          secondaryKpis.length === 1 ? 'grid-cols-1 sm:max-w-xs' :
          secondaryKpis.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {secondaryKpis.map((k, i) => (
            <KPICard key={k.key} title={k.title} value={k.value} icon={k.icon}
              accentColor={k.accent} delay={4 + i} />
          ))}
        </div>
      )}
 
      {/* Tendencia histórica */}
      {trendData.length > 1 && (
        <ChartCard title="Tendencia Histórica" subtitle="Últimos 6 meses">
          {({ scale, expanded }) => (
            <TrendLineChart data={trendData} scale={scale} expanded={expanded}
              lines={[
                { key: 'Seguidores',    name: 'Seguidores',    color: cfg.accent },
                { key: 'Alcance',       name: 'Alcance',       color: '#22d3ee' },
                { key: 'Interacciones', name: 'Interacciones', color: '#ec4899' },
              ]}
            />
          )}
        </ChartCard>
      )}
 
      {/* Paid Media — usa Proyecciones como fuente de resultados */}
      <PaidMediaSection
        platform={platform}
        month={activeMonth}
        campanas={campanas}
        proyecciones={monthProy}
        accent={cfg.accent}
      />
 
      {/* Top Posts */}
      <TopPostsSection posts={topPosts} platform={platform} />
 
      {observaciones && <ObservacionesCard observacion={observaciones} accentColor={cfg.accent} />}
    </div>
  )
}
