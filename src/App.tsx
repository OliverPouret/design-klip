import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { FixedBackground } from './components/FixedBackground'
import { HomePage } from './pages/HomePage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { BookingPage } from './pages/BookingPage'

export default function App() {
  return (
    <BrowserRouter>
      <FixedBackground />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/bestil" element={<BookingPage />} />
        <Route path="/privatlivspolitik" element={<PrivacyPage />} />
        <Route path="/handelsbetingelser" element={<TermsPage />} />
      </Routes>
    </BrowserRouter>
  )
}
