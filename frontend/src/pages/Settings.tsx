import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Bell, 
  Database, 
  Shield, 
  RefreshCw,
  Save,
  TestTube,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { useHealth } from '../hooks/useApi'
import { clsx } from 'clsx'

export function Settings() {
  const { data: health, refetch: refetchHealth } = useHealth()
  const [webhookUrl, setWebhookUrl] = useState('')
  const [alertEnabled, setAlertEnabled] = useState(true)
  const [retentionDays, setRetentionDays] = useState('365')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  
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
  
  const handleSave = () => {
    // TODO: Implement settings save
    console.log('Saving settings:', { webhookUrl, alertEnabled, retentionDays })
  }
  
  return (
    <div className="max-w-3xl mx-auto space-y-6">
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
      
      {/* Notifications */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
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
        transition={{ delay: 0.2 }}
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
        transition={{ delay: 0.3 }}
        className="flex justify-end"
      >
        <button onClick={handleSave} className="cyber-button flex items-center gap-2">
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </motion.div>
    </div>
  )
}

