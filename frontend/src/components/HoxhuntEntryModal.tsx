import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Save, GraduationCap, Users, Brain, ShieldAlert } from 'lucide-react'
import { useSaveHoxhuntScore } from '../hooks/useApi'
import type { HoxhuntScoreInput } from '../types'
import { clsx } from 'clsx'

interface HoxhuntEntryModalProps {
  domain: string
  onClose: () => void
  onSuccess?: () => void
}

// Score input field component
function ScoreInput({
  label,
  value,
  onChange,
  tooltip
}: {
  label: string
  value: number
  onChange: (value: number) => void
  tooltip?: string
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <label className="text-sm text-slate-300 flex-1" title={tooltip}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
          className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-center text-sm focus:border-cyan-500 focus:outline-none"
        />
        <span className="text-slate-500 text-sm w-8">/ 100</span>
      </div>
    </div>
  )
}

// Category section component
function CategorySection({
  title,
  icon: Icon,
  color,
  children
}: {
  title: string
  icon: React.ElementType
  color: string
  children: React.ReactNode
}) {
  return (
    <div className="border border-slate-700 rounded-lg p-4">
      <div className={clsx('flex items-center gap-2 mb-3 pb-2 border-b border-slate-700')}>
        <Icon className={clsx('w-5 h-5', color)} />
        <h4 className="font-medium text-white">{title}</h4>
      </div>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  )
}

