import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, X, Play, Loader2, Users, Shield, Zap } from 'lucide-react'
import { clsx } from 'clsx'
import type { TaskModalProps } from './types'

// Icon mapping for templates
const TEMPLATE_ICONS: Record<string, typeof Shield> = {
  '👥': Users,
  '🛡️': Shield,
  '⚡': Zap,
}

export function TaskModal({ 
  beacon, 
  templates,
  isOpen,
  onClose, 
  onSubmit,
  isSubmitting = false
}: TaskModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<typeof templates[0] | null>(null)
  const [customCommand, setCustomCommand] = useState('')
  const [parameters, setParameters] = useState<Record<string, string>>({})

  const handleSubmit = () => {
    if (!selectedTemplate) return
    
    const params = { ...selectedTemplate.parameters }
    Object.entries(parameters).forEach(([key, value]) => {
      if (value) params[key] = value
    })
    
    onSubmit(
      selectedTemplate.job_type,
      selectedTemplate.job_type === 'powershell' ? customCommand : undefined,
      params
    )
  }

  const handleTemplateSelect = (template: typeof templates[0]) => {
    setSelectedTemplate(template)
    if (template.job_type === 'powershell') {
      setCustomCommand(template.command || '')
    }
    setParameters({})
  }

  const getTemplateIcon = (iconEmoji: string | null) => {
    if (!iconEmoji) return Zap
    return TEMPLATE_ICONS[iconEmoji] || Zap
  }

  return (
    <AnimatePresence>
      {isOpen && (
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
            className="bg-gray-900 border border-green-500/30 rounded-lg w-full max-w-xl mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-green-400" />
                <div>
                  <h2 className="text-lg font-mono font-bold text-green-400">
                    RUN TASK
                  </h2>
                  <p className="text-sm text-gray-500 font-mono">
                    Target: {beacon.hostname} ({beacon.internal_ip})
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="p-2 rounded hover:bg-gray-800 text-gray-400 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <p className="text-gray-400 mb-4 text-sm">
                Select a DonWatcher script to execute:
              </p>
              
              {/* Templates - Simplified */}
              <div className="space-y-3 mb-6">
                {templates.map(template => {
                  const Icon = getTemplateIcon(template.icon)
                  const isSelected = selectedTemplate?.id === template.id
                  
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      disabled={isSubmitting}
                      className={clsx(
                        'w-full flex items-center gap-4 p-4 rounded-lg border text-left transition-all',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        isSelected
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                      )}
                    >
                      <div className={clsx(
                        'p-3 rounded-lg',
                        isSelected ? 'bg-green-500/20' : 'bg-gray-700/50'
                      )}>
                        <Icon className={clsx(
                          'w-6 h-6',
                          isSelected ? 'text-green-400' : 'text-gray-400'
                        )} />
                      </div>
                      <div className="flex-1">
                        <p className={clsx(
                          'font-medium text-lg',
                          isSelected ? 'text-green-400' : 'text-white'
                        )}>
                          {template.name}
                        </p>
                        <p className="text-sm text-gray-500">{template.description}</p>
                      </div>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center"
                        >
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </motion.div>
                      )}
                    </button>
                  )
                })}
              </div>
              
              {/* Custom command input for PowerShell */}
              {selectedTemplate?.job_type === 'powershell' && (
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-2 font-mono">
                    POWERSHELL COMMAND:
                  </label>
                  <textarea
                    value={customCommand}
                    onChange={e => setCustomCommand(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full h-24 bg-black border border-gray-700 rounded p-3 font-mono text-green-400 text-sm focus:border-green-500 focus:outline-none disabled:opacity-50"
                    placeholder="Enter PowerShell command..."
                  />
                </div>
              )}

              {/* Vulnerability scan parameter */}
              {selectedTemplate?.job_type === 'vulnerability_scan' && (
                <div className="mb-4 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <label className="block text-sm text-gray-400 mb-2 font-mono">
                    API TOKEN (Optional):
                  </label>
                  <input
                    type="password"
                    value={parameters.api_token || ''}
                    onChange={e => setParameters(prev => ({ ...prev, api_token: e.target.value }))}
                    disabled={isSubmitting}
                    className="w-full bg-black border border-gray-700 rounded px-3 py-2 font-mono text-white text-sm focus:border-green-500 focus:outline-none"
                    placeholder="Uses OUTPOST24_TOKEN env var if not set"
                  />
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 bg-gray-900/50">
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded font-mono text-gray-400 hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                CANCEL
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedTemplate || isSubmitting}
                className={clsx(
                  'flex items-center gap-2 px-6 py-2 rounded font-mono transition-colors',
                  selectedTemplate && !isSubmitting
                    ? 'bg-green-500 text-black hover:bg-green-400'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    SENDING...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    RUN NOW
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
