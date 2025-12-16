/**
 * Skeleton Loading Components
 * 
 * Provides smooth loading states for better UX while data is being fetched.
 * Uses Tailwind CSS animations for consistent styling with the cyber theme.
 */

import { motion } from 'framer-motion'

// Base skeleton element with pulse animation
function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div 
      className={`bg-cyber-bg-tertiary rounded animate-pulse ${className}`}
    />
  )
}

/**
 * Dashboard page skeleton loader
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Domain Overview Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="cyber-card"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-10 w-64 rounded-lg" />
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-cyber-bg-secondary rounded-lg p-4 border border-cyber-border">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-7 w-16 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.section>
      
      {/* Risk Scores Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Risk Gauge */}
        <div className="cyber-card flex flex-col items-center justify-center h-64">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="w-32 h-32 rounded-full" />
          <Skeleton className="h-6 w-20 mt-4 rounded-full" />
        </div>
        
        {/* Category Gauges */}
        <div className="cyber-card lg:col-span-2 h-64">
          <Skeleton className="h-4 w-28 mb-6" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                <Skeleton className="w-20 h-20 rounded-full mb-2" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Chart Section */}
      <div className="cyber-card h-96">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-48" />
          <div className="flex gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-4 w-16" />
            ))}
          </div>
        </div>
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    </div>
  )
}

/**
 * Reports list skeleton loader
 */
export function ReportsListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {[...Array(rows)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="cyber-card"
        >
          <div className="flex items-start gap-4">
            {/* Icon */}
            <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
            
            {/* Main Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-20 rounded" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex items-center gap-4 mt-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            
            {/* Score */}
            <div className="text-right flex-shrink-0">
              <Skeleton className="h-10 w-12 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

/**
 * Risk Catalog findings skeleton loader
 */
export function FindingsListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {[...Array(rows)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          className="cyber-card"
        >
          <div className="flex items-start gap-4">
            {/* Score Badge */}
            <Skeleton className="w-16 h-16 rounded-lg flex-shrink-0" />
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex items-center gap-4 mt-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

/**
 * Domain groups list skeleton loader
 */
export function DomainGroupsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-cyber-bg-secondary border border-cyber-border rounded-xl p-4">
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
      
      {/* Search */}
      <Skeleton className="h-10 w-full rounded-lg" />
      
      {/* Groups and Members */}
      <div className="flex gap-6 min-h-[500px]">
        {/* Groups List */}
        <div className="w-80 flex-shrink-0 space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 rounded-lg border border-cyber-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div>
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-6 w-8 rounded-full" />
              </div>
            </div>
          ))}
        </div>
        
        {/* Members Panel */}
        <div className="flex-1 bg-cyber-bg-secondary/30 rounded-xl border border-cyber-border p-4">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Skeleton className="w-16 h-16 rounded-full mx-auto mb-4" />
              <Skeleton className="h-5 w-32 mx-auto mb-2" />
              <Skeleton className="h-4 w-48 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Summary cards skeleton (reusable)
 */
export function SummaryCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${count} gap-4`}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="bg-cyber-bg-secondary border border-cyber-border rounded-xl p-4">
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  )
}

/**
 * Table skeleton loader (generic)
 */
export function TableSkeleton({ 
  rows = 5, 
  columns = 4 
}: { 
  rows?: number
  columns?: number 
}) {
  return (
    <div className="cyber-card overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-cyber-border">
        {[...Array(columns)].map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      
      {/* Rows */}
      {[...Array(rows)].map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 p-4 border-b border-cyber-border/50 last:border-0">
          {[...Array(columns)].map((_, colIdx) => (
            <Skeleton key={colIdx} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Category tabs skeleton
 */
export function CategoryTabsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {[...Array(count)].map((_, i) => (
        <Skeleton key={i} className="h-10 w-32 rounded-lg" />
      ))}
    </div>
  )
}
