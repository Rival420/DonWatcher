import { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  icon: ReactNode
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  color?: 'cyan' | 'green' | 'yellow' | 'red' | 'purple'
}

const colorClasses = {
  cyan: {
    icon: 'text-cyber-accent-cyan bg-cyber-accent-cyan/10',
    border: 'border-cyber-accent-cyan/30 hover:border-cyber-accent-cyan/50',
    glow: 'shadow-glow-cyan',
  },
  green: {
    icon: 'text-cyber-accent-green bg-cyber-accent-green/10',
    border: 'border-cyber-accent-green/30 hover:border-cyber-accent-green/50',
    glow: 'shadow-glow-green',
  },
  yellow: {
    icon: 'text-cyber-accent-yellow bg-cyber-accent-yellow/10',
    border: 'border-cyber-accent-yellow/30 hover:border-cyber-accent-yellow/50',
    glow: 'shadow-glow-yellow',
  },
  red: {
    icon: 'text-cyber-accent-red bg-cyber-accent-red/10',
    border: 'border-cyber-accent-red/30 hover:border-cyber-accent-red/50',
    glow: 'shadow-glow-red',
  },
  purple: {
    icon: 'text-cyber-accent-purple bg-cyber-accent-purple/10',
    border: 'border-cyber-accent-purple/30 hover:border-cyber-accent-purple/50',
    glow: '',
  },
}

export function StatsCard({ title, value, icon, trend, trendValue, color = 'cyan' }: StatsCardProps) {
  const colors = colorClasses[color]
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'cyber-card p-5 border transition-all duration-300',
        colors.border
      )}
    >
      <div className="flex items-start justify-between">
        <div className={clsx('p-3 rounded-lg', colors.icon)}>
          {icon}
        </div>
        
        {trend && (
          <div className={clsx(
            'flex items-center gap-1 text-sm font-medium',
            trend === 'up' && 'text-cyber-accent-red',
            trend === 'down' && 'text-cyber-accent-green',
            trend === 'stable' && 'text-cyber-text-muted'
          )}>
            {trend === 'up' && <TrendingUp className="w-4 h-4" />}
            {trend === 'down' && <TrendingDown className="w-4 h-4" />}
            {trend === 'stable' && <Minus className="w-4 h-4" />}
            {trendValue}
          </div>
        )}
      </div>
      
      <div className="mt-4">
        <h3 className="text-sm text-cyber-text-secondary font-medium">{title}</h3>
        <p className="text-2xl font-display font-bold text-cyber-text-primary mt-1">
          {value}
        </p>
      </div>
    </motion.div>
  )
}

