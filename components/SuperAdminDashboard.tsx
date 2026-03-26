
import React, { useState, useEffect, useContext } from 'react';
import { 
  Building2, Users, Settings, Plus, Power, Activity, Edit3, Trash2, X, 
  Briefcase, Clock, User, ShieldCheck, Lock, Key, Image as ImageIcon, 
  CheckCircle, TrendingUp, AlertTriangle, Info, Calendar, Mail, Phone, Eye, EyeOff, MapPin, CreditCard, Zap, History
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { Hospital, PharmaCompany, MedicalRep, HospitalUser, PassApplication, IssuedPass, AuthUser, AuditLog } from '../types';
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
  const [activeTab, setActiveTab] = useState<'hospitals' | 'companies' | 'monitoring'>('hospitals');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditData, setAuditData] = useState<AuditLog[]>([]);
  const [systemIssues, setSystemIssues] = useState<{ type: 'error' | 'warning' | 'info', message: string, details: string }[]>([]);
  
  // Hospital Modal States
  const [isHospitalModalOpen, setIsHospitalModalOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Partial<Hospital> | null>(null);
  const [adminData, setAdminData] = useState({ full_name: '', mobile_number: '', password: '', confirm_password: '' });
  const [securityData, setSecurityData] = useState({ full_name: '', mobile_number: '', password: '', confirm_password: '' });
  const [showPasswords, setShowPasswords] = useState(false);

  // Company Modal States
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Partial<PharmaCompany> & { admin_confirm_password?: string } | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedMR, setSelectedMR] = useState<MedicalRep | null>(null);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    const freshHospitals = await storageService.getHospitals();
    const freshCompanies = await storageService.getCompanies();
    const freshMrs = await storageService.getMRs();
    const freshApps = await storageService.getApplications();
    const freshPasses = await storageService.getPasses();
    const freshLogs = await storageService.getAuditLogs();

    setHospitals(freshHospitals);
    setCompanies(freshCompanies);
    setMrs(freshMrs);
    setApps(freshApps);
    setPasses(freshPasses);
    setAuditData(freshLogs);
    
    detectSystemIssues(freshLogs, freshHospitals, freshCompanies, freshMrs, freshApps);
  };

  const detectSystemIssues = (logs: AuditLog[], currentHospitals: Hospital[], currentCompanies: PharmaCompany[], currentMrs: MedicalRep[], currentApps: PassApplication[]) => {
    const issues: { type: 'error' | 'warning' | 'info', message: string, details: string }[] = [];
    
    // 1. Check for hospitals without sessions
    currentHospitals.forEach(h => {
      if (!h.supported_sessions || h.supported_sessions.length === 0) {
        issues.push({ type: 'error', message: `Hospital Configuration Error: ${h.name}`, details: 'No supported sessions configured. MRs cannot apply for passes.' });
      }
      
      const pass_limits = h.pass_limits || {};
      const totalPassLimit = Object.values(pass_limits).reduce((a: number, b: any) => a + (Number(b) || 0), 0) as number;
      if (totalPassLimit < 5) {
        issues.push({ type: 'warning', message: `Low Capacity Alert: ${h.name}`, details: `Total daily pass limit is only ${totalPassLimit}. This may cause high rejection rates.` });
      }
    });

    // 2. Check for companies without MRs or with many suspended MRs
    currentCompanies.forEach(c => {
      const companyMRs = currentMrs.filter(m => m.company_name === c.name);
      const activeMRCount = companyMRs.filter(m => m.status === 'active').length;
      const suspendedMRCount = companyMRs.filter(m => m.status === 'suspended').length;

      if (companyMRs.length === 0) {
        issues.push({ type: 'warning', message: `Inactive Partner: ${c.name}`, details: 'No representatives registered for this company.' });
      } else if (suspendedMRCount > activeMRCount && activeMRCount > 0) {
        issues.push({ type: 'info', message: `High Suspension Rate: ${c.name}`, details: `${suspendedMRCount} out of ${companyMRs.length} representatives are currently suspended.` });
      }
    });

    // 3. Check for expired SLCPI IDs
    const now = new Date();
    currentMrs.forEach(mr => {
      if (mr.slcpi_expiry) {
        const expiryDate = new Date(mr.slcpi_expiry);
        if (expiryDate < now) {
          issues.push({ type: 'error', message: `Compliance Breach: ${mr.full_name}`, details: `SLCPI ID expired on ${expiryDate.toLocaleDateString()}. Gate entry should be restricted.` });
        } else {
          const daysToExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysToExpiry <= 7) {
            issues.push({ type: 'warning', message: `Upcoming Expiry: ${mr.full_name}`, details: `SLCPI ID expires in ${daysToExpiry} days (${expiryDate.toLocaleDateString()}).` });
          }
        }
      }
    });

    // 4. Check for stale pass applications (applied but not processed for > 24h)
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const staleApps = currentApps.filter(a => a.status === 'applied' && new Date(a.created_at) < twentyFourHoursAgo);
    if (staleApps.length > 0) {
      issues.push({ type: 'warning', message: 'Stale Applications Detected', details: `${staleApps.length} pass applications have been pending for more than 24 hours.` });
    }

    // 5. Check for recent failed logins or errors in logs
    const recentErrors = logs.filter(l => l.action.includes('ERROR') || l.action.includes('FAILED')).slice(0, 5);
    recentErrors.forEach(l => {
      issues.push({ type: 'error', message: `System Alert: ${l.action}`, details: `${l.details} (at ${new Date(l.timestamp).toLocaleString()})` });
    });

    setSystemIssues(issues);
  };

  const handleSaveHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHospital?.name) return;
    
    // CRITICAL FIX: New hospitals must have admin credentials
    if (!editingHospital.id) {
      if (!adminData.full_name || !adminData.mobile_number || !adminData.password) {
        showFeedback("New facility requires: Admin name, mobile number, and password", "error");
        return;
      }
      if (!securityData.full_name || !securityData.mobile_number || !securityData.password) {
        showFeedback("New facility requires: Security name, mobile number, and password", "error");
        return;
      }
    }
    
    // Omit ID if it's a new record to let Postgres generate a UUID
    // Password Validation
    if (adminData.password) {
      if (adminData.password !== adminData.confirm_password) {
        showFeedback("Admin passwords do not match", "error");
        return;
      }
    }
    if (securityData.password) {
      if (securityData.password !== securityData.confirm_password) {
        showFeedback("Security passwords do not match", "error");
        return;
      }
    }

    const hospitalData: Hospital = {
      ...(editingHospital.id ? { id: editingHospital.id } : {}),
      name: editingHospital.name || '',
      address: editingHospital.address || '',
      email: editingHospital.email || '',
      mobile_number: editingHospital.mobile_number || '',
      is_active: editingHospital.is_active ?? true,
      supported_sessions: editingHospital.supported_sessions || ['MORNING', 'EVENING', 'FULL_DAY'],
      pass_limits: editingHospital.pass_limits || { 'MORNING': 10, 'EVENING': 10, 'FULL_DAY': 5 },
      session_windows: editingHospital.session_windows || { 
        'MORNING': { start: '08:00', end: '10:00' },
        'EVENING': { start: '16:00', end: '18:00' },
        'FULL_DAY': { start: '08:00', end: '18:00' }
      },
      entry_windows: editingHospital.entry_windows || { 
        'MORNING': { start: '08:00', end: '12:00' },
        'EVENING': { start: '16:00', end: '20:00' },
        'FULL_DAY': { start: '08:00', end: '20:00' }
      },
    } as Hospital;
    
    // We need the ID back from the database to create user accounts
    const savedHospitals = await storageService.saveHospitals([hospitalData]);
    const savedHospital = savedHospitals?.[0];
    
    if (savedHospital) {
      const hospital_id = savedHospital.id;
      // Save Hospital User Accounts
      const hospitalUsers = await storageService.getHospitalUsers();
      
      const admin_id = editingHospital.id ? (hospitalUsers.find(user => user.hospital_id === hospital_id && user.role === 'ADMIN')?.id) : undefined;
      const security_id = editingHospital.id ? (hospitalUsers.find(user => user.hospital_id === hospital_id && user.role === 'SECURITY')?.id) : undefined;

      const u: HospitalUser[] = [
        { ...(admin_id ? { id: admin_id } : {}), hospital_id: hospital_id, role: 'ADMIN', full_name: adminData.full_name, mobile_number: adminData.mobile_number.trim(), password: editingHospital.id ? '' : adminData.password } as HospitalUser,
        { ...(security_id ? { id: security_id } : {}), hospital_id: hospital_id, role: 'SECURITY', full_name: securityData.full_name, mobile_number: securityData.mobile_number.trim(), password: editingHospital.id ? '' : securityData.password } as HospitalUser
      ];
      
      try {
        // CRITICAL FIX: Use updatePassword directly for existing admins to ensure hashing/persistence
        if (editingHospital.id && admin_id && adminData.password) {
          await storageService.updatePassword(admin_id, adminData.password);
          console.log(`[SuperAdmin] Admin password updated via SessionService for: ${admin_id}`);
        }
        
        await storageService.saveHospitalUsers(u);
        storageService.log('SUPER_ADMIN', 'HOSPITAL_SAVE', `Hospital: ${savedHospital.name} (ID: ${hospital_id})`);
      } catch (err: any) {
        console.error("Hospital user save error:", err);
        showFeedback(err.message || "Failed to save hospital credentials", "error");
        return;
      }
    }
    
    refreshData();
    setIsHospitalModalOpen(false);
    setEditingHospital(null);
    setAdminData({ full_name: '', mobile_number: '', password: '', confirm_password: '' });
    setSecurityData({ full_name: '', mobile_number: '', password: '', confirm_password: '' });
    showFeedback(editingHospital.id ? "Hospital infrastructure updated." : "New facility provisioned.");
  };

  const startEditHospital = async (h: Hospital) => {
    setEditingHospital(h);
    const users = (await storageService.getHospitalUsers()).filter(u => u.hospital_id === h.id);
    const admin = users.find(u => u.role === 'ADMIN');
    const security = users.find(u => u.role === 'SECURITY');
    
    setAdminData({ 
      full_name: admin?.full_name || '', 
      mobile_number: admin?.mobile_number || '', 
      password: '',
      confirm_password: ''
    });
    setSecurityData({ 
      full_name: security?.full_name || '', 
      mobile_number: security?.mobile_number || '', 
      password: '',
      confirm_password: ''
    });
    setIsHospitalModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany?.name || !editingCompany?.company_code) {
      showFeedback("Company name and code are required.", "error");
      return;
    }
    
    // CRITICAL FIX: New companies must have admin credentials
    if (!editingCompany.id) {
      if (!editingCompany.admin_mobile || !editingCompany.admin_password) {
        showFeedback("New company requires: Admin mobile number and password", "error");
        return;
      }
    }

    // Password Validation
    if (editingCompany.admin_password) {
      if (editingCompany.admin_password !== editingCompany.admin_confirm_password) {
        showFeedback("Company admin passwords do not match", "error");
        return;
      }
    }

    // Omit ID for new records to allow Postgres to generate UUID
    const companyData: PharmaCompany = {
      ...(editingCompany.id ? { id: editingCompany.id } : {}),
      name: editingCompany.name || '',
      company_code: editingCompany.company_code || '',
      address: editingCompany.address || '',
      contact_number: editingCompany.contact_number || '',
      finance_email: editingCompany.finance_email || '',
      admin_mobile: (editingCompany.admin_mobile || '').trim(),
      admin_password: editingCompany.id ? '' : editingCompany.admin_password,
      contact_email: editingCompany.contact_email || '',
      is_active: editingCompany.is_active ?? true,
    } as PharmaCompany;

    try {
      // CRITICAL FIX: Use updatePassword directly for existing company admins
      if (editingCompany.id && editingCompany.admin_password) {
        await storageService.updatePassword(editingCompany.id, editingCompany.admin_password);
        console.log(`[SuperAdmin] Company admin password updated via SessionService for: ${editingCompany.id}`);
      }
      
      await storageService.saveCompanies([companyData]);
      storageService.log('SUPER_ADMIN', 'COMPANY_SAVE', `Company: ${companyData.name}`);
      refreshData();
      setIsCompanyModalOpen(false);
      setEditingCompany(null);
      showFeedback(editingCompany.id ? "Partner entity updated." : `Pharmaceutical company ${companyData.name} registered.`);
    } catch (err: any) {
      console.error("Company save error:", err);
      showFeedback(err.message || "Failed to register company", "error");
    }
  };

  const toggleCompanyStatus = async (id: string) => {
    const currentCompanies = await storageService.getCompanies();
    const updated = currentCompanies.map(c => c.id === id ? { ...c, is_active: !c.is_active } : c);
    await storageService.saveCompanies(updated);
    setCompanies(updated);
    const c = updated.find(x => x.id === id);
    showFeedback(`Company ${c?.name} is now ${c?.is_active ? 'active' : 'deactivated'}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit gap-1 overflow-x-auto max-w-full">
        <button onClick={() => setActiveTab('hospitals')} className={`px-4 md:px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'hospitals' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Building2 className="h-4 w-4" /> Hospitals</button>
        <button onClick={() => setActiveTab('companies')} className={`px-4 md:px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'companies' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Briefcase className="h-4 w-4" /> Companies</button>
        <button onClick={() => setActiveTab('monitoring')} className={`px-4 md:px-6 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'monitoring' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Activity className="h-4 w-4" /> System Health</button>
      </div>

      {activeTab === 'hospitals' && (
        <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-bold">Facility Management</h3>
            <button 
              onClick={() => { 
                setEditingHospital({ supported_sessions: ['MORNING', 'EVENING', 'FULL_DAY'], is_active: true }); 
                setAdminData({ full_name: '', mobile_number: '', password: '', confirm_password: '' });
                setSecurityData({ full_name: '', mobile_number: '', password: '', confirm_password: '' });
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
                <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${h.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <h4 className="font-black text-slate-800 text-lg mb-1">{h.name}</h4>
                <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mb-4"><MapPin className="h-3 w-3" /> {h.address || 'Address not set'}</p>
                <div className="space-y-2 mb-6">
                   <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                     <ShieldCheck className="h-4 w-4 text-indigo-400" /> 
                     Admin: {h.email ? 'Assigned' : 'Unassigned'}
                   </div>
                   <div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-400 tracking-widest">
                     {h.supported_sessions.join(' • ')}
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
              onClick={() => { setEditingCompany({ is_active: true }); setIsCompanyModalOpen(true); }}
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4" /> NEW PARTNER
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-3">
              {companies.map(c => {
                const companyMRCount = mrs.filter(m => m.company_name === c.name).length;
                return (
                  <button 
                    key={c.id}
                    onClick={() => setSelectedCompanyId(c.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${selectedCompanyId === c.id ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-slate-800">{c.name}</h4>
                      <div className={`w-2 h-2 rounded-full ${c.is_active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-slate-300'}`}></div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-tighter">{c.company_code} • {companyMRCount} MRs Registered</p>
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
                          <p className="text-xs font-bold text-indigo-600 flex items-center gap-2"><Mail className="h-3 w-3" /> {companies.find(c => c.id === selectedCompanyId)?.contact_email}</p>
                          <p className="text-xs font-bold text-slate-500 flex items-center gap-2"><CreditCard className="h-3 w-3" /> Finance: {companies.find(c => c.id === selectedCompanyId)?.finance_email || 'Not set'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => toggleCompanyStatus(selectedCompanyId)} className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border transition-colors ${companies.find(c => c.id === selectedCompanyId)?.is_active ? 'border-red-200 text-red-600 bg-red-50' : 'border-green-200 text-green-600 bg-green-50'}`}>
                           {companies.find(c => c.id === selectedCompanyId)?.is_active ? 'Deactivate' : 'Activate'}
                         </button>
                         <button onClick={() => { setEditingCompany(companies.find(c => c.id === selectedCompanyId)); setIsCompanyModalOpen(true); }} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg"><Edit3 className="h-4 w-4 text-slate-600" /></button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Representative Registry</h5>
                    <div className="space-y-2">
                       {mrs.filter(m => m.company_name === companies.find(c => c.id === selectedCompanyId)?.name).map(mr => (
                         <div key={mr.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 hover:border-indigo-200 transition-all cursor-pointer" onClick={() => setSelectedMR(mr)}>
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center"><User className="h-4 w-4 text-slate-400" /></div>
                               <div><p className="text-xs font-black">{mr.full_name}</p><p className="text-[9px] text-slate-400">{mr.mr_code}</p></div>
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded ${mr.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{mr.status}</span>
                         </div>
                       ))}
                       {mrs.filter(m => m.company_name === companies.find(c => c.id === selectedCompanyId)?.name).length === 0 && (
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

      {activeTab === 'monitoring' && (
        <section className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold flex items-center gap-2"><Activity className="h-5 w-5 text-indigo-600" /> System Pulse & Diagnostics</h3>
                  <span className="px-3 py-1 bg-green-50 text-green-600 text-[10px] font-black rounded-full uppercase tracking-widest">All Services Online</span>
                </div>
                
                <div className="space-y-4">
                  {systemIssues.length > 0 ? (
                    systemIssues.map((issue, idx) => (
                      <div key={idx} className={`p-4 rounded-2xl border flex gap-4 ${
                        issue.type === 'error' ? 'bg-red-50 border-red-100' : 
                        issue.type === 'warning' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'
                      }`}>
                        <div className={`p-2 rounded-xl h-fit ${
                          issue.type === 'error' ? 'bg-red-100 text-red-600' : 
                          issue.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{issue.message}</p>
                          <p className="text-xs text-slate-500 mt-1">{issue.details}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium text-slate-400">No critical system issues detected at this time.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><History className="h-5 w-5 text-indigo-600" /> Global Audit Trail</h3>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {auditData.map(log => (
                    <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group hover:bg-white hover:border-indigo-100 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 group-hover:bg-indigo-50 transition-colors">
                          <Zap className="h-4 w-4 text-indigo-400" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{log.action}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{log.details}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase">{new Date(log.timestamp).toLocaleDateString()}</p>
                        <p className="text-[9px] text-slate-300 font-bold">{new Date(log.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-indigo-600 p-8 rounded-3xl text-white shadow-xl shadow-indigo-200">
                <h4 className="text-lg font-black mb-4 uppercase tracking-tighter">System Capacity</h4>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                      <span>Hospital Nodes</span>
                      <span>{hospitals.length} Active</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white w-3/4"></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                      <span>Partner Entities</span>
                      <span>{companies.length} Active</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white w-1/2"></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                      <span>Field Representatives</span>
                      <span>{mrs.length} Registered</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white w-full"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Quick Stats</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Total Apps</p>
                    <p className="text-2xl font-black text-slate-800">{apps.length}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Passes Issued</p>
                    <p className="text-2xl font-black text-indigo-600">{passes.length}</p>
                  </div>
                </div>
              </div>
            </div>
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
                  <input type="tel" value={editingHospital?.mobile_number || ''} onChange={e => setEditingHospital({...editingHospital, mobile_number: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Contact Mobile" />
                </div>
              </div>

              <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-indigo-900 uppercase">Management Account (Admin)</p>
                  <ShieldCheck className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input required type="text" value={adminData.full_name} onChange={e => setAdminData({...adminData, full_name: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold" placeholder="Admin Full Name" />
                  <input required type="text" value={adminData.mobile_number} onChange={e => setAdminData({...adminData, mobile_number: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold" placeholder="Admin Login ID" />
                  <input required={!editingHospital?.id} type={showPasswords ? "text" : "password"} value={adminData.password} onChange={e => setAdminData({...adminData, password: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold" placeholder={editingHospital?.id ? "Set New Admin Password (Optional)" : "Admin Password"} />
                  <input required={!editingHospital?.id && !!adminData.password} type={showPasswords ? "text" : "password"} value={adminData.confirm_password} onChange={e => setAdminData({...adminData, confirm_password: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold" placeholder="Confirm Admin Password" />
                </div>
              </div>

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-slate-800 uppercase">Verification Post Account (Security)</p>
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input required type="text" value={securityData.full_name} onChange={e => setSecurityData({...securityData, full_name: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold" placeholder="Guard Full Name" />
                  <input required type="text" value={securityData.mobile_number} onChange={e => setSecurityData({...securityData, mobile_number: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold" placeholder="Guard Login ID" />
                  {!editingHospital?.id && (
                    <>
                      <input required type={showPasswords ? "text" : "password"} value={securityData.password} onChange={e => setSecurityData({...securityData, password: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold" placeholder="Guard Password" />
                      <input required={!!securityData.password} type={showPasswords ? "text" : "password"} value={securityData.confirm_password} onChange={e => setSecurityData({...securityData, confirm_password: e.target.value})} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold" placeholder="Confirm Guard Password" />
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editingHospital?.is_active} onChange={e => setEditingHospital({...editingHospital, is_active: e.target.checked})} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
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
                    <input required type="text" value={editingCompany?.company_code || ''} onChange={e => setEditingCompany({...editingCompany, company_code: e.target.value})} className="w-full px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl font-mono font-black text-indigo-700 uppercase" placeholder="e.g. AZ-01" />
                 </div>
                 <textarea value={editingCompany?.address || ''} onChange={e => setEditingCompany({...editingCompany, address: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none h-20" placeholder="Company Address" />
                 <div className="grid grid-cols-2 gap-4">
                   <input type="tel" value={editingCompany?.contact_number || ''} onChange={e => setEditingCompany({...editingCompany, contact_number: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Contact Phone" />
                   <input type="email" value={editingCompany?.finance_email || ''} onChange={e => setEditingCompany({...editingCompany, finance_email: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Finance Email" />
                 </div>

                 <div className="pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-black text-indigo-400 uppercase mb-3">Provision Admin Account</p>
                    <div className="space-y-2">
                       <input required type="text" value={editingCompany?.admin_mobile || ''} onChange={e => setEditingCompany({...editingCompany, admin_mobile: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" placeholder="Admin Login ID" />
                       <div className="grid grid-cols-2 gap-2">
                         <input required={!editingCompany?.id} type={showPasswords ? "text" : "password"} value={editingCompany?.admin_password || ''} onChange={e => setEditingCompany({...editingCompany, admin_password: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" placeholder={editingCompany?.id ? "Set New Password (Optional)" : "Admin Password"} />
                         <input required={!editingCompany?.id && !!editingCompany?.admin_password} type={showPasswords ? "text" : "password"} value={editingCompany?.admin_confirm_password || ''} onChange={e => setEditingCompany({...editingCompany, admin_confirm_password: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" placeholder="Confirm Password" />
                       </div>
                       <input required type="email" value={editingCompany?.contact_email || ''} onChange={e => setEditingCompany({...editingCompany, contact_email: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold" placeholder="Official Corporate Email" />
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
                  <h4 className="text-2xl font-black text-slate-800">{selectedMR.full_name}</h4>
                  <p className="text-indigo-600 font-bold text-sm tracking-wide uppercase">{selectedMR.company_name}</p>
               </div>
               
               <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">System Access ID</p><p className="font-bold text-slate-700 font-mono text-xs">{selectedMR.mr_code}</p></div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">SLCPI ID</p><p className="font-bold text-slate-700 font-mono text-xs">{selectedMR.slcpi_id || 'N/A'}</p></div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Mobile</p><p className="font-bold text-slate-700 text-sm">{selectedMR.mobile_number}</p></div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">SLCPI Expiry</p><p className="font-bold text-slate-700 text-sm">{selectedMR.slcpi_expiry || 'N/A'}</p></div>
               </div>

               {selectedMR.slcpi_photo && (
                 <div className="rounded-2xl overflow-hidden border border-slate-200 mt-4 bg-slate-50 p-2 shadow-inner">
                   <img src={selectedMR.slcpi_photo} className="w-full object-contain max-h-48 rounded-xl" alt="ID Document" />
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
