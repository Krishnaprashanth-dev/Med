import React, { useState, useEffect, useContext, useRef } from 'react';
// @ts-ignore - jsqr has no type definitions, but works fine at runtime
import jsQR from 'jsqr';
import { 
  Calendar, Clock, QrCode, AlertCircle, CheckCircle2, Info, Building2, 
  PlusCircle, Sun, Moon, Maximize, Search, Send, CheckCircle, 
  UserCircle, Briefcase, Phone, CreditCard, ShieldCheck, 
<<<<<<< HEAD
  Image as ImageIcon, ChevronRight, MapPin, XCircle, Camera, X, Smartphone, Zap, Timer, AlertTriangle, Loader2, Mail, ExternalLink, BadgeCheck, Sparkles, TrendingUp
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { MedicalRep, PassApplication, IssuedPass, Hospital, MRHospitalApproval, SessionType } from '../types';
=======
  Image as ImageIcon, ChevronRight, MapPin, XCircle, Camera, X, Smartphone, Zap, Timer, AlertTriangle, Loader2, Mail, ExternalLink, BadgeCheck, Sparkles, TrendingUp,
  Flame, Trophy, Bell, Trash2
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { ScoringService } from '../services/ScoringService';
import { NotificationService } from '../services/NotificationService';
import { CancellationService } from '../services/CancellationService';
import { MedicalRep, PassApplication, IssuedPass, Hospital, MRHospitalApproval, SessionType, MRScore, Notification } from '../types';
>>>>>>> a063f5c (Initial commit)
import { FeedbackContext } from '../App';

interface MRDashboardProps {
  user: MedicalRep;
}

const getScanStatus = (session: SessionType, windows?: Record<string, { start: string; end: string }>) => {
  const now = new Date();
  const currentTime = now.getHours() * 100 + now.getMinutes(); 

  const window = windows?.[session];
  if (!window) {
    return { open: false, message: 'Scanning window not configured by hospital', range: '--:--' };
  }

  const startNum = parseInt(window.start.replace(':', ''));
  const endNum = parseInt(window.end.replace(':', ''));

  if (currentTime >= startNum && currentTime <= endNum) {
    return { open: true, message: `${session} Window Open`, range: `${window.start} - ${window.end}`, end: window.end };
  }

  if (currentTime < startNum) {
    return { open: false, message: `Access Denied: Scan Window Starts at ${window.start}`, range: `${window.start} - ${window.end}`, end: window.end };
  }
  
  return { open: false, message: `Access Denied: Scan Window Ended at ${window.end}`, range: `${window.start} - ${window.end}`, end: window.end };
};

const QRScannerModal: React.FC<{
  onClose: () => void;
  onScan: (value: string) => void;
  mrId: string;
  hospitals: Hospital[];
}> = ({ onClose, onScan, mrId, hospitals }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let animationFrame: number;

    async function setupCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        activeStream = s;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          setTimeout(() => { videoRef.current?.play().catch(console.error); }, 150);
        }
      } catch (err) {
        setError("Camera access denied. Please allow permissions.");
      }
    }

    const scan = () => {
      if (videoRef.current && canvasRef.current && scanning) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (video.readyState === video.HAVE_ENOUGH_DATA && context) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code) {
            setScanning(false);
            onScan(code.data);
            return;
          }
        }
      }
      animationFrame = requestAnimationFrame(scan);
    };

    setupCamera();
    animationFrame = requestAnimationFrame(scan);

    return () => { 
      if (activeStream) activeStream.getTracks().forEach(track => track.stop()); 
      cancelAnimationFrame(animationFrame);
    };
  }, [scanning, onScan]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="w-full max-md relative flex flex-col items-center">
        <button onClick={onClose} className="absolute -top-16 right-0 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all active:scale-90"><X className="h-6 w-6" /></button>
        <div className="w-full aspect-square bg-black rounded-[3rem] border-4 border-white/20 overflow-hidden relative shadow-2xl ring-4 ring-indigo-500/20">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"><AlertCircle className="h-12 w-12 text-red-500 mb-4" /><p className="text-white font-bold">{error}</p></div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-indigo-400/50 rounded-3xl relative">
                  <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg"></div>
                  <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg"></div>
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg"></div>
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-indigo-500 rounded-br-lg"></div>
                  <div className="w-full h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent absolute top-0 animate-[scan_2s_ease-in-out_infinite] shadow-[0_0_15px_rgba(99,102,241,0.8)]"></div>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="mt-8 text-center space-y-4">
          <div className="flex items-center gap-3 justify-center"><Smartphone className="h-6 w-6 text-indigo-400" /><h3 className="text-xl font-black text-white">Align with Gate QR</h3></div>
          <p className="text-slate-400 text-sm font-medium">Point your camera at the hospital gate QR code</p>
        </div>
      </div>
      <style>{` @keyframes scan { 0%, 100% { top: 0%; opacity: 0.5; } 50% { top: 100%; opacity: 1; } } `}</style>
    </div>
  );
};

