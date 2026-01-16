import { motion } from 'framer-motion'
import { Terminal, Clock, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { JOB_STATUS_COLORS, getTimeSince } from './BeaconUtils'
import type { JobsPanelProps } from './types'

const STATUS_ICONS = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: AlertCircle
} as const

export function JobsPanel({ 
  jobs, 
  loading = false, 
  onJobClick,
  showBeaconInfo = false,
  maxItems = 20,
  title = 'RECENT JOBS'
}: JobsPanelProps) {
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-900/60 to-gray-900/40 backdrop-blur-sm border border-gray-800/50 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800/50">
          <div className="h-5 bg-gray-800/50 rounded w-32 animate-pulse" />
        </div>
        <div className="divide-y divide-gray-800/30">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-5 py-4">
              <div className="h-4 bg-gray-800/50 rounded w-3/4 mb-2 animate-pulse" />
              <div className="h-3 bg-gray-800/50 rounded w-1/2 animate-pulse" />
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
            <Terminal className="w-3.5 h-3.5" />
          </div>
          {title}
        </h3>
        <span className="px-2.5 py-1 rounded-lg bg-gray-800/50 text-xs text-gray-400 font-mono">
          {jobs.length}
        </span>
      </div>
      
      <div className="divide-y divide-gray-800/30 max-h-[500px] overflow-y-auto">
        {jobs.slice(0, maxItems).map((job, index) => {
          const StatusIcon = STATUS_ICONS[job.status as keyof typeof STATUS_ICONS] || Clock
          
          return (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.02 }}
              className={clsx(
                'px-5 py-4 transition-all duration-200',
                onJobClick && 'hover:bg-gradient-to-r hover:from-gray-800/30 hover:to-transparent cursor-pointer'
              )}
              onClick={() => onJobClick?.(job)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <StatusIcon className={clsx(
                    'w-4 h-4',
                    job.status === 'running' && 'animate-spin text-amber-400',
                    job.status === 'completed' && 'text-emerald-400',
                    job.status === 'failed' && 'text-red-400',
                    job.status === 'pending' && 'text-blue-400',
                    job.status === 'cancelled' && 'text-gray-400'
                  )} />
                  <span className="font-mono text-sm text-white font-medium">
                    {job.job_type.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <span className={clsx(
                  'px-2.5 py-1 rounded-lg text-xs font-mono',
                  JOB_STATUS_COLORS[job.status]
                )}>
                  {job.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="font-mono truncate max-w-[60%]">
                  {showBeaconInfo 
                    ? `${job.beacon_id.substring(0, 12)}...`
                    : job.command?.substring(0, 30) || 'No command'
                  }
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  {job.created_at ? getTimeSince(new Date(job.created_at)) : 'N/A'}
                </span>
              </div>
              {job.exit_code !== null && job.exit_code !== undefined && (
                <div className="mt-2 text-xs">
                  <span className={clsx(
                    'px-2 py-0.5 rounded font-mono',
                    job.exit_code === 0 
                      ? 'bg-emerald-500/20 text-emerald-400' 
                      : 'bg-red-500/20 text-red-400'
                  )}>
                    Exit: {job.exit_code}
                  </span>
                </div>
              )}
            </motion.div>
          )
        })}
        
        {jobs.length === 0 && (
          <div className="px-5 py-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gray-800/50 flex items-center justify-center">
              <Terminal className="w-6 h-6 text-gray-600" />
            </div>
            <p className="text-sm font-mono text-gray-500">No jobs yet</p>
            <p className="text-xs text-gray-600 mt-1">Jobs will appear here when beacons execute tasks</p>
          </div>
        )}
      </div>
    </div>
  )
}

