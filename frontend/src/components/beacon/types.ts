import type { 
  Beacon, 
  BeaconJob, 
  TaskTemplate, 
  BeaconDashboardStats, 
  BeaconActivityLog,
  JobType 
} from '../../types'

// Component Props Types

export interface BeaconCardProps {
  beacon: Beacon
  isSelected?: boolean
  onSelect?: () => void
  onTask?: () => void
  onKill?: () => void
  compact?: boolean
}

export interface TaskModalProps {
  beacon: Beacon
  templates: TaskTemplate[]
  isOpen: boolean
  onClose: () => void
  onSubmit: (jobType: JobType, command?: string, parameters?: Record<string, unknown>) => void
  isSubmitting?: boolean
}

export interface JobOutputViewerProps {
  job: BeaconJob | null
  isOpen: boolean
  onClose: () => void
}

export interface BeaconStatsProps {
  stats: BeaconDashboardStats | null
  loading?: boolean
}

export interface BeaconDetailProps {
  beacon: Beacon | null
  jobs: BeaconJob[]
  onTask?: () => void
  onKill?: () => void
  onUpdateConfig?: (updates: Partial<{ sleep_interval: number; jitter_percent: number; notes: string }>) => void
  onClose?: () => void
}

export interface JobsPanelProps {
  jobs: BeaconJob[]
  loading?: boolean
  onJobClick?: (job: BeaconJob) => void
  showBeaconInfo?: boolean
  maxItems?: number
  title?: string
}

export interface ActivityFeedProps {
  activities: BeaconActivityLog[]
  loading?: boolean
  maxItems?: number
  showBeaconColumn?: boolean
}

export interface BeaconFiltersProps {
  statusFilter: string
  searchQuery: string
  onStatusChange: (status: string) => void
  onSearchChange: (query: string) => void
}

export interface BeaconEmptyStateProps {
  message?: string
  description?: string
  showDownloadButton?: boolean
}

