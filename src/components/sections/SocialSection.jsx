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

const METRIC_STYLE = {
  'alcance':           { accent: '#22d3ee', icon: Eye },
  'reach':             { accent: '#22d3ee', icon: Eye },
  'interacción':       { accent: '#ec4899', icon: Heart },
  'interaccion':       { accent: '#ec4899', icon: Heart },
  'likes':             { accent: '#f43f5e', icon: Heart },
  'thruplays':         { accent: '#a78bfa', icon: TrendingUp },
  'visitas al perfil': { accent: '#22c55e', icon: Users },
  'views':             { accent: '#f59e0b', icon: Eye },
  'views norte':       { accent: '#f59e0b', icon: Eye },
  'views pacifico':    { accent: '#fb923c', icon: Eye },
}
function metricStyle(metrica) {
  const key = String(metrica || '').toLowerCase().trim()
  return METRIC_STYLE[key] || { accent: '#94a3b8', icon: TrendingUp }
}
function capitalize(s) {
  return s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '—'
}
const normPlat = v => String(v || '').toLowerCase().trim()

// ── Grupos únicos, mensual primero ───────────────────────────────────────────
function getGroups(rows) {
  const seen = new Map()
  for (const r of rows) {
    const tipo = r.tipo_campana || 'AON'
    const key  = tipoCampanaToBucket(tipo)
    if (!seen.has(key)) seen.set(key, tipo)
  }
  const order = ['mensual', ...([...seen.keys()].filter(k => k !== 'mensual').sort())]
  return order.filter(k => seen.has(k)).map(k => ({ key: k, label: bucketToLabel(k, seen.get(k)) }))
}

// ── Inversión de campañas para plataforma+bucket ─────────────────────────────
// bucket=null → todas las campañas de la plataforma
function campanaInversion(campanas, platform, bucket) {
  return campanas
    .filter(c => {
      const cPlat   = normPlat(c._platform || c.plataforma)
      const cBucket = c._bucket || tipoCampanaToBucket(c.tipo_campana)
      return cPlat === platform && (bucket === null || cBucket === bucket)
    })
    .reduce((a, c) => a + safeNumber(c.inversion), 0)
}

// ── Inversión por objetivo dentro de un grupo ────────────────────────────────
// Cruza: plataforma + tipo_campana + objetivo_detectado ↔ objetivo
function buildObjectiveInversionMap(campanas, platform, bucket) {
  const map = {}
  campanas
    .filter(c => {
      const cPlat   = normPlat(c._platform || c.plataforma)
      const cBucket = c._bucket || tipoCampanaToBucket(c.tipo_campana)
      return cPlat === platform && cBucket === bucket
    })
    .forEach(c => {
      const key = String(c._objective || c.objetivo_detectado || c.objetivo || '').toLowerCase().trim()
      if (!key) return
      map[key] = (map[key] || 0) + safeNumber(c.inversion)
    })
  return map
}

