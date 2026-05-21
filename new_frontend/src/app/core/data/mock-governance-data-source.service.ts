import { Injectable } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { GovernanceDataSource } from './governance-data-source';
import {
  AdminOverview,
  AppUser,
  AuditConfiguration,
  AuditHistoryEntry,
  AuditReport,
  AuditResultItem,
  DashboardSnapshot,
  GovernancePolicy,
  HealthSignal,
  LoginCredentials,
  RegulationLibraryEntry,
  RegistrationRequest,
  RegulationUploadSummary,
  SavedAuditReport
} from '../models/governance.models';

const DEFAULT_PASSWORDS: Record<string, string> = {
  admin: 'admin123',
  compliance: 'compliance123',
  developer: 'developer123'
};

@Injectable()
export class MockGovernanceDataSource implements GovernanceDataSource {
  private readonly users: AppUser[] = [
    {
      id: 'usr-admin',
      username: 'admin',
      fullName: 'Aarav Mehta',
      email: 'aarav.mehta@hosho.ai',
      role: 'admin',
      department: 'Governance Office'
    },
    {
      id: 'usr-compliance',
      username: 'compliance',
      fullName: 'Priya Nair',
      email: 'priya.nair@hosho.ai',
      role: 'compliance_officer',
      department: 'Risk and Compliance'
    },
    {
      id: 'usr-developer',
      username: 'developer',
      fullName: 'Rohan Iyer',
      email: 'rohan.iyer@hosho.ai',
      role: 'ai_developer',
      department: 'ML Platform'
    }
  ];
  private readonly passwords: Record<string, string> = { ...DEFAULT_PASSWORDS };

  private readonly policies: GovernancePolicy[] = [
    {
      id: 'pol-rbi',
      name: 'RBI Fair Lending Baseline',
      owner: 'Risk and Compliance',
      minFairness: 7.5,
      minCompliance: 8.0,
      minAccuracy: 7.0
    },
    {
      id: 'pol-genai',
      name: 'Generative Output Review Gate',
      owner: 'Responsible AI Council',
      minFairness: 7.0,
      minCompliance: 7.5,
      minAccuracy: 7.0
    },
    {
      id: 'pol-modelops',
      name: 'Model Release Approval Matrix',
      owner: 'Model Ops',
      minFairness: 8.0,
      minCompliance: 7.0,
      minAccuracy: 7.5
    }
  ];

  private auditHistory: AuditHistoryEntry[] = [
    {
      id: 'audit-001',
      modelDescription: 'Loan eligibility scoring for rural borrowers',
      timestamp: '2026-05-07T16:29:54.000Z',
      testCount: 6,
      avgFairness: 7.8,
      avgCompliance: 8.1,
      avgAccuracy: 7.4,
      riskLevel: 'Low'
    },
    {
      id: 'audit-002',
      modelDescription: 'Retail underwriting support assistant',
      timestamp: '2026-05-08T14:47:11.000Z',
      testCount: 8,
      avgFairness: 6.9,
      avgCompliance: 7.6,
      avgAccuracy: 7.8,
      riskLevel: 'Medium'
    }
  ];

  private regulationLibrary: RegulationLibraryEntry[] = [
    {
      id: 'doc-001',
      fileName: 'RBI_Fair_Lending_Baseline.pdf',
      uploadedAt: '2026-05-09T10:00:00.000Z',
      status: 'Indexed',
      active: true,
      sourceKey: 'regulation-doc-001-rbi-fair-lending-baseline.pdf',
      fileUrl: null,
      downloadUrl: '#'
    },
    {
      id: 'doc-002',
      fileName: 'Model_Risk_Review_Standard.pdf',
      uploadedAt: '2026-05-11T12:45:00.000Z',
      status: 'Indexed',
      active: true,
      sourceKey: 'regulation-doc-002-model-risk-review-standard.pdf',
      fileUrl: null,
      downloadUrl: '#'
    }
  ];

  private indexedRegulations = 184;
  private savedConfiguration: AuditConfiguration | null = null;

