import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { useCountUp } from '../../hooks/useCountUp'
import { formatNumber } from '../../utils/format'

/**
 * KPI Card with:
 *   - Animated count-up number
 *   - Optional sparkline trend (last N months)
 *   - Variation badge with color
 *   - Glass card with hover lift
 */
export function KPICard({
  title,
  value,
  variation,
  subtitle,
  icon: Icon,
  prefix = '',
  suffix = '',
  delay = 0,
  trendData = null,        // [{mes, value}, ...] sparkline data
  accentColor = '#ffffff',
  formatter = null,         // optional custom formatter for the count-up display
}) {
  const numValue = parseFloat(value)
  const isCountable = !isNaN(numValue) && Math.abs(numValue) < 1e9
  const animated = useCountUp(isCountable ? numValue : 0, { duration: 1200 })
  const display = isCountable
    ? (formatter ? formatter(animated) : formatNumber(animated))
    : value

  const hasVariation = variation !== null && variation !== undefined && !isNaN(parseFloat(variation))
  const numVariation = parseFloat(variation)
  const isPositive = hasVariation && numVariation > 0
  const isNegative = hasVariation && numVariation < 0

  // Determine sparkline color
  const trendColor = isPositive ? '#22c55e' : isNegative ? '#ef4444' : accentColor
  const trendId = `spark-${title.replace(/\s/g, '')}-${delay}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: delay * 0.07, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card relative overflow-hidden rounded-2xl p-5 group"
    >
      {/* Accent corner glow */}
      <div
        className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-30 transition-opacity group-hover:opacity-50"
        style={{ background: accentColor }}
      />

      <div className="relative">
        {/* Icon + variation badge row */}
        <div className="flex items-start justify-between mb-4">
          {Icon && (
            <div
              className="p-2.5 rounded-xl"
              style={{
                background: `${accentColor}22`,
                boxShadow: `inset 0 0 0 1px ${accentColor}33`,
              }}
            >
              <Icon className="w-4 h-4" style={{ color: accentColor }} />
            </div>
          )}

          {hasVariation && (
            <div
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold
                ${isPositive ? 'badge-positive' : ''}
                ${isNegative ? 'badge-negative' : ''}
                ${!isPositive && !isNegative ? 'badge-neutral' : ''}`}
            >
              {isPositive && <TrendingUp className="w-3 h-3" />}
              {isNegative && <TrendingDown className="w-3 h-3" />}
              {!isPositive && !isNegative && <Minus className="w-3 h-3" />}
              <span>{isPositive ? '+' : ''}{numVariation.toFixed(1)}%</span>
            </div>
          )}
        </div>

        {/* Title */}
        <p className="text-[11px] font-semibold text-white/55 mb-1.5 uppercase tracking-wider">
          {title}
        </p>

        {/* Value */}
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-3xl font-bold font-display text-white tracking-tight">
            {prefix}{display}{suffix}
          </span>
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-xs text-white/50 mb-3">{subtitle}</p>
        )}

        {/* Sparkline */}
        {trendData && trendData.length > 1 && (
          <div className="mt-3 h-10 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id={trendId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={trendColor} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={trendColor}
                  strokeWidth={2}
                  fill={`url(#${trendId})`}
                  isAnimationActive
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function KPICardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-5 h-[160px]">
      <div className="w-10 h-10 rounded-xl skeleton mb-4" />
      <div className="h-3 w-20 skeleton rounded mb-2" />
      <div className="h-8 w-28 skeleton rounded mb-2" />
      <div className="h-10 w-full skeleton rounded mt-3" />
    </div>
  )
}
