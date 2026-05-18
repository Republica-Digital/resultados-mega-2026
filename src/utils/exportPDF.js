import { formatMonthLong, formatMonthShort, safeNumber } from './format'
import { tipoCampanaToBucket, bucketToLabel } from './campaigns'

async function loadJsPDF() {
  if (window.jspdf) return window.jspdf
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js')
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')
  return window.jspdf
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src; s.onload = resolve; s.onerror = reject
    document.head.appendChild(s)
  })
}

const n = (v) => safeNumber(v, 0)
const fmtNum = (v) => { const num = n(v); return num.toLocaleString('es-MX') }
const fmtCur = (v) => `$${n(v).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
const fmtPct = (v) => `${(n(v) * 100).toFixed(1)}%`
const variacion = (act, ant) => {
  if (ant === 0) return act > 0 ? 'Nuevo' : '—'
  const pct = ((act - ant) / ant) * 100
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
}
function mesAnterior(mes) {
  if (!mes?.includes('-')) return null
  const [y, m] = mes.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

// Brand colors
const BRAND_COLORS = {
  botanera: { r: 255, g: 107, b: 0 },
  chamoy: { r: 168, g: 85, b: 247 },
  pacific: { r: 59, g: 130, b: 246 },
}
const DEFAULT_COLOR = { r: 99, g: 102, b: 241 }

/**
 * Export a structured PDF with all dashboard data.
 */
export async function exportDashboardPDF({
  marcaId, brandName, selectedMonth, filteredData, allData, allProyecciones, features, onProgress,
}) {
  const { jsPDF } = await loadJsPDF()
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const M = 15 // margin
  const accent = BRAND_COLORS[marcaId] || DEFAULT_COLOR
  const mesAnt = mesAnterior(selectedMonth)
  const monthLabel = formatMonthLong(selectedMonth)
  const getHist = (plat, month) => (allData[plat] || []).find(r => r.mes === month) || {}

  let currentPage = 1
  const tocEntries = [] // { title, page }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const addFooter = () => {
    pdf.setFontSize(7)
    pdf.setTextColor(150)
    pdf.text(`${brandName} — ${monthLabel}`, M, H - 5)
    pdf.text(`Página ${currentPage}`, W - M, H - 5, { align: 'right' })
  }

  const newPage = () => {
    pdf.addPage()
    currentPage++
    addFooter()
  }

  const addSection = (title) => {
    newPage()
    tocEntries.push({ title, page: currentPage })
    // Section header bar
    pdf.setFillColor(accent.r, accent.g, accent.b)
    pdf.rect(M, M, W - M * 2, 10, 'F')
    pdf.setFontSize(14)
    pdf.setTextColor(255, 255, 255)
    pdf.text(title, M + 4, M + 7)
    pdf.setTextColor(50, 50, 50)
    return M + 16 // y position after header
  }

  const addSubtitle = (y, text) => {
    pdf.setFontSize(10)
    pdf.setTextColor(accent.r, accent.g, accent.b)
    pdf.text(text, M, y)
    pdf.setTextColor(50, 50, 50)
    return y + 6
  }

  const addTable = (startY, head, body, opts = {}) => {
    pdf.autoTable({
      startY,
      head: [head],
      body,
      margin: { left: M, right: M },
      styles: { fontSize: 8, cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.2 },
      headStyles: { fillColor: [accent.r, accent.g, accent.b], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      ...opts,
    })
    return pdf.lastAutoTable.finalY + 6
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1: COVER
  // ══════════════════════════════════════════════════════════════════════════
  onProgress?.(0, 8, 'Portada')
  // Background accent
  pdf.setFillColor(accent.r, accent.g, accent.b)
  pdf.rect(0, 0, W, 55, 'F')
  pdf.setFontSize(28)
  pdf.setTextColor(255, 255, 255)
  pdf.text('Reporte Mensual', M, 30)
  pdf.setFontSize(18)
  pdf.text(`${brandName} — ${monthLabel}`, M, 43)

  // Summary KPIs on cover
  pdf.setTextColor(60, 60, 60)
  let y = 70
  pdf.setFontSize(11)
  pdf.text('Resumen de Plataformas', M, y)
  y += 8

  const coverHead = ['Plataforma', 'Seguidores', 'Alcance/Views', 'Interacciones', 'Inversión']
  const coverBody = ['facebook', 'instagram', 'tiktok'].map(plat => {
    const d = getHist(plat, selectedMonth)
    return [
      plat.charAt(0).toUpperCase() + plat.slice(1),
      fmtNum(d.seguidores),
      fmtNum(plat === 'tiktok' ? d.views : d.alcance),
      fmtNum(d.interacciones),
      fmtCur(d.inversion),
    ]
  })
  y = addTable(y, coverHead, coverBody)

  pdf.setFontSize(9)
  pdf.setTextColor(130)
  pdf.text(`Generado el ${new Date().toLocaleString('es-MX')}`, M, H - 15)
  addFooter()

  // ══════════════════════════════════════════════════════════════════════════
  // SECTIONS
  // ══════════════════════════════════════════════════════════════════════════

  // ── FACEBOOK ────────────────────────────────────────────────────────────
  onProgress?.(1, 8, 'Facebook')
  y = addPlatformSection(pdf, 'Facebook', 'facebook', 'alcance', filteredData, allData, allProyecciones, selectedMonth, mesAnt, addSection, addSubtitle, addTable, getHist, newPage)

  // ── INSTAGRAM ───────────────────────────────────────────────────────────
  onProgress?.(2, 8, 'Instagram')
  y = addPlatformSection(pdf, 'Instagram', 'instagram', 'alcance', filteredData, allData, allProyecciones, selectedMonth, mesAnt, addSection, addSubtitle, addTable, getHist, newPage)

  // ── TIKTOK ──────────────────────────────────────────────────────────────
  onProgress?.(3, 8, 'TikTok')
  y = addPlatformSection(pdf, 'TikTok', 'tiktok', 'views', filteredData, allData, allProyecciones, selectedMonth, mesAnt, addSection, addSubtitle, addTable, getHist, newPage)

  // ── GOOGLE ADS ──────────────────────────────────────────────────────────
  onProgress?.(4, 8, 'Google Ads')
  if (features?.googleAds !== false) {
    const gaData = filteredData.googleAds || []
    if (gaData.length > 0) {
      y = addSection('Google Ads')
      const gaAnt = (allData.googleAds || []).filter(r => r.mes === mesAnt)
      const totals = gaData.reduce((a, r) => ({
        imp: a.imp + n(r.impresiones_visibles), clics: a.clics + n(r.clics),
        views: a.views + n(r.visualizaciones), inv: a.inv + n(r.inversion),
      }), { imp: 0, clics: 0, views: 0, inv: 0 })
      const antTotals = gaAnt.reduce((a, r) => ({
        imp: a.imp + n(r.impresiones_visibles), clics: a.clics + n(r.clics),
        views: a.views + n(r.visualizaciones), inv: a.inv + n(r.inversion),
      }), { imp: 0, clics: 0, views: 0, inv: 0 })

      y = addSubtitle(y, 'KPIs Generales')
      y = addTable(y,
        ['Métrica', 'Valor', 'vs Anterior'],
        [
          ['Imp. Visibles', fmtNum(totals.imp), variacion(totals.imp, antTotals.imp)],
          ['Clics', fmtNum(totals.clics), variacion(totals.clics, antTotals.clics)],
          ['CTR', totals.imp > 0 ? `${((totals.clics / totals.imp) * 100).toFixed(2)}%` : '—', ''],
          ['Views (Video)', fmtNum(totals.views), variacion(totals.views, antTotals.views)],
          ['Inversión', fmtCur(totals.inv), variacion(totals.inv, antTotals.inv)],
        ],
      )

      // By type
      const byType = {}
      for (const r of gaData) {
        const t = r.tipo_red || 'Otro'
        if (!byType[t]) byType[t] = { imp: 0, views: 0, inv: 0 }
        byType[t].imp += n(r.impresiones_visibles)
        byType[t].views += n(r.visualizaciones)
        byType[t].inv += n(r.inversion)
      }
      y = addSubtitle(y, 'Desglose por Tipo')
      y = addTable(y,
        ['Tipo', 'Impresiones/Views', 'Inversión', 'CPR'],
        Object.entries(byType).map(([t, v]) => {
          const metric = t.toLowerCase().includes('video') ? v.views : v.imp
          return [t, fmtNum(metric), fmtCur(v.inv), metric > 0 ? `$${(v.inv / metric).toFixed(2)}` : '—']
        }),
      )
    }
  }

  // ── SENTIMENT ───────────────────────────────────────────────────────────
  onProgress?.(5, 8, 'Sentiment')
  const sent = filteredData.sentiment
  if (sent) {
    y = addSection('Sentiment')
    y = addSubtitle(y, 'Análisis de Percepción')
    y = addTable(y,
      ['Positivo', 'Neutro', 'Negativo'],
      [[fmtPct(sent.positivo_pct), fmtPct(sent.neutro_pct), fmtPct(sent.negativo_pct)]],
    )
    if (sent.descripcion) {
      y = addSubtitle(y, 'Análisis Cualitativo')
      pdf.setFontSize(9)
      pdf.setTextColor(60)
      const lines = pdf.splitTextToSize(String(sent.descripcion), W - M * 2)
      pdf.text(lines, M, y)
      y += lines.length * 4.5 + 6
    }
    // Historical
    const sentHist = (allData.sentiment || []).sort((a, b) => String(a.mes || '').localeCompare(String(b.mes || '')))
    if (sentHist.length > 1) {
      y = addSubtitle(y, 'Evolución de Sentiment')
      y = addTable(y,
        ['Mes', 'Positivo', 'Neutro', 'Negativo'],
        sentHist.map(s => [formatMonthShort(s.mes), fmtPct(s.positivo_pct), fmtPct(s.neutro_pct), fmtPct(s.negativo_pct)]),
      )
    }
  }

  // ── COMPETENCIA ─────────────────────────────────────────────────────────
  onProgress?.(6, 8, 'Competencia')
  const compData = filteredData.competencia || []
  if (compData.length > 0) {
    y = addSection('Competencia')
    const compAnt = (allData.competencia || []).filter(r => r.mes === mesAnt)
    const redes = [...new Set(compData.map(c => c.red))].filter(Boolean)
    for (const red of redes) {
      y = addSubtitle(y, red.charAt(0).toUpperCase() + red.slice(1))
      const rows = compData.filter(c => c.red === red).map(c => {
        const ant = compAnt.find(a => a.competidor === c.competidor && a.red === red)
        return [
          c.competidor,
          fmtNum(c.seguidores),
          ant ? variacion(n(c.seguidores), n(ant.seguidores)) : '',
          `${(n(c.engagement_pct) * 100).toFixed(2)}%`,
        ]
      })
      y = addTable(y, ['Competidor', 'Seguidores', 'vs Anterior', 'Engagement'], rows)
      if (y > H - 40) { newPage(); y = M + 10 }
    }
  }

  // ── HALLAZGOS ───────────────────────────────────────────────────────────
  onProgress?.(7, 8, 'Hallazgos')
  const hallazgos = filteredData.hallazgos || []
  const observaciones = filteredData.observaciones || []
  if (hallazgos.length > 0 || observaciones.length > 0) {
    y = addSection('Hallazgos y Observaciones')
    if (hallazgos.length > 0) {
      y = addSubtitle(y, 'Hallazgos Clave')
      y = addTable(y,
        ['Tipo', 'Sección', 'Título', 'Descripción'],
        hallazgos.map(h => [h.tipo || '', h.seccion || '', h.titulo || '', h.descripcion || '']),
        { columnStyles: { 3: { cellWidth: 90 } } },
      )
    }
    if (observaciones.length > 0) {
      if (y > H - 40) { newPage(); y = M + 10 }
      y = addSubtitle(y, 'Observaciones')
      y = addTable(y,
        ['Sección', 'Título', 'Descripción'],
        observaciones.map(o => [o.seccion || '', o.titulo || '', o.descripcion || '']),
        { columnStyles: { 2: { cellWidth: 110 } } },
      )
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TABLE OF CONTENTS (inserted as page 2)
  // ══════════════════════════════════════════════════════════════════════════
  onProgress?.(8, 8, 'Índice')
  // We'll insert the TOC after the cover (page 1)
  // Since jsPDF doesn't allow inserting pages, we create a new doc:
  // Simpler approach — add TOC as last page, then reorder
  pdf.addPage()
  currentPage++
  const tocPage = currentPage

  pdf.setFillColor(accent.r, accent.g, accent.b)
  pdf.rect(M, M, W - M * 2, 10, 'F')
  pdf.setFontSize(14)
  pdf.setTextColor(255)
  pdf.text('Índice de Contenido', M + 4, M + 7)

  pdf.setTextColor(50)
  let tocY = M + 22
  pdf.setFontSize(10)
  for (const entry of tocEntries) {
    pdf.text(entry.title, M + 4, tocY)
    pdf.text(`Pág. ${entry.page}`, W - M - 4, tocY, { align: 'right' })
    // Dotted line
    pdf.setDrawColor(200)
    pdf.setLineDashPattern([1, 1])
    pdf.line(M + 4 + pdf.getTextWidth(entry.title) + 2, tocY - 0.5, W - M - 4 - pdf.getTextWidth(`Pág. ${entry.page}`) - 2, tocY - 0.5)
    pdf.setLineDashPattern([])
    tocY += 7
  }
  pdf.setFontSize(7)
  pdf.setTextColor(150)
  pdf.text(`${brandName} — ${monthLabel}`, M, H - 5)
  pdf.text(`Página ${tocPage}`, W - M, H - 5, { align: 'right' })

  // Move TOC to page 2
  pdf.movePage(tocPage, 2)

  // DOWNLOAD
  const safeName = brandName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim().replace(/\s+/g, '_')
  pdf.save(`Reporte_${safeName}_${selectedMonth}.pdf`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform section builder (reused for FB, IG, TT)
// ─────────────────────────────────────────────────────────────────────────────
function addPlatformSection(pdf, label, platform, reachField, filteredData, allData, allProyecciones, mesActual, mesAnt, addSection, addSubtitle, addTable, getHist, newPage) {
  const H = pdf.internal.pageSize.getHeight()
  const M = 15
  let y = addSection(label)
  const act = filteredData[platform] || {}
  const ant = getHist(platform, mesAnt)

  // KPIs
  y = addSubtitle(y, 'Métricas Principales')
  const kpiRows = [
    ['Seguidores', fmtNum(act.seguidores), variacion(n(act.seguidores), n(ant.seguidores))],
    ['Nuevos Seguidores', fmtNum(act.nuevos_seguidores), variacion(n(act.nuevos_seguidores), n(ant.nuevos_seguidores))],
    [platform === 'tiktok' ? 'Views' : 'Alcance', fmtNum(act[reachField]), variacion(n(act[reachField]), n(ant[reachField]))],
    ['Interacciones', fmtNum(act.interacciones), variacion(n(act.interacciones), n(ant.interacciones))],
    ['Impresiones', fmtNum(act.impresiones), variacion(n(act.impresiones), n(ant.impresiones))],
    ['Publicaciones', fmtNum(act.publicaciones), variacion(n(act.publicaciones), n(ant.publicaciones))],
    ['Engagement Rate', `${(n(act.engagement_rate) * 100).toFixed(2)}%`, ''],
    ['Inversión', fmtCur(act.inversion), variacion(n(act.inversion), n(ant.inversion))],
  ]
  if (platform === 'tiktok') {
    kpiRows.splice(3, 0, ['Views 6s+', fmtNum(act.views_6s), variacion(n(act.views_6s), n(ant.views_6s))])
  }
  y = addTable(y, ['Métrica', 'Valor', 'vs Anterior'], kpiRows)

  // Campaigns by bucket
  const campanas = (filteredData.campanas || []).filter(c => c.plataforma === platform)
  if (campanas.length > 0) {
    if (y > H - 50) { newPage(); y = M + 10 }
    y = addSubtitle(y, 'Campañas por Bucket')

    const proyPlat = (allProyecciones || []).filter(p => p.mes === mesActual && p.plataforma === platform)
    const bucketMap = new Map()
    for (const c of campanas) {
      const bucket = c._bucket || tipoCampanaToBucket(c.tipo_campana)
      const objetivo = c._objective || c.objetivo_detectado || c.objetivo || 'Sin objetivo'
      const key = `${bucket}|${objetivo}`
      if (!bucketMap.has(key)) bucketMap.set(key, { bucket, objetivo, resultado: 0, inversion: 0, meta: null })
      const e = bucketMap.get(key)
      e.resultado += n(c.resultado); e.inversion += n(c.inversion)
    }
    for (const p of proyPlat) {
      const bucket = tipoCampanaToBucket(p.tipo_campana)
      const objetivo = p.objetivo || p.metrica || 'Sin objetivo'
      const key = `${bucket}|${objetivo}`
      if (!bucketMap.has(key)) bucketMap.set(key, { bucket, objetivo, resultado: 0, inversion: 0, meta: null })
      const e = bucketMap.get(key)
      e.meta = n(p.meta)
      if (e.resultado === 0) e.resultado = n(p.real)
    }

    const rows = Array.from(bucketMap.values()).map(e => {
      const cumpl = e.meta > 0 ? `${((e.resultado / e.meta) * 100).toFixed(1)}%` : '—'
      const cpr = e.resultado > 0 ? `$${(e.inversion / e.resultado).toFixed(2)}` : '—'
      return [bucketToLabel(e.bucket, e.bucket), e.objetivo, fmtNum(e.resultado), e.meta ? fmtNum(e.meta) : '—', cumpl, fmtCur(e.inversion), cpr]
    })
    y = addTable(y, ['Bucket', 'Objetivo', 'Resultado', 'Meta', 'Cumpl.', 'Inversión', 'CPR'], rows)
  }

  // Historical evolution (last 6 months)
  const allMonths = (allData[platform] || []).map(r => r.mes).filter(Boolean).sort().slice(-6)
  if (allMonths.length > 1) {
    if (y > H - 50) { newPage(); y = M + 10 }
    y = addSubtitle(y, 'Evolución Histórica (últimos 6 meses)')
    const histRows = allMonths.map(m => {
      const d = getHist(platform, m)
      return [
        formatMonthShort(m),
        fmtNum(d.seguidores),
        fmtNum(d[reachField]),
        fmtNum(d.interacciones),
        fmtCur(d.inversion),
      ]
    })
    y = addTable(y, ['Mes', 'Seguidores', platform === 'tiktok' ? 'Views' : 'Alcance', 'Interacciones', 'Inversión'], histRows)
  }

  return y
}
