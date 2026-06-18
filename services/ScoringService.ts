import { storageService } from './storageService';
import { MRScore, IssuedPass, PassApplication, SessionType } from '../types';
import { PRIORITY_WEIGHTS, SCORING_CONFIG } from '../constants';
import { supabase } from '../supabaseClient';

const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const ScoringService = {
  /**
   * Get MR score from applications table - uses most recent application record
   */
  getMRScore: async (mrId: string): Promise<MRScore> => {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('mr_id', mrId)
      .order('application_date', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const app = data[0];
      return {
        id: app.id,
        mrId: app.mr_id,
        priorityScore: app.priority_score || 0,
        credit: app.credit || 0,
        lastResetDate: app.application_date,
        updatedAt: app.created_at,
      };
    }

    // Return default score for MR with no applications yet
    const today = new Date().toLocaleDateString('en-CA');
    return {
      id: crypto.randomUUID(),
      mrId: mrId,
      priorityScore: 0,
      credit: 0,
      lastResetDate: today,
      updatedAt: new Date().toISOString(),
    };
  },

  /**
   * Save score back to the most recent application record
   */
  saveMRScore: async (score: MRScore): Promise<void> => {
    // Update most recent application with new score and credit
    const { error } = await supabase
      .from('applications')
      .update({
        priority_score: score.priorityScore,
        credit: score.credit,
      })
      .eq('mr_id', score.mrId)
      .eq('id', score.id);
    
    if (error) throw error;
  },

  /**
   * Get all MR scores from applications table (for admin/company view)
   */
  getAllMRScores: async (): Promise<MRScore[]> => {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;

    const mrScoreMap = new Map<string, MRScore>();

    // Group by MR and keep the most recent application
    (data || []).forEach(app => {
      if (!mrScoreMap.has(app.mr_id)) {
        mrScoreMap.set(app.mr_id, {
          id: app.id,
          mrId: app.mr_id,
          priorityScore: app.priority_score || 0,
          credit: app.credit || 0,
          lastResetDate: app.application_date,
          updatedAt: app.created_at,
        });
      }
    });

    return Array.from(mrScoreMap.values());
  },

  /**
   * Check if 14 days have passed and perform reset if needed
   */
  checkAndPerformReset: async (mrId: string): Promise<MRScore> => {
    const score = await ScoringService.getMRScore(mrId);
    const today = new Date().toLocaleDateString('en-CA');
    const lastReset = new Date(score.lastResetDate);
    const now = new Date();

    const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 3600 * 24));

    if (daysSinceReset >= SCORING_CONFIG.RESET_DAYS) {
      // Perform reset: new score = old score / 4
      const resetScore = Math.floor(score.priorityScore / SCORING_CONFIG.RESET_DIVISOR);
      score.priorityScore = resetScore;
      score.credit = 0; // Reset credit on 14-day reset
      score.lastResetDate = today;
      await ScoringService.saveMRScore(score);
    }

    return score;
  },

  /**
   * Record session attendance: +5 points when MR enters the hospital
   */
  recordSessionAttendance: async (mrId: string): Promise<void> => {
    const score = await ScoringService.checkAndPerformReset(mrId);
    score.priorityScore += PRIORITY_WEIGHTS.SESSION_ATTENDED;
    await ScoringService.saveMRScore(score);
  },

  /**
   * Record session miss: -15 points when pass expires without entry
   */
  recordSessionMiss: async (mrId: string): Promise<void> => {
    const score = await ScoringService.checkAndPerformReset(mrId);
    score.priorityScore += PRIORITY_WEIGHTS.SESSION_MISSED;
    await ScoringService.saveMRScore(score);
  },

  /**
   * Record no application: -1 point for each day without any application
   * This should be called daily for MRs with no applications that day
   */
  recordNoApplicationDay: async (mrId: string): Promise<void> => {
    const score = await ScoringService.checkAndPerformReset(mrId);
    score.priorityScore += PRIORITY_WEIGHTS.NO_APPLICATION_DAY;
    await ScoringService.saveMRScore(score);
  },

  /**
   * Get days remaining until next score reset
   */
  getDaysUntilReset: (mrScore: MRScore): number => {
    const lastReset = new Date(mrScore.lastResetDate);
    const now = new Date();
    const daysSinceReset = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 3600 * 24));
    return Math.max(0, SCORING_CONFIG.RESET_DAYS - daysSinceReset);
  },

  /**
   * Handle tie-breaking when multiple MRs have equal priority scores
   * One is selected randomly with credit = 0
   * Others with same score get credit += 1
   */
  handleTieBreaking: async (
    selectedMrId: string,
    nonSelectedMrIds: string[]
  ): Promise<void> => {
    // Selected MR: reset credit to 0 (update most recent application)
    const selectedScore = await ScoringService.getMRScore(selectedMrId);
    selectedScore.credit = 0;
    await ScoringService.saveMRScore(selectedScore);

    // Non-selected MRs: increment credit
    for (const mrId of nonSelectedMrIds) {
      const score = await ScoringService.getMRScore(mrId);
      score.credit += 1;
      await ScoringService.saveMRScore(score);
    }
  },

  /**
   * Get sorted applicants by priority score, then by credit for tie-breaking
   */
  getSortedApplicantsByScore: (
    applicants: PassApplication[]
  ): PassApplication[] => {
    return applicants.sort((a, b) => {
      // First sort by priority score (higher first)
      if ((b.priorityScore || 0) !== (a.priorityScore || 0)) {
        return (b.priorityScore || 0) - (a.priorityScore || 0);
      }
      // If equal, sort by credit (higher first)
      return (b.credit || 0) - (a.credit || 0);
    });
  },
};
