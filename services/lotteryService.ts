import { storageService } from './storageService';
import { SessionType, IssuedPass, PassApplication } from '../types';
<<<<<<< HEAD
import { PRIORITY_WEIGHTS } from '../constants';

export const lotteryService = {
  /**
   * Calculates a priority score based on historical entry/missed behavior.
   */
  calculatePriority: (mrId: string, allPasses: IssuedPass[]): number => {
    let score = 0;
    const now = new Date();
    const mrPasses = allPasses.filter(p => p.mrId === mrId);
    
    // 1. Penalty for missed entries (expired passes)
    const missed = mrPasses.filter(p => p.entryStatus === 'expired');
    score += missed.length * PRIORITY_WEIGHTS.MISSED_ENTRY;

    // 2. Bonus for time since last successful entry
    const entered = mrPasses.filter(p => p.entryStatus === 'entered');
    
    if (entered.length > 0) {
      const sorted = [...entered].sort((a, b) => new Date(b.passDate).getTime() - new Date(a.passDate).getTime());
      const last = new Date(sorted[0].passDate);
      const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 3600 * 24));
      
      if (diffDays >= 14) score += PRIORITY_WEIGHTS.NO_PASS_14_DAYS;
      else if (diffDays >= 7) score += PRIORITY_WEIGHTS.NO_PASS_7_DAYS;
      
      // 3. Cooldown penalty (secondary check for scoring)
      if (diffDays <= 3) score += PRIORITY_WEIGHTS.PASS_IN_LAST_3_DAYS;
    } else {
      // First timers or long-term absent get high priority
      score += PRIORITY_WEIGHTS.NO_PASS_14_DAYS;
    }
    
    return score;
  },

=======
import { ScoringService } from './ScoringService';

