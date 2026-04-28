import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/privatlivspolitik" element={<PrivacyPage />} />
        <Route path="/handelsbetingelser" element={<TermsPage />} />
      </Routes>
    </BrowserRouter>
  )
}
