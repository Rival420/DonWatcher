import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload as UploadIcon, FileText, CheckCircle, XCircle, X, FileUp } from 'lucide-react'
import { useUpload } from '../hooks/useApi'
import { clsx } from 'clsx'

interface UploadedFile {
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  message?: string
  reportId?: string
}

export function Upload() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const uploadMutation = useUpload()
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    const newFiles = droppedFiles.map(file => ({
      file,
      status: 'pending' as const,
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [])
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    
    const selectedFiles = Array.from(e.target.files)
    const newFiles = selectedFiles.map(file => ({
      file,
      status: 'pending' as const,
    }))
    setFiles(prev => [...prev, ...newFiles])
  }
  
  const uploadFile = async (index: number) => {
    const fileEntry = files[index]
    if (!fileEntry || fileEntry.status !== 'pending') return
    
    setFiles(prev => prev.map((f, i) => 
      i === index ? { ...f, status: 'uploading' } : f
    ))
    
    try {
      const result = await uploadMutation.mutateAsync(fileEntry.file)
      setFiles(prev => prev.map((f, i) => 
        i === index ? { 
          ...f, 
          status: 'success', 
          message: result.message,
          reportId: result.report_id 
        } : f
      ))
    } catch (error) {
      setFiles(prev => prev.map((f, i) => 
        i === index ? { 
          ...f, 
          status: 'error', 
          message: error instanceof Error ? error.message : 'Upload failed' 
        } : f
      ))
    }
  }
  
  const uploadAll = async () => {
    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'pending') {
        await uploadFile(i)
      }
    }
  }
  
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }
  
  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status === 'pending' || f.status === 'uploading'))
  }
  
  const pendingCount = files.filter(f => f.status === 'pending').length
  const successCount = files.filter(f => f.status === 'success').length
  
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Drop Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={clsx(
          'relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300',
          isDragging
            ? 'border-cyber-accent-cyan bg-cyber-accent-cyan/10'
            : 'border-cyber-border hover:border-cyber-accent-cyan/50'
        )}
      >
        <input
          type="file"
          multiple
          accept=".xml,.json,.csv"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="pointer-events-none">
          <motion.div
            animate={{ y: isDragging ? -10 : 0 }}
            className="mb-4"
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-cyber-accent-cyan/10 flex items-center justify-center">
              <FileUp className={clsx(
                'w-8 h-8',
                isDragging ? 'text-cyber-accent-cyan' : 'text-cyber-text-muted'
              )} />
            </div>
          </motion.div>
          
          <h3 className="text-lg font-semibold text-cyber-text-primary mb-2">
            {isDragging ? 'Drop files here' : 'Upload Security Reports'}
          </h3>
          <p className="text-cyber-text-muted">
            Drag and drop your PingCastle XML, Domain Scanner JSON, or Locksmith files
          </p>
          <p className="text-sm text-cyber-text-muted mt-2">
            or <span className="text-cyber-accent-cyan">browse</span> to select files
          </p>
        </div>
      </motion.div>
      
      {/* File List */}
      {files.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="cyber-card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-cyber-text-primary">
              Files ({files.length})
            </h3>
            <div className="flex items-center gap-2">
              {successCount > 0 && (
                <button
                  onClick={clearCompleted}
                  className="text-sm text-cyber-text-muted hover:text-cyber-text-primary transition-colors"
                >
                  Clear completed
                </button>
              )}
              {pendingCount > 0 && (
                <button
                  onClick={uploadAll}
                  className="cyber-button text-sm"
                >
                  Upload All ({pendingCount})
                </button>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <AnimatePresence>
              {files.map((fileEntry, index) => (
                <motion.div
                  key={`${fileEntry.file.name}-${index}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={clsx(
                    'flex items-center gap-4 p-4 rounded-lg border',
                    fileEntry.status === 'success' && 'bg-cyber-accent-green/5 border-cyber-accent-green/30',
                    fileEntry.status === 'error' && 'bg-cyber-accent-red/5 border-cyber-accent-red/30',
                    fileEntry.status === 'pending' && 'bg-cyber-bg-secondary border-cyber-border',
                    fileEntry.status === 'uploading' && 'bg-cyber-accent-cyan/5 border-cyber-accent-cyan/30',
                  )}
                >
                  <div className={clsx(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    fileEntry.status === 'success' && 'bg-cyber-accent-green/20',
                    fileEntry.status === 'error' && 'bg-cyber-accent-red/20',
                    fileEntry.status === 'pending' && 'bg-cyber-bg-tertiary',
                    fileEntry.status === 'uploading' && 'bg-cyber-accent-cyan/20',
                  )}>
                    {fileEntry.status === 'success' && <CheckCircle className="w-5 h-5 text-cyber-accent-green" />}
                    {fileEntry.status === 'error' && <XCircle className="w-5 h-5 text-cyber-accent-red" />}
                    {fileEntry.status === 'pending' && <FileText className="w-5 h-5 text-cyber-text-muted" />}
                    {fileEntry.status === 'uploading' && (
                      <div className="w-5 h-5 border-2 border-cyber-accent-cyan border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-cyber-text-primary truncate">
                      {fileEntry.file.name}
                    </p>
                    <p className="text-sm text-cyber-text-muted">
                      {fileEntry.message || `${(fileEntry.file.size / 1024).toFixed(1)} KB`}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {fileEntry.status === 'pending' && (
                      <button
                        onClick={() => uploadFile(index)}
                        className="px-3 py-1.5 rounded-lg bg-cyber-accent-cyan/10 text-cyber-accent-cyan hover:bg-cyber-accent-cyan/20 text-sm transition-colors"
                      >
                        Upload
                      </button>
                    )}
                    
                    {(fileEntry.status === 'pending' || fileEntry.status === 'error') && (
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1.5 rounded-lg text-cyber-text-muted hover:text-cyber-accent-red hover:bg-cyber-accent-red/10 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
      
      {/* Supported Formats */}
      <div className="text-center text-sm text-cyber-text-muted">
        <p>Supported formats:</p>
        <div className="flex items-center justify-center gap-4 mt-2">
          <span className="px-3 py-1 rounded-lg bg-cyber-bg-secondary">🏰 PingCastle (.xml)</span>
          <span className="px-3 py-1 rounded-lg bg-cyber-bg-secondary">🔍 Domain Scanner (.json)</span>
          <span className="px-3 py-1 rounded-lg bg-cyber-bg-secondary">🔐 Locksmith (.json/.csv)</span>
        </div>
      </div>
    </div>
  )
}

