import { motion } from 'framer-motion'
import { Globe, User, Server, Cpu, Clock, Send, Eye, Skull, Wifi } from 'lucide-react'
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={clsx(
          'flex items-center gap-4 px-5 py-3.5',
          'border-b border-gray-800/30 cursor-pointer',
          'hover:bg-gradient-to-r hover:from-emerald-500/5 hover:to-transparent',
          'transition-all duration-200',
          isSelected && 'bg-gradient-to-r from-emerald-500/10 to-transparent border-l-2 border-l-emerald-500'
        )}
        onClick={onSelect}
      >
        <StatusIcon status={status} size={4} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-emerald-400 truncate">
              {beacon.hostname}
            </span>
            <StatusBadge status={status} size="xs" />
          </div>
          <div className="text-xs text-gray-500 font-mono mt-0.5">
            {beacon.internal_ip} • {beacon.username}@{beacon.domain || 'WORKGROUP'}
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-500 font-mono">{lastSeen}</span>
          {beacon.pending_jobs > 0 && (
            <div className="text-xs text-blue-400 font-mono mt-0.5">
              {beacon.pending_jobs} pending
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      className={clsx(
        'relative overflow-hidden rounded-xl p-5 cursor-pointer',
        'bg-gradient-to-br from-gray-900/80 to-gray-900/40',
        'backdrop-blur-sm border transition-all duration-300',
        isSelected 
          ? 'border-emerald-500/50 ring-2 ring-emerald-500/20 shadow-xl shadow-emerald-500/10' 
          : 'border-gray-800/50 hover:border-gray-700/50 hover:shadow-lg hover:shadow-black/20'
      )}
      onClick={onSelect}
    >
      {/* Status glow effect */}
      {status === 'active' && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
      )}
      
      {/* Header */}
      <div className="relative flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'relative p-2 rounded-lg',
            status === 'active' ? 'bg-emerald-500/20' : 'bg-gray-800/50'
          )}>
            <StatusIcon status={status} size={5} />
            {/* Pulse ring for active */}
            {status === 'active' && (
              <motion.div
                className="absolute inset-0 rounded-lg border-2 border-emerald-400/50"
                animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </div>
          <div>
            <h3 className="font-mono text-lg font-bold text-white leading-tight">
              {beacon.hostname}
            </h3>
            <p className="text-xs text-gray-500 font-mono mt-0.5">
              {beacon.beacon_id.substring(0, 12)}...
            </p>
          </div>
        </div>
        <StatusBadge status={status} size="sm" />
      </div>
      
      {/* Info grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <InfoRow icon={Globe} label="IP" value={beacon.internal_ip || 'N/A'} />
        <InfoRow icon={User} label="User" value={beacon.username || 'SYSTEM'} />
        <InfoRow icon={Server} label="Domain" value={beacon.domain || 'WORKGROUP'} />
        <InfoRow icon={Cpu} label="Arch" value={beacon.architecture || 'x64'} />
      </div>
      
      {/* Footer with timing and stats */}
      <div className="flex items-center justify-between py-3 border-t border-gray-800/50">
        <div className="flex items-center gap-2 text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs font-mono">{lastSeen}</span>
        </div>
        <div className="flex items-center gap-3">
          {beacon.pending_jobs > 0 && (
            <motion.span 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-mono"
            >
              <Clock className="w-3 h-3" />
              {beacon.pending_jobs}
            </motion.span>
          )}
          <span className="flex items-center gap-1.5 text-gray-500 text-xs font-mono">
            <Wifi className="w-3 h-3" />
            #{beacon.check_in_count}
          </span>
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        {onTask && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={(e) => { e.stopPropagation(); onTask(); }}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg',
              'bg-gradient-to-r from-emerald-500/20 to-green-500/20',
              'text-emerald-400 border border-emerald-500/30',
              'hover:from-emerald-500/30 hover:to-green-500/30',
              'transition-all duration-200 text-sm font-mono font-medium'
            )}
          >
            <Send className="w-3.5 h-3.5" />
            TASK
          </motion.button>
        )}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
          className={clsx(
            'flex items-center justify-center gap-2 py-2 px-3 rounded-lg',
            'bg-gray-800/50 text-gray-400 border border-gray-700/50',
            'hover:bg-gray-700/50 hover:text-white',
            'transition-all duration-200'
          )}
        >
          <Eye className="w-3.5 h-3.5" />
        </motion.button>
        {onKill && status !== 'killed' && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => { e.stopPropagation(); onKill(); }}
            className={clsx(
              'flex items-center justify-center gap-2 py-2 px-3 rounded-lg',
              'bg-red-500/10 text-red-400 border border-red-500/30',
              'hover:bg-red-500/20',
              'transition-all duration-200'
            )}
            title="Kill beacon"
          >
            <Skull className="w-3.5 h-3.5" />
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

// Helper component for info rows
function InfoRow({ icon: Icon, label, value }: { icon: typeof Globe, label: string, value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
      <span className="text-gray-400 font-mono truncate">{value}</span>
    </div>
  )
}