import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  X, 
  Globe, 
  User, 
  Server, 
  Cpu, 
  Clock, 
  Send, 
  Skull,
  Settings,
  Activity,
  Terminal,
  Shield,
  Hash,
  Save
} from 'lucide-react'
import { clsx } from 'clsx'
import { StatusBadge, getTimeSince, formatDateTime } from './BeaconUtils'
import { JOB_STATUS_COLORS } from './BeaconUtils'
import type { BeaconDetailProps } from './types'
import type { BeaconStatus } from '../../types'

export function BeaconDetail({ 
  beacon, 
  jobs, 
  onTask, 
  onKill,
  onUpdateConfig,
  onClose 
}: BeaconDetailProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'jobs' | 'config'>('info')
  const [sleepInterval, setSleepInterval] = useState(beacon?.sleep_interval || 60)
  const [jitterPercent, setJitterPercent] = useState(beacon?.jitter_percent || 10)
  const [notes, setNotes] = useState(beacon?.notes || '')
  const [configChanged, setConfigChanged] = useState(false)

  if (!beacon) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <p className="font-mono text-sm">Select a beacon to view details</p>
      </div>
    )
  }

  const status = (beacon.computed_status || beacon.status) as BeaconStatus

  const handleSaveConfig = () => {
    onUpdateConfig?.({ 
      sleep_interval: sleepInterval, 
      jitter_percent: jitterPercent,
      notes 
    })
    setConfigChanged(false)
  }

  const tabs = [
    { id: 'info', label: 'INFO', icon: Terminal },
    { id: 'jobs', label: 'JOBS', icon: Activity, count: jobs.length },
    { id: 'config', label: 'CONFIG', icon: Settings }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-gray-900/80 border border-gray-800 rounded-lg overflow-hidden h-full flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between bg-black/30">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-green-400" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-green-400">
                {beacon.hostname}
              </span>
              <StatusBadge status={status} size="xs" />
            </div>
            <span className="text-xs text-gray-500 font-mono">
              {beacon.beacon_id.substring(0, 20)}...
            </span>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-800 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'info' | 'jobs' | 'config')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 text-sm font-mono transition-colors',
                activeTab === tab.id
                  ? 'text-green-400 border-b-2 border-green-400 bg-green-500/10'
                  : 'text-gray-500 hover:text-gray-300'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="text-xs bg-gray-700 px-1.5 rounded">
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'info' && (
          <div className="space-y-4">
            <DetailRow icon={Globe} label="Internal IP" value={beacon.internal_ip} />
            <DetailRow icon={Globe} label="External IP" value={beacon.external_ip} />
            <DetailRow icon={User} label="User" value={beacon.username} />
            <DetailRow icon={Server} label="Domain" value={beacon.domain} />
            <DetailRow icon={Shield} label="OS" value={beacon.os_info} />
            <DetailRow icon={Cpu} label="Architecture" value={beacon.architecture} />
            <DetailRow icon={Terminal} label="Process" value={`${beacon.process_name} (PID: ${beacon.process_id})`} />
            <DetailRow icon={Hash} label="Version" value={beacon.beacon_version} />
            <DetailRow icon={Clock} label="First Seen" value={formatDateTime(beacon.first_seen)} />
            <DetailRow icon={Clock} label="Last Seen" value={beacon.last_seen ? getTimeSince(new Date(beacon.last_seen)) : 'Never'} />
            <DetailRow icon={Activity} label="Check-ins" value={String(beacon.check_in_count)} />
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="space-y-2">
            {jobs.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8 font-mono">
                No jobs for this beacon
              </p>
            ) : (
              jobs.slice(0, 20).map(job => (
                <div
                  key={job.id}
                  className="p-3 bg-black/30 rounded border border-gray-800"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm text-white">
                      {job.job_type.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className={clsx(
                      'px-2 py-0.5 rounded text-xs font-mono',
                      JOB_STATUS_COLORS[job.status]
                    )}>
                      {job.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    {job.created_at ? new Date(job.created_at).toLocaleString() : 'N/A'}
                  </div>
                  {job.result_output && (
                    <pre className="mt-2 text-xs text-green-400 bg-black/50 p-2 rounded overflow-x-auto max-h-32">
                      {job.result_output.substring(0, 500)}
                      {job.result_output.length > 500 && '...'}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'config' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2 font-mono">
                SLEEP INTERVAL (seconds)
              </label>
              <input
                type="number"
                value={sleepInterval}
                onChange={e => { setSleepInterval(Number(e.target.value)); setConfigChanged(true); }}
                className="w-full bg-black border border-gray-700 rounded px-3 py-2 font-mono text-white focus:border-green-500 focus:outline-none"
                min={5}
                max={3600}
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2 font-mono">
                JITTER (%)
              </label>
              <input
                type="number"
                value={jitterPercent}
                onChange={e => { setJitterPercent(Number(e.target.value)); setConfigChanged(true); }}
                className="w-full bg-black border border-gray-700 rounded px-3 py-2 font-mono text-white focus:border-green-500 focus:outline-none"
                min={0}
                max={50}
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2 font-mono">
                NOTES
              </label>
              <textarea
                value={notes}
                onChange={e => { setNotes(e.target.value); setConfigChanged(true); }}
                className="w-full h-24 bg-black border border-gray-700 rounded px-3 py-2 font-mono text-white focus:border-green-500 focus:outline-none resize-none"
                placeholder="Add notes about this beacon..."
              />
            </div>

            {configChanged && onUpdateConfig && (
              <button
                onClick={handleSaveConfig}
                className="flex items-center gap-2 px-4 py-2 rounded bg-green-500 text-black font-mono hover:bg-green-400 transition-colors"
              >
                <Save className="w-4 h-4" />
                SAVE CONFIG
              </button>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-800 flex gap-2">
        {onTask && (
          <button
            onClick={onTask}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors font-mono"
          >
            <Send className="w-4 h-4" />
            TASK
          </button>
        )}
        {onKill && status !== 'killed' && (
          <button
            onClick={onKill}
            className="flex items-center justify-center gap-2 py-2 px-4 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors font-mono"
          >
            <Skull className="w-4 h-4" />
            KILL
          </button>
        )}
      </div>
    </motion.div>
  )
}

function DetailRow({ 
  icon: Icon, 
  label, 
  value 
}: { 
  icon: typeof Globe
  label: string
  value: string | null | undefined 
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-800/50">
      <Icon className="w-4 h-4 text-gray-500" />
      <span className="text-gray-500 text-sm w-24">{label}:</span>
      <span className="font-mono text-white text-sm flex-1 truncate">
        {value || 'N/A'}
      </span>
    </div>
  )
}

