import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, 
  Server, 
  AlertTriangle,
  Zap,
  Lock,
  Copy,
  Check,
  GraduationCap,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  ChevronDown,
  Calendar,
  Bug,
  AlertCircle
} from 'lucide-react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts'
import { 
  useDashboardKPIs, 
  useDashboardKPIHistory, 
  useDomains, 
  useDomainGroupsFast,
  useLatestHoxhuntScore,
  useLatestVulnerabilityScore,
  useGlobalRisk
} from '../hooks/useApi'
import { RiskGauge, StatsCard, DashboardSkeleton } from '../components'
import { clsx } from 'clsx'

// Date range options for historical trend
const DATE_RANGE_OPTIONS = [
  { label: 'Last 10 reports', value: 'last10', limit: 10, days: undefined, aggregation: 'none' as const },
  { label: 'Last 30 days', value: 'last30', limit: 100, days: 30, aggregation: 'none' as const },
  { label: 'Last 90 days', value: 'last90', limit: 100, days: 90, aggregation: 'weekly' as const },
  { label: 'Last 6 months', value: 'last180', limit: 100, days: 180, aggregation: 'weekly' as const },
  { label: 'Last year', value: 'last365', limit: 100, days: 365, aggregation: 'monthly' as const },
]

export function Dashboard() {
  const [sidCopied, setSidCopied] = useState(false)
  const [dateRange, setDateRange] = useState(DATE_RANGE_OPTIONS[0])
  const [dateRangeOpen, setDateRangeOpen] = useState(false)
  
  // Use optimized KPI endpoints instead of fetching all reports
  const { data: domains } = useDomains()
  const latestDomain = domains?.[0]
  
  // Main dashboard KPIs - pre-aggregated for fast loading
  const { data: kpiResponse, isLoading: kpisLoading } = useDashboardKPIs(latestDomain)
  
  // Historical KPIs for trend charts with flexible date range
  const { data: historyResponse, isLoading: historyLoading } = useDashboardKPIHistory(
    latestDomain || '', 
    dateRange.limit,
    dateRange.days,
    dateRange.aggregation
  )
  
  // Global Risk Score - true combined score (PingCastle + Domain Groups + Hoxhunt)
  const { data: globalRiskData, isLoading: globalRiskLoading } = useGlobalRisk(latestDomain || '')
  
  // Domain groups for the groups preview section (using fast endpoint)
  const { data: domainGroups } = useDomainGroupsFast(latestDomain || '')
  
  // Hoxhunt security awareness data
  const { data: hoxhuntResponse } = useLatestHoxhuntScore(latestDomain || '')
  const hoxhuntScore = hoxhuntResponse?.score
  
  // Vulnerability analysis data (Outpost24)
  const { data: vulnerabilityResponse } = useLatestVulnerabilityScore(latestDomain || '')
  const vulnerabilityScore = vulnerabilityResponse?.score
  
  // Extract KPIs from response
  const kpis = kpiResponse?.status === 'ok' ? kpiResponse.kpis : null
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setSidCopied(true)
    setTimeout(() => setSidCopied(false), 2000)
  }
  
  // Historical data for charts from KPI history
  const historicalData = historyResponse?.history?.map((h) => ({
    date: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: h.global_score,
    stale: h.stale_objects_score,
    privileged: h.privileged_accounts_score,
    trusts: h.trusts_score,
    anomalies: h.anomalies_score,
  })) || []
  
  // Radar chart data
  const radarData = kpis ? [
    { category: 'Stale Objects', value: kpis.stale_objects_score, fullMark: 100 },
    { category: 'Privileged', value: kpis.privileged_accounts_score, fullMark: 100 },
    { category: 'Trusts', value: kpis.trusts_score, fullMark: 100 },
    { category: 'Anomalies', value: kpis.anomalies_score, fullMark: 100 },
  ] : []
  
  if (kpisLoading) {
    return <DashboardSkeleton />
  }
  
  // Handle no data state
  if (kpiResponse?.status === 'no_data') {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-cyber-accent-yellow mx-auto mb-4" />
          <h2 className="text-xl font-display font-semibold text-cyber-text-primary mb-2">
            No Reports Found
          </h2>
          <p className="text-cyber-text-secondary mb-4">
            Upload security reports to see dashboard metrics.
          </p>
          <a 
            href="/upload" 
            className="inline-block px-6 py-2 bg-cyber-accent-cyan text-cyber-bg-primary rounded-lg hover:bg-cyber-accent-cyan/80 transition-colors"
          >
            Upload Reports
          </a>
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Domain Overview */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="cyber-card"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-display font-semibold text-cyber-text-primary">
              Domain Overview
            </h2>
            <p className="text-sm text-cyber-text-muted mt-1">
              {kpis?.domain || 'No domain data available'}
            </p>
          </div>
          {kpis?.domain_sid && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyber-accent-cyan/10 border border-cyber-accent-cyan/30 group">
              <span className="text-sm font-mono text-cyber-accent-cyan break-all">
                SID: {kpis.domain_sid}
              </span>
              <button
                onClick={() => copyToClipboard(kpis.domain_sid || '')}
                className="p-1 rounded hover:bg-cyber-accent-cyan/20 transition-colors flex-shrink-0"
                title="Copy SID to clipboard"
              >
                {sidCopied ? (
                  <Check className="w-4 h-4 text-cyber-accent-green" />
                ) : (
                  <Copy className="w-4 h-4 text-cyber-accent-cyan opacity-60 group-hover:opacity-100" />
                )}
              </button>
            </div>
          )}
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatsCard
            title="Total Users"
            value={kpis?.user_count || 0}
            icon={<Users className="w-5 h-5" />}
            color="cyan"
          />
          <StatsCard
            title="Computers"
            value={kpis?.computer_count || 0}
            icon={<Server className="w-5 h-5" />}
            color="green"
          />
          <StatsCard
            title="Domain Controllers"
            value={kpis?.dc_count || 0}
            icon={<Zap className="w-5 h-5" />}
            color="yellow"
          />
        </div>
      </motion.section>
      
      {/* Global Risk Score - True combined risk assessment */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="cyber-card"
      >
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-cyber-accent-purple" />
          <h3 className="text-lg font-display font-semibold text-cyber-text-primary">
            Global Risk Score
          </h3>
          <span className="text-xs text-cyber-text-muted ml-2">
            Combined assessment from all security sources
          </span>
        </div>
        
        {globalRiskLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-pulse text-cyber-text-muted">Loading risk assessment...</div>
          </div>
        ) : globalRiskData ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Global Score */}
            <div className="flex flex-col items-center justify-center">
              <RiskGauge 
                value={Math.round(globalRiskData.global_score)} 
                label="Global Risk" 
                size="lg" 
              />
              <div className="mt-3 flex items-center gap-2">
                <span className={clsx(
                  'px-3 py-1 rounded-full text-xs font-medium',
                  globalRiskData.global_score >= 75 && 'badge-critical',
                  globalRiskData.global_score >= 50 && globalRiskData.global_score < 75 && 'badge-high',
                  globalRiskData.global_score >= 25 && globalRiskData.global_score < 50 && 'badge-medium',
                  globalRiskData.global_score < 25 && 'badge-low',
                )}>
                  {globalRiskData.global_score >= 75 ? 'Critical' : 
                   globalRiskData.global_score >= 50 ? 'High' : 
                   globalRiskData.global_score >= 25 ? 'Medium' : 'Low'}
                </span>
                {globalRiskData.trend_direction && (
                  <span className={clsx(
                    'flex items-center gap-1 text-xs',
                    globalRiskData.trend_direction === 'improving' && 'text-cyber-accent-green',
                    globalRiskData.trend_direction === 'degrading' && 'text-cyber-accent-red',
                    globalRiskData.trend_direction === 'stable' && 'text-cyber-text-muted'
                  )}>
                    {globalRiskData.trend_direction === 'improving' && <TrendingDown className="w-3 h-3" />}
                    {globalRiskData.trend_direction === 'degrading' && <TrendingUp className="w-3 h-3" />}
                    {globalRiskData.trend_direction === 'stable' && <Minus className="w-3 h-3" />}
                    {globalRiskData.trend_percentage > 0 ? `${globalRiskData.trend_percentage.toFixed(1)}%` : 'Stable'}
                  </span>
                )}
              </div>
            </div>
            
            {/* Score Breakdown */}
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* PingCastle Contribution */}
              <div className="p-4 rounded-lg border border-cyber-border bg-cyber-bg-secondary">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-cyber-text-muted">PingCastle</span>
                  <span className="text-xs text-cyber-text-muted">55% weight</span>
                </div>
                <div className="text-2xl font-bold font-mono text-cyan-400 mb-2">
                  {globalRiskData.pingcastle_score !== null ? Math.round(globalRiskData.pingcastle_score) : 'N/A'}
                </div>
                <div className="w-full h-1.5 bg-cyber-bg-tertiary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                    style={{ width: `${globalRiskData.pingcastle_score ?? 0}%` }}
                  />
                </div>
                <div className="text-xs text-cyber-text-muted mt-1">
                  Contribution: {globalRiskData.pingcastle_contribution?.toFixed(1) ?? 0} pts
                </div>
              </div>
              
              {/* Domain Groups Contribution */}
              <div className="p-4 rounded-lg border border-cyber-border bg-cyber-bg-secondary">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-cyber-text-muted">Domain Groups</span>
                  <span className="text-xs text-cyber-text-muted">30% weight</span>
                </div>
                <div className="text-2xl font-bold font-mono text-purple-400 mb-2">
                  {Math.round(globalRiskData.domain_group_score)}
                </div>
                <div className="w-full h-1.5 bg-cyber-bg-tertiary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${globalRiskData.domain_group_score}%` }}
                  />
                </div>
                <div className="text-xs text-cyber-text-muted mt-1">
                  Contribution: {globalRiskData.domain_group_contribution?.toFixed(1) ?? 0} pts
                </div>
              </div>
              
              {/* Hoxhunt Contribution */}
              <div className="p-4 rounded-lg border border-cyber-border bg-cyber-bg-secondary">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-cyber-text-muted">Security Awareness</span>
                  <span className="text-xs text-cyber-text-muted">15% weight</span>
                </div>
                <div className="text-2xl font-bold font-mono text-yellow-400 mb-2">
                  {hoxhuntScore ? Math.round(hoxhuntScore.overall_score) : 'N/A'}
                </div>
                <div className="w-full h-1.5 bg-cyber-bg-tertiary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                    style={{ width: `${hoxhuntScore?.overall_score ?? 0}%` }}
                  />
                </div>
                <div className="text-xs text-cyber-text-muted mt-1">
                  {hoxhuntScore ? 'Higher = Better awareness' : 'No data available'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-cyber-text-muted">
            <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Global risk assessment not available</p>
            <p className="text-xs mt-1">Upload security reports to see combined risk score</p>
          </div>
        )}
      </motion.section>
      
      {/* PingCastle Risk Scores Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main PingCastle Risk Gauge */}
        <motion.section
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="cyber-card flex flex-col items-center justify-center"
        >
          <h3 className="text-sm font-medium text-cyber-text-secondary mb-4">PingCastle Risk Score</h3>
          <RiskGauge 
            value={kpis?.global_score || 0} 
            label="Risk" 
            size="lg" 
          />
          <div className="mt-4 flex items-center gap-2">
            <span className={clsx(
              'px-3 py-1 rounded-full text-xs font-medium',
              (kpis?.global_score || 0) >= 75 && 'badge-critical',
              (kpis?.global_score || 0) >= 50 && (kpis?.global_score || 0) < 75 && 'badge-high',
              (kpis?.global_score || 0) >= 25 && (kpis?.global_score || 0) < 50 && 'badge-medium',
              (kpis?.global_score || 0) < 25 && 'badge-low',
            )}>
              {(kpis?.global_score || 0) >= 75 ? 'Critical' : 
               (kpis?.global_score || 0) >= 50 ? 'High' : 
               (kpis?.global_score || 0) >= 25 ? 'Medium' : 'Low'}
            </span>
          </div>
        </motion.section>
        
        {/* Category Gauges */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="cyber-card lg:col-span-2"
        >
          <h3 className="text-sm font-medium text-cyber-text-secondary mb-6">Risk Categories</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col items-center">
              <RiskGauge value={kpis?.stale_objects_score || 0} label="Stale" size="sm" />
            </div>
            <div className="flex flex-col items-center">
              <RiskGauge value={kpis?.privileged_accounts_score || 0} label="Privileged" size="sm" />
            </div>
            <div className="flex flex-col items-center">
              <RiskGauge value={kpis?.trusts_score || 0} label="Trusts" size="sm" />
            </div>
            <div className="flex flex-col items-center">
              <RiskGauge value={kpis?.anomalies_score || 0} label="Anomalies" size="sm" />
            </div>
          </div>
        </motion.section>
      </div>
      
      {/* PingCastle Category Trend Chart - Full Width */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="cyber-card"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-cyber-text-secondary">PingCastle Risk Score Trend</h3>
            {/* Date Range Selector */}
            <div className="relative">
              <button
                onClick={() => setDateRangeOpen(!dateRangeOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyber-bg-secondary border border-cyber-border hover:border-cyber-accent-cyan/50 transition-colors text-sm"
              >
                <Calendar className="w-4 h-4 text-cyber-accent-cyan" />
                <span className="text-cyber-text-primary">{dateRange.label}</span>
                <ChevronDown className={clsx(
                  "w-4 h-4 text-cyber-text-muted transition-transform",
                  dateRangeOpen && "rotate-180"
                )} />
              </button>
              {dateRangeOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 py-1 rounded-lg bg-cyber-bg-secondary border border-cyber-border shadow-lg z-10">
                  {DATE_RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setDateRange(option)
                        setDateRangeOpen(false)
                      }}
                      className={clsx(
                        "w-full px-3 py-2 text-left text-sm hover:bg-cyber-bg-hover transition-colors",
                        dateRange.value === option.value 
                          ? "text-cyber-accent-cyan bg-cyber-accent-cyan/10" 
                          : "text-cyber-text-primary"
                      )}
                    >
                      {option.label}
                      {option.aggregation !== 'none' && (
                        <span className="ml-2 text-xs text-cyber-text-muted">
                          ({option.aggregation})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {historyLoading && (
              <span className="text-xs text-cyber-text-muted animate-pulse">Loading...</span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#00d4ff]" />
              <span className="text-cyber-text-muted">Global</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#f97316]" />
              <span className="text-cyber-text-muted">Stale</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
              <span className="text-cyber-text-muted">Privileged</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#a855f7]" />
              <span className="text-cyber-text-muted">Trusts</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#eab308]" />
              <span className="text-cyber-text-muted">Anomalies</span>
            </div>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historicalData}>
              <defs>
                <linearGradient id="globalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
              <XAxis 
                dataKey="date" 
                stroke="#64748b" 
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#151d2b', 
                  border: '1px solid #1e3a5f',
                  borderRadius: '8px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                }}
                labelStyle={{ color: '#e2e8f0', marginBottom: '8px', fontWeight: 'bold' }}
                itemStyle={{ padding: '2px 0' }}
              />
              <Line 
                type="monotone" 
                dataKey="score" 
                name="Global Score"
                stroke="#00d4ff" 
                strokeWidth={3}
                dot={{ fill: '#00d4ff', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, stroke: '#00d4ff', strokeWidth: 2, fill: '#151d2b' }}
              />
              <Line 
                type="monotone" 
                dataKey="stale" 
                name="Stale Objects"
                stroke="#f97316" 
                strokeWidth={2}
                dot={{ fill: '#f97316', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, stroke: '#f97316', strokeWidth: 2, fill: '#151d2b' }}
              />
              <Line 
                type="monotone" 
                dataKey="privileged" 
                name="Privileged Accounts"
                stroke="#ef4444" 
                strokeWidth={2}
                dot={{ fill: '#ef4444', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, stroke: '#ef4444', strokeWidth: 2, fill: '#151d2b' }}
              />
              <Line 
                type="monotone" 
                dataKey="trusts" 
                name="Trusts"
                stroke="#a855f7" 
                strokeWidth={2}
                dot={{ fill: '#a855f7', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, stroke: '#a855f7', strokeWidth: 2, fill: '#151d2b' }}
              />
              <Line 
                type="monotone" 
                dataKey="anomalies" 
                name="Anomalies"
                stroke="#eab308" 
                strokeWidth={2}
                dot={{ fill: '#eab308', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, stroke: '#eab308', strokeWidth: 2, fill: '#151d2b' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.section>
      
      {/* Radar Chart - Smaller */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.section
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 }}
          className="cyber-card"
        >
          <h3 className="text-sm font-medium text-cyber-text-secondary mb-4">Current Risk Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1e3a5f" />
                <PolarAngleAxis dataKey="category" stroke="#64748b" fontSize={12} />
                <PolarRadiusAxis stroke="#64748b" fontSize={10} />
                <Radar
                  name="Risk"
                  dataKey="value"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>
        
        {/* Quick Stats Card */}
        <motion.section
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 }}
          className="cyber-card"
        >
          <h3 className="text-sm font-medium text-cyber-text-secondary mb-4">Category Breakdown</h3>
          <div className="space-y-4">
            {[
              { name: 'Stale Objects', score: kpis?.stale_objects_score || 0, color: 'bg-orange-500' },
              { name: 'Privileged Accounts', score: kpis?.privileged_accounts_score || 0, color: 'bg-red-500' },
              { name: 'Trusts', score: kpis?.trusts_score || 0, color: 'bg-purple-500' },
              { name: 'Anomalies', score: kpis?.anomalies_score || 0, color: 'bg-yellow-500' },
            ].map((cat) => (
              <div key={cat.name} className="flex items-center gap-4">
                <div className="w-32 text-sm text-cyber-text-muted">{cat.name}</div>
                <div className="flex-1 h-2 bg-cyber-bg-tertiary rounded-full overflow-hidden">
                  <div 
                    className={clsx('h-full rounded-full transition-all duration-500', cat.color)}
                    style={{ width: `${Math.min((cat.score / 400) * 100, 100)}%` }}
                  />
                </div>
                <div className="w-12 text-right text-sm font-mono text-cyber-text-primary">{cat.score}</div>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
      
      {/* Domain Groups Preview */}
      {domainGroups && domainGroups.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="cyber-card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-cyber-text-secondary">Privileged Groups</h3>
            <a href="/risk-catalog" className="text-sm text-cyber-accent-cyan hover:underline">
              View in Risk Catalog →
            </a>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {domainGroups.slice(0, 4).map((group) => (
              <div
                key={group.group_name}
                className={clsx(
                  'p-4 rounded-lg border transition-all duration-200',
                  'bg-cyber-bg-secondary hover:bg-cyber-bg-hover',
                  group.severity === 'critical' && 'border-cyber-accent-red/50',
                  group.severity === 'high' && 'border-cyber-accent-orange/50',
                  group.severity === 'medium' && 'border-cyber-accent-yellow/50',
                  group.severity === 'low' && 'border-cyber-border',
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-cyber-accent-cyan" />
                  <span className="font-medium text-cyber-text-primary text-sm truncate">
                    {group.group_name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-cyber-text-muted">
                  <span>{group.total_members} members</span>
                  <span className={clsx(
                    group.unaccepted_members > 0 ? 'text-cyber-accent-red' : 'text-cyber-accent-green'
                  )}>
                    {group.unaccepted_members} unaccepted
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}
      
      {/* Vulnerability Analysis (Outpost24) */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.43 }}
        className="cyber-card"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-orange-400" />
            <h3 className="text-sm font-medium text-cyber-text-secondary">Vulnerability Analysis (Outpost24)</h3>
          </div>
          <a href="/risk-catalog" className="text-sm text-cyber-accent-cyan hover:underline">
            View Details →
          </a>
        </div>
        
        {vulnerabilityScore ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Risk Score */}
            <div className={clsx(
              'p-4 rounded-lg border flex flex-col items-center justify-center',
              'bg-cyber-bg-secondary',
              vulnerabilityScore.risk_score >= 75 ? 'border-red-500/50' :
              vulnerabilityScore.risk_score >= 50 ? 'border-orange-500/50' :
              vulnerabilityScore.risk_score >= 25 ? 'border-yellow-500/50' :
              'border-green-500/50'
            )}>
              <div className="text-xs text-cyber-text-muted mb-1">Risk Score</div>
              <div className={clsx(
                'text-3xl font-bold font-mono',
                vulnerabilityScore.risk_score >= 75 ? 'text-red-400' :
                vulnerabilityScore.risk_score >= 50 ? 'text-orange-400' :
                vulnerabilityScore.risk_score >= 25 ? 'text-yellow-400' :
                'text-green-400'
              )}>
                {Math.round(vulnerabilityScore.risk_score)}
              </div>
              <div className="text-xs text-cyber-text-muted mt-1">
                {new Date(vulnerabilityScore.scan_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
            
            {/* High Vulnerabilities */}
            <div className="p-4 rounded-lg border border-red-500/30 bg-cyber-bg-secondary">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-cyber-text-muted">High</span>
              </div>
              <div className="text-2xl font-bold font-mono text-red-400">
                {vulnerabilityScore.high_vulnerabilities}
              </div>
              {vulnerabilityScore.high_trend !== 0 && (
                <div className={clsx(
                  'text-xs mt-1 flex items-center gap-1',
                  vulnerabilityScore.high_trend > 0 ? 'text-red-400' : 'text-green-400'
                )}>
                  {vulnerabilityScore.high_trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {vulnerabilityScore.high_trend > 0 ? '+' : ''}{vulnerabilityScore.high_trend}
                </div>
              )}
            </div>
            
            {/* Medium Vulnerabilities */}
            <div className="p-4 rounded-lg border border-orange-500/30 bg-cyber-bg-secondary">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-cyber-text-muted">Medium</span>
              </div>
              <div className="text-2xl font-bold font-mono text-orange-400">
                {vulnerabilityScore.medium_vulnerabilities}
              </div>
              {vulnerabilityScore.medium_trend !== 0 && (
                <div className={clsx(
                  'text-xs mt-1 flex items-center gap-1',
                  vulnerabilityScore.medium_trend > 0 ? 'text-red-400' : 'text-green-400'
                )}>
                  {vulnerabilityScore.medium_trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {vulnerabilityScore.medium_trend > 0 ? '+' : ''}{vulnerabilityScore.medium_trend}
                </div>
              )}
            </div>
            
            {/* Low Vulnerabilities */}
            <div className="p-4 rounded-lg border border-yellow-500/30 bg-cyber-bg-secondary">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-cyber-text-muted">Low</span>
              </div>
              <div className="text-2xl font-bold font-mono text-yellow-400">
                {vulnerabilityScore.low_vulnerabilities}
              </div>
              {vulnerabilityScore.low_trend !== 0 && (
                <div className={clsx(
                  'text-xs mt-1 flex items-center gap-1',
                  vulnerabilityScore.low_trend > 0 ? 'text-red-400' : 'text-green-400'
                )}>
                  {vulnerabilityScore.low_trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {vulnerabilityScore.low_trend > 0 ? '+' : ''}{vulnerabilityScore.low_trend}
                </div>
              )}
            </div>
            
            {/* Total Vulnerabilities */}
            <div className="p-4 rounded-lg border border-cyan-500/30 bg-cyber-bg-secondary">
              <div className="flex items-center gap-2 mb-2">
                <Bug className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-cyber-text-muted">Total</span>
              </div>
              <div className="text-2xl font-bold font-mono text-cyan-400">
                {vulnerabilityScore.total_vulnerabilities.toLocaleString()}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-cyber-text-muted">
            <Bug className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No vulnerability data available</p>
            <p className="text-xs mt-2">Run the DonWatcher-VulnerabilityScanner.ps1 script to collect data</p>
          </div>
        )}
      </motion.section>
      
      {/* Hoxhunt Security Awareness */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="cyber-card"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-medium text-cyber-text-secondary">Security Awareness (Hoxhunt)</h3>
          </div>
          <a href="/risk-catalog" className="text-sm text-cyber-accent-cyan hover:underline">
            View Details →
          </a>
        </div>
        
        {hoxhuntScore ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Overall Score */}
            <div className={clsx(
              'p-4 rounded-lg border flex flex-col items-center justify-center',
              'bg-cyber-bg-secondary',
              hoxhuntScore.overall_score >= 80 ? 'border-green-500/50' :
              hoxhuntScore.overall_score >= 60 ? 'border-yellow-500/50' :
              hoxhuntScore.overall_score >= 40 ? 'border-orange-500/50' :
              'border-red-500/50'
            )}>
              <div className="text-xs text-cyber-text-muted mb-1">Overall Score</div>
              <div className={clsx(
                'text-3xl font-bold font-mono',
                hoxhuntScore.overall_score >= 80 ? 'text-green-400' :
                hoxhuntScore.overall_score >= 60 ? 'text-yellow-400' :
                hoxhuntScore.overall_score >= 40 ? 'text-orange-400' :
                'text-red-400'
              )}>
                {Math.round(hoxhuntScore.overall_score)}
              </div>
              <div className="text-xs text-cyber-text-muted mt-1">
                {new Date(hoxhuntScore.assessment_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </div>
            </div>
            
            {/* Culture & Engagement */}
            <div className="p-4 rounded-lg border border-cyber-border bg-cyber-bg-secondary">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-cyber-text-muted">Culture & Engagement</span>
              </div>
              <div className="text-2xl font-bold font-mono text-cyan-400">
                {Math.round(hoxhuntScore.culture_engagement_score)}
              </div>
              <div className="w-full h-1.5 bg-cyber-bg-tertiary rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                  style={{ width: `${hoxhuntScore.culture_engagement_score}%` }}
                />
              </div>
            </div>
            
            {/* Competence */}
            <div className="p-4 rounded-lg border border-cyber-border bg-cyber-bg-secondary">
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-cyber-text-muted">Competence</span>
              </div>
              <div className="text-2xl font-bold font-mono text-purple-400">
                {Math.round(hoxhuntScore.competence_score)}
              </div>
              <div className="w-full h-1.5 bg-cyber-bg-tertiary rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${hoxhuntScore.competence_score}%` }}
                />
              </div>
            </div>
            
            {/* Real Threat Detection */}
            <div className="p-4 rounded-lg border border-cyber-border bg-cyber-bg-secondary">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-cyber-text-muted">Threat Detection</span>
              </div>
              <div className="text-2xl font-bold font-mono text-yellow-400">
                {Math.round(hoxhuntScore.real_threat_detection_score)}
              </div>
              <div className="w-full h-1.5 bg-cyber-bg-tertiary rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                  style={{ width: `${hoxhuntScore.real_threat_detection_score}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-cyber-text-muted">
            <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No Hoxhunt data available</p>
            <a 
              href="/risk-catalog" 
              className="text-sm text-cyber-accent-cyan hover:underline mt-2 inline-block"
            >
              Add your first assessment →
            </a>
          </div>
        )}
      </motion.section>
    </div>
  )
}
