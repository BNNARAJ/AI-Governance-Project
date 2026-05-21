import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GovernanceDataSource } from './governance-data-source';
import { MockGovernanceDataSource } from './mock-governance-data-source.service';
import {
  AdminOverview,
  AppUser,
  AuditConfiguration,
  AuditReport,
  DashboardSnapshot,
  LoginCredentials,
  RegulationUploadSummary
} from '../models/governance.models';

@Injectable()
export class HttpGovernanceDataSource implements GovernanceDataSource {
  private readonly http = inject(HttpClient);
  private readonly mock = inject(MockGovernanceDataSource);
  private readonly baseUrl = environment.backendBaseUrl.replace(/\/$/, '');

  login(credentials: LoginCredentials): Observable<AppUser> {
    const url = this.api('/api/auth/login');

    return this.http
      .post<any>(url, credentials, {
        withCredentials: true
      })
      .pipe(
        map((payload) => this.mapUserFromLogin(payload, credentials.username)),
        catchError((error) =>
          this.withFallback(error, () => this.mock.login(credentials), 'login')
        )
      );
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(this.api('/api/auth/logout'), {}, { withCredentials: true })
      .pipe(
        catchError((error) =>
          this.withFallback(error, () => this.mock.logout(), 'logout')
        )
      );
  }

  getDashboard(user: AppUser): Observable<DashboardSnapshot> {
    const snapshotUrl = this.api('/api/dashboard/snapshot');

    return this.http
      .get<DashboardSnapshot>(snapshotUrl, { withCredentials: true })
      .pipe(
        catchError((error) => {
          if (!this.isEndpointMissing(error)) {
            return this.withFallback(
              error,
              () => this.mock.getDashboard(),
              'dashboard snapshot'
            );
          }

          return this.getDashboardFromSplitEndpoints(user).pipe(
            catchError((splitError) =>
              this.withFallback(
                splitError,
                () => this.mock.getDashboard(),
                'dashboard split endpoints'
              )
            )
          );
        })
      );
  }

  uploadRegulations(files: readonly File[]): Observable<RegulationUploadSummary> {
    const url = this.api('/api/regulations/upload');
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    return this.http
      .post<any>(url, formData, { withCredentials: true })
      .pipe(
        map((payload) => this.mapUploadSummary(payload, files)),
        catchError((error) =>
          this.withFallback(
            error,
            () => this.mock.uploadRegulations(files),
            'regulation upload'
          )
        )
      );
  }

  saveAuditConfiguration(configuration: AuditConfiguration): Observable<void> {
    const url = this.api('/api/audit/configure');

    return this.http
      .post<void>(url, this.mapAuditConfigurationPayload(configuration), {
        withCredentials: true
      })
      .pipe(
        catchError((error) =>
          this.withFallback(
            error,
            () => this.mock.saveAuditConfiguration(configuration),
            'audit configuration save'
          )
        )
      );
  }

  runAudit(configuration: AuditConfiguration): Observable<AuditReport> {
    const primaryUrl = this.api('/api/audit/run-audit');
    const fallbackUrl = this.api('/api/Audit/run-audit');
    const payload = this.mapAuditConfigurationPayload(configuration);

    return this.http
      .post<any>(primaryUrl, payload, { withCredentials: true })
      .pipe(
        catchError((error) => {
          if (!this.isEndpointMissing(error)) {
            return throwError(() => error);
          }

          return this.http.post<any>(fallbackUrl, payload, {
            withCredentials: true
          });
        }),
        switchMap((response) => {
          if (this.looksLikeAuditReport(response)) {
            return of(response as unknown as AuditReport);
          }

          return this.mock.runAudit(configuration);
        }),
        catchError((error) =>
          this.withFallback(error, () => this.mock.runAudit(configuration), 'run audit')
        )
      );
  }

  getAdminOverview(): Observable<AdminOverview> {
    const usersUrl = this.api('/api/admin/users');
    const policiesUrl = this.api('/api/admin/policies');

    return forkJoin({
      users: this.http.get<any[]>(usersUrl, { withCredentials: true }),
      policies: this.http.get<any[]>(policiesUrl, { withCredentials: true })
    }).pipe(
      map(({ users, policies }) => ({
        users: users.map((user, index) => this.mapAdminUser(user, index)),
        policies: policies.map((policy, index) => this.mapPolicy(policy, index))
      })),
      catchError((error) =>
        this.withFallback(error, () => this.mock.getAdminOverview(), 'admin overview')
      )
    );
  }

  private getDashboardFromSplitEndpoints(user: AppUser): Observable<DashboardSnapshot> {
    return forkJoin({
      stats: this.http.get<any>(this.api('/api/dashboard/stats'), {
        withCredentials: true
      }),
      history: this.http.get<any[]>(this.api('/api/dashboard/history'), {
        withCredentials: true
      }),
      healthSignals: this.http.get<any[]>(
        this.api('/api/dashboard/health'),
        { withCredentials: true }
      )
    }).pipe(
      map((payload) => ({
        stats: {
          indexedRegulations: this.toNumber(payload.stats.indexedRegulations, 0),
          auditsRun: this.toNumber(payload.stats.auditsRun, 0),
          avgFairness: this.toNumber(payload.stats.avgFairness, 0),
          policyViolations: this.toNumber(payload.stats.policyViolations, 0)
        },
        history: payload.history.map((entry, index) => ({
          id: this.toString(entry.id, `audit-${index + 1}`),
          modelDescription: this.toString(
            entry.modelDescription,
            'Model audit execution'
          ),
          timestamp: this.toString(entry.timestamp, new Date().toISOString()),
          testCount: this.toNumber(entry.testCount, 0),
          avgFairness: this.toNumber(entry.avgFairness, 0),
          avgCompliance: this.toNumber(entry.avgCompliance, 0),
          avgAccuracy: this.toNumber(entry.avgAccuracy, 0),
          riskLevel: this.toRiskLevel(entry.riskLevel)
        })),
        healthSignals: payload.healthSignals.map((signal, index) => ({
          name: this.toString(signal.name, `Signal ${index + 1}`),
          status: this.toStatus(signal.status),
          description: this.toString(signal.description, 'No details provided.')
        }))
      })),
      catchError((error) =>
        this.withFallback(
          error,
          () => this.mock.getDashboard(),
          'dashboard split endpoints'
        )
      )
    );
  }

