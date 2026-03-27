import { storageService } from './storageService';
import { SessionType, IssuedPass, PassApplication } from '../types';
import { PRIORITY_WEIGHTS } from '../constants';

export const lotteryService = {
  calculatePriority: (mrId: string, allPasses: IssuedPass[]): number => {
    let score = 0;
    const now = new Date();
    // Use pre-fetched passes for this specific MR
    const mrPasses = allPasses.filter(p => p.mrId === mrId);
    
    // Penalty for missed entries (expired passes)
    const missed = mrPasses.filter(p => p.entryStatus === 'expired');
    score += missed.length * PRIORITY_WEIGHTS.MISSED_ENTRY;

    // Bonus for time since last successful entry
    const entered = mrPasses.filter(p => p.entryStatus === 'entered');
    
    if (entered.length > 0) {
      const sorted = [...entered].sort((a, b) => new Date(b.passDate).getTime() - new Date(a.passDate).getTime());
      const last = new Date(sorted[0].passDate);
      const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 3600 * 24));
      
      if (diffDays >= 14) score += PRIORITY_WEIGHTS.NO_PASS_14_DAYS;
      else if (diffDays >= 7) score += PRIORITY_WEIGHTS.NO_PASS_7_DAYS;
      
      // Cooldown penalty
      if (diffDays <= 3) score += PRIORITY_WEIGHTS.PASS_IN_LAST_3_DAYS;
    } else {
      score += PRIORITY_WEIGHTS.NO_PASS_14_DAYS;
    }
    
    return score;
  },

  runLottery: async (hospitalId: string, session: SessionType): Promise<{ success: boolean; count: number; message: string }> => {
    const hospitals = await storageService.getHospitals();
    const hosp = hospitals.find(h => h.id === hospitalId);
    if (!hosp) return { success: false, count: 0, message: "Hospital not found" };

    const today = new Date().toISOString().split('T')[0];
    
    // Only fetch applications for this hospital and today
    const sessionApps = await storageService.getApplications({ hospitalId, date: today });
    
    const alreadyRun = sessionApps.some(a => 
      a.session === session && 
      (a.status === 'selected' || a.status === 'waitlisted')
    );

    if (alreadyRun) return { success: false, count: 0, message: "Lottery already executed for this session today." };

    let eligibleApps = sessionApps.filter(a => 
      a.session === session && 
      a.status === 'applied'
    );

    if (eligibleApps.length === 0) return { success: false, count: 0, message: "No eligible applications found." };

    // SERVER-SIDE REJECTION: Enforce Cooldown during lottery logic
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toLocaleDateString('en-CA');

    // BATCH FETCH: Get all passes for all eligible MRs in one query
    const mrIds = eligibleApps.map(a => a.mrId);
    const allRelevantPasses = await storageService.getPasses({ 
      mrId: mrIds,
      hospitalId, 
      session 
    });

    // For each applicant, check if they had a pass in the last 3 days for this hospital/session
    const filteredApps = eligibleApps.filter(app => {
      const recentPasses = allRelevantPasses.filter(p => p.mrId === app.mrId);
      const hasRecent = recentPasses.some(p => p.passDate >= threeDaysAgoStr && p.passDate < today);
      return !hasRecent;
    });

    if (filteredApps.length === 0) return { success: false, count: 0, message: "No eligible applications after cooldown check." };

    // BATCH FETCH: Get ALL passes for these MRs to calculate priority scores
    const finalMrIds = filteredApps.map(a => a.mrId);
    const allPassesForPriority = await storageService.getPasses({ mrId: finalMrIds });

    const scored = filteredApps.map(a => ({ 
      ...a, 
      priorityScore: lotteryService.calculatePriority(a.mrId, allPassesForPriority) 
    }));
    
    scored.sort((a, b) => b.priorityScore - a.priorityScore);

    const sessionLimit = hosp.passLimits?.[session] || 0;
    const companyLimit = hosp.companyPassLimit?.[session];

    let selected: typeof scored = [];
    let waitlisted: typeof scored = [];

    // Apply company-wise cap with multi-round allocation
    if (companyLimit && companyLimit > 0) {
      // Get MR data to extract company IDs
      const allMRs = await storageService.getMRs();
      const mrMap = new Map(allMRs.map(mr => [mr.id, mr]));

      // Group applicants by company, sorted by priority
      const applicantsByCompany = new Map<string, typeof scored>();
      
      for (const app of scored) {
        const mr = mrMap.get(app.mrId);
        const companyId = mr?.companyId || 'UNASSIGNED';
        if (!applicantsByCompany.has(companyId)) {
          applicantsByCompany.set(companyId, []);
        }
        applicantsByCompany.get(companyId)!.push(app);
      }

      // Multi-round allocation: Keep cycling through companies until limit reached
      const companyPassCount = new Map<string, number>();
      const usedApplicants = new Set<string>();

      while (selected.length < sessionLimit) {
        let allocatedThisRound = 0;

        // Cycle through each company
        for (const [companyId, applicants] of applicantsByCompany) {
          if (selected.length >= sessionLimit) break;

          const currentCount = companyPassCount.get(companyId) || 0;
          
          // If company hasn't reached their cap this round
          if (currentCount < companyLimit) {
            // Find next unused applicant from this company
            for (const app of applicants) {
              if (!usedApplicants.has(app.id) && selected.length < sessionLimit) {
                selected.push(app);
                usedApplicants.add(app.id);
                companyPassCount.set(companyId, currentCount + 1);
                allocatedThisRound++;
                break; // Move to next company
              }
            }
          }
        }

        // If no allocations were made in this round, stop (no more applicants available)
        if (allocatedThisRound === 0) break;

        // Reset company counters for next round
        companyPassCount.clear();
      }

      // Remaining applicants become waitlist
      waitlisted = scored.filter(app => !usedApplicants.has(app.id));
    } else {
      // No company limit: use original logic (simple limit)
      selected = scored.slice(0, sessionLimit);
      waitlisted = scored.slice(sessionLimit);
    }

    const newPasses: IssuedPass[] = selected.map((s) => ({
      id: `PASS-${s.id}`, // Deterministic ID based on application ID
      mrId: s.mrId,
      hospitalId: s.hospitalId,
      session,
      passDate: today,
      timeSlot: "",
      qrCode: `QR-${s.id}`,
      entryStatus: 'not_entered'
    }));

    // Update only the applications that were part of this lottery
    const updatedApps = scored.map(s => {
      const isSel = selected.find(x => x.id === s.id);
      if (isSel) return { ...s, status: 'selected' as const, priorityScore: isSel.priorityScore };
      
      const isWait = waitlisted.find(x => x.id === s.id);
      if (isWait) return { ...s, status: 'waitlisted' as const, priorityScore: isWait.priorityScore };
      
      return s;
    });

    await storageService.saveApplications(updatedApps);
    await storageService.savePasses(newPasses); // savePasses uses upsert, so this is fine

    await storageService.log('SYSTEM', 'LOTTERY_RUN', `Hospital: ${hosp.name}, Session: ${session}, Passes: ${selected.length}`);

    return { success: true, count: selected.length, message: `Successfully issued ${selected.length} passes.` };
  }
};