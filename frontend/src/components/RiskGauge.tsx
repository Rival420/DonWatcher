import { clsx } from 'clsx'
import { motion } from 'framer-motion'

interface RiskGaugeProps {
  value: number
  label: string
  maxValue?: number
  size?: 'sm' | 'md' | 'lg'
}

export function RiskGauge({ value, label, maxValue = 100, size = 'md' }: RiskGaugeProps) {
  const percentage = Math.min((value / maxValue) * 100, 100)
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (percentage / 100) * circumference * 0.75
  
  const getColor = () => {
    if (percentage >= 75) return { color: '#ef4444', glow: 'rgba(239, 68, 68, 0.5)' }
    if (percentage >= 50) return { color: '#f97316', glow: 'rgba(249, 115, 22, 0.5)' }
    if (percentage >= 25) return { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.5)' }
    return { color: '#10b981', glow: 'rgba(16, 185, 129, 0.5)' }
  }
  
  const { color, glow } = getColor()
  
  const sizeClasses = {
    sm: 'w-24 h-24',
    md: 'w-32 h-32',
    lg: 'w-40 h-40',
  }
  
  const textSizes = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
  }
  
  return (
    <div className={clsx('relative', sizeClasses[size])}>
      <svg className="w-full h-full transform -rotate-[135deg]" viewBox="0 0 100 100">
        {/* Background arc */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#1e3a5f"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.25}
        />
        
        {/* Animated value arc */}
        <motion.circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{
            filter: `drop-shadow(0 0 10px ${glow})`,
          }}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span 
          className={clsx('font-display font-bold', textSizes[size])}
          style={{ color }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          {value}
        </motion.span>
        <span className="text-xs text-cyber-text-muted uppercase tracking-wider mt-1">
          {label}
        </span>
      </div>
    </div>
  )
}

