import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface RuleAcceptanceContextType {
  showRulesModal: boolean;
  setShowRulesModal: (show: boolean) => void;
  checkRulesAcceptance: (userId: string) => Promise<boolean>;
  recordAcceptance: (userId: string) => Promise<void>;
  accepted: boolean;
  userId: string | null;
}

const RuleAcceptanceContext = createContext<RuleAcceptanceContextType | undefined>(undefined);

export function RuleAcceptanceProvider({ children }: { children: ReactNode }) {
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { user } = useAuth();

  // Check if rules need to be accepted
  const checkRulesAcceptance = async (pUserId: string): Promise<boolean> => {
    try {
      // Check if acceptance table exists and get last acceptance
      const { data, error } = await supabase
        .from('affiliate_rule_acceptance')
        .select('accepted_at, rule_version')
        .eq('affiliate_id', pUserId)
        .order('accepted_at', { ascending: false })
        .limit(1);

      if (error) {
        console.log('Rule acceptance table may not exist yet:', error.message);
        // If table doesn't exist, show modal
        return true;
      }

      if (!data || data.length === 0) {
        // No acceptance record = needs to accept
        return true;
      }

      const lastAcceptance = data[0];
      const lastAcceptanceDate = new Date(lastAcceptance.accepted_at);
      const now = new Date();
      
      // Check if > 7 days since last acceptance
      const daysDiff = Math.floor((now.getTime() - lastAcceptanceDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 7) {
        return true;
      }

      // Check if rule version changed (currently version 1.0)
      if (lastAcceptance.rule_version !== '1.0') {
        return true;
      }

      // All checks passed, no need to accept
      return false;
    } catch (err) {
      console.error('Error checking rules acceptance:', err);
      // Show modal on error to be safe
      return true;
    }
  };

  // Record acceptance in database
  const recordAcceptance = async (pUserId: string): Promise<void> => {
    try {
      // Get IP address
      let ipAddress = 'unknown';
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        ipAddress = ipData.ip;
      } catch (e) {
        console.log('Could not get IP address');
      }

      const userAgent = navigator.userAgent;

      // Insert acceptance record
      const { error } = await supabase
        .from('affiliate_rule_acceptance')
        .insert({
          affiliate_id: pUserId,
          accepted_at: new Date().toISOString(),
          ip_address: ipAddress,
          user_agent: userAgent,
          rule_version: '1.0'
        });

      if (error) {
        console.error('Error recording acceptance:', error);
        throw error;
      }

      setAccepted(true);
    } catch (err) {
      console.error('Error recording acceptance:', err);
      throw err;
    }
  };

  // Initialize: check if user needs to accept rules
  useEffect(() => {
    const init = async () => {
      if (user) {
        setUserId(user.id);
        const needsAcceptance = await checkRulesAcceptance(user.id);
        setShowRulesModal(needsAcceptance);
        setAccepted(!needsAcceptance);
      }
    };

    init();
  }, [user]);

  // Re-check on dashboard/page access
  useEffect(() => {
    const recheckOnDashboard = async () => {
      if (user && accepted) {
        // Recheck if rules need to be accepted (in case of 7-day expiry)
        const needsAcceptance = await checkRulesAcceptance(user.id);
        if (needsAcceptance) {
          setShowRulesModal(true);
          setAccepted(false);
        }
      }
    };

    // Check on page visibility change (when user returns to dashboard)
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        recheckOnDashboard();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Check periodically (every 30 seconds when on dashboard)
    const interval = setInterval(() => {
      if (user && accepted) {
        recheckOnDashboard();
      }
    }, 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [user, accepted]);

  return (
    <RuleAcceptanceContext.Provider
      value={{
        showRulesModal,
        setShowRulesModal,
        checkRulesAcceptance,
        recordAcceptance,
        accepted,
        userId
      }}
    >
      {children}
    </RuleAcceptanceContext.Provider>
  );
}

export function useRuleAcceptance() {
  const context = useContext(RuleAcceptanceContext);
  if (context === undefined) {
    throw new Error('useRuleAcceptance must be used within a RuleAcceptanceProvider');
  }
  return context;
}
