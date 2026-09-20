import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider, ThemeToggleFab } from "./lib/theme";
import { WhatsAppFab } from "./components/Legal";
import LandingPage from "./pages/LandingPage";
import ChatPage from "./pages/ChatPage";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ThemeToggleFab />
          <WhatsAppFab />
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
