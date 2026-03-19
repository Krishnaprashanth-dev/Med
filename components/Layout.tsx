
import React from 'react';
import { LogOut, User, Hospital as HospitalIcon, ClipboardList, ShieldCheck, Zap, Activity } from 'lucide-react';
import { storageService } from '../services/storageService';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  onLogout: () => void;
  title: string;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, title }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-indigo-700 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/20">
              <HospitalIcon className="h-6 w-6 text-indigo-100" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter leading-none">MedPass</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-indigo-200 uppercase font-black tracking-widest">{user.role}</span>
                <span className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></span>
                <span className="text-[9px] text-indigo-300 font-bold">v3.5 Live</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex flex-col items-end mr-2">
              <span className="text-xs font-bold text-indigo-100">{user.fullName}</span>
              <span className="text-[10px] text-indigo-300 font-medium">Session Active</span>
            </div>
            <button 
              onClick={onLogout}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all active:scale-90 border border-white/10"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">{title}</h2>
            <p className="text-sm text-slate-400 font-medium mt-1">Hospital Access & Intelligence Network</p>
          </div>
        </div>
        {children}
      </main>

      <footer className="bg-white border-t border-slate-100 py-16">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center space-y-8">
          <div className="text-slate-400 text-[10px] font-bold tracking-[0.2em] uppercase">
            &copy; {new Date().getFullYear()} MedPass Intelligence Hub • v3.5.0
          </div>
          
          <div className="flex flex-col items-center gap-4 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-700 cursor-default group">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-1">Powered by</span>
            <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm group-hover:shadow-2xl group-hover:border-indigo-400 group-hover:-translate-y-1 transition-all duration-500 relative">
              <div className="absolute inset-0 bg-indigo-500/5 blur-xl group-hover:bg-indigo-500/10 transition-all rounded-full"></div>
              <div className="bg-slate-900 p-2.5 rounded-xl shadow-lg group-hover:bg-indigo-600 transition-colors relative z-10">
                <Zap className="h-4 w-4 text-indigo-400 group-hover:text-white" />
              </div>
              <div className="flex flex-col leading-none relative z-10">
                <span className="text-lg font-black text-slate-900 tracking-tighter">medPass Engine</span>
                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-0.5">Professional Field Intelligence 3.5</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
