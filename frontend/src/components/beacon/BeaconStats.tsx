import { motion } from 'framer-motion'
import { Radio, Moon, Clock, Activity } from 'lucide-react'
import { clsx } from 'clsx'
import type { BeaconStatsProps } from './types'

export function BeaconStats({ stats, loading = false }: BeaconStatsProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-12 mb-2" />
            <div className="h-4 bg-gray-700 rounded w-20" />
          </div>
        ))}
      </div>
    )
  }

  const statItems = [
    {
      label: 'ACTIVE',
      value: stats.active_beacons,
      icon: Radio,
      color: 'green',
      borderColor: 'border-green-500/20'
    },
    {
      label: 'DORMANT',
      value: stats.dormant_beacons,
      icon: Moon,
      color: 'yellow',
      borderColor: 'border-yellow-500/20'
    },
    {
      label: 'PENDING JOBS',
      value: stats.pending_jobs,
      icon: Clock,
      color: 'blue',
      borderColor: 'border-blue-500/20'
    },
    {
      label: 'JOBS (24H)',
      value: stats.completed_jobs_24h,
      icon: Activity,
      color: 'gray',
      borderColor: 'border-gray-500/20'
    }
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {statItems.map((item, index) => {
        const Icon = item.icon
        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={clsx(
              'bg-gray-900/50 border rounded-lg p-4',
              item.borderColor
            )}
          >
            <div className="flex items-center gap-3">
              <div className={clsx(
                'p-2 rounded',
                `bg-${item.color}-500/20`
              )} style={{ backgroundColor: `rgba(var(--${item.color}-500), 0.2)` }}>
                <Icon className={clsx('w-5 h-5', `text-${item.color}-400`)} 
                  style={{ color: item.color === 'green' ? '#4ade80' : item.color === 'yellow' ? '#facc15' : item.color === 'blue' ? '#60a5fa' : '#9ca3af' }} />
              </div>
              <div>
                <p className={clsx('text-2xl font-bold', `text-${item.color}-400`)}
                  style={{ color: item.color === 'green' ? '#4ade80' : item.color === 'yellow' ? '#facc15' : item.color === 'blue' ? '#60a5fa' : '#9ca3af' }}>
                  {item.value}
                </p>
                <p className="text-xs text-gray-500 font-mono">{item.label}</p>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

