import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Calendar, ExternalLink, Filter } from 'lucide-react'
import { useReports } from '../hooks/useApi'
import { clsx } from 'clsx'
import { format } from 'date-fns'

export function Reports() {
  const { data: reports, isLoading } = useReports()
  const [filterTool, setFilterTool] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date')
  
  const filteredReports = reports
    ?.filter(r => filterTool === 'all' || r.tool_type === filterTool)
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.report_date).getTime() - new Date(a.report_date).getTime()
      }
      return (b.global_score || 0) - (a.global_score || 0)
    })
  
  const toolTypes = [...new Set(reports?.map(r => r.tool_type) || [])]
  
  const getToolIcon = (tool: string) => {
    switch (tool) {
      case 'pingcastle': return '🏰'
      case 'domain_analysis': return '🔍'
      case 'locksmith': return '🔐'
      default: return '📄'
    }
  }
  
  const getSeverityBadge = (score: number) => {
    if (score >= 75) return <span className="badge badge-critical">Critical</span>
    if (score >= 50) return <span className="badge badge-high">High</span>
    if (score >= 25) return <span className="badge badge-medium">Medium</span>
    return <span className="badge badge-low">Low</span>
  }
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-cyber-accent-cyan border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-cyber-text-secondary">Loading reports...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-4"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-cyber-text-muted" />
          <span className="text-sm text-cyber-text-secondary">Filter:</span>
        </div>
        
        <select
          value={filterTool}
          onChange={(e) => setFilterTool(e.target.value)}
          className="cyber-input w-auto"
        >
          <option value="all">All Tools</option>
          {toolTypes.map(tool => (
            <option key={tool} value={tool}>{tool}</option>
          ))}
        </select>
        
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'date' | 'score')}
          className="cyber-input w-auto"
        >
          <option value="date">Sort by Date</option>
          <option value="score">Sort by Score</option>
        </select>
        
        <div className="ml-auto text-sm text-cyber-text-muted">
          {filteredReports?.length || 0} reports
        </div>
      </motion.div>
      
      {/* Reports List */}
      <div className="space-y-4">
        <AnimatePresence>
          {filteredReports?.map((report, index) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.05 }}
              className="cyber-card hover:border-cyber-accent-cyan/50 cursor-pointer group"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="text-3xl">{getToolIcon(report.tool_type)}</div>
                
                {/* Main Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-cyber-text-primary truncate">
                      {report.domain}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyber-bg-tertiary text-cyber-text-secondary">
                      {report.tool_type}
                    </span>
                    {getSeverityBadge(report.global_score)}
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2 text-sm text-cyber-text-muted">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(report.report_date), 'PPp')}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      {report.total_findings} findings
                    </span>
                  </div>
                  
                  {/* Score breakdown */}
                  {report.tool_type === 'pingcastle' && (
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-cyber-accent-red" />
                        <span className="text-xs text-cyber-text-muted">High: {report.high_severity_findings}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-cyber-accent-yellow" />
                        <span className="text-xs text-cyber-text-muted">Medium: {report.medium_severity_findings}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-cyber-accent-green" />
                        <span className="text-xs text-cyber-text-muted">Low: {report.low_severity_findings}</span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Score */}
                <div className="text-right">
                  <div className={clsx(
                    'text-3xl font-display font-bold',
                    report.global_score >= 75 && 'text-cyber-accent-red',
                    report.global_score >= 50 && report.global_score < 75 && 'text-cyber-accent-orange',
                    report.global_score >= 25 && report.global_score < 50 && 'text-cyber-accent-yellow',
                    report.global_score < 25 && 'text-cyber-accent-green',
                  )}>
                    {report.global_score || 0}
                  </div>
                  <span className="text-xs text-cyber-text-muted">Risk Score</span>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {report.html_file && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(`/uploads/${report.html_file?.split('/').pop()}`, '_blank')
                      }}
                      className="p-2 rounded-lg bg-cyber-accent-cyan/20 text-cyber-accent-cyan hover:bg-cyber-accent-cyan/30 transition-colors"
                      title="Open HTML Report"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {filteredReports?.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-cyber-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-cyber-text-primary">No reports found</h3>
          <p className="text-cyber-text-muted mt-1">Upload a security report to get started</p>
        </div>
      )}
    </div>
  )
}

