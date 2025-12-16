import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Shield, 
  Clock, 
  AlertTriangle, 
  Link2,
  Search,
  Check,
  X,
  Filter,
  ChevronDown,
  ChevronRight,
  Users,
  FileWarning,
  Bug,
  Lock,
  UserCheck,
  UserX,
  CheckCircle,
  XCircle,
  Castle,
  Network,
  Activity,
  History,
  Eye,
  EyeOff
} from 'lucide-react'
import { 
  useGroupedFindingsFast, 
  useGroupedFindingsSummaryFast, 
  useDomains, 
  useAcceptRisk, 
  useRemoveAcceptedRisk,
  useDomainGroupsFast,
  useGroupMembers,
  useAcceptMember,
  useDenyMember
} from '../hooks/useApi'
import { FindingsListSkeleton, DomainGroupsSkeleton, SummaryCardsSkeleton } from '../components'
import { clsx } from 'clsx'
import type { GroupedFinding } from '../types'

// Category configuration for PingCastle
const PINGCASTLE_CATEGORIES = {
  all: { label: 'All Findings', icon: Shield, color: 'cyan' },
  PrivilegedAccounts: { label: 'Privileged Accounts', icon: Users, color: 'red' },
  StaleObjects: { label: 'Stale Objects', icon: Clock, color: 'orange' },
  Trusts: { label: 'Trusts', icon: Link2, color: 'purple' },
  Anomalies: { label: 'Anomalies', icon: Bug, color: 'yellow' }
} as const

type CategoryKey = keyof typeof PINGCASTLE_CATEGORIES

// Latest report filter options
const LATEST_FILTER_OPTIONS = {
  all: { label: 'All Findings', icon: Eye },
  in_latest: { label: 'In Latest Report', icon: Activity },
  not_in_latest: { label: 'Not In Latest', icon: EyeOff }
} as const

type LatestFilterKey = keyof typeof LATEST_FILTER_OPTIONS

function getSeverityColor(score: number): string {
  if (score >= 50) return 'text-red-400 bg-red-500/20 border-red-500/30'
  if (score >= 25) return 'text-orange-400 bg-orange-500/20 border-orange-500/30'
  if (score >= 10) return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30'
  return 'text-green-400 bg-green-500/20 border-green-500/30'
}

function getSeverityLabel(score: number): string {
  if (score >= 50) return 'Critical'
  if (score >= 25) return 'High'
  if (score >= 10) return 'Medium'
  return 'Low'
}

