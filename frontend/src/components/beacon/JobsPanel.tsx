import { motion } from 'framer-motion'
import { Terminal, Clock } from 'lucide-react'
import { clsx } from 'clsx'
import { JOB_STATUS_COLORS, getTimeSince } from './BeaconUtils'
import type { JobsPanelProps } from './types'

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
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <div className="h-5 bg-gray-700 rounded w-32 animate-pulse" />
        </div>
        <div className="divide-y divide-gray-800">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-3">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-2 animate-pulse" />
              <div className="h-3 bg-gray-700 rounded w-1/2 animate-pulse" />
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
          <Terminal className="w-4 h-4" />
          {title}
        </h3>
        <span className="text-xs text-gray-500 font-mono">{jobs.length}</span>
      </div>
      
      <div className="divide-y divide-gray-800 max-h-[500px] overflow-y-auto">
        {jobs.slice(0, maxItems).map(job => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={clsx(
              'px-4 py-3 transition-colors',
              onJobClick ? 'hover:bg-gray-800/50 cursor-pointer' : ''
            )}
            onClick={() => onJobClick?.(job)}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-white">
                  {job.job_type.replace('_', ' ').toUpperCase()}
                </span>
                {job.status === 'running' && (
                  <motion.span
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-xs text-yellow-400"
                  >
                    ●
                  </motion.span>
                )}
              </div>
              <span className={clsx(
                'px-2 py-0.5 rounded text-xs font-mono',
                JOB_STATUS_COLORS[job.status]
              )}>
                {job.status}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="font-mono">
                {showBeaconInfo 
                  ? `${job.beacon_id.substring(0, 12)}...`
                  : job.command?.substring(0, 30) || 'No command'
                }
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {job.created_at ? getTimeSince(new Date(job.created_at)) : 'N/A'}
              </span>
            </div>
            {job.exit_code !== null && job.exit_code !== undefined && (
              <div className="mt-1 text-xs">
                <span className={clsx(
                  'font-mono',
                  job.exit_code === 0 ? 'text-green-400' : 'text-red-400'
                )}>
                  Exit: {job.exit_code}
                </span>
              </div>
            )}
          </motion.div>
        ))}
        
        {jobs.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-500">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-mono">No jobs yet</p>
          </div>
        )}
      </div>
    </div>
  )
}

