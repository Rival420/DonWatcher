import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Reports } from './pages/Reports'
import { RiskCatalog } from './pages/RiskCatalog'
import { Upload } from './pages/Upload'
import { Settings } from './pages/Settings'
import { Beacons } from './pages/Beacons'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/risk-catalog" element={<RiskCatalog />} />
        <Route path="/groups" element={<Navigate to="/risk-catalog" replace />} />
        <Route path="/beacons" element={<Beacons />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}

export default App