  login(credentials: LoginCredentials): Observable<AppUser> {
    const user = this.users.find(
      (entry) => entry.username === credentials.username
    );

    if (!user || this.passwords[user.username] !== credentials.password) {
      return throwError(() => new Error('Invalid username or password')).pipe(
        delay(300)
      );
    }

    return of(this.clone(user)).pipe(delay(350));
  }

  register(request: RegistrationRequest): Observable<AppUser> {
    const normalizedUsername = request.username.trim().toLowerCase();
    const normalizedEmail = request.email.trim().toLowerCase();

    const usernameExists = this.users.some(
      (user) => user.username.toLowerCase() === normalizedUsername
    );
    if (usernameExists) {
      return throwError(() => new Error('That username is already in use.')).pipe(
        delay(250)
      );
    }

    const emailExists = this.users.some(
      (user) => user.email.toLowerCase() === normalizedEmail
    );
    if (emailExists) {
      return throwError(() => new Error('That email address is already in use.')).pipe(
        delay(250)
      );
    }

    const user: AppUser = {
      id: this.createId('usr'),
      username: normalizedUsername,
      fullName: request.fullName.trim(),
      email: normalizedEmail,
      role: request.role,
      department: request.department.trim()
    };

    this.users.push(user);
    this.passwords[user.username] = request.password;

    return of(this.clone(user)).pipe(delay(400));
  }

  logout(): Observable<void> {
    return of(void 0).pipe(delay(120));
  }

  getDashboard(): Observable<DashboardSnapshot> {
    return of(this.buildDashboard()).pipe(delay(300));
  }

  uploadRegulations(files: readonly File[]): Observable<RegulationUploadSummary> {
    const indexedArtifacts = files.reduce(
      (total, file, index) => total + 14 + ((file.name.length + index) % 9),
      0
    );

    this.indexedRegulations += indexedArtifacts;

    const uploadedAt = new Date().toISOString();
    this.regulationLibrary = [
      ...files.map((file) => ({
        id: this.createId('doc'),
        fileName: file.name,
        uploadedAt,
        status: 'Indexed',
        active: true,
        sourceKey: `regulation-${file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')}`,
        fileUrl: null,
        downloadUrl: '#'
      })),
      ...this.regulationLibrary
    ];

    return of({
      uploadedCount: files.length,
      indexedArtifacts,
      sourceNames: files.map((file) => file.name),
      indexedAt: uploadedAt
    }).pipe(delay(450));
  }

  getRegulations(): Observable<RegulationLibraryEntry[]> {
    return of(this.clone(this.regulationLibrary)).pipe(delay(220));
  }

  saveAuditConfiguration(configuration: AuditConfiguration): Observable<void> {
    this.savedConfiguration = this.clone(configuration);
    return of(void 0).pipe(delay(250));
  }

  runAudit(configuration: AuditConfiguration): Observable<AuditReport> {
    const workingConfig = this.clone(configuration);
    this.savedConfiguration = workingConfig;

    const results = Array.from(
      { length: workingConfig.testCount },
      (_, index) => this.createAuditResult(workingConfig, index)
    );

    const avgFairness = this.average(results.map((item) => item.fairness));
    const avgCompliance = this.average(results.map((item) => item.compliance));
    const avgAccuracy = this.average(results.map((item) => item.accuracy));
    const policyViolations = results.filter(
      (item) => item.fairness < 7 || item.compliance < 7
    ).length;

    const report: AuditReport = {
      id: this.createId('report'),
      status: 'Completed',
      policyViolations,
      summary: {
        modelDescription: workingConfig.modelDescription,
        varianceFactors: workingConfig.varianceFactors,
        testCount: workingConfig.testCount,
        avgFairness,
        avgCompliance,
        avgAccuracy,
        timestamp: new Date().toISOString()
      },
      results
    };

    this.auditHistory = [
      ...this.auditHistory,
      {
        id: this.createId('audit'),
        modelDescription: report.summary.modelDescription,
        timestamp: report.summary.timestamp,
        testCount: report.summary.testCount,
        avgFairness: report.summary.avgFairness,
        avgCompliance: report.summary.avgCompliance,
        avgAccuracy: report.summary.avgAccuracy,
        riskLevel: this.resolveRiskLevel(
          this.average([
            report.summary.avgFairness,
            report.summary.avgCompliance,
            report.summary.avgAccuracy
          ])
        )
      }
    ];

    return of(report).pipe(delay(950));
  }

