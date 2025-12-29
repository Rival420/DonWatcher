import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Radio, Download, RefreshCw, LayoutGrid, List } from 'lucide-react'
import { clsx } from 'clsx'
import * as api from '../services/api'
import {
  BeaconCard,
  BeaconStats,
  BeaconDetail,
  JobsPanel,
  TaskModal,
  JobOutputViewer,
  ActivityFeed,
  BeaconEmptyState,
  BeaconFilters,
  BlinkingCursor,
  SchedulesPanel,
  BeaconDownloadModal
} from '../components/beacon'
import type { 
  Beacon, 
  BeaconJob, 
  TaskTemplate, 
  BeaconDashboardStats,
  BeaconActivityLog,
  JobType,
  ScheduledJob
} from '../types'

// View mode for beacon list
type ViewMode = 'grid' | 'list'

export function Beacons() {
  // Data state
  const [beacons, setBeacons] = useState<Beacon[]>([])
  const [jobs, setJobs] = useState<BeaconJob[]>([])
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [stats, setStats] = useState<BeaconDashboardStats | null>(null)
  const [activities, setActivities] = useState<BeaconActivityLog[]>([])
  const [schedules, setSchedules] = useState<ScheduledJob[]>([])
  
  // UI state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBeacon, setSelectedBeacon] = useState<Beacon | null>(null)
  const [taskingBeacon, setTaskingBeacon] = useState<Beacon | null>(null)
  const [viewingJob, setViewingJob] = useState<BeaconJob | null>(null)
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  
  // Download modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false)

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const [beaconsData, jobsData, templatesData, statsData] = await Promise.all([
        api.getBeacons().catch(() => []),
        api.getAllBeaconJobs({ limit: 50 }).catch(() => []),
        api.getTaskTemplates().catch(() => []),
        api.getBeaconStats().catch(() => null)
      ])
      setBeacons(beaconsData)
      setJobs(jobsData)
      setTemplates(templatesData)
      setStats(statsData)
      
      // Fetch activities and schedules separately (non-critical)
      api.getAllBeaconActivity(50)
        .then(res => setActivities(res.activities || []))
        .catch(() => setActivities([]))
      
      api.getScheduledJobs()
        .then(res => setSchedules(res.schedules || []))
        .catch(() => setSchedules([]))
        
    } catch (err) {
      console.error('Failed to fetch beacon data:', err)
      setError('Failed to connect to beacon service')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load and auto-refresh
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Filter beacons
  const filteredBeacons = beacons.filter(beacon => {
    const matchesStatus = statusFilter === 'all' || beacon.computed_status === statusFilter
    const matchesSearch = searchQuery === '' || 
      beacon.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      beacon.internal_ip?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      beacon.domain?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      beacon.username?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  // Get jobs for selected beacon
  const selectedBeaconJobs = selectedBeacon 
    ? jobs.filter(j => j.beacon_id === selectedBeacon.beacon_id)
    : []

  // Handle task submission
  const handleTaskSubmit = async (jobType: JobType, command?: string, parameters?: Record<string, unknown>) => {
    if (!taskingBeacon) return
    
    setIsSubmittingTask(true)
    try {
      await api.createBeaconJob({
        beacon_id: taskingBeacon.beacon_id,
        job_type: jobType,
        command,
        parameters: parameters || {}
      })
      setTaskingBeacon(null)
      fetchData()
    } catch (err) {
      console.error('Failed to create job:', err)
    } finally {
      setIsSubmittingTask(false)
    }
  }

  // Handle beacon kill
  const handleKillBeacon = async (beacon: Beacon) => {
    if (!confirm(`Are you sure you want to kill beacon ${beacon.hostname}?`)) return
    
    try {
      await api.killBeacon(beacon.beacon_id)
      fetchData()
      if (selectedBeacon?.beacon_id === beacon.beacon_id) {
        setSelectedBeacon(null)
      }
    } catch (err) {
      console.error('Failed to kill beacon:', err)
    }
  }

  // Handle beacon config update
  const handleUpdateConfig = async (updates: Partial<{ sleep_interval: number; jitter_percent: number; notes: string }>) => {
    if (!selectedBeacon) return
    
    try {
      await api.updateBeacon(selectedBeacon.beacon_id, updates)
      fetchData()
    } catch (err) {
      console.error('Failed to update beacon:', err)
    }
  }

  // Loading state
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
          <button
            onClick={() => setShowDownloadModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors font-mono text-sm"
          >
            <Download className="w-4 h-4" />
            DOWNLOAD BEACON
          </button>
          <button
            onClick={fetchData}
            className="p-2 rounded bg-gray-800 text-gray-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm font-mono"
        >
          ⚠️ {error}
        </motion.div>
      )}

      {/* Stats bar */}
      <BeaconStats stats={stats} loading={loading} />

      {/* Filters and view toggle */}
      <div className="flex items-center justify-between gap-4">
        <BeaconFilters
          statusFilter={statusFilter}
          searchQuery={searchQuery}
          onStatusChange={setStatusFilter}
          onSearchChange={setSearchQuery}
        />
        
        <div className="flex items-center gap-1 bg-gray-900/30 p-1 rounded">
          <button
            onClick={() => setViewMode('grid')}
            className={clsx(
              'p-2 rounded transition-colors',
              viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'
            )}
            title="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={clsx(
              'p-2 rounded transition-colors',
              viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'
            )}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Beacons list */}
        <div className={clsx(
          selectedBeacon ? 'col-span-5' : 'col-span-8'
        )}>
          <AnimatePresence mode="wait">
            {filteredBeacons.length === 0 ? (
              <BeaconEmptyState />
            ) : viewMode === 'grid' ? (
              <motion.div 
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-2 gap-4"
              >
                {filteredBeacons.map(beacon => (
                  <BeaconCard
                    key={beacon.id}
                    beacon={beacon}
                    isSelected={selectedBeacon?.id === beacon.id}
                    onSelect={() => setSelectedBeacon(beacon)}
                    onTask={() => setTaskingBeacon(beacon)}
                    onKill={() => handleKillBeacon(beacon)}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div 
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden"
              >
                {filteredBeacons.map(beacon => (
                  <BeaconCard
                    key={beacon.id}
                    beacon={beacon}
                    isSelected={selectedBeacon?.id === beacon.id}
                    onSelect={() => setSelectedBeacon(beacon)}
                    onTask={() => setTaskingBeacon(beacon)}
                    compact
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Detail panel or Jobs panel */}
        <div className={clsx(
          selectedBeacon ? 'col-span-4' : 'col-span-4'
        )}>
          <AnimatePresence mode="wait">
            {selectedBeacon ? (
              <motion.div
                key="detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <BeaconDetail
                  beacon={selectedBeacon}
                  jobs={selectedBeaconJobs}
                  onTask={() => setTaskingBeacon(selectedBeacon)}
                  onKill={() => handleKillBeacon(selectedBeacon)}
                  onUpdateConfig={handleUpdateConfig}
                  onClose={() => setSelectedBeacon(null)}
                />
              </motion.div>
            ) : (
              <motion.div
                key="jobs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <JobsPanel
                  jobs={jobs}
                  onJobClick={setViewingJob}
                  showBeaconInfo
                  title="RECENT JOBS"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Schedules and Activity (only visible when no beacon selected) */}
        {!selectedBeacon && (
          <div className="col-span-4 space-y-4">
            <SchedulesPanel 
              schedules={schedules}
              templates={templates}
              beacons={beacons}
              onRefresh={fetchData}
            />
            <ActivityFeed activities={activities} maxItems={10} />
          </div>
        )}
        
        {/* Show jobs when beacon is selected */}
        {selectedBeacon && (
          <div className="col-span-3">
            <div className="space-y-4">
              <JobsPanel
                jobs={jobs.slice(0, 10)}
                onJobClick={setViewingJob}
                showBeaconInfo
                maxItems={10}
                title="ALL JOBS"
              />
            </div>
          </div>
        )}
      </div>

      {/* Task modal */}
      <TaskModal
        beacon={taskingBeacon!}
        templates={templates}
        isOpen={!!taskingBeacon}
        onClose={() => setTaskingBeacon(null)}
        onSubmit={handleTaskSubmit}
        isSubmitting={isSubmittingTask}
      />

      {/* Job output viewer */}
      <JobOutputViewer
        job={viewingJob}
        isOpen={!!viewingJob}
        onClose={() => setViewingJob(null)}
      />

      {/* Beacon download modal */}
      <BeaconDownloadModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
      />
    </div>
  )
}

export default Beacons
