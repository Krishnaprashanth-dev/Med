import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  UserPlus, Search, Briefcase, Mail, Phone, CreditCard, X, Edit3, Trash2, Power, 
  User, ShieldCheck, Activity, Users, Plus, Key, BarChart3, Clock, CheckCircle2, 
  Image as ImageIcon, Upload, Calendar, MapPin, DollarSign, Save, Copy, Check, AlertCircle, ArrowRight, XCircle, CheckCircle,
  Flame, Trophy, Info, AlertTriangle, Bell
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { ScoringService } from '../services/ScoringService';
import { NotificationService } from '../services/NotificationService';
import { MedicalRep, PharmaCompany, AuthUser, PassApplication, IssuedPass, SessionCancellationRequest, MRScore, Notification } from '../types';
import { FeedbackContext } from '../App';

interface CompanyAdminDashboardProps {
  user: AuthUser;
}

const CompanyAdminDashboard: React.FC<CompanyAdminDashboardProps> = ({ user }) => {
  const { showFeedback } = useContext(FeedbackContext);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mrs, setMrs] = useState<MedicalRep[]>([]);
  const [mrScores, setMrScores] = useState<Map<string, MRScore>>(new Map());
  const [allApps, setAllApps] = useState<PassApplication[]>([]);
  const [allPasses, setAllPasses] = useState<IssuedPass[]>([]);
  const [cancellationRequests, setCancellationRequests] = useState<SessionCancellationRequest[]>([]);
  const [company, setCompany] = useState<PharmaCompany | null>(null);
  const [activeTab, setActiveTab] = useState<'staff' | 'profile' | 'cancellations' | 'notifications'>('staff');
  const [profileTab, setProfileTab] = useState<'info' | 'security'>('info');
  const [searchTerm, setSearchTerm] = useState('');
  const [passwordData, setPasswordData] = useState({ new: '', confirm: '' });
  const [isMRModalOpen, setIsMRModalOpen] = useState(false);
  const [editingMR, setEditingMR] = useState<(Partial<MedicalRep> & { confirmPassword?: string }) | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedMR, setLastSavedMR] = useState<MedicalRep | null>(null);
  
  const [summaryMR, setSummaryMR] = useState<MedicalRep | null>(null);
  const [editingProfile, setEditingProfile] = useState<PharmaCompany | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [selectedMRScore, setSelectedMRScore] = useState<{ mr: MedicalRep; score: MRScore } | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    refreshData();
    loadNotifications();
    const timer = setInterval(loadNotifications, 10000);
    return () => clearInterval(timer);
  }, []);

  const loadNotifications = async () => {
    try {
      const notifs = await NotificationService.getNotifications(user.id);
      setNotifications(notifs);
    } catch (err) {
      console.error('Error loading company notifications:', err);
    }
  };

  const refreshData = async () => {
    const allCompanies = await storageService.getCompanies();
    const myCompany = allCompanies.find(c => c.id === user.companyId);
    if (myCompany) {
      setCompany(myCompany);
      setEditingProfile(myCompany);
      const allMRs = await storageService.getMRs();
      setMrs(allMRs.filter(m => m.companyName === myCompany.name));
      const companyMRs = allMRs.filter(m => m.companyName === myCompany.name);
      setMrs(companyMRs);
      
      // Fetch scores for all company MRs
      const allScores = await ScoringService.getAllMRScores();
      const scoreMap = new Map<string, MRScore>();
      companyMRs.forEach(mr => {
        const score = allScores.find(s => s.mrId === mr.id);
        if (score) {
          scoreMap.set(mr.id, score);
        }
      });
      setMrScores(scoreMap);
      
      // Fetch cancellation requests for this company
      const requests = await storageService.getCancellationRequests({ companyId: myCompany.id });
      console.log('[CompanyAdminDashboard] Fetched cancellation requests:', {
        companyId: myCompany.id,
        companyName: myCompany.name,
        requestCount: requests.length,
        requests: requests.map(r => ({ id: r.id, status: r.status, mrId: r.mrId }))
      });
      setCancellationRequests(requests);
    }
    setAllApps(await storageService.getApplications());
    setAllPasses(await storageService.getPasses());
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showFeedback("Copied to clipboard");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingMR(prev => ({ ...prev, slcpiPhoto: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveMR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMR?.fullName || !editingMR?.email || !editingMR?.mobileNumber || !editingMR?.loginId || !editingMR?.identificationNumber || !editingMR?.slcpiId || !editingMR?.slcpiExpiry || !company) {
      showFeedback("Required fields missing. Please fill all fields including email and SLCPI details.", "error");
      return;
    }
    
    // CRITICAL FIX: Password is required for new profiles
    if (!editingMR?.id && !editingMR?.password) {
      showFeedback("Password is required for new staff members.", "error");
      return;
    }

    // Password confirmation check
    if (editingMR?.password && editingMR.password !== editingMR.confirmPassword) {
      showFeedback("Passwords do not match.", "error");
      return;
    }
    // Password is saved as-is; no confirmation check needed here

    // Password length check
    if (editingMR?.password && editingMR.password.length < 6) {
      showFeedback("Password must be at least 6 characters.", "error");
      return;
    }

    setIsSaving(true);

    const allMRs = await storageService.getMRs();
    // Check for duplicate loginId or mobileNumber globally
    const duplicate = allMRs.find(m => (m.loginId === editingMR.loginId || m.mobileNumber === editingMR.mobileNumber) && m.id !== editingMR.id);
    if (duplicate) {
      showFeedback("Mobile Number / Login ID is already taken in the system.", "error");
      setIsSaving(false);
      return;
    }

    const mrData: MedicalRep = {
      ...(editingMR.id ? { id: editingMR.id } : {}),
      fullName: editingMR.fullName,
      email: editingMR.email,
      companyName: company.name,
      companyId: company.id, // CRITICAL: Link to the company admin's company
      mrId: editingMR.mrId || `SLCPI-${Math.floor(10000 + Math.random() * 90000)}`,
      loginId: editingMR.loginId,
      mobileNumber: editingMR.mobileNumber,
      password: editingMR.password || undefined, // Password is validated above for new MRs 
      identificationNumber: editingMR.identificationNumber || '',
      slcpiId: editingMR.slcpiId || '',
      slcpiPhoto: editingMR.slcpiPhoto,
      slcpiExpiry: editingMR.slcpiExpiry,
      status: (editingMR.status as any) || 'active',
      createdAt: editingMR.createdAt || new Date().toISOString()
    } as MedicalRep;

    try {
      // If updating an existing MR and a new password is provided, use the specialized updatePassword service
      if (editingMR.id && editingMR.password) {
        await storageService.updatePassword(editingMR.id, editingMR.password.trim());
        // Remove password from mrData to avoid redundant update in saveMRs
        delete mrData.password;
      }

      const savedMRs = await storageService.saveMRs([mrData]);
      const savedMR = savedMRs?.[0];
      
      await refreshData();
      if (editingMR.id) {
        setIsMRModalOpen(false);
        setEditingMR(null);
        showFeedback(`Updated profile for ${mrData.fullName}`);
      } else {
        setLastSavedMR(savedMR || mrData); 
        showFeedback(`Successfully registered ${mrData.fullName}`, 'success');
      }
    } catch (err: any) {
      console.error("Save MR error:", err);
      showFeedback(err.message || "Failed to save representative.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const closeModal = () => {
    setLastSavedMR(null);
    setIsMRModalOpen(false);
    setEditingMR(null);
  };

  const handleSaveProfile = async () => {
    if (!editingProfile) return;
    const allCompanies = await storageService.getCompanies();
    const updated = allCompanies.map(c => c.id === editingProfile.id ? editingProfile : c);
    await storageService.saveCompanies(updated);
    setCompany(editingProfile);
    showFeedback("Company profile updated successfully.");
  };

  const toggleMRStatus = async (id: string) => {
    const allMRs = await storageService.getMRs();
    const target = allMRs.find(m => m.id === id);
    if (!target) return;

    const newStatus = target.status === 'active' ? 'suspended' : 'active';
    const updated = allMRs.map(m => m.id === id ? { ...m, status: newStatus as any } : m);
    await storageService.saveMRs(updated);
    await refreshData();
    showFeedback(`Representative is now ${newStatus}`, newStatus === 'active' ? 'success' : 'error');
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
      setPasswordData({ new: '', confirm: '' });
    } catch (error) {
      console.error("Password update failed:", error);
      showFeedback("Failed to update password.", "error");
    }
  };

  const getMRStats = (mrId: string) => {
    const mrPasses = allPasses.filter(p => p.mrId === mrId && p.entryStatus === 'entered');
    return { visits: mrPasses.length };
  };

  const handleApproveCancellation = async (requestId: string) => {
    setIsSaving(true);
    try {
      const result = await storageService.approveCancellation(requestId, user.id);
      if (result.success) {
        showFeedback(result.message, "success");
        await refreshData();
      } else {
        showFeedback(result.message, "error");
      }
    } catch (err) {
      console.error("Approve Cancellation Error:", err);
      showFeedback("Failed to approve cancellation.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRejectCancellation = async (requestId: string) => {
    setIsSaving(true);
    try {
      const result = await storageService.rejectCancellation(requestId, user.id);
      if (result.success) {
        showFeedback(result.message, "success");
        await refreshData();
      } else {
        showFeedback(result.message, "error");
      }
    } catch (err) {
      console.error("Reject Cancellation Error:", err);
      showFeedback("Failed to reject cancellation.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredMRs = mrs.filter(m => 
    m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.loginId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.mrId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Score Info Modal */}
      {showScoreModal && selectedMRScore && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-md w-full animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                Score Report
              </h3>
              <button onClick={() => setShowScoreModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* MR Info */}
            <div className="mb-6 pb-6 border-b border-slate-200">
              <p className="text-sm font-bold text-slate-600 mb-2">Medical Representative</p>
              <p className="text-xl font-black text-slate-800">{selectedMRScore.mr.fullName}</p>
              <p className="text-xs text-slate-500 font-bold mt-1">{selectedMRScore.mr.loginId}</p>
            </div>

            {/* Main Score Display */}
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 rounded-2xl shadow-lg border border-indigo-500 mb-6">
              <div className="text-center mb-4">
                <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-2">Current Priority Score</p>
                <p className="text-5xl font-black text-white tracking-tight">{selectedMRScore.score.priorityScore}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/20 text-center">
                  <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-1">Credit Points</p>
                  <p className="text-3xl font-black text-white">{selectedMRScore.score.credit}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/20 text-center">
                  <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-1">Days to Reset</p>
                  <p className="text-3xl font-black text-white">{ScoringService.getDaysUntilReset(selectedMRScore.score)}</p>
                </div>
              </div>
              <p className="text-[9px] text-indigo-100 mt-4 italic leading-relaxed">
                Score resets every 14 days with formula: new_score = old_score ÷ 4. Credit is used for tie-breaking when scores are equal.
              </p>
            </div>

            {/* Scoring Rules */}
            <div className="space-y-3">
              <div className="bg-green-50 p-4 rounded-2xl border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-[9px] font-black text-green-700 uppercase tracking-widest">Session Attended</p>
                </div>
                <p className="text-lg font-black text-green-700">+5 pts</p>
                <p className="text-[8px] text-green-600 mt-1">Per successful entry</p>
              </div>
              <div className="bg-red-50 p-4 rounded-2xl border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <p className="text-[9px] font-black text-red-700 uppercase tracking-widest">Session Missed</p>
                </div>
                <p className="text-lg font-black text-red-700">-15 pts</p>
                <p className="text-[8px] text-red-600 mt-1">Per expired pass</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest">No Application Day</p>
                </div>
                <p className="text-lg font-black text-amber-700">-1 pt</p>
                <p className="text-[8px] text-amber-600 mt-1">For each day without applying</p>
              </div>
            </div>

            <button 
              onClick={() => setShowScoreModal(false)}
              className="w-full mt-6 px-4 py-3 bg-indigo-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Content Tabs */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit gap-1 overflow-x-auto max-w-full">
        <button onClick={() => setActiveTab('staff')} className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'staff' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Users className="h-4 w-4" /> My Staff</button>
        <button onClick={() => setActiveTab('cancellations')} className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'cancellations' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><XCircle className="h-4 w-4" /> Cancellations {cancellationRequests.filter(r => r.status === 'pending').length > 0 && <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-black">{cancellationRequests.filter(r => r.status === 'pending').length}</span>}</button>
        <button onClick={() => setActiveTab('notifications')} className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'notifications' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Bell className="h-4 w-4" /> Notifications {notifications.filter(n => !n.read).length > 0 && <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-black">{notifications.filter(n => !n.read).length}</span>}</button>
        <button onClick={() => setActiveTab('profile')} className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'profile' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><User className="h-4 w-4" /> Company Profile</button>
      </div>

      {activeTab === 'profile' && company && (
        <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex gap-1 mb-8 bg-slate-100 p-1 rounded-xl w-fit">
              <button onClick={() => setProfileTab('info')} className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${profileTab === 'info' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>COMPANY INFO</button>
              <button onClick={() => setProfileTab('security')} className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${profileTab === 'security' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>SECURITY & ACCESS</button>
            </div>

            {profileTab === 'info' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1 ml-1">Company Name</label>
                    <input type="text" value={editingProfile?.name || ''} readOnly className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1 ml-1">Company Code</label>
                    <input type="text" value={editingProfile?.companyCode || ''} readOnly className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1 ml-1">Contact Email</label>
                    <input type="email" value={editingProfile?.contactEmail || ''} onChange={e => setEditingProfile(prev => prev ? {...prev, contactEmail: e.target.value} : null)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </div>
                <button onClick={handleSaveProfile} className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                  <Save className="h-5 w-5" /> UPDATE PROFILE
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                  <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-amber-900">Security Protocol</p>
                    <p className="text-[10px] text-amber-700 leading-relaxed">Updating your password will require you to log in again on your next session. Ensure you use a strong, unique password.</p>
                  </div>
                </div>
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1 ml-1">New Password</label>
                    <input required type="password" value={passwordData.new} onChange={e => setPasswordData({...passwordData, new: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1 ml-1">Confirm Password</label>
                    <input required type="password" value={passwordData.confirm} onChange={e => setPasswordData({...passwordData, confirm: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="••••••••" />
                  </div>
                  <button type="submit" className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2">
                    <Key className="h-5 w-5" /> CHANGE PASSWORD
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <Bell className="h-6 w-6 text-indigo-600" />
                <h3 className="font-black text-slate-800 text-lg">Company Notifications</h3>
              </div>
              <p className="text-xs text-slate-400 font-bold mt-1">Manage system alerts and pending staff cancellation requests</p>
            </div>
            {notifications.filter(n => !n.read).length > 0 && (
              <button
                onClick={async () => {
                  try {
                    await NotificationService.markAllAsRead(user.id);
                    setNotifications(notifications.map(n => ({ ...n, read: true })));
                    showFeedback("All notifications marked as read.", "success");
                  } catch (err) {
                    showFeedback("Failed to mark all as read.", "error");
                  }
                }}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-20 text-center opacity-30">
                <Bell className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No notifications</p>
              </div>
            ) : (
              notifications.map(notif => {
                // Find if there's an associated cancellation request
                const associatedRequest = notif.type === 'cancellation_request' 
                  ? cancellationRequests.find(r => r.id === notif.relatedId)
                  : null;
                const isPending = associatedRequest?.status === 'pending';

                return (
                  <div 
                    key={notif.id} 
                    className={`p-6 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4 relative group ${
                      !notif.read ? 'bg-indigo-50/20' : ''
                    } ${isPending ? 'border-l-4 border-amber-500' : ''}`}
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        notif.type === 'cancellation_request' 
                          ? 'bg-amber-50 text-amber-600' 
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {notif.type === 'cancellation_request' ? <AlertTriangle className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {!notif.read && <span className="w-2 h-2 bg-indigo-600 rounded-full shrink-0"></span>}
                          <h4 className="font-black text-slate-800 text-sm leading-snug">{notif.title}</h4>
                        </div>
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">{notif.message}</p>
                        
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[9px] text-slate-400 font-bold">
                            {new Date(notif.createdAt).toLocaleString()}
                          </span>
                          {associatedRequest && (
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                              associatedRequest.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                              associatedRequest.status === 'approved' ? 'bg-green-100 text-green-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              Status: {associatedRequest.status}
                            </span>
                          )}
                        </div>

                        {/* Direct Action Buttons for Cancellation Requests */}
                        {isPending && associatedRequest && (
                          <div className="flex gap-3 mt-4 max-w-md">
                            <button
                              onClick={async () => {
                                setIsSaving(true);
                                try {
                                  const result = await storageService.approveCancellation(associatedRequest.id, user.id);
                                  if (result.success) {
                                    showFeedback(result.message, "success");
                                    await refreshData();
                                    await loadNotifications();
                                  } else {
                                    showFeedback(result.message, "error");
                                  }
                                } catch (err) {
                                  console.error("Approve Cancellation Error:", err);
                                  showFeedback("Failed to approve cancellation.", "error");
                                } finally {
                                  setIsSaving(false);
                                }
                              }}
                              disabled={isSaving}
                              className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-green-200"
                            >
                              <CheckCircle className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button
                              onClick={async () => {
                                const reason = prompt("Enter reason for rejection:") || undefined;
                                setIsSaving(true);
                                try {
                                  const result = await storageService.rejectCancellation(associatedRequest.id, user.id, reason);
                                  if (result.success) {
                                    showFeedback(result.message, "success");
                                    await refreshData();
                                    await loadNotifications();
                                  } else {
                                    showFeedback(result.message, "error");
                                  }
                                } catch (err) {
                                  console.error("Reject Cancellation Error:", err);
                                  showFeedback("Failed to reject cancellation.", "error");
                                } finally {
                                  setIsSaving(false);
                                }
                              }}
                              disabled={isSaving}
                              className="flex-1 py-2 px-4 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-red-200"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-start">
                      {!notif.read && (
                        <button
                          onClick={async () => {
                            try {
                              await NotificationService.markAsRead(notif.id);
                              setNotifications(notifications.map(n => n.id === notif.id ? { ...n, read: true } : n));
                            } catch (err) {
                              showFeedback("Failed to mark as read.", "error");
                            }
                          }}
                          className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          Mark read
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          try {
                            await NotificationService.deleteNotification(notif.id);
                            setNotifications(notifications.filter(n => n.id !== notif.id));
                            showFeedback("Notification deleted.");
                          } catch (err) {
                            showFeedback("Failed to delete notification.", "error");
                          }
                        }}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {activeTab === 'cancellations' && (
        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 border-b border-slate-50">
            <div className="flex items-center gap-3 mb-2">
              <XCircle className="h-6 w-6 text-red-600" />
              <h3 className="font-black text-slate-800 text-lg">Session Cancellation Requests</h3>
            </div>
            <p className="text-xs text-slate-400 font-bold mt-1">Review and approve/reject cancellation requests from your MRs</p>
          </div>

          <div className="divide-y divide-slate-50">
            {cancellationRequests.length === 0 ? (
              <div className="p-20 text-center opacity-30">
                <CheckCircle className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No cancellation requests</p>
              </div>
            ) : (
              cancellationRequests.map(request => {
                const mr = mrs.find(m => m.id === request.mrId);
                const hospital = allApps.find(a => a.id === request.applicationId)?.hospitalId;
                
                return (
                  <div key={request.id} className="p-6 hover:bg-slate-50/50 transition-colors group">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-red-100 transition-colors">
                          <User className="h-6 w-6 text-slate-400 group-hover:text-red-600 transition-colors" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-black text-slate-800">{mr?.fullName || 'Unknown MR'}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded">
                              {mr?.mrId || 'N/A'}
                            </span>
                            <span className="text-[10px] font-black text-indigo-600 uppercase bg-indigo-50 px-2 py-1 rounded">
                              {request.session}
                            </span>
                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${
                              request.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                              request.status === 'approved' ? 'bg-green-50 text-green-700' :
                              'bg-red-50 text-red-700'
                            }`}>
                              {request.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right text-xs text-slate-400 font-bold">
                        <div>Requested: {new Date(request.requestedAt).toLocaleDateString()}</div>
                        {request.respondedAt && <div className="text-slate-500">Responded: {new Date(request.respondedAt).toLocaleDateString()}</div>}
                      </div>
                    </div>

                    {request.cancellationReason && (
                      <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Cancellation Reason</p>
                        <p className="text-sm text-slate-700">{request.cancellationReason}</p>
                      </div>
                    )}

                    {request.status === 'pending' && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleApproveCancellation(request.id)}
                          disabled={isSaving}
                          className="flex-1 py-3 bg-green-50 text-green-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-100 transition-all border border-green-200 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <CheckCircle className="h-4 w-4" /> Approve Cancellation
                        </button>
                        <button
                          onClick={() => handleRejectCancellation(request.id)}
                          disabled={isSaving}
                          className="flex-1 py-3 bg-red-50 text-red-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all border border-red-200 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" /> Reject Request
                        </button>
                      </div>
                    )}

                    {request.status !== 'pending' && (
                      <div className="p-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-center bg-slate-50 border border-slate-100 text-slate-600">
                        {request.status === 'approved' ? '✓ Cancellation Approved - Next waiting list candidate promoted' : '✗ Request Rejected - Pass remains valid'}
                        {request.responseReason && <p className="text-slate-500 mt-1">{request.responseReason}</p>}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {activeTab === 'staff' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl flex flex-col justify-between relative overflow-hidden group">
              <Briefcase className="absolute -right-4 -bottom-4 h-24 w-24 opacity-10 group-hover:scale-110 transition-transform" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Pharmaceutical Partner</p>
                <h3 className="text-2xl font-black truncate">{company?.name || "Loading..."}</h3>
              </div>
              <p className="text-[10px] font-bold mt-4 bg-indigo-500/30 w-fit px-2 py-1 rounded">Code: {company?.companyCode}</p>
            </div>
            
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Staff Deployment</p>
                <h3 className="text-3xl font-black text-slate-800">{mrs.filter(m => m.status === 'active').length} <span className="text-sm text-slate-400 font-bold uppercase">Active</span></h3>
              </div>
              <div className="flex items-center gap-2 mt-4">
                 <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 transition-all duration-1000" 
                      style={{ width: `${(mrs.filter(m => m.status === 'active').length / Math.max(mrs.length, 1)) * 100}%` }}
                    />
                 </div>
                 <span className="text-[10px] font-black text-slate-400">{mrs.length} Total</span>
              </div>
            </div>

            <button 
              onClick={() => { setEditingMR({ status: 'active', password: 'mr' + Math.floor(100+Math.random()*900) }); setIsMRModalOpen(true); }}
              className="bg-indigo-50 text-indigo-600 py-6 rounded-3xl border-2 border-dashed border-indigo-200 font-black text-sm flex flex-col items-center justify-center gap-2 hover:bg-indigo-100 hover:border-indigo-400 transition-all active:scale-95 group"
            >
              <div className="bg-white p-2 rounded-xl shadow-sm group-hover:shadow-md transition-all">
                <UserPlus className="h-6 w-6" />
              </div>
              ADD REPRESENTATIVE
            </button>
          </div>

          <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
               <h3 className="font-black text-slate-800 flex items-center gap-2">
                 <ShieldCheck className="h-5 w-5 text-indigo-600" />
                 Staff Registry
               </h3>
               <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search name, ID or login..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
               </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 bg-slate-50/30">
                    <th className="px-6 py-4">Full Identity</th>
                    <th className="px-6 py-4">System IDs</th>
                    <th className="px-6 py-4">Login ID (Mobile)</th>
                    <th className="px-6 py-4">Score Info</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredMRs.map(mr => (
                    <tr key={mr.id} className="hover:bg-indigo-50/10 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                             <User className="h-5 w-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                           </div>
                           <div>
                              <p className="font-black text-slate-800 text-sm leading-tight">{mr.fullName}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">{mr.identificationNumber || 'NIC Pending'}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                           <div className="flex items-center gap-1.5">
                              <ShieldCheck className="h-3 w-3 text-indigo-400" />
                              <span className="text-[10px] font-black text-slate-700 uppercase">{mr.mrId}</span>
                           </div>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">SLCPI: {mr.slcpiId || '--'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 group/login">
                           <div className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">
                             <p className="text-[10px] font-mono font-black text-indigo-600 tracking-tighter">{mr.loginId}</p>
                           </div>
                           <button 
                             onClick={() => handleCopy(mr.loginId, `login-${mr.id}`)}
                             className="opacity-0 group-hover/login:opacity-100 p-1.5 hover:bg-indigo-100 rounded-md transition-all"
                           >
                             {copiedId === `login-${mr.id}` ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-slate-400" />}
                           </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => {
                            const score = mrScores.get(mr.id);
                            if (score) {
                              setSelectedMRScore({ mr, score });
                              setShowScoreModal(true);
                            }
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors font-bold text-[10px] uppercase tracking-widest"
                        >
                          <Info className="h-4 w-4" />
                          View Score
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                          mr.status === 'active' 
                            ? 'bg-green-100 text-green-700 shadow-sm shadow-green-100 animate-pulse' 
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {mr.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                           <button 
                             onClick={() => setSummaryMR(mr)} 
                             title="Engagement Statistics"
                             className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                           >
                             <BarChart3 className="h-4 w-4" />
                           </button>
                           <button 
                             onClick={() => { setEditingMR(mr); setIsMRModalOpen(true); }} 
                             title="Edit Profile"
                             className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                           >
                             <Edit3 className="h-4 w-4" />
                           </button>
                           <button 
                             onClick={() => toggleMRStatus(mr.id)} 
                             title={mr.status === 'active' ? 'Suspend Access' : 'Restore Access'}
                             className={`p-2 rounded-xl transition-all ${
                               mr.status === 'active' 
                                 ? 'text-slate-300 hover:text-red-500 hover:bg-red-50' 
                                 : 'text-green-500 hover:bg-green-50'
                             }`}
                           >
                             <Power className="h-4 w-4" />
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredMRs.length === 0 && (
                    <tr>
                       <td colSpan={5} className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center opacity-30">
                            <Users className="h-12 w-12 text-slate-200 mb-4" />
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No staff records matching search</p>
                          </div>
                       </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Summary Modal */}
      {summaryMR && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in zoom-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Representative Engagement</h3>
              <button onClick={() => setSummaryMR(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                 <div className="w-16 h-16 bg-white rounded-2xl border border-indigo-100 flex items-center justify-center shadow-sm">
                   <User className="h-8 w-8 text-indigo-600" />
                 </div>
                 <div>
                    <h4 className="text-xl font-black text-slate-800">{summaryMR.fullName}</h4>
                    <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">{summaryMR.companyName}</p>
                 </div>
              </div>
              
               <div className="grid grid-cols-2 gap-3 pt-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase">Official ID</p><p className="font-bold text-slate-800">{summaryMR.mrId}</p></div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase">Mobile</p><p className="font-bold text-slate-800">{summaryMR.mobileNumber}</p></div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase">SLCPI ID</p><p className="font-bold text-slate-800">{summaryMR.slcpiId || 'N/A'}</p></div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase">Successful Visits</p><p className="text-2xl font-black text-indigo-600">{getMRStats(summaryMR.id).visits}</p></div>
              </div>

              {summaryMR.slcpiPhoto && (
                <div className="rounded-2xl overflow-hidden border border-slate-100 mt-4 bg-slate-50 p-2">
                   <p className="text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Compliance Document</p>
                   <img src={summaryMR.slcpiPhoto} className="w-full object-contain max-h-48 rounded-xl" alt="SLCPI" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Register/Edit Modal */}
      {isMRModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-xl font-bold">{editingMR?.id ? 'Update Representative Profile' : 'Register New Staff Member'}</h3>
              <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            
            {lastSavedMR ? (
              <div className="p-12 text-center animate-in zoom-in duration-300">
                 <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="h-10 w-10 text-green-600" />
                 </div>
                 <h4 className="text-2xl font-black text-slate-800 mb-2">Registration Successful</h4>
                 <p className="text-slate-500 font-medium mb-8">Staff member <span className="text-indigo-600 font-bold">{lastSavedMR.fullName}</span> has been deployed to the system.</p>
                 <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 text-left w-full mb-8">
                    <p className="text-[10px] font-black text-indigo-400 uppercase mb-4 tracking-widest">Initial System Credentials</p>
                    <div className="space-y-3">
                       <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                          <div className="flex items-center gap-2">
                             <User className="h-4 w-4 text-slate-400" />
                             <span className="text-xs font-bold text-slate-500 uppercase">Login ID (Mobile)</span>
                          </div>
                          <p className="text-sm font-black font-mono text-indigo-600">{lastSavedMR.mobileNumber}</p>
                       </div>
                       <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                          <div className="flex items-center gap-2">
                             <Key className="h-4 w-4 text-slate-400" />
                             <span className="text-xs font-bold text-slate-500 uppercase">Password</span>
                          </div>
                          <p className="text-sm font-black font-mono text-indigo-600">{lastSavedMR.password}</p>
                       </div>
                    </div>
                    <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100 flex items-start gap-2">
                       <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                       <p className="text-[10px] text-amber-800 font-medium leading-relaxed">Please provide these credentials to the representative. They can log in immediately to apply for hospital passes.</p>
                    </div>
                 </div>
                 <button onClick={closeModal} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs">
                    RETURN TO REGISTRY <ArrowRight className="h-4 w-4" />
                 </button>
              </div>
            ) : (
              <form onSubmit={handleSaveMR} className="p-8 space-y-8 max-h-[85vh] overflow-y-auto">
                <div className="space-y-6">
                  {/* Section 1: Identity */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <User className="h-4 w-4 text-indigo-500" />
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Personal Identity</p>
                    </div>
                    <input required type="text" value={editingMR?.fullName || ''} onChange={e => setEditingMR({...editingMR, fullName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Full Legal Name" />
                    <input required type="email" value={editingMR?.email || ''} onChange={e => setEditingMR({...editingMR, email: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Email Address (for notifications)" />
                    <div className="grid grid-cols-2 gap-4">
                      <input required type="text" value={editingMR?.mobileNumber || ''} onChange={e => setEditingMR({...editingMR, mobileNumber: e.target.value, loginId: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Contact Mobile" />
                      <input required type="text" value={editingMR?.identificationNumber || ''} onChange={e => setEditingMR({...editingMR, identificationNumber: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="National ID / NIC" />
                    </div>
                  </div>

                  {/* Section 2: Credentials */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <Key className="h-4 w-4 text-indigo-500" />
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Login Credentials</p>
                    </div>
                    {editingMR?.id && (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex gap-2 mb-2">
                        <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
                        <p className="text-[10px] text-amber-700 leading-relaxed font-medium">Updating the representative's password will require them to log in again with the new credentials.</p>
                      </div>
                    )}
                    <div className="space-y-4">
                      <div className="relative">
                         <input required type="text" value={editingMR?.mobileNumber || ''} onChange={e => setEditingMR({...editingMR, mobileNumber: e.target.value, loginId: e.target.value})} className="w-full px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Mobile Number (Login ID)" />
                         <ShieldCheck className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-300" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input required={!editingMR?.id} type="password" value={editingMR?.password || ''} onChange={e => setEditingMR({...editingMR, password: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder={editingMR?.id ? "Set New Password (Optional)" : "System Password"} />
                        <input required={!editingMR?.id && !!editingMR?.password} type="password" value={editingMR?.confirmPassword || ''} onChange={e => setEditingMR({...editingMR, confirmPassword: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Confirm Password" />
                        {/* Confirm Password field - for local validation only, not stored */}
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Compliance */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <ShieldCheck className="h-4 w-4 text-indigo-500" />
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Professional Compliance</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <input required type="text" value={editingMR?.slcpiId || ''} onChange={e => setEditingMR({...editingMR, slcpiId: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="SLCPI Number" />
                      <div className="relative">
                        <input required type="date" value={editingMR?.slcpiExpiry || ''} onChange={e => setEditingMR({...editingMR, slcpiExpiry: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all relative group/upload ${
                        editingMR?.slcpiPhoto 
                          ? 'border-indigo-200 bg-indigo-50/30' 
                          : 'border-slate-200 bg-slate-50 hover:border-indigo-400 hover:bg-white shadow-inner'
                      }`}
                    >
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                      {editingMR?.slcpiPhoto ? (
                        <div className="relative inline-block">
                           <img src={editingMR.slcpiPhoto} className="h-32 mx-auto rounded-lg shadow-md" alt="Preview" />
                           <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover/upload:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                              <p className="text-white text-[10px] font-black">CHANGE PHOTO</p>
                           </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <div className="p-3 bg-white rounded-2xl shadow-sm mb-3 text-slate-400 group-hover:text-indigo-600 transition-colors">
                            <Upload className="h-6 w-6" />
                          </div>
                          <p className="text-xs font-black text-slate-500">UPLOAD SLCPI ID PHOTO</p>
                          <p className="text-[10px] text-slate-400 mt-1">Required for hospital gate verification</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Activity className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  {editingMR?.id ? 'COMMIT PROFILE UPDATES' : 'FINALIZE REGISTRATION'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyAdminDashboard;