// ═══════════════════════════════════════════════════════════════════════════════
// PaidMediaSection — reutilizable para FB, IG y TikTok
// ═══════════════════════════════════════════════════════════════════════════════
export function PaidMediaSection({ platform, month, campanas, proyecciones, accent }) {
  const [bucket, setBucket] = useState('mensual')
  const [open, setOpen]     = useState(false)

  // Proyecciones de esta plataforma y mes (marca ya filtrada por el hook)
  const platProy = useMemo(
    () => proyecciones.filter(p => normPlat(p.plataforma) === platform && p.mes === month),
    [proyecciones, platform, month]
  )

  const inversionTotal = useMemo(() => campanaInversion(campanas, platform, null), [campanas, platform])

  if (platProy.length === 0 && inversionTotal === 0) return null

  const groups = useMemo(() => getGroups(platProy), [platProy])

  // Totales del mes agrupados por MÉTRICA (no suma única)
  const metricTotals = useMemo(() => {
    const map = {}
    for (const r of platProy) {
      const key = String(r.metrica || r.objetivo || '').toLowerCase().trim()
      if (!key) continue
      if (!map[key]) map[key] = { metrica: r.metrica || r.objetivo, resultado: 0 }
      map[key].resultado += safeNumber(r.real)
    }
    return Object.values(map).filter(m => m.resultado > 0).sort((a, b) => b.resultado - a.resultado)
  }, [platProy])

  // Filas del grupo seleccionado
  const groupRows = useMemo(
    () => platProy
      .filter(r => tipoCampanaToBucket(r.tipo_campana || 'AON') === bucket)
      .sort((a, b) => safeNumber(b.real) - safeNumber(a.real)),
    [platProy, bucket]
  )

  // Mapa objetivo → inversión para el grupo actual
  const objInvMap = useMemo(
    () => buildObjectiveInversionMap(campanas, platform, bucket),
    [campanas, platform, bucket]
  )

  const groupInversion = useMemo(() => campanaInversion(campanas, platform, bucket), [campanas, platform, bucket])
  const groupLabel     = groups.find(g => g.key === bucket)?.label || bucket

  // Subtítulo del header
  const subtitle = [
    inversionTotal > 0 ? `${formatCurrency(inversionTotal)} inversión` : '',
    metricTotals.length > 0 ? `${metricTotals.length} métrica${metricTotals.length !== 1 ? 's' : ''}` : '',
    groups.length > 1 ? `${groups.length} grupos` : '',
  ].filter(Boolean).join(' · ')

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
            {subtitle && <p className="text-[11px] text-white/50">{subtitle}</p>}
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
            <div className={`grid gap-3 ${
              metricTotals.length === 0 ? 'grid-cols-1' :
              (metricTotals.length + 1) <= 2 ? 'grid-cols-2' :
              (metricTotals.length + 1) <= 3 ? 'grid-cols-3' :
              'grid-cols-2 lg:grid-cols-4'
            }`}>
              {inversionTotal > 0 && (
                <KPICard title="Inversión Total" value={inversionTotal} icon={DollarSign}
                  accentColor="#f59e0b" formatter={formatCurrency} delay={0} />
              )}
              {metricTotals.map((m, i) => {
                const s = metricStyle(m.metrica)
                return (
                  <KPICard key={m.metrica} title={capitalize(m.metrica)} value={m.resultado}
                    icon={s.icon} accentColor={s.accent} delay={i + 1} />
                )
              })}
            </div>
          </div>

          {/* ── Desglose por grupo ── */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-3">
              Desglose por grupo
            </p>

            {groups.length > 1 && (
              <div className="mb-4">
                <CampaignToggle buckets={groups} selected={bucket} onChange={setBucket} accentColor={accent} />
              </div>
            )}

            {/* Inversión del grupo */}
            {groupInversion > 0 && (
              <div className="mb-4">
                <KPICard title={`Inversión — ${groupLabel}`} value={groupInversion}
                  icon={DollarSign} accentColor="#f59e0b" formatter={formatCurrency} delay={0} />
              </div>
            )}

            {/* Tabla: Objetivo | Métrica | Resultado | Meta | vs Meta | Inversión */}
            {groupRows.length > 0 ? (
              <DataTable
                columns={[
                  { key: 'objetivo', label: 'Objetivo', bold: true,
                    render: v => <span className="capitalize">{v || '—'}</span> },
                  { key: 'metrica', label: 'Métrica',
                    render: v => <span className="text-white/60 text-xs capitalize">{v || '—'}</span> },
                  { key: 'real', label: 'Resultado', align: 'right',
                    render: v => safeNumber(v) > 0 ? formatNumber(v) : <span className="text-white/30">—</span> },
                  { key: 'meta', label: 'Meta', align: 'right',
                    render: v => safeNumber(v) > 0 ? formatNumber(v) : <span className="text-white/30">—</span> },
                  { key: '_vs', label: 'vs Meta', align: 'right',
                    render: (_, r) => {
                      const meta = safeNumber(r.meta), real = safeNumber(r.real)
                      if (!meta || !real) return <span className="text-white/30">—</span>
                      const pct = ((real / meta) - 1) * 100
                      return <span className={pct >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                        {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                      </span>
                    },
                  },
                  { key: '_inv', label: 'Inversión', align: 'right',
                    render: (_, r) => {
                      const objKey = String(r.objetivo || '').toLowerCase().trim()
                      const inv = objInvMap[objKey]
                      return inv > 0 ? formatCurrency(inv) : <span className="text-white/30">—</span>
                    },
                  },
                ]}
                data={groupRows}
              />
            ) : (
              <p className="text-white/40 text-sm text-center py-4">
                Sin datos para este grupo en el mes seleccionado
              </p>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SocialSection principal (Facebook e Instagram)
// ═══════════════════════════════════════════════════════════════════════════════
export function SocialSection({
  platform, data, campanas = [], proyecciones = [], topPosts = [],
  observaciones, historical = [], loading,
}) {
  const cfg = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.facebook
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
        <SectionHeader icon={cfg.icon} title={cfg.label} subtitle="Sin datos para este mes" accentColor={cfg.accent} />
        <EmptyState icon={cfg.icon} title="Sin datos disponibles"
          message="No hay información registrada para esta plataforma en el mes seleccionado." />
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryKpis.map((k, i) => (
          <KPICard key={k.key} title={k.title} value={k.value} icon={k.icon}
            accentColor={k.accent} suffix={k.suffix} formatter={k.fmt} delay={i} />
        ))}
      </div>

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

      <PaidMediaSection
        platform={platform}
        month={activeMonth}
        campanas={campanas}
        proyecciones={monthProy}
        accent={cfg.accent}
      />

      <TopPostsSection posts={topPosts} platform={platform} />

      {observaciones && <ObservacionesCard observacion={observaciones} accentColor={cfg.accent} />}
    </div>
  )
}
