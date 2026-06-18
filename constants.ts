// Fix: Removed duplicate export keyword on the first line
export const PRIORITY_WEIGHTS = {
<<<<<<< HEAD
  NO_PASS_14_DAYS: 5,
  NO_PASS_7_DAYS: 3,
  PASS_IN_LAST_3_DAYS: -5,
  MISSED_ENTRY: -10,
=======
  SESSION_ATTENDED: 5,      // +5 for attending a session
  SESSION_MISSED: -15,      // -15 for missing a session
  NO_APPLICATION_DAY: -1,   // -1 for not applying on a day
};

export const SCORING_CONFIG = {
  RESET_DAYS: 14,           // Reset every 14 days
  RESET_DIVISOR: 4,         // New score = old score / 4 on reset
>>>>>>> a063f5c (Initial commit)
};

export const HOSPITAL_CONFIG = {
  DEFAULT_PASS_LIMIT: 15,
  WINDOW_START: "18:00",
  WINDOW_END: "18:10",
};