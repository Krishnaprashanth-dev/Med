
import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { storageService } from './services/storageService';
import { lotteryService } from './services/lotteryService';
import Layout from './components/Layout';
import MRDashboard from './components/MRDashboard';
import AdminDashboard from './components/AdminDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import SecurityView from './components/SecurityView';
import CompanyAdminDashboard from './components/CompanyAdminDashboard';
import { User, ShieldCheck, Crown, CheckCircle2, AlertCircle, X, Lock, Briefcase, Hospital as HospitalIcon, ArrowRight, Zap, Loader2 } from 'lucide-react';
import { UserRole, AuthUser, SessionType, Hospital } from './types';
import { supabase } from './supabaseClient';

// Simple context for global notifications
export const FeedbackContext = createContext<{
  showFeedback: (msg: string, type?: 'success' | 'error') => void;
}>({ showFeedback: () => {} });

// App Type detection logic (using query parameters for hosting compatibility)
const getAppType = () => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('type')?.toLowerCase() || '';
};

const getInitialRole = (type: string): UserRole => {
  switch (type) {
    case 'hospital': return 'ADMIN';
    case 'admin': return 'ADMIN';
    case 'company': return 'COMPANY_ADMIN';
    case 'security': return 'SECURITY';
    case 'root': return 'SUPER_ADMIN';
    default: return 'MR';
  }
};

