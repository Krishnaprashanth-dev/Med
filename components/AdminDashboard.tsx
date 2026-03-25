
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { 
  Play, Sparkles, CheckCircle, Clock, UserPlus, Users, Settings, Save, X, 
  Sun, Moon, Maximize, User, MapPin, ShieldCheck, Lock,
  Mail, Phone, Briefcase, CheckCircle2, Eye, 
  Zap, Timer, HelpCircle, EyeOff, AlertTriangle, History, Search, Filter, Calendar, ChevronRight, ExternalLink,
  QrCode, CheckCircle2 as SuccessIcon, Trash2, Info
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { lotteryService } from '../services/lotteryService';
import { MedicalRep, Hospital, PassApplication, IssuedPass, MRHospitalApproval, SessionType, PharmaCompany, EntryLog, HospitalUser } from '../types';
import { FeedbackContext } from '../App';

interface AdminDashboardProps {
  user: {
    id: string;
    role: string;
    fullName: string;
    hospitalId: string;
  };
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const { showFeedback } = useContext(FeedbackContext);
  const [mrs, setMrs] = useState<MedicalRep[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [companies, setCompanies] = useState<PharmaCompany[]>([]);
  const [apps, setApps] = useState<PassApplication[]>([]);
  const [passes, setPasses] = useState<IssuedPass[]>([]);
  const [logs, setLogs] = useState<EntryLog[]>([]);
  const [approvals, setApprovals] = useState<MRHospitalApproval[]>([]);
  const [activeTab, setActiveTab] = useState<'lottery' | 'history' | 'approvals' | 'companies' | 'settings'>('lottery');
  const [settingsTab, setSettingsTab] = useState<'profile' | 'sessions' | 'security'>('profile');
  const [passwordData, setPasswordData] = useState({ new: '', confirm: '' });
  const [securityPasswordData, setSecurityPasswordData] = useState({ new: '', confirm: '' });
  const [securityUser, setSecurityUser] = useState<HospitalUser | null>(null);
  const [selectedMR, setSelectedMR] = useState<MedicalRep | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showCommitSuccess, setShowCommitSuccess] = useState(false);
  const [brief, setBrief] = useState('');
  
  const [historySearch, setHistorySearch] = useState('');
  const [historySessionFilter, setHistorySessionFilter] = useState<SessionType | 'ALL'>('ALL');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const allHospitals = await storageService.getHospitals();
      const currentHosp = allHospitals.find(h => h.id === user.hospitalId);
      
      setHospitals(allHospitals);
      setMrs(await storageService.getMRs()); 
      setCompanies(await storageService.getCompanies());
      const allApps = await storageService.getApplications();
      const myApps = allApps.filter(a => a.hospitalId === user.hospitalId);
      setApps(allApps); 
      const myPasses = (await storageService.getPasses()).filter(p => p.hospitalId === user.hospitalId);
      setPasses(await storageService.getPasses());
      setLogs(await storageService.getLogs());
      setApprovals(await storageService.getApprovals());
      
      const hospitalUsers = await storageService.getHospitalUsers();
      const sec = hospitalUsers.find(u => u.hospitalId === user.hospitalId && u.role === 'SECURITY');
      if (sec) setSecurityUser(sec);
      
      if (currentHosp && !editingHospital) {
        setEditingHospital({
          ...currentHosp,
          autoLotteryEnabled: currentHosp.autoLotteryEnabled || {},
          autoLotteryTimes: currentHosp.autoLotteryTimes || {},
          passLimits: currentHosp.passLimits || {},
          companyPassLimit: currentHosp.companyPassLimit || {},
          sessionWindows: currentHosp.sessionWindows || {},
          entryWindows: currentHosp.entryWindows || {},
          expiryTimes: currentHosp.expiryTimes || {},
          supportedSessions: currentHosp.supportedSessions || []
        });
      }

      // Rule-based Briefing
      const successRate = myApps.length > 0 ? ((myPasses.length / myApps.length) * 100).toFixed(1) : 0;
      const today = new Date().toLocaleDateString('en-CA');
      const todayApps = myApps.filter(a => a.applicationDate === today).length;
      
      setBrief(`Facility Report: Today has seen ${todayApps} applications with an overall success rate of ${successRate}%. System traffic is within optimal capacity limits.`);
      
    } catch (e) {
      console.error("Data refresh failed", e);
    }
  }, [user.hospitalId, editingHospital]);

  useEffect(() => { 
    refreshData(); 
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleManualLottery = async (session: SessionType) => {
    const result = await lotteryService.runLottery(user.hospitalId, session);
    if (result.success) {
      storageService.log(user.id, 'MANUAL_LOTTERY', `Session: ${session}, Result: ${result.message}`);
      showFeedback(result.message, 'success');
      refreshData();
    } else {
      showFeedback(result.message, 'error');
    }
  };

  const handleSaveHospitalData = async () => {
    if (!editingHospital) return;
    
    try {
      const savedResults = await storageService.saveHospitals([editingHospital]);
      const savedHosp = savedResults.find(h => h.id === editingHospital.id);
      if (savedHosp) {
        storageService.log(user.id, 'HOSPITAL_SETTINGS_UPDATE', `Hospital: ${savedHosp.name}`);
        setEditingHospital(savedHosp);
        setHospitals(prev => prev.map(h => h.id === savedHosp.id ? savedHosp : h));
        setShowCommitSuccess(true);
        showFeedback("System settings synchronized with cloud backend.", "success");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      showFeedback("Failed to save system settings. Connection error.", "error");
    }
  };

  const handleUpdateAdminPassword = async () => {
    if (!passwordData.new || passwordData.new !== passwordData.confirm) {
      showFeedback("Passwords do not match or are empty", "error");
      return;
    }
    try {
      await storageService.updatePassword(user.id, passwordData.new);
      setPasswordData({ new: '', confirm: '' });
      showFeedback("Your admin password has been updated.");
    } catch (e: any) {
      showFeedback(e.message || "Failed to update password", "error");
    }
  };

  const handleUpdateSecurityPassword = async () => {
    if (!securityPasswordData.new || securityPasswordData.new !== securityPasswordData.confirm) {
      showFeedback("Security passwords do not match or are empty", "error");
      return;
    }
    if (!securityUser) {
      showFeedback("Security user not found", "error");
      return;
    }
    try {
      await storageService.saveHospitalUsers([{
        ...securityUser,
        password: securityPasswordData.new
      }]);
      setSecurityPasswordData({ new: '', confirm: '' });
      showFeedback("Security personnel password has been updated.");
    } catch (e: any) {
      showFeedback(e.message || "Failed to update security password", "error");
    }
  };

  const updateSessionSetting = (sess: SessionType, field: keyof Hospital, value: any) => {
    setEditingHospital(prev => {
      if (!prev) return null;
      const currentFieldData = (prev[field] as any) || {};
      return { ...prev, [field]: { ...currentFieldData, [sess]: value } };
    });
  };

  const toggleSupportedSession = (sess: SessionType) => {
    setEditingHospital(prev => {
      if (!prev) return null;
      const isSupported = prev.supportedSessions.includes(sess);
      const newSupported = isSupported 
        ? prev.supportedSessions.filter(s => s !== sess)
        : [...prev.supportedSessions, sess];
      
      const newAutoEnabled = { ...(prev.autoLotteryEnabled || {}) };
      if (isSupported) newAutoEnabled[sess] = false;

      return { ...prev, supportedSessions: newSupported, autoLotteryEnabled: newAutoEnabled };
    });
  };

  const handleUpdateApproval = async (id: string, status: 'approved' | 'rejected') => {
    const allApprovals = await storageService.getApprovals();
    const target = allApprovals.find(a => a.id === id);
    const updated = allApprovals.map(a => a.id === id ? { ...a, status, updatedAt: new Date().toISOString() } : a);
    await storageService.saveApprovals(updated);
    if (target) storageService.log(user.id, 'MR_APPROVAL_UPDATE', `MR ID: ${target.mrId}, Status: ${status}`);
    setApprovals(updated);
    showFeedback(`MR Access Request ${status === 'approved' ? 'Authorized' : 'Rejected'}.`);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new !== passwordData.confirm) {
      showFeedback("New passwords do not match.", "error");
      return;
    }
    if (passwordData.new.length < 6) {
      showFeedback("New password must be at least 6 characters.", "error");
      return;
    }
    
    try {
      await storageService.updatePassword(user.id, passwordData.new.trim());
      showFeedback("Password updated successfully.", "success");
      setPasswordData({ current: '', new: '', confirm: '' });
    } catch (error) {
      console.error("Password update failed:", error);
      showFeedback("Failed to update password.", "error");
    }
  };

  const currentHospital = hospitals.find(h => h.id === user.hospitalId);

  if (!currentHospital || !editingHospital) return (
    <div className="flex items-center justify-center p-20 text-slate-400 font-bold">
      Loading Facility Configuration...
    </div>
  );

  const pendingApprovals = approvals.filter(a => a.hospitalId === user.hospitalId && a.status === 'pending');
  const approvedMRs = mrs.filter(mr => 
    approvals.some(a => a.mrId === mr.id && a.hospitalId === user.hospitalId && a.status === 'approved')
  );
  const approvedCompanies = companies.filter(c => 
    approvedMRs.some(mr => mr.companyName === c.name)
  );

  const filteredPasses = passes
    .filter(p => p.hospitalId === user.hospitalId)
    .filter(p => {
      const mr = mrs.find(m => m.id === p.mrId);
      const matchesSearch = mr?.fullName.toLowerCase().includes(historySearch.toLowerCase()) || p.id.toLowerCase().includes(historySearch.toLowerCase());
      const matchesSession = historySessionFilter === 'ALL' || p.session === historySessionFilter;
      return matchesSearch && matchesSession;
    })
    .sort((a, b) => new Date(b.passDate).getTime() - new Date(a.passDate).getTime());

  return (
    <div className="space-y-6">
      {/* Success Commitment Modal */}
      {showCommitSuccess && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] shadow-2xl p-10 max-w-sm w-full text-center animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <SuccessIcon className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">System Updated!</h3>
            <p className="text-slate-500 text-sm mt-2 font-medium leading-relaxed">
              Your session configurations and <span className="text-indigo-600 font-bold">Automated Expiry Times</span> have been successfully synchronized.
            </p>
            <button 
              onClick={() => setShowCommitSuccess(false)}
              className="mt-8 w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Local Briefing */}
      <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-lg flex items-center gap-4 border border-indigo-400/30">
        <Info className="h-6 w-6 text-indigo-200 shrink-0" />
        <p className="text-sm font-medium leading-relaxed">{brief || "Compiling facility metrics..."}</p>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit gap-1 overflow-x-auto max-w-full">
        <button onClick={() => setActiveTab('lottery')} className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'lottery' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
          <Play className="h-4 w-4" /> Lottery
        </button>
        <button onClick={() => setActiveTab('history')} className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
          <History className="h-4 w-4" /> Records
        </button>
        <button onClick={() => setActiveTab('approvals')} className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all relative ${activeTab === 'approvals' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
          <UserPlus className="h-4 w-4" /> Requests
          {pendingApprovals.length > 0 && <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white ring-2 ring-white">{pendingApprovals.length}</span>}
        </button>
        <button onClick={() => setActiveTab('companies')} className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'companies' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
          <Briefcase className="h-4 w-4" /> Partners
        </button>
        <button onClick={() => setActiveTab('settings')} className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
          <Settings className="h-4 w-4" /> Settings
        </button>
      </div>

      {/* LOTTERY TAB */}
      {activeTab === 'lottery' && (
        <section className="space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                <Clock className="h-5 w-5 text-indigo-500" /> Live Lottery Control
              </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(['MORNING', 'EVENING', 'FULL_DAY'] as SessionType[]).map((sess) => {
                 if (!currentHospital.supportedSessions.includes(sess)) return null;
                 const today = new Date().toLocaleDateString('en-CA');
                 const count = apps.filter(a => a.hospitalId === user.hospitalId && a.applicationDate === today && a.session === sess && a.status === 'applied').length;
                 const selectedCount = apps.filter(a => a.hospitalId === user.hospitalId && a.applicationDate === today && a.session === sess && (a.status === 'selected' || a.status === 'waitlisted')).length;
                 const isAuto = currentHospital.autoLotteryEnabled?.[sess];
                 const autoTime = currentHospital.autoLotteryTimes?.[sess];

                 return (
                   <div key={sess} className="p-6 bg-slate-50 border border-slate-100 rounded-3xl relative overflow-hidden group">
                     {isAuto && (
                       <div className="absolute top-0 right-0 p-2">
                          <div className="bg-indigo-600 text-white px-2 py-1.5 rounded-bl-2xl rounded-tr-xl shadow-lg flex items-center gap-1.5 animate-pulse">
                             <Zap className="h-3 w-3" />
                             <span className="text-[10px] font-black">{autoTime}</span>
                          </div>
                       </div>
                     )}
                     <div className="flex justify-between items-start mb-6">
                       <div className="flex items-center gap-3">
                         <div className="bg-white p-2 rounded-xl shadow-sm">
                           {sess === 'MORNING' ? <Sun className="h-6 w-6 text-amber-500" /> : sess === 'EVENING' ? <Moon className="h-6 w-6 text-indigo-400" /> : <Maximize className="h-6 w-6 text-indigo-600" />}
                         </div>
                         <div>
                           <h4 className="font-black text-slate-800 tracking-tight">{sess.replace('_', ' ')}</h4>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Limit: {currentHospital.passLimits?.[sess] || 0}</p>
                         </div>
                       </div>
                     </div>
                     
                     <div className="flex items-center justify-between p-4 bg-white rounded-2xl mb-6 shadow-sm border border-slate-100">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Applied Today</p>
                          <p className="text-2xl font-black text-slate-800">{count}</p>
                        </div>
                        <Users className="h-8 w-8 text-slate-100" />
                     </div>

                     <button 
                       disabled={count === 0 || selectedCount > 0}
                       onClick={() => handleManualLottery(sess)}
                       className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-indigo-700 active:scale-95 disabled:grayscale disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                     >
                       {selectedCount > 0 ? <CheckCircle2 className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                       {selectedCount > 0 ? 'SPIN COMPLETED' : 'MANUAL SPIN NOW'}
                     </button>
                   </div>
                 );
              })}
            </div>
          </div>
        </section>
      )}

      {/* HISTORY / RECORDS TAB */}
      {activeTab === 'history' && (
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
           <div className="p-8 border-b border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div>
                    <h3 className="text-xl font-bold text-slate-800">Hospital Issued Pass Audit</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">Permanent record of all verified hospital visits.</p>
                 </div>
                 <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                       <input 
                         type="text" 
                         placeholder="Search MR or Pass ID..." 
                         value={historySearch}
                         onChange={(e) => setHistorySearch(e.target.value)}
                         className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none w-64"
                       />
                    </div>
                 </div>
              </div>
           </div>

           <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead className="bg-slate-50/50 sticky top-0 z-10 border-b border-slate-100">
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       <th className="px-6 py-4">Date & Session</th>
                       <th className="px-6 py-4">Medical Representative</th>
                       <th className="px-6 py-4">SLCPI ID</th>
                       <th className="px-6 py-4">Company</th>
                       <th className="px-6 py-4">Status</th>
                       <th className="px-6 py-4">Entry Log</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {filteredPasses.map(p => {
                       const mr = mrs.find(m => m.id === p.mrId);
                       const entryLog = logs.find(l => l.issuedPassId === p.id);
                       return (
                          <tr key={p.id} className="hover:bg-indigo-50/20 transition-colors group">
                             <td className="px-6 py-4">
                                <p className="text-xs font-black text-slate-800">{p.passDate}</p>
                                <div className="flex items-center gap-1 mt-1">
                                   <span className="text-[9px] font-bold text-slate-400 uppercase">{p.session}</span>
                                </div>
                             </td>
                             <td className="px-6 py-4">
                                <div>
                                   <p className="text-sm font-black text-slate-800">{mr?.fullName || 'N/A'}</p>
                                   <p className="text-[10px] font-bold text-indigo-500 font-mono">{p.id.slice(0, 8).toUpperCase()}</p>
                                </div>
                             </td>
                             <td className="px-6 py-4">
                                <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                   {mr?.slcpiId || 'NO ID'}
                                </span>
                             </td>
                             <td className="px-6 py-4">
                                <p className="text-xs font-bold text-slate-600">{mr?.companyName}</p>
                             </td>
                             <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                   p.entryStatus === 'entered' ? 'bg-green-100 text-green-700' :
                                   p.entryStatus === 'ended' ? 'bg-slate-200 text-slate-600' :
                                   p.entryStatus === 'expired' ? 'bg-slate-100 text-slate-500' :
                                   'bg-indigo-100 text-indigo-700'
                                }`}>
                                   {p.entryStatus === 'entered' ? 'VISITED' : p.entryStatus === 'ended' ? 'ENDED' : p.entryStatus.replace('_', ' ')}
                                </span>
                             </td>
                             <td className="px-6 py-4">
                                {entryLog ? (
                                   <div className="flex flex-col">
                                      <p className="text-[10px] font-black text-slate-800">{new Date(entryLog.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                   </div>
                                ) : (
                                   <span className="text-[10px] font-bold text-slate-300">--</span>
                                )}
                             </td>
                          </tr>
                       );
                    })}
                 </tbody>
              </table>
           </div>
        </section>
      )}

      {/* REQUESTS TAB */}
      {activeTab === 'approvals' && (
        <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-xl font-bold mb-8 flex items-center gap-2 text-slate-800">
            <UserPlus className="h-6 w-6 text-indigo-500" />
            Authorization Requests
          </h3>
          
          <div className="space-y-4">
            {pendingApprovals.map(a => {
              const mr = mrs.find(m => m.id === a.mrId);
              return (
                <div key={a.id} className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-50 border border-slate-100 rounded-3xl gap-4 hover:border-indigo-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                      <User className="h-6 w-6 text-slate-400" />
                    </div>
                    <div>
                      <p className="font-black text-slate-800">{mr?.fullName || 'Unknown MR'}</p>
                      <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide">{mr?.companyName}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedMR(mr || null)} className="p-3 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all"><Eye className="h-5 w-5" /></button>
                    <button onClick={() => handleUpdateApproval(a.id, 'rejected')} className="px-6 py-3 bg-white border border-red-100 text-red-500 rounded-xl font-black text-xs hover:bg-red-50 transition-all">REJECT</button>
                    <button onClick={() => handleUpdateApproval(a.id, 'approved')} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-md hover:bg-indigo-700 transition-all">APPROVE ACCESS</button>
                  </div>
                </div>
              );
            })}
            {pendingApprovals.length === 0 && (
              <div className="text-center py-20 text-slate-400 italic">No pending authorization requests.</div>
            )}
          </div>
        </section>
      )}

      {/* PARTNERS TAB */}
      {activeTab === 'companies' && (
        <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-xl font-bold text-slate-800 mb-8">Authorized Pharma Partners</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {approvedCompanies.map(c => {
               const activeCompanyReps = approvedMRs.filter(mr => mr.companyName === c.name && mr.status === 'active');
               return (
                 <div key={c.id} className="bg-slate-50/50 border border-slate-100 rounded-3xl overflow-hidden hover:border-indigo-200 transition-all hover:shadow-md group">
                    <div 
                      onClick={() => setSelectedCompanyId(selectedCompanyId === c.id ? null : c.id)}
                      className="p-6 bg-white border-b border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                       <div>
                          <h4 className="font-black text-lg text-slate-800 group-hover:text-indigo-600 transition-colors">{c.name}</h4>
                          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">{c.companyCode}</p>
                       </div>
                       <ChevronRight className={`h-5 w-5 text-slate-300 transition-transform ${selectedCompanyId === c.id ? 'rotate-90 text-indigo-500' : ''}`} />
                    </div>
                    {selectedCompanyId === c.id && (
                      <div className="p-6 animate-in slide-in-from-top-2 duration-300 bg-white">
                         <div className="grid gap-3 sm:grid-cols-2">
                            {activeCompanyReps.map(mr => (
                               <div key={mr.id} onClick={() => setSelectedMR(mr)} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3 hover:border-indigo-200 cursor-pointer">
                                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                                     <User className="h-4 w-4 text-slate-400" />
                                  </div>
                                  <p className="text-xs font-black text-slate-800 truncate">{mr.fullName}</p>
                               </div>
                            ))}
                         </div>
                      </div>
                    )}
                 </div>
               );
            })}
          </div>
        </section>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm max-w-2xl mx-auto">
          <div className="flex border-b border-slate-100 mb-8 overflow-x-auto">
            <button onClick={() => setSettingsTab('profile')} className={`px-6 py-3 text-[10px] font-black border-b-2 whitespace-nowrap ${settingsTab === 'profile' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>HOSPITAL PROFILE</button>
            <button onClick={() => setSettingsTab('sessions')} className={`px-6 py-3 text-[10px] font-black border-b-2 whitespace-nowrap ${settingsTab === 'sessions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>SESSIONS & AUTO-SPIN</button>
            <button onClick={() => setSettingsTab('security')} className={`px-6 py-3 text-[10px] font-black border-b-2 whitespace-nowrap ${settingsTab === 'security' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>SECURITY & ACCESS</button>
          </div>

          <div className="space-y-8">
            {settingsTab === 'profile' && (
              <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Official Name</label>
                    <input type="text" value={editingHospital.name} readOnly className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Facility Address</label>
                    <textarea 
                      value={editingHospital.address || ''} 
                      onChange={(e) => setEditingHospital({...editingHospital, address: e.target.value})}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold outline-none h-24" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="email" value={editingHospital.email || ''} onChange={(e) => setEditingHospital({...editingHospital, email: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold" placeholder="Email" />
                    <input type="tel" value={editingHospital.mobileNumber || ''} onChange={(e) => setEditingHospital({...editingHospital, mobileNumber: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold" placeholder="Mobile" />
                  </div>
              </div>
            )}

            {settingsTab === 'sessions' && (
              <div className="space-y-6">
                {(['MORNING', 'EVENING', 'FULL_DAY'] as SessionType[]).map(sess => {
                  const isSupported = editingHospital.supportedSessions.includes(sess);
                  const isAuto = editingHospital.autoLotteryEnabled?.[sess] || false;
                  
                  return (
                    <div key={sess} className={`p-6 rounded-3xl border-2 transition-all ${isSupported ? 'bg-white border-indigo-100' : 'bg-slate-50 border-dashed opacity-60'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <span className="font-black text-slate-800 uppercase tracking-widest">{sess.replace('_', ' ')}</span>
                          <input type="checkbox" checked={isSupported} onChange={() => toggleSupportedSession(sess)} className="w-5 h-5 rounded border-slate-300 text-indigo-600" />
                        </div>

                        {isSupported && (
                          <div className="space-y-4">
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                   <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Pass Limit</label>
                                   <input type="number" value={editingHospital.passLimits?.[sess] || 0} onChange={(e) => updateSessionSetting(sess, 'passLimits', parseInt(e.target.value) || 0)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                                   <p className="text-[8px] text-slate-400 mt-1">Total passes per session</p>
                                </div>
                                <div>
                                   <label className="text-[10px] font-black text-indigo-600 uppercase mb-1 block">Company Pass Cap</label>
                                   <input type="number" value={editingHospital.companyPassLimit?.[sess] || 0} onChange={(e) => updateSessionSetting(sess, 'companyPassLimit', parseInt(e.target.value) || 0)} className="w-full px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl font-bold text-indigo-700" />
                                   <p className="text-[8px] text-indigo-600 mt-1">Max per company</p>
                                </div>
                             </div>

                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">App Window</label>
                                <div className="grid grid-cols-2 gap-2">
                                   <input type="time" value={editingHospital.sessionWindows?.[sess]?.start || '08:00'} onChange={(e) => updateSessionSetting(sess, 'sessionWindows', { ...(editingHospital.sessionWindows?.[sess] || {start:'08:00', end:'10:00'}), start: e.target.value })} className="w-full px-2 py-2 bg-slate-50 border rounded-xl text-[10px] font-bold" />
                                   <input type="time" value={editingHospital.sessionWindows?.[sess]?.end || '10:00'} onChange={(e) => updateSessionSetting(sess, 'sessionWindows', { ...(editingHospital.sessionWindows?.[sess] || {start:'08:00', end:'10:00'}), end: e.target.value })} className="w-full px-2 py-2 bg-slate-50 border rounded-xl text-[10px] font-bold" />
                                </div>
                             </div>

                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-indigo-600 uppercase mb-1 block flex items-center gap-1">
                                   <QrCode className="h-3 w-3" /> Entry Scanning Window
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                   <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-bold text-slate-400">START</span>
                                      <input type="time" value={editingHospital.entryWindows?.[sess]?.start || '08:00'} onChange={(e) => updateSessionSetting(sess, 'entryWindows', { ...(editingHospital.entryWindows?.[sess] || {start:'08:00', end:'10:00'}), start: e.target.value })} className="w-full px-3 py-2 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs font-bold" />
                                   </div>
                                   <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-bold text-slate-400">END</span>
                                      <input type="time" value={editingHospital.entryWindows?.[sess]?.end || '10:00'} onChange={(e) => updateSessionSetting(sess, 'entryWindows', { ...(editingHospital.entryWindows?.[sess] || {start:'08:00', end:'10:00'}), end: e.target.value })} className="w-full px-3 py-2 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs font-bold" />
                                   </div>
                                </div>
                             </div>

                             <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                   <Timer className="h-4 w-4 text-indigo-500" />
                                   <span className="text-[10px] font-black text-indigo-700 uppercase">Expiry & visit termination</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                   <div>
                                      <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">Unused Pass Expiry</label>
                                      <input type="time" value={editingHospital.expiryTimes?.[sess]?.issued || (sess === 'MORNING' ? '13:00' : '23:00')} onChange={(e) => updateSessionSetting(sess, 'expiryTimes', { ...(editingHospital.expiryTimes?.[sess] || {issued:'13:00', active:'13:00'}), issued: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs" />
                                      <p className="text-[7px] text-slate-400 mt-1 uppercase font-bold">Turns to EXPIRED</p>
                                   </div>
                                   <div>
                                      <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">Active Visit End</label>
                                      <input type="time" value={editingHospital.expiryTimes?.[sess]?.active || (sess === 'MORNING' ? '13:00' : '23:00')} onChange={(e) => updateSessionSetting(sess, 'expiryTimes', { ...(editingHospital.expiryTimes?.[sess] || {issued:'13:00', active:'13:00'}), active: e.target.value })} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs" />
                                      <p className="text-[7px] text-slate-400 mt-1 uppercase font-bold">Turns to ENDED</p>
                                   </div>
                                </div>
                             </div>

                             <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                                <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-indigo-600" /><span className="text-xs font-bold">Auto-Spin Lottery</span></div>
                                <div className="flex items-center gap-3">
                                   {isAuto && <input type="time" value={editingHospital.autoLotteryTimes?.[sess] || '18:00'} onChange={(e) => updateSessionSetting(sess, 'autoLotteryTimes', e.target.value)} className="bg-indigo-50 border-none text-xs font-black text-indigo-800 rounded-lg p-1 w-16" />}
                                   <button type="button" onClick={() => updateSessionSetting(sess, 'autoLotteryEnabled', !isAuto)} className={`px-4 py-2 rounded-xl text-[10px] font-black ${isAuto ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{isAuto ? 'AUTO ON' : 'AUTO OFF'}</button>
                                </div>
                             </div>
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            )}
            {settingsTab === 'security' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Lock className="h-5 w-5" /></div>
                      <h4 className="font-bold text-slate-800">Admin Security</h4>
                    </div>
                    <p className="text-xs text-slate-500 mb-6">Update your personal administrative access password. Use a strong, unique combination.</p>
                    <div className="space-y-4">
                      <input type="password" value={passwordData.new} onChange={e => setPasswordData({...passwordData, new: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold" placeholder="New Admin Password" />
                      <input type="password" value={passwordData.confirm} onChange={e => setPasswordData({...passwordData, confirm: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold" placeholder="Confirm New Password" />
                      <button onClick={handleUpdateAdminPassword} className="w-full bg-slate-800 text-white font-black py-3 rounded-xl hover:bg-slate-900 transition-all text-xs uppercase tracking-widest">UPDATE MY PASSWORD</button>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><ShieldCheck className="h-5 w-5" /></div>
                      <h4 className="font-bold text-slate-800">Gate Security Access</h4>
                    </div>
                    <p className="text-xs text-slate-500 mb-6">Manage the password for the gate security personnel account. This affects the Security View login.</p>
                    <div className="space-y-4">
                      <div className="p-3 bg-white rounded-xl border border-slate-200 mb-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Current Security Officer</p>
                        <p className="text-sm font-bold text-slate-700">{securityUser?.fullName || 'Not assigned'}</p>
                      </div>
                      <input type="password" value={securityPasswordData.new} onChange={e => setSecurityPasswordData({...securityPasswordData, new: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold" placeholder="New Security Password" />
                      <input type="password" value={securityPasswordData.confirm} onChange={e => setSecurityPasswordData({...securityPasswordData, confirm: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold" placeholder="Confirm Security Password" />
                      <button onClick={handleUpdateSecurityPassword} className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl hover:bg-indigo-700 transition-all text-xs uppercase tracking-widest">UPDATE GATE ACCESS</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-slate-100">
                <button onClick={handleSaveHospitalData} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Save className="h-5 w-5" /> SAVE SYSTEM CHANGES
                </button>
              </div>
          </div>
        </section>
      )}

      {/* MR Profile Modal */}
      {selectedMR && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 animate-in zoom-in duration-200 relative">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Representative Identity</h3>
              <button onClick={() => setSelectedMR(null)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="text-center space-y-4">
               <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-sm">
                 <User className="h-10 w-10 text-indigo-600" />
               </div>
               <h4 className="text-2xl font-black text-slate-800">{selectedMR.fullName}</h4>
               <p className="text-indigo-600 font-bold uppercase text-sm">{selectedMR.companyName}</p>
               <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="p-3 bg-slate-50 rounded-xl border"><p className="text-[10px] font-black text-slate-400 uppercase">Official ID</p><p className="font-bold text-slate-700">{selectedMR.mrId}</p></div>
                  <div className="p-3 bg-slate-50 rounded-xl border"><p className="text-[10px] font-black text-slate-400 uppercase">Mobile</p><p className="font-bold text-slate-700">{selectedMR.mobileNumber}</p></div>
               </div>
               <button onClick={() => setSelectedMR(null)} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl">CLOSE PROFILE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
