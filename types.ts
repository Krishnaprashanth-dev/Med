
export type MRStatus = 'active' | 'suspended';
export type ApplicationStatus = 'applied' | 'selected' | 'waitlisted' | 'rejected' | 'cancelled';
export type EntryStatus = 'not_entered' | 'entered' | 'expired' | 'ended';
export type UserRole = 'MR' | 'ADMIN' | 'SECURITY' | 'SUPER_ADMIN' | 'COMPANY_ADMIN';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type SessionType = 'MORNING' | 'EVENING' | 'FULL_DAY';

export interface MedicalRep {
  id: string;
  fullName: string;
  email: string;
  companyName: string; 
  companyId?: string; // ID of the pharma company
  mrId: string; // The system-wide official MR ID
  loginId: string; // Unique ID used for logging into the app
  mobileNumber: string; // Contact number
  password?: string; 
  identificationNumber: string; // National ID / NIC
  slcpiId?: string;
  slcpiPhoto?: string; // Base64 string of the ID card photo
  slcpiExpiry?: string; // Expiry date of SLCPI ID
  status: MRStatus;
  createdAt: string;
}

export interface Hospital {
  id: string;
  name: string;
  supportedSessions: SessionType[];
  passLimits: Record<string, number>; 
  companyPassLimit?: Record<string, number>; 
  sessionWindows: Record<string, { start: string; end: string }>; 
  entryWindows?: Record<string, { start: string; end: string }>; // For gate entry validation
  expiryTimes?: Record<string, { issued: string; active: string }>; // NEW: Configurable session end times
  isActive: boolean;
  mobileNumber?: string;
  email?: string;
  address?: string;
  autoLotteryEnabled?: Record<string, boolean>;
  autoLotteryTimes?: Record<string, string>;
}

export interface HospitalUser {
  id: string;
  hospitalId: string;
  mobileNumber: string; 
  password: string;     
  role: 'ADMIN' | 'SECURITY';
  fullName: string;
}

export interface MRHospitalApproval {
  id: string;
  mrId: string;
  hospitalId: string;
  status: ApprovalStatus;
  updatedAt: string;
}

export interface PassApplication {
  id: string;
  mrId: string;
  hospitalId: string;
  session: SessionType;
  applicationDate: string;
  priorityScore: number;
  status: ApplicationStatus;
  createdAt: string;
}

export interface IssuedPass {
  id: string;
  mrId: string;
  hospitalId: string;
  session: SessionType;
  passDate: string;
  timeSlot: string;
  qrCode: string;
  entryStatus: EntryStatus;
}

export interface PharmaCompany {
  id: string;
  name: string;
  contactEmail: string;
  companyCode: string; 
  adminMobile: string; 
  adminPassword: string; 
  isActive: boolean;
  address?: string;
  contactNumber?: string;
  financeEmail?: string;
}

export interface Invoice {
  id: string;
  companyId: string;
  amount: number;
  activeMRCount: number;
  status: 'paid' | 'unpaid';
  date: string;
}

export interface EntryLog {
  id: string;
  issuedPassId: string;
  entryTime: string;
  verifiedBy: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface AuthUser {
  id: string;
  role: UserRole;
  fullName: string;
  mobileNumber?: string;
  loginId?: string;
  hospitalId?: string; 
  companyId?: string; 
  companyName?: string; 
}
