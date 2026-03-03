import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { VideoTaskProvider } from "@/contexts/VideoTaskContext";
import { RuleAcceptanceProvider, useRuleAcceptance } from "@/contexts/RuleAcceptanceContext";
import RuleAcceptanceModal from "@/components/RuleAcceptanceModal";
import Index from "./pages/Index";
import About from "./pages/About";
import Support from "./pages/Support";
import Advertise from "./pages/Advertise";
import AffiliateLogin from "./pages/AffiliateLogin";
import AffiliateDashboard from "./pages/AffiliateDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Wrapper component to show modal when rules need to be accepted
function RuleAcceptanceModalWrapper() {
  const { showRulesModal, setShowRulesModal, recordAcceptance, accepted, userId } = useRuleAcceptance();
  
  const handleAccepted = async () => {
    if (userId) {
      await recordAcceptance(userId);
    }
  };
  
  return (
    <RuleAcceptanceModal
      isOpen={showRulesModal}
      onClose={() => setShowRulesModal(false)}
      userId={userId}
      onAccepted={handleAccepted}
    />
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <RuleAcceptanceProvider>
            <VideoTaskProvider>
              <BrowserRouter>
                <RuleAcceptanceModalWrapper />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/advertise" element={<Advertise />} />
                  <Route path="/affiliate-login" element={<AffiliateLogin />} />
                  <Route path="/dashboard" element={<AffiliateDashboard />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </VideoTaskProvider>
          </RuleAcceptanceProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