const VisitingBadgeModal: React.FC<{
  onClose: () => void;
  pass: IssuedPass;
  hospital?: Hospital;
  mr: MedicalRep;
}> = ({ onClose, pass, hospital, mr }) => {
  const window = hospital?.entryWindows?.[pass.session];
  const sessionWindow = hospital?.sessionWindows?.[pass.session];

  return (
    <div className="fixed inset-0 z-[150] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-white rounded-[3rem] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-300">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-all"><X className="h-5 w-5 text-slate-500" /></button>
        
        <div className="bg-indigo-600 p-10 pb-20 text-center relative overflow-hidden">
           <Zap className="absolute -right-6 -bottom-6 h-24 w-24 text-white opacity-10" />
           <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30 backdrop-blur-sm">
             <ShieldCheck className="h-10 w-10 text-white" />
           </div>
           <h3 className="text-white text-xl font-black tracking-tighter uppercase">Authorized Visitor</h3>
           <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80">MedPass v3.5 Security Protocol</p>
        </div>

        <div className="px-8 -mt-12 relative z-10">
           <div className="bg-white rounded-[2rem] shadow-xl p-6 border border-slate-100 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-md overflow-hidden bg-gradient-to-br from-slate-50 to-slate-200">
                {mr.slcpiPhoto ? (
                  <img src={mr.slcpiPhoto} className="w-full h-full object-cover" />
                ) : (
                  <UserCircle className="h-12 w-12 text-slate-300" />
                )}
              </div>
              <h4 className="text-xl font-black text-slate-800 tracking-tight">{mr.fullName}</h4>
              <p className="text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em] mb-4">{mr.companyName}</p>
              
              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                 <div className="text-left">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Login ID</p>
                    <p className="text-xs font-bold text-slate-700 font-mono">{mr.loginId}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">SLCPI ID</p>
                    <p className="text-xs font-bold text-slate-700 font-mono">{mr.slcpiId}</p>
                 </div>
              </div>
           </div>
        </div>

        <div className="p-8 space-y-4">
           <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <div className="flex items-center gap-3 mb-2">
                 <Building2 className="h-4 w-4 text-indigo-50" />
                 <p className="text-sm font-black text-slate-800">{hospital?.name}</p>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold uppercase text-slate-500">
                 <div className="flex items-center gap-1.5">
                    {pass.session === 'MORNING' ? <Sun className="h-3.5 w-3.5 text-amber-500" /> : pass.session === 'EVENING' ? <Moon className="h-3.5 w-3.5 text-indigo-400" /> : <Maximize className="h-3.5 w-3.5 text-indigo-600" />}
                    {pass.session}
                 </div>
                 <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1 text-slate-400"><Clock className="h-2.5 w-2.5" /> Scan Window</div>
                    <div className="font-black text-slate-700">{window?.start} - {window?.end}</div>
                 </div>
              </div>
           </div>

           <div className="bg-green-600 p-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-green-100">
              <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
              <p className="text-white font-black text-xs uppercase tracking-[0.2em]">Live Entry Permit</p>
           </div>
           
           <p className="text-center text-[8px] font-bold text-slate-400 uppercase tracking-widest">Auth ID: {pass.id.slice(0,12).toUpperCase()} • Node: {pass.hospitalId}</p>

           <button 
             onClick={onClose}
             className="w-full mt-6 px-6 py-3 bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg hover:bg-slate-900 active:scale-95 transition-all flex items-center justify-center gap-2"
           >
             ← Back to Dashboard
           </button>
        </div>
      </div>
    </div>
  );
};