const FeedbackToast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-[200] animate-in slide-in-from-right-10 fade-in duration-300">
      <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border ${
        type === 'success' ? 'bg-white border-green-100 text-green-800' : 'bg-white border-red-100 text-red-800'
      }`}>
        {type === 'success' ? <CheckCircle2 className="h-6 w-6 text-green-500" /> : <AlertCircle className="h-6 w-6 text-red-500" />}
        <p className="font-bold text-sm">{message}</p>
        <button onClick={onClose} className="ml-2 p-1 hover:bg-slate-100 rounded-lg transition-all">
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [view, setView] = useState<'LOGIN' | 'DASHBOARD'>('LOGIN');
  
  // Initialize role based on URL type parameter
  const appType = getAppType();
  const [role, setRole] = useState<UserRole>(getInitialRole(appType));
  
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const autoRunLogs = useRef<Set<string>>(new Set());

  useEffect(() => {
    const session = storageService.getCurrentUser();
    if (session) { 
      setUser(session); 
      setView('DASHBOARD'); 
    } else {
      // No session, ensure we are at login
      setUser(null);
      setView('LOGIN');
    }

    const automationInterval = setInterval(async () => {
      // CRITICAL: Only run automation for Admins to reduce load from 2000 MRs
      const currentUser = storageService.getCurrentUser();
      if (!currentUser || (currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'ADMIN')) return;

      try {
        const now = new Date();
        const today = now.toLocaleDateString('en-CA');
        const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const currentTimeNum = now.getHours() * 100 + now.getMinutes();
        
        // If Hospital Admin, only handle their hospital. If Super Admin, handle all.
        const hospitalId = currentUser.role === 'ADMIN' ? currentUser.hospitalId : undefined;
        const hospitals = await storageService.getHospitals(hospitalId);
        
        // Handle Pass Expiry/Ending
        // Only fetch active passes that might need updating
        const activePasses = await storageService.getPasses({ 
          hospitalId, 
          status: 'not_entered' // Only check those not entered for expiry
        });
        const enteredPasses = await storageService.getPasses({
          hospitalId,
          status: 'entered' // Only check those entered for ending
        });

        const allRelevantPasses = [...activePasses, ...enteredPasses];
        let hasPassChanges = false;
        
        const updatedPasses = allRelevantPasses.map(p => {
          // Auto-expire/end old passes from previous days
          if (p.passDate < today) {
            hasPassChanges = true;
            return { ...p, entryStatus: p.entryStatus === 'entered' ? 'ended' as const : 'expired' as const };
          }

          // Handle today's passes
          if (p.passDate === today) {
            const hosp = hospitals.find(h => h.id === p.hospitalId);
            if (!hosp) return p;

            const defaultTime = p.session === 'MORNING' ? '13:00' : '23:00';
            const configuredTimes = hosp.expiryTimes?.[p.session] || { issued: defaultTime, active: defaultTime };
            
            const convertToNum = (t: string) => parseInt(t.replace(':', ''));
            const issuedExpiryNum = convertToNum(configuredTimes.issued);
            const activeEndNum = convertToNum(configuredTimes.active);

            if (p.entryStatus === 'not_entered' && currentTimeNum >= issuedExpiryNum) {
              hasPassChanges = true;
              return { ...p, entryStatus: 'expired' as const };
            }
            
            if (p.entryStatus === 'entered' && currentTimeNum >= activeEndNum) {
              hasPassChanges = true;
              return { ...p, entryStatus: 'ended' as const };
            }
          }
          return p;
        });

        if (hasPassChanges) {
          const changesOnly = updatedPasses.filter((p, i) => p.entryStatus !== allRelevantPasses[i].entryStatus);
          await storageService.savePasses(changesOnly);
        }

        // Handle Automatic Lottery
        for (const hosp of hospitals) {
          if (!hosp.isActive || !hosp.autoLotteryEnabled) continue;

          const sessions: SessionType[] = ['MORNING', 'EVENING', 'FULL_DAY'];
          for (const sess of sessions) {
            const isEnabled = hosp.autoLotteryEnabled?.[sess];
            const triggerTime = hosp.autoLotteryTimes?.[sess];
            
            if (isEnabled && triggerTime && currentTimeStr >= triggerTime) {
              const logKey = `${hosp.id}-${today}-${sess}`;
              if (!autoRunLogs.current.has(logKey)) {
                // Double check if lottery already run by fetching apps for this slot
                const apps = await storageService.getApplications({ hospitalId: hosp.id, date: today });
                const alreadyRun = apps.some(a => a.session === sess && (a.status === 'selected' || a.status === 'waitlisted'));
                
                if (!alreadyRun) {
                  const result = await lotteryService.runLottery(hosp.id, sess);
                  if (result.success || result.message.includes("already executed") || result.message.includes("No eligible")) {
                    autoRunLogs.current.add(logKey);
                  }
                } else {
                  autoRunLogs.current.add(logKey);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Automation error:", err);
      }
    }, 60000);

    return () => clearInterval(automationInterval);
  }, [appType]);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
  };

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsLoggingIn(true);
    
    const cleanMobile = mobile.trim();
    const cleanPassword = password.trim();
    
    try {
      console.log(`[Login] Attempting login for: "${cleanMobile}" on portal: ${role}`);
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: cleanMobile, password: cleanPassword, role })
      });

      if (!response.ok) {
        console.error(`[Login] API Error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error(`[Login] Error Body:`, errorText);
        showFeedback(`Authentication failed (Server Error: ${response.status}).`, 'error');
        setIsLoggingIn(false);
        return;
      }

      const result = await response.json();

      if (!result.success) {
        showFeedback(result.message || "Authentication failed.", 'error');
        setIsLoggingIn(false);
        return;
      }

      const u: AuthUser = result.user;
      console.log("[Login] Success! User session created:", u.fullName);

      storageService.setCurrentUser(u); setUser(u); setView('DASHBOARD');
      storageService.log(u.id, 'LOGIN', `${u.role} Login: ${u.fullName}`);
      showFeedback(`Welcome back, ${u.fullName}!`);
    } catch (err) {
      console.error("Login Exception:", err);
      showFeedback("Authentication failed. Please check your connection.", 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    if (user) storageService.log(user.id, 'LOGOUT', `User ${user.fullName} logged out`);
    storageService.clearSession();
    setUser(null);
    setView('LOGIN');
    showFeedback("Logged out successfully");
  };

  if (view === 'LOGIN' || !user) {
    return (
      <FeedbackContext.Provider value={{ showFeedback }}>
        <div className="min-h-screen bg-indigo-700 flex flex-col items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden mb-12 border border-white/20">
            <div className="bg-slate-50 p-10 text-center border-b border-slate-100">
              <div className="bg-indigo-600 w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200">
                <HospitalIcon className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tighter leading-none">MedPass Engine</h1>
              <p className="text-xs font-black text-indigo-500 uppercase tracking-widest mt-2">Next-Gen MR Logistics v3.5</p>
            </div>
            <div className="p-8">
              {/* Context Indicator */}
              <div className="mb-6 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 rounded-full border border-indigo-100">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                    {appType === 'hospital' ? 'Hospital Portal' : 
                     appType === 'admin' ? 'Hospital Admin Portal' : 
                     appType === 'company' ? 'Pharma Company Portal' : 
                     appType === 'security' ? 'Security Gateway' : 
                     appType === 'root' ? 'Root Authority' : 
                     'Representative Hub'}
                  </span>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{role === 'MR' ? 'Mobile Number' : 'Login ID / Identity'}</label>
                  <input 
                    type="text" 
                    value={mobile} 
                    onChange={e => setMobile(e.target.value)} 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-800" 
                    placeholder={role === 'MR' ? "077xxxxxxx" : role === 'SUPER_ADMIN' ? "Identity Name" : "Login ID"}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Secure Password</label>
                  <div className="relative">
                    <input 
                      type="password" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-800" 
                      placeholder="••••••••"
                    />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={isLoggingIn}
                  className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 group"
                >
                  {isLoggingIn ? <Loader2 className="h-6 w-6 animate-spin" /> : <>Access Secure System <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" /></>}
                </button>
              </form>
            </div>
          </div>
          
          <div className="flex flex-col items-center grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-700 cursor-default group">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-100">Powered by</span>
              <div className="flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-2xl group-hover:border-indigo-400 group-hover:shadow-indigo-500/20 transition-all duration-500">
                <Zap className="h-4 w-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                <span className="text-lg font-black text-white tracking-tighter">medPass Engine</span>
              </div>
            </div>
            <p className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.3em] opacity-60 group-hover:opacity-100 transition-opacity">Professional Field Intelligence 3.5</p>
          </div>

          {feedback && <FeedbackToast message={feedback.message} type={feedback.type} onClose={() => setFeedback(null)} />}
        </div>
      </FeedbackContext.Provider>
    );
  }

  return (
    <FeedbackContext.Provider value={{ showFeedback }}>
      <Layout 
        user={user} 
        onLogout={handleLogout} 
        title={user.role === 'SUPER_ADMIN' ? 'Root Authority Control' : user.role === 'MR' ? 'Representative Hub' : `${user.fullName} Management`}
      >
        {user.role === 'MR' && <MRDashboard user={user as any} />}
        {user.role === 'COMPANY_ADMIN' && <CompanyAdminDashboard user={user} />}
        {user.role === 'ADMIN' && <AdminDashboard user={user as any} />}
        {user.role === 'SUPER_ADMIN' && <SuperAdminDashboard user={user} />}
        {user.role === 'SECURITY' && <SecurityView />}
      </Layout>
      {feedback && <FeedbackToast message={feedback.message} type={feedback.type} onClose={() => setFeedback(null)} />}
    </FeedbackContext.Provider>
  );
};

export default App;