// Accept Finding Modal
function AcceptFindingModal({ 
  finding, 
  onClose, 
  onAccept 
}: { 
  finding: GroupedFinding
  onClose: () => void
  onAccept: (reason: string, expiresAt?: string) => void
}) {
  const [reason, setReason] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl"
      >
        <h3 className="text-xl font-orbitron text-cyan-400 mb-4">Accept Finding</h3>
        
        <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2 mb-2">
            <span className={clsx(
              'px-2 py-0.5 text-xs font-mono rounded border',
              getSeverityColor(finding.max_score)
            )}>
              {finding.max_score} pts
            </span>
            <span className="text-slate-400 text-sm">{finding.category}</span>
            {finding.in_latest_report && (
              <span className="px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 rounded-full border border-cyan-500/30 flex items-center gap-1">
                <Activity size={10} />
                In Latest
              </span>
            )}
          </div>
          <p className="text-white font-mono text-sm">{finding.name}</p>
          <p className="text-slate-400 text-sm mt-1">{finding.description}</p>
          <p className="text-slate-500 text-xs mt-2">
            Occurred {finding.occurrence_count} time{finding.occurrence_count !== 1 ? 's' : ''} across reports
          </p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Reason for Acceptance <span className="text-slate-500">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Planned remediation in Q2, Risk accepted by management..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none resize-none"
              rows={3}
            />
          </div>
          
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Expiration Date <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onAccept(reason, expiresAt || undefined)}
            className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Check size={18} />
            Accept Finding
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Grouped Finding Card Component
function GroupedFindingCard({ 
  finding, 
  onAccept, 
  onRemove
}: { 
  finding: GroupedFinding
  onAccept: (finding: GroupedFinding) => void
  onRemove: (finding: GroupedFinding) => void
}) {
  const CategoryIcon = PINGCASTLE_CATEGORIES[finding.category as CategoryKey]?.icon || AlertTriangle
  
  // Format the date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown'
    return new Date(dateStr).toLocaleDateString()
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        "bg-slate-800/50 border rounded-xl p-4 hover:border-cyan-500/50 transition-all group",
        finding.is_accepted 
          ? "border-green-500/30 bg-green-500/5" 
          : "border-slate-700"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Score Badge */}
        <div className={clsx(
          "flex-shrink-0 w-16 h-16 rounded-lg flex flex-col items-center justify-center border",
          getSeverityColor(finding.max_score)
        )}>
          <span className="text-2xl font-bold font-mono">{finding.max_score}</span>
          <span className="text-xs uppercase">{getSeverityLabel(finding.max_score)}</span>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <CategoryIcon size={16} className="text-slate-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">
              {finding.category}
            </span>
            
            {/* In Latest Report Indicator */}
            {finding.in_latest_report ? (
              <span className="px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 rounded-full border border-cyan-500/30 flex items-center gap-1 animate-pulse">
                <Activity size={10} />
                In Latest Report
              </span>
            ) : (
              <span className="px-2 py-0.5 text-xs bg-slate-700/50 text-slate-400 rounded-full border border-slate-600 flex items-center gap-1">
                <EyeOff size={10} />
                Not In Latest
              </span>
            )}
            
            {/* Occurrence Count Badge */}
            <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded-full border border-purple-500/30 flex items-center gap-1">
              <History size={10} />
              {finding.occurrence_count}x
            </span>
            
            {finding.is_accepted && (
              <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full border border-green-500/30 flex items-center gap-1">
                <Check size={12} />
                Accepted
              </span>
            )}
          </div>
          
          <h4 className="text-white font-mono font-medium mb-1 truncate">
            {finding.name}
          </h4>
          
          <p className="text-slate-400 text-sm line-clamp-2">
            {finding.description}
          </p>
          
          {finding.is_accepted && finding.accepted_reason && (
            <div className="mt-2 p-2 bg-slate-900/50 rounded-lg text-sm">
              <p className="text-slate-500">
                <span className="text-slate-400">Reason:</span> {finding.accepted_reason}
              </p>
              {finding.accepted_by && (
                <p className="text-slate-500">
                  <span className="text-slate-400">By:</span> {finding.accepted_by}
                </p>
              )}
              {finding.expires_at && (
                <p className="text-slate-500">
                  <span className="text-slate-400">Expires:</span> {new Date(finding.expires_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )}
          
          {/* Timeline info */}
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <span className="text-slate-400">First seen:</span>
              {formatDate(finding.first_seen)}
            </div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-1">
              <span className="text-slate-400">Last seen:</span>
              {formatDate(finding.last_seen)}
            </div>
            {finding.domains.length > 1 && (
              <>
                <span className="text-slate-600">•</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">Domains:</span>
                  {finding.domains.slice(0, 2).join(', ')}
                  {finding.domains.length > 2 && ` +${finding.domains.length - 2}`}
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {finding.is_accepted ? (
            <button
              onClick={() => onRemove(finding)}
              className="px-3 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg border border-red-500/30 transition-colors flex items-center gap-1"
            >
              <X size={14} />
              Remove
            </button>
          ) : (
            <button
              onClick={() => onAccept(finding)}
              className="px-3 py-1.5 text-sm bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg border border-cyan-500/30 transition-colors flex items-center gap-1"
            >
              <Check size={14} />
              Accept
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// Domain Groups Section Component (unchanged)
function DomainGroupsSection({ domain }: { domain: string }) {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  
  const { data: groups, isLoading } = useDomainGroupsFast(domain)
  const { data: members, isLoading: membersLoading } = useGroupMembers(domain, selectedGroup || '')
  
  const acceptMember = useAcceptMember()
  const denyMember = useDenyMember()
  
  const filteredGroups = groups?.filter(g => 
    g.group_name.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  const handleAccept = async (memberName: string) => {
    if (!selectedGroup) return
    await acceptMember.mutateAsync({
      domain,
      groupName: selectedGroup,
      memberName,
      reason: 'Accepted via dashboard'
    })
  }
  
  const handleDeny = async (memberName: string) => {
    if (!selectedGroup) return
    await denyMember.mutateAsync({
      domain,
      groupName: selectedGroup,
      memberName,
    })
  }
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500/50 bg-red-500/5'
      case 'high': return 'border-orange-500/50 bg-orange-500/5'
      case 'medium': return 'border-yellow-500/50 bg-yellow-500/5'
      default: return 'border-slate-700'
    }
  }
  
  // Summary stats
  const totalGroups = groups?.length || 0
  const totalMembers = groups?.reduce((sum, g) => sum + g.total_members, 0) || 0
  const unacceptedCount = groups?.reduce((sum, g) => sum + g.unaccepted_members, 0) || 0
  const acceptedCount = totalMembers - unacceptedCount
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="text-3xl font-bold text-white mb-1">{totalGroups}</div>
          <div className="text-sm text-slate-400">Privileged Groups</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="text-3xl font-bold text-cyan-400 mb-1">{totalMembers}</div>
          <div className="text-sm text-slate-400">Total Members</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="text-3xl font-bold text-green-400 mb-1">{acceptedCount}</div>
          <div className="text-sm text-slate-400">Accepted</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="text-3xl font-bold text-red-400 mb-1">{unacceptedCount}</div>
          <div className="text-sm text-slate-400">Unaccepted</div>
        </div>
      </div>
      
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search privileged groups..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
        />
      </div>
      
      {/* Groups and Members */}
      <div className="flex gap-6 min-h-[500px]">
        {/* Groups List */}
        <div className="w-80 flex-shrink-0 space-y-2 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
            </div>
          ) : filteredGroups?.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Network size={48} className="mx-auto mb-4 opacity-50" />
              <p>No groups found</p>
            </div>
          ) : (
            filteredGroups?.map((group) => (
              <motion.button
                key={group.group_name}
                onClick={() => setSelectedGroup(group.group_name)}
                className={clsx(
                  'w-full p-4 rounded-lg border text-left transition-all duration-200',
                  selectedGroup === group.group_name
                    ? 'bg-cyan-500/10 border-cyan-500'
                    : getSeverityColor(group.severity),
                  'hover:border-cyan-500/50'
                )}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      'p-2 rounded-lg',
                      group.severity === 'critical' && 'bg-red-500/20 text-red-400',
                      group.severity === 'high' && 'bg-orange-500/20 text-orange-400',
                      group.severity === 'medium' && 'bg-yellow-500/20 text-yellow-400',
                      group.severity === 'low' && 'bg-green-500/20 text-green-400',
                    )}>
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white">{group.group_name}</h4>
                      <p className="text-xs text-slate-400">
                        {group.total_members} members
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {group.unaccepted_members > 0 && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                        {group.unaccepted_members}
                      </span>
                    )}
                    <ChevronRight className={clsx(
                      'w-4 h-4 text-slate-400 transition-transform',
                      selectedGroup === group.group_name && 'rotate-90'
                    )} />
                  </div>
                </div>
              </motion.button>
            ))
          )}
        </div>
        
        {/* Members Panel */}
        <div className="flex-1 bg-slate-800/30 rounded-xl border border-slate-700 p-4 overflow-auto">
          {selectedGroup ? (
            <>
              <div className="flex items-center justify-between pb-4 border-b border-slate-700">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Lock className="w-5 h-5 text-cyan-400" />
                    {selectedGroup}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    {members?.length || 0} members in this group
                  </p>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    {members?.filter(m => m.is_accepted).length || 0} accepted
                  </span>
                  <span className="flex items-center gap-1 text-red-400">
                    <XCircle className="w-4 h-4" />
                    {members?.filter(m => !m.is_accepted).length || 0} unaccepted
                  </span>
                </div>
              </div>
              
              <div className="mt-4 space-y-2">
                {membersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <AnimatePresence>
                    {members?.map((member, index) => (
                      <motion.div
                        key={member.sid || member.name}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: index * 0.03 }}
                        className={clsx(
                          'p-4 rounded-lg border flex items-center justify-between',
                          member.is_accepted
                            ? 'bg-green-500/5 border-green-500/30'
                            : 'bg-red-500/5 border-red-500/30'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            'w-10 h-10 rounded-full flex items-center justify-center',
                            member.type === 'user' && 'bg-cyan-500/20',
                            member.type === 'computer' && 'bg-purple-500/20',
                            member.type === 'group' && 'bg-yellow-500/20',
                          )}>
                            {member.type === 'user' && <Users className="w-5 h-5 text-cyan-400" />}
                            {member.type === 'computer' && <Shield className="w-5 h-5 text-purple-400" />}
                            {member.type === 'group' && <Lock className="w-5 h-5 text-yellow-400" />}
                          </div>
                          
                          <div>
                            <h4 className="font-medium text-white">{member.name}</h4>
                            <p className="text-xs text-slate-400">
                              {member.samaccountname || member.sid?.slice(0, 30)}
                            </p>
                          </div>
                          
                          {member.enabled === false && (
                            <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-400">
                              Disabled
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {member.is_accepted ? (
                            <button
                              onClick={() => handleDeny(member.name)}
                              disabled={denyMember.isPending}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-sm"
                            >
                              <UserX className="w-4 h-4" />
                              Revoke
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAccept(member.name)}
                              disabled={acceptMember.isPending}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors text-sm"
                            >
                              <UserCheck className="w-4 h-4" />
                              Accept
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center">
                <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white">Select a group</h3>
                <p className="text-slate-400 mt-1">Choose a group from the list to view its members</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// PingCastle Section Component - Using fast materialized view endpoints
function PingCastleSection({ domain }: { domain: string }) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('all')
  const [latestFilter, setLatestFilter] = useState<LatestFilterKey>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showAccepted, setShowAccepted] = useState(true)
  const [findingToAccept, setFindingToAccept] = useState<GroupedFinding | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 50
  
  // Use fast endpoint with pagination for 10-15x faster loading
  const { data: findingsResponse, isLoading, isFetching } = useGroupedFindingsFast({
    domain: domain || undefined,
    category: selectedCategory !== 'all' ? selectedCategory : undefined,
    in_latest_only: latestFilter === 'in_latest',
    include_accepted: showAccepted,
    page,
    page_size: pageSize
  })
  
  // Use fast summary endpoint
  const { data: summaryResponse } = useGroupedFindingsSummaryFast('pingcastle')
  
  // Extract findings from response
  const groupedFindings = findingsResponse?.findings
  const summary = summaryResponse
  
  const acceptRisk = useAcceptRisk()
  const removeAcceptedRisk = useRemoveAcceptedRisk()
  
  // Apply client-side search filter (server handles category/in_latest filtering)
  const searchFilteredFindings = groupedFindings?.filter(f => {
    if (!searchTerm) return true
    return f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.description.toLowerCase().includes(searchTerm.toLowerCase())
  }) || []
  
  // Get counts from summary (more accurate than client-side filtering)
  const inLatestCount = summary?.total_in_latest || 0
  const notInLatestCount = (summary?.total_unique_findings || 0) - inLatestCount
  
  // Final filtered findings (server already filtered by category/in_latest)
  const filteredFindings = searchFilteredFindings
  
  // Reset page when filters change
  const handleCategoryChange = (category: CategoryKey) => {
    setSelectedCategory(category)
    setPage(1)
  }
  
  const handleLatestFilterChange = (filter: LatestFilterKey) => {
    setLatestFilter(filter)
    setPage(1)
  }
  
  const handleShowAcceptedChange = () => {
    setShowAccepted(!showAccepted)
    setPage(1)
  }
  
  const handleAccept = (reason: string, expiresAt?: string) => {
    if (!findingToAccept) return
    
    acceptRisk.mutate({
      tool_type: findingToAccept.tool_type,
      category: findingToAccept.category,
      name: findingToAccept.name,
      reason: reason || undefined,
      accepted_by: 'admin',
      expires_at: expiresAt
    })
    setFindingToAccept(null)
  }
  
  const handleRemove = (finding: GroupedFinding) => {
    removeAcceptedRisk.mutate({
      tool_type: finding.tool_type,
      category: finding.category,
      name: finding.name
    })
  }
  
  
  return (
    <div className="space-y-6">
      {/* Summary Cards - Updated with new metrics */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="text-3xl font-bold text-white mb-1">{summary.total_unique_findings}</div>
            <div className="text-sm text-slate-400">Unique Findings</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="text-3xl font-bold text-cyan-400 mb-1 flex items-center gap-2">
              {summary.total_in_latest}
              <Activity className="w-5 h-5" />
            </div>
            <div className="text-sm text-slate-400">In Latest Report</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="text-3xl font-bold text-red-400 mb-1">{summary.total_score}</div>
            <div className="text-sm text-slate-400">Total Score</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="text-3xl font-bold text-green-400 mb-1">{summary.total_accepted}</div>
            <div className="text-sm text-slate-400">Accepted</div>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="text-3xl font-bold text-orange-400 mb-1">
              {summary.total_unique_findings - summary.total_accepted}
            </div>
            <div className="text-sm text-slate-400">Unaccepted</div>
          </div>
        </div>
      )}
      
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search findings..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
        
        {/* Latest Report Filter */}
        <div className="flex gap-2">
          {Object.entries(LATEST_FILTER_OPTIONS).map(([key, config]) => {
            const Icon = config.icon
            const count = key === 'all' 
              ? searchFilteredFindings.length 
              : key === 'in_latest' 
                ? inLatestCount 
                : notInLatestCount
            
            return (
              <button
                key={key}
                onClick={() => handleLatestFilterChange(key as LatestFilterKey)}
                className={clsx(
                  "px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 text-sm",
                  latestFilter === key
                    ? key === 'in_latest' 
                      ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-400"
                      : key === 'not_in_latest'
                        ? "bg-slate-700 border-slate-600 text-slate-300"
                        : "bg-cyan-500/20 border-cyan-500/30 text-cyan-400"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                )}
              >
                <Icon size={16} />
                <span className="hidden md:inline">{config.label}</span>
                <span className={clsx(
                  "px-1.5 py-0.5 text-xs rounded-full",
                  latestFilter === key
                    ? "bg-cyan-500/30 text-cyan-300"
                    : "bg-slate-700 text-slate-400"
                )}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
        
        {/* Show Accepted Toggle */}
        <button
          onClick={handleShowAcceptedChange}
          className={clsx(
            "px-4 py-2 rounded-lg border transition-colors flex items-center gap-2",
            showAccepted 
              ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-400"
              : "bg-slate-800 border-slate-700 text-slate-400"
          )}
        >
          <Filter size={18} />
          {showAccepted ? 'Showing All' : 'Hide Accepted'}
        </button>
      </div>
      
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(PINGCASTLE_CATEGORIES).map(([key, config]) => {
          const Icon = config.icon
          const categoryData = key === 'all' 
            ? { total: summary?.total_unique_findings || 0, in_latest: summary?.total_in_latest || 0 }
            : summary?.categories?.[key as keyof typeof summary.categories] || { total: 0, in_latest: 0 }
          
          return (
            <button
              key={key}
              onClick={() => handleCategoryChange(key as CategoryKey)}
              className={clsx(
                "px-4 py-2 rounded-lg border transition-all flex items-center gap-2",
                selectedCategory === key
                  ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                  : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
              )}
            >
              <Icon size={18} />
              <span>{config.label}</span>
              <div className="flex items-center gap-1">
                <span className={clsx(
                  "px-2 py-0.5 text-xs rounded-full",
                  selectedCategory === key
                    ? "bg-cyan-500/30 text-cyan-300"
                    : "bg-slate-700 text-slate-400"
                )}>
                  {categoryData.total}
                </span>
                {categoryData.in_latest > 0 && (
                  <span className={clsx(
                    "px-1.5 py-0.5 text-xs rounded-full flex items-center gap-0.5",
                    selectedCategory === key
                      ? "bg-cyan-400/20 text-cyan-300"
                      : "bg-cyan-500/10 text-cyan-400/70"
                  )}>
                    <Activity size={10} />
                    {categoryData.in_latest}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
      
      {/* Findings List */}
      <div className={clsx("space-y-4 transition-opacity", isFetching && !isLoading && "opacity-60")}>
        {isLoading ? (
          <FindingsListSkeleton rows={8} />
        ) : filteredFindings.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FileWarning size={48} className="mx-auto mb-4 opacity-50" />
            <p>No findings found</p>
            <p className="text-sm mt-2">Upload a PingCastle XML report to see findings</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredFindings.map((finding) => (
              <GroupedFindingCard
                key={`${finding.tool_type}-${finding.category}-${finding.name}`}
                finding={finding}
                onAccept={setFindingToAccept}
                onRemove={handleRemove}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
      
      {/* Accept Modal */}
      <AnimatePresence>
        {findingToAccept && (
          <AcceptFindingModal
            finding={findingToAccept}
            onClose={() => setFindingToAccept(null)}
            onAccept={handleAccept}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Tab configuration
const TABS = [
  { id: 'pingcastle', label: 'PingCastle Findings', icon: Castle },
  { id: 'domaingroups', label: 'Domain Group Analysis', icon: Users }
] as const

type TabId = typeof TABS[number]['id']

export function RiskCatalog() {
  const { data: domains } = useDomains()
  const [selectedDomain, setSelectedDomain] = useState<string>('')
  const [activeTab, setActiveTab] = useState<TabId>('pingcastle')
  
  const domain = selectedDomain || domains?.[0] || ''
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-orbitron text-white mb-2">Risk Catalog</h1>
          <p className="text-slate-400">
            Unified security findings grouped by type • 
            <span className="text-cyan-400 ml-1 inline-flex items-center gap-1">
              <Activity size={14} />
              In Latest
            </span> shows active findings
          </p>
        </div>
        
        {/* Domain Selector */}
        <div className="relative">
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="appearance-none bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 pr-10 text-white focus:border-cyan-500 focus:outline-none min-w-[200px]"
          >
            {domains?.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        </div>
      </div>
      
      {/* Tool Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-px">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "px-6 py-3 rounded-t-lg transition-all flex items-center gap-2 relative",
                activeTab === tab.id
                  ? "bg-slate-800/80 text-cyan-400 border border-slate-700 border-b-transparent -mb-px"
                  : "bg-transparent text-slate-400 hover:text-white hover:bg-slate-800/50"
              )}
            >
              <Icon size={20} />
              <span className="font-medium">{tab.label}</span>
            </button>
          )
        })}
      </div>
      
      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'pingcastle' && <PingCastleSection domain={domain} />}
          {activeTab === 'domaingroups' && <DomainGroupsSection domain={domain} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
