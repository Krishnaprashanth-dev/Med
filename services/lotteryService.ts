import { storageService } from './storageService';
import { SessionType, IssuedPass, PassApplication } from '../types';
import { ScoringService } from './ScoringService';
import { NotificationService } from './NotificationService';
import { safeRandomUUID } from '../constants';

export const lotteryService = {
  /**
   * Run the lottery with new scoring system that includes credit tie-breaker
   */
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

    // Track apps removed by cooldown
    const cooldownRejectedApps = eligibleApps.filter(
      app => !filteredApps.find(f => f.id === app.id)
    );

    if (filteredApps.length === 0) {
      if (cooldownRejectedApps.length > 0) {
        const cooldownUpdated = cooldownRejectedApps.map(app => ({
          ...app,
          status: 'waitlisted' as const
        }));
        await storageService.saveApplications(cooldownUpdated);
      }
      return { success: false, count: 0, message: "No eligible applications after cooldown check." };
    }

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

    // Handle tie-breaking: when multiple MRs have same score and one is selected
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
    const newPasses: IssuedPass[] = selected.map((s) => ({
      id: safeRandomUUID(),
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
      if (usedApplicants.has(s.id)) {
        return { ...s, status: 'selected' as const, score: undefined };
      }
      return { ...s, status: 'waitlisted' as const, score: undefined };
    });

    // Also mark cooldown-rejected apps as waitlisted
    const cooldownUpdated = cooldownRejectedApps.map(app => ({
      ...app,
      status: 'waitlisted' as const
    }));

    await storageService.saveApplications([...updatedApps, ...cooldownUpdated]);
    await storageService.savePasses(newPasses);
    await storageService.log('SYSTEM', 'LOTTERY_RUN', `Hospital: ${hosp.name}, Session: ${session}, Passes: ${selected.length}`);

    // Create notifications for selected MRs
    for (const sel of selected) {
      try {
        await NotificationService.createNotification(
          sel.mrId,
          'session_selected',
          'Session Selected',
          `You have been selected for the ${session} session at ${hosp.name} on ${today}.`,
          sel.id
        );
      } catch (err) {
        console.error("Failed to create selection notification:", err);
      }
    }

    // Create notifications for waitlisted MRs
    const waitlistedMRs = scored.slice(selected.length);
    for (const wait of waitlistedMRs) {
      try {
        await NotificationService.createNotification(
          wait.mrId,
          'session_waitlist',
          'Session Waitlisted',
          `You are waitlisted for the ${session} session at ${hosp.name} on ${today}.`,
          wait.id
        );
      } catch (err) {
        console.error("Failed to create waitlist notification:", err);
      }
    }

    // Create notifications for cooldown waitlisted MRs
    for (const wait of cooldownRejectedApps) {
      try {
        await NotificationService.createNotification(
          wait.mrId,
          'session_waitlist',
          'Session Waitlisted',
          `You are waitlisted (cooldown) for the ${session} session at ${hosp.name} on ${today}.`,
          wait.id
        );
      } catch (err) {
        console.error("Failed to create cooldown waitlist notification:", err);
      }
    }
  
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
    
    return {
      success: true,
      count: selected.length,
      message: `Successfully selected ${selected.length} applicants.`,
      selectedMrIds: selected.map(s => s.mrId)
    };
  }
};
