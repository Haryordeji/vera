import {
  ClerkProvider,
  SignIn,
  SignUp,
  SignedIn,
  SignedOut,
  RedirectToSignIn,
} from "@clerk/clerk-react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthSync } from "./components/AuthSync";
import DashboardPage from "./pages/DashboardPage";
import NewVisitPage from "./pages/NewVisitPage";
import ActiveVisitPage from "./pages/ActiveVisitPage";
import PastVisitsPage from "./pages/PastVisitsPage";
import SettingsPage from "./pages/SettingsPage";

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
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AuthSync>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <BrowserRouter>
        <Routes>
          {/* Clerk-hosted auth pages */}
          <Route
            path="/sign-in/*"
            element={<SignIn routing="path" path="/sign-in" />}
          />
          <Route
            path="/sign-up/*"
            element={<SignUp routing="path" path="/sign-up" />}
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
    </ClerkProvider>
  );
}
