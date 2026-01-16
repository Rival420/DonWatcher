import { motion } from 'framer-motion'
import { Activity, Radio, CheckCircle, XCircle, AlertTriangle, Clock, Zap } from 'lucide-react'
import { clsx } from 'clsx'
import { getTimeSince } from './BeaconUtils'
import type { ActivityFeedProps } from './types'

const ACTIVITY_CONFIG = {
  checkin: { icon: Radio, color: 'emerald', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  job_completed: { icon: CheckCircle, color: 'emerald', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  job_failed: { icon: XCircle, color: 'red', bg: 'bg-red-500/20', text: 'text-red-400' },
  job_received: { icon: Clock, color: 'blue', bg: 'bg-blue-500/20', text: 'text-blue-400' },
  error: { icon: AlertTriangle, color: 'amber', bg: 'bg-amber-500/20', text: 'text-amber-400' },
  default: { icon: Activity, color: 'gray', bg: 'bg-gray-700/50', text: 'text-gray-400' }
} as const

export function ActivityFeed({ 
  activities, 
  loading = false,
  maxItems = 50,
  showBeaconColumn = true
}: ActivityFeedProps) {
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-900/60 to-gray-900/40 backdrop-blur-sm border border-gray-800/50 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800/50">
          <div className="h-5 bg-gray-800/50 rounded w-32 animate-pulse" />
        </div>
        <div className="divide-y divide-gray-800/30">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-5 py-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-800/50 rounded-lg animate-pulse" />
              <div className="flex-1">
                <div className="h-4 bg-gray-800/50 rounded w-3/4 mb-2 animate-pulse" />
                <div className="h-3 bg-gray-800/50 rounded w-1/2 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-gray-900/60 to-gray-900/40 backdrop-blur-sm border border-gray-800/50 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800/50 flex items-center justify-between">
        <h3 className="font-mono text-sm text-emerald-400 flex items-center gap-2.5 uppercase tracking-wider">
          <div className="p-1.5 rounded-lg bg-emerald-500/20">
            <Zap className="w-3.5 h-3.5" />
          </div>
          ACTIVITY FEED
        </h3>
        <span className="px-2.5 py-1 rounded-lg bg-gray-800/50 text-xs text-gray-400 font-mono">
          {activities.length}
        </span>
      </div>
      
      <div className="divide-y divide-gray-800/30 max-h-[400px] overflow-y-auto">
        {activities.slice(0, maxItems).map((activity, index) => {
          const activityType = activity.activity_type as keyof typeof ACTIVITY_CONFIG
          const config = ACTIVITY_CONFIG[activityType] || ACTIVITY_CONFIG.default
          const Icon = config.icon
          
          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.02 }}
              className="px-5 py-4 flex items-start gap-3.5 hover:bg-gradient-to-r hover:from-gray-800/30 hover:to-transparent transition-colors"
            >
              <div className={clsx('p-2 rounded-lg', config.bg)}>
                <Icon className={clsx('w-4 h-4', config.text)} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm text-white capitalize font-medium">
                    {activity.activity_type.replace('_', ' ')}
                  </span>
                  {showBeaconColumn && activity.hostname && (
                    <span className="px-2 py-0.5 rounded bg-gray-800/50 text-xs text-gray-500 font-mono">
                      {activity.hostname}
                    </span>
                  )}
                </div>
                
                {activity.details && Object.keys(activity.details).length > 0 && (
                  <div className="text-xs text-gray-500 font-mono mt-1">
                    {Object.entries(activity.details).slice(0, 2).map(([key, value]) => (
                      <span key={key} className="inline-block mr-3 px-2 py-0.5 rounded bg-gray-800/30">
                        {key}: {String(value).substring(0, 20)}
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                  {activity.ip_address && (
                    <span className="font-mono">{activity.ip_address}</span>
                  )}
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    {activity.created_at ? getTimeSince(new Date(activity.created_at)) : ''}
                  </span>
                </div>
              </div>
            </motion.div>
          )
        })}
        
        {activities.length === 0 && (
          <div className="px-5 py-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gray-800/50 flex items-center justify-center">
              <Activity className="w-6 h-6 text-gray-600" />
            </div>
            <p className="text-sm font-mono text-gray-500">No activity yet</p>
            <p className="text-xs text-gray-600 mt-1">Beacon check-ins and events will appear here</p>
          </div>
        )}
      </div>
    </div>
  )
}

