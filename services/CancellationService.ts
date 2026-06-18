import { Hospital, SessionType, IssuedPass } from '../types';

export const CancellationService = {
  /**
   * Calculate cancellation deadline: 30 minutes before session entry window starts
   */
  getCancellationDeadline: (hospital: Hospital, session: SessionType): Date | null => {
    const window = hospital.entryWindows?.[session];
    if (!window) return null;

    const [hours, minutes] = window.start.split(':').map(Number);
    const deadline = new Date();
    deadline.setHours(hours, minutes - 30, 0, 0);

    return deadline;
  },

  /**
   * Check if cancellation is still allowed
   */
  canCancelPass: (hospital: Hospital, session: SessionType, passDate: string): boolean => {
    const passDay = new Date(passDate);
    const today = new Date();

    // Can only cancel passes for today
    if (passDay.toLocaleDateString('en-CA') !== today.toLocaleDateString('en-CA')) {
      return false;
    }

    const deadline = CancellationService.getCancellationDeadline(hospital, session);
    if (!deadline) return false;

    return today < deadline;
  },

  /**
   * Get time remaining until cancellation deadline (in milliseconds)
   */
  getTimeUntilCancellationDeadline: (hospital: Hospital, session: SessionType, passDate: string): number => {
    const passDay = new Date(passDate);
    const today = new Date();

    // Check if it's the pass date
    if (passDay.toLocaleDateString('en-CA') !== today.toLocaleDateString('en-CA')) {
      return 0;
    }

    const deadline = CancellationService.getCancellationDeadline(hospital, session);
    if (!deadline) return 0;

    const remaining = deadline.getTime() - today.getTime();
    return Math.max(0, remaining);
  },

  /**
   * Format milliseconds to HH:MM:SS
   */
  formatTimeRemaining: (milliseconds: number): string => {
    if (milliseconds <= 0) return '00:00:00';

    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  },
};
