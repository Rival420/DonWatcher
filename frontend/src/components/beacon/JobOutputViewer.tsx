import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, X, Copy, Check, Download, ChevronDown, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import { JOB_STATUS_COLORS, formatDateTime, formatDuration } from './BeaconUtils'
import type { JobOutputViewerProps } from './types'

export function JobOutputViewer({ job, isOpen, onClose }: JobOutputViewerProps) {
  const [copied, setCopied] = useState(false)
  const [showMeta, setShowMeta] = useState(true)
  
  const copyOutput = () => {
    if (!job?.result_output) return
    navigator.clipboard.writeText(job.result_output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadOutput = () => {
    if (!job?.result_output) return
    const blob = new Blob([job.result_output], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `job-${job.id}-output.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Try to parse JSON output for pretty printing
  const formatOutput = (output: string | null): { formatted: string; isJson: boolean } => {
    if (!output) return { formatted: '', isJson: false }
    
    try {
      const parsed = JSON.parse(output)
      return { formatted: JSON.stringify(parsed, null, 2), isJson: true }
    } catch {
      return { formatted: output, isJson: false }
    }
  }

  return (
    <AnimatePresence>
      {isOpen && job && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-4xl mx-4 max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-green-400" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-green-400 font-bold">
                      {job.job_type.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className={clsx(
                      'px-2 py-0.5 rounded text-xs font-mono',
                      JOB_STATUS_COLORS[job.status]
                    )}>
                      {job.status.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 font-mono">
                    Job ID: {job.id.substring(0, 12)}...
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {job.result_output && (
                  <>
                    <button
                      onClick={copyOutput}
                      className="p-2 rounded hover:bg-gray-800 text-gray-400 transition-colors"
                      title="Copy output"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={downloadOutput}
                      className="p-2 rounded hover:bg-gray-800 text-gray-400 transition-colors"
                      title="Download output"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button 
                  onClick={onClose} 
                  className="p-2 rounded hover:bg-gray-800 text-gray-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Metadata collapsible */}
            <button
              onClick={() => setShowMeta(!showMeta)}
              className="flex items-center gap-2 px-6 py-2 text-left text-sm text-gray-400 hover:bg-gray-800/50 border-b border-gray-800"
            >
              {showMeta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Job Metadata
            </button>
            
            {showMeta && (
              <div className="px-6 py-3 bg-black/30 border-b border-gray-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-gray-500 block">Created</span>
                  <span className="text-white font-mono">{formatDateTime(job.created_at)}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Started</span>
                  <span className="text-white font-mono">{formatDateTime(job.started_at)}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Completed</span>
                  <span className="text-white font-mono">{formatDateTime(job.completed_at)}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Duration</span>
                  <span className="text-white font-mono">{formatDuration(job.started_at, job.completed_at)}</span>
                </div>
              </div>
            )}
            
            {/* Output */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="bg-black rounded p-4 font-mono text-sm min-h-[200px]">
                {job.command && (
                  <div className="text-gray-500 mb-3 pb-3 border-b border-gray-800">
                    <span className="text-cyan-400">$</span> {job.command.substring(0, 100)}
                    {job.command.length > 100 && '...'}
                  </div>
                )}
                
                {job.result_output ? (
                  (() => {
                    const { formatted, isJson } = formatOutput(job.result_output)
                    return (
                      <pre className={clsx(
                        'whitespace-pre-wrap break-words',
                        isJson ? 'text-cyan-400' : 'text-green-400'
                      )}>
                        {formatted}
                      </pre>
                    )
                  })()
                ) : (
                  <span className="text-gray-500 italic">No output captured</span>
                )}
                
                {job.result_error && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <div className="text-red-500 text-xs mb-2">STDERR:</div>
                    <pre className="text-red-400 whitespace-pre-wrap break-words">
                      {job.result_error}
                    </pre>
                  </div>
                )}
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-800 flex items-center justify-between text-xs font-mono">
              <span className={clsx(
                'px-2 py-1 rounded',
                job.exit_code === 0 ? 'bg-green-500/20 text-green-400' : 
                job.exit_code !== null ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'
              )}>
                Exit Code: {job.exit_code ?? 'N/A'}
              </span>
              <span className="text-gray-500">
                Output Size: {job.result_output?.length.toLocaleString() || 0} bytes
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

