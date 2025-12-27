import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Radio, 
  Skull, 
  Moon, 
  Zap,
  Terminal,
  Play,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  Download,
  Send,
  Eye,
  Trash2,
  Settings,
  Activity,
  Server,
  Globe,
  User,
  Cpu,
  HardDrive,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  X
} from 'lucide-react'
import { clsx } from 'clsx'
import * as api from '../services/api'
import type { 
  Beacon, 
  BeaconJob, 
  TaskTemplate, 
  BeaconDashboardStats,
  JobType
} from '../types'

// Status color mapping
const STATUS_COLORS = {
  active: 'text-green-400 bg-green-400/10 border-green-400/30',
  dormant: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  dead: 'text-red-400 bg-red-400/10 border-red-400/30',
  killed: 'text-gray-500 bg-gray-500/10 border-gray-500/30'
} as const

const JOB_STATUS_COLORS = {
  pending: 'text-blue-400 bg-blue-400/10',
  sent: 'text-cyan-400 bg-cyan-400/10',
  running: 'text-yellow-400 bg-yellow-400/10',
  completed: 'text-green-400 bg-green-400/10',
  failed: 'text-red-400 bg-red-400/10',
  cancelled: 'text-gray-400 bg-gray-400/10'
} as const

const STATUS_ICONS = {
  active: Radio,
  dormant: Moon,
  dead: Skull,
  killed: X
}

// Terminal-style animated cursor
function BlinkingCursor() {
  return (
    <motion.span
      animate={{ opacity: [1, 0] }}
      transition={{ duration: 0.8, repeat: Infinity }}
      className="inline-block w-2 h-4 bg-green-400 ml-1"
    />
  )
}

