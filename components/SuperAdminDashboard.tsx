
import React, { useState, useEffect, useContext } from 'react';
import { 
  Building2, Users, Settings, Plus, Power, Activity, Edit3, Trash2, X, 
  Briefcase, Clock, User, ShieldCheck, Lock, Key, Image as ImageIcon, 
  CheckCircle, TrendingUp, AlertTriangle, Info, Calendar, Mail, Phone, Eye, EyeOff, MapPin, CreditCard
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { Hospital, PharmaCompany, MedicalRep, HospitalUser, PassApplication, IssuedPass, AuthUser } from '../types';
import { FeedbackContext } from '../App';

interface SuperAdminDashboardProps {
  user: AuthUser;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ user }) => {
  const { showFeedback } = useContext(FeedbackContext);
  
  // Data States
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [companies, setCompanies] = useState<PharmaCompany[]>([]);
  const [mrs, setMrs] = useState<MedicalRep[]>([]);
  const [apps, setApps] = useState<PassApplication[]>([]);
  const [passes, setPasses] = useState<IssuedPass[]>([]);
  
  // UI States
  const [activeTab, setActiveTab] = useState<'hospitals' | 'companies' | 'monitoring' | 'health' | 'profile'>('hospitals');
  
  // Audit State
  const [auditData, setAuditData] = useState<any[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);

  // Password Update State
  const [passwordData, setPasswordData] = useState({ new: '', confirm: '' });

  // Hospital Modal States
  const [isHospitalModalOpen, setIsHospitalModalOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Partial<Hospital> | null>(null);
  const [adminData, setAdminData] = useState({ fullName: '', mobileNumber: '', password: '' });
  const [securityData, setSecurityData] = useState({ fullName: '', mobileNumber: '', password: '' });
  const [showPasswords, setShowPasswords] = useState(false);

  // Company Modal States
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Partial<PharmaCompany> | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedMR, setSelectedMR] = useState<MedicalRep | null>(null);

  useEffect(() => {
    refreshData();
  }, []);

  const runAudit = async () => {
    setIsAuditing(true);
    try {
      const response = await fetch('/api/admin/audit-users');
      const data = await response.json();
      setAuditData(data);
      showFeedback("System audit completed. Security signatures verified.");
    } catch (err) {
      showFeedback("Audit failed. Check server connectivity.", "error");
    } finally {
      setIsAuditing(false);
    }
  };

  const refreshData = async () => {
    setHospitals(await storageService.getHospitals());
    setCompanies(await storageService.getCompanies());
    setMrs(await storageService.getMRs());
    setApps(await storageService.getApplications());
    setPasses(await storageService.getPasses());
    if (activeTab === 'health') runAudit();
  };

  useEffect(() => {
    if (activeTab === 'health') runAudit();
  }, [activeTab]);

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

  const handleSaveHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHospital?.name) return;
    
    // CRITICAL FIX: New hospitals must have admin credentials
    if (!editingHospital.id) {
      if (!adminData.fullName || !adminData.mobileNumber || !adminData.password) {
        showFeedback("New facility requires: Admin name, mobile number, and password", "error");
        return;
      }
      if (!securityData.fullName || !securityData.mobileNumber || !securityData.password) {
        showFeedback("New facility requires: Security name, mobile number, and password", "error");
        return;
      }
    }
    
    // Omit ID if it's a new record to let Postgres generate a UUID
    const hospitalData: Hospital = {
      ...(editingHospital.id ? { id: editingHospital.id } : {}),
      name: editingHospital.name || '',
      address: editingHospital.address || '',
      email: editingHospital.email || '',
      mobileNumber: editingHospital.mobileNumber || '',
      isActive: editingHospital.isActive ?? true,
      supportedSessions: editingHospital.supportedSessions || ['MORNING', 'EVENING', 'FULL_DAY'],
      passLimits: editingHospital.passLimits || { 'MORNING': 10, 'EVENING': 10, 'FULL_DAY': 5 },
      sessionWindows: editingHospital.sessionWindows || { 
        'MORNING': { start: '08:00', end: '10:00' },
        'EVENING': { start: '16:00', end: '18:00' },
        'FULL_DAY': { start: '08:00', end: '18:00' }
      },
      entryWindows: editingHospital.entryWindows || { 
        'MORNING': { start: '08:00', end: '12:00' },
        'EVENING': { start: '16:00', end: '20:00' },
        'FULL_DAY': { start: '08:00', end: '20:00' }
      },
    } as Hospital;
    
    // We need the ID back from the database to create user accounts
    const savedHospitals = await storageService.saveHospitals([hospitalData]);
    const savedHospital = savedHospitals?.[0];
    
    if (savedHospital) {
      const hospitalId = savedHospital.id;
      // Save Hospital User Accounts
      const hospitalUsers = await storageService.getHospitalUsers();
      
      const adminId = editingHospital.id ? (hospitalUsers.find(user => user.hospitalId === hospitalId && user.role === 'ADMIN')?.id) : undefined;
      const securityId = editingHospital.id ? (hospitalUsers.find(user => user.hospitalId === hospitalId && user.role === 'SECURITY')?.id) : undefined;

      const u: HospitalUser[] = [
        { ...(adminId ? { id: adminId } : {}), hospitalId, role: 'ADMIN', fullName: adminData.fullName, mobileNumber: adminData.mobileNumber.trim(), password: adminData.password ? adminData.password.trim() : undefined } as HospitalUser,
        { ...(securityId ? { id: securityId } : {}), hospitalId, role: 'SECURITY', fullName: securityData.fullName, mobileNumber: securityData.mobileNumber.trim(), password: securityData.password ? securityData.password.trim() : undefined } as HospitalUser
      ];
      
      try {
        await storageService.saveHospitalUsers(u);
        storageService.log('SUPER_ADMIN', 'HOSPITAL_SAVE', `Hospital: ${savedHospital.name} (ID: ${hospitalId})`);
      } catch (err: any) {
        console.error("Hospital user save error:", err);
        showFeedback(err.message || "Failed to save hospital credentials", "error");
        return;
      }
    }
    
    refreshData();
    setIsHospitalModalOpen(false);
    setEditingHospital(null);
    setAdminData({ fullName: '', mobileNumber: '', password: '' });
    setSecurityData({ fullName: '', mobileNumber: '', password: '' });
    showFeedback(editingHospital.id ? "Hospital infrastructure updated." : "New facility provisioned.");
  };

  const startEditHospital = async (h: Hospital) => {
    setEditingHospital(h);
    const users = (await storageService.getHospitalUsers()).filter(u => u.hospitalId === h.id);
    const admin = users.find(u => u.role === 'ADMIN');
    const security = users.find(u => u.role === 'SECURITY');
    
    setAdminData({ 
      fullName: admin?.fullName || '', 
      mobileNumber: admin?.mobileNumber || '', 
      password: '' // Do not populate password when editing
    });
    setSecurityData({ 
      fullName: security?.fullName || '', 
      mobileNumber: security?.mobileNumber || '', 
      password: '' // Do not populate password when editing
    });
    setIsHospitalModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany?.name || !editingCompany?.companyCode) {
      showFeedback("Company name and code are required.", "error");
      return;
    }
    
    // CRITICAL FIX: New companies must have admin credentials
    if (!editingCompany.id) {
      if (!editingCompany.adminMobile || !editingCompany.adminPassword) {
        showFeedback("New company requires: Admin mobile number and password", "error");
        return;
      }
    }

    // Omit ID for new records to allow Postgres to generate UUID
    const companyData: PharmaCompany = {
      ...(editingCompany.id ? { id: editingCompany.id } : {}),
      name: editingCompany.name || '',
      companyCode: editingCompany.companyCode || '',
      address: editingCompany.address || '',
      contactNumber: editingCompany.contactNumber || '',
      financeEmail: editingCompany.financeEmail || '',
      adminMobile: (editingCompany.adminMobile || '').trim(),
      adminPassword: editingCompany.adminPassword ? editingCompany.adminPassword.trim() : undefined,
      contactEmail: editingCompany.contactEmail || '',
      isActive: editingCompany.isActive ?? true,
    } as PharmaCompany;

    try {
      await storageService.saveCompanies([companyData]);
      storageService.log('SUPER_ADMIN', 'COMPANY_SAVE', `Company: ${companyData.name}`);
      refreshData();
      setIsCompanyModalOpen(false);
      setEditingCompany(null);
      showFeedback(`Pharmaceutical company ${companyData.name} registered.`);
    } catch (err: any) {
      console.error("Company save error:", err);
      showFeedback(err.message || "Failed to register company", "error");
    }
  };

  const toggleCompanyStatus = async (id: string) => {
    const currentCompanies = await storageService.getCompanies();
    const updated = currentCompanies.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c);
    await storageService.saveCompanies(updated);
    setCompanies(updated);
    const c = updated.find(x => x.id === id);
    showFeedback(`Company ${c?.name} is now ${c?.isActive ? 'active' : 'deactivated'}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit gap-1 overflow-x-auto max-w-full">
        <button onClick={() => setActiveTab('hospitals')} className={`px-4 md:px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'hospitals' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Building2 className="h-4 w-4" /> Hospitals</button>
        <button onClick={() => setActiveTab('companies')} className={`px-4 md:px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'companies' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Briefcase className="h-4 w-4" /> Companies</button>
        <button onClick={() => setActiveTab('monitoring')} className={`px-4 md:px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'monitoring' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Activity className="h-4 w-4" /> Monitoring</button>
        <button onClick={() => setActiveTab('health')} className={`px-4 md:px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'health' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><ShieldCheck className="h-4 w-4" /> System Health</button>
        <button onClick={() => setActiveTab('profile')} className={`px-4 md:px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'profile' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Lock className="h-4 w-4" /> Profile & Security</button>
      </div>

      {activeTab === 'hospitals' && (
        <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-bold">Facility Management</h3>
            <button 
              onClick={() => { 
                setEditingHospital({ supportedSessions: ['MORNING', 'EVENING', 'FULL_DAY'], isActive: true }); 
                setAdminData({ fullName: '', mobileNumber: '', password: '' });
                setSecurityData({ fullName: '', mobileNumber: '', password: '' });
                setIsHospitalModalOpen(true); 
              }}
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" /> PROVISION HOSPITAL
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hospitals.map(h => (
              <div key={h.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 relative group hover:shadow-md transition-all">
                <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${h.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <h4 className="font-black text-slate-800 text-lg mb-1">{h.name}</h4>
                <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mb-4"><MapPin className="h-3 w-3" /> {h.address || 'Address not set'}</p>
                <div className="space-y-2 mb-6">
                   <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                     <ShieldCheck className="h-4 w-4 text-indigo-400" /> 
                     Admin: {h.email ? 'Assigned' : 'Unassigned'}
                   </div>
                   <div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-400 tracking-widest">
                     {h.supportedSessions.join(' • ')}
                   </div>
                </div>
                <button 
                  onClick={() => startEditHospital(h)}
                  className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Edit3 className="h-3.5 w-3.5" /> CONFIGURE & ACCOUNTS
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'companies' && (
        <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-bold">Pharma Company Management</h3>
            <button 
              onClick={() => { setEditingCompany({ isActive: true }); setIsCompanyModalOpen(true); }}
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" /> NEW PARTNER
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-3">
              {companies.map(c => {
                const companyMRCount = mrs.filter(m => m.companyName === c.name).length;
                return (
                  <button 
                    key={c.id}
                    onClick={() => setSelectedCompanyId(c.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${selectedCompanyId === c.id ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-slate-800">{c.name}</h4>
                      <div className={`w-2 h-2 rounded-full ${c.isActive ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-slate-300'}`}></div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-tighter">{c.companyCode} • {companyMRCount} MRs Registered</p>
                  </button>
                );
              })}
            </div>

            <div className="lg:col-span-2">
              {selectedCompanyId ? (
                <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden animate-in fade-in duration-300">
                  <div className="bg-white p-6 border-b border-slate-100">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-black text-xl text-slate-800">{companies.find(c => c.id === selectedCompanyId)?.name}</h4>
                        <div className="mt-2 space-y-1">
                          <p className="text-xs font-bold text-slate-500 flex items-center gap-2"><MapPin className="h-3 w-3" /> {companies.find(c => c.id === selectedCompanyId)?.address || 'Address not specified'}</p>
                          <p className="text-xs font-bold text-indigo-600 flex items-center gap-2"><Mail className="h-3 w-3" /> {companies.find(c => c.id === selectedCompanyId)?.contactEmail}</p>
                          <p className="text-xs font-bold text-slate-500 flex items-center gap-2"><CreditCard className="h-3 w-3" /> Finance: {companies.find(c => c.id === selectedCompanyId)?.financeEmail || 'Not set'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => toggleCompanyStatus(selectedCompanyId)} className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border transition-colors ${companies.find(c => c.id === selectedCompanyId)?.isActive ? 'border-red-200 text-red-600 bg-red-50' : 'border-green-200 text-green-600 bg-green-50'}`}>
                           {companies.find(c => c.id === selectedCompanyId)?.isActive ? 'Deactivate' : 'Activate'}
                         </button>
                         <button onClick={() => { setEditingCompany(companies.find(c => c.id === selectedCompanyId)); setIsCompanyModalOpen(true); }} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg"><Edit3 className="h-4 w-4 text-slate-600" /></button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Representative Registry</h5>
                    <div className="space-y-2">
                       {mrs.filter(m => m.companyName === companies.find(c => c.id === selectedCompanyId)?.name).map(mr => (
                         <div key={mr.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer" onClick={() => setSelectedMR(mr)}>
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center"><User className="h-4 w-4 text-slate-400" /></div>
                               <div><p className="text-xs font-black">{mr.fullName}</p><p className="text-[9px] text-slate-400">{mr.mrId}</p></div>
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded ${mr.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{mr.status}</span>
                         </div>
                       ))}
                       {mrs.filter(m => m.companyName === companies.find(c => c.id === selectedCompanyId)?.name).length === 0 && (
                         <p className="text-center py-12 text-slate-400 italic text-xs">No MRs registered for this company yet.</p>
                       )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-slate-400">
                  <Briefcase className="h-16 w-16 mb-4 opacity-10" />
                  <p className="text-sm font-medium">Select a company from the list to view its registered representatives and management settings.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Monitoring Dashboard */}
      {activeTab === 'monitoring' && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total System MRs</p><h3 className="text-3xl font-black text-slate-800">{mrs.length}</h3></div>
             <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Active Hospitals</p><h3 className="text-3xl font-black text-slate-800">{hospitals.filter(h => h.isActive).length}</h3></div>
             <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Pass Apps</p><h3 className="text-3xl font-black text-slate-800">{apps.length}</h3></div>
             <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Gate Entries</p><h3 className="text-3xl font-black text-slate-800">{passes.filter(p => p.entryStatus === 'entered').length}</h3></div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
               <h4 className="font-black text-slate-800 mb-6 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-indigo-600" /> Recent System Traffic</h4>
               <div className="space-y-4">
                 {apps.slice(-6).reverse().map(a => {
                   const mr = mrs.find(m => m.id === a.mrId);
                   const hosp = hospitals.find(h => h.id === a.hospitalId);
                   return (
                     <div key={a.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <div className="flex items-center gap-3">
                         <div className="bg-white p-2 rounded-xl"><User className="h-4 w-4 text-slate-400" /></div>
                         <div>
                            <p className="text-xs font-black">{mr?.fullName || 'Unknown User'}</p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{hosp?.name || 'Facility Access'}</p>
                         </div>
                       </div>
                       <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${a.status === 'selected' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{a.status.toUpperCase()}</span>
                     </div>
                   );
                 })}
                 {apps.length === 0 && <p className="text-center py-10 text-slate-400 italic text-xs">No activity logged in the system yet.</p>}
               </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
               <h4 className="font-black text-slate-800 mb-6 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> System Governance</h4>
               <div className="space-y-3">
                 {mrs.filter(m => !m.slcpiPhoto).length > 0 && (
                   <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3">
                     <AlertTriangle className="h-4 w-4 text-amber-500" />
                     <p className="text-xs font-bold text-amber-800">{mrs.filter(m => !m.slcpiPhoto).length} users have missing compliance ID photos.</p>
                   </div>
                 )}
                 <div className="p-4 bg-green-50 rounded-2xl border border-green-100 flex items-center gap-3">
                   <CheckCircle className="h-4 w-4 text-green-600" />
                   <p className="text-xs font-bold text-green-800">Operational cluster health: Normal. Data synchronization active.</p>
                 </div>
                 {hospitals.some(h => !h.isActive) && (
                   <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-center gap-3">
                     <Power className="h-4 w-4 text-red-500" />
                     <p className="text-xs font-bold text-red-800">{hospitals.filter(h => !h.isActive).length} facilities are currently offline.</p>
                   </div>
                 )}
               </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'health' && (
        <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-bold">Security & Integrity Audit</h3>
              <p className="text-xs text-slate-500 font-medium">Verifying password hashing and credential health across all system nodes.</p>
            </div>
            <button 
              onClick={runAudit}
              disabled={isAuditing}
              className="bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-900 shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              {isAuditing ? <Clock className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              RUN INTEGRITY CHECK
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">User Identity</th>
                  <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">System Role</th>
                  <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Login ID</th>
                  <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Security Status</th>
                  <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody>
                {auditData.map(user => (
                  <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                          <User className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-black text-slate-700">{user.fullName}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-[9px] font-black uppercase px-2 py-1 bg-slate-100 rounded text-slate-500 tracking-tighter">
                        {user.role}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-slate-500">{user.mobile}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          user.status === 'Secure Hash' ? 'bg-green-500' : 
                          user.status === 'No Password' ? 'bg-red-500' : 'bg-amber-500'
                        }`} />
                        <span className={`text-[10px] font-bold ${
                          user.status === 'Secure Hash' ? 'text-green-600' : 
                          user.status === 'No Password' ? 'text-red-600' : 'text-amber-600'
                        }`}>{user.status}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <button 
                        onClick={() => {
                          // Logic to trigger a reset (could be a modal or direct call)
                          showFeedback(`Password reset requested for ${user.fullName}. Use the management tabs to set a new password.`, "success");
                        }}
                        className="p-2 hover:bg-indigo-50 rounded-lg text-indigo-600 transition-all"
                        title="Reset Credentials"
                      >
                        <Key className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {auditData.length === 0 && !isAuditing && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-slate-400 italic text-xs">
                      No audit data available. Click "RUN INTEGRITY CHECK" to scan the system.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'profile' && (
        <section className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-10">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tighter">Root Profile & Security</h3>
              <p className="text-xs font-black text-indigo-500 uppercase tracking-widest">System Administrator Node</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Identity Details</p>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Full Name</label>
                  <p className="text-sm font-black text-slate-800">{user.fullName}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Mobile Number</label>
                  <p className="text-sm font-black text-slate-800">{user.mobileNumber}</p>
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">System Access</p>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Role</label>
                  <p className="text-sm font-black text-indigo-600">SUPER_ADMIN</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">User ID</label>
                  <p className="text-xs font-mono text-slate-500 truncate">{user.id}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-10">
            <h4 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
              <Key className="h-5 w-5 text-indigo-600" />
              Update Credentials
            </h4>
            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">New Password</label>
                  <input 
                    type="password" 
                    required
                    value={passwordData.new}
                    onChange={e => setPasswordData({...passwordData, new: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Min. 6 characters"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confirm Password</label>
                  <input 
                    type="password" 
                    required
                    value={passwordData.confirm}
                    onChange={e => setPasswordData({...passwordData, confirm: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="Repeat new password"
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Lock className="h-4 w-4" /> Update Security Credentials
              </button>
            </form>
          </div>
        </section>
      )}

      {/* Hospital Provisioning / Edit Modal */}
      {isHospitalModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in zoom-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-xl font-bold">{editingHospital?.id ? 'Edit Facility Infrastructure' : 'New Facility Provisioning'}</h3>
              <button onClick={() => setIsHospitalModalOpen(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSaveHospital} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Basic Details</label>
                <button 
                  type="button" 
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 flex items-center gap-1 transition-all"
                >
                  {showPasswords ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showPasswords ? 'HIDE PASSWORDS' : 'SHOW PASSWORDS'}
                </button>
              </div>
              
              <div className="space-y-4">
                <input required type="text" value={editingHospital?.name || ''} onChange={e => setEditingHospital({...editingHospital, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Hospital Official Name" />
                <textarea value={editingHospital?.address || ''} onChange={e => setEditingHospital({...editingHospital, address: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none h-20" placeholder="Hospital Address" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="email" value={editingHospital?.email || ''} onChange={e => setEditingHospital({...editingHospital, email: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Contact Email" />
                  <input type="tel" value={editingHospital?.mobileNumber || ''} onChange={e => setEditingHospital({...editingHospital, mobileNumber: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Contact Mobile" />
                </div>
              </div>

              <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-indigo-900 uppercase">Management Account (Admin)</p>
                  <ShieldCheck className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input required type="text" value={adminData.fullName} onChange={e => setAdminData({...adminData, fullName: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold" placeholder="Admin Full Name" />
                  <input required type="text" value={adminData.mobileNumber} onChange={e => setAdminData({...adminData, mobileNumber: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold" placeholder="Admin Login ID" />
                  <input required={!editingHospital?.id} type={showPasswords ? "text" : "password"} value={adminData.password} onChange={e => setAdminData({...adminData, password: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold col-span-2" placeholder={editingHospital?.id ? "Set New Admin Password (leave blank to keep current)" : "Admin Password"} />
                </div>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-slate-800 uppercase">Verification Post Account (Security)</p>
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input required type="text" value={securityData.fullName} onChange={e => setSecurityData({...securityData, fullName: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold" placeholder="Guard Full Name" />
                  <input required type="text" value={securityData.mobileNumber} onChange={e => setSecurityData({...securityData, mobileNumber: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold" placeholder="Guard Login ID" />
                  <input required={!editingHospital?.id} type={showPasswords ? "text" : "password"} value={securityData.password} onChange={e => setSecurityData({...securityData, password: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold col-span-2" placeholder={editingHospital?.id ? "Set New Guard Password (leave blank to keep current)" : "Guard Password"} />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editingHospital?.isActive} onChange={e => setEditingHospital({...editingHospital, isActive: e.target.checked})} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-xs font-bold text-slate-600 uppercase">Node Active</span>
                </label>
              </div>

              <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-sm">
                {editingHospital?.id ? 'UPDATE SYSTEM ENDPOINTS' : 'PROVISION SYSTEM ENDPOINTS'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Company Registration Modal */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in zoom-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-xl font-bold">{editingCompany?.id ? 'Edit Partner Entity' : 'Register New Partner'}</h3>
              <button onClick={() => setIsCompanyModalOpen(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleSaveCompany} className="p-8 space-y-6 max-h-[85vh] overflow-y-auto">
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Company Information</label>
                    <input required type="text" value={editingCompany?.name || ''} onChange={e => setEditingCompany({...editingCompany, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Company Official Name" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Partner Code</label>
                    <input required type="text" value={editingCompany?.companyCode || ''} onChange={e => setEditingCompany({...editingCompany, companyCode: e.target.value})} className="w-full px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl font-mono font-black text-indigo-700 uppercase" placeholder="e.g. AZ-01" />
                 </div>
                 <textarea value={editingCompany?.address || ''} onChange={e => setEditingCompany({...editingCompany, address: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none h-20" placeholder="Company Address" />
                 <div className="grid grid-cols-2 gap-4">
                   <input type="tel" value={editingCompany?.contactNumber || ''} onChange={e => setEditingCompany({...editingCompany, contactNumber: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Contact Phone" />
                   <input type="email" value={editingCompany?.financeEmail || ''} onChange={e => setEditingCompany({...editingCompany, financeEmail: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Finance Email" />
                 </div>

                 <div className="pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-black text-indigo-400 uppercase mb-3">Provision Admin Account</p>
                    <div className="space-y-2">
                       <input required type="text" value={editingCompany?.adminMobile || ''} onChange={e => setEditingCompany({...editingCompany, adminMobile: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" placeholder="Admin Login ID" />
                       <input required={!editingCompany?.id} type="text" value={editingCompany?.adminPassword || ''} onChange={e => setEditingCompany({...editingCompany, adminPassword: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" placeholder={editingCompany?.id ? "Set New Admin Password (leave blank to keep current)" : "Admin Password"} />
                       <input required type="email" value={editingCompany?.contactEmail || ''} onChange={e => setEditingCompany({...editingCompany, contactEmail: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" placeholder="Official Corporate Email" />
                    </div>
                 </div>
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-sm">SAVE PARTNER ENTITY</button>
            </form>
          </div>
        </div>
      )}

      {/* MR Profile Modal (Full View for Super Admin) */}
      {selectedMR && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-xl font-bold">Root View: System MR Profile</h3>
              <button onClick={() => setSelectedMR(null)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="p-8 space-y-6 max-h-[85vh] overflow-y-auto text-center">
               <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm">
                 <User className="h-10 w-10 text-indigo-600" />
               </div>
               <div>
                  <h4 className="text-2xl font-black text-slate-800">{selectedMR.fullName}</h4>
                  <p className="text-indigo-600 font-bold text-sm tracking-wide uppercase">{selectedMR.companyName}</p>
               </div>
               
               <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">System Access ID</p><p className="font-bold text-slate-700 font-mono text-xs">{selectedMR.mrId}</p></div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">SLCPI ID</p><p className="font-bold text-slate-700 font-mono text-xs">{selectedMR.slcpiId || 'N/A'}</p></div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Mobile</p><p className="font-bold text-slate-700 text-sm">{selectedMR.mobileNumber}</p></div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">SLCPI Expiry</p><p className="font-bold text-slate-700 text-sm">{selectedMR.slcpiExpiry || 'N/A'}</p></div>
               </div>

               {selectedMR.slcpiPhoto && (
                 <div className="rounded-2xl overflow-hidden border border-slate-200 mt-4 bg-slate-50 p-2 shadow-inner">
                   <img src={selectedMR.slcpiPhoto} className="w-full object-contain max-h-48 rounded-xl" alt="ID Document" />
                 </div>
               )}

               <button onClick={() => setSelectedMR(null)} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-slate-900 transition-all uppercase tracking-widest text-xs">CLOSE ROOT VIEW</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
