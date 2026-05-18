import { formatMonthShort, formatMonthLong, safeNumber } from './format'
import { tipoCampanaToBucket, bucketToLabel } from './campaigns'

async function loadXLSX() {
  if (window.XLSX) return window.XLSX
  await new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    s.onload = resolve; s.onerror = reject
    document.head.appendChild(s)
  })
  return window.XLSX
}

const v = (val) => safeNumber(val, 0)
const cur = (val) => { const num = v(val); return num > 0 ? `$${num.toLocaleString('es-MX', { maximumFractionDigits: 2 })}` : '$0' }
const num = (val) => v(val).toLocaleString('es-MX')
const pctField = (val) => {
  // engagement_rate can come as 1.17 (meaning 1.17%) or 0.0117 (meaning 1.17%)
  // If > 1, it's already a percentage value. If < 1, multiply by 100.
  const raw = v(val)
  if (raw === 0) return '0%'
  // Heuristic: if value > 0 but < 1, it's likely a ratio → *100
  // if >= 1, it's already a percentage
  return `${raw.toFixed(2)}%`
}
const delta = (act, ant) => {
  if (ant === 0) return act > 0 ? 'Nuevo' : '—'
  const pct = ((act - ant) / ant) * 100
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
}
const prevMonth = (mes) => {
  if (!mes?.includes('-')) return null
  const [y, m] = mes.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

function addSheetAOA(XLSX, wb, name, rows) {
  if (!rows || rows.length === 0) return
  const ws = XLSX.utils.aoa_to_sheet(rows)
  // Auto column widths
  const maxCols = Math.max(...rows.map(r => r.length))
  const colW = []
  for (let c = 0; c < maxCols; c++) {
    let max = 8
    rows.forEach(r => {
      const len = String(r[c] ?? '').length
      if (len > max) max = len
    })
    colW[c] = { wch: Math.min(max + 2, 42) }
  }
  ws['!cols'] = colW
  XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31))
}

