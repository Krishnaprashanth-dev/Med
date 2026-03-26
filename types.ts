
export type MRStatus = 'active' | 'suspended';
export type ApplicationStatus = 'applied' | 'selected' | 'waitlisted' | 'rejected';
export type EntryStatus = 'not_entered' | 'entered' | 'expired' | 'ended';
export type UserRole = 'MR' | 'ADMIN' | 'SECURITY' | 'SUPER_ADMIN' | 'COMPANY_ADMIN';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type SessionType = 'MORNING' | 'EVENING' | 'FULL_DAY';

export interface MedicalRep {
  id: string;
  full_name: string;
  email?: string;
  company_name: string; 
  company_id?: string; // ID of the pharma company
  mr_code: string; // The system-wide official MR ID
  mobile_number: string; // Used for both contact and login
  password?: string; 
  identification_number: string; // National ID / NIC
  slcpi_id?: string;
  slcpi_photo?: string; // Base64 string of the ID card photo
  slcpi_expiry?: string; // Expiry date of SLCPI ID
  status: MRStatus;
  created_at: string;
}

export interface Hospital {
  id: string;
  name: string;
  supported_sessions: SessionType[];
  pass_limits: Record<string, number>; 
  company_pass_limit?: Record<string, number>; 
  session_windows: Record<string, { start: string; end: string }>; 
  entry_windows?: Record<string, { start: string; end: string }>; // For gate entry validation
  expiry_times?: Record<string, { issued: string; active: string }>; // NEW: Configurable session end times
  is_active: boolean;
  mobile_number?: string;
  email?: string;
  address?: string;
  auto_lottery_enabled?: Record<string, boolean>;
  auto_lottery_times?: Record<string, string>;
}

export interface HospitalUser {
  id: string;
  hospital_id: string;
  mobile_number: string; 
  password: string;     
  role: 'ADMIN' | 'SECURITY';
  full_name: string;
}

export interface MRHospitalApproval {
  id: string;
  mr_id: string;
  hospital_id: string;
  status: ApprovalStatus;
  updated_at: string;
}

export interface PassApplication {
  id: string;
  mr_id: string;
  hospital_id: string;
  session: SessionType;
  application_date: string;
  priority_score: number;
  status: ApplicationStatus;
  created_at: string;
}

export interface IssuedPass {
  id: string;
  mr_id: string;
  hospital_id: string;
  session: SessionType;
  pass_date: string;
  time_slot: string;
  qr_code: string;
  entry_status: EntryStatus;
}

export interface PharmaCompany {
  id: string;
  name: string;
  contact_email: string;
  company_code: string; 
  admin_mobile: string; 
  admin_password: string; 
  is_active: boolean;
  address?: string;
  contact_number?: string;
  finance_email?: string;
}

export interface Invoice {
  id: string;
  company_id: string;
  amount: number;
  active_mr_count: number;
  status: 'paid' | 'unpaid';
  date: string;
}

export interface EntryLog {
  id: string;
  pass_id: string;
  entry_time: string;
  verified_by: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface AuthUser {
  id: string;
  role: UserRole;
  full_name: string;
  mobile_number: string;
  hospital_id?: string; 
  company_id?: string; 
  company_name?: string; 
}
