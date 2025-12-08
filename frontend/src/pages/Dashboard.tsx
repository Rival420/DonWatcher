import { motion } from 'framer-motion'
import { 
  Users, 
  Server, 
  Shield, 
  AlertTriangle,
  FileText,
  Activity,
  Zap,
  Lock
} from 'lucide-react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts'
import { useLatestReport, useReports, useDomains, useDomainGroups } from '../hooks/useApi'
import { RiskGauge } from '../components/RiskGauge'
import { StatsCard } from '../components/StatsCard'
import { clsx } from 'clsx'

export function Dashboard() {
  const { data: reports, isLoading: reportsLoading } = useReports()
  const { data: domains } = useDomains()
  const latestDomain = domains?.[0]
  const { data: latestReport } = useLatestReport(latestDomain)
  const { data: domainGroups } = useDomainGroups(latestDomain || '')
  
  // Calculate stats
  const totalFindings = reports?.reduce((sum, r) => sum + (r.total_findings || 0), 0) || 0
  const criticalFindings = reports?.reduce((sum, r) => sum + (r.high_severity_findings || 0), 0) || 0
  const unacceptedMembers = domainGroups?.reduce((sum, g) => sum + g.unaccepted_members, 0) || 0
  
  // Mock historical data for charts
  const historicalData = reports?.slice(0, 10).reverse().map((r, i) => ({
    date: new Date(r.report_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: r.global_score,
    stale: r.stale_objects_score,
    privileged: r.privileged_accounts_score,
    trusts: r.trusts_score,
    anomalies: r.anomalies_score,
  })) || []
  
  const radarData = latestReport ? [
    { category: 'Stale Objects', value: latestReport.stale_objects_score, fullMark: 100 },
    { category: 'Privileged', value: latestReport.privileged_accounts_score, fullMark: 100 },
    { category: 'Trusts', value: latestReport.trusts_score, fullMark: 100 },
    { category: 'Anomalies', value: latestReport.anomalies_score, fullMark: 100 },
  ] : []
  
  if (reportsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-cyber-accent-cyan border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-cyber-text-secondary">Loading dashboard data...</p>
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-display font-semibold text-cyber-text-primary">
              Domain Overview
            </h2>
            <p className="text-sm text-cyber-text-muted mt-1">
              {latestReport?.domain || 'No domain data available'}
            </p>
          </div>
          <div className="px-4 py-2 rounded-lg bg-cyber-accent-cyan/10 border border-cyber-accent-cyan/30">
            <span className="text-sm font-medium text-cyber-accent-cyan">
              SID: {latestReport?.domain_sid?.slice(0, 20)}...
            </span>
          </div>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Users"
            value={latestReport?.user_count || 0}
            icon={<Users className="w-5 h-5" />}
            color="cyan"
          />
          <StatsCard
            title="Computers"
            value={latestReport?.computer_count || 0}
            icon={<Server className="w-5 h-5" />}
            color="green"
          />
          <StatsCard
            title="Domain Controllers"
            value={latestReport?.dc_count || 0}
            icon={<Zap className="w-5 h-5" />}
            color="yellow"
          />
          <StatsCard
            title="Unaccepted Members"
            value={unacceptedMembers}
            icon={<AlertTriangle className="w-5 h-5" />}
            color="red"
            trend={unacceptedMembers > 0 ? 'up' : 'stable'}
          />
        </div>
      </motion.section>
      
      {/* Risk Scores Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Risk Gauge */}
        <motion.section
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="cyber-card flex flex-col items-center justify-center"
        >
          <h3 className="text-sm font-medium text-cyber-text-secondary mb-4">Global Risk Score</h3>
          <RiskGauge 
            value={latestReport?.global_score || 0} 
            label="Risk" 
            size="lg" 
          />
          <div className="mt-4 flex items-center gap-2">
            <span className={clsx(
              'px-3 py-1 rounded-full text-xs font-medium',
              (latestReport?.global_score || 0) >= 75 && 'badge-critical',
              (latestReport?.global_score || 0) >= 50 && (latestReport?.global_score || 0) < 75 && 'badge-high',
              (latestReport?.global_score || 0) >= 25 && (latestReport?.global_score || 0) < 50 && 'badge-medium',
              (latestReport?.global_score || 0) < 25 && 'badge-low',
            )}>
              {(latestReport?.global_score || 0) >= 75 ? 'Critical' : 
               (latestReport?.global_score || 0) >= 50 ? 'High' : 
               (latestReport?.global_score || 0) >= 25 ? 'Medium' : 'Low'}
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
              <RiskGauge value={latestReport?.stale_objects_score || 0} label="Stale" size="sm" />
            </div>
            <div className="flex flex-col items-center">
              <RiskGauge value={latestReport?.privileged_accounts_score || 0} label="Privileged" size="sm" />
            </div>
            <div className="flex flex-col items-center">
              <RiskGauge value={latestReport?.trusts_score || 0} label="Trusts" size="sm" />
            </div>
            <div className="flex flex-col items-center">
              <RiskGauge value={latestReport?.anomalies_score || 0} label="Anomalies" size="sm" />
            </div>
          </div>
        </motion.section>
      </div>
      
      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Historical Trend */}
        <motion.section
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="cyber-card"
        >
          <h3 className="text-sm font-medium text-cyber-text-secondary mb-4">Risk Score Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#151d2b', 
                    border: '1px solid #1e3a5f',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#00d4ff" 
                  fill="url(#scoreGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.section>
        
        {/* Radar Chart */}
        <motion.section
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="cyber-card"
        >
          <h3 className="text-sm font-medium text-cyber-text-secondary mb-4">Risk Distribution</h3>
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
            <a href="/groups" className="text-sm text-cyber-accent-cyan hover:underline">
              View all →
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
    </div>
  )
}

