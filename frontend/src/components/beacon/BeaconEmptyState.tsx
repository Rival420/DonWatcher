import { motion } from 'framer-motion'
import { Radio, Download, Terminal, Zap, Shield, ArrowRight } from 'lucide-react'
import { clsx } from 'clsx'
import type { BeaconEmptyStateProps } from './types'

export function BeaconEmptyState({ 
  message = 'NO BEACONS DETECTED',
  description = 'Deploy the beacon agent on target systems to begin monitoring',
  showDownloadButton = true,
  onDownloadClick
}: BeaconEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden text-center py-16 px-8 bg-gradient-to-br from-gray-900/60 to-gray-900/30 backdrop-blur-sm border border-gray-800/50 border-dashed rounded-2xl"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>
      
      {/* Animated radar icon */}
      <div className="relative">
        <motion.div
          className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-gray-800/80 to-gray-900/80 flex items-center justify-center border border-gray-700/50"
        >
          <Radio className="w-10 h-10 text-gray-500" />
          {/* Scanning animation */}
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-emerald-500/30"
            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-emerald-500/20"
            animate={{ scale: [1, 1.8], opacity: [0.3, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
          />
        </motion.div>
      </div>
      
      <h3 className="relative font-mono text-2xl font-bold text-white mb-3">{message}</h3>
      <p className="relative text-gray-500 text-sm max-w-md mx-auto mb-8">
        {description}
      </p>
      
      {showDownloadButton && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onDownloadClick}
          className={clsx(
            'relative inline-flex items-center gap-3 px-8 py-4 rounded-xl',
            'bg-gradient-to-r from-emerald-500/20 to-green-500/20',
            'text-emerald-400 border border-emerald-500/30',
            'hover:from-emerald-500/30 hover:to-green-500/30',
            'transition-all duration-300 font-mono text-sm font-medium',
            'shadow-lg shadow-emerald-500/10'
          )}
        >
          <Download className="w-5 h-5" />
          DOWNLOAD BEACON AGENT
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      )}
      
      {/* Quick start guide */}
      <div className="relative mt-12 pt-8 border-t border-gray-800/50 max-w-2xl mx-auto">
        <h4 className="font-mono text-xs text-gray-500 mb-6 uppercase tracking-widest">Quick Start Guide</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          {/* Step 1 */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-xl bg-gray-900/50 border border-gray-800/50"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-400 font-mono font-bold text-sm">1</span>
              </div>
              <span className="text-xs font-mono text-emerald-400 uppercase">Download</span>
            </div>
            <p className="text-xs text-gray-500">
              Click the download button to get a pre-configured Go beacon package
            </p>
          </motion.div>
          
          {/* Step 2 */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 rounded-xl bg-gray-900/50 border border-gray-800/50"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <span className="text-blue-400 font-mono font-bold text-sm">2</span>
              </div>
              <span className="text-xs font-mono text-blue-400 uppercase">Build</span>
            </div>
            <p className="text-xs text-gray-500">
              Run <code className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">build-beacon.ps1</code> to compile the .exe
            </p>
          </motion.div>
          
          {/* Step 3 */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-4 rounded-xl bg-gray-900/50 border border-gray-800/50"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <span className="text-violet-400 font-mono font-bold text-sm">3</span>
              </div>
              <span className="text-xs font-mono text-violet-400 uppercase">Deploy</span>
            </div>
            <p className="text-xs text-gray-500">
              Copy the .exe to target systems and install as a Windows service
            </p>
          </motion.div>
        </div>
        
        {/* Command hint */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 p-4 rounded-xl bg-black/50 border border-gray-800/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono text-emerald-400 uppercase">PowerShell</span>
          </div>
          <code className="text-xs font-mono text-gray-400">
            .\DonWatcher-Beacon.exe install && .\DonWatcher-Beacon.exe start
          </code>
        </motion.div>
      </div>
    </motion.div>
  )
}