export async function exportDashboardData(marcaId, mesSeleccionado, filteredData, allData, allProyecciones, brandConfig) {
  const XLSX = await loadXLSX()
  const wb = XLSX.utils.book_new()
  const mesAnt = prevMonth(mesSeleccionado)
  const nombreMarca = brandConfig?.nombre || marcaId
  const monthLabel = formatMonthLong(mesSeleccionado)

  const getHist = (plat, month) => (allData[plat] || []).find(r => r.mes === month) || {}

  // ═══════════════════════════════════════════════════════════════════════
  // 1. RESUMEN EJECUTIVO
  // ═══════════════════════════════════════════════════════════════════════
  const resRows = [
    [`RESUMEN EJECUTIVO — ${nombreMarca}`, '', '', '', '', '', '', '', ''],
    [monthLabel],
    [],
    ['Plataforma', 'Seguidores', 'vs Ant.', 'Alcance / Views', 'vs Ant.', 'Interacciones', 'vs Ant.', 'Inversión', 'vs Ant.'],
  ]
  for (const plat of ['facebook', 'instagram', 'tiktok']) {
    const act = getHist(plat, mesSeleccionado)
    const ant = getHist(plat, mesAnt)
    const alcField = plat === 'tiktok' ? 'views' : 'alcance'
    resRows.push([
      plat.charAt(0).toUpperCase() + plat.slice(1),
      v(act.seguidores), delta(v(act.seguidores), v(ant.seguidores)),
      v(act[alcField]), delta(v(act[alcField]), v(ant[alcField])),
      v(act.interacciones), delta(v(act.interacciones), v(ant.interacciones)),
      v(act.inversion), delta(v(act.inversion), v(ant.inversion)),
    ])
  }
  // Google Ads
  const gaAct = (filteredData.googleAds || []).reduce((s, r) => s + v(r.inversion), 0)
  const gaAntArr = (allData.googleAds || []).filter(r => r.mes === mesAnt)
  const gaAntTotal = gaAntArr.reduce((s, r) => s + v(r.inversion), 0)
  resRows.push(['Google Ads', '—', '', '—', '', '—', '', gaAct, delta(gaAct, gaAntTotal)])
  resRows.push([])

  // Totals
  const totalSeg = ['facebook', 'instagram', 'tiktok'].reduce((s, p) => s + v(getHist(p, mesSeleccionado).seguidores), 0)
  const totalAlc = ['facebook', 'instagram'].reduce((s, p) => s + v(getHist(p, mesSeleccionado).alcance), 0) + v(getHist('tiktok', mesSeleccionado).views)
  const totalInt = ['facebook', 'instagram', 'tiktok'].reduce((s, p) => s + v(getHist(p, mesSeleccionado).interacciones), 0)
  const totalInv = ['facebook', 'instagram', 'tiktok'].reduce((s, p) => s + v(getHist(p, mesSeleccionado).inversion), 0) + gaAct
  resRows.push(['TOTALES', totalSeg, '', totalAlc, '', totalInt, '', totalInv, ''])
  addSheetAOA(XLSX, wb, 'Resumen Ejecutivo', resRows)

  // ═══════════════════════════════════════════════════════════════════════
  // 2. EVOLUCIÓN MENSUAL
  // ═══════════════════════════════════════════════════════════════════════
  const allMonths = [...new Set([
    ...(allData.facebook || []).map(r => r.mes),
    ...(allData.instagram || []).map(r => r.mes),
    ...(allData.tiktok || []).map(r => r.mes),
  ].filter(Boolean))].sort().slice(-6)

  const evoRows = [
    [`EVOLUCIÓN MENSUAL — ${nombreMarca}`],
    [],
    ['Mes', 'Seg. FB', 'Alcance FB', 'Inter. FB', 'Inv. FB', 'Seg. IG', 'Alcance IG', 'Inter. IG', 'Inv. IG', 'Seg. TT', 'Views TT', 'Inter. TT', 'Inv. TT'],
  ]
  for (const mes of allMonths) {
    const fb = getHist('facebook', mes), ig = getHist('instagram', mes), tt = getHist('tiktok', mes)
    evoRows.push([
      formatMonthShort(mes),
      v(fb.seguidores), v(fb.alcance), v(fb.interacciones), v(fb.inversion),
      v(ig.seguidores), v(ig.alcance), v(ig.interacciones), v(ig.inversion),
      v(tt.seguidores), v(tt.views), v(tt.interacciones), v(tt.inversion),
    ])
  }
  addSheetAOA(XLSX, wb, 'Evolución Mensual', evoRows)

  // ═══════════════════════════════════════════════════════════════════════
  // 3-5. PLATAFORMAS
  // ═══════════════════════════════════════════════════════════════════════
  for (const plat of ['facebook', 'instagram', 'tiktok']) {
    const act = filteredData[plat] || {}
    const ant = getHist(plat, mesAnt)
    const alcField = plat === 'tiktok' ? 'views' : 'alcance'
    const label = plat.charAt(0).toUpperCase() + plat.slice(1)

    const rows = [
      [`${label.toUpperCase()} — ${monthLabel}`],
      [],
      ['MÉTRICAS PRINCIPALES', '', ''],
      ['Métrica', 'Valor', 'vs Mes Anterior'],
      ['Seguidores', num(act.seguidores), delta(v(act.seguidores), v(ant.seguidores))],
      ['Nuevos seguidores', num(act.nuevos_seguidores), delta(v(act.nuevos_seguidores), v(ant.nuevos_seguidores))],
      [plat === 'tiktok' ? 'Views' : 'Alcance', num(act[alcField]), delta(v(act[alcField]), v(ant[alcField]))],
      ['Interacciones', num(act.interacciones), delta(v(act.interacciones), v(ant.interacciones))],
      ['Impresiones', num(act.impresiones), delta(v(act.impresiones), v(ant.impresiones))],
      ['Publicaciones', num(act.publicaciones), delta(v(act.publicaciones), v(ant.publicaciones))],
      ['Engagement Rate', pctField(act.engagement_rate), ''],
      ['Inversión', cur(act.inversion), delta(v(act.inversion), v(ant.inversion))],
    ]
    if (plat === 'tiktok') {
      rows.splice(7, 0, ['Views 6s+', num(act.views_6s), delta(v(act.views_6s), v(ant.views_6s))])
    }

    // Campañas
    const campanas = (filteredData.campanas || []).filter(c => c.plataforma === plat)
    const proyPlat = (allProyecciones || []).filter(p => p.mes === mesSeleccionado && p.plataforma === plat)
    const bucketMap = new Map()
    for (const c of campanas) {
      const bucket = c._bucket || tipoCampanaToBucket(c.tipo_campana)
      const objetivo = c._objective || c.objetivo_detectado || c.objetivo || 'Sin objetivo'
      const key = `${bucket}|${objetivo}`
      if (!bucketMap.has(key)) bucketMap.set(key, { bucket, objetivo, resultado: 0, inversion: 0, meta: null })
      const e = bucketMap.get(key)
      e.resultado += v(c.resultado); e.inversion += v(c.inversion)
    }
    for (const p of proyPlat) {
      const bucket = tipoCampanaToBucket(p.tipo_campana)
      const objetivo = p.objetivo || p.metrica || 'Sin objetivo'
      const key = `${bucket}|${objetivo}`
      if (!bucketMap.has(key)) bucketMap.set(key, { bucket, objetivo, resultado: 0, inversion: 0, meta: null })
      const e = bucketMap.get(key)
      e.meta = v(p.meta)
      if (e.resultado === 0) e.resultado = v(p.real)
    }

    if (bucketMap.size > 0) {
      rows.push([])
      rows.push(['CAMPAÑAS POR BUCKET', '', '', '', '', '', ''])
      rows.push(['Bucket', 'Objetivo', 'Resultado', 'Meta', 'Cumplimiento', 'Inversión', 'CPR'])
      for (const e of bucketMap.values()) {
        const cumpl = e.meta > 0 ? `${((e.resultado / e.meta) * 100).toFixed(1)}%` : '—'
        const cpr = e.resultado > 0 ? `$${(e.inversion / e.resultado).toFixed(2)}` : '—'
        rows.push([bucketToLabel(e.bucket, e.bucket), e.objetivo, e.resultado, e.meta || '—', cumpl, e.inversion, cpr])
      }
    }

    // Historical
    const histMonths = (allData[plat] || []).map(r => r.mes).filter(Boolean).sort().slice(-6)
    if (histMonths.length > 1) {
      rows.push([])
      rows.push(['EVOLUCIÓN HISTÓRICA', '', '', '', ''])
      rows.push(['Mes', 'Seguidores', plat === 'tiktok' ? 'Views' : 'Alcance', 'Interacciones', 'Inversión'])
      for (const m of histMonths) {
        const d = getHist(plat, m)
        rows.push([formatMonthShort(m), v(d.seguidores), v(d[alcField]), v(d.interacciones), v(d.inversion)])
      }
    }

    addSheetAOA(XLSX, wb, label, rows)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 6. GOOGLE ADS
  // ═══════════════════════════════════════════════════════════════════════
  const gaData = filteredData.googleAds || []
  if (gaData.length > 0) {
    const totals = gaData.reduce((a, r) => ({
      imp: a.imp + v(r.impresiones_visibles), clics: a.clics + v(r.clics),
      views: a.views + v(r.visualizaciones), inv: a.inv + v(r.inversion),
    }), { imp: 0, clics: 0, views: 0, inv: 0 })
    const ctr = totals.imp > 0 ? ((totals.clics / totals.imp) * 100).toFixed(2) + '%' : '—'
    const antTotals = gaAntArr.reduce((a, r) => ({
      imp: a.imp + v(r.impresiones_visibles), clics: a.clics + v(r.clics),
      views: a.views + v(r.visualizaciones), inv: a.inv + v(r.inversion),
    }), { imp: 0, clics: 0, views: 0, inv: 0 })

    const gaRows = [
      [`GOOGLE ADS — ${monthLabel}`],
      [],
      ['KPIs GENERALES', '', ''],
      ['Métrica', 'Valor', 'vs Mes Anterior'],
      ['Impresiones visibles', totals.imp, delta(totals.imp, antTotals.imp)],
      ['Clics', totals.clics, delta(totals.clics, antTotals.clics)],
      ['CTR', ctr, ''],
      ['Visualizaciones (Video)', totals.views, delta(totals.views, antTotals.views)],
      ['Inversión Total', cur(totals.inv), delta(totals.inv, antTotals.inv)],
    ]

    // By type
    const byType = {}
    for (const r of gaData) {
      const t = r.tipo_red || 'Otro'
      if (!byType[t]) byType[t] = { imp: 0, views: 0, inv: 0, clics: 0 }
      byType[t].imp += v(r.impresiones_visibles)
      byType[t].views += v(r.visualizaciones)
      byType[t].inv += v(r.inversion)
      byType[t].clics += v(r.clics)
    }
    gaRows.push([])
    gaRows.push(['DESGLOSE POR TIPO', '', '', '', ''])
    gaRows.push(['Tipo', 'Imp./Views', 'Clics', 'Inversión', 'CPR'])
    for (const [t, vals] of Object.entries(byType)) {
      const metric = t.toLowerCase().includes('video') ? vals.views : vals.imp
      gaRows.push([t, metric, vals.clics, cur(vals.inv), metric > 0 ? `$${(vals.inv / metric).toFixed(2)}` : '—'])
    }
    addSheetAOA(XLSX, wb, 'Google Ads', gaRows)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 7. SENTIMENT
  // ═══════════════════════════════════════════════════════════════════════
  const sent = filteredData.sentiment
  if (sent) {
    const sentRows = [
      [`SENTIMENT — ${monthLabel}`],
      [],
      ['Métrica', 'Valor'],
      ['Positivo', pctField(sent.positivo_pct)],
      ['Neutro', pctField(sent.neutro_pct)],
      ['Negativo', pctField(sent.negativo_pct)],
    ]
    if (sent.descripcion) {
      sentRows.push([])
      sentRows.push(['ANÁLISIS CUALITATIVO'])
      sentRows.push([sent.descripcion])
    }
    const sentHist = (allData.sentiment || []).sort((a, b) => String(a.mes || '').localeCompare(String(b.mes || '')))
    if (sentHist.length > 1) {
      sentRows.push([])
      sentRows.push(['EVOLUCIÓN DE SENTIMENT', '', '', ''])
      sentRows.push(['Mes', 'Positivo', 'Neutro', 'Negativo'])
      for (const s of sentHist) {
        sentRows.push([formatMonthShort(s.mes), pctField(s.positivo_pct), pctField(s.neutro_pct), pctField(s.negativo_pct)])
      }
    }
    addSheetAOA(XLSX, wb, 'Sentiment', sentRows)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 8. COMPETENCIA
  // ═══════════════════════════════════════════════════════════════════════
  const compData = filteredData.competencia || []
  if (compData.length > 0) {
    const compAnt = (allData.competencia || []).filter(r => r.mes === mesAnt)
    const compRows = [
      [`COMPETENCIA — ${monthLabel}`],
      [],
      ['Red', 'Competidor', 'Seguidores', 'vs Anterior', 'Engagement'],
    ]
    for (const c of compData) {
      const ant = compAnt.find(a => a.competidor === c.competidor && a.red === c.red)
      compRows.push([
        c.red, c.competidor, v(c.seguidores),
        ant ? delta(v(c.seguidores), v(ant.seguidores)) : '',
        pctField(c.engagement_pct),
      ])
    }
    addSheetAOA(XLSX, wb, 'Competencia', compRows)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 9. EFICIENCIA POR CANAL
  // ═══════════════════════════════════════════════════════════════════════
  const efRows = [
    [`EFICIENCIA POR CANAL — ${monthLabel}`],
    [],
    ['Canal', 'CPM (x1000)', 'Costo por Interacción', 'Inversión'],
  ]
  for (const plat of ['facebook', 'instagram']) {
    const d = filteredData[plat] || {}
    const inv = v(d.inversion), alc = v(d.alcance), inter = v(d.interacciones)
    efRows.push([
      plat.charAt(0).toUpperCase() + plat.slice(1),
      alc > 0 ? `$${((inv / alc) * 1000).toFixed(2)}` : '—',
      inter > 0 ? `$${(inv / inter).toFixed(2)}` : '—',
      cur(inv),
    ])
  }
  const ttData = filteredData.tiktok || {}
  efRows.push([
    'TikTok',
    v(ttData.views) > 0 ? `$${((v(ttData.inversion) / v(ttData.views)) * 1000).toFixed(2)}` : '—',
    v(ttData.interacciones) > 0 ? `$${(v(ttData.inversion) / v(ttData.interacciones)).toFixed(2)}` : '—',
    cur(ttData.inversion),
  ])
  if (gaData.length > 0) {
    const gaInv = gaData.reduce((s, r) => s + v(r.inversion), 0)
    const gaImp = gaData.reduce((s, r) => s + v(r.impresiones_visibles), 0)
    efRows.push(['Google Ads', gaImp > 0 ? `$${((gaInv / gaImp) * 1000).toFixed(2)}` : '—', '—', cur(gaInv)])
  }
  addSheetAOA(XLSX, wb, 'Eficiencia por Canal', efRows)

  // ═══════════════════════════════════════════════════════════════════════
  // 10. DISTRIBUCIÓN DE INVERSIÓN
  // ═══════════════════════════════════════════════════════════════════════
  const invByBucket = new Map()
  for (const c of (filteredData.campanas || [])) {
    const bucket = c._bucket || tipoCampanaToBucket(c.tipo_campana)
    invByBucket.set(bucket, (invByBucket.get(bucket) || 0) + v(c.inversion))
  }
  const totalInvB = Array.from(invByBucket.values()).reduce((a, b) => a + b, 0)
  const distRows = [
    [`DISTRIBUCIÓN DE INVERSIÓN — ${monthLabel}`],
    [],
    ['Bucket', 'Inversión', 'Porcentaje'],
  ]
  for (const [b, inv] of invByBucket.entries()) {
    distRows.push([bucketToLabel(b, b), cur(inv), totalInvB > 0 ? `${((inv / totalInvB) * 100).toFixed(1)}%` : '0%'])
  }
  distRows.push(['TOTAL', cur(totalInvB), '100%'])
  addSheetAOA(XLSX, wb, 'Distribución Inversión', distRows)

  // ═══════════════════════════════════════════════════════════════════════
  // 11. ALERTAS Y OPORTUNIDADES
  // ═══════════════════════════════════════════════════════════════════════
  const alertas = []
  const evaluar = (nombre, valorAct, valorAnt, umbral = 30, mejorSiCrece = true) => {
    if (valorAnt === 0) return
    const cambio = ((valorAct - valorAnt) / valorAnt) * 100
    if (Math.abs(cambio) >= umbral) {
      const tipo = (cambio > 0 && mejorSiCrece) || (cambio < 0 && !mejorSiCrece) ? '✅ Oportunidad' : '⚠️ Alerta'
      alertas.push([nombre, valorAct, `${cambio > 0 ? '+' : ''}${cambio.toFixed(1)}%`, tipo])
    }
  }
  for (const plat of ['facebook', 'instagram', 'tiktok']) {
    const act = filteredData[plat] || {}, ant = getHist(plat, mesAnt)
    const label = plat.charAt(0).toUpperCase() + plat.slice(1)
    evaluar(`${label} — Seguidores`, v(act.seguidores), v(ant.seguidores), 10, true)
    evaluar(`${label} — Interacciones`, v(act.interacciones), v(ant.interacciones), 30, true)
    evaluar(`${label} — Inversión`, v(act.inversion), v(ant.inversion), 40, false)
  }
  for (const p of (allProyecciones || []).filter(p => p.mes === mesSeleccionado)) {
    const meta = v(p.meta), real = v(p.real)
    if (meta === 0) continue
    const cumpl = (real / meta) * 100
    if (cumpl < 70) alertas.push([`Meta: ${p.metrica || p.objetivo} (${p.plataforma})`, real, `Cumple ${cumpl.toFixed(1)}%`, '⚠️ Alerta'])
    else if (cumpl > 120) alertas.push([`Meta: ${p.metrica || p.objetivo} (${p.plataforma})`, real, `Cumple ${cumpl.toFixed(1)}%`, '✅ Oportunidad'])
  }
  if (alertas.length > 0) {
    const alRows = [['ALERTAS Y OPORTUNIDADES'], [], ['Indicador', 'Valor Actual', 'vs Anterior', 'Tipo'], ...alertas]
    addSheetAOA(XLSX, wb, 'Alertas y Oportunidades', alRows)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 12. HALLAZGOS Y OBSERVACIONES
  // ═══════════════════════════════════════════════════════════════════════
  const hallazgos = filteredData.hallazgos || []
  const observaciones = filteredData.observaciones || []
  if (hallazgos.length > 0 || observaciones.length > 0) {
    const hRows = [['HALLAZGOS Y OBSERVACIONES'], [], ['Tipo', 'Sección', 'Título', 'Descripción']]
    for (const h of hallazgos) hRows.push([h.tipo || 'Hallazgo', h.seccion, h.titulo, h.descripcion])
    if (observaciones.length > 0) {
      hRows.push([])
      for (const o of observaciones) hRows.push(['Observación', o.seccion, o.titulo, o.descripcion])
    }
    addSheetAOA(XLSX, wb, 'Hallazgos y Obs.', hRows)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 13. METADATOS
  // ═══════════════════════════════════════════════════════════════════════
  addSheetAOA(XLSX, wb, 'Metadatos', [
    ['Campo', 'Valor'],
    ['Marca', nombreMarca],
    ['Mes reportado', monthLabel],
    ['Fecha de generación', new Date().toLocaleString('es-MX')],
    [],
    ['LEYENDA'],
    ['✅ Oportunidad', 'Cambio positivo significativo o meta superada (>120%)'],
    ['⚠️ Alerta', 'Cambio negativo significativo o meta incumplida (<70%)'],
    ['vs Ant.', 'Comparación con el mes inmediato anterior'],
    ['CPR', 'Costo por resultado'],
    ['CPM', 'Costo por mil impresiones/alcance'],
  ])

  // DOWNLOAD
  const safeName = nombreMarca.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim().replace(/\s+/g, '_')
  XLSX.writeFile(wb, `Dashboard_${safeName}_${mesSeleccionado}.xlsx`)
}
