/**
 * DonWatcher Risk Management Client
 * Phase 3 - Enhanced Risk Visualization and Integration
 * Handles global risk score display and complementary risk categories
 */

class RiskManager {
  constructor() {
    this.baseUrl = '/api/risk';
    this.cache = new Map();
    this.cacheTTL = 300000; // 5 minute cache for risk data
  }

  /**
   * Get global risk score for domain
   * @param {string} domain - Domain name
   * @returns {Promise<Object>} Global risk data
   */
  async getGlobalRisk(domain) {
    const cacheKey = `global_${domain}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/global/${encodeURIComponent(domain)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch global risk: ${response.status}`);
      }

      const riskData = await response.json();
      
      this.cache.set(cacheKey, {
        data: riskData,
        timestamp: Date.now()
      });

      return riskData;
    } catch (error) {
      console.error('Error fetching global risk:', error);
      throw error;
    }
  }

  /**
   * Get detailed risk breakdown for domain
   * @param {string} domain - Domain name
   * @returns {Promise<Object>} Detailed risk breakdown
   */
  async getRiskBreakdown(domain) {
    const cacheKey = `breakdown_${domain}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.data;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/breakdown/${encodeURIComponent(domain)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch risk breakdown: ${response.status}`);
      }

      const breakdown = await response.json();
      
      this.cache.set(cacheKey, {
        data: breakdown,
        timestamp: Date.now()
      });

      return breakdown;
    } catch (error) {
      console.error('Error fetching risk breakdown:', error);
      throw error;
    }
  }

  /**
   * Get risk history for trending
   * @param {string} domain - Domain name
   * @param {number} days - Days of history
   * @returns {Promise<Object>} Risk history data
   */
  async getRiskHistory(domain, days = 30) {
    try {
      const response = await fetch(`${this.baseUrl}/history/${encodeURIComponent(domain)}?days=${days}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch risk history: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching risk history:', error);
      throw error;
    }
  }

  /**
   * Get domain risk comparison
   * @returns {Promise<Object>} Cross-domain risk comparison
   */
  async getDomainComparison() {
    try {
      const response = await fetch(`${this.baseUrl}/comparison`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch domain comparison: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching domain comparison:', error);
      throw error;
    }
  }

  /**
   * Force recalculation of risk scores
   * @param {string} domain - Domain name
   * @returns {Promise<Object>} Recalculation result
   */
  async recalculateRisk(domain) {
    try {
      const response = await fetch(`${this.baseUrl}/recalculate/${encodeURIComponent(domain)}`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to recalculate risk: ${response.status}`);
      }

      // Clear cache for this domain
      this.invalidateCache(domain);
      
      return await response.json();
    } catch (error) {
      console.error('Error recalculating risk:', error);
      throw error;
    }
  }

  /**
   * Render enhanced global risk gauge with component breakdown
   * @param {string} canvasId - Canvas element ID
   * @param {Object} riskData - Global risk data
   */
  renderEnhancedGlobalGauge(canvasId, riskData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.globalRiskChart) {
      window.globalRiskChart.destroy();
    }

    // Create enhanced gauge chart
    window.globalRiskChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [riskData.global_score, 100 - riskData.global_score],
          backgroundColor: [
            this.getRiskColor(riskData.global_score),
            '#314056'
          ],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        circumference: 180,
        rotation: -90,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        },
        animation: {
          animateRotate: true,
          animateScale: true
        }
      }
    });

    // Add enhanced text overlay
    this.updateGaugeOverlay(canvasId, riskData);
  }

  /**
   * Update gauge text overlay with component breakdown
   * @param {string} canvasId - Canvas element ID
   * @param {Object} riskData - Risk data
   */
  updateGaugeOverlay(canvasId, riskData) {
    const container = document.querySelector('.global-risk-container');
    
    // Remove existing overlay
    const existingOverlay = container.querySelector('.risk-score-overlay');
    if (existingOverlay) {
      container.removeChild(existingOverlay);
    }

    // Create enhanced overlay
    const overlay = document.createElement('div');
    overlay.className = 'risk-score-overlay';
    
    overlay.innerHTML = `
      <div class="global-score">${Math.round(riskData.global_score)}</div>
      <div class="risk-breakdown">
        ${riskData.pingcastle_score !== null ? 
          `<div class="component-score pingcastle">
            <span class="component-label">Infrastructure</span>
            <span class="component-value">${Math.round(riskData.pingcastle_score)}</span>
          </div>` : ''
        }
        <div class="component-score domain-groups">
          <span class="component-label">Access Gov</span>
          <span class="component-value">${Math.round(riskData.domain_group_score)}</span>
        </div>
      </div>
      <div class="risk-trend ${riskData.trend_direction}">
        <i class="fas fa-${this.getTrendIcon(riskData.trend_direction)}"></i>
        <span>${riskData.trend_direction} ${riskData.trend_percentage > 0 ? `(${riskData.trend_percentage.toFixed(1)}%)` : ''}</span>
      </div>
    `;
    
    container.appendChild(overlay);
  }

  /**
   * Render risk category breakdown chart
   * @param {string} containerId - Container element ID
   * @param {Object} breakdown - Risk breakdown data
   */
  renderRiskCategoryBreakdown(containerId, breakdown) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="risk-categories">
        ${breakdown.pingcastle_score !== null ? `
          <div class="risk-category pingcastle">
            <div class="category-header">
              <h3>Infrastructure Security</h3>
              <div class="category-score">${Math.round(breakdown.pingcastle_score)}</div>
            </div>
            <div class="category-details">
              <div class="category-description">PingCastle assessment covering domain configuration, vulnerabilities, and security policies</div>
              <div class="category-contribution">${breakdown.pingcastle_contribution?.toFixed(1)}% of global risk</div>
            </div>
          </div>
        ` : ''}
        
        <div class="risk-category domain-groups">
          <div class="category-header">
            <h3>Access Governance</h3>
            <div class="category-score">${Math.round(breakdown.domain_group_score)}</div>
          </div>
          <div class="category-details">
            <div class="category-description">Privileged group membership management and acceptance status</div>
            <div class="category-contribution">${breakdown.domain_group_contribution.toFixed(1)}% of global risk</div>
            <div class="category-subcategories">
              <div class="subcategory">
                <span>Access Governance:</span>
                <span>${Math.round(breakdown.category_scores.access_governance)}</span>
              </div>
              <div class="subcategory">
                <span>Privilege Escalation:</span>
                <span>${Math.round(breakdown.category_scores.privilege_escalation)}</span>
              </div>
              <div class="subcategory">
                <span>Compliance Posture:</span>
                <span>${Math.round(breakdown.category_scores.compliance_posture)}</span>
              </div>
              <div class="subcategory">
                <span>Operational Risk:</span>
                <span>${Math.round(breakdown.category_scores.operational_risk)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="risk-summary">
        <div class="summary-stats">
          <div class="stat">
            <span class="stat-label">Total Groups</span>
            <span class="stat-value">${breakdown.summary?.group_count || 0}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Critical Groups</span>
            <span class="stat-value">${breakdown.summary?.critical_groups || 0}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Total Members</span>
            <span class="stat-value">${breakdown.summary?.total_members || 0}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Unaccepted</span>
            <span class="stat-value">${breakdown.summary?.total_unaccepted || 0}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render combined risk history chart
   * @param {string} canvasId - Canvas element ID
   * @param {Object} historyData - Risk history data
   */
  renderCombinedRiskHistory(canvasId, historyData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Destroy existing chart
    if (window.riskHistoryChart) {
      window.riskHistoryChart.destroy();
    }

    const history = historyData.history || [];
    const labels = history.map(h => new Date(h.date).toLocaleDateString());
    const globalScores = history.map(h => h.global_score);
    const pingcastleScores = history.map(h => h.pingcastle_score).filter(s => s !== null);
    const domainGroupScores = history.map(h => h.domain_group_score);

    const datasets = [
      {
        label: 'Global Risk Score',
        data: globalScores,
        borderColor: '#82b1ff',
        backgroundColor: 'rgba(130, 177, 255, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4
      },
      {
        label: 'Domain Groups Risk',
        data: domainGroupScores,
        borderColor: '#ff9800',
        backgroundColor: 'rgba(255, 152, 0, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.4
      }
    ];

    // Add PingCastle line if data available
    if (pingcastleScores.length > 0 && pingcastleScores.some(s => s !== null)) {
      datasets.push({
        label: 'PingCastle Risk',
        data: history.map(h => h.pingcastle_score),
        borderColor: '#4caf50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderWidth: 2,
        fill: false,
        tension: 0.4
      });
    }

    window.riskHistoryChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#e0e0e0',
              usePointStyle: true
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(27, 38, 59, 0.9)',
            titleColor: '#e0e0e0',
            bodyColor: '#e0e0e0',
            borderColor: '#314056',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              color: '#314056'
            },
            ticks: {
              color: '#e0e0e0'
            }
          },
          y: {
            display: true,
            beginAtZero: true,
            max: 100,
            grid: {
              color: '#314056'
            },
            ticks: {
              color: '#e0e0e0'
            }
          }
        },
        interaction: {
          mode: 'nearest',
          axis: 'x',
          intersect: false
        }
      }
    });
  }

  /**
   * Get risk color based on score
   * @param {number} score - Risk score (0-100)
   * @returns {string} CSS color
   */
  getRiskColor(score) {
    if (score < 25) return '#4caf50';  // Green
    if (score < 50) return '#ff9800';  // Orange
    if (score < 75) return '#ff5722';  // Red-orange
    return '#f44336';                  // Red
  }

  /**
   * Get trend icon based on direction
   * @param {string} direction - Trend direction
   * @returns {string} Font Awesome icon class
   */
  getTrendIcon(direction) {
    switch (direction) {
      case 'improving': return 'arrow-down';
      case 'degrading': return 'arrow-up';
      case 'stable': return 'minus';
      default: return 'question';
    }
  }

  /**
   * Get risk level classification
   * @param {number} score - Risk score
   * @returns {string} Risk level
   */
  getRiskLevel(score) {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  /**
   * Invalidate cache for domain
   * @param {string} domain - Domain name
   */
  invalidateCache(domain) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.includes(domain)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Create global instance
window.RiskManager = window.RiskManager || new RiskManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RiskManager;
}
