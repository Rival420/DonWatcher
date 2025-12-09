import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, 
  Server, 
  AlertTriangle,
  Zap,
  Lock,
  Copy,
  Check
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
import { useLatestReport, useReports, useDomains, useDomainGroups } from '../hooks/useApi'
import { RiskGauge } from '../components/RiskGauge'
import { StatsCard } from '../components/StatsCard'
import { clsx } from 'clsx'

export function Dashboard() {
  const [sidCopied, setSidCopied] = useState(false)
  const { data: reports, isLoading: reportsLoading } = useReports()
  const { data: domains } = useDomains()
  const latestDomain = domains?.[0]
  const { data: latestReport } = useLatestReport(latestDomain)
  const { data: domainGroups } = useDomainGroups(latestDomain || '')
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setSidCopied(true)
    setTimeout(() => setSidCopied(false), 2000)
  }
  
  // Calculate stats
  const unacceptedMembers = domainGroups?.reduce((sum, g) => sum + g.unaccepted_members, 0) || 0
  
  // Mock historical data for charts
  const historicalData = reports?.slice(0, 10).reverse().map((r) => ({
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-display font-semibold text-cyber-text-primary">
              Domain Overview
            </h2>
            <p className="text-sm text-cyber-text-muted mt-1">
              {latestReport?.domain || 'No domain data available'}
            </p>
          </div>
          {latestReport?.domain_sid && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyber-accent-cyan/10 border border-cyber-accent-cyan/30 group">
              <span className="text-sm font-mono text-cyber-accent-cyan break-all">
                SID: {latestReport.domain_sid}
              </span>
              <button
                onClick={() => copyToClipboard(latestReport.domain_sid || '')}
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
      
      {/* Category Trend Chart - Full Width */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="cyber-card"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-cyber-text-secondary">Risk Score Trend by Category</h3>
          <div className="flex items-center gap-4 text-xs">
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
              { name: 'Stale Objects', score: latestReport?.stale_objects_score || 0, color: 'bg-orange-500' },
              { name: 'Privileged Accounts', score: latestReport?.privileged_accounts_score || 0, color: 'bg-red-500' },
              { name: 'Trusts', score: latestReport?.trusts_score || 0, color: 'bg-purple-500' },
              { name: 'Anomalies', score: latestReport?.anomalies_score || 0, color: 'bg-yellow-500' },
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
    </div>
  )
}

