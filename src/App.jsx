import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CalendarProvider } from "./context/CalendarContext";
import { ThemeProvider } from "./context/ThemeContext";
import InstallButton from "./components/InstallButton";
import BraveBanner from "./components/BraveBanner";
import Login from "./pages/Login";
import Registration from "./pages/Registration";
import Dashboard from "./pages/Dashboard";
import PublicCurriculum from "./pages/PublicCurriculum";

// Signed-in visitors get the full dashboard; signed-out visitors get the
// public read-only المنهج page instead of being bounced to /login — teachers
// still log in via the button on that page.
function RootRoute() {
  const { user } = useAuth();

  if (user === undefined) {
    return <div className="loading-screen">جارٍ التحميل...</div>;
  }
  return user ? <Dashboard /> : <PublicCurriculum />;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <CalendarProvider>
          <BraveBanner />
          <HashRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Registration />} />
              <Route path="/" element={<RootRoute />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </HashRouter>
          <InstallButton />
        </CalendarProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
