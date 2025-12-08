import { useLocation } from 'react-router-dom'
import { Bell, Search, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { clsx } from 'clsx'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/reports': 'Security Reports',
  '/groups': 'Domain Groups',
  '/upload': 'Upload Reports',
  '/settings': 'Settings',
}

export function Header() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const title = pageTitles[location.pathname] || 'DonWatcher'
  
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await queryClient.invalidateQueries()
    setTimeout(() => setIsRefreshing(false), 1000)
  }
  
  return (
    <header className="h-16 bg-cyber-bg-secondary/80 backdrop-blur-sm border-b border-cyber-border sticky top-0 z-40">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Page title */}
        <div>
          <h1 className="text-xl font-display font-semibold text-cyber-text-primary tracking-wide">
            {title}
          </h1>
          <p className="text-xs text-cyber-text-muted mt-0.5">
            Real-time security monitoring
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-text-muted" />
            <input
              type="text"
              placeholder="Search..."
              className="pl-10 pr-4 py-2 w-64 rounded-lg bg-cyber-bg-tertiary border border-cyber-border text-sm text-cyber-text-primary placeholder-cyber-text-muted focus:outline-none focus:border-cyber-accent-cyan focus:ring-1 focus:ring-cyber-accent-cyan/50 transition-all"
            />
          </div>
          
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg bg-cyber-bg-tertiary border border-cyber-border text-cyber-text-secondary hover:text-cyber-accent-cyan hover:border-cyber-accent-cyan/50 transition-all"
            title="Refresh data"
          >
            <RefreshCw className={clsx(
              'w-5 h-5 transition-transform',
              isRefreshing && 'animate-spin'
            )} />
          </button>
          
          {/* Notifications */}
          <button className="relative p-2 rounded-lg bg-cyber-bg-tertiary border border-cyber-border text-cyber-text-secondary hover:text-cyber-accent-cyan hover:border-cyber-accent-cyan/50 transition-all">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyber-accent-red rounded-full text-xs flex items-center justify-center text-white font-medium">
              3
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}

