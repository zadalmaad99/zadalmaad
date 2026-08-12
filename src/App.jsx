import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CalendarProvider } from "./context/CalendarContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import InstallButton from "./components/InstallButton";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <CalendarProvider>
          <HashRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </HashRouter>
          <InstallButton />
        </CalendarProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
