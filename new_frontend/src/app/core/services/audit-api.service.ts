import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MockGovernanceDataSource } from '../data/mock-governance-data-source.service';
import {
  AuditConfiguration,
  CurrentAuditResponse,
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
          detectedArtifacts: response.detectedArtifacts ?? response.detected_artifacts ?? null,
          modelMetadata: response.modelMetadata ?? response.model_metadata ?? null,
          modelInspection: response.modelInspection ?? response.model_inspection ?? null
        }))
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
          warnings: []
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
            : []
        }))
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
}
