import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Download, 
  Terminal, 
  Server,
  Clock,
  Shuffle,
  Shield,
  ShieldOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Package,
  Edit3
} from 'lucide-react'
import { clsx } from 'clsx'

interface CompilerStatus {
  status: string
  compiler: string
  compiler_version: string | null
  go_installed: boolean
  can_compile_windows: boolean
  can_cross_compile: boolean
  cache: {
    cached_beacons: number
    max_cache_size: number
    cache_ttl_hours: number
  }
  supported_targets: string[]
}

interface BeaconDownloadModalProps {
  isOpen: boolean
  onClose: () => void
}

type DownloadFormat = 'exe' | 'zip'

// Get default backend URL - frontend is typically on 3000, backend on 8080
function getDefaultBackendUrl(): string {
  const currentHost = window.location.hostname
  // Default backend port is 8080
  return `${window.location.protocol}//${currentHost}:8080`
}

export function BeaconDownloadModal({ isOpen, onClose }: BeaconDownloadModalProps) {
  // Configuration state - Default to EXE since Go can cross-compile!
  const [format, setFormat] = useState<DownloadFormat>('exe')
  const [serverUrl, setServerUrl] = useState(getDefaultBackendUrl())
  const [sleepInterval, setSleepInterval] = useState(60)
  const [jitterPercent, setJitterPercent] = useState(10)
  const [verifySsl, setVerifySsl] = useState(true)
  
  // UI state
  const [compilerStatus, setCompilerStatus] = useState<CompilerStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadSuccess, setDownloadSuccess] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Fetch compiler status when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      setDownloadError(null)
      setDownloadSuccess(false)
      
      fetch('/api/beacons/compiler/status')
        .then(res => res.json())
        .then(data => {
          setCompilerStatus(data)
          // Go can cross-compile! Default to EXE if available
          if (data.can_compile_windows || data.can_cross_compile) {
            setFormat('exe')
          } else {
            setFormat('zip')
          }
        })
        .catch(err => {
          console.error('Failed to get compiler status:', err)
          setFormat('zip')
        })
        .finally(() => setIsLoading(false))
    }
  }, [isOpen])

  // Handle download
  const handleDownload = async () => {
    setIsDownloading(true)
    setDownloadError(null)
    setDownloadSuccess(false)

    try {
      const params = new URLSearchParams({
        format,
        sleep: sleepInterval.toString(),
        jitter: jitterPercent.toString(),
        server_url: serverUrl,
        verify_ssl: verifySsl.toString()
      })
      
      const response = await fetch(`/api/beacons/download?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Download failed' }))
        throw new Error(errorData.detail || `HTTP ${response.status}`)
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename=(.+)/)
      const filename = filenameMatch ? filenameMatch[1] : format === 'exe' ? 'DonWatcher-Beacon.exe' : 'DonWatcher-Beacon.zip'

      // Download the file
      const blob = await response.blob()
      
      // Verify blob has content
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty')
      }
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      
      // Delay cleanup to ensure download starts
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }, 100)

      setDownloadSuccess(true)
      
      // Close modal after success
      setTimeout(() => {
        onClose()
      }, 1500)

    } catch (err) {
      console.error('Download failed:', err)
      setDownloadError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setIsDownloading(false)
    }
  }

  if (!isOpen) return null

  // Go compiler can cross-compile Windows EXE from Linux!
  const compilerAvailable = compilerStatus?.go_installed ?? false
  const canCompileWindows = compilerStatus?.can_compile_windows ?? false
  const compilerVersion = compilerStatus?.compiler_version ?? null
  
  // With Go, EXE is available if compiler is installed (cross-compile works!)
  const serverExeAvailable = compilerAvailable && canCompileWindows

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <div 
              className="w-full max-w-2xl max-h-[90vh] bg-gray-900 border border-green-500/30 rounded-xl shadow-2xl shadow-green-500/10 flex flex-col my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header - Fixed at top */}
              <div className="relative px-6 py-4 border-b border-green-500/20 bg-gradient-to-r from-green-500/10 to-transparent flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Download className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold font-mono text-green-400">
                      DOWNLOAD BEACON
                    </h2>
                    <p className="text-sm text-gray-500 font-mono">
                      Configure and download your beacon agent
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="absolute right-4 top-4 p-1 text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content - Scrollable */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
                    <span className="ml-3 text-gray-400 font-mono">Checking compiler status...</span>
                  </div>
                ) : (
                  <>
                    {/* Go Compiler Info Banner */}
                    {serverExeAvailable && (
                      <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-green-400 font-mono font-bold">
                              Go Cross-Compiler Ready {compilerVersion && `(${compilerVersion})`}
                            </p>
                            <p className="text-xs text-green-300/70 mt-1">
                              Download a Windows .exe directly - compiled on-the-fly with your configuration embedded.
                              Includes Windows service installation support!
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Compiler not available warning */}
                    {!serverExeAvailable && (
                      <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-yellow-400 font-mono font-bold">
                              Go Compiler Not Available
                            </p>
                            <p className="text-xs text-yellow-300/70 mt-1">
                              Download the ZIP package and build locally with Go, or contact your admin to install Go on the server.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Format Selection */}
                    <div className="space-y-3">
                      <label className="block text-sm font-mono text-gray-400 uppercase tracking-wider">
                        Download Format
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        {/* EXE Option - Recommended when Go is available */}
                        <button
                          onClick={() => serverExeAvailable && setFormat('exe')}
                          disabled={!serverExeAvailable}
                          className={clsx(
                            'relative p-4 rounded-lg border-2 text-left transition-all duration-200',
                            format === 'exe' && serverExeAvailable
                              ? 'border-green-500 bg-green-500/10'
                              : !serverExeAvailable
                                ? 'border-gray-700 bg-gray-800/50 opacity-50 cursor-not-allowed'
                                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={clsx(
                              'p-2 rounded-lg',
                              format === 'exe' && serverExeAvailable ? 'bg-green-500/20' : 'bg-gray-700'
                            )}>
                              <Cpu className={clsx(
                                'w-5 h-5',
                                format === 'exe' && serverExeAvailable ? 'text-green-400' : 'text-gray-400'
                              )} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={clsx(
                                  'font-mono font-bold',
                                  format === 'exe' && serverExeAvailable ? 'text-green-400' : 'text-gray-300'
                                )}>
                                  .EXE
                                </span>
                                {serverExeAvailable && (
                                  <span className="px-2 py-0.5 rounded text-xs font-mono bg-green-500/20 text-green-400">
                                    RECOMMENDED
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 mt-1">
                                Ready-to-run Windows executable with service support.
                              </p>
                            </div>
                          </div>
                          {!serverExeAvailable && (
                            <div className="mt-3 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                              <p className="text-xs text-yellow-400 font-mono">
                                <AlertCircle className="w-3 h-3 inline mr-1" />
                                Go compiler not installed on server
                              </p>
                            </div>
                          )}
                          {format === 'exe' && serverExeAvailable && (
                            <div className="absolute top-2 right-2">
                              <CheckCircle2 className="w-5 h-5 text-green-400" />
                            </div>
                          )}
                        </button>

                        {/* ZIP Option - For manual builds */}
                        <button
                          onClick={() => setFormat('zip')}
                          className={clsx(
                            'relative p-4 rounded-lg border-2 text-left transition-all duration-200',
                            format === 'zip'
                              ? 'border-green-500 bg-green-500/10'
                              : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={clsx(
                              'p-2 rounded-lg',
                              format === 'zip' ? 'bg-green-500/20' : 'bg-gray-700'
                            )}>
                              <Package className={clsx(
                                'w-5 h-5',
                                format === 'zip' ? 'text-green-400' : 'text-gray-400'
                              )} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={clsx(
                                  'font-mono font-bold',
                                  format === 'zip' ? 'text-green-400' : 'text-gray-300'
                                )}>
                                  .ZIP
                                </span>
                                {!serverExeAvailable && (
                                  <span className="px-2 py-0.5 rounded text-xs font-mono bg-green-500/20 text-green-400">
                                    RECOMMENDED
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 mt-1">
                                Go source package for local builds or customization.
                              </p>
                            </div>
                          </div>
                          {format === 'zip' && (
                            <div className="absolute top-2 right-2">
                              <CheckCircle2 className="w-5 h-5 text-green-400" />
                            </div>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* EXE Features Info */}
                    {format === 'exe' && serverExeAvailable && (
                      <div className="p-4 rounded-lg bg-black/50 border border-green-500/20">
                        <div className="flex items-center gap-2 mb-3">
                          <Terminal className="w-4 h-4 text-green-400" />
                          <span className="text-sm font-mono text-green-400 uppercase">
                            Usage After Download
                          </span>
                        </div>
                        <pre className="text-xs font-mono text-gray-400 overflow-x-auto whitespace-pre-wrap">
{`# Run interactively:
.\\DonWatcher-Beacon.exe run

# Install as Windows service (requires Admin):
.\\DonWatcher-Beacon.exe install
.\\DonWatcher-Beacon.exe start

# Check status:
.\\DonWatcher-Beacon.exe status`}
                        </pre>
                      </div>
                    )}

                    {/* Quick Build Instructions for ZIP format */}
                    {format === 'zip' && (
                      <div className="p-4 rounded-lg bg-black/50 border border-green-500/20">
                        <div className="flex items-center gap-2 mb-3">
                          <Terminal className="w-4 h-4 text-green-400" />
                          <span className="text-sm font-mono text-green-400 uppercase">
                            Build Locally (After Download)
                          </span>
                        </div>
                        <pre className="text-xs font-mono text-gray-400 overflow-x-auto whitespace-pre-wrap">
{`# Build Windows EXE from any OS:
cd DonWatcher-Beacon
GOOS=windows GOARCH=amd64 go build -o beacon.exe .

# Or with embedded config:
go build -ldflags "-X main.ServerURL=${serverUrl}" -o beacon.exe`}
                        </pre>
                      </div>
                    )}

                    {/* Configuration */}
                    <div className="space-y-4">
                      <label className="block text-sm font-mono text-gray-400 uppercase tracking-wider">
                        Beacon Configuration
                      </label>
                      
                      {/* Server URL - Editable */}
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm text-gray-400">
                          <Server className="w-4 h-4" />
                          Server URL (Backend API)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={serverUrl}
                            onChange={(e) => setServerUrl(e.target.value)}
                            placeholder="http://donwatcher:8080"
                            className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-green-400 font-mono text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/50"
                          />
                          <button
                            onClick={() => setServerUrl(getDefaultBackendUrl())}
                            className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white transition-colors"
                            title="Reset to default"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-600">
                          Backend API endpoint (usually port 8080, not frontend port 3000)
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {/* Sleep Interval */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm text-gray-400">
                            <Clock className="w-4 h-4" />
                            Sleep Interval
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="10"
                              max="300"
                              step="10"
                              value={sleepInterval}
                              onChange={(e) => setSleepInterval(Number(e.target.value))}
                              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                            />
                            <span className="w-16 text-right font-mono text-green-400">
                              {sleepInterval}s
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            How often the beacon checks in with the server
                          </p>
                        </div>

                        {/* Jitter */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-sm text-gray-400">
                            <Shuffle className="w-4 h-4" />
                            Jitter
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="50"
                              step="5"
                              value={jitterPercent}
                              onChange={(e) => setJitterPercent(Number(e.target.value))}
                              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                            />
                            <span className="w-16 text-right font-mono text-green-400">
                              ±{jitterPercent}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            Randomization to avoid detection patterns
                          </p>
                        </div>
                      </div>

                      {/* Advanced Options Toggle */}
                      <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        <span className={clsx(
                          'transition-transform',
                          showAdvanced && 'rotate-90'
                        )}>▶</span>
                        Advanced Options
                      </button>

                      {/* Advanced Options Panel */}
                      <AnimatePresence>
                        {showAdvanced && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700 space-y-4">
                              {/* SSL Verification Toggle */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {verifySsl ? (
                                    <Shield className="w-5 h-5 text-green-400" />
                                  ) : (
                                    <ShieldOff className="w-5 h-5 text-yellow-400" />
                                  )}
                                  <div>
                                    <span className="text-sm text-gray-300">Verify SSL Certificate</span>
                                    <p className="text-xs text-gray-600">
                                      Disable for self-signed certificates (not recommended for production)
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => setVerifySsl(!verifySsl)}
                                  className={clsx(
                                    'relative w-12 h-6 rounded-full transition-colors',
                                    verifySsl ? 'bg-green-500' : 'bg-gray-600'
                                  )}
                                >
                                  <span
                                    className={clsx(
                                      'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                                      verifySsl ? 'left-7' : 'left-1'
                                    )}
                                  />
                                </button>
                              </div>
                              
                              {!verifySsl && (
                                <div className="flex items-center gap-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-mono">
                                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                  SSL verification disabled - use only in test environments
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Configuration Summary */}
                    <div className="p-4 rounded-lg bg-black/50 border border-green-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Terminal className="w-4 h-4 text-green-400" />
                        <span className="text-sm font-mono text-green-400 uppercase">
                          Embedded Configuration
                        </span>
                      </div>
                      <pre className="text-xs font-mono text-gray-400 overflow-x-auto">
{`{
  "server_url": "${serverUrl}",
  "sleep_interval": ${sleepInterval},
  "jitter_percent": ${jitterPercent},
  "verify_ssl": ${verifySsl},
  "auto_upload": true
}`}
                      </pre>
                    </div>

                    {/* Error Message */}
                    {downloadError && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-mono flex items-center gap-2"
                      >
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {downloadError}
                      </motion.div>
                    )}

                    {/* Success Message */}
                    {downloadSuccess && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-mono flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        Beacon downloaded successfully!
                      </motion.div>
                    )}
                  </>
                )}
              </div>

              {/* Footer - Always visible */}
              <div className="px-6 py-4 border-t border-gray-800 bg-gray-900 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Shield className="w-4 h-4" />
                  <span>Configuration is embedded in the binary</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition-colors font-mono text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDownload}
                    disabled={isDownloading || isLoading}
                    className={clsx(
                      'flex items-center gap-2 px-6 py-2 rounded-lg font-mono text-sm transition-all duration-200',
                      isDownloading || isLoading
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-green-500 text-black hover:bg-green-400 shadow-lg shadow-green-500/20'
                    )}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {format === 'exe' ? 'COMPILING...' : 'DOWNLOADING...'}
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        DOWNLOAD {format.toUpperCase()}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default BeaconDownloadModal

