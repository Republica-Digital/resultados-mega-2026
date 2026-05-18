import { formatMonthShort, formatMonthLong, safeNumber } from './format'
import { tipoCampanaToBucket, bucketToLabel } from './campaigns'

// Dynamically load SheetJS from CDN (avoids bundling ~500KB)
async function loadXLSX() {
  if (window.XLSX) return window.XLSX
  await new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
  return window.XLSX
}

function n(val) { return safeNumber(val, 0) }

function variacion(act, ant) {
  if (ant === 0) return act > 0 ? 'Nuevo' : '—'
  const pct = ((act - ant) / ant) * 100
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
}

function obtenerMesAnterior(mes) {
  if (!mes || !mes.includes('-')) return null
  const [year, month] = mes.split('-').map(Number)
  let y = year, m = month - 1
  if (m === 0) { y -= 1; m = 12 }
  return `${y}-${String(m).padStart(2, '0')}`
}

function addSheet(XLSX, wb, name, data) {
  if (!data || data.length === 0) return
  const ws = XLSX.utils.json_to_sheet(data)
  // Auto-fit column widths
  const colWidths = []
  const keys = Object.keys(data[0] || {})
  keys.forEach((key, i) => {
    let max = key.length
    data.forEach(row => {
      const len = String(row[key] ?? '').length
      if (len > max) max = len
    })
    colWidths[i] = { wch: Math.min(max + 3, 40) }
  })
  ws['!cols'] = colWidths
  XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31))
}

/**
 * Main export function.
 * @param {string} marcaId
 * @param {string} mesSeleccionado - "YYYY-MM"
 * @param {object} filteredData - current month data
 * @param {object} allData - full data object (all months, already filtered by marca in useSheetData)
 * @param {array} allProyecciones - all proyecciones rows
 * @param {object} brandConfig
 */
