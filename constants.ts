// Fix: Removed duplicate export keyword on the first line
export const PRIORITY_WEIGHTS = {
  NO_PASS_14_DAYS: 5,
  NO_PASS_7_DAYS: 3,
  PASS_IN_LAST_3_DAYS: -5,
  MISSED_ENTRY: -10,
};

export const HOSPITAL_CONFIG = {
  DEFAULT_PASS_LIMIT: 15,
  WINDOW_START: "18:00",
  WINDOW_END: "18:10",
};