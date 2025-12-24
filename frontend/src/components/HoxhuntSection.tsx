import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  GraduationCap, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Users,
  Brain,
  ShieldAlert,
  Calendar,
  Trash2,
  Eye
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
import { useHoxhuntScores, useHoxhuntHistory, useLatestHoxhuntScore, useDeleteHoxhuntScore } from '../hooks/useApi'
import { HoxhuntEntryModal } from './HoxhuntEntryModal'
import { clsx } from 'clsx'
import type { HoxhuntScore } from '../types'

// Score gauge component
function ScoreGauge({ 
  value, 
  label, 
  color = 'cyan',
  size = 'md' 
}: { 
  value: number
  label: string
  color?: 'cyan' | 'purple' | 'yellow' | 'green'
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClasses = {
    sm: 'w-16 h-16 text-lg',
    md: 'w-24 h-24 text-2xl',
    lg: 'w-32 h-32 text-4xl'
  }
  
  const colorClasses = {
    cyan: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    purple: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    yellow: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    green: 'text-green-400 border-green-500/30 bg-green-500/10'
  }
  
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    if (score >= 40) return 'text-orange-400'
    return 'text-red-400'
  }
  
  return (
    <div className="flex flex-col items-center">
      <div className={clsx(
        'rounded-full border-2 flex items-center justify-center font-bold font-mono',
        sizeClasses[size],
        colorClasses[color]
      )}>
        <span className={getScoreColor(value)}>{Math.round(value)}</span>
      </div>
      <span className="text-sm text-slate-400 mt-2">{label}</span>
    </div>
  )
}

// Score history item
function ScoreHistoryItem({ 
  score, 
  onDelete,
  onView
}: { 
  score: HoxhuntScore
  onDelete: (id: string) => void
  onView: (score: HoxhuntScore) => void
}) {
  const date = new Date(score.assessment_date)
  const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-cyan-500/50 transition-all group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">{monthYear}</span>
          </div>
          
          <div className={clsx(
            'px-3 py-1 rounded-full font-bold font-mono text-lg',
            score.overall_score >= 80 ? 'bg-green-500/20 text-green-400' :
            score.overall_score >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
            score.overall_score >= 40 ? 'bg-orange-500/20 text-orange-400' :
            'bg-red-500/20 text-red-400'
          )}>
            {Math.round(score.overall_score)}
          </div>
          
          <div className="flex items-center gap-3 text-sm">
            <span className="text-cyan-400">{Math.round(score.culture_engagement_score)} Culture</span>
            <span className="text-slate-600">|</span>
            <span className="text-purple-400">{Math.round(score.competence_score)} Competence</span>
            <span className="text-slate-600">|</span>
            <span className="text-yellow-400">{Math.round(score.real_threat_detection_score)} Detection</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onView(score)}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            title="View details"
          >
            <Eye className="w-4 h-4 text-slate-400" />
          </button>
          <button
            onClick={() => onDelete(score.id)}
            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>
      
      {score.notes && (
        <p className="text-sm text-slate-500 mt-2 truncate">{score.notes}</p>
      )}
    </motion.div>
  )
}