const MRDashboard: React.FC<MRDashboardProps> = ({ user }) => {
  const { showFeedback } = useContext(FeedbackContext);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [approvals, setApprovals] = useState<MRHospitalApproval[]>([]);
  const [apps, setApps] = useState<PassApplication[]>([]);
  const [passes, setPasses] = useState<IssuedPass[]>([]);
<<<<<<< HEAD
=======
  const [mrScore, setMrScore] = useState<MRScore | null>(null);
  const [daysUntilReset, setDaysUntilReset] = useState(0);
>>>>>>> a063f5c (Initial commit)
  const [loading, setLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [detailedStrategy, setDetailedStrategy] = useState<string | null>(null);
  const [isStrategyLoading, setIsStrategyLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'passes' | 'directory' | 'profile'>('passes');
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [validatedPass, setValidatedPass] = useState<IssuedPass | null>(null);
  const [showBadgePass, setShowBadgePass] = useState<IssuedPass | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [successApplication, setSuccessApplication] = useState<{hosp: string, sess: string} | null>(null);
  const [scanResult, setScanResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<{ passId: string; appId: string } | null>(null);
<<<<<<< HEAD
=======
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [cancellationTimers, setCancellationTimers] = useState<Record<string, number>>({}); // pass.id -> milliseconds remaining
>>>>>>> a063f5c (Initial commit)

  useEffect(() => { 
    refreshData(); 
    const timer = setInterval(refreshData, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let timer: number;
    if (validatedPass && countdown > 0) {
      timer = window.setInterval(() => setCountdown(prev => prev - 1), 1000);
    } else if (countdown === 0) {
      setValidatedPass(null);
      setCountdown(60);
    }
    return () => clearInterval(timer);
  }, [validatedPass, countdown]);

  useEffect(() => {
    if (scanResult) {
      const timer = window.setTimeout(() => setScanResult(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [scanResult]);

<<<<<<< HEAD
  const refreshData = async () => {
    const h = await storageService.getHospitals();
    const apprvs = await storageService.getApprovals({ mrId: user.id });
    const a = await storageService.getApplications({ mrId: user.id });
    const p = await storageService.getPasses({ mrId: user.id });
    setHospitals(h); setApprovals(apprvs); setApps(a); setPasses(p);
    
    // Rule-based Priority Insight
    const missedCount = p.filter(pass => pass.entryStatus === 'expired').length;
    const entryCount = p.filter(pass => pass.entryStatus === 'entered').length;
    let insight = "Your profile is synchronized with the network. Apply daily to build priority.";
    if (missedCount > 0) {
      insight = `You have ${missedCount} missed entries. This reduces your lottery priority score. Maintain perfect attendance to recover.`;
    } else if (entryCount > 5) {
      insight = "Excellent visit frequency! Your high reliability keeps your success probability stable.";
    }
    setAiInsight(insight);
=======
  // Load notifications
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const notifs = await NotificationService.getNotifications(user.id);
        setNotifications(notifs);
      } catch (err) {
        console.error('Error loading notifications:', err);
      }
    };
    
    loadNotifications();
    const timer = setInterval(loadNotifications, 10000); // Refresh every 10 seconds
    return () => clearInterval(timer);
  }, [user.id]);

  // Update cancellation timers
  useEffect(() => {
    let timerInterval: number;

    const updateTimers = () => {
      const newTimers: Record<string, number> = {};
      passes.forEach(pass => {
        const hosp = hospitals.find(h => h.id === pass.hospitalId);
        if (hosp) {
          const timeRemaining = CancellationService.getTimeUntilCancellationDeadline(hosp, pass.session, pass.passDate);
          newTimers[pass.id] = timeRemaining;
        }
      });
      setCancellationTimers(newTimers);
    };

    updateTimers();
    timerInterval = window.setInterval(updateTimers, 1000); // Update every second
    return () => clearInterval(timerInterval);
  }, [passes, hospitals]);

  const refreshData = async () => {
    try {
      const h = await storageService.getHospitals();
      const apprvs = await storageService.getApprovals({ mrId: user.id });
      const a = await storageService.getApplications({ mrId: user.id });
      const p = await storageService.getPasses({ mrId: user.id });
      
      setHospitals(h); 
      setApprovals(apprvs); 
      setApps(a); 
      setPasses(p);

      try {
        const score = await ScoringService.getMRScore(user.id);
        const daysLeft = ScoringService.getDaysUntilReset(score);
        setMrScore(score);
        setDaysUntilReset(daysLeft);
      } catch (scoreError) {
        console.warn('Score service error (table may not exist):', scoreError);
        setMrScore(null);
        setDaysUntilReset(0);
      }

      // Rule-based Priority Insight
      const missedCount = p.filter(pass => pass.entryStatus === 'expired').length;
      const entryCount = p.filter(pass => pass.entryStatus === 'entered').length;
      let insight = "Your profile is synchronized with the network. Apply daily to build priority.";
      if (missedCount > 0) {
        insight = `You have ${missedCount} missed entries. This reduces your lottery priority score. Maintain perfect attendance to recover.`;
      } else if (entryCount > 5) {
        insight = "Excellent visit frequency! Your high reliability keeps your success probability stable.";
      }
      setAiInsight(insight);
    } catch (error) {
      console.error('Error loading MR dashboard data:', error);
      showFeedback('Error loading dashboard data', 'error');
    }
>>>>>>> a063f5c (Initial commit)
  };

  const handleFetchStrategy = async () => {
    setIsStrategyLoading(true);
    // Rule-based Strategy
    setTimeout(() => {
      const visitCount = passes.filter(p => p.entryStatus === 'entered').length;
      const missedCount = passes.filter(p => p.entryStatus === 'expired').length;
      
      let strategy = "Rule-Based Logic Active:\n\n";
      strategy += "1. Perfect Attendance: Every missed visit is a -10 point penalty. Always scan at the gate.\n";
      strategy += "2. Peak Timing: Target Evening sessions if Morning sessions show high application volume.\n";
      strategy += "3. Cooldown Awareness: Remember the strict 3-day cooldown from your last visit date to avoid rejected applications.";
      
      if (missedCount > 0) {
        strategy += "\n\nCRITICAL: Your missed visit penalty is currently active. Your rank will recover after 14 days of perfect attendance.";
      }

      setDetailedStrategy(strategy);
      setIsStrategyLoading(false);
    }, 500);
  };

  const handleScanDetected = async (qrValueInput?: string) => {
    setIsScanning(false);
    setLoading(true);
    try {
      const latestPasses = await storageService.getPasses();
      const today = new Date().toLocaleDateString('en-CA');
      let qrValue = qrValueInput;

      if (!qrValue) {
        qrValue = prompt("Enter Unique Hospital Gate ID (e.g. MEDPASS-GATE-h1):") || undefined;
      }

      if (!qrValue?.startsWith('MEDPASS-GATE-')) {
        console.warn("Invalid QR format:", qrValue);
        setScanResult({ status: 'error', message: 'Invalid Gate QR format detected' });
        showFeedback("Invalid Gate QR format.", "error");
        return;
      }

      const hospitalIdFromQR = qrValue.replace('MEDPASS-GATE-', '');
      const myPassesToday = latestPasses.filter(p => p.mrId === user.id && p.passDate === today && p.entryStatus === 'not_entered');
      const myEligiblePasses = myPassesToday.filter(p => p.hospitalId === hospitalIdFromQR);

      if (myEligiblePasses.length === 0) {
        const otherPasses = myPassesToday.length > 0;
        if (otherPasses) {
          setScanResult({ status: 'error', message: 'Gate Incompatible: Different facility' });
          showFeedback("Gate Incompatible: This pass is for a different facility gate.", "error");
        } else {
          setScanResult({ status: 'error', message: 'No valid entry pass found today' });
          showFeedback("No valid entry pass for today detected for this facility.", "error");
        }
        return;
      }

      const currentHospital = hospitals.find(h => h.id === hospitalIdFromQR);
      const activePass = myEligiblePasses.find(p => getScanStatus(p.session, currentHospital?.entryWindows).open);

      if (!activePass) {
        const status = getScanStatus(myEligiblePasses[0].session, currentHospital?.entryWindows);
        setScanResult({ status: 'error', message: `Scanning window closed: ${status.message}` });
        showFeedback(`Scan Failed: ${status.message}`, "error");
        return;
      }

      console.log("✅ Pass validated, proceeding with entry...", activePass);

      const updatedPass = { ...activePass, entryStatus: 'entered' as const };
      const log = { 
        id: crypto.randomUUID(), 
        issuedPassId: activePass.id, 
        entryTime: new Date().toISOString(), 
        verifiedBy: 'Self-Gate-Scanner-v3.5' 
      };
      
      // Update UI immediately for instant feedback
      setScanResult({ status: 'success', message: `✓ Scanning Successful\n${activePass.session} Session Approved` });
      setValidatedPass(activePass);
      setCountdown(60);
      
      // Save to storage asynchronously without blocking UI
      try {
        await storageService.savePasses([updatedPass]);
        console.log("✅ Pass saved successfully");
      } catch (saveErr) {
        console.error("⚠️ Pass save error (UI already updated):", saveErr);
        showFeedback("Warning: Pass saved locally but sync failed.", "error");
      }

      try {
        await storageService.saveLogs([log]);
        console.log("✅ Entry log saved successfully");
      } catch (logErr) {
        console.error("⚠️ Log save error (UI already updated):", logErr);
      }
      
      refreshData();
      showFeedback(`Gate Access Authorized for ${activePass.session} session!`, 'success');
    } catch (err) {
      console.error("Scan error:", err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setScanResult({ status: 'error', message: `Scanning Error: ${errorMsg}` });
      showFeedback(`Failed to process scan: ${errorMsg}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async (hospitalId: string) => {
    setLoading(true);
    const newApproval: MRHospitalApproval = {
      id: crypto.randomUUID(),
      mrId: user.id,
      hospitalId: hospitalId,
      status: 'pending',
      updatedAt: new Date().toISOString()
    };
    
    const currentApprovals = await storageService.getApprovals({ mrId: user.id, hospitalId });
    if (currentApprovals.length > 0 && currentApprovals[0].status === 'pending') {
      showFeedback("Access request is already pending.", "error");
      setLoading(false);
      return;
    }

    await storageService.saveApprovals([newApproval]);
    showFeedback("Access request transmitted to hospital administration.", "success");
    await refreshData();
    setLoading(false);
  };

  const isSessionWindowOpen = (h: Hospital, session: SessionType) => {
    const window = h.sessionWindows?.[session];
    if (!window) return false;
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    return time >= window.start && time <= window.end;
  };

  const getSessionCooldownInfo = (hospitalId: string, session: SessionType) => {
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA');
    
    const relevantPasses = passes
      .filter(p => p.hospitalId === hospitalId && p.session === session && p.passDate <= todayStr)
      .sort((a, b) => b.passDate.localeCompare(a.passDate));

    if (relevantPasses.length === 0) return null;

    const lastPassDate = new Date(relevantPasses[0].passDate);
    const nextEligibleDate = new Date(lastPassDate);
    nextEligibleDate.setDate(lastPassDate.getDate() + 4); 

    const nextEligibleDateStr = nextEligibleDate.toLocaleDateString('en-CA');

    if (todayStr < nextEligibleDateStr) {
      return {
        isActive: true,
        lastPassDate: relevantPasses[0].passDate,
        nextEligibleDateStr: nextEligibleDateStr
      };
    }

    return null;
  };

  const getTodayApplication = (hospitalId: string, session: SessionType) => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    return apps.find(a => a.hospitalId === hospitalId && a.session === session && a.applicationDate === todayStr && a.status === 'applied');
  };

  const handleApply = async (hospitalId: string, session: SessionType) => {
    const cooldown = getSessionCooldownInfo(hospitalId, session);
    if (cooldown?.isActive) {
      showFeedback(`Cooldown Active: System cooling down after recent visit. Next application window: ${cooldown.nextEligibleDateStr}`, "error");
      return;
    }

    if (getTodayApplication(hospitalId, session)) {
      showFeedback("You have already applied for this lottery today.", "error");
      return;
    }

    setLoading(true);
    const todayStr = new Date().toLocaleDateString('en-CA');
    const newApp: PassApplication = {
      id: crypto.randomUUID(), 
      mrId: user.id, 
      hospitalId, 
      session,
      applicationDate: todayStr, 
      priorityScore: 0, 
<<<<<<< HEAD
=======
      credit: 0,
>>>>>>> a063f5c (Initial commit)
      status: 'applied', 
      createdAt: new Date().toISOString()
    };
    
    await storageService.saveApplications([newApp]);
    
    const hName = hospitals.find(h => h.id === hospitalId)?.name || 'Hospital';
    
    setTimeout(() => { 
      refreshData(); 
      setLoading(false); 
      setSuccessApplication({ hosp: hName, sess: session });
    }, 600);
  };

    const handleCancelAttendance = async (passId: string, applicationId: string) => {
    setConfirmCancelId(null);
    setLoading(true);
    try {
      const pass = passes.find(p => p.id === passId);
      if (!pass) throw new Error("Pass not found");

      const result = await storageService.requestCancellation({
        applicationId,
        passId,
        mrId: user.id,
        companyId: user.companyId || '',
        hospitalId: pass.hospitalId,
        session: pass.session,
        date: pass.passDate,
        reason: "Personal reasons / Unable to attend" // Could be a prompt
      });

      if (result.success) {
        showFeedback(result.message, "success");
        await refreshData();
      } else {
        showFeedback(result.message, "error");
      }
    } catch (err) {
      console.error("Cancel Attendance Error:", err);
      showFeedback("Failed to submit cancellation request.", "error");
    } finally {
      setLoading(false);
    }
  };

  const todayStr = new Date().toLocaleDateString('en-CA');
  const activePassesToday = passes
    .filter(p => p.entryStatus === 'not_entered' && p.passDate === todayStr)
    .filter((p, index, self) => 
      index === self.findIndex((t) => (
        t.hospitalId === p.hospitalId && t.session === p.session
      ))
    );
  const currentVisitsToday = passes
    .filter(p => p.entryStatus === 'entered' && p.passDate === todayStr)
    .filter((p, index, self) => 
      index === self.findIndex((t) => (
        t.hospitalId === p.hospitalId && t.session === p.session
      ))
    );

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tighter leading-none">
            Welcome, {user.fullName?.split(' ')[0] || 'User'}
          </h2>
          <div className="flex items-center gap-2 mt-2">
            <div className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {user.companyName}
            </div>
            <div className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              {user.mrId}
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Modal */}
      {detailedStrategy && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-white rounded-[3rem] shadow-2xl p-10 max-w-lg w-full relative animate-in zoom-in-95 duration-300">
              <button onClick={() => setDetailedStrategy(null)} className="absolute top-8 right-8 p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="h-5 w-5 text-slate-500" /></button>
              <div className="flex items-center gap-4 mb-8">
                 <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg">
                    <Sparkles className="h-6 w-6 text-white" />
                 </div>
                 <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tighter">Lottery Strategy</h3>
                    <p className="text-xs font-black text-indigo-500 uppercase tracking-widest">Rule-Based Analysis v3.5</p>
                 </div>
              </div>
              <div className="prose prose-indigo max-w-none">
                 <p className="text-slate-600 font-medium leading-relaxed mb-6 whitespace-pre-line">{detailedStrategy}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-8">
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Win Probability</p>
                    <p className="text-xl font-black text-indigo-600">Calculated</p>
                 </div>
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Priority Rank</p>
                    <p className="text-xl font-black text-slate-800">Fixed Rules</p>
                 </div>
              </div>
              <button onClick={() => setDetailedStrategy(null)} className="w-full mt-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl">Dismiss Strategy</button>
           </div>
        </div>
      )}

      {/* Electronic Badge Modal */}
      {showBadgePass && (
        <VisitingBadgeModal 
          pass={showBadgePass} 
          mr={user} 
          hospital={hospitals.find(h => h.id === showBadgePass.hospitalId)}
          onClose={() => setShowBadgePass(null)}
        />
      )}

      {/* Success Modal */}
      {successApplication && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] shadow-2xl p-10 max-sm w-full text-center animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Request Received!</h3>
            <p className="text-slate-500 text-sm mt-2 font-medium leading-relaxed">
              Application for <span className="text-indigo-600 font-bold">{successApplication.hosp}</span> ({successApplication.sess}) has been indexed. 
              The engine will finalize results at the hospital's next scheduled spin.
            </p>
            <button 
              onClick={() => setSuccessApplication(null)}
              className="mt-8 w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* 60s Approval Countdown Overlay */}
      {validatedPass && (
        <div className="fixed inset-0 z-[110] bg-green-600 flex flex-col items-center justify-center p-8 animate-in zoom-in duration-300">
          <div className="w-full max-w-sm text-center">
            <div className="bg-white/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse shadow-2xl"><CheckCircle2 className="h-16 w-16 text-white" /></div>
            <h2 className="text-4xl font-black text-white mb-2 tracking-tighter uppercase">Gate Open</h2>
            <p className="text-green-100 font-bold uppercase tracking-widest text-[10px] mb-12">Validation Verified • Proceed Immediately</p>
            <div className="bg-white/10 rounded-[2.5rem] p-10 backdrop-blur-md border border-white/20 shadow-2xl">
              <p className="text-white/60 text-xs font-black uppercase tracking-widest mb-2">Gate Timer</p>
              <div className="text-8xl font-black text-white tabular-nums tracking-tighter">{countdown}</div>
              <p className="text-white/80 text-sm font-bold mt-4">Seconds remaining for entry</p>
            </div>
            <button onClick={() => setValidatedPass(null)} className="mt-12 px-8 py-4 bg-white text-green-700 rounded-2xl font-black text-xs uppercase shadow-xl active:scale-95 transition-all">Dismiss Counter</button>
          </div>
        </div>
      )}

      {/* Scan Result Dialog */}
      {scanResult && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`${scanResult.status === 'success' ? 'bg-gradient-to-br from-emerald-500 to-green-600' : 'bg-gradient-to-br from-red-500 to-rose-600'} rounded-[2.5rem] shadow-2xl p-8 max-w-sm w-full text-center animate-in zoom-in duration-300 border ${scanResult.status === 'success' ? 'border-emerald-400' : 'border-red-400'}`}>
            <div className={`w-20 h-20 ${scanResult.status === 'success' ? 'bg-white/30' : 'bg-white/20'} rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse`}>
              {scanResult.status === 'success' ? (
                <CheckCircle className="h-12 w-12 text-white" />
              ) : (
                <XCircle className="h-12 w-12 text-white" />
              )}
            </div>
            <h3 className="text-3xl font-black text-white tracking-tight uppercase">{scanResult.status === 'success' ? 'Success' : 'Scanning Failed'}</h3>
            <p className="text-white/90 font-bold text-sm mt-4 leading-relaxed whitespace-pre-line">{scanResult.message}</p>
            {scanResult.status === 'success' && (
              <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mt-6">Please proceed to the gate</p>
            )}
          </div>
        </div>
      )}

<<<<<<< HEAD
      {/* Tabs */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit gap-1 overflow-x-auto max-w-full">
        <button onClick={() => setActiveTab('passes')} className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'passes' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><QrCode className="h-4 w-4" /> My Access</button>
        <button onClick={() => setActiveTab('directory')} className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'directory' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Building2 className="h-4 w-4" /> Facility Hub</button>
        <button onClick={() => setActiveTab('profile')} className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'profile' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><UserCircle className="h-4 w-4" /> Identity</button>
=======
      {/* Score Info Modal */}
      {showScoreModal && mrScore && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-md w-full animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <Flame className="h-6 w-6 text-amber-500" />
                Priority Score
              </h3>
              <button onClick={() => setShowScoreModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Main Score Display */}
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 rounded-2xl shadow-lg border border-indigo-500 mb-6">
              <div className="text-center mb-4">
                <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-2">Current Priority Score</p>
                <p className="text-5xl font-black text-white tracking-tight">{mrScore.priorityScore}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/20 text-center">
                  <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-1">Credit Points</p>
                  <p className="text-3xl font-black text-white">{mrScore.credit}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/20 text-center">
                  <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mb-1">Days to Reset</p>
                  <p className="text-3xl font-black text-white">{daysUntilReset}</p>
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

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-end animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Bell className="h-5 w-5 text-indigo-600" />
                Notifications
              </h3>
              <button onClick={() => setShowNotifications(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <div className="p-8 text-center opacity-40">
                  <Bell className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No notifications</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div key={notif.id} className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${!notif.read ? 'bg-indigo-50' : ''}`}>
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {!notif.read && <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>}
                          <h4 className="font-black text-slate-800 text-sm">{notif.title}</h4>
                        </div>
                        <p className="text-[10px] text-slate-600 leading-relaxed">{notif.message}</p>
                        <p className="text-[9px] text-slate-400 mt-2">
                          {new Date(notif.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          await NotificationService.deleteNotification(notif.id);
                          setNotifications(notifications.filter(n => n.id !== notif.id));
                        }}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {notifications.filter(n => !n.read).length > 0 && (
              <div className="p-4 border-t border-slate-100">
                <button
                  onClick={async () => {
                    await NotificationService.markAllAsRead(user.id);
                    setNotifications(notifications.map(n => ({ ...n, read: true })));
                  }}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-colors"
                >
                  Mark All as Read
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit gap-1 overflow-x-auto max-w-full items-center">
        <button onClick={() => setActiveTab('passes')} className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'passes' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><QrCode className="h-4 w-4" /> My Access</button>
        <button onClick={() => setActiveTab('directory')} className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'directory' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><Building2 className="h-4 w-4" /> Facility Hub</button>
        <button onClick={() => setActiveTab('profile')} className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'profile' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><UserCircle className="h-4 w-4" /> Identity</button>
        
        <div className="ml-auto pl-4 border-l border-slate-200">
          <button
            onClick={() => setShowNotifications(true)}
            className="relative p-2.5 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <Bell className="h-5 w-5 text-slate-500" />
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </button>
        </div>
>>>>>>> a063f5c (Initial commit)
      </div>

      {/* Logic Insights Bar */}
      {activeTab !== 'profile' && (
        <div className="bg-indigo-600 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-xl shadow-indigo-200/50 animate-in slide-in-from-top-2 border border-indigo-500">
           <div className="flex items-start gap-3">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm mt-0.5">
                <Info className="h-4 w-4 text-indigo-100" />
              </div>
              <p className="text-sm text-indigo-50 leading-relaxed font-bold italic">"{aiInsight || "Synchronizing field intelligence..."}"</p>
           </div>
           <button 
             onClick={handleFetchStrategy}
             disabled={isStrategyLoading}
             className="px-4 py-2 bg-white text-indigo-700 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap flex items-center gap-2 hover:bg-indigo-50 transition-all active:scale-95 shadow-lg"
           >
              {isStrategyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
              Full Strategy
           </button>
        </div>
      )}

      {activeTab === 'passes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 lg:col-span-2">
            <div className="flex justify-between items-center mb-8">
               <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                    <Building2 className="h-6 w-6 text-indigo-600" />
                    Booking Station
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">Authorized Facilities Only</p>
               </div>
               <div className="bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Sync v3.5.0</p>
               </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {hospitals.filter(h => approvals.some(a => a.mrId === user.id && a.hospitalId === h.id && a.status === 'approved')).map(h => (
                <div key={h.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-200/50 hover:shadow-xl hover:border-indigo-200 transition-all group hover:-translate-y-1 duration-500">
                  <p className="font-black text-slate-800 text-lg mb-6 group-hover:text-indigo-600 transition-colors leading-tight">{h.name}</p>
                  <div className="space-y-4">
                    {h.supportedSessions.map(sess => {
                      const open = isSessionWindowOpen(h, sess);
                      const window = h.sessionWindows?.[sess];
                      const alreadyApplied = getTodayApplication(h.id, sess);
                      const cooldown = getSessionCooldownInfo(h.id, sess);
                      
                      let btnText = open ? 'DEPLOY NOW' : 'LOCKED';
                      let btnColor = open ? 'bg-white border-2 border-indigo-100 hover:border-indigo-500 text-indigo-700 shadow-sm active:scale-95' : 'bg-slate-200 text-slate-400 grayscale cursor-not-allowed';
                      
                      if (cooldown?.isActive) {
                        btnText = `COOLDOWN (${cooldown.nextEligibleDateStr})`;
                        btnColor = 'bg-amber-50 border-2 border-amber-200 text-amber-700 hover:bg-amber-100';
                      } else if (alreadyApplied) {
                        btnText = 'DEPLOYED';
                        btnColor = 'bg-green-50 border-2 border-green-200 text-green-700 hover:bg-green-100';
                      }

                      return (
                        <div key={sess} className="space-y-1">
                          <button 
                            disabled={(!open && !alreadyApplied && !cooldown?.isActive) || loading} 
                            onClick={() => handleApply(h.id, sess)} 
                            className={`w-full py-4 px-5 rounded-2xl text-[10px] font-black flex items-center justify-between transition-all ${btnColor}`}
                          >
                            <span className="flex items-center gap-2">
                              {sess === 'MORNING' ? <Sun className="h-4 w-4" /> : sess === 'EVENING' ? <Moon className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                              {sess}
                            </span>
                            <span className="flex items-center gap-1.5 font-black tracking-widest">
                              {alreadyApplied && !cooldown?.isActive && <CheckCircle className="h-3.5 w-3.5" />}
                              {cooldown?.isActive && <Timer className="h-3.5 w-3.5" />}
                              {btnText}
                            </span>
                          </button>
                          <div className="px-3 flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                            <span>Application Window:</span>
                            <span className="text-slate-600">{window?.start} - {window?.end}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {hospitals.filter(h => approvals.some(a => a.mrId === user.id && a.hospitalId === h.id && a.status === 'approved')).length === 0 && (
                <div className="col-span-full py-20 text-center bg-slate-50 rounded-[3rem] border border-dashed border-slate-200">
                  <div className="bg-white w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <Building2 className="h-8 w-8 text-slate-200" />
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">No Authorized Facility Nodes</p>
                  <button onClick={() => setActiveTab('directory')} className="text-xs font-black text-indigo-600 hover:underline flex items-center gap-2 mx-auto">
                    Browse Hub Directory <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-6">
<<<<<<< HEAD
=======
            {/* Priority Score Info Button */}
            {mrScore && (
              <button
                onClick={() => setShowScoreModal(true)}
                className="w-full bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 rounded-[2.5rem] shadow-lg border border-indigo-500 hover:shadow-xl hover:border-indigo-400 transition-all active:scale-95 text-left group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-500/20 p-3 rounded-2xl backdrop-blur-sm group-hover:bg-indigo-500/30 transition-colors">
                      <Info className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">Priority Score</p>
                      <p className="text-2xl font-black text-white tracking-tight mt-1">{mrScore.priorityScore}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-indigo-200 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            )}

>>>>>>> a063f5c (Initial commit)
            {/* Active Visit Badge Section */}
            {currentVisitsToday.length > 0 && (
              <div className="bg-green-600 p-8 rounded-[2.5rem] shadow-2xl border border-green-500 animate-in slide-in-from-right-10 duration-700 relative overflow-hidden group">
                 <BadgeCheck className="absolute -right-6 -bottom-6 h-32 w-32 text-white opacity-10 group-hover:scale-110 transition-transform duration-700" />
                 <div className="flex justify-between items-start mb-8 relative z-10">
                    <div>
                       <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                          <p className="text-[10px] font-black text-green-100 uppercase tracking-[0.3em]">Facility Active</p>
                       </div>
                       <h3 className="text-2xl font-black text-white tracking-tight leading-none">Access Granted</h3>
                    </div>
                    <CheckCircle2 className="h-7 w-7 text-white" />
                 </div>

                 {currentVisitsToday.map(v => {
                    const hospital = hospitals.find(h => h.id === v.hospitalId);
                    const sessionWindow = hospital?.sessionWindows?.[v.session];
                    return (
                      <div key={v.id} className="bg-white/10 rounded-3xl p-6 border border-white/20 backdrop-blur-md mb-4 relative z-10">
                         <p className="text-sm font-black text-white mb-2 truncate leading-tight">{hospital?.name}</p>
                         <div className="flex items-center justify-between text-[10px] font-black text-green-100 uppercase tracking-widest">
                            <span className="bg-white/20 px-3 py-1 rounded-lg">{v.session}</span>
                            <span className="flex items-center gap-1.5">
                              <Timer className="h-3.5 w-3.5" />
                              Exp {sessionWindow?.end}
                            </span>
                         </div>
                         <button 
                           onClick={() => setShowBadgePass(v)}
                           className="w-full mt-6 bg-white text-green-800 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-green-50 transition-all shadow-xl active:scale-95"
                         >
                            <ExternalLink className="h-4 w-4" /> SHOW ELECTRONIC BADGE
                         </button>
                      </div>
                    );
                 })}
              </div>
            )}

            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-black flex items-center gap-2 text-slate-800">
                  <QrCode className="h-6 w-6 text-indigo-600" /> 
                  Daily Permits
                </h3>
                {activePassesToday.some(p => {
                  const hosp = hospitals.find(h => h.id === p.hospitalId);
                  return getScanStatus(p.session, hosp?.entryWindows).open;
                }) && (
                  <button onClick={() => setIsScanning(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl active:scale-95 animate-pulse">
                    <Camera className="h-4 w-4" /> SCAN GATE
                  </button>
                )}
              </div>
              <div className="space-y-4">
                {activePassesToday.map(p => {
                  const hosp = hospitals.find(h => h.id === p.hospitalId);
                  const status = getScanStatus(p.session, hosp?.entryWindows);
                  return (
                    <div key={p.id} className={`p-6 border-2 rounded-3xl transition-all duration-500 ${status.open ? 'bg-indigo-50 border-indigo-200 shadow-lg scale-[1.02]' : 'bg-slate-50 border-slate-100 opacity-60 grayscale'}`}>
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                           {p.session === 'MORNING' ? <Sun className="h-4 w-4 text-amber-500" /> : p.session === 'EVENING' ? <Moon className="h-4 w-4 text-indigo-400" /> : <Maximize className="h-4 w-4 text-indigo-500" />}
                           <span className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.2em]">{p.session} SESSION</span>
                        </div>
                        {status.open ? (
                          <span className="text-[9px] font-black text-indigo-700 bg-white px-3 py-1 rounded-lg shadow-sm uppercase tracking-widest">ACTIVE</span>
                        ) : (
                          <span className="text-[9px] font-black text-slate-400 bg-white px-3 py-1 rounded-lg shadow-sm uppercase tracking-widest">PENDING</span>
                        )}
                      </div>
                      <p className="font-black text-slate-800 text-base mb-4 leading-tight">{hosp?.name}</p>
                      
                      <div className="space-y-3 mb-6">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-tighter bg-white/60 p-2.5 rounded-xl border border-slate-100">
                          <span>Gate Access Window</span>
                          <span className="text-indigo-600 font-black">{status.range}</span>
                        </div>
<<<<<<< HEAD
=======
                        
                        {/* Cancellation Deadline Timer */}
                        {cancellationTimers[p.id] && cancellationTimers[p.id] > 0 && (
                          <div className="flex justify-between items-center text-[10px] font-black uppercase text-amber-600 tracking-tighter bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                            <span>Cancellation Allowed Until</span>
                            <span className="font-mono">{CancellationService.formatTimeRemaining(cancellationTimers[p.id])}</span>
                          </div>
                        )}
>>>>>>> a063f5c (Initial commit)
                      </div>

                      {!status.open ? (
                         <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] font-bold text-amber-800 leading-tight">{status.message}</p>
                         </div>
                      ) : (
                        <div className="flex items-center gap-3 p-3 bg-green-100 rounded-xl border border-green-200 shadow-inner">
                            <Clock className="h-4 w-4 text-green-600 shrink-0" />
                            <p className="text-[10px] font-black text-green-700 uppercase tracking-widest">GATE OPEN • EXIT AT {status.end}</p>
                         </div>
                      )}

                      <button 
                         onClick={() => setConfirmCancelId({ passId: p.id, appId: p.applicationId })}
<<<<<<< HEAD
                        disabled={loading}
                        className="w-full mt-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100 flex items-center justify-center gap-2"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Request Cancellation
=======
                        disabled={loading || !CancellationService.canCancelPass(hosp!, p.session, p.passDate)}
                        className={`w-full mt-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border ${
                          CancellationService.canCancelPass(hosp!, p.session, p.passDate)
                            ? 'bg-red-50 text-red-600 hover:bg-red-100 border-red-100'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                        }`}
                      >
                        <XCircle className="h-3.5 w-3.5" /> {CancellationService.canCancelPass(hosp!, p.session, p.passDate) ? 'Request Cancellation' : 'Cancellation Period Ended'}
>>>>>>> a063f5c (Initial commit)
                      </button>
                    </div>
                  );
                })}
                {activePassesToday.length === 0 && currentVisitsToday.length === 0 && (
                  <div className="text-center py-16 opacity-30">
                    <QrCode className="h-12 w-12 mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Active Permits</p>
                  </div>
                )}
                {activePassesToday.length === 0 && currentVisitsToday.length > 0 && (
                  <div className="text-center py-6 bg-green-50 rounded-3xl border border-green-100 text-green-700">
                     <p className="text-[10px] font-black uppercase tracking-widest">Daily Schedule Completed</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'directory' && (
        <section className="space-y-6">
          <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Facility Directory</h3>
                <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-widest">Synchronized Global Network</p>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Filter by name or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {hospitals.filter(h => h.isActive && h.name.toLowerCase().includes(searchTerm.toLowerCase())).map(h => {
                const approval = approvals.find(a => a.mrId === user.id && a.hospitalId === h.id);
                
                return (
                  <div key={h.id} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-200/50 flex flex-col hover:shadow-2xl hover:border-indigo-300 transition-all duration-500 group relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 bg-indigo-600/5 h-24 w-24 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                    <div className="flex justify-between items-start mb-6 relative z-10">
                      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 group-hover:bg-indigo-600 group-hover:border-indigo-500 transition-all duration-500">
                        <Building2 className="h-7 w-7 text-indigo-500 group-hover:text-white" />
                      </div>
                      {approval && (
                        <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ${
                          approval.status === 'approved' ? 'bg-green-100 text-green-700 border border-green-200' : 
                          approval.status === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 
                          'bg-red-100 text-red-700 border border-red-200'
                        }`}>
                          {approval.status}
                        </span>
                      )}
                    </div>
                    
                    <h4 className="font-black text-xl text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors tracking-tight leading-tight">{h.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold flex items-center gap-2 mb-8">
                      <MapPin className="h-3.5 w-3.5 text-slate-300" /> {h.address || 'Address withheld for privacy'}
                    </p>

                    <div className="mt-auto pt-6 border-t border-slate-200/50 relative z-10">
                      {approval?.status === 'approved' ? (
                        <div className="flex items-center justify-center gap-3 py-4 bg-green-50 text-green-800 rounded-2xl text-[10px] font-black border border-green-200 shadow-sm uppercase tracking-widest">
                          <ShieldCheck className="h-4 w-4" /> NODE AUTHORIZED
                        </div>
                      ) : approval?.status === 'pending' ? (
                        <div className="flex items-center justify-center gap-3 py-4 bg-amber-50 text-amber-800 rounded-2xl text-[10px] font-black border border-amber-200 shadow-sm uppercase tracking-widest">
                          <Clock className="h-4 w-4" /> VERIFICATION PENDING
                        </div>
                      ) : (
                        <button 
                          disabled={loading}
                          onClick={() => handleRequestAccess(h.id)}
                          className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black shadow-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
                        >
                          <PlusCircle className="h-4 w-4" /> REQUEST ACCESS
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'profile' && (
        <section className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-100 max-w-3xl mx-auto overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50 blur-3xl"></div>
          <div className="flex flex-col items-center mb-12 text-center relative z-10">
            <div className="w-28 h-28 bg-white p-1 rounded-[2.5rem] shadow-2xl mb-6 relative group">
               <div className="absolute inset-0 bg-indigo-600 rounded-[2.5rem] scale-[1.02] -z-10 group-hover:scale-110 transition-transform duration-500"></div>
               <div className="w-full h-full rounded-[2.3rem] overflow-hidden bg-slate-100 flex items-center justify-center">
                  {user.slcpiPhoto ? (
                    <img src={user.slcpiPhoto} className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle className="h-16 w-16 text-indigo-200" />
                  )}
               </div>
            </div>
            <h3 className="text-4xl font-black text-slate-800 tracking-tighter leading-none">{user.fullName}</h3>
            <p className="text-indigo-600 font-black uppercase tracking-[0.3em] text-[10px] mt-3 bg-indigo-50 px-4 py-1.5 rounded-full">{user.companyName}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 relative z-10">
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
               <div className="flex items-center gap-2 mb-6">
                 <ShieldCheck className="h-4 w-4 text-indigo-500" />
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Fingerprint</p>
               </div>
               <div className="space-y-4">
                  <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Login ID</span>
                    <span className="text-sm font-black text-slate-700 font-mono tracking-tighter">{user.loginId}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">System CID</span>
                    <span className="text-xs font-black text-slate-500 font-mono tracking-tighter">{user.id}</span>
                  </div>
               </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
               <div className="flex items-center gap-2 mb-6">
                 <Smartphone className="h-4 w-4 text-indigo-500" />
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Field Contacts</p>
               </div>
               <div className="space-y-4">
                  <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Verified Mobile</span>
                    <span className="text-sm font-black text-slate-800">{user.mobileNumber || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Access Level</span>
                    <span className="text-[9px] font-black text-indigo-700 uppercase tracking-[0.2em] bg-indigo-100 px-3 py-1.5 rounded-lg shadow-sm">Field Pro 3.5</span>
                  </div>
               </div>
            </div>
          </div>

          <div className="p-8 bg-indigo-700 rounded-[3rem] text-white flex items-center justify-between shadow-2xl relative overflow-hidden group z-10">
            <Zap className="absolute -right-10 -bottom-10 h-48 w-48 opacity-10 group-hover:scale-110 group-hover:-rotate-12 transition-all duration-700" />
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Primary Affiliation</p>
              <h4 className="text-3xl font-black tracking-tighter">{user.companyName}</h4>
            </div>
            <div className="bg-white/10 px-6 py-3 rounded-2xl backdrop-blur-md border border-white/20 relative z-10 shadow-lg">
               <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-100">Status: Operational</p>
            </div>
          </div>
        </section>
      )}

      {isScanning && <QRScannerModal onClose={() => setIsScanning(false)} onScan={handleScanDetected} mrId={user.id} hospitals={hospitals} />}

      {/* Cancellation Confirmation Modal */}
      {confirmCancelId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] shadow-2xl p-10 max-sm w-full text-center animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-10 w-10 text-red-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Cancel Session Request?</h3>
            <p className="text-slate-500 text-sm mt-2 font-medium leading-relaxed">
              Submit a cancellation request to your company. If approved, the next candidate from the waiting list will attend this session.
            </p>
            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setConfirmCancelId(null)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
              >
                No, Keep it
              </button>
              <button 
                onClick={() => confirmCancelId && handleCancelAttendance(confirmCancelId.passId, confirmCancelId.appId)}
                className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-red-700 transition-all active:scale-95"
              >
                Yes, Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MRDashboard;
