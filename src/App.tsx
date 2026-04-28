import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { FixedBackground } from './components/FixedBackground'
import { HomePage } from './pages/HomePage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { BookingPage } from './pages/BookingPage'
import { ConfirmationPage } from './pages/ConfirmationPage'
import { CancelPage } from './pages/CancelPage'

export default function App() {
  return (
    <BrowserRouter>
      <FixedBackground />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/bestil" element={<BookingPage />} />
        <Route path="/bestil/bekraeftet/:shortCode" element={<ConfirmationPage />} />
        <Route path="/afbestil/:token" element={<CancelPage />} />
        <Route path="/privatlivspolitik" element={<PrivacyPage />} />
        <Route path="/handelsbetingelser" element={<TermsPage />} />
      </Routes>
    </BrowserRouter>
  )
}
