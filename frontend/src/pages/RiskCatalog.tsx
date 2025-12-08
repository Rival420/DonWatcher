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
  ExternalLink,
  Filter,
  ChevronDown,
  Users,
  FileWarning,
  Network,
  Bug
} from 'lucide-react'
import { useFindings, useFindingsSummary, useDomains, useAcceptRisk, useRemoveAcceptedRisk } from '../hooks/useApi'
import { clsx } from 'clsx'
import type { Finding, AcceptRiskRequest } from '../types'

// Category configuration
const CATEGORIES = {
  all: { label: 'All Findings', icon: Shield, color: 'cyan' },
  PrivilegedAccounts: { label: 'Privileged Accounts', icon: Users, color: 'red' },
  StaleObjects: { label: 'Stale Objects', icon: Clock, color: 'orange' },
  Trusts: { label: 'Trusts', icon: Link2, color: 'purple' },
  Anomalies: { label: 'Anomalies', icon: Bug, color: 'yellow' }
} as const

type CategoryKey = keyof typeof CATEGORIES

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
  finding: Finding
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
              getSeverityColor(finding.score)
            )}>
              {finding.score} pts
            </span>
            <span className="text-slate-400 text-sm">{finding.category}</span>
          </div>
          <p className="text-white font-mono text-sm">{finding.name}</p>
          <p className="text-slate-400 text-sm mt-1">{finding.description}</p>
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

// Finding Card Component
function FindingCard({ 
  finding, 
  onAccept, 
  onRemove,
  onViewReport
}: { 
  finding: Finding
  onAccept: (finding: Finding) => void
  onRemove: (finding: Finding) => void
  onViewReport: (reportId: string) => void
}) {
  const CategoryIcon = CATEGORIES[finding.category as CategoryKey]?.icon || AlertTriangle
  
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
          getSeverityColor(finding.score)
        )}>
          <span className="text-2xl font-bold font-mono">{finding.score}</span>
          <span className="text-xs uppercase">{getSeverityLabel(finding.score)}</span>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <CategoryIcon size={16} className="text-slate-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">
              {finding.category}
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
          
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-slate-500">
              {finding.domain}
            </span>
            {finding.report_date && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-xs text-slate-500">
                  {new Date(finding.report_date).toLocaleDateString()}
                </span>
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
          <button
            onClick={() => onViewReport(finding.report_id)}
            className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors flex items-center gap-1"
          >
            <ExternalLink size={14} />
            Report
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export function RiskCatalog() {
  const { data: domains } = useDomains()
  const [selectedDomain, setSelectedDomain] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showAccepted, setShowAccepted] = useState(true)
  const [findingToAccept, setFindingToAccept] = useState<Finding | null>(null)
  
  const domain = selectedDomain || domains?.[0] || ''
  
  const { data: findings, isLoading } = useFindings({
    domain: domain || undefined,
    category: selectedCategory !== 'all' ? selectedCategory : undefined,
    tool_type: 'pingcastle',
    include_accepted: showAccepted
  })
  
  const { data: summary } = useFindingsSummary(domain || undefined)
  
  const acceptRisk = useAcceptRisk()
  const removeAcceptedRisk = useRemoveAcceptedRisk()
  
  // Filter findings by search
  const filteredFindings = findings?.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.description.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []
  
  const handleAccept = (reason: string, expiresAt?: string) => {
    if (!findingToAccept) return
    
    acceptRisk.mutate({
      tool_type: findingToAccept.tool_type,
      category: findingToAccept.category,
      name: findingToAccept.name,
      reason: reason || undefined,
      accepted_by: 'admin', // TODO: Get from auth
      expires_at: expiresAt
    })
    setFindingToAccept(null)
  }
  
  const handleRemove = (finding: Finding) => {
    removeAcceptedRisk.mutate({
      tool_type: finding.tool_type,
      category: finding.category,
      name: finding.name
    })
  }
  
  const handleViewReport = async (reportId: string) => {
    try {
      const response = await fetch(`/api/reports/${reportId}/html`)
      if (response.ok) {
        const data = await response.json()
        window.open(data.html_url, '_blank')
      } else {
        // Fallback to reports page
        window.location.href = `/reports`
      }
    } catch {
      window.location.href = `/reports`
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-orbitron text-white mb-2">Risk Catalog</h1>
        <p className="text-slate-400">
          Security findings from PingCastle scans • Accept findings to manage alerts
        </p>
      </div>
      
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="text-3xl font-bold text-white mb-1">{summary.total_findings}</div>
            <div className="text-sm text-slate-400">Total Findings</div>
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
              {summary.total_findings - summary.total_accepted}
            </div>
            <div className="text-sm text-slate-400">Unaccepted</div>
          </div>
        </div>
      )}
      
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Domain Select */}
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
        
        {/* Show Accepted Toggle */}
        <button
          onClick={() => setShowAccepted(!showAccepted)}
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
        {Object.entries(CATEGORIES).map(([key, config]) => {
          const Icon = config.icon
          const count = key === 'all' 
            ? summary?.total_findings || 0
            : summary?.categories?.[key as keyof typeof summary.categories]?.total || 0
          
          return (
            <button
              key={key}
              onClick={() => setSelectedCategory(key as CategoryKey)}
              className={clsx(
                "px-4 py-2 rounded-lg border transition-all flex items-center gap-2",
                selectedCategory === key
                  ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                  : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600"
              )}
            >
              <Icon size={18} />
              <span>{config.label}</span>
              <span className={clsx(
                "px-2 py-0.5 text-xs rounded-full",
                selectedCategory === key
                  ? "bg-cyan-500/30 text-cyan-300"
                  : "bg-slate-700 text-slate-400"
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>
      
      {/* Findings List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-4" />
            Loading findings...
          </div>
        ) : filteredFindings.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FileWarning size={48} className="mx-auto mb-4 opacity-50" />
            <p>No findings found</p>
            <p className="text-sm mt-2">Upload a PingCastle XML report to see findings</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredFindings.map((finding) => (
              <FindingCard
                key={`${finding.report_id}-${finding.name}`}
                finding={finding}
                onAccept={setFindingToAccept}
                onRemove={handleRemove}
                onViewReport={handleViewReport}
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

