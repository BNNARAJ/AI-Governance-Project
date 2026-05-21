import { Observable } from 'rxjs';
import {
  AdminOverview,
  AppUser,
  AuditConfiguration,
  AuditReport,
  DashboardSnapshot,
  LoginCredentials,
  RegulationUploadSummary
} from '../models/governance.models';

export abstract class GovernanceDataSource {
  abstract login(credentials: LoginCredentials): Observable<AppUser>;
  abstract logout(): Observable<void>;
  abstract getDashboard(user: AppUser): Observable<DashboardSnapshot>;
  abstract uploadRegulations(
    files: readonly File[]
  ): Observable<RegulationUploadSummary>;
  abstract saveAuditConfiguration(
    configuration: AuditConfiguration
  ): Observable<void>;
  abstract runAudit(configuration: AuditConfiguration): Observable<AuditReport>;
  abstract getAdminOverview(): Observable<AdminOverview>;
}
