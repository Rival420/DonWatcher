import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Users, 
  Lock, 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  ChevronRight,
  Search,
  UserCheck,
  UserX
} from 'lucide-react'
import { useDomains, useDomainGroups, useGroupMembers, useAcceptMember, useDenyMember } from '../hooks/useApi'
import { clsx } from 'clsx'

export function DomainGroups() {
  const { data: domains } = useDomains()
  const [selectedDomain, setSelectedDomain] = useState<string>('')
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  
  const domain = selectedDomain || domains?.[0] || ''
  const { data: groups, isLoading } = useDomainGroups(domain)
  const { data: members, isLoading: membersLoading } = useGroupMembers(domain, selectedGroup || '')
  
  const acceptMember = useAcceptMember()
  const denyMember = useDenyMember()
  
  const filteredGroups = groups?.filter(g => 
    g.group_name.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  const handleAccept = async (memberName: string) => {
    if (!selectedGroup) return
    await acceptMember.mutateAsync({
      domain,
      groupName: selectedGroup,
      memberName,
      reason: 'Accepted via dashboard'
    })
  }
  
  const handleDeny = async (memberName: string) => {
    if (!selectedGroup) return
    await denyMember.mutateAsync({
      domain,
      groupName: selectedGroup,
      memberName,
    })
  }
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-cyber-accent-red/50 bg-cyber-accent-red/5'
      case 'high': return 'border-cyber-accent-orange/50 bg-cyber-accent-orange/5'
      case 'medium': return 'border-cyber-accent-yellow/50 bg-cyber-accent-yellow/5'
      default: return 'border-cyber-border'
    }
  }
  
  return (
    <div className="flex gap-6 h-[calc(100vh-12rem)]">
      {/* Groups List */}
      <div className="w-96 flex flex-col">
        {/* Domain Selector & Search */}
        <div className="space-y-3 mb-4">
          <select
            value={domain}
            onChange={(e) => {
              setSelectedDomain(e.target.value)
              setSelectedGroup(null)
            }}
            className="cyber-input"
          >
            {domains?.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyber-text-muted" />
            <input
              type="text"
              placeholder="Search groups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="cyber-input pl-10"
            />
          </div>
        </div>
        
        {/* Groups */}
        <div className="flex-1 overflow-auto space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-cyber-accent-cyan border-t-transparent rounded-full" />
            </div>
          ) : (
            filteredGroups?.map((group) => (
              <motion.button
                key={group.group_name}
                onClick={() => setSelectedGroup(group.group_name)}
                className={clsx(
                  'w-full p-4 rounded-lg border text-left transition-all duration-200',
                  selectedGroup === group.group_name
                    ? 'bg-cyber-accent-cyan/10 border-cyber-accent-cyan'
                    : getSeverityColor(group.severity),
                  'hover:border-cyber-accent-cyan/50'
                )}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      'p-2 rounded-lg',
                      group.severity === 'critical' && 'bg-cyber-accent-red/20 text-cyber-accent-red',
                      group.severity === 'high' && 'bg-cyber-accent-orange/20 text-cyber-accent-orange',
                      group.severity === 'medium' && 'bg-cyber-accent-yellow/20 text-cyber-accent-yellow',
                      group.severity === 'low' && 'bg-cyber-accent-green/20 text-cyber-accent-green',
                    )}>
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-medium text-cyber-text-primary">{group.group_name}</h4>
                      <p className="text-xs text-cyber-text-muted">
                        {group.total_members} members
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {group.unaccepted_members > 0 && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-cyber-accent-red/20 text-cyber-accent-red">
                        {group.unaccepted_members}
                      </span>
                    )}
                    <ChevronRight className={clsx(
                      'w-4 h-4 text-cyber-text-muted transition-transform',
                      selectedGroup === group.group_name && 'rotate-90'
                    )} />
                  </div>
                </div>
              </motion.button>
            ))
          )}
        </div>
      </div>
      
      {/* Members Panel */}
      <div className="flex-1 cyber-card flex flex-col">
        {selectedGroup ? (
          <>
            <div className="flex items-center justify-between pb-4 border-b border-cyber-border">
              <div>
                <h3 className="text-lg font-semibold text-cyber-text-primary flex items-center gap-2">
                  <Lock className="w-5 h-5 text-cyber-accent-cyan" />
                  {selectedGroup}
                </h3>
                <p className="text-sm text-cyber-text-muted mt-1">
                  {members?.length || 0} members in this group
                </p>
              </div>
              
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-cyber-accent-green">
                  <CheckCircle className="w-4 h-4" />
                  {members?.filter(m => m.is_accepted).length || 0} accepted
                </span>
                <span className="flex items-center gap-1 text-cyber-accent-red">
                  <XCircle className="w-4 h-4" />
                  {members?.filter(m => !m.is_accepted).length || 0} unaccepted
                </span>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto mt-4">
              {membersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin w-8 h-8 border-4 border-cyber-accent-cyan border-t-transparent rounded-full" />
                </div>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {members?.map((member, index) => (
                      <motion.div
                        key={member.sid || member.name}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: index * 0.03 }}
                        className={clsx(
                          'p-4 rounded-lg border flex items-center justify-between',
                          member.is_accepted
                            ? 'bg-cyber-accent-green/5 border-cyber-accent-green/30'
                            : 'bg-cyber-accent-red/5 border-cyber-accent-red/30'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            'w-10 h-10 rounded-full flex items-center justify-center',
                            member.type === 'user' && 'bg-cyber-accent-cyan/20',
                            member.type === 'computer' && 'bg-cyber-accent-purple/20',
                            member.type === 'group' && 'bg-cyber-accent-yellow/20',
                          )}>
                            {member.type === 'user' && <Users className="w-5 h-5 text-cyber-accent-cyan" />}
                            {member.type === 'computer' && <Shield className="w-5 h-5 text-cyber-accent-purple" />}
                            {member.type === 'group' && <Lock className="w-5 h-5 text-cyber-accent-yellow" />}
                          </div>
                          
                          <div>
                            <h4 className="font-medium text-cyber-text-primary">{member.name}</h4>
                            <p className="text-xs text-cyber-text-muted">
                              {member.samaccountname || member.sid?.slice(0, 30)}
                            </p>
                          </div>
                          
                          {member.enabled === false && (
                            <span className="px-2 py-0.5 rounded text-xs bg-cyber-text-muted/20 text-cyber-text-muted">
                              Disabled
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {member.is_accepted ? (
                            <button
                              onClick={() => handleDeny(member.name)}
                              disabled={denyMember.isPending}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyber-accent-red/10 text-cyber-accent-red hover:bg-cyber-accent-red/20 transition-colors text-sm"
                            >
                              <UserX className="w-4 h-4" />
                              Revoke
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAccept(member.name)}
                              disabled={acceptMember.isPending}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyber-accent-green/10 text-cyber-accent-green hover:bg-cyber-accent-green/20 transition-colors text-sm"
                            >
                              <UserCheck className="w-4 h-4" />
                              Accept
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Users className="w-16 h-16 text-cyber-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-cyber-text-primary">Select a group</h3>
              <p className="text-cyber-text-muted mt-1">Choose a group from the list to view its members</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

