
import React, { useState, useEffect, useContext, useMemo } from 'react';
import { ShieldCheck, QrCode, User, CheckCircle, Smartphone, Clock, Users, MapPin, Zap } from 'lucide-react';
import { storageService } from '../services/storageService';
import { EntryLog, MedicalRep, Hospital, IssuedPass } from '../types';
import { FeedbackContext } from '../App';

const SecurityView: React.FC = () => {
  const { showFeedback } = useContext(FeedbackContext);
  const [logs, setLogs] = useState<EntryLog[]>([]);
  const [mrs, setMrs] = useState<MedicalRep[]>([]);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [passes, setPasses] = useState<IssuedPass[]>([]);

  // Generate a unique Gate QR code value for THIS specific hospital
  const gateQrValue = useMemo(() => {
    const user = storageService.getCurrentUser();
    // Unique ID format enforced: MEDPASS-GATE-[hospitalId]
    return user?.hospitalId ? `MEDPASS-GATE-${user.hospitalId}` : 'INVALID-GATE';
  }, []);

  useEffect(() => {
    // Fix: refresh made async and awaiting storage calls
    const refresh = async () => {
      const user = storageService.getCurrentUser();
      if (user?.hospitalId) {
        const allHospitals = await storageService.getHospitals();
        const currentHosp = allHospitals.find(h => h.id === user.hospitalId);
        setHospital(currentHosp || null);
        
        const allLogs = await storageService.getLogs();
        const allPasses = await storageService.getPasses();
        setPasses(allPasses);
        // Strict Isolation: Only show entries for THIS hospital's gate
        const myHospitalPassIds = allPasses.filter(p => p.hospitalId === user.hospitalId).map(p => p.id);
        const filteredLogs = allLogs
          .filter(l => myHospitalPassIds.includes(l.issuedPassId))
          .sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime());
          
        setLogs(filteredLogs);
        setMrs(await storageService.getMRs());
      }
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
      <section className="bg-white p-10 rounded-[3rem] shadow-2xl border border-indigo-100 flex flex-col items-center text-center relative overflow-hidden h-fit lg:sticky lg:top-24">
        <div className="bg-indigo-600 p-4 rounded-3xl mb-6 shadow-xl shadow-indigo-100 relative z-10"><ShieldCheck className="h-10 w-10 text-white" /></div>
        <h3 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">Gate Entry Terminal</h3>
        <p className="text-slate-500 font-bold mb-8 uppercase tracking-widest text-xs flex items-center justify-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-indigo-500" /> {hospital?.name || 'Authorized Facility'}
        </p>
        
        <div className="relative group p-4">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-indigo-700 rounded-[2.5rem] blur opacity-25 animate-pulse"></div>
          <div className="relative bg-white p-6 rounded-[2rem] border-2 border-indigo-50 shadow-inner flex items-center justify-center overflow-hidden">
             {/* Reliable QR generation with the UNIQUE hospital gate value */}
             <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${gateQrValue}`} alt="Gate QR" className="h-64 w-64 rounded-2xl border-4 border-white shadow-sm" />
          </div>
        </div>
        
        <div className="mt-10 space-y-4 w-full text-left">
           <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
              <p className="text-[10px] font-black text-indigo-800 uppercase tracking-widest mb-1">Permanent Hospital Access ID</p>
              <p className="font-mono text-lg font-black text-indigo-600">{gateQrValue}</p>
           </div>
           <div className="flex items-center justify-center gap-3 py-4 text-slate-400">
              <Smartphone className="h-5 w-5 animate-bounce" />
              <p className="text-sm font-bold italic">Scanning restricted to this specific facility</p>
           </div>
        </div>
      </section>

      <section className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col min-h-[600px]">
        <div className="p-8 border-b border-slate-50 bg-slate-50 flex justify-between items-center">
           <div>
              <h3 className="text-xl font-black text-slate-800">Live Access Stream</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized Hospital Entries Only</p>
           </div>
           <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
              <span className="text-[10px] font-black text-slate-600 uppercase">Live</span>
           </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
           {logs.map((log, index) => {
             // Fix: Using passes state instead of calling storageService.getPasses() inside map
             const pass = passes.find(p => p.id === log.issuedPassId);
             const mr = mrs.find(m => m.id === pass?.mrId);
             return (
               <div key={log.id} className={`flex items-center justify-between p-5 rounded-[2rem] border transition-all ${index === 0 ? 'bg-indigo-50/50 border-indigo-100 ring-2 ring-indigo-500/10 shadow-sm' : 'bg-white border-slate-100'}`}>
                  <div className="flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${index === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {index === 0 ? <CheckCircle className="h-6 w-6" /> : <User className="h-6 w-6" />}
                     </div>
                     <div>
                        <p className="font-black text-slate-800 leading-tight">{mr?.fullName || 'Unknown Visitor'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                           <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">{mr?.companyName || 'Pharma Rep'}</p>
                           <span className="text-slate-300">•</span>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{pass?.session} PASS</p>
                        </div>
                     </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1.5 text-slate-800 font-black text-sm">
                       <Clock className="h-3 w-3 text-slate-300" />
                       {new Date(log.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
               </div>
             );
           })}
           {logs.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full opacity-20 py-20">
                <Users className="h-12 w-12 mb-4" />
                <p className="font-black uppercase tracking-widest text-xs">Waiting for gate validation...</p>
             </div>
           )}
        </div>
      </section>
    </div>
  );
};

export default SecurityView;
