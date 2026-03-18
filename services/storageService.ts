
import { SessionService } from './SessionService';
import { MRService } from './MRService';
import { HospitalService } from './HospitalService';
import { PassService } from './PassService';
import { ApprovalService } from './ApprovalService';
import { CompanyService } from './CompanyService';
import { AuditService } from './AuditService';

/**
 * Backward compatibility facade for storageService.
 * Newer features should import specialized services directly.
 */
export const storageService = {
  ...SessionService,
  ...MRService,
  ...HospitalService,
  ...PassService,
  ...ApprovalService,
  ...CompanyService,
  ...AuditService
};
