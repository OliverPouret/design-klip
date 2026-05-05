import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { FixedBackground } from './components/FixedBackground'
import { HomePage } from './pages/HomePage'
import { BookingPage } from './pages/BookingPage'
import { ConfirmationPage } from './pages/ConfirmationPage'
import { CancelPage } from './pages/CancelPage'
import { CancelByShortCodePage } from './pages/CancelByShortCodePage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { AdminLayout } from './pages/admin/AdminLayout'
import { LoginPage } from './pages/admin/LoginPage'
import { TodayPage } from './pages/admin/TodayPage'
import { HistorikPage } from './pages/admin/HistorikPage'
import { CalendarPage } from './pages/admin/CalendarPage'
import { InsightsPage } from './pages/admin/InsightsPage'
import { CreateBookingPage } from './pages/admin/CreateBookingPage'
import { CustomersPage } from './pages/admin/CustomersPage'
import { MedarbejderePage } from './pages/admin/MedarbejderePage'
import { YdelserPage } from './pages/admin/YdelserPage'
import { NotesPage } from './pages/admin/NotesPage'
import { BookingDetailPage } from './pages/admin/BookingDetailPage'
import { SmsTemplatesPage } from './pages/admin/SmsTemplatesPage'
import { SmsTemplateEditor } from './pages/admin/SmsTemplateEditor'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <FixedBackground />
        <Routes>
          {/* Public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/bestil" element={<BookingPage />} />
          <Route path="/bestil/bekraeftet/:shortCode" element={<ConfirmationPage />} />
          <Route path="/afbestil/:token" element={<CancelPage />} />
          <Route path="/a/:shortCode" element={<CancelByShortCodePage />} />
          <Route path="/privatlivspolitik" element={<PrivacyPage />} />
          <Route path="/handelsbetingelser" element={<TermsPage />} />

          {/* Admin */}
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<TodayPage />} />
            <Route path="i-dag" element={<TodayPage />} />
            <Route path="kalender" element={<CalendarPage />} />
            <Route path="historik" element={<HistorikPage />} />
            <Route path="overblik" element={<InsightsPage />} />
            <Route path="oekonomi" element={<Navigate to="/admin/overblik" replace />} />
            <Route path="opret-booking" element={<CreateBookingPage />} />
            <Route path="kunder" element={<CustomersPage />} />
            <Route path="medarbejdere" element={<MedarbejderePage />} />
            <Route path="ydelser" element={<YdelserPage />} />
            <Route path="noter" element={<NotesPage />} />
            <Route path="sms" element={<SmsTemplatesPage />} />
            <Route path="sms/:id" element={<SmsTemplateEditor />} />
            <Route path="booking/:bookingId" element={<BookingDetailPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
