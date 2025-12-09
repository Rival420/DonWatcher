import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  FileText, 
  Upload, 
  Settings,
  Shield,
  Activity
} from 'lucide-react'
import { clsx } from 'clsx'
import { useHealth } from '../hooks/useApi'

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/reports', label: 'Reports', icon: FileText },
  { path: '/risk-catalog', label: 'Risk Catalog', icon: Shield },
  { path: '/upload', label: 'Upload', icon: Upload },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const { data: health } = useHealth()
  
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-cyber-bg-secondary border-r border-cyber-border z-50">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-cyber-border">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Shield className="w-8 h-8 text-cyber-accent-cyan" />
            <div className="absolute inset-0 animate-pulse-glow">
              <Shield className="w-8 h-8 text-cyber-accent-cyan blur-sm" />
            </div>
          </div>
          <div>
            <h1 className="font-display font-bold text-lg tracking-wider text-cyber-text-primary">
              DON<span className="text-cyber-accent-cyan">WATCHER</span>
            </h1>
            <p className="text-xs text-cyber-text-muted">Security Dashboard</p>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="p-4 space-y-2">
        {navItems.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
              'group relative overflow-hidden',
              isActive
                ? 'bg-cyber-accent-cyan/10 text-cyber-accent-cyan border border-cyber-accent-cyan/30'
                : 'text-cyber-text-secondary hover:text-cyber-text-primary hover:bg-cyber-bg-hover border border-transparent'
            )}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyber-accent-cyan rounded-r" />
                )}
                <Icon className={clsx(
                  'w-5 h-5 transition-transform duration-200',
                  'group-hover:scale-110'
                )} />
                <span className="font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      
      {/* Status indicator */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-cyber-border">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-cyber-bg-tertiary">
          <div className="relative">
            <Activity className={clsx(
              'w-5 h-5',
              health?.status === 'healthy' ? 'text-cyber-accent-green' : 'text-cyber-accent-red'
            )} />
            <span className={clsx(
              'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full',
              health?.status === 'healthy' ? 'bg-cyber-accent-green' : 'bg-cyber-accent-red',
              'animate-pulse'
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-cyber-text-primary">System Status</p>
            <p className={clsx(
              'text-xs truncate',
              health?.status === 'healthy' ? 'text-cyber-accent-green' : 'text-cyber-accent-red'
            )}>
              {health?.status === 'healthy' ? 'All systems operational' : 'Connection issues'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}

