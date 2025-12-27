import { motion } from 'framer-motion'
import { Globe, User, Server, Cpu, Clock, Send, Eye, Skull } from 'lucide-react'
import { clsx } from 'clsx'
import { STATUS_COLORS, StatusIcon, StatusBadge, getTimeSince } from './BeaconUtils'
import type { BeaconCardProps } from './types'
import type { BeaconStatus } from '../../types'

export function BeaconCard({ 
  beacon, 
  isSelected = false, 
  onSelect, 
  onTask,
  onKill,
  compact = false
}: BeaconCardProps) {
  const status = (beacon.computed_status || beacon.status) as BeaconStatus
  
  const lastSeen = beacon.last_seen 
    ? getTimeSince(new Date(beacon.last_seen))
    : 'Never'

  if (compact) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={clsx(
          'flex items-center gap-4 px-4 py-3 border-b border-gray-800/50 cursor-pointer',
          'hover:bg-gray-800/30 transition-colors',
          isSelected && 'bg-green-500/10 border-l-2 border-l-green-500'
        )}
        onClick={onSelect}
      >
        <StatusIcon status={status} size={4} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-green-400 truncate">
              {beacon.hostname}
            </span>
            <StatusBadge status={status} size="xs" />
          </div>
          <div className="text-xs text-gray-500 font-mono">
            {beacon.internal_ip} • {beacon.username}@{beacon.domain || 'WORKGROUP'}
          </div>
        </div>
        <span className="text-xs text-gray-500 font-mono">{lastSeen}</span>
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={clsx(
        'relative border rounded-lg p-4 cursor-pointer transition-all duration-200',
        'bg-gray-900/50 backdrop-blur-sm',
        isSelected 
          ? 'border-green-500 ring-2 ring-green-500/20' 
          : 'border-gray-700/50 hover:border-gray-600'
      )}
      onClick={onSelect}
    >
      {/* Status indicator pulse */}
      {status === 'active' && (
        <motion.div
          className="absolute top-3 right-3 w-3 h-3 rounded-full bg-green-400"
          animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
      
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusIcon status={status} size={5} />
          <span className="font-mono text-lg font-bold text-green-400">
            {beacon.hostname}
          </span>
        </div>
        <StatusBadge status={status} size="sm" />
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div className="flex items-center gap-2 text-gray-400">
          <Globe className="w-3.5 h-3.5" />
          <span className="font-mono">{beacon.internal_ip || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <User className="w-3.5 h-3.5" />
          <span className="font-mono truncate">{beacon.username || 'SYSTEM'}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Server className="w-3.5 h-3.5" />
          <span className="font-mono truncate">{beacon.domain || 'WORKGROUP'}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Cpu className="w-3.5 h-3.5" />
          <span className="font-mono">{beacon.architecture || 'x64'}</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs border-t border-gray-700/50 pt-3">
        <div className="flex items-center gap-1 text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono">{lastSeen}</span>
        </div>
        <div className="flex items-center gap-3">
          {beacon.pending_jobs > 0 && (
            <span className="flex items-center gap-1 text-blue-400">
              <Clock className="w-3.5 h-3.5" />
              {beacon.pending_jobs}
            </span>
          )}
          <span className="text-gray-500 font-mono">
            #{beacon.check_in_count}
          </span>
        </div>
      </div>
      
      <div className="flex gap-2 mt-3">
        {onTask && (
          <button
            onClick={(e) => { e.stopPropagation(); onTask(); }}
            className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors text-sm font-mono"
          >
            <Send className="w-3.5 h-3.5" />
            TASK
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
          className="flex items-center justify-center gap-2 py-1.5 px-3 rounded bg-gray-700/50 text-gray-400 hover:bg-gray-700 transition-colors text-sm"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        {onKill && status !== 'killed' && (
          <button
            onClick={(e) => { e.stopPropagation(); onKill(); }}
            className="flex items-center justify-center gap-2 py-1.5 px-3 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm"
            title="Kill beacon"
          >
            <Skull className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

