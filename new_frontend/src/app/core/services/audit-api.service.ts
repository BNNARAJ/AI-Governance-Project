import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MockGovernanceDataSource } from '../data/mock-governance-data-source.service';
import {
  AuditConfiguration,
  AuditPreflight,
  AuditProgress,
  CurrentAuditResponse,
  DeterministicDatasetSummary,
  HybridValidationSummary,
  SavedAuditReport,
  UploadedModelBundle
} from '../models/governance.models';
import { BackendCapabilitiesService } from './backend-capabilities.service';

@Injectable({
  providedIn: 'root'
})
export class AuditApiService {
  private readonly capabilities = inject(BackendCapabilitiesService);
  private readonly http = inject(HttpClient);
  private readonly mock = inject(MockGovernanceDataSource);
  private readonly baseUrl = environment.backendBaseUrl.replace(/\/$/, '');

  uploadModel(file: File): Observable<UploadedModelBundle> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http
      .post<any>(`${this.baseUrl}/api/Audit/upload-model`, formData)
      .pipe(
        map((response) => ({
          modelId: String(response.modelId ?? response.model_id ?? ''),
          fileName: String(response.fileName ?? response.file_name ?? file.name),
          status: String(response.status ?? ''),
          message: String(response.message ?? 'Model uploaded successfully.'),
          modelAuditId:
            response.modelAuditId !== undefined && response.modelAuditId !== null
              ? Number(response.modelAuditId)
              : response.model_audit_id !== undefined && response.model_audit_id !== null
                ? Number(response.model_audit_id)
                : null,
          modelZipUrl:
            typeof (response.modelZipUrl ?? response.model_zip_url) === 'string'
              ? String(response.modelZipUrl ?? response.model_zip_url)
              : null,
          detectedArtifacts: response.detectedArtifacts ?? response.detected_artifacts ?? null,
          modelMetadata: response.modelMetadata ?? response.model_metadata ?? null,
          modelInspection: response.modelInspection ?? response.model_inspection ?? null
        })),
        catchError((error) =>
          throwError(() => new Error(this.toErrorMessage(error, 'Model upload failed.')))
        )
      );
  }

  runAudit(configuration: AuditConfiguration): Observable<CurrentAuditResponse> {
    if (this.capabilities.mockMode()) {
      return this.mock.runAudit(configuration).pipe(
        map((report) => ({
          auditId: report.id,
          modelUsed: report.summary.modelDescription,
          status: report.status,
          score: Number(
            (
              (report.summary.avgFairness +
                report.summary.avgCompliance +
                report.summary.avgAccuracy) /
              3
            ).toFixed(1)
          ),
          riskLevel:
            report.policyViolations === 0
              ? 'Low'
              : report.policyViolations < 3
                ? 'Medium'
                : 'High',
          findings: report.results.slice(0, 3).map((item) => item.reasoning),
          timestamp: report.summary.timestamp,
          responseLabel: 'Mock audit response',
          policyViolations: report.policyViolations,
          llmModelName: configuration.modelName,
          summary: {
            avgFairness: report.summary.avgFairness,
            avgCompliance: report.summary.avgCompliance,
            avgAccuracy: report.summary.avgAccuracy,
            testCount: report.summary.testCount,
            varianceFactors: report.summary.varianceFactors
          },
          results: report.results.map((item) => ({
            id: item.id,
            prompt: item.prompt,
            expectedBehavior: item.expectedBehavior,
            actualResponse: item.actualResponse,
            riskArea: item.riskArea,
            fairness: item.fairness,
            compliance: item.compliance,
            accuracy: item.accuracy,
            reasoning: item.reasoning
          })),
          warnings: [],
          hybridValidation: null,
          deterministicDataset: null,
          statisticalGovernance: null,
          metricGlossary: null
        }))
      );
    }

    return this.http
      .post<any>(`${this.baseUrl}/api/Audit/run-audit`, {
        modelDescription: configuration.modelDescription,
        varianceFactors: configuration.varianceFactors,
        testCount: configuration.testCount,
        connectionType: configuration.connectionType,
        apiMode: configuration.apiMode,
        apiUrl: configuration.apiUrl,
        apiKey: configuration.apiKey,
        modelName: configuration.modelName,
        localFilePath: configuration.localModelName
      })
      .pipe(
        map((response) => ({
          auditId: String(response.auditId ?? response.id ?? crypto.randomUUID()),
          modelUsed: String(
            response.modelUsed ?? response.modelDescription ?? configuration.modelDescription
          ),
          status: String(response.status ?? 'Completed'),
          score: Number(response.score ?? 0),
          riskLevel: this.toRiskLevel(response.riskLevel),
          findings: Array.isArray(response.findings)
            ? response.findings.map((item: unknown) => String(item))
            : [],
          timestamp: String(response.timestamp ?? new Date().toISOString()),
          responseLabel: String(response.responseLabel ?? 'Current backend audit response'),
          policyViolations: Number(response.policyViolations ?? 0),
          llmModelName:
            typeof response.llmModelName === 'string' ? response.llmModelName : configuration.modelName,
          summary: {
            avgFairness: Number(response.summary?.avgFairness ?? 0),
            avgCompliance: Number(response.summary?.avgCompliance ?? 0),
            avgAccuracy: Number(response.summary?.avgAccuracy ?? 0),
            testCount: Number(response.summary?.testCount ?? configuration.testCount),
            varianceFactors: Array.isArray(response.summary?.varianceFactors)
              ? response.summary.varianceFactors.map((item: unknown) => String(item))
              : configuration.varianceFactors
          },
          results: Array.isArray(response.results)
            ? response.results.map((item: any, index: number) => ({
                id: String(item.id ?? index + 1),
                prompt: String(item.prompt ?? 'Test scenario'),
                expectedBehavior: String(
                  item.expectedBehavior ?? item.expected_behavior ?? 'No expected behavior supplied.'
                ),
                actualResponse: String(
                  item.actualResponse ?? item.actual_response ?? 'No response captured.'
                ),
                riskArea: String(item.riskArea ?? item.risk_area ?? 'General'),
                fairness: Number(item.fairness ?? 0),
                compliance: Number(item.compliance ?? 0),
                accuracy: Number(item.accuracy ?? 0),
                reasoning: String(item.reasoning ?? '')
              }))
            : [],
          warnings: Array.isArray(response.warnings)
            ? response.warnings.map((item: unknown) => String(item))
            : [],
          hybridValidation: this.mapHybridValidation(
            response.hybridValidation ?? response.hybrid_validation
          ),
          deterministicDataset: this.mapDeterministicDataset(
            response.deterministicDataset ?? response.deterministic_dataset
          ),
          statisticalGovernance:
            response.statisticalGovernance ?? response.statistical_governance ?? null,
          metricGlossary: response.metricGlossary ?? response.metric_glossary ?? null
        })),
        catchError((error) =>
          throwError(() => new Error(this.toErrorMessage(error, 'Unable to run audit.')))
        )
      );
  }

  preflight(configuration: AuditConfiguration): Observable<AuditPreflight> {
    if (this.capabilities.mockMode()) {
      return of({
        pythonReachable: true,
        targetEndpointReachable: true,
        targetStatusCode: 200,
        targetStatus: 'mock',
        message: 'Mock audit connection is ready.',
        checkedAt: new Date().toISOString()
      });
    }

    return this.http
      .post<any>(`${this.baseUrl}/api/Audit/preflight`, {
        modelDescription: configuration.modelDescription,
        varianceFactors: configuration.varianceFactors,
        testCount: configuration.testCount,
        connectionType: configuration.connectionType,
        apiMode: configuration.apiMode,
        apiUrl: configuration.apiUrl,
        apiKey: configuration.apiKey,
        modelName: configuration.modelName,
        localFilePath: configuration.localModelName
      })
      .pipe(
        map((response) => ({
          pythonReachable: Boolean(response.pythonReachable),
          targetEndpointReachable: Boolean(response.targetEndpointReachable),
          targetStatusCode:
            response.targetStatusCode !== undefined && response.targetStatusCode !== null
              ? Number(response.targetStatusCode)
              : null,
          targetStatus: String(response.targetStatus ?? 'unknown'),
          message: String(response.message ?? 'Connection check completed.'),
          checkedAt:
            typeof response.checkedAt === 'string'
              ? response.checkedAt
              : typeof response.checked_at === 'string'
                ? response.checked_at
                : null
        })),
        catchError((error) =>
          throwError(() => new Error(this.toErrorMessage(error, 'Connection check failed.')))
        )
      );
  }

  loadProgress(): Observable<AuditProgress> {
    if (this.capabilities.mockMode()) {
      return of({
        status: 'idle',
        stage: 'idle',
        progress: 0,
        message: 'No audit running.',
        updatedAt: null,
        lastError: null
      });
    }

    return this.http.get<any>(`${this.baseUrl}/api/Audit/progress`).pipe(
      map((response) => ({
        status: String(response.status ?? 'idle'),
        stage: String(response.stage ?? 'idle'),
        progress: Math.max(0, Math.min(100, Number(response.progress ?? 0))),
        message: String(response.message ?? 'No audit running.'),
        updatedAt:
          typeof response.updatedAt === 'string'
            ? response.updatedAt
            : typeof response.updated_at === 'string'
              ? response.updated_at
              : null,
        lastError:
          typeof response.lastError === 'string'
            ? response.lastError
            : typeof response.last_error === 'string'
              ? response.last_error
              : null
      })),
      catchError((error) =>
        throwError(() => new Error(this.toErrorMessage(error, 'Unable to load audit progress.')))
      )
    );
  }

  loadHistory(): Observable<SavedAuditReport[]> {
    if (this.capabilities.mockMode()) {
      return this.mock.getAuditReports();
    }

    return this.http.get<SavedAuditReport[]>(`${this.baseUrl}/api/Audit/history`);
  }

  saveLatestReport(): Observable<SavedAuditReport> {
    if (this.capabilities.mockMode()) {
      return this.loadHistory().pipe(
        map((history) => history[0]),
        map((report) => report ?? {
          id: crypto.randomUUID(),
          modelDescription: 'Mock Audit',
          fairnessScore: 7.8,
          complianceScore: 7.9,
          accuracyScore: 7.6,
          createdAt: new Date().toISOString()
        })
      );
    }

    return this.http.post<SavedAuditReport>(`${this.baseUrl}/api/Audit/save-report`, {});
  }

  downloadReport(id: string): Observable<Blob> {
    if (this.capabilities.mockMode()) {
      return of(
        new Blob([`Mock report ${id}`], { type: 'application/pdf' })
      );
    }

    return this.http.get(`${this.baseUrl}/api/Audit/report/${id}`, {
      responseType: 'blob'
    });
  }

  private toRiskLevel(value: unknown): 'Low' | 'Medium' | 'High' {
    return value === 'Low' || value === 'Medium' || value === 'High'
      ? value
      : 'Medium';
  }

  private toErrorMessage(error: any, fallback: string): string {
    const payload = error?.error;
    if (typeof payload === 'string' && payload.trim()) {
      return payload;
    }

    const details = payload?.details ?? payload?.detail;
    if (typeof details === 'string' && details.trim()) {
      return details;
    }

    const message = payload?.message ?? error?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }

  private mapHybridValidation(value: any): HybridValidationSummary | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const mapped = {
      overallStatus: String(value.overallStatus ?? value.overall_status ?? 'Unknown'),
      fairnessMetrics: this.toRecord(value.fairnessMetrics ?? value.fairness_metrics),
      fairnessMatrices: this.toRecord(value.fairnessMatrices ?? value.fairness_matrices),
      ruleResults: Array.isArray(value.ruleResults ?? value.rule_results)
        ? (value.ruleResults ?? value.rule_results).map((item: any) => ({
            metricName: String(item.metricName ?? item.metric_name ?? item.ruleName ?? item.rule_name ?? 'Metric'),
            operator: String(item.operator ?? ''),
            thresholdMin: this.toNullableNumber(item.thresholdMin ?? item.threshold_min),
            thresholdMax: this.toNullableNumber(item.thresholdMax ?? item.threshold_max),
            actualValue: this.toNullableNumber(item.actualValue ?? item.actual_value),
            status: String(item.status ?? 'UNKNOWN'),
            severity: String(item.severity ?? 'statistical')
          }))
        : []
    };

    return mapped.overallStatus === 'NOT_APPLICABLE' &&
      Object.keys(mapped.fairnessMetrics).length === 0 &&
      mapped.ruleResults.length === 0
      ? null
      : mapped;
  }

  private mapDeterministicDataset(value: any): DeterministicDatasetSummary | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const mapped = {
      rowCount: Number(value.rowCount ?? value.row_count ?? 0),
      totalRowsEvaluated: Number(value.totalRowsEvaluated ?? value.total_rows_evaluated ?? 0),
      previewRowLimit: Number(value.previewRowLimit ?? value.preview_row_limit ?? 0),
      previewRowCount: Number(value.previewRowCount ?? value.preview_row_count ?? 0),
      sourceMode: String(value.sourceMode ?? value.source_mode ?? 'unknown'),
      truncated: Boolean(value.truncated ?? false),
      rows: Array.isArray(value.rows)
        ? value.rows.filter((row: unknown) => row && typeof row === 'object')
        : []
    };

    return mapped.totalRowsEvaluated === 0 && mapped.rows.length === 0 ? null : mapped;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private toNullableNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
