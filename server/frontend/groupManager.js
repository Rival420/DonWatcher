/**
 * DonWatcher Group Management API Client
 * Provides centralized API integration for domain group operations
 * Phase 2 - Frontend Enhancement
 */

class GroupManager {
  constructor() {
    this.baseUrl = '/api/domain_groups';
    this.cache = new Map();
    this.cacheTTL = 60000; // 1 minute cache
  }

  /**
   * Get all groups for a domain with acceptance status
   * @param {string} domain - Domain name
   * @returns {Promise<Array>} Array of group objects with acceptance data
   */
  async getDomainGroups(domain) {
    const cacheKey = `groups_${domain}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/${encodeURIComponent(domain)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch groups: ${response.status} ${response.statusText}`);
      }

      const groups = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: groups,
        timestamp: Date.now()
      });

      return groups;
    } catch (error) {
      console.error('Error fetching domain groups:', error);
      throw error;
    }
  }

  /**
   * Get detailed member list for a specific group
   * @param {string} domain - Domain name
   * @param {string} groupName - Group name
   * @returns {Promise<Object>} Group member details with acceptance status
   */
  async getGroupMembers(domain, groupName) {
    const cacheKey = `members_${domain}_${groupName}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/${encodeURIComponent(domain)}/${encodeURIComponent(groupName)}/members`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch group members: ${response.status} ${response.statusText}`);
      }

      const memberData = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: memberData,
        timestamp: Date.now()
      });

      return memberData;
    } catch (error) {
      console.error('Error fetching group members:', error);
      throw error;
    }
  }

  /**
   * Accept a group member
   * @param {string} domain - Domain name
   * @param {string} groupName - Group name
   * @param {string} memberName - Member name to accept
   * @param {string} reason - Reason for acceptance (optional)
   * @param {string} acceptedBy - Who is accepting (optional)
   * @returns {Promise<Object>} API response
   */
  async acceptMember(domain, groupName, memberName, reason = '', acceptedBy = '') {
    try {
      const response = await fetch(`${this.baseUrl}/members/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain: domain,
          group_name: groupName,
          member_name: memberName,
          reason: reason,
          accepted_by: acceptedBy,
          accepted_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to accept member: ${response.status}`);
      }

      const result = await response.json();
      
      // Invalidate relevant caches
      this.invalidateCache(domain, groupName);
      
      return result;
    } catch (error) {
      console.error('Error accepting member:', error);
      throw error;
    }
  }

  /**
   * Remove acceptance for a group member
   * @param {string} domain - Domain name
   * @param {string} groupName - Group name
   * @param {string} memberName - Member name to deny
   * @returns {Promise<Object>} API response
   */
  async denyMember(domain, groupName, memberName) {
    try {
      const response = await fetch(`${this.baseUrl}/members/accept`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain: domain,
          group_name: groupName,
          member_name: memberName
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to deny member: ${response.status}`);
      }

      const result = await response.json();
      
      // Invalidate relevant caches
      this.invalidateCache(domain, groupName);
      
      return result;
    } catch (error) {
      console.error('Error denying member:', error);
      throw error;
    }
  }

  /**
   * Bulk accept multiple members
   * @param {string} domain - Domain name
   * @param {string} groupName - Group name
   * @param {Array<string>} memberNames - Array of member names to accept
   * @param {string} reason - Reason for acceptance
   * @param {string} acceptedBy - Who is accepting
   * @returns {Promise<Object>} Bulk operation results
   */
  async bulkAcceptMembers(domain, groupName, memberNames, reason = '', acceptedBy = '') {
    const results = {
      successful: [],
      failed: [],
      total: memberNames.length
    };

    // Process in batches to avoid overwhelming the server
    const batchSize = 10;
    for (let i = 0; i < memberNames.length; i += batchSize) {
      const batch = memberNames.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (memberName) => {
        try {
          await this.acceptMember(domain, groupName, memberName, reason, acceptedBy);
          results.successful.push(memberName);
        } catch (error) {
          results.failed.push({
            memberName,
            error: error.message
          });
        }
      });

      // Wait for current batch to complete before starting next
      await Promise.all(batchPromises);
    }

    return results;
  }

  /**
   * Bulk deny multiple members
   * @param {string} domain - Domain name
   * @param {string} groupName - Group name
   * @param {Array<string>} memberNames - Array of member names to deny
   * @returns {Promise<Object>} Bulk operation results
   */
  async bulkDenyMembers(domain, groupName, memberNames) {
    const results = {
      successful: [],
      failed: [],
      total: memberNames.length
    };

    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < memberNames.length; i += batchSize) {
      const batch = memberNames.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (memberName) => {
        try {
          await this.denyMember(domain, groupName, memberName);
          results.successful.push(memberName);
        } catch (error) {
          results.failed.push({
            memberName,
            error: error.message
          });
        }
      });

      await Promise.all(batchPromises);
    }

    return results;
  }

  /**
   * Get all unaccepted members across domains
   * @param {string} domain - Optional domain filter
   * @returns {Promise<Object>} Unaccepted members data
   */
  async getUnacceptedMembers(domain = null) {
    try {
      const url = domain ? 
        `/api/domain_groups/unaccepted?domain=${encodeURIComponent(domain)}` : 
        '/api/domain_groups/unaccepted';
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch unaccepted members: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching unaccepted members:', error);
      throw error;
    }
  }

  /**
   * Invalidate cache for specific domain/group
   * @param {string} domain - Domain name
   * @param {string} groupName - Group name (optional)
   */
  invalidateCache(domain, groupName = null) {
    const keysToDelete = [];
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(`groups_${domain}`) || 
          (groupName && key.startsWith(`members_${domain}_${groupName}`))) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics for debugging
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      entries: this.cache.size,
      keys: Array.from(this.cache.keys()),
      ttl: this.cacheTTL
    };
  }
}

// Create global instance
window.GroupManager = window.GroupManager || new GroupManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GroupManager;
}
