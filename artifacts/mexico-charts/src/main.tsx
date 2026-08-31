import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./auth/AuthProvider";
import { LanguageProvider } from "./i18n/LanguageContext";
import { YouTubeConsentProvider } from "./components/YouTubeConsent";

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <YouTubeConsentProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </YouTubeConsentProvider>
  </LanguageProvider>,
);
