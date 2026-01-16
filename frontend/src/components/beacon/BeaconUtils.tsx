import { motion } from 'framer-motion'
import { Radio, Moon, Skull, X, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'
import type { BeaconStatus, JobStatus } from '../../types'

// Status color mapping - using emerald/amber palette
export const STATUS_COLORS = {
  active: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  dormant: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  dead: 'text-red-400 bg-red-400/10 border-red-400/30',
  killed: 'text-gray-500 bg-gray-500/10 border-gray-500/30'
} as const

export const JOB_STATUS_COLORS = {
  pending: 'text-blue-400 bg-blue-400/10',
  sent: 'text-cyan-400 bg-cyan-400/10',
  running: 'text-amber-400 bg-amber-400/10 animate-pulse',
  completed: 'text-emerald-400 bg-emerald-400/10',
  failed: 'text-red-400 bg-red-400/10',
  cancelled: 'text-gray-400 bg-gray-400/10'
} as const

export const STATUS_ICONS = {
  active: Radio,
  dormant: Moon,
  dead: Skull,
  killed: X
} as const

export const JOB_STATUS_ICONS = {
  pending: Clock,
  sent: Radio,
  running: Radio,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: AlertTriangle
} as const

// Terminal-style animated cursor
export function BlinkingCursor({ className }: { className?: string }) {
  return (
    <motion.span
      animate={{ opacity: [1, 0] }}
      transition={{ duration: 0.8, repeat: Infinity }}
      className={clsx("inline-block w-2 h-5 bg-emerald-400 ml-1 rounded-sm", className)}
    />
  )
}

// Status badge component
export function StatusBadge({ 
  status, 
  size = 'sm' 
}: { 
  status: BeaconStatus | JobStatus
  size?: 'xs' | 'sm' | 'md' 
}) {
  const isBeaconStatus = ['active', 'dormant', 'dead', 'killed'].includes(status)
  const colors = isBeaconStatus 
    ? STATUS_COLORS[status as BeaconStatus] 
    : JOB_STATUS_COLORS[status as JobStatus]
  
  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[10px]',
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm'
  }
  
  return (
    <span className={clsx(
      'rounded-lg font-mono uppercase border font-medium tracking-wide',
      colors,
      sizeClasses[size]
    )}>
      {status}
    </span>
  )
}

// Status icon with optional animation
export function StatusIcon({ 
  status, 
  size = 5,
  animate = true 
}: { 
  status: BeaconStatus
  size?: number
  animate?: boolean
}) {
  const Icon = STATUS_ICONS[status] || Radio
  
  const colorClass = {
    active: 'text-emerald-400',
    dormant: 'text-amber-400',
    dead: 'text-red-400',
    killed: 'text-gray-500'
  }[status]
  
  if (animate && status === 'active') {
    return (
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Icon className={clsx(`w-${size} h-${size}`, colorClass)} />
      </motion.div>
    )
  }
  
  return <Icon className={clsx(`w-${size} h-${size}`, colorClass)} />
}

// Time formatting utilities
export function getTimeSince(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  
  if (seconds < 0) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleString()
}

export function formatDuration(startDate: string | null, endDate: string | null): string {
  if (!startDate || !endDate) return 'N/A'
  const start = new Date(startDate)
  const end = new Date(endDate)
  const seconds = Math.floor((end.getTime() - start.getTime()) / 1000)
  
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

