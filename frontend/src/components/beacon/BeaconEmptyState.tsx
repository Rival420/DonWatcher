import { motion } from 'framer-motion'
import { Radio, Download } from 'lucide-react'
import { clsx } from 'clsx'
import type { BeaconEmptyStateProps } from './types'

export function BeaconEmptyState({ 
  message = 'NO BEACONS DETECTED',
  description = 'Deploy the beacon agent on target systems to get started',
  showDownloadButton = true,
  onDownloadClick
}: BeaconEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-16 bg-gray-900/30 border border-gray-800/50 border-dashed rounded-lg"
    >
      <motion.div
        animate={{ 
          scale: [1, 1.05, 1],
          opacity: [0.3, 0.5, 0.3] 
        }}
        transition={{ duration: 3, repeat: Infinity }}
        className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-800/50 flex items-center justify-center"
      >
        <Radio className="w-10 h-10 text-gray-600" />
      </motion.div>
      
      <h3 className="font-mono text-xl text-gray-400 mb-2">{message}</h3>
      <p className="text-gray-600 text-sm max-w-md mx-auto mb-6">
        {description}
      </p>
      
      {showDownloadButton && (
        <button
          onClick={onDownloadClick}
          className={clsx(
            'inline-flex items-center gap-2 px-6 py-3 rounded-lg',
            'bg-green-500/20 text-green-400 border border-green-500/30',
            'hover:bg-green-500/30 transition-colors font-mono text-sm'
          )}
        >
          <Download className="w-4 h-4" />
          DOWNLOAD BEACON AGENT
        </button>
      )}
      
      <div className="mt-8 pt-8 border-t border-gray-800 max-w-2xl mx-auto">
        <h4 className="font-mono text-sm text-gray-500 mb-4">QUICK START</h4>
        
        {/* Option 1: Standalone EXE */}
        <div className="bg-black/80 rounded-lg p-4 text-left mb-4 border border-green-500/20">
          <p className="text-xs font-mono text-green-400 mb-3 flex items-center gap-2">
            <span className="px-1.5 py-0.5 bg-green-500/20 rounded text-[10px]">RECOMMENDED</span>
            STANDALONE EXECUTABLE (No Python needed)
          </p>
          <pre className="text-xs font-mono text-gray-400 overflow-x-auto">
{`# 1. Download beacon package (pre-configured!)
#    Click "Download Beacon Agent" button above

# 2. Build standalone .exe (on a machine with Python)
compile-to-exe.bat

# 3. Copy DonWatcher-Beacon.exe to target systems and run
#    It will automatically connect to this server`}
          </pre>
        </div>
        
        {/* Option 2: Python script */}
        <div className="bg-black/50 rounded-lg p-4 text-left border border-gray-800">
          <p className="text-xs font-mono text-gray-500 mb-3">
            ALTERNATIVE: Run with Python
          </p>
          <pre className="text-xs font-mono text-gray-500 overflow-x-auto">
{`# Package is pre-configured - just run:
pip install requests && python beacon.py`}
          </pre>
        </div>
      </div>
    </motion.div>
  )
}

