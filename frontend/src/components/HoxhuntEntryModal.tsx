import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Save, GraduationCap, Users, Brain, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react'
import { useSaveHoxhuntScore } from '../hooks/useApi'
import type { HoxhuntScoreInput } from '../types'
import { clsx } from 'clsx'

interface HoxhuntEntryModalProps {
  domain: string
  onClose: () => void
  onSuccess?: () => void
}

// Main score input field component (larger, more prominent)
function MainScoreInput({
  label,
  value,
  onChange,
  color = 'cyan',
  icon: Icon
}: {
  label: string
  value: number
  onChange: (value: number) => void
  color?: 'cyan' | 'purple' | 'yellow' | 'green'
  icon?: React.ElementType
}) {
  const colorClasses = {
    cyan: 'border-cyan-500/50 focus:border-cyan-400',
    purple: 'border-purple-500/50 focus:border-purple-400',
    yellow: 'border-yellow-500/50 focus:border-yellow-400',
    green: 'border-green-500/50 focus:border-green-400'
  }
  
  const textColors = {
    cyan: 'text-cyan-400',
    purple: 'text-purple-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400'
  }
  
  return (
    <div className="flex flex-col items-center p-4 bg-slate-900/50 rounded-lg border border-slate-700">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className={clsx('w-4 h-4', textColors[color])} />}
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <input
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
        className={clsx(
          'w-24 bg-slate-900 border-2 rounded-lg px-3 py-2 text-center text-2xl font-bold font-mono focus:outline-none',
          colorClasses[color],
          textColors[color]
        )}
      />
      <span className="text-xs text-slate-500 mt-1">/ 100</span>
    </div>
  )
}

// Detailed score input field component (smaller, for optional metrics)
function DetailScoreInput({
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
    <div className="flex items-center justify-between py-1.5">
      <label className="text-sm text-slate-400 flex-1" title={tooltip}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
          className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-center text-sm focus:border-cyan-500 focus:outline-none"
        />
      </div>
    </div>
  )
}

