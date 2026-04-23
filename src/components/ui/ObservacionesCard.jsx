import { motion } from 'framer-motion'
import { MessageCircle, Lightbulb } from 'lucide-react'

export function ObservacionesCard({ observacion, accentColor = '#ffffff' }) {
  if (!observacion?.observacion) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass-card rounded-2xl p-6 relative overflow-hidden"
    >
      <div
        className="absolute -top-20 -left-20 w-48 h-48 rounded-full blur-3xl opacity-20"
        style={{ background: accentColor }}
      />
      <div className="relative flex gap-4">
        <div
          className="flex-shrink-0 p-2.5 rounded-xl h-fit"
          style={{
            background: `${accentColor}22`,
            boxShadow: `inset 0 0 0 1px ${accentColor}33`,
          }}
        >
          <Lightbulb className="w-5 h-5" style={{ color: accentColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-sm font-bold font-display text-white uppercase tracking-wider">
              Observaciones
            </h4>
            <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
          </div>
          <p className="text-white/80 leading-relaxed text-[15px] whitespace-pre-line">
            {observacion.observacion}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