// Beacon card component
function BeaconCard({ 
  beacon, 
  isSelected, 
  onSelect, 
  onTaskClick 
}: { 
  beacon: Beacon
  isSelected: boolean
  onSelect: () => void
  onTaskClick: () => void
}) {
  const status = (beacon.computed_status || beacon.status) as keyof typeof STATUS_COLORS
  const StatusIcon = STATUS_ICONS[status] || Radio
  
  const lastSeen = beacon.last_seen 
    ? new Date(beacon.last_seen).toLocaleString() 
    : 'Never'
  
  const timeSinceLastSeen = beacon.last_seen
    ? getTimeSince(new Date(beacon.last_seen))
    : 'Unknown'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={clsx(
        'relative border rounded-lg p-4 cursor-pointer transition-all duration-200',
        'bg-gray-900/50 backdrop-blur-sm',
        isSelected 
          ? 'border-green-500 ring-2 ring-green-500/20' 
          : 'border-gray-700/50 hover:border-gray-600',
        STATUS_COLORS[status]
      )}
      onClick={onSelect}
    >
      {/* Status indicator pulse */}
      {status === 'active' && (
        <motion.div
          className="absolute top-3 right-3 w-3 h-3 rounded-full bg-green-400"
          animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
      
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusIcon className={clsx('w-5 h-5', 
            status === 'active' && 'text-green-400',
            status === 'dormant' && 'text-yellow-400',
            status === 'dead' && 'text-red-400',
            status === 'killed' && 'text-gray-500'
          )} />
          <span className="font-mono text-lg font-bold text-green-400">
            {beacon.hostname}
          </span>
        </div>
        <span className={clsx(
          'px-2 py-0.5 rounded text-xs font-mono uppercase',
          STATUS_COLORS[status]
        )}>
          {status}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div className="flex items-center gap-2 text-gray-400">
          <Globe className="w-3.5 h-3.5" />
          <span className="font-mono">{beacon.internal_ip || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <User className="w-3.5 h-3.5" />
          <span className="font-mono truncate">{beacon.username || 'SYSTEM'}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Server className="w-3.5 h-3.5" />
          <span className="font-mono truncate">{beacon.domain || 'WORKGROUP'}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Cpu className="w-3.5 h-3.5" />
          <span className="font-mono">{beacon.architecture || 'x64'}</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs border-t border-gray-700/50 pt-3">
        <div className="flex items-center gap-1 text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono">{timeSinceLastSeen}</span>
        </div>
        <div className="flex items-center gap-3">
          {beacon.pending_jobs > 0 && (
            <span className="flex items-center gap-1 text-blue-400">
              <Clock className="w-3.5 h-3.5" />
              {beacon.pending_jobs}
            </span>
          )}
          <span className="text-gray-500 font-mono">
            #{beacon.check_in_count}
          </span>
        </div>
      </div>
      
      <div className="flex gap-2 mt-3">
        <button
          onClick={(e) => { e.stopPropagation(); onTaskClick(); }}
          className="flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors text-sm font-mono"
        >
          <Send className="w-3.5 h-3.5" />
          TASK
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className="flex items-center justify-center gap-2 py-1.5 px-3 rounded bg-gray-700/50 text-gray-400 hover:bg-gray-700 transition-colors text-sm"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  )
}

// Task modal component
function TaskModal({ 
  beacon, 
  templates,
  onClose, 
  onSubmit 
}: { 
  beacon: Beacon
  templates: TaskTemplate[]
  onClose: () => void
  onSubmit: (jobType: JobType, command?: string, parameters?: Record<string, unknown>) => void
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null)
  const [customCommand, setCustomCommand] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  return (
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
        className="bg-gray-900 border border-green-500/30 rounded-lg w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-green-400" />
            <div>
              <h2 className="text-lg font-mono font-bold text-green-400">
                TASK BEACON
              </h2>
              <p className="text-sm text-gray-500 font-mono">
                Target: {beacon.hostname} ({beacon.internal_ip})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-800 text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <p className="text-gray-400 mb-4 text-sm">
            Select a task template or enter a custom command:
          </p>
          
          {/* Templates grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {templates.map(template => (
              <button
                key={template.id}
                onClick={() => {
                  setSelectedTemplate(template)
                  if (template.job_type === 'powershell' || template.job_type === 'shell') {
                    setShowCustom(true)
                    setCustomCommand(template.command || '')
                  } else {
                    setShowCustom(false)
                  }
                }}
                className={clsx(
                  'flex items-center gap-3 p-4 rounded-lg border text-left transition-all',
                  selectedTemplate?.id === template.id
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                )}
              >
                <span className="text-2xl">{template.icon || '⚡'}</span>
                <div>
                  <p className="font-medium text-white">{template.name}</p>
                  <p className="text-xs text-gray-500">{template.description}</p>
                </div>
                {template.is_dangerous && (
                  <AlertTriangle className="w-4 h-4 text-yellow-400 ml-auto" />
                )}
              </button>
            ))}
          </div>
          
          {/* Custom command input */}
          {showCustom && (
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2 font-mono">
                COMMAND:
              </label>
              <textarea
                value={customCommand}
                onChange={e => setCustomCommand(e.target.value)}
                className="w-full h-32 bg-black border border-gray-700 rounded p-3 font-mono text-green-400 text-sm focus:border-green-500 focus:outline-none"
                placeholder="Enter PowerShell or shell command..."
              />
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 bg-gray-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded font-mono text-gray-400 hover:bg-gray-800 transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={() => {
              if (selectedTemplate) {
                onSubmit(
                  selectedTemplate.job_type,
                  showCustom ? customCommand : selectedTemplate.command || undefined,
                  selectedTemplate.parameters
                )
              }
            }}
            disabled={!selectedTemplate}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded font-mono transition-colors',
              selectedTemplate
                ? 'bg-green-500 text-black hover:bg-green-400'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            )}
          >
            <Play className="w-4 h-4" />
            EXECUTE
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Job output viewer
function JobOutputViewer({ job, onClose }: { job: BeaconJob | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  
  if (!job) return null
  
  const copyOutput = () => {
    navigator.clipboard.writeText(job.result_output || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
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
        className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-4xl mx-4 max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-green-400" />
            <span className="font-mono text-green-400">JOB OUTPUT</span>
            <span className={clsx('px-2 py-0.5 rounded text-xs font-mono', JOB_STATUS_COLORS[job.status])}>
              {job.status.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyOutput}
              className="p-2 rounded hover:bg-gray-800 text-gray-400"
              title="Copy output"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="p-2 rounded hover:bg-gray-800 text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          <div className="bg-black rounded p-4 font-mono text-sm">
            <div className="text-gray-500 mb-2">
              $ {job.job_type} {job.command ? `"${job.command.substring(0, 50)}..."` : ''}
            </div>
            {job.result_output ? (
              <pre className="text-green-400 whitespace-pre-wrap break-words">
                {job.result_output}
              </pre>
            ) : (
              <span className="text-gray-500 italic">No output</span>
            )}
            {job.result_error && (
              <pre className="text-red-400 whitespace-pre-wrap break-words mt-4 pt-4 border-t border-gray-800">
                {job.result_error}
              </pre>
            )}
          </div>
        </div>
        
        <div className="px-6 py-3 border-t border-gray-800 text-xs text-gray-500 font-mono flex justify-between">
          <span>Exit Code: {job.exit_code ?? 'N/A'}</span>
          <span>Completed: {job.completed_at ? new Date(job.completed_at).toLocaleString() : 'N/A'}</span>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Helper function
function getTimeSince(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

// Main Beacons page
export function Beacons() {
  const [beacons, setBeacons] = useState<Beacon[]>([])
  const [jobs, setJobs] = useState<BeaconJob[]>([])
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [stats, setStats] = useState<BeaconDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedBeacon, setSelectedBeacon] = useState<Beacon | null>(null)
  const [taskingBeacon, setTaskingBeacon] = useState<Beacon | null>(null)
  const [viewingJob, setViewingJob] = useState<BeaconJob | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch data
  const fetchData = async () => {
    try {
      const [beaconsData, jobsData, templatesData, statsData] = await Promise.all([
        api.getBeacons(),
        api.getAllBeaconJobs({ limit: 50 }),
        api.getTaskTemplates(),
        api.getBeaconStats()
      ])
      setBeacons(beaconsData)
      setJobs(jobsData)
      setTemplates(templatesData)
      setStats(statsData)
    } catch (error) {
      console.error('Failed to fetch beacon data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  // Filter beacons
  const filteredBeacons = beacons.filter(beacon => {
    const matchesStatus = statusFilter === 'all' || beacon.computed_status === statusFilter
    const matchesSearch = searchQuery === '' || 
      beacon.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      beacon.internal_ip?.includes(searchQuery) ||
      beacon.domain?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  // Handle task submission
  const handleTaskSubmit = async (jobType: JobType, command?: string, parameters?: Record<string, unknown>) => {
    if (!taskingBeacon) return
    
    try {
      await api.createBeaconJob({
        beacon_id: taskingBeacon.beacon_id,
        job_type: jobType,
        command,
        parameters: parameters || {}
      })
      setTaskingBeacon(null)
      fetchData()
    } catch (error) {
      console.error('Failed to create job:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-green-400 font-mono">INITIALIZING C2...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-mono text-green-400 flex items-center gap-3">
            <Radio className="w-8 h-8" />
            BEACONS
            <BlinkingCursor />
          </h1>
          <p className="text-gray-500 mt-1 font-mono text-sm">
            Command & Control Interface // {beacons.length} registered agents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/api/beacons/download"
            className="flex items-center gap-2 px-4 py-2 rounded bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors font-mono text-sm"
          >
            <Download className="w-4 h-4" />
            DOWNLOAD BEACON
          </a>
          <button
            onClick={fetchData}
            className="p-2 rounded bg-gray-800 text-gray-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-900/50 border border-green-500/20 rounded-lg p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-green-500/20">
                <Radio className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">{stats.active_beacons}</p>
                <p className="text-xs text-gray-500 font-mono">ACTIVE</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-900/50 border border-yellow-500/20 rounded-lg p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-yellow-500/20">
                <Moon className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-400">{stats.dormant_beacons}</p>
                <p className="text-xs text-gray-500 font-mono">DORMANT</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-900/50 border border-blue-500/20 rounded-lg p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-blue-500/20">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400">{stats.pending_jobs}</p>
                <p className="text-xs text-gray-500 font-mono">PENDING JOBS</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-900/50 border border-gray-500/20 rounded-lg p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-gray-500/20">
                <Activity className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-400">{stats.completed_jobs_24h}</p>
                <p className="text-xs text-gray-500 font-mono">JOBS (24H)</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search beacons..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-700 rounded font-mono text-sm focus:border-green-500 focus:outline-none"
          />
        </div>
        
        <div className="flex items-center gap-2">
          {['all', 'active', 'dormant', 'dead'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={clsx(
                'px-3 py-1.5 rounded font-mono text-sm transition-colors',
                statusFilter === status
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-gray-800 text-gray-400 border border-transparent hover:border-gray-600'
              )}
            >
              {status.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Beacons list */}
        <div className="col-span-2 space-y-4">
          <AnimatePresence>
            {filteredBeacons.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 bg-gray-900/50 border border-gray-800 rounded-lg"
              >
                <Radio className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 font-mono">NO BEACONS DETECTED</p>
                <p className="text-gray-600 text-sm mt-2">
                  Deploy the beacon agent on target systems to get started
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredBeacons.map(beacon => (
                  <BeaconCard
                    key={beacon.id}
                    beacon={beacon}
                    isSelected={selectedBeacon?.id === beacon.id}
                    onSelect={() => setSelectedBeacon(beacon)}
                    onTaskClick={() => setTaskingBeacon(beacon)}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Jobs panel */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h3 className="font-mono text-green-400 flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              RECENT JOBS
            </h3>
            <span className="text-xs text-gray-500 font-mono">{jobs.length}</span>
          </div>
          
          <div className="divide-y divide-gray-800 max-h-[500px] overflow-y-auto">
            {jobs.slice(0, 20).map(job => (
              <div
                key={job.id}
                className="px-4 py-3 hover:bg-gray-800/50 cursor-pointer transition-colors"
                onClick={() => setViewingJob(job)}
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
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="font-mono">{job.beacon_id.substring(0, 12)}...</span>
                  <span>{job.created_at ? new Date(job.created_at).toLocaleTimeString() : 'N/A'}</span>
                </div>
              </div>
            ))}
            
            {jobs.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-500">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-mono">No jobs yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task modal */}
      <AnimatePresence>
        {taskingBeacon && (
          <TaskModal
            beacon={taskingBeacon}
            templates={templates}
            onClose={() => setTaskingBeacon(null)}
            onSubmit={handleTaskSubmit}
          />
        )}
      </AnimatePresence>

      {/* Job output viewer */}
      <AnimatePresence>
        {viewingJob && (
          <JobOutputViewer
            job={viewingJob}
            onClose={() => setViewingJob(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default Beacons

