// frontend/chartManager.js
const chartInstances = {};

export function createChart(canvasId, options) {
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }
  
  const ctx = document.getElementById(canvasId).getContext('2d');
  const chart = new Chart(ctx, options);
  chartInstances[canvasId] = chart;
  return chart;
}

export function destroyChart(canvasId) {
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
        delete chartInstances[canvasId];
    }
}
