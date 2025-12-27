import { motion } from 'framer-motion'
import { Activity, Radio, CheckCircle, XCircle, AlertTriangle, Clock } from 'lucide-react'
import { clsx } from 'clsx'
import { getTimeSince } from './BeaconUtils'
import type { ActivityFeedProps } from './types'

const ACTIVITY_ICONS = {
  checkin: Radio,
  job_completed: CheckCircle,
  job_failed: XCircle,
  job_received: Clock,
  error: AlertTriangle,
  default: Activity
} as const

const ACTIVITY_COLORS = {
  checkin: 'text-green-400',
  job_completed: 'text-green-400',
  job_failed: 'text-red-400',
  job_received: 'text-blue-400',
  error: 'text-yellow-400',
  default: 'text-gray-400'
} as const

export function ActivityFeed({ 
  activities, 
  loading = false,
  maxItems = 50,
  showBeaconColumn = true
}: ActivityFeedProps) {
  if (loading) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="h-5 bg-gray-700 rounded w-32 animate-pulse" />
        </div>
        <div className="divide-y divide-gray-800">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3">
              <div className="w-6 h-6 bg-gray-700 rounded animate-pulse" />
              <div className="flex-1">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-2 animate-pulse" />
                <div className="h-3 bg-gray-700 rounded w-1/2 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="font-mono text-green-400 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          ACTIVITY FEED
        </h3>
        <span className="text-xs text-gray-500 font-mono">{activities.length}</span>
      </div>
      
      <div className="divide-y divide-gray-800/50 max-h-[400px] overflow-y-auto">
        {activities.slice(0, maxItems).map((activity, index) => {
          const activityType = activity.activity_type as keyof typeof ACTIVITY_ICONS
          const Icon = ACTIVITY_ICONS[activityType] || ACTIVITY_ICONS.default
          const color = ACTIVITY_COLORS[activityType] || ACTIVITY_COLORS.default
          
          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.02 }}
              className="px-4 py-3 flex items-start gap-3 hover:bg-gray-800/30"
            >
              <div className={clsx('p-1.5 rounded', `${color.replace('text', 'bg')}/10`)}>
                <Icon className={clsx('w-4 h-4', color)} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm text-white capitalize">
                    {activity.activity_type.replace('_', ' ')}
                  </span>
                  {showBeaconColumn && activity.hostname && (
                    <span className="text-xs text-gray-500 font-mono">
                      • {activity.hostname}
                    </span>
                  )}
                </div>
                
                {activity.details && Object.keys(activity.details).length > 0 && (
                  <div className="text-xs text-gray-500 font-mono">
                    {Object.entries(activity.details).map(([key, value]) => (
                      <span key={key} className="mr-3">
                        {key}: {String(value).substring(0, 30)}
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                  {activity.ip_address && (
                    <span className="font-mono">{activity.ip_address}</span>
                  )}
                  <span className="font-mono">
                    {activity.created_at ? getTimeSince(new Date(activity.created_at)) : ''}
                  </span>
                </div>
              </div>
            </motion.div>
          )
        })}
        
        {activities.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-500">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-mono">No activity yet</p>
          </div>
        )}
      </div>
    </div>
  )
}