// Score detail modal
function ScoreDetailModal({ score, onClose }: { score: HoxhuntScore; onClose: () => void }) {
  const date = new Date(score.assessment_date)
  const formattedDate = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  
  const radarData = [
    { metric: 'Onboarding', value: score.ce_onboarding_rate },
    { metric: 'Sim Reported (CE)', value: score.ce_simulations_reported },
    { metric: 'Quiz Score', value: score.comp_quiz_score },
    { metric: 'Detection Accuracy', value: score.comp_threat_detection_accuracy },
    { metric: 'Reporting Speed', value: score.rtd_reporting_speed },
    { metric: 'Reporting Activity', value: score.rtd_threat_reporting_activity },
  ]
  
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
        className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-orbitron text-cyan-400">{formattedDate}</h3>
            <p className="text-sm text-slate-400">{score.domain}</p>
          </div>
          <div className={clsx(
            'text-4xl font-bold font-mono',
            score.overall_score >= 80 ? 'text-green-400' :
            score.overall_score >= 60 ? 'text-yellow-400' :
            score.overall_score >= 40 ? 'text-orange-400' :
            'text-red-400'
          )}>
            {Math.round(score.overall_score)}
          </div>
        </div>
        
        {/* Radar Chart */}
        <div className="h-64 mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#1e3a5f" />
              <PolarAngleAxis dataKey="metric" stroke="#64748b" fontSize={10} />
              <PolarRadiusAxis stroke="#64748b" fontSize={10} domain={[0, 100]} />
              <Radar
                name="Score"
                dataKey="value"
                stroke="#00d4ff"
                fill="#00d4ff"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Category Breakdown */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-900/50 border border-cyan-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-slate-400">Culture & Engagement</span>
            </div>
            <div className="text-2xl font-bold text-cyan-400 font-mono">
              {Math.round(score.culture_engagement_score)}
            </div>
          </div>
          <div className="bg-slate-900/50 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-slate-400">Competence</span>
            </div>
            <div className="text-2xl font-bold text-purple-400 font-mono">
              {Math.round(score.competence_score)}
            </div>
          </div>
          <div className="bg-slate-900/50 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-slate-400">Threat Detection</span>
            </div>
            <div className="text-2xl font-bold text-yellow-400 font-mono">
              {Math.round(score.real_threat_detection_score)}
            </div>
          </div>
        </div>
        
        {/* Detailed Metrics */}
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-cyan-400 font-medium mb-2">Culture & Engagement</h4>
              <div className="space-y-1 text-slate-400">
                <div className="flex justify-between"><span>Onboarding Rate</span><span className="font-mono">{score.ce_onboarding_rate}</span></div>
                <div className="flex justify-between"><span>Simulations Reported</span><span className="font-mono">{score.ce_simulations_reported}</span></div>
                <div className="flex justify-between"><span>Simulations Misses</span><span className="font-mono">{score.ce_simulations_misses}</span></div>
                <div className="flex justify-between"><span>Threat Indicators</span><span className="font-mono">{score.ce_threat_indicators}</span></div>
              </div>
            </div>
            <div>
              <h4 className="text-purple-400 font-medium mb-2">Competence</h4>
              <div className="space-y-1 text-slate-400">
                <div className="flex justify-between"><span>Simulations Fails</span><span className="font-mono">{score.comp_simulations_fails}</span></div>
                <div className="flex justify-between"><span>Simulations Reported</span><span className="font-mono">{score.comp_simulations_reported}</span></div>
                <div className="flex justify-between"><span>Quiz Score</span><span className="font-mono">{score.comp_quiz_score}</span></div>
                <div className="flex justify-between"><span>Detection Accuracy</span><span className="font-mono">{score.comp_threat_detection_accuracy}</span></div>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-yellow-400 font-medium mb-2">Real Threat Detection</h4>
            <div className="grid grid-cols-2 gap-4 text-slate-400">
              <div className="flex justify-between"><span>Simulations Reported</span><span className="font-mono">{score.rtd_simulations_reported}</span></div>
              <div className="flex justify-between"><span>Simulations Misses</span><span className="font-mono">{score.rtd_simulations_misses}</span></div>
              <div className="flex justify-between"><span>Reporting Speed</span><span className="font-mono">{score.rtd_reporting_speed}</span></div>
              <div className="flex justify-between"><span>Reporting Activity</span><span className="font-mono">{score.rtd_threat_reporting_activity}</span></div>
              <div className="flex justify-between"><span>Detection Accuracy</span><span className="font-mono">{score.rtd_threat_detection_accuracy}</span></div>
            </div>
          </div>
        </div>
        
        {score.notes && (
          <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
            <span className="text-slate-500 text-sm">Notes: </span>
            <span className="text-slate-300 text-sm">{score.notes}</span>
          </div>
        )}
        
        <button
          onClick={onClose}
          className="w-full mt-6 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  )
}

interface HoxhuntSectionProps {
  domain: string
}