  private withFallback<T>(
    error: unknown,
    fallback: () => Observable<T>,
    operation: string
  ): Observable<T> {
    if (!environment.useMockFallback) {
      const message = this.messageFromError(error, operation);
      return throwError(() => new Error(message));
    }

    return fallback();
  }

  private mapUserFromLogin(payload: any, username: string): AppUser {
    const nestedUser =
      payload.user && typeof payload.user === 'object'
        ? (payload.user as any)
        : null;

    const roleFromPayload = nestedUser?.role ?? payload.role;
    const role = this.toRole(roleFromPayload);
    const fullName = this.toString(
      nestedUser?.fullName ?? nestedUser?.full_name ?? payload.fullName ?? payload.full_name,
      username
    );

    return {
      id: this.toString(nestedUser?.id ?? payload.id, `usr-${username}`),
      username: this.toString(
        nestedUser?.username ?? payload.username,
        username
      ),
      fullName,
      email: this.toString(
        nestedUser?.email ?? payload.email,
        `${username}@company.local`
      ),
      role,
      department: this.toString(
        nestedUser?.department ?? payload.department,
        'Governance Office'
      )
    };
  }

  private mapUploadSummary(payload: any, files: readonly File[]): RegulationUploadSummary {
    const chunks = this.toNumber(payload.total_chunks ?? payload.indexedArtifacts, 0);

    return {
      uploadedCount: files.length,
      indexedArtifacts: chunks,
      sourceNames: files.map((file) => file.name),
      indexedAt: new Date().toISOString()
    };
  }

  private mapAuditConfigurationPayload(configuration: AuditConfiguration): any {
    return {
      modelDescription: configuration.modelDescription,
      varianceFactors: configuration.varianceFactors,
      testCount: configuration.testCount,
      connectionType: configuration.connectionType,
      apiMode: configuration.apiMode,
      apiUrl: configuration.apiUrl,
      apiKey: configuration.apiKey,
      modelName: configuration.modelName,
      localFilePath: configuration.localModelName
    };
  }

  private mapAdminUser(payload: any, index: number): AppUser {
    const username = this.toString(payload.username, `user-${index + 1}`);

    return {
      id: this.toString(payload.id, `usr-${index + 1}`),
      username,
      fullName: this.toString(
        payload.fullName ?? payload.full_name ?? payload.name,
        username
      ),
      email: this.toString(payload.email, `${username}@company.local`),
      role: this.toRole(payload.role),
      department: this.toString(payload.department, 'Governance')
    };
  }

  private mapPolicy(payload: any, index: number): AdminOverview['policies'][number] {
    return {
      id: this.toString(payload.id, `policy-${index + 1}`),
      name: this.toString(payload.name, `Policy ${index + 1}`),
      owner: this.toString(payload.owner, 'Compliance'),
      minFairness: this.toNumber(
        payload.minFairness ?? payload.min_fairness_score,
        0
      ),
      minCompliance: this.toNumber(
        payload.minCompliance ?? payload.min_compliance_score,
        0
      ),
      minAccuracy: this.toNumber(
        payload.minAccuracy ?? payload.min_accuracy_score,
        0
      )
    };
  }

  private looksLikeAuditReport(payload: any): boolean {
    return Boolean(
      payload.summary &&
        typeof payload.summary === 'object' &&
        Array.isArray(payload.results)
    );
  }

  private isEndpointMissing(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return false;
    }

    return error.status === 404 || error.status === 405;
  }

  private messageFromError(error: unknown, operation: string): string {
    if (error instanceof HttpErrorResponse) {
      return `${operation} failed with status ${error.status}`;
    }

    return `${operation} failed`;
  }

  private toString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
  }

  private toNumber(value: unknown, fallback: number): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  private toRole(value: unknown): AppUser['role'] {
    if (
      value === 'admin' ||
      value === 'compliance_officer' ||
      value === 'ai_developer'
    ) {
      return value;
    }

    if (value === 'compliance') {
      return 'compliance_officer';
    }

    if (value === 'developer') {
      return 'ai_developer';
    }

    return 'ai_developer';
  }

  private toRiskLevel(value: unknown): 'Low' | 'Medium' | 'High' {
    if (value === 'Low' || value === 'Medium' || value === 'High') {
      return value;
    }

    return 'Medium';
  }

  private toStatus(value: unknown): 'online' | 'warning' | 'offline' {
    if (value === 'online' || value === 'warning' || value === 'offline') {
      return value;
    }

    return 'warning';
  }

  private api(path: string): string {
    return `${this.baseUrl}${path}`;
  }
}