// Collapsible category section
function CollapsibleCategorySection({
  title,
  icon: Icon,
  color,
  isExpanded,
  onToggle,
  children
}: {
  title: string
  icon: React.ElementType
  color: string
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className={clsx('w-4 h-4', color)} />
          <span className="text-sm font-medium text-slate-300">{title}</span>
          <span className="text-xs text-slate-500">(optional details)</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </button>
      {isExpanded && (
        <div className="p-3 space-y-1 bg-slate-900/30">
          {children}
        </div>
      )}
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
  
  // Main scores - manually entered from Hoxhunt platform
  const [overallScore, setOverallScore] = useState(0)
  const [cultureEngagementScore, setCultureEngagementScore] = useState(0)
  const [competenceScore, setCompetenceScore] = useState(0)
  const [realThreatDetectionScore, setRealThreatDetectionScore] = useState(0)
  
  // Collapsible sections state
  const [showCultureDetails, setShowCultureDetails] = useState(false)
  const [showCompetenceDetails, setShowCompetenceDetails] = useState(false)
  const [showDetectionDetails, setShowDetectionDetails] = useState(false)
  
  // Culture & Engagement detailed metrics (optional)
  const [ceOnboardingRate, setCeOnboardingRate] = useState(0)
  const [ceSimulationsReported, setCeSimulationsReported] = useState(0)
  const [ceSimulationsMisses, setCeSimulationsMisses] = useState(0)
  const [ceThreatIndicators, setCeThreatIndicators] = useState(0)
  
  // Competence detailed metrics (optional)
  const [compSimulationsFails, setCompSimulationsFails] = useState(0)
  const [compSimulationsReported, setCompSimulationsReported] = useState(0)
  const [compQuizScore, setCompQuizScore] = useState(0)
  const [compThreatDetectionAccuracy, setCompThreatDetectionAccuracy] = useState(0)
  
  // Real Threat Detection detailed metrics (optional)
  const [rtdSimulationsReported, setRtdSimulationsReported] = useState(0)
  const [rtdSimulationsMisses, setRtdSimulationsMisses] = useState(0)
  const [rtdReportingSpeed, setRtdReportingSpeed] = useState(0)
  const [rtdThreatReportingActivity, setRtdThreatReportingActivity] = useState(0)
  const [rtdThreatDetectionAccuracy, setRtdThreatDetectionAccuracy] = useState(0)
  
  // Metadata
  const [notes, setNotes] = useState('')
  const [enteredBy, setEnteredBy] = useState('')
  
  const handleSubmit = async () => {
    const scoreInput: HoxhuntScoreInput = {
      domain,
      assessment_date: assessmentDate,
      // Main scores (required)
      overall_score: overallScore,
      culture_engagement_score: cultureEngagementScore,
      competence_score: competenceScore,
      real_threat_detection_score: realThreatDetectionScore,
      // Detailed metrics (optional)
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
  
  const isValid = overallScore > 0 || cultureEngagementScore > 0 || competenceScore > 0 || realThreatDetectionScore > 0
  
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
          
          {/* Main Scores Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-white">Main Scores</span>
              <span className="text-xs text-slate-500">(enter exactly as shown in Hoxhunt)</span>
            </div>
            
            <div className="bg-slate-900/30 border border-cyan-500/30 rounded-lg p-4">
              <div className="text-center mb-3">
                <span className="text-sm text-slate-400">Overall Score</span>
              </div>
              <div className="flex justify-center">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={overallScore}
                  onChange={(e) => setOverallScore(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className={clsx(
                    'w-32 bg-slate-900 border-2 rounded-lg px-4 py-3 text-center text-4xl font-bold font-mono focus:outline-none',
                    'border-cyan-500/50 focus:border-cyan-400',
                    overallScore >= 80 ? 'text-green-400' :
                    overallScore >= 60 ? 'text-yellow-400' :
                    overallScore >= 40 ? 'text-orange-400' :
                    'text-red-400'
                  )}
                />
              </div>
              <div className="text-center mt-1">
                <span className="text-xs text-slate-500">/ 100</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <MainScoreInput
                label="Culture & Engagement"
                value={cultureEngagementScore}
                onChange={setCultureEngagementScore}
                color="cyan"
                icon={Users}
              />
              <MainScoreInput
                label="Competence"
                value={competenceScore}
                onChange={setCompetenceScore}
                color="purple"
                icon={Brain}
              />
              <MainScoreInput
                label="Threat Detection"
                value={realThreatDetectionScore}
                onChange={setRealThreatDetectionScore}
                color="yellow"
                icon={ShieldAlert}
              />
            </div>
          </div>
          
          {/* Detailed Metrics (Optional, Collapsible) */}
          <div className="space-y-3">
            <div className="text-sm text-slate-500 mb-2">
              Optional: Record individual metrics for detailed tracking
            </div>
            
            {/* Culture & Engagement Details */}
            <CollapsibleCategorySection
              title="Culture & Engagement Details"
              icon={Users}
              color="text-cyan-400"
              isExpanded={showCultureDetails}
              onToggle={() => setShowCultureDetails(!showCultureDetails)}
            >
              <DetailScoreInput 
                label="Onboarding Rate" 
                value={ceOnboardingRate} 
                onChange={setCeOnboardingRate}
              />
              <DetailScoreInput 
                label="Simulations Reported" 
                value={ceSimulationsReported} 
                onChange={setCeSimulationsReported}
              />
              <DetailScoreInput 
                label="Simulations Misses" 
                value={ceSimulationsMisses} 
                onChange={setCeSimulationsMisses}
              />
              <DetailScoreInput 
                label="Threat Indicators" 
                value={ceThreatIndicators} 
                onChange={setCeThreatIndicators}
              />
            </CollapsibleCategorySection>
            
            {/* Competence Details */}
            <CollapsibleCategorySection
              title="Competence Details"
              icon={Brain}
              color="text-purple-400"
              isExpanded={showCompetenceDetails}
              onToggle={() => setShowCompetenceDetails(!showCompetenceDetails)}
            >
              <DetailScoreInput 
                label="Simulations Fails" 
                value={compSimulationsFails} 
                onChange={setCompSimulationsFails}
              />
              <DetailScoreInput 
                label="Simulations Reported" 
                value={compSimulationsReported} 
                onChange={setCompSimulationsReported}
              />
              <DetailScoreInput 
                label="Quiz Score" 
                value={compQuizScore} 
                onChange={setCompQuizScore}
              />
              <DetailScoreInput 
                label="Threat Detection Accuracy" 
                value={compThreatDetectionAccuracy} 
                onChange={setCompThreatDetectionAccuracy}
              />
            </CollapsibleCategorySection>
            
            {/* Real Threat Detection Details */}
            <CollapsibleCategorySection
              title="Real Threat Detection Details"
              icon={ShieldAlert}
              color="text-yellow-400"
              isExpanded={showDetectionDetails}
              onToggle={() => setShowDetectionDetails(!showDetectionDetails)}
            >
              <DetailScoreInput 
                label="Simulations Reported" 
                value={rtdSimulationsReported} 
                onChange={setRtdSimulationsReported}
              />
              <DetailScoreInput 
                label="Simulations Misses" 
                value={rtdSimulationsMisses} 
                onChange={setRtdSimulationsMisses}
              />
              <DetailScoreInput 
                label="Reporting Speed" 
                value={rtdReportingSpeed} 
                onChange={setRtdReportingSpeed}
              />
              <DetailScoreInput 
                label="Threat Reporting Activity" 
                value={rtdThreatReportingActivity} 
                onChange={setRtdThreatReportingActivity}
              />
              <DetailScoreInput 
                label="Threat Detection Accuracy" 
                value={rtdThreatDetectionAccuracy} 
                onChange={setRtdThreatDetectionAccuracy}
              />
            </CollapsibleCategorySection>
          </div>
          
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
            disabled={saveScore.isPending || !isValid}
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
