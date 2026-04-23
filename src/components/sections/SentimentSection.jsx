import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, ChevronLeft, ChevronRight, Image as ImageIcon, Maximize2, X } from 'lucide-react'
import { SectionHeader, EmptyState } from '../ui/SectionHeader'
import { ChartCard } from '../ui/Charts'
import { ObservacionesCard } from '../ui/ObservacionesCard'
import { SentimentGauge } from '../ui/SentimentGauge'
import { safeNumber } from '../../utils/format'
import { isNullishString } from '../../utils/urls'

const ACCENT = '#a78bfa'

// Detect if captura is embed HTML (analyst pasted <iframe>/<blockquote>)
// or a plain image URL.
function classifyCaptura(captura) {
  const embed = captura?.embed_url ?? captura?.embed_html
  if (embed && !isNullishString(embed)) {
    const s = String(embed).trim()
    if (s.startsWith('<')) return { kind: 'embed', value: s }
  }
  if (captura?.imagen_url && !isNullishString(captura.imagen_url)) {
    return { kind: 'image', value: captura.imagen_url }
  }
  return null
}

function EmbedSlide({ html }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = html

    // Normalize any iframe to fit container
    const iframes = ref.current.querySelectorAll('iframe')
    iframes.forEach(iframe => {
      iframe.style.maxWidth = '100%'
      iframe.style.width = '100%'
      iframe.style.border = '0'
      iframe.style.display = 'block'
      iframe.setAttribute('loading', 'lazy')
    })

    const loadScript = (id, src) => {
      if (document.getElementById(id)) return
      const s = document.createElement('script')
      s.id = id; s.src = src; s.async = true
      document.body.appendChild(s)
    }

    const lc = html.toLowerCase()
    if (lc.includes('instagram')) {
      loadScript('ig-embed', 'https://www.instagram.com/embed.js')
      setTimeout(() => { try { window.instgrm?.Embeds?.process(ref.current) } catch {} }, 200)
    } else if (lc.includes('tiktok')) {
      loadScript('tt-embed', 'https://www.tiktok.com/embed.js')
    } else if (lc.includes('facebook')) {
      loadScript('fb-sdk', 'https://connect.facebook.net/es_LA/sdk.js#xfbml=1&version=v18.0')
      setTimeout(() => { try { window.FB?.XFBML?.parse(ref.current) } catch {} }, 200)
    }
  }, [html])

  return (
    <div
      ref={ref}
      className="flex items-start justify-center bg-white rounded-xl overflow-y-auto overflow-x-hidden w-full"
      style={{ maxWidth: 520, maxHeight: 620, minHeight: 420 }}
    />
  )
}

export function SentimentSection({ data, capturas = [], observaciones, loading, theme }) {
  const [slide, setSlide] = useState(0)
  const [imgError, setImgError] = useState({})
  const [modalOpen, setModalOpen] = useState(false)

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl skeleton h-96" />
        <div className="rounded-2xl skeleton h-96" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <SectionHeader icon={MessageSquare} title="Sentiment" subtitle="Sin datos para este mes" accentColor={ACCENT} />
        <EmptyState icon={MessageSquare} title="Sin análisis disponible" message="No hay datos de sentiment registrados para este mes." />
      </div>
    )
  }

  const validCapturas = capturas
    .map(c => ({ ...c, _class: classifyCaptura(c) }))
    .filter(c => c._class !== null)
    .sort((a, b) => safeNumber(a.orden) - safeNumber(b.orden))

  const next = () => setSlide(s => (s + 1) % validCapturas.length)
  const prev = () => setSlide(s => (s - 1 + validCapturas.length) % validCapturas.length)

  const currentCaptura = validCapturas[slide]

  const renderSlide = (captura, inModal = false) => {
    if (!captura?._class) return null
    if (captura._class.kind === 'embed') {
      return <EmbedSlide html={captura._class.value} />
    }
    if (imgError[slide] && !inModal) {
      return (
        <div className="flex flex-col items-center gap-3 text-white/40 py-12">
          <ImageIcon className="w-12 h-12" />
          <p className="text-sm">No se pudo cargar la imagen</p>
          <p className="text-[11px] text-white/30 max-w-md text-center break-all">
            {captura._class.value}
          </p>
        </div>
      )
    }
    return (
      <img
        src={captura._class.value}
        alt={`Captura ${slide + 1}`}
        onError={() => setImgError(p => ({ ...p, [slide]: true }))}
        className={`${inModal ? 'max-w-full max-h-[80vh]' : 'max-w-full max-h-[500px]'} object-contain rounded-lg shadow-2xl`}
      />
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={MessageSquare}
        title="Sentiment"
        subtitle="Análisis de percepción de la marca"
        accentColor={ACCENT}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Termómetro de Sentiment" subtitle="Score neto del mes" allowLogScale={false} expandable={false}>
          <SentimentGauge
            positivo={data.positivo_pct}
            neutro={data.neutro_pct}
            negativo={data.negativo_pct}
          />
        </ChartCard>

        <ChartCard title="Análisis Cualitativo" subtitle="Resumen de la conversación" allowLogScale={false} expandable={false}>
          {data.descripcion ? (
            <div className="space-y-4">
              <p className="text-white/85 leading-relaxed text-[15px] whitespace-pre-line">
                {data.descripcion}
              </p>
            </div>
          ) : (
            <p className="text-white/40 text-sm">Sin descripción cualitativa disponible</p>
          )}
        </ChartCard>
      </div>

      {validCapturas.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4 gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold font-display text-white tracking-tight">Comentarios Destacados</h3>
              <p className="text-xs text-white/50 mt-0.5">
                {validCapturas.length} {validCapturas.length === 1 ? 'captura' : 'capturas'} del mes
              </p>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors border border-white/10"
              title="Expandir"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative">
            <div className="relative bg-black/30 rounded-xl overflow-hidden" style={{ minHeight: 440 }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={slide}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.4 }}
                  className="flex items-center justify-center p-4"
                  style={{ minHeight: 440 }}
                >
                  {renderSlide(currentCaptura, false)}
                </motion.div>
              </AnimatePresence>
            </div>

            {validCapturas.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full glass-strong hover:bg-white/20 transition-colors shadow-lg"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={next}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full glass-strong hover:bg-white/20 transition-colors shadow-lg"
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
                <div className="flex justify-center gap-1.5 mt-4">
                  {validCapturas.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSlide(idx)}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === slide ? 'w-8 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {modalOpen && currentCaptura && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalOpen(false)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl w-full"
            >
              <button
                onClick={() => setModalOpen(false)}
                className="absolute -top-4 -right-4 p-2 rounded-full glass-strong hover:bg-white/20 shadow-lg z-10"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center justify-center">
                {renderSlide(currentCaptura, true)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {observaciones && <ObservacionesCard observacion={observaciones} accentColor={ACCENT} />}
    </div>
  )
}
