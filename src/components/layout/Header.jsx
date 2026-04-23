import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Calendar, Maximize2, Minimize2, ChevronDown } from 'lucide-react'
import { formatMonthLong } from '../../utils/format'

export function Header({
  brandConfig, theme, months = [], selectedMonth, onMonthChange,
  onRefresh, isRefreshing, presentationMode, setPresentationMode,
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <header
      className="sticky top-0 z-20 px-4 md:px-6 py-4"
      style={{
        background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 100%)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left: title */}
        <div className="min-w-0 flex-1">
          <h2 className="text-xs uppercase tracking-widest text-white/45 font-semibold">
            Reporte mensual
          </h2>
          <p className="text-lg md:text-xl font-bold font-display text-white truncate tracking-tight">
            {brandConfig?.nombre || 'Dashboard'}
            {selectedMonth && <span className="text-white/40 font-normal"> · {formatMonthLong(selectedMonth)}</span>}
          </p>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2">
          {/* Month picker */}
          {months.length > 0 && (
            <div className="relative" ref={pickerRef}>
              <button
                onClick={() => setPickerOpen(!pickerOpen)}
                className="glass-strong flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white hover:bg-white/15 transition-colors"
              >
                <Calendar className="w-4 h-4 text-white/65" />
                <span>{formatMonthLong(selectedMonth) || 'Seleccionar mes'}</span>
                <ChevronDown className={`w-4 h-4 text-white/65 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {pickerOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-56 glass-strong rounded-xl overflow-hidden shadow-2xl"
                  >
                    <div className="max-h-72 overflow-y-auto p-1.5">
                      {months.map((m) => (
                        <button
                          key={m}
                          onClick={() => { onMonthChange(m); setPickerOpen(false) }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            m === selectedMonth
                              ? 'bg-white/15 text-white font-semibold'
                              : 'text-white/70 hover:bg-white/8 hover:text-white'
                          }`}
                          style={m === selectedMonth ? {
                            background: `linear-gradient(135deg, ${theme.primary}33, ${theme.primary}11)`,
                            border: `1px solid ${theme.primary}55`,
                          } : {}}
                        >
                          {formatMonthLong(m)}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="glass-strong p-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition-colors disabled:opacity-50"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Presentation mode */}
          <button
            onClick={() => setPresentationMode(!presentationMode)}
            className="glass-strong p-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition-colors hidden md:flex"
            title="Modo presentación"
          >
            {presentationMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  )
}
