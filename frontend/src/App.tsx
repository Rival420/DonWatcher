import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Reports } from './pages/Reports'
import { RiskCatalog } from './pages/RiskCatalog'
import { DomainGroups } from './pages/DomainGroups'
import { Upload } from './pages/Upload'
import { Settings } from './pages/Settings'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/risk-catalog" element={<RiskCatalog />} />
        <Route path="/groups" element={<DomainGroups />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}

export default App