export const lotteryService = {
  /**
   * Run the lottery with new scoring system that includes credit tie-breaker
   */
>>>>>>> a063f5c (Initial commit)
  runLottery: async (hospitalId: string, session: SessionType): Promise<{ success: boolean; count: number; message: string; selectedMrIds?: string[] }> => {
    const hospitals = await storageService.getHospitals();
    const hosp = hospitals.find(h => h.id === hospitalId);
    if (!hosp) return { success: false, count: 0, message: "Hospital not found" };

    // Use Local Date (YYYY-MM-DD) to ensure it matches the user's current day
    const today = new Date().toLocaleDateString('en-CA');
    
    const sessionApps = await storageService.getApplications({ hospitalId, date: today });
    
    // Check if already executed
    const alreadyRun = sessionApps.some(a => 
      a.session === session && (a.status === 'selected' || a.status === 'waitlisted')
    );
    if (alreadyRun) return { success: false, count: 0, message: "Lottery already executed for this session today." };

    let eligibleApps = sessionApps.filter(a => a.session === session && a.status === 'applied');
    if (eligibleApps.length === 0) return { success: false, count: 0, message: `No eligible applications found for ${today}.` };

    // ENHANCED FEATURE: Hard Cooldown Check (3 Days)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toLocaleDateString('en-CA');

    const mrIds = eligibleApps.map(a => a.mrId);
    const recentPasses = await storageService.getPasses({ 
      mrId: mrIds,
      hospitalId, 
      session 
    });

    // Remove applicants who had a pass in the last 3 days
    const filteredApps = eligibleApps.filter(app => {
      const hasRecent = recentPasses.some(p => p.mrId === app.mrId && p.passDate >= threeDaysAgoStr && p.passDate < today);
      return !hasRecent;
    });

<<<<<<< HEAD
    // ✅ FIX: Track apps removed by cooldown — they need a terminal status too
=======
    // Track apps removed by cooldown
>>>>>>> a063f5c (Initial commit)
    const cooldownRejectedApps = eligibleApps.filter(
      app => !filteredApps.find(f => f.id === app.id)
    );

    if (filteredApps.length === 0) {
<<<<<<< HEAD
      // ✅ FIX: Even if everyone is cooldown-rejected, mark them all as waitlisted
      // so they don't stay stuck as 'applied' and re-appear in the MR dashboard
=======
>>>>>>> a063f5c (Initial commit)
      if (cooldownRejectedApps.length > 0) {
        const cooldownUpdated = cooldownRejectedApps.map(app => ({
          ...app,
          status: 'waitlisted' as const
        }));
        await storageService.saveApplications(cooldownUpdated);
      }
      return { success: false, count: 0, message: "No eligible applications after cooldown check." };
    }

<<<<<<< HEAD
    // Calculate Scores
    const allPassesForPriority = await storageService.getPasses({ mrId: filteredApps.map(a => a.mrId) });
    const scored = filteredApps.map(a => ({ 
      ...a, 
      priorityScore: lotteryService.calculatePriority(a.mrId, allPassesForPriority) 
    }));
    
    // Sort by priority (Highest score first)
    scored.sort((a, b) => b.priorityScore - a.priorityScore);
=======
    // Get scores for all applicants using new ScoringService
    const allMRScores = await ScoringService.getAllMRScores();
    const scoreMap = new Map(allMRScores.map(s => [s.mrId, s]));

    // Enrich applications with scores and perform resets if needed
    const scored = await Promise.all(
      filteredApps.map(async (a) => {
        const score = await ScoringService.checkAndPerformReset(a.mrId);
        return {
          ...a,
          score,
        };
      })
    );
    
    // Sort by priority score (highest first), then by credit (highest first) for tie-breaking
    scored.sort((a, b) => {
      if (b.score.priorityScore !== a.score.priorityScore) {
        return b.score.priorityScore - a.score.priorityScore;
      }
      return b.score.credit - a.score.credit;
    });
>>>>>>> a063f5c (Initial commit)

    const sessionLimit = hosp.passLimits?.[session] || 0;
    const companyLimit = hosp.companyPassLimit?.[session];

    let selected: typeof scored = [];
    let usedApplicants = new Set<string>();

    // ENHANCED FEATURE: Multi-Round Cycle Allocation with Strict Cap
    if (companyLimit && companyLimit > 0) {
      const allMRs = await storageService.getMRs();
      const mrMap = new Map(allMRs.map(mr => [mr.id, mr]));
      const applicantsByCompany = new Map<string, typeof scored>();
      
      for (const app of scored) {
        const companyId = mrMap.get(app.mrId)?.companyId || 'UNASSIGNED';
        if (!applicantsByCompany.has(companyId)) applicantsByCompany.set(companyId, []);
        applicantsByCompany.get(companyId)!.push(app);
      }

      const companyPassCount = new Map<string, number>();

      // Keep cycling through companies until hospital is full or we run out of people
      while (selected.length < sessionLimit) {
        let allocatedThisRound = 0;

        for (const [companyId, applicants] of applicantsByCompany) {
          if (selected.length >= sessionLimit) break;

          const currentCount = companyPassCount.get(companyId) || 0;
          
          // STRICT CAP: If company hasn't reached its absolute limit
          if (currentCount < companyLimit) {
            const nextApp = applicants.find(a => !usedApplicants.has(a.id));
            if (nextApp) {
              selected.push(nextApp);
              usedApplicants.add(nextApp.id);
              companyPassCount.set(companyId, currentCount + 1);
              allocatedThisRound++;
            }
          }
        }
        if (allocatedThisRound === 0) break;
      }
    } else {
      // Simple limit if no company caps exist
      selected = scored.slice(0, sessionLimit);
      selected.forEach(s => usedApplicants.add(s.id));
    }

<<<<<<< HEAD
    // Create New Passes
    // ✅ FIX: Use crypto.randomUUID() to generate a valid UUID for each pass.
    // Previously used `PASS-${s.id}` which produced an invalid UUID string
    // and caused Supabase to reject the insert with a 400 "invalid input syntax for type uuid" error.
=======
    // Handle tie-breaking: when multiple MRs have same score and one is selected
    // The selected one gets credit = 0, others with same score get credit += 1
    const nonSelectedMrIds: string[] = [];
    scored.forEach(app => {
      if (!usedApplicants.has(app.id) && selected.some(s => s.score.priorityScore === app.score.priorityScore)) {
        nonSelectedMrIds.push(app.mrId);
      }
    });
    
    if (selected.length > 0 && nonSelectedMrIds.length > 0) {
      const selectedMrId = selected[selected.length - 1]?.mrId;
      if (selectedMrId) {
        await ScoringService.handleTieBreaking(selectedMrId, nonSelectedMrIds);
      }
    }

    // Create New Passes
>>>>>>> a063f5c (Initial commit)
    const newPasses: IssuedPass[] = selected.map((s) => ({
      id: crypto.randomUUID(),
      applicationId: s.id,
      mrId: s.mrId,
      hospitalId: s.hospitalId,
      session,
      passDate: today,
      timeSlot: "",
      qrCode: `QR-${s.id}`,
      entryStatus: 'not_entered'
    }));

    // Mark scored apps as selected or waitlisted
    const updatedApps = scored.map(s => {
<<<<<<< HEAD
      if (usedApplicants.has(s.id)) return { ...s, status: 'selected' as const };
      return { ...s, status: 'waitlisted' as const };
    });

    // ✅ FIX: Also mark cooldown-rejected apps as waitlisted so they don't stay
    // stuck as 'applied' — which caused the session to re-appear in MR dashboard
    // and prevented the permit window from showing after the lottery spin.
=======
      if (usedApplicants.has(s.id)) {
        return { ...s, status: 'selected' as const, score: undefined };
      }
      return { ...s, status: 'waitlisted' as const, score: undefined };
    });

    // Also mark cooldown-rejected apps as waitlisted
>>>>>>> a063f5c (Initial commit)
    const cooldownUpdated = cooldownRejectedApps.map(app => ({
      ...app,
      status: 'waitlisted' as const
    }));

    await storageService.saveApplications([...updatedApps, ...cooldownUpdated]);
    await storageService.savePasses(newPasses);
    await storageService.log('SYSTEM', 'LOTTERY_RUN', `Hospital: ${hosp.name}, Session: ${session}, Passes: ${selected.length}`);
  
    // Trigger Email Notifications
    if (selected.length > 0) {
      try {
        fetch('/api/notify-selection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mrIds: selected.map(s => s.mrId),
            hospitalId,
            session,
            date: today
          })
        }).catch(err => console.error("Notification trigger error:", err));
      } catch (err) {
        console.error("Notification error:", err);
      }
    }
<<<<<<< HEAD
    
    return { 
      success: true, 
      count: selected.length, 
      message: `Successfully issued ${selected.length} passes.`,
      selectedMrIds: selected.map(s => s.mrId)
    };
  }
=======

    return {
      success: true,
      count: selected.length,
      message: `Successfully selected ${selected.length} applicants`,
      selectedMrIds: selected.map(s => s.mrId)
    };
  },
>>>>>>> a063f5c (Initial commit)
};