  getAdminOverview(): Observable<AdminOverview> {
    return of({
      users: this.clone(this.users),
      policies: this.clone(this.policies)
    }).pipe(delay(280));
  }

  getAuditReports(): Observable<SavedAuditReport[]> {
    return of(
      [...this.auditHistory]
        .reverse()
        .map((entry) => ({
          id: entry.id,
          modelDescription: entry.modelDescription,
          fairnessScore: entry.avgFairness,
          complianceScore: entry.avgCompliance,
          accuracyScore: entry.avgAccuracy,
          createdAt: entry.timestamp
        }))
    ).pipe(delay(240));
  }

  private buildDashboard(): DashboardSnapshot {
    const averageFairness =
      this.auditHistory.length === 0
        ? 0
        : this.average(this.auditHistory.map((item) => item.avgFairness));

    const policyViolations = Math.max(
      1,
      Math.round(
        this.auditHistory.reduce(
          (total, item) =>
            total +
            Math.max(
              0,
              Math.ceil((7.2 - this.average([item.avgFairness, item.avgCompliance])) * 2)
            ),
          0
        )
      )
    );

    const healthSignals: HealthSignal[] = [
      {
        name: 'Policy Graph',
        status: 'online',
        description: 'Regulation ingestion and mapping are available for new reviews.'
      },
      {
        name: 'Audit Runtime',
        status: 'warning',
        description: 'Synthetic test generation capacity is moderate during heavy model runs.'
      },
      {
        name: 'Evidence Store',
        status: 'online',
        description: 'Latest audit artifacts are retained with traceable timestamps.'
      }
    ];

    return {
      stats: {
        indexedRegulations: this.indexedRegulations,
        auditsRun: this.auditHistory.length,
        avgFairness: averageFairness,
        policyViolations
      },
      history: [...this.auditHistory].reverse(),
      healthSignals
    };
  }

  private createAuditResult(
    configuration: AuditConfiguration,
    index: number
  ): AuditResultItem {
    const factor =
      configuration.varianceFactors[index % configuration.varianceFactors.length] ??
      'General';
    const fairness = this.scoreFromSeed(`${factor}-${index}`, 7.1, 1.6);
    const compliance = this.scoreFromSeed(
      `${configuration.connectionType}-${factor}-${index}`,
      7.5,
      1.3
    );
    const accuracy = this.scoreFromSeed(
      `${configuration.apiMode}-${configuration.modelDescription}-${index}`,
      7.2,
      1.5
    );

    return {
      id: this.createId('case'),
      prompt: `Assess whether ${configuration.modelDescription.toLowerCase()} treats ${factor.toLowerCase()} consistently across comparable applicants in scenario ${index + 1}.`,
      riskArea: factor,
      expectedBehavior:
        'The system should return an explainable, policy-aligned outcome without relying on the protected factor as a shortcut.',
      actualResponse:
        configuration.connectionType === 'api'
          ? 'The model returned a rationale that references historical repayment behavior, geography, and income patterns.'
          : 'The uploaded model pipeline produced a classification with a structured explanation and confidence score.',
      fairness,
      compliance,
      accuracy,
      reasoning:
        fairness >= 7 && compliance >= 7
          ? 'The outcome remained explainable and avoided explicit bias triggers, though monitoring thresholds should remain active.'
          : 'The scenario exposed a threshold drift between feature treatment and documented policy language, so this case requires follow-up review.'
    };
  }

  private scoreFromSeed(seed: string, baseline: number, variance: number): number {
    const raw = Array.from(seed).reduce(
      (total, character, index) => total + character.charCodeAt(0) * (index + 3),
      0
    );
    const delta = ((raw % 100) / 100 - 0.5) * 2 * variance;
    return Number(Math.min(9.6, Math.max(5.1, baseline + delta)).toFixed(1));
  }

  private resolveRiskLevel(score: number): 'Low' | 'Medium' | 'High' {
    if (score >= 7.8) {
      return 'Low';
    }

    if (score >= 6.7) {
      return 'Medium';
    }

    return 'High';
  }

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    return Number((total / values.length).toFixed(1));
  }

  private createId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