export function HoxhuntEntryModal({ domain, onClose, onSuccess }: HoxhuntEntryModalProps) {
  const saveScore = useSaveHoxhuntScore()
  
  // Form state
  const [assessmentDate, setAssessmentDate] = useState(() => {
    const now = new Date()
    // Default to first of current month
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })
  
  // Culture & Engagement scores
  const [ceOnboardingRate, setCeOnboardingRate] = useState(0)
  const [ceSimulationsReported, setCeSimulationsReported] = useState(0)
  const [ceSimulationsMisses, setCeSimulationsMisses] = useState(0)
  const [ceThreatIndicators, setCeThreatIndicators] = useState(0)
  
  // Competence scores
  const [compSimulationsFails, setCompSimulationsFails] = useState(0)
  const [compSimulationsReported, setCompSimulationsReported] = useState(0)
  const [compQuizScore, setCompQuizScore] = useState(0)
  const [compThreatDetectionAccuracy, setCompThreatDetectionAccuracy] = useState(0)
  
  // Real Threat Detection scores
  const [rtdSimulationsReported, setRtdSimulationsReported] = useState(0)
  const [rtdSimulationsMisses, setRtdSimulationsMisses] = useState(0)
  const [rtdReportingSpeed, setRtdReportingSpeed] = useState(0)
  const [rtdThreatReportingActivity, setRtdThreatReportingActivity] = useState(0)
  const [rtdThreatDetectionAccuracy, setRtdThreatDetectionAccuracy] = useState(0)
  
  // Metadata
  const [notes, setNotes] = useState('')
  const [enteredBy, setEnteredBy] = useState('')
  
  // Calculate preview scores
  const cultureEngagementScore = Math.round((ceOnboardingRate + ceSimulationsReported + ceSimulationsMisses + ceThreatIndicators) / 4)
  const competenceScore = Math.round((compSimulationsFails + compSimulationsReported + compQuizScore + compThreatDetectionAccuracy) / 4)
  const realThreatDetectionScore = Math.round((rtdSimulationsReported + rtdSimulationsMisses + rtdReportingSpeed + rtdThreatReportingActivity + rtdThreatDetectionAccuracy) / 5)
  const overallScore = Math.round((cultureEngagementScore + competenceScore + realThreatDetectionScore) / 3)
  
  const handleSubmit = async () => {
    const scoreInput: HoxhuntScoreInput = {
      domain,
      assessment_date: assessmentDate,
      ce_onboarding_rate: ceOnboardingRate,
      ce_simulations_reported: ceSimulationsReported,
      ce_simulations_misses: ceSimulationsMisses,
      ce_threat_indicators: ceThreatIndicators,
      comp_simulations_fails: compSimulationsFails,
      comp_simulations_reported: compSimulationsReported,
      comp_quiz_score: compQuizScore,
      comp_threat_detection_accuracy: compThreatDetectionAccuracy,
      rtd_simulations_reported: rtdSimulationsReported,
      rtd_simulations_misses: rtdSimulationsMisses,
      rtd_reporting_speed: rtdReportingSpeed,
      rtd_threat_reporting_activity: rtdThreatReportingActivity,
      rtd_threat_detection_accuracy: rtdThreatDetectionAccuracy,
      notes: notes || undefined,
      entered_by: enteredBy || undefined
    }
    
    try {
      await saveScore.mutateAsync(scoreInput)
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Failed to save Hoxhunt score:', error)
    }
  }
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-6 h-6 text-cyan-400" />
            <div>
              <h3 className="text-xl font-orbitron text-cyan-400">Add Hoxhunt Score</h3>
              <p className="text-sm text-slate-400">{domain}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Assessment Date */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Assessment Month</label>
            <input
              type="date"
              value={assessmentDate}
              onChange={(e) => setAssessmentDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>
          
          {/* Preview Score */}
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">Calculated Overall Score</span>
              <span className={clsx(
                'text-3xl font-bold font-mono',
                overallScore >= 80 ? 'text-green-400' :
                overallScore >= 60 ? 'text-yellow-400' :
                overallScore >= 40 ? 'text-orange-400' :
                'text-red-400'
              )}>
                {overallScore}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <div className="text-slate-500">Culture</div>
                <div className="text-cyan-400 font-mono">{cultureEngagementScore}</div>
              </div>
              <div>
                <div className="text-slate-500">Competence</div>
                <div className="text-purple-400 font-mono">{competenceScore}</div>
              </div>
              <div>
                <div className="text-slate-500">Detection</div>
                <div className="text-yellow-400 font-mono">{realThreatDetectionScore}</div>
              </div>
            </div>
          </div>
          
          {/* Culture & Engagement */}
          <CategorySection 
            title="Culture & Engagement" 
            icon={Users} 
            color="text-cyan-400"
          >
            <ScoreInput 
              label="Onboarding Rate" 
              value={ceOnboardingRate} 
              onChange={setCeOnboardingRate}
              tooltip="Percentage of users who completed onboarding"
            />
            <ScoreInput 
              label="Simulations Reported" 
              value={ceSimulationsReported} 
              onChange={setCeSimulationsReported}
              tooltip="Percentage of simulated phishing reported correctly"
            />
            <ScoreInput 
              label="Simulations Misses" 
              value={ceSimulationsMisses} 
              onChange={setCeSimulationsMisses}
              tooltip="Score for missed simulation rate (higher = fewer misses)"
            />
            <ScoreInput 
              label="Threat Indicators" 
              value={ceThreatIndicators} 
              onChange={setCeThreatIndicators}
              tooltip="Ability to identify threat indicators"
            />
          </CategorySection>
          
          {/* Competence */}
          <CategorySection 
            title="Competence" 
            icon={Brain} 
            color="text-purple-400"
          >
            <ScoreInput 
              label="Simulations Fails" 
              value={compSimulationsFails} 
              onChange={setCompSimulationsFails}
              tooltip="Score based on simulation failure rate (higher = fewer fails)"
            />
            <ScoreInput 
              label="Simulations Reported" 
              value={compSimulationsReported} 
              onChange={setCompSimulationsReported}
              tooltip="Percentage of simulations correctly reported"
            />
            <ScoreInput 
              label="Quiz Score" 
              value={compQuizScore} 
              onChange={setCompQuizScore}
              tooltip="Average training quiz score"
            />
            <ScoreInput 
              label="Threat Detection Accuracy" 
              value={compThreatDetectionAccuracy} 
              onChange={setCompThreatDetectionAccuracy}
              tooltip="Accuracy in identifying real vs simulated threats"
            />
          </CategorySection>
          
          {/* Real Threat Detection */}
          <CategorySection 
            title="Real Threat Detection" 
            icon={ShieldAlert} 
            color="text-yellow-400"
          >
            <ScoreInput 
              label="Simulations Reported" 
              value={rtdSimulationsReported} 
              onChange={setRtdSimulationsReported}
              tooltip="Real threat simulations reported"
            />
            <ScoreInput 
              label="Simulations Misses" 
              value={rtdSimulationsMisses} 
              onChange={setRtdSimulationsMisses}
              tooltip="Score for missed real threat simulations"
            />
            <ScoreInput 
              label="Reporting Speed" 
              value={rtdReportingSpeed} 
              onChange={setRtdReportingSpeed}
              tooltip="Average speed of threat reporting"
            />
            <ScoreInput 
              label="Threat Reporting Activity" 
              value={rtdThreatReportingActivity} 
              onChange={setRtdThreatReportingActivity}
              tooltip="Overall threat reporting activity level"
            />
            <ScoreInput 
              label="Threat Detection Accuracy" 
              value={rtdThreatDetectionAccuracy} 
              onChange={setRtdThreatDetectionAccuracy}
              tooltip="Accuracy in detecting real threats"
            />
          </CategorySection>
          
          {/* Notes */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this assessment..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none resize-none"
              rows={2}
            />
          </div>
          
          {/* Entered By */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Entered By (optional)</label>
            <input
              type="text"
              value={enteredBy}
              onChange={(e) => setEnteredBy(e.target.value)}
              placeholder="Your name"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>
        
        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saveScore.isPending}
            className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {saveScore.isPending ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Scores
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
