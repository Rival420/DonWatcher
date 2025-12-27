import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Calendar, 
  Clock, 
  Play, 
  Pause, 
  Trash2, 
  Plus,
  Users,
  Shield,
  Radio,
  X,
  Loader2,
  Check
} from 'lucide-react'
import { clsx } from 'clsx'
import type { ScheduledJob, TaskTemplate, JobType, ScheduleType, Beacon } from '../../types'
import * as api from '../../services/api'

interface SchedulesPanelProps {
  schedules: ScheduledJob[]
  templates: TaskTemplate[]
  beacons: Beacon[]
  onRefresh: () => void
}

const SCHEDULE_TYPES: { value: ScheduleType; label: string; description: string }[] = [
  { value: 'hourly', label: 'Hourly', description: 'Every hour' },
  { value: 'daily', label: 'Daily', description: 'Once per day' },
  { value: 'weekly', label: 'Weekly', description: 'Once per week' },
]

const JOB_TYPE_ICONS: Record<string, typeof Shield> = {
  domain_scan: Users,
  vulnerability_scan: Shield,
  powershell: Radio,
}

export function SchedulesPanel({ schedules, templates, beacons, onRefresh }: SchedulesPanelProps) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [runningSchedule, setRunningSchedule] = useState<string | null>(null)
  
  // Form state
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    job_type: '' as JobType | '',
    schedule_type: 'daily' as ScheduleType,
    beacon_id: '' as string,  // empty = all beacons
  })

  const handleCreateSchedule = async () => {
    if (!newSchedule.name || !newSchedule.job_type) return
    
    setIsCreating(true)
    try {
      await api.createScheduledJob({
        name: newSchedule.name,
        job_type: newSchedule.job_type as JobType,
        schedule_type: newSchedule.schedule_type,
        beacon_id: newSchedule.beacon_id || undefined,
      })
      setShowCreateModal(false)
      setNewSchedule({ name: '', job_type: '', schedule_type: 'daily', beacon_id: '' })
      onRefresh()
    } catch (err) {
      console.error('Failed to create schedule:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const handleToggleSchedule = async (schedule: ScheduledJob) => {
    try {
      await api.updateScheduledJob(schedule.id, { is_enabled: !schedule.is_enabled })
      onRefresh()
    } catch (err) {
      console.error('Failed to toggle schedule:', err)
    }
  }

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Delete this scheduled task?')) return
    try {
      await api.deleteScheduledJob(scheduleId)
      onRefresh()
    } catch (err) {
      console.error('Failed to delete schedule:', err)
    }
  }

  const handleRunNow = async (scheduleId: string) => {
    setRunningSchedule(scheduleId)
    try {
      const result = await api.runScheduledJobNow(scheduleId)
      alert(`Created ${result.jobs_created} job(s)`)
      onRefresh()
    } catch (err) {
      console.error('Failed to run schedule:', err)
    } finally {
      setRunningSchedule(null)
    }
  }

  const getIcon = (jobType: string) => {
    return JOB_TYPE_ICONS[jobType] || Radio
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="font-mono text-green-400 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          SCHEDULED TASKS
        </h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1 px-3 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors text-sm font-mono"
        >
          <Plus className="w-4 h-4" />
          NEW
        </button>
      </div>

      {/* Schedules list */}
      <div className="divide-y divide-gray-800">
        {schedules.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-mono">No scheduled tasks</p>
            <p className="text-xs mt-1">Create one to automate scans</p>
          </div>
        ) : (
          schedules.map(schedule => {
            const Icon = getIcon(schedule.job_type)
            
            return (
              <motion.div
                key={schedule.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={clsx(
                  'px-4 py-3 transition-colors',
                  !schedule.is_enabled && 'opacity-50'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'p-2 rounded',
                    schedule.is_enabled ? 'bg-green-500/10' : 'bg-gray-700/50'
                  )}>
                    <Icon className={clsx(
                      'w-4 h-4',
                      schedule.is_enabled ? 'text-green-400' : 'text-gray-500'
                    )} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-white text-sm truncate">
                        {schedule.name}
                      </span>
                      <span className={clsx(
                        'text-xs px-1.5 py-0.5 rounded font-mono',
                        schedule.is_enabled 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-gray-700 text-gray-500'
                      )}>
                        {schedule.schedule_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mt-1">
                      <span className="flex items-center gap-1">
                        <Radio className="w-3 h-3" />
                        {schedule.target_hostname || 'All beacons'}
                      </span>
                      {schedule.run_count > 0 && (
                        <span>• {schedule.run_count} runs</span>
                      )}
                      {schedule.next_run_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Next: {new Date(schedule.next_run_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleRunNow(schedule.id)}
                      disabled={runningSchedule === schedule.id}
                      className="p-1.5 rounded hover:bg-gray-700 text-gray-400 transition-colors"
                      title="Run now"
                    >
                      {runningSchedule === schedule.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleToggleSchedule(schedule)}
                      className="p-1.5 rounded hover:bg-gray-700 text-gray-400 transition-colors"
                      title={schedule.is_enabled ? 'Disable' : 'Enable'}
                    >
                      {schedule.is_enabled ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 border border-green-500/30 rounded-lg w-full max-w-md mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                <h2 className="text-lg font-mono font-bold text-green-400">
                  NEW SCHEDULED TASK
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 rounded hover:bg-gray-800 text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-mono">NAME</label>
                  <input
                    type="text"
                    value={newSchedule.name}
                    onChange={e => setNewSchedule(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-black border border-gray-700 rounded px-3 py-2 font-mono text-white focus:border-green-500 focus:outline-none"
                    placeholder="e.g., Daily Domain Scan"
                  />
                </div>
                
                {/* Task Type */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-mono">TASK</label>
                  <div className="space-y-2">
                    {templates.filter(t => t.job_type !== 'powershell').map(template => (
                      <button
                        key={template.id}
                        onClick={() => setNewSchedule(prev => ({ ...prev, job_type: template.job_type }))}
                        className={clsx(
                          'w-full flex items-center gap-3 p-3 rounded border text-left transition-colors',
                          newSchedule.job_type === template.job_type
                            ? 'border-green-500 bg-green-500/10'
                            : 'border-gray-700 hover:border-gray-600'
                        )}
                      >
                        {(() => {
                          const Icon = getIcon(template.job_type)
                          return <Icon className="w-5 h-5 text-green-400" />
                        })()}
                        <div>
                          <p className="text-white font-medium">{template.name}</p>
                          <p className="text-xs text-gray-500">{template.description}</p>
                        </div>
                        {newSchedule.job_type === template.job_type && (
                          <Check className="w-5 h-5 text-green-400 ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Schedule */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-mono">SCHEDULE</label>
                  <div className="flex gap-2">
                    {SCHEDULE_TYPES.map(type => (
                      <button
                        key={type.value}
                        onClick={() => setNewSchedule(prev => ({ ...prev, schedule_type: type.value }))}
                        className={clsx(
                          'flex-1 py-2 px-3 rounded border font-mono text-sm transition-colors',
                          newSchedule.schedule_type === type.value
                            ? 'border-green-500 bg-green-500/10 text-green-400'
                            : 'border-gray-700 text-gray-400 hover:border-gray-600'
                        )}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Target */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-mono">TARGET</label>
                  <select
                    value={newSchedule.beacon_id}
                    onChange={e => setNewSchedule(prev => ({ ...prev, beacon_id: e.target.value }))}
                    className="w-full bg-black border border-gray-700 rounded px-3 py-2 font-mono text-white focus:border-green-500 focus:outline-none"
                  >
                    <option value="">All active beacons</option>
                    {beacons.map(beacon => (
                      <option key={beacon.beacon_id} value={beacon.beacon_id}>
                        {beacon.hostname} ({beacon.internal_ip})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded font-mono text-gray-400 hover:bg-gray-800"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleCreateSchedule}
                  disabled={!newSchedule.name || !newSchedule.job_type || isCreating}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded font-mono transition-colors',
                    newSchedule.name && newSchedule.job_type && !isCreating
                      ? 'bg-green-500 text-black hover:bg-green-400'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  )}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      CREATING...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      CREATE
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

