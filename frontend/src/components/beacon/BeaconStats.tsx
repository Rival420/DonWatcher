import { motion } from 'framer-motion'
import { Radio, Moon, Clock, Activity, Zap, TrendingUp } from 'lucide-react'
import { clsx } from 'clsx'
import type { BeaconStatsProps } from './types'

export function BeaconStats({ stats, loading = false }: BeaconStatsProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="relative overflow-hidden rounded-xl bg-gray-900/60 backdrop-blur-sm border border-gray-800/50 p-5">
            <div className="h-8 bg-gray-800/50 rounded w-16 mb-3 animate-pulse" />
            <div className="h-4 bg-gray-800/50 rounded w-24 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  const statItems = [
    {
      label: 'ACTIVE BEACONS',
      value: stats.active_beacons,
      icon: Radio,
      gradient: 'from-emerald-500/20 to-green-500/5',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      valueColor: 'text-emerald-400',
      borderColor: 'border-emerald-500/20',
      pulseColor: 'bg-emerald-400'
    },
    {
      label: 'DORMANT',
      value: stats.dormant_beacons,
      icon: Moon,
      gradient: 'from-amber-500/20 to-yellow-500/5',
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
      valueColor: 'text-amber-400',
      borderColor: 'border-amber-500/20',
      pulseColor: 'bg-amber-400'
    },
    {
      label: 'PENDING JOBS',
      value: stats.pending_jobs,
      icon: Clock,
      gradient: 'from-blue-500/20 to-cyan-500/5',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      valueColor: 'text-blue-400',
      borderColor: 'border-blue-500/20',
      pulseColor: 'bg-blue-400'
    },
    {
      label: 'COMPLETED (24H)',
      value: stats.completed_jobs_24h,
      icon: Activity,
      gradient: 'from-violet-500/20 to-purple-500/5',
      iconBg: 'bg-violet-500/20',
      iconColor: 'text-violet-400',
      valueColor: 'text-violet-400',
      borderColor: 'border-violet-500/20',
      pulseColor: 'bg-violet-400'
    }
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {statItems.map((item, index) => {
        const Icon = item.icon
        const isHighlighted = item.value > 0 && index === 0
        
        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.4 }}
            className={clsx(
              'relative overflow-hidden rounded-xl',
              'bg-gradient-to-br', item.gradient,
              'backdrop-blur-sm border',
              item.borderColor,
              'p-5 group hover:scale-[1.02] transition-transform duration-300'
            )}
          >
            {/* Subtle glow effect for active items */}
            {isHighlighted && (
              <div className="absolute inset-0 bg-emerald-500/5 animate-pulse" />
            )}
            
            {/* Background pattern */}
            <div className="absolute top-0 right-0 w-24 h-24 opacity-5">
              <Icon className="w-full h-full" />
            </div>
            
            <div className="relative flex items-start justify-between">
              <div>
                <motion.p 
                  className={clsx('text-4xl font-bold tracking-tight', item.valueColor)}
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.08 + 0.2, type: 'spring' }}
                >
                  {item.value}
                </motion.p>
                <p className="text-xs text-gray-500 font-mono mt-2 tracking-wider">
                  {item.label}
                </p>
              </div>
              
              <div className={clsx(
                'p-2.5 rounded-lg transition-colors duration-300',
                item.iconBg,
                'group-hover:scale-110 transition-transform'
              )}>
                <Icon className={clsx('w-5 h-5', item.iconColor)} />
              </div>
            </div>
            
            {/* Active indicator bar */}
            {item.value > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5">
                <motion.div 
                  className={clsx('h-full', item.pulseColor)}
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ delay: index * 0.1 + 0.3, duration: 0.5 }}
                />
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