export async function exportDashboardData(marcaId, mesSeleccionado, filteredData, allData, allProyecciones, brandConfig) {
  const XLSX = await loadXLSX()
  const wb = XLSX.utils.book_new()
  const mesAnt = obtenerMesAnterior(mesSeleccionado)
  const nombreMarca = brandConfig?.nombre || marcaId

  // Helper: get a platform row for a given month from historical data
  const getHist = (plat, month) => {
    const arr = allData[plat] || []
    return arr.find(r => r.mes === month) || {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. RESUMEN EJECUTIVO
  // ═══════════════════════════════════════════════════════════════════════════
  const resumen = []
  for (const plat of ['facebook', 'instagram', 'tiktok']) {
    const act = getHist(plat, mesSeleccionado)
    const ant = getHist(plat, mesAnt)
    const alcField = plat === 'tiktok' ? 'views' : 'alcance'
    resumen.push({
      Plataforma: plat.charAt(0).toUpperCase() + plat.slice(1),
      Seguidores: n(act.seguidores),
      'vs Ant.': variacion(n(act.seguidores), n(ant.seguidores)),
      [plat === 'tiktok' ? 'Views' : 'Alcance']: n(act[alcField]),
      'vs Ant. Alc': variacion(n(act[alcField]), n(ant[alcField])),
      Interacciones: n(act.interacciones),
      'vs Ant. Int': variacion(n(act.interacciones), n(ant.interacciones)),
      Inversión: n(act.inversion),
      'vs Ant. Inv': variacion(n(act.inversion), n(ant.inversion)),
    })
  }
  // Google Ads totals
  const gaAct = (filteredData.googleAds || []).reduce((s, r) => s + n(r.inversion), 0)
  const gaAntArr = (allData.googleAds || []).filter(r => r.mes === mesAnt)
  const gaAntTotal = gaAntArr.reduce((s, r) => s + n(r.inversion), 0)
  resumen.push({
    Plataforma: 'Google Ads',
    Seguidores: '—', 'vs Ant.': '',
    Alcance: '—', 'vs Ant. Alc': '',
    Interacciones: '—', 'vs Ant. Int': '',
    Inversión: gaAct, 'vs Ant. Inv': variacion(gaAct, gaAntTotal),
  })
  addSheet(XLSX, wb, 'Resumen Ejecutivo', resumen)

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. EVOLUCIÓN MENSUAL (últimos 6 meses)
  // ═══════════════════════════════════════════════════════════════════════════
  const allMonths = [...new Set([
    ...(allData.facebook || []).map(r => r.mes),
    ...(allData.instagram || []).map(r => r.mes),
    ...(allData.tiktok || []).map(r => r.mes),
  ].filter(Boolean))].sort().slice(-6)

  const evolucion = allMonths.map(mes => {
    const fb = getHist('facebook', mes)
    const ig = getHist('instagram', mes)
    const tt = getHist('tiktok', mes)
    return {
      Mes: formatMonthShort(mes),
      'Seg. FB': n(fb.seguidores), 'Alcance FB': n(fb.alcance), 'Inter. FB': n(fb.interacciones), 'Inv. FB': n(fb.inversion),
      'Seg. IG': n(ig.seguidores), 'Alcance IG': n(ig.alcance), 'Inter. IG': n(ig.interacciones), 'Inv. IG': n(ig.inversion),
      'Seg. TT': n(tt.seguidores), 'Views TT': n(tt.views), 'Inter. TT': n(tt.interacciones), 'Inv. TT': n(tt.inversion),
    }
  })
  addSheet(XLSX, wb, 'Evolución Mensual', evolucion)

  // ═══════════════════════════════════════════════════════════════════════════
  // 3-5. PLATAFORMAS (Facebook, Instagram, TikTok)
  // ═══════════════════════════════════════════════════════════════════════════
  for (const plat of ['facebook', 'instagram', 'tiktok']) {
    const act = filteredData[plat] || {}
    const ant = getHist(plat, mesAnt)
    const alcField = plat === 'tiktok' ? 'views' : 'alcance'

    const kpis = [
      { Métrica: 'Seguidores', Valor: n(act.seguidores), 'vs Anterior': variacion(n(act.seguidores), n(ant.seguidores)) },
      { Métrica: 'Nuevos seguidores', Valor: n(act.nuevos_seguidores), 'vs Anterior': variacion(n(act.nuevos_seguidores), n(ant.nuevos_seguidores)) },
      { Métrica: plat === 'tiktok' ? 'Views' : 'Alcance', Valor: n(act[alcField]), 'vs Anterior': variacion(n(act[alcField]), n(ant[alcField])) },
      { Métrica: 'Interacciones', Valor: n(act.interacciones), 'vs Anterior': variacion(n(act.interacciones), n(ant.interacciones)) },
      { Métrica: 'Impresiones', Valor: n(act.impresiones), 'vs Anterior': variacion(n(act.impresiones), n(ant.impresiones)) },
      { Métrica: 'Publicaciones', Valor: n(act.publicaciones), 'vs Anterior': variacion(n(act.publicaciones), n(ant.publicaciones)) },
      { Métrica: 'Engagement Rate', Valor: `${(n(act.engagement_rate) * 100).toFixed(2)}%`, 'vs Anterior': '' },
      { Métrica: 'Inversión', Valor: n(act.inversion), 'vs Anterior': variacion(n(act.inversion), n(ant.inversion)) },
    ]
    if (plat === 'tiktok') {
      kpis.splice(3, 0, { Métrica: 'Views 6s+', Valor: n(act.views_6s), 'vs Anterior': variacion(n(act.views_6s), n(ant.views_6s)) })
    }

    // Campañas agrupadas por bucket
    const campanas = (filteredData.campanas || []).filter(c => c.plataforma === plat)
    const proyPlat = (allProyecciones || []).filter(p => p.mes === mesSeleccionado && p.plataforma === plat)

    const bucketMap = new Map()
    for (const c of campanas) {
      const bucket = c._bucket || tipoCampanaToBucket(c.tipo_campana)
      const objetivo = c._objective || c.objetivo_detectado || c.objetivo || 'Sin objetivo'
      const key = `${bucket}|${objetivo}`
      if (!bucketMap.has(key)) bucketMap.set(key, { bucket, objetivo, resultado: 0, inversion: 0, meta: null })
      const e = bucketMap.get(key)
      e.resultado += n(c.resultado)
      e.inversion += n(c.inversion)
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

    const campRows = Array.from(bucketMap.values()).map(e => {
      const cumpl = e.meta > 0 ? (e.resultado / e.meta) * 100 : null
      const cpr = e.resultado > 0 ? e.inversion / e.resultado : 0
      return {
        '': '', // separator column
        Bucket: bucketToLabel(e.bucket, e.bucket),
        Objetivo: e.objetivo,
        Resultado: e.resultado,
        Meta: e.meta || '—',
        Cumplimiento: cumpl !== null ? `${cumpl.toFixed(1)}%` : '—',
        'Inversión Camp.': e.inversion,
        CPR: cpr > 0 ? `$${cpr.toFixed(2)}` : '—',
      }
    })

    // Combine: KPIs + blank row + campaigns header
    const separator = { Métrica: '', Valor: '', 'vs Anterior': '' }
    const campHeader = { Métrica: '── CAMPAÑAS POR BUCKET ──', Valor: '', 'vs Anterior': '' }
    const combined = [...kpis, separator, campHeader, ...campRows]
    addSheet(XLSX, wb, plat.charAt(0).toUpperCase() + plat.slice(1), combined)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. GOOGLE ADS
  // ═══════════════════════════════════════════════════════════════════════════
  const gaData = filteredData.googleAds || []
  if (gaData.length > 0) {
    const totals = gaData.reduce((acc, r) => ({
      impVisibles: acc.impVisibles + n(r.impresiones_visibles),
      clics: acc.clics + n(r.clics),
      inversion: acc.inversion + n(r.inversion),
      views: acc.views + n(r.visualizaciones),
    }), { impVisibles: 0, clics: 0, inversion: 0, views: 0 })

    const ctr = totals.impVisibles > 0 ? (totals.clics / totals.impVisibles) * 100 : 0

    const kpis = [
      { Métrica: 'Impresiones visibles', Valor: totals.impVisibles, 'vs Anterior': variacion(totals.impVisibles, gaAntArr.reduce((s, r) => s + n(r.impresiones_visibles), 0)) },
      { Métrica: 'Clics', Valor: totals.clics, 'vs Anterior': variacion(totals.clics, gaAntArr.reduce((s, r) => s + n(r.clics), 0)) },
      { Métrica: 'CTR', Valor: `${ctr.toFixed(2)}%`, 'vs Anterior': '' },
      { Métrica: 'Visualizaciones (Video)', Valor: totals.views, 'vs Anterior': variacion(totals.views, gaAntArr.reduce((s, r) => s + n(r.visualizaciones), 0)) },
      { Métrica: 'Inversión Total', Valor: totals.inversion, 'vs Anterior': variacion(totals.inversion, gaAntTotal) },
    ]

    // Desglose por tipo_red
    const byType = {}
    for (const r of gaData) {
      const tipo = r.tipo_red || 'Otro'
      if (!byType[tipo]) byType[tipo] = { imp: 0, views: 0, inv: 0, clics: 0 }
      byType[tipo].imp += n(r.impresiones_visibles)
      byType[tipo].views += n(r.visualizaciones)
      byType[tipo].inv += n(r.inversion)
      byType[tipo].clics += n(r.clics)
    }
    const typeRows = Object.entries(byType).map(([tipo, v]) => ({
      Métrica: `  ${tipo}`,
      Valor: tipo.toLowerCase().includes('video') ? v.views : v.imp,
      'vs Anterior': '',
      Clics: v.clics,
      Inversión: v.inv,
      CPR: v.imp > 0 ? `$${(v.inv / (tipo.toLowerCase().includes('video') ? v.views || 1 : v.imp)).toFixed(2)}` : '—',
    }))

    const separator = { Métrica: '', Valor: '' }
    const desgloseHeader = { Métrica: '── DESGLOSE POR TIPO ──', Valor: '' }
    addSheet(XLSX, wb, 'Google Ads', [...kpis, separator, desgloseHeader, ...typeRows])
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. COMPETENCIA
  // ═══════════════════════════════════════════════════════════════════════════
  const compData = filteredData.competencia || []
  if (compData.length > 0) {
    const compAnt = (allData.competencia || []).filter(r => r.mes === mesAnt)
    const compRows = compData.map(c => {
      const ant = compAnt.find(a => a.competidor === c.competidor && a.red === c.red)
      return {
        Red: c.red,
        Competidor: c.competidor,
        Seguidores: n(c.seguidores),
        'vs Anterior': ant ? variacion(n(c.seguidores), n(ant.seguidores)) : '',
        Engagement: `${(n(c.engagement_pct) * 100).toFixed(2)}%`,
      }
    })
    addSheet(XLSX, wb, 'Competencia', compRows)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. SENTIMENT
  // ═══════════════════════════════════════════════════════════════════════════
  const sent = filteredData.sentiment
  if (sent) {
    const sentRows = [
      { Métrica: 'Positivo', Valor: `${(n(sent.positivo_pct) * 100).toFixed(1)}%` },
      { Métrica: 'Neutro', Valor: `${(n(sent.neutro_pct) * 100).toFixed(1)}%` },
      { Métrica: 'Negativo', Valor: `${(n(sent.negativo_pct) * 100).toFixed(1)}%` },
    ]
    if (sent.descripcion) {
      sentRows.push({ Métrica: '', Valor: '' })
      sentRows.push({ Métrica: 'Análisis Cualitativo', Valor: sent.descripcion })
    }
    // Histórico de sentiment
    const sentHist = (allData.sentiment || []).sort((a, b) => String(a.mes || '').localeCompare(String(b.mes || '')))
    if (sentHist.length > 1) {
      sentRows.push({ Métrica: '', Valor: '' })
      sentRows.push({ Métrica: '── HISTÓRICO ──', Valor: '' })
      for (const s of sentHist) {
        sentRows.push({
          Métrica: formatMonthShort(s.mes),
          Valor: `Pos: ${(n(s.positivo_pct) * 100).toFixed(0)}% | Neu: ${(n(s.neutro_pct) * 100).toFixed(0)}% | Neg: ${(n(s.negativo_pct) * 100).toFixed(0)}%`,
        })
      }
    }
    addSheet(XLSX, wb, 'Sentiment', sentRows)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. EFICIENCIA POR CANAL
  // ═══════════════════════════════════════════════════════════════════════════
  const eficiencia = []
  for (const plat of ['facebook', 'instagram']) {
    const d = filteredData[plat] || {}
    const inv = n(d.inversion), alc = n(d.alcance), inter = n(d.interacciones)
    eficiencia.push({
      Canal: plat.charAt(0).toUpperCase() + plat.slice(1),
      'CPM (x1000 alcance)': alc > 0 ? `$${((inv / alc) * 1000).toFixed(2)}` : '—',
      'Costo por Interacción': inter > 0 ? `$${(inv / inter).toFixed(2)}` : '—',
      Inversión: inv,
    })
  }
  const tt = filteredData.tiktok || {}
  eficiencia.push({
    Canal: 'TikTok',
    'CPM (x1000 alcance)': '—',
    'Costo por Interacción': n(tt.interacciones) > 0 ? `$${(n(tt.inversion) / n(tt.interacciones)).toFixed(2)}` : '—',
    'CPV (view)': n(tt.views) > 0 ? `$${(n(tt.inversion) / n(tt.views)).toFixed(4)}` : '—',
    Inversión: n(tt.inversion),
  })
  if (gaData.length > 0) {
    const gaInv = gaData.reduce((s, r) => s + n(r.inversion), 0)
    const gaImp = gaData.reduce((s, r) => s + n(r.impresiones_visibles), 0)
    eficiencia.push({
      Canal: 'Google Ads',
      'CPM (x1000 imp. visibles)': gaImp > 0 ? `$${((gaInv / gaImp) * 1000).toFixed(2)}` : '—',
      'Costo por Interacción': '—',
      Inversión: gaInv,
    })
  }
  addSheet(XLSX, wb, 'Eficiencia por Canal', eficiencia)

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. DISTRIBUCIÓN DE INVERSIÓN
  // ═══════════════════════════════════════════════════════════════════════════
  const invByBucket = new Map()
  for (const c of (filteredData.campanas || [])) {
    const bucket = c._bucket || tipoCampanaToBucket(c.tipo_campana)
    invByBucket.set(bucket, (invByBucket.get(bucket) || 0) + n(c.inversion))
  }
  const totalInv = Array.from(invByBucket.values()).reduce((a, b) => a + b, 0)
  const distRows = Array.from(invByBucket.entries()).map(([b, inv]) => ({
    Bucket: bucketToLabel(b, b),
    Inversión: inv,
    Porcentaje: totalInv > 0 ? `${((inv / totalInv) * 100).toFixed(1)}%` : '0%',
  }))
  distRows.push({ Bucket: 'TOTAL', Inversión: totalInv, Porcentaje: '100%' })
  addSheet(XLSX, wb, 'Distribución Inversión', distRows)

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. ALERTAS Y OPORTUNIDADES
  // ═══════════════════════════════════════════════════════════════════════════
  const alertas = []
  const evaluar = (nombre, valorActual, valorAnterior, umbral = 30, esMejorSiCrece = true) => {
    if (valorAnterior === 0) return
    const cambio = ((valorActual - valorAnterior) / valorAnterior) * 100
    if (Math.abs(cambio) >= umbral) {
      const tipo = (cambio > 0 && esMejorSiCrece) || (cambio < 0 && !esMejorSiCrece) ? '✅ Oportunidad' : '⚠️ Alerta'
      alertas.push({
        Indicador: nombre,
        'Valor Actual': valorActual,
        'vs Anterior': `${cambio > 0 ? '+' : ''}${cambio.toFixed(1)}%`,
        Tipo: tipo,
      })
    }
  }
  for (const plat of ['facebook', 'instagram', 'tiktok']) {
    const act = filteredData[plat] || {}
    const ant = getHist(plat, mesAnt)
    const label = plat.charAt(0).toUpperCase() + plat.slice(1)
    evaluar(`${label} — Seguidores`, n(act.seguidores), n(ant.seguidores), 10, true)
    evaluar(`${label} — Interacciones`, n(act.interacciones), n(ant.interacciones), 30, true)
    evaluar(`${label} — Inversión`, n(act.inversion), n(ant.inversion), 40, false)
  }
  // Meta compliance
  const proyActual = (allProyecciones || []).filter(p => p.mes === mesSeleccionado)
  for (const p of proyActual) {
    const meta = n(p.meta), real = n(p.real)
    if (meta === 0) continue
    const cumpl = (real / meta) * 100
    if (cumpl < 70) {
      alertas.push({ Indicador: `Meta: ${p.metrica || p.objetivo} (${p.plataforma})`, 'Valor Actual': real, 'vs Anterior': `Cumple ${cumpl.toFixed(1)}%`, Tipo: '⚠️ Alerta' })
    } else if (cumpl > 120) {
      alertas.push({ Indicador: `Meta: ${p.metrica || p.objetivo} (${p.plataforma})`, 'Valor Actual': real, 'vs Anterior': `Cumple ${cumpl.toFixed(1)}%`, Tipo: '✅ Oportunidad' })
    }
  }
  if (alertas.length > 0) addSheet(XLSX, wb, 'Alertas y Oportunidades', alertas)

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. HALLAZGOS Y OBSERVACIONES
  // ═══════════════════════════════════════════════════════════════════════════
  const hallazgos = filteredData.hallazgos || []
  const observaciones = filteredData.observaciones || []
  if (hallazgos.length > 0 || observaciones.length > 0) {
    const rows = []
    if (hallazgos.length > 0) {
      for (const h of hallazgos) {
        rows.push({ Tipo: h.tipo || 'Hallazgo', Sección: h.seccion, Título: h.titulo, Descripción: h.descripcion, Prioridad: n(h.prioridad) })
      }
    }
    if (observaciones.length > 0) {
      rows.push({ Tipo: '', Sección: '', Título: '', Descripción: '', Prioridad: '' })
      rows.push({ Tipo: '── OBSERVACIONES ──', Sección: '', Título: '', Descripción: '', Prioridad: '' })
      for (const o of observaciones) {
        rows.push({ Tipo: 'Observación', Sección: o.seccion, Título: o.titulo, Descripción: o.descripcion, Prioridad: '' })
      }
    }
    addSheet(XLSX, wb, 'Hallazgos y Obs.', rows)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. METADATOS
  // ═══════════════════════════════════════════════════════════════════════════
  addSheet(XLSX, wb, 'Metadatos', [
    { Campo: 'Marca', Valor: nombreMarca },
    { Campo: 'Mes reportado', Valor: formatMonthLong(mesSeleccionado) },
    { Campo: 'Fecha de generación', Valor: new Date().toLocaleString('es-MX') },
    { Campo: 'Versión dashboard', Valor: '2.0.0' },
    { Campo: '', Valor: '' },
    { Campo: '── LEYENDA ──', Valor: '' },
    { Campo: '✅ Oportunidad', Valor: 'Cambio positivo significativo o meta superada (>120%)' },
    { Campo: '⚠️ Alerta', Valor: 'Cambio negativo significativo o meta incumplida (<70%)' },
    { Campo: 'vs Anterior', Valor: 'Comparación con el mes inmediato anterior' },
    { Campo: 'CPR', Valor: 'Costo por resultado' },
    { Campo: 'CPM', Valor: 'Costo por mil' },
    { Campo: 'CPI', Valor: 'Costo por interacción' },
  ])

  // DOWNLOAD
  const safeName = nombreMarca.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').trim().replace(/\s+/g, '_')
  XLSX.writeFile(wb, `Dashboard_${safeName}_${mesSeleccionado}.xlsx`)
}
