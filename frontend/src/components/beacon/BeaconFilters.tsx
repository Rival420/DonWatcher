import { Search, Filter, Radio, Moon, Skull, XCircle } from 'lucide-react'
import { clsx } from 'clsx'
import type { BeaconFiltersProps } from './types'

const STATUS_OPTIONS = [
  { value: 'all', label: 'ALL', icon: null, color: 'gray' },
  { value: 'active', label: 'ACTIVE', icon: Radio, color: 'emerald' },
  { value: 'dormant', label: 'DORMANT', icon: Moon, color: 'amber' },
  { value: 'dead', label: 'DEAD', icon: XCircle, color: 'red' },
  { value: 'killed', label: 'KILLED', icon: Skull, color: 'rose' }
] as const

export function BeaconFilters({ 
  statusFilter, 
  searchQuery, 
  onStatusChange, 
  onSearchChange 
}: BeaconFiltersProps) {
  return (
    <div className="flex items-center gap-4 flex-1">
      {/* Search */}
      <div className="relative flex-1 max-w-md group">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-lg opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity duration-300" />
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
        <input
          type="text"
          placeholder="Search beacons..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className={clsx(
            'relative w-full pl-11 pr-4 py-2.5 rounded-lg',
            'bg-gray-900/60 backdrop-blur-sm',
            'border border-gray-700/50',
            'font-mono text-sm text-white placeholder-gray-500',
            'focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20',
            'transition-all duration-200'
          )}
        />
      </div>
      
      {/* Status filter pills */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-gray-900/40 backdrop-blur-sm border border-gray-800/50">
        {STATUS_OPTIONS.map(status => {
          const Icon = status.icon
          const isActive = statusFilter === status.value
          
          return (
            <button
              key={status.value}
              onClick={() => onStatusChange(status.value)}
              className={clsx(
                'relative px-3 py-1.5 rounded-lg font-mono text-xs transition-all duration-200',
                'flex items-center gap-1.5',
                isActive
                  ? status.color === 'emerald'
                    ? 'bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10'
                    : status.color === 'amber'
                    ? 'bg-amber-500/20 text-amber-400 shadow-lg shadow-amber-500/10'
                    : status.color === 'red'
                    ? 'bg-red-500/20 text-red-400 shadow-lg shadow-red-500/10'
                    : status.color === 'rose'
                    ? 'bg-rose-500/20 text-rose-400 shadow-lg shadow-rose-500/10'
                    : 'bg-gray-700/50 text-white shadow-lg'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
              )}
            >
              {Icon && <Icon className="w-3 h-3" />}
              {status.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
