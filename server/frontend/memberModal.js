/**
 * DonWatcher Member Management Modal
 * Comprehensive interface for managing group member acceptance
 * Phase 2 - Frontend Enhancement
 */

class MemberModal {
  constructor() {
    this.modal = null;
    this.currentGroup = null;
    this.currentDomain = null;
    this.members = [];
    this.filteredMembers = [];
    this.selectedMembers = new Set();
    this.groupManager = window.GroupManager;
    
    this.init();
  }

  init() {
    this.createModal();
    this.bindEvents();
  }

  createModal() {
    // Create modal HTML structure
    const modalHTML = `
      <div id="member-management-modal" class="modal-overlay" style="display: none;">
        <div class="modal-container">
          <div class="modal-header">
            <div class="modal-title-section">
              <h2 id="modal-group-title">Group Members</h2>
              <div class="modal-subtitle">
                <span id="modal-domain-name">Domain</span> • 
                <span id="modal-member-count">0 members</span>
              </div>
            </div>
            <button class="modal-close" aria-label="Close modal">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="modal-content">
            <!-- Loading State -->
            <div id="modal-loading" class="modal-loading">
              <i class="fas fa-spinner fa-spin"></i>
              <span>Loading members...</span>
            </div>

            <!-- Member Management Interface -->
            <div id="modal-interface" style="display: none;">
              <!-- Controls Bar -->
              <div class="modal-controls">
                <div class="search-section">
                  <div class="search-input-container">
                    <i class="fas fa-search"></i>
                    <input 
                      type="text" 
                      id="member-search" 
                      placeholder="Search members..."
                      class="search-input"
                    >
                  </div>
                  <div class="filter-controls">
                    <select id="type-filter" class="filter-select">
                      <option value="">All Types</option>
                      <option value="user">Users</option>
                      <option value="computer">Computers</option>
                      <option value="group">Groups</option>
                    </select>
                    <select id="status-filter" class="filter-select">
                      <option value="">All Status</option>
                      <option value="accepted">Accepted</option>
                      <option value="unaccepted">Unaccepted</option>
                    </select>
                    <select id="enabled-filter" class="filter-select">
                      <option value="">All Enabled</option>
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>
                </div>

                <div class="bulk-actions">
                  <button id="select-all-btn" class="btn-secondary">
                    <i class="fas fa-check-square"></i> Select All
                  </button>
                  <button id="bulk-accept-btn" class="btn-success" disabled>
                    <i class="fas fa-check"></i> Accept Selected
                  </button>
                  <button id="bulk-deny-btn" class="btn-danger" disabled>
                    <i class="fas fa-times"></i> Deny Selected
                  </button>
                </div>
              </div>

              <!-- Members Table -->
              <div class="members-table-container">
                <table id="members-table" class="members-table">
                  <thead>
                    <tr>
                      <th class="checkbox-col">
                        <input type="checkbox" id="select-all-checkbox">
                      </th>
                      <th class="name-col">Name</th>
                      <th class="type-col">Type</th>
                      <th class="enabled-col">Enabled</th>
                      <th class="status-col">Status</th>
                      <th class="actions-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="members-table-body">
                    <!-- Members will be populated here -->
                  </tbody>
                </table>
              </div>

              <!-- Empty State -->
              <div id="modal-empty" class="modal-empty" style="display: none;">
                <i class="fas fa-users-slash"></i>
                <h3>No members found</h3>
                <p>Try adjusting your search or filter criteria.</p>
              </div>
            </div>

            <!-- Error State -->
            <div id="modal-error" class="modal-error" style="display: none;">
              <i class="fas fa-exclamation-triangle"></i>
              <h3>Error Loading Members</h3>
              <p id="modal-error-message">Failed to load group members.</p>
              <button id="modal-retry" class="btn-primary">
                <i class="fas fa-redo"></i> Retry
              </button>
            </div>
          </div>

          <div class="modal-footer">
            <div class="modal-stats">
              <span id="filtered-count">0</span> of <span id="total-count">0</span> members shown
            </div>
            <div class="modal-actions">
              <button id="modal-refresh" class="btn-secondary">
                <i class="fas fa-sync-alt"></i> Refresh
              </button>
              <button id="modal-close-btn" class="btn-primary">Close</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('member-management-modal');
  }

  bindEvents() {
    // Close modal events
    document.getElementById('modal-close-btn').addEventListener('click', () => this.close());
    document.querySelector('.modal-close').addEventListener('click', () => this.close());
    
    // Close on overlay click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    // Search and filter events
    document.getElementById('member-search').addEventListener('input', () => this.applyFilters());
    document.getElementById('type-filter').addEventListener('change', () => this.applyFilters());
    document.getElementById('status-filter').addEventListener('change', () => this.applyFilters());
    document.getElementById('enabled-filter').addEventListener('change', () => this.applyFilters());

    // Selection events
    document.getElementById('select-all-checkbox').addEventListener('change', (e) => {
      this.toggleSelectAll(e.target.checked);
    });
    document.getElementById('select-all-btn').addEventListener('click', () => {
      const checkbox = document.getElementById('select-all-checkbox');
      checkbox.checked = !checkbox.checked;
      this.toggleSelectAll(checkbox.checked);
    });

    // Bulk action events
    document.getElementById('bulk-accept-btn').addEventListener('click', () => this.bulkAccept());
    document.getElementById('bulk-deny-btn').addEventListener('click', () => this.bulkDeny());

    // Utility events
    document.getElementById('modal-refresh').addEventListener('click', () => this.refresh());
    document.getElementById('modal-retry').addEventListener('click', () => this.loadMembers());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (this.modal.style.display !== 'none') {
        if (e.key === 'Escape') this.close();
        if (e.key === 'F5') {
          e.preventDefault();
          this.refresh();
        }
      }
    });
  }

  async show(groupName, domain) {
    this.currentGroup = groupName;
    this.currentDomain = domain;
    
    // Update modal title
    document.getElementById('modal-group-title').textContent = groupName;
    document.getElementById('modal-domain-name').textContent = domain;
    
    // Show modal
    this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Load members
    await this.loadMembers();
  }

  async loadMembers() {
    this.showLoading();
    
    try {
      const memberData = await this.groupManager.getGroupMembers(this.currentDomain, this.currentGroup);
      this.members = memberData.members || [];
      this.updateMemberCount(memberData.total_members, memberData.accepted_members);
      this.renderMembers();
      this.showInterface();
    } catch (error) {
      this.showError(error.message);
    }
  }

  renderMembers() {
    this.applyFilters();
  }

  applyFilters() {
    const searchTerm = document.getElementById('member-search').value.toLowerCase();
    const typeFilter = document.getElementById('type-filter').value;
    const statusFilter = document.getElementById('status-filter').value;
    const enabledFilter = document.getElementById('enabled-filter').value;

    this.filteredMembers = this.members.filter(member => {
      // Search filter
      const matchesSearch = !searchTerm || 
        member.name.toLowerCase().includes(searchTerm) ||
        (member.samaccountname && member.samaccountname.toLowerCase().includes(searchTerm));

      // Type filter
      const matchesType = !typeFilter || member.type === typeFilter;

      // Status filter
      const matchesStatus = !statusFilter || 
        (statusFilter === 'accepted' && member.is_accepted) ||
        (statusFilter === 'unaccepted' && !member.is_accepted);

      // Enabled filter
      const matchesEnabled = !enabledFilter || 
        (enabledFilter === 'true' && member.enabled === true) ||
        (enabledFilter === 'false' && member.enabled === false);

      return matchesSearch && matchesType && matchesStatus && matchesEnabled;
    });

    this.renderMemberTable();
    this.updateStats();
  }

  renderMemberTable() {
    const tbody = document.getElementById('members-table-body');
    
    if (this.filteredMembers.length === 0) {
      document.getElementById('modal-empty').style.display = 'block';
      document.querySelector('.members-table-container').style.display = 'none';
      return;
    }

    document.getElementById('modal-empty').style.display = 'none';
    document.querySelector('.members-table-container').style.display = 'block';

    tbody.innerHTML = this.filteredMembers.map(member => `
      <tr class="member-row ${member.is_accepted ? 'accepted' : 'unaccepted'}">
        <td class="checkbox-col">
          <input 
            type="checkbox" 
            class="member-checkbox" 
            data-member="${member.name}"
            ${this.selectedMembers.has(member.name) ? 'checked' : ''}
          >
        </td>
        <td class="name-col">
          <div class="member-info">
            <div class="member-name">${this.escapeHtml(member.name)}</div>
            ${member.samaccountname ? `<div class="member-sam">${this.escapeHtml(member.samaccountname)}</div>` : ''}
          </div>
        </td>
        <td class="type-col">
          <span class="type-badge ${member.type}">
            <i class="fas fa-${this.getTypeIcon(member.type)}"></i>
            ${member.type}
          </span>
        </td>
        <td class="enabled-col">
          <span class="enabled-badge ${member.enabled === true ? 'enabled' : member.enabled === false ? 'disabled' : 'unknown'}">
            ${member.enabled === true ? 'Enabled' : member.enabled === false ? 'Disabled' : 'Unknown'}
          </span>
        </td>
        <td class="status-col">
          <span class="status-badge ${member.is_accepted ? 'accepted' : 'unaccepted'}">
            <i class="fas fa-${member.is_accepted ? 'check-circle' : 'exclamation-triangle'}"></i>
            ${member.is_accepted ? 'Accepted' : 'Unaccepted'}
          </span>
        </td>
        <td class="actions-col">
          ${member.is_accepted ? 
            `<button class="btn-action deny" data-member="${member.name}" title="Deny Member">
              <i class="fas fa-times"></i>
            </button>` :
            `<button class="btn-action accept" data-member="${member.name}" title="Accept Member">
              <i class="fas fa-check"></i>
            </button>`
          }
        </td>
      </tr>
    `).join('');

    // Bind individual action events
    tbody.querySelectorAll('.btn-action').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const memberName = e.currentTarget.dataset.member;
        const isAccept = e.currentTarget.classList.contains('accept');
        
        if (isAccept) {
          this.acceptMember(memberName);
        } else {
          this.denyMember(memberName);
        }
      });
    });

    // Bind checkbox events
    tbody.querySelectorAll('.member-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const memberName = e.target.dataset.member;
        if (e.target.checked) {
          this.selectedMembers.add(memberName);
        } else {
          this.selectedMembers.delete(memberName);
        }
        this.updateBulkButtons();
      });
    });
  }

  async acceptMember(memberName) {
    const reason = prompt(`Accept ${memberName}?\n\nOptional reason:`);
    if (reason === null) return; // User cancelled

    try {
      await this.groupManager.acceptMember(
        this.currentDomain, 
        this.currentGroup, 
        memberName, 
        reason,
        'Web Interface User'
      );
      
      // Update local data
      const member = this.members.find(m => m.name === memberName);
      if (member) member.is_accepted = true;
      
      this.renderMembers();
      this.showToast(`${memberName} accepted successfully`, 'success');
    } catch (error) {
      this.showToast(`Failed to accept ${memberName}: ${error.message}`, 'error');
    }
  }

  async denyMember(memberName) {
    if (!confirm(`Remove acceptance for ${memberName}?`)) return;

    try {
      await this.groupManager.denyMember(this.currentDomain, this.currentGroup, memberName);
      
      // Update local data
      const member = this.members.find(m => m.name === memberName);
      if (member) member.is_accepted = false;
      
      this.renderMembers();
      this.showToast(`${memberName} denied successfully`, 'success');
    } catch (error) {
      this.showToast(`Failed to deny ${memberName}: ${error.message}`, 'error');
    }
  }

  async bulkAccept() {
    const selectedNames = Array.from(this.selectedMembers);
    if (selectedNames.length === 0) return;

    const reason = prompt(`Accept ${selectedNames.length} members?\n\nReason:`);
    if (reason === null) return;

    try {
      const results = await this.groupManager.bulkAcceptMembers(
        this.currentDomain,
        this.currentGroup,
        selectedNames,
        reason,
        'Web Interface User'
      );

      // Update local data for successful accepts
      results.successful.forEach(memberName => {
        const member = this.members.find(m => m.name === memberName);
        if (member) member.is_accepted = true;
      });

      this.selectedMembers.clear();
      this.renderMembers();
      
      if (results.failed.length > 0) {
        this.showToast(`${results.successful.length} accepted, ${results.failed.length} failed`, 'warning');
      } else {
        this.showToast(`${results.successful.length} members accepted successfully`, 'success');
      }
    } catch (error) {
      this.showToast(`Bulk accept failed: ${error.message}`, 'error');
    }
  }

  async bulkDeny() {
    const selectedNames = Array.from(this.selectedMembers);
    if (selectedNames.length === 0) return;

    if (!confirm(`Remove acceptance for ${selectedNames.length} members?`)) return;

    try {
      const results = await this.groupManager.bulkDenyMembers(
        this.currentDomain,
        this.currentGroup,
        selectedNames
      );

      // Update local data for successful denies
      results.successful.forEach(memberName => {
        const member = this.members.find(m => m.name === memberName);
        if (member) member.is_accepted = false;
      });

      this.selectedMembers.clear();
      this.renderMembers();
      
      if (results.failed.length > 0) {
        this.showToast(`${results.successful.length} denied, ${results.failed.length} failed`, 'warning');
      } else {
        this.showToast(`${results.successful.length} members denied successfully`, 'success');
      }
    } catch (error) {
      this.showToast(`Bulk deny failed: ${error.message}`, 'error');
    }
  }

  toggleSelectAll(checked) {
    this.selectedMembers.clear();
    
    if (checked) {
      this.filteredMembers.forEach(member => {
        this.selectedMembers.add(member.name);
      });
    }

    // Update checkboxes
    document.querySelectorAll('.member-checkbox').forEach(checkbox => {
      checkbox.checked = checked;
    });

    this.updateBulkButtons();
  }

  updateBulkButtons() {
    const selectedCount = this.selectedMembers.size;
    const acceptBtn = document.getElementById('bulk-accept-btn');
    const denyBtn = document.getElementById('bulk-deny-btn');
    
    acceptBtn.disabled = selectedCount === 0;
    denyBtn.disabled = selectedCount === 0;
    
    if (selectedCount > 0) {
      acceptBtn.innerHTML = `<i class="fas fa-check"></i> Accept Selected (${selectedCount})`;
      denyBtn.innerHTML = `<i class="fas fa-times"></i> Deny Selected (${selectedCount})`;
    } else {
      acceptBtn.innerHTML = `<i class="fas fa-check"></i> Accept Selected`;
      denyBtn.innerHTML = `<i class="fas fa-times"></i> Deny Selected`;
    }
  }

  updateMemberCount(total, accepted) {
    document.getElementById('modal-member-count').textContent = `${total} members (${accepted} accepted)`;
  }

  updateStats() {
    document.getElementById('filtered-count').textContent = this.filteredMembers.length;
    document.getElementById('total-count').textContent = this.members.length;
  }

  async refresh() {
    this.groupManager.invalidateCache(this.currentDomain, this.currentGroup);
    await this.loadMembers();
  }

  close() {
    this.modal.style.display = 'none';
    document.body.style.overflow = '';
    this.selectedMembers.clear();
    this.members = [];
    this.filteredMembers = [];
  }

  showLoading() {
    document.getElementById('modal-loading').style.display = 'block';
    document.getElementById('modal-interface').style.display = 'none';
    document.getElementById('modal-error').style.display = 'none';
  }

  showInterface() {
    document.getElementById('modal-loading').style.display = 'none';
    document.getElementById('modal-interface').style.display = 'block';
    document.getElementById('modal-error').style.display = 'none';
  }

  showError(message) {
    document.getElementById('modal-loading').style.display = 'none';
    document.getElementById('modal-interface').style.display = 'none';
    document.getElementById('modal-error').style.display = 'block';
    document.getElementById('modal-error-message').textContent = message;
  }

  showToast(message, type = 'info') {
    // Simple toast implementation - could be enhanced with a proper toast library
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation' : 'info'}"></i>
      ${message}
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }

  getTypeIcon(type) {
    switch (type) {
      case 'user': return 'user';
      case 'computer': return 'desktop';
      case 'group': return 'users';
      default: return 'question';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize global instance
window.MemberModal = window.MemberModal || new MemberModal();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MemberModal;
}
