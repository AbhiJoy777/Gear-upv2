import { Switch, Route, Router as WouterRouter } from "wouter";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { ThemeLayout } from "@/components/layout/ThemeLayout";
import Home from "@/pages/Home";
import LoginPage from "@/pages/Login";
import SignupPage from "@/pages/Signup";
import TermsPage from "@/pages/Terms";
import PrivacyPage from "@/pages/Privacy";
import ContactPage from "@/pages/Contact";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/contact" component={ContactPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <AuthProvider>
        <ToastProvider>
          <ThemeLayout>
            <Router />
          </ThemeLayout>
        </ToastProvider>
      </AuthProvider>
    </WouterRouter>
  );
}

export default App;
