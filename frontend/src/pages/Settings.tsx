import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Bell, 
  Database, 
  Shield, 
  RefreshCw,
  Save,
  CheckCircle,
  XCircle,
  Trash2,
  AlertTriangle,
  FileText,
  Users,
  ChevronDown
} from 'lucide-react'
import { useHealth, useDomains } from '../hooks/useApi'
import { clsx } from 'clsx'

interface DataSummary {
  domain: string
  report_count: number
  finding_count: number
  membership_count: number
  latest_report: string | null
  oldest_report: string | null
}

interface DeleteConfirmationProps {
  title: string
  message: string
  domain?: string
  onConfirm: () => void
  onCancel: () => void
  isDeleting: boolean
}

function DeleteConfirmationModal({ 
  title, 
  message, 
  domain,
  onConfirm, 
  onCancel, 
  isDeleting 
}: DeleteConfirmationProps) {
  const [confirmText, setConfirmText] = useState('')
  const expectedText = domain || 'DELETE ALL'
  const canConfirm = confirmText === expectedText

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-800 border border-red-500/50 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-red-400">{title}</h3>
        </div>
        
        <p className="text-slate-300 mb-4">{message}</p>
        
        <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
          <p className="text-sm text-slate-400 mb-2">
            Type <span className="font-mono text-red-400">"{expectedText}"</span> to confirm:
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={expectedText}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white font-mono focus:border-red-500 focus:outline-none"
            autoFocus
          />
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm || isDeleting}
            className={clsx(
              "flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2",
              canConfirm && !isDeleting
                ? "bg-red-600 hover:bg-red-500 text-white"
                : "bg-slate-700 text-slate-500 cursor-not-allowed"
            )}
          >
            {isDeleting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function Settings() {
  const { data: health, refetch: refetchHealth } = useHealth()
  const { data: domains, refetch: refetchDomains } = useDomains()
  const [webhookUrl, setWebhookUrl] = useState('')
  const [alertEnabled, setAlertEnabled] = useState(true)
  const [retentionDays, setRetentionDays] = useState('365')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  
  // Data management state
  const [dataSummary, setDataSummary] = useState<DataSummary[]>([])
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<string>('')
  const [deleteModal, setDeleteModal] = useState<{
    type: 'domain' | 'all' | null
    domain?: string
  }>({ type: null })
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteResult, setDeleteResult] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  
  // Load data summary on mount
  useEffect(() => {
    loadDataSummary()
  }, [])
  
  const loadDataSummary = async () => {
    setLoadingSummary(true)
    try {
      const response = await fetch('/api/data/summary')
      const data = await response.json()
      if (data.status === 'ok') {
        setDataSummary(data.domains)
      }
    } catch (error) {
      console.error('Failed to load data summary:', error)
    } finally {
      setLoadingSummary(false)
    }
  }
  
  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    
    try {
      await refetchHealth()
      setTestResult('success')
    } catch {
      setTestResult('error')
    } finally {
      setIsTesting(false)
    }
  }
  
  const handleDeleteDomain = async () => {
    if (!deleteModal.domain) return
    
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/data/domain/${encodeURIComponent(deleteModal.domain)}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      
      if (data.status === 'ok') {
        setDeleteResult({
          type: 'success',
          message: `Successfully deleted ${data.details.reports_deleted} reports and ${data.details.findings_deleted} findings for ${deleteModal.domain}`
        })
        loadDataSummary()
        refetchDomains()
        setSelectedDomain('')
      } else {
        throw new Error(data.detail || 'Failed to delete domain data')
      }
    } catch (error) {
      setDeleteResult({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete domain data'
      })
    } finally {
      setIsDeleting(false)
      setDeleteModal({ type: null })
    }
  }
  
  const handleDeleteAll = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch('/api/data/all', {
        method: 'DELETE'
      })
      const data = await response.json()
      
      if (data.status === 'ok') {
        setDeleteResult({
          type: 'success',
          message: 'Successfully deleted all data from the database'
        })
        loadDataSummary()
        refetchDomains()
        setSelectedDomain('')
      } else {
        throw new Error(data.detail || 'Failed to delete all data')
      }
    } catch (error) {
      setDeleteResult({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete all data'
      })
    } finally {
      setIsDeleting(false)
      setDeleteModal({ type: null })
    }
  }
  
  const handleSave = () => {
    // TODO: Implement settings save
    console.log('Saving settings:', { webhookUrl, alertEnabled, retentionDays })
  }
  
  const totalReports = dataSummary.reduce((sum, d) => sum + d.report_count, 0)
  const totalFindings = dataSummary.reduce((sum, d) => sum + d.finding_count, 0)
  
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Delete Result Alert */}
      <AnimatePresence>
        {deleteResult && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={clsx(
              'p-4 rounded-lg border flex items-center gap-3',
              deleteResult.type === 'success' 
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            )}
          >
            {deleteResult.type === 'success' 
              ? <CheckCircle className="w-5 h-5 flex-shrink-0" />
              : <XCircle className="w-5 h-5 flex-shrink-0" />
            }
            <p className="flex-1">{deleteResult.message}</p>
            <button
              onClick={() => setDeleteResult(null)}
              className="p-1 hover:bg-white/10 rounded"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* System Status */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="cyber-card"
      >
        <h2 className="text-lg font-semibold text-cyber-text-primary flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-cyber-accent-cyan" />
          System Status
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={clsx(
            'p-4 rounded-lg border',
            health?.status === 'healthy'
              ? 'bg-cyber-accent-green/5 border-cyber-accent-green/30'
              : 'bg-cyber-accent-red/5 border-cyber-accent-red/30'
          )}>
            <div className="flex items-center gap-3">
              <div className={clsx(
                'w-10 h-10 rounded-full flex items-center justify-center',
                health?.status === 'healthy' ? 'bg-cyber-accent-green/20' : 'bg-cyber-accent-red/20'
              )}>
                {health?.status === 'healthy' 
                  ? <CheckCircle className="w-5 h-5 text-cyber-accent-green" />
                  : <XCircle className="w-5 h-5 text-cyber-accent-red" />
                }
              </div>
              <div>
                <p className="font-medium text-cyber-text-primary">Database Connection</p>
                <p className="text-sm text-cyber-text-muted">{health?.message}</p>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-lg border border-cyber-border bg-cyber-bg-secondary">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-cyber-text-primary">API Response Time</p>
                <p className="text-sm text-cyber-text-muted">
                  {health?.duration_ms?.toFixed(2)} ms
                </p>
              </div>
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="cyber-button-secondary flex items-center gap-2"
              >
                <RefreshCw className={clsx('w-4 h-4', isTesting && 'animate-spin')} />
                Test
              </button>
            </div>
          </div>
        </div>
      </motion.section>
      
      {/* Data Management */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="cyber-card"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-cyber-text-primary flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-cyber-accent-red" />
            Data Management
          </h2>
          <button
            onClick={loadDataSummary}
            disabled={loadingSummary}
            className="p-2 rounded-lg hover:bg-cyber-bg-tertiary transition-colors"
            title="Refresh data"
          >
            <RefreshCw className={clsx('w-4 h-4 text-cyber-text-muted', loadingSummary && 'animate-spin')} />
          </button>
        </div>
        
        {/* Data Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-cyber-bg-secondary border border-cyber-border text-center">
            <p className="text-2xl font-bold text-cyber-accent-cyan">{dataSummary.length}</p>
            <p className="text-sm text-cyber-text-muted">Domains</p>
          </div>
          <div className="p-4 rounded-lg bg-cyber-bg-secondary border border-cyber-border text-center">
            <p className="text-2xl font-bold text-cyber-accent-green">{totalReports}</p>
            <p className="text-sm text-cyber-text-muted">Reports</p>
          </div>
          <div className="p-4 rounded-lg bg-cyber-bg-secondary border border-cyber-border text-center">
            <p className="text-2xl font-bold text-cyber-accent-yellow">{totalFindings}</p>
            <p className="text-sm text-cyber-text-muted">Findings</p>
          </div>
        </div>
        
        {/* Domain-specific deletion */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-cyber-text-secondary mb-2">
              Delete data for specific domain
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="cyber-input appearance-none pr-10 w-full"
                >
                  <option value="">Select a domain...</option>
                  {dataSummary.map(d => (
                    <option key={d.domain} value={d.domain}>
                      {d.domain} ({d.report_count} reports, {d.finding_count} findings)
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-text-muted pointer-events-none" />
              </div>
              <button
                onClick={() => setDeleteModal({ type: 'domain', domain: selectedDomain })}
                disabled={!selectedDomain}
                className={clsx(
                  'px-4 py-2 rounded-lg flex items-center gap-2 transition-colors',
                  selectedDomain
                    ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
                    : 'bg-cyber-bg-tertiary text-cyber-text-muted cursor-not-allowed'
                )}
              >
                <Trash2 className="w-4 h-4" />
                Delete Domain
              </button>
            </div>
          </div>
          
          {/* Selected domain details */}
          {selectedDomain && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 rounded-lg bg-cyber-bg-secondary border border-cyber-border"
            >
              {(() => {
                const domain = dataSummary.find(d => d.domain === selectedDomain)
                if (!domain) return null
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-cyber-text-muted">Reports</p>
                      <p className="text-lg font-semibold text-cyber-text-primary">{domain.report_count}</p>
                    </div>
                    <div>
                      <p className="text-cyber-text-muted">Findings</p>
                      <p className="text-lg font-semibold text-cyber-text-primary">{domain.finding_count}</p>
                    </div>
                    <div>
                      <p className="text-cyber-text-muted">Latest Report</p>
                      <p className="text-cyber-text-primary">
                        {domain.latest_report 
                          ? new Date(domain.latest_report).toLocaleDateString()
                          : 'N/A'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-cyber-text-muted">Oldest Report</p>
                      <p className="text-cyber-text-primary">
                        {domain.oldest_report 
                          ? new Date(domain.oldest_report).toLocaleDateString()
                          : 'N/A'
                        }
                      </p>
                    </div>
                  </div>
                )
              })()}
            </motion.div>
          )}
          
          {/* Nuclear option */}
          <div className="pt-4 border-t border-cyber-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-red-400">Delete All Data</p>
                <p className="text-sm text-cyber-text-muted">
                  Permanently delete all reports, findings, and related data
                </p>
              </div>
              <button
                onClick={() => setDeleteModal({ type: 'all' })}
                disabled={dataSummary.length === 0}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                Delete All
              </button>
            </div>
          </div>
        </div>
      </motion.section>
      
      {/* Notifications */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="cyber-card"
      >
        <h2 className="text-lg font-semibold text-cyber-text-primary flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-cyber-accent-cyan" />
          Notifications
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-cyber-text-primary">Enable Alerts</p>
              <p className="text-sm text-cyber-text-muted">
                Send notifications when new findings are detected
              </p>
            </div>
            <button
              onClick={() => setAlertEnabled(!alertEnabled)}
              className={clsx(
                'w-12 h-6 rounded-full transition-all duration-200 relative',
                alertEnabled ? 'bg-cyber-accent-cyan' : 'bg-cyber-bg-tertiary'
              )}
            >
              <div className={clsx(
                'absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200',
                alertEnabled ? 'left-7' : 'left-1'
              )} />
            </button>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-cyber-text-secondary mb-2">
              Webhook URL
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-webhook.example.com/notify"
              className="cyber-input"
            />
            <p className="text-xs text-cyber-text-muted mt-1">
              Compatible with ntfy, Slack, Discord, and generic JSON webhooks
            </p>
          </div>
        </div>
      </motion.section>
      
      {/* Data Retention */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="cyber-card"
      >
        <h2 className="text-lg font-semibold text-cyber-text-primary flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-cyber-accent-cyan" />
          Data Retention
        </h2>
        
        <div>
          <label className="block text-sm font-medium text-cyber-text-secondary mb-2">
            Keep reports for
          </label>
          <select
            value={retentionDays}
            onChange={(e) => setRetentionDays(e.target.value)}
            className="cyber-input w-auto"
          >
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="180">180 days</option>
            <option value="365">1 year</option>
            <option value="730">2 years</option>
            <option value="0">Forever</option>
          </select>
          <p className="text-xs text-cyber-text-muted mt-1">
            Old reports will be automatically cleaned up after this period
          </p>
        </div>
      </motion.section>
      
      {/* Save Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex justify-end"
      >
        <button onClick={handleSave} className="cyber-button flex items-center gap-2">
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </motion.div>
      
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModal.type === 'domain' && deleteModal.domain && (
          <DeleteConfirmationModal
            title="Delete Domain Data"
            message={`This will permanently delete all reports, findings, group memberships, and risk data for "${deleteModal.domain}". This action cannot be undone.`}
            domain={deleteModal.domain}
            onConfirm={handleDeleteDomain}
            onCancel={() => setDeleteModal({ type: null })}
            isDeleting={isDeleting}
          />
        )}
        {deleteModal.type === 'all' && (
          <DeleteConfirmationModal
            title="Delete All Data"
            message="This will permanently delete ALL data from the database including all reports, findings, group memberships, accepted risks, and risk assessments. This action CANNOT be undone."
            onConfirm={handleDeleteAll}
            onCancel={() => setDeleteModal({ type: null })}
            isDeleting={isDeleting}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
