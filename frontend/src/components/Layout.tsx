import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-cyber-bg-primary">
      {/* Background grid effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-cyber-grid bg-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-br from-cyber-accent-cyan/5 via-transparent to-cyber-accent-purple/5" />
      </div>
      
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main content */}
      <div className="flex-1 flex flex-col ml-64">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