export function HoxhuntSection({ domain }: HoxhuntSectionProps) {
  const [showEntryModal, setShowEntryModal] = useState(false)
  const [selectedScore, setSelectedScore] = useState<HoxhuntScore | null>(null)
  
  const { data: scoresResponse, isLoading: scoresLoading } = useHoxhuntScores(domain)
  const { data: historyResponse } = useHoxhuntHistory(domain)
  const { data: latestResponse } = useLatestHoxhuntScore(domain)
  const deleteScore = useDeleteHoxhuntScore()
  
  const scores = scoresResponse?.scores || []
  const history = historyResponse?.history || []
  const latest = latestResponse?.score
  
  // Calculate trend
  const getTrendIcon = () => {
    if (!latest || scores.length < 2) return <Minus className="w-4 h-4 text-slate-400" />
    const previous = scores[1]
    const change = latest.overall_score - previous.overall_score
    if (change > 2) return <TrendingUp className="w-4 h-4 text-green-400" />
    if (change < -2) return <TrendingDown className="w-4 h-4 text-red-400" />
    return <Minus className="w-4 h-4 text-slate-400" />
  }
  
  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this score entry?')) {
      await deleteScore.mutateAsync(id)
    }
  }
  
  // Chart data
  const chartData = history.map(h => ({
    date: new Date(h.assessment_date).toLocaleDateString('en-US', { month: 'short' }),
    overall: h.overall_score,
    culture: h.culture_engagement_score,
    competence: h.competence_score,
    detection: h.real_threat_detection_score
  }))
  
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-slate-400">Overall Score</span>
            {getTrendIcon()}
          </div>
          <div className={clsx(
            'text-3xl font-bold font-mono',
            latest ? (
              latest.overall_score >= 80 ? 'text-green-400' :
              latest.overall_score >= 60 ? 'text-yellow-400' :
              latest.overall_score >= 40 ? 'text-orange-400' :
              'text-red-400'
            ) : 'text-slate-500'
          )}>
            {latest ? Math.round(latest.overall_score) : '--'}
          </div>
        </div>
        
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="text-sm text-slate-400 mb-2">Culture & Engagement</div>
          <div className="text-2xl font-bold text-cyan-400 font-mono">
            {latest ? Math.round(latest.culture_engagement_score) : '--'}
          </div>
        </div>
        
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="text-sm text-slate-400 mb-2">Competence</div>
          <div className="text-2xl font-bold text-purple-400 font-mono">
            {latest ? Math.round(latest.competence_score) : '--'}
          </div>
        </div>
        
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="text-sm text-slate-400 mb-2">Threat Detection</div>
          <div className="text-2xl font-bold text-yellow-400 font-mono">
            {latest ? Math.round(latest.real_threat_detection_score) : '--'}
          </div>
        </div>
        
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="text-sm text-slate-400 mb-2">Entries</div>
          <div className="text-2xl font-bold text-white font-mono">
            {scores.length}
          </div>
        </div>
      </div>
      
      {/* Add Entry Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowEntryModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Monthly Score
        </button>
      </div>
      
      {/* Trend Chart */}
      {chartData.length > 1 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-medium text-slate-400 mb-4">Score Trends</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#151d2b',
                    border: '1px solid #1e3a5f',
                    borderRadius: '8px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="overall"
                  name="Overall"
                  stroke="#00d4ff"
                  strokeWidth={3}
                  dot={{ fill: '#00d4ff', strokeWidth: 0, r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="culture"
                  name="Culture"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={{ fill: '#06b6d4', strokeWidth: 0, r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="competence"
                  name="Competence"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ fill: '#a855f7', strokeWidth: 0, r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="detection"
                  name="Detection"
                  stroke="#eab308"
                  strokeWidth={2}
                  dot={{ fill: '#eab308', strokeWidth: 0, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#00d4ff]" />
              <span className="text-slate-400">Overall</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#06b6d4]" />
              <span className="text-slate-400">Culture</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#a855f7]" />
              <span className="text-slate-400">Competence</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#eab308]" />
              <span className="text-slate-400">Detection</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Score History */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-400">Score History</h3>
        
        {scoresLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
          </div>
        ) : scores.length === 0 ? (
          <div className="text-center py-12 text-slate-400 bg-slate-800/30 border border-slate-700 rounded-xl">
            <GraduationCap size={48} className="mx-auto mb-4 opacity-50" />
            <p>No Hoxhunt scores yet</p>
            <p className="text-sm mt-2">Click "Add Monthly Score" to enter your first assessment</p>
          </div>
        ) : (
          <div className="space-y-2">
            {scores.map((score) => (
              <ScoreHistoryItem
                key={score.id}
                score={score}
                onDelete={handleDelete}
                onView={setSelectedScore}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Modals */}
      <AnimatePresence>
        {showEntryModal && (
          <HoxhuntEntryModal
            domain={domain}
            onClose={() => setShowEntryModal(false)}
          />
        )}
        {selectedScore && (
          <ScoreDetailModal
            score={selectedScore}
            onClose={() => setSelectedScore(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
