import {
  ClerkProvider,
  SignIn,
  SignUp,
  SignedIn,
  SignedOut,
  RedirectToSignIn,
} from "@clerk/clerk-react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthSync } from "./components/AuthSync";
import { ToastProvider } from "./components/ui/Toast";
import { AuthLayout } from "./components/layout/AuthLayout";
import DashboardPage from "./pages/DashboardPage";
import NewVisitPage from "./pages/NewVisitPage";
import ActiveVisitPage from "./pages/ActiveVisitPage";
import PastVisitsPage from "./pages/PastVisitsPage";
import PatientListPage from "./pages/PatientListPage";
import PatientDetailPage from "./pages/PatientDetailPage";
import ProfilePage from "./pages/ProfilePage";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in environment");
}

function AuthenticatedRoutes() {
  return (
    <AuthSync>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/visits/new" element={<NewVisitPage />} />
        <Route path="/visits/:id" element={<ActiveVisitPage />} />
        <Route path="/visits" element={<PastVisitsPage />} />
        <Route path="/patients" element={<PatientListPage />} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<Navigate to="/profile" replace />} />
      </Routes>
    </AuthSync>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Clerk-hosted auth pages — wrapped with branded layout */}
          <Route
            path="/sign-in/*"
            element={
              <AuthLayout>
                <SignIn routing="path" path="/sign-in" />
              </AuthLayout>
            }
          />
          <Route
            path="/sign-up/*"
            element={
              <AuthLayout>
                <SignUp routing="path" path="/sign-up" />
              </AuthLayout>
            }
          />

          {/* All authenticated routes */}
          <Route
            path="/*"
            element={
              <>
                <SignedIn>
                  <AuthenticatedRoutes />
                </SignedIn>
                <SignedOut>
                  <RedirectToSignIn />
                </SignedOut>
              </>
            }
          />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </ClerkProvider>
  );
}
