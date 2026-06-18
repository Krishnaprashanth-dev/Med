// Fix: Removed duplicate export keyword on the first line
export const PRIORITY_WEIGHTS = {
  SESSION_ATTENDED: 5,      // +5 for attending a session
  SESSION_MISSED: -15,      // -15 for missing a session
  NO_APPLICATION_DAY: -1,   // -1 for not applying on a day
};

export const SCORING_CONFIG = {
  RESET_DAYS: 14,           // Reset every 14 days
  RESET_DIVISOR: 4,         // New score = old score / 4 on reset
};

export const HOSPITAL_CONFIG = {
  DEFAULT_PASS_LIMIT: 15,
  WINDOW_START: "18:00",
  WINDOW_END: "18:10",
};