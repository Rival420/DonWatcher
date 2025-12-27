import { Search } from 'lucide-react'
import { clsx } from 'clsx'
import type { BeaconFiltersProps } from './types'

const STATUS_OPTIONS = ['all', 'active', 'dormant', 'dead', 'killed'] as const

export function BeaconFilters({ 
  statusFilter, 
  searchQuery, 
  onStatusChange, 
  onSearchChange 
}: BeaconFiltersProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search beacons by hostname, IP, or domain..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className={clsx(
            'w-full pl-10 pr-4 py-2 rounded',
            'bg-gray-900/50 border border-gray-700',
            'font-mono text-sm text-white placeholder-gray-500',
            'focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500/30',
            'transition-colors'
          )}
        />
      </div>
      
      {/* Status filter buttons */}
      <div className="flex items-center gap-1 bg-gray-900/30 p-1 rounded-lg">
        {STATUS_OPTIONS.map(status => (
          <button
            key={status}
            onClick={() => onStatusChange(status)}
            className={clsx(
              'px-3 py-1.5 rounded font-mono text-xs transition-all',
              statusFilter === status
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'text-gray-400 hover:text-gray-300 border border-transparent hover:bg-gray-800/50'
            )}
          >
            {status.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}

