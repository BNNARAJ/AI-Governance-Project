import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AdminOverview,
  AuditConfiguration,
  AuditPreflight,
  AuditProgress,
  CurrentAuditResponse,
  DashboardSnapshot,
  RegulationLibraryEntry,
  RegulationUploadSummary,
  SavedAuditReport
} from '../models/governance.models';
import { AdminService } from './admin.service';
import { AuditApiService } from './audit-api.service';
import { BackendCapabilitiesService } from './backend-capabilities.service';
import { DashboardService } from './dashboard.service';
import { RegulationsService } from './regulations.service';
import { SessionService } from './session.service';

@Injectable({
  providedIn: 'root'
})
export class GovernanceWorkspaceService {
  private readonly adminService = inject(AdminService);
  private readonly auditApi = inject(AuditApiService);
  private readonly capabilities = inject(BackendCapabilitiesService);
  private readonly dashboardService = inject(DashboardService);
  private readonly regulationsService = inject(RegulationsService);
  private readonly session = inject(SessionService);

  readonly dashboard = signal<DashboardSnapshot | null>(null);
  readonly adminOverview = signal<AdminOverview | null>(null);
  readonly draftConfiguration = signal<AuditConfiguration | null>(null);
  readonly latestAuditResponse = signal<CurrentAuditResponse | null>(null);
  readonly auditPreflight = signal<AuditPreflight | null>(null);
  readonly auditHistory = signal<SavedAuditReport[]>([]);
  readonly regulationLibrary = signal<RegulationLibraryEntry[]>([]);
  readonly lastUploadSummary = signal<RegulationUploadSummary | null>(null);
  readonly auditProgress = signal<AuditProgress>({
    status: 'idle',
    stage: 'idle',
    progress: 0,
    message: 'No audit running.',
    updatedAt: null,
    lastError: null
  });
  readonly lastError = signal<string | null>(null);

  readonly dashboardLoading = signal(false);
  readonly adminLoading = signal(false);
  readonly configSaving = signal(false);
  readonly auditRunning = signal(false);
  readonly historyLoading = signal(false);
  readonly regulationLibraryLoading = signal(false);
  readonly reportSaving = signal(false);
  readonly uploadRunning = signal(false);
  private auditStartedAtMs = 0;
  private progressPollFailures = 0;

  readonly overallBusy = computed(
    () =>
      this.dashboardLoading() ||
      this.adminLoading() ||
      this.configSaving() ||
      this.auditRunning() ||
      this.historyLoading() ||
      this.regulationLibraryLoading() ||
      this.reportSaving() ||
      this.uploadRunning()
  );

  async ensureDashboardLoaded(force = false): Promise<void> {
    if (!this.capabilities.isAvailable('dashboard')) {
      this.dashboard.set(null);
      return;
    }

    if (this.dashboard() && !force) {
      return;
    }

    const user = this.session.currentUser();
    if (!user) {
      return;
    }

    this.dashboardLoading.set(true);
    this.lastError.set(null);

    try {
      const snapshot = await firstValueFrom(this.dashboardService.loadDashboard());
      this.dashboard.set(snapshot);
    } catch (error) {
      this.lastError.set(
        error instanceof Error ? error.message : 'Unable to load dashboard.'
      );
      throw error;
    } finally {
      this.dashboardLoading.set(false);
    }
  }

  async uploadRegulations(files: readonly File[]): Promise<RegulationUploadSummary> {
    this.uploadRunning.set(true);
    this.lastError.set(null);

    try {
      const summary = await firstValueFrom(this.regulationsService.upload(files));
      this.lastUploadSummary.set(summary);
      await this.loadRegulationLibrary(true).catch(() => {
        // Library refresh should not mask a successful upload.
      });
      await this.ensureDashboardLoaded(true);
      return summary;
    } catch (error) {
      this.lastError.set(
        error instanceof Error
          ? error.message
          : 'Unable to upload regulations.'
      );
      throw error;
    } finally {
      this.uploadRunning.set(false);
    }
  }

  async removeRegulationFromIndex(entryId: string): Promise<void> {
    this.regulationLibraryLoading.set(true);
    this.lastError.set(null);

    try {
      const updated = await firstValueFrom(
        this.regulationsService.removeFromActiveIndex(entryId)
      );
      this.regulationLibrary.update((entries) =>
        entries.map((entry) =>
          entry.id === entryId
            ? { ...entry, ...updated, active: false, status: 'Available' }
            : entry
        )
      );
    } catch (error) {
      this.lastError.set(
        error instanceof Error
          ? error.message
          : 'Unable to remove regulation from the active index.'
      );
      throw error;
    } finally {
      this.regulationLibraryLoading.set(false);
    }
  }

  async reuseRegulation(entryId: string): Promise<void> {
    this.regulationLibraryLoading.set(true);
    this.lastError.set(null);

    try {
      const updated = await firstValueFrom(this.regulationsService.reuse(entryId));
      this.regulationLibrary.update((entries) =>
        entries.map((entry) =>
          entry.id === entryId
            ? { ...entry, ...updated, active: true, status: 'Indexed' }
            : entry
        )
      );
    } catch (error) {
      this.lastError.set(
        error instanceof Error
          ? error.message
          : 'Unable to reuse the selected regulation.'
      );
      throw error;
    } finally {
      this.regulationLibraryLoading.set(false);
    }
  }

  async saveAuditConfiguration(configuration: AuditConfiguration): Promise<void> {
    this.configSaving.set(true);
    this.lastError.set(null);

    try {
      this.draftConfiguration.set(configuration);
    } catch (error) {
      this.lastError.set(
        error instanceof Error
          ? error.message
          : 'Unable to save audit configuration.'
      );
      throw error;
    } finally {
      this.configSaving.set(false);
    }
  }

  async runAudit(configuration: AuditConfiguration): Promise<CurrentAuditResponse> {
    this.auditRunning.set(true);
    this.lastError.set(null);
    this.auditPreflight.set(null);
    this.auditStartedAtMs = Date.now();
    this.progressPollFailures = 0;
    this.auditProgress.set({
      status: 'running',
      stage: 'checking_connections',
      progress: 2,
      message: 'Checking Python service and target API endpoint before starting the audit.',
      updatedAt: new Date().toISOString(),
      lastError: null
    });
    let progressTimer: number | null = null;

    try {
      const preflight = await firstValueFrom(this.auditApi.preflight(configuration));
      this.auditPreflight.set(preflight);
      if (!preflight.pythonReachable || !preflight.targetEndpointReachable) {
        throw new Error(preflight.message);
      }

      this.auditProgress.set({
        status: 'running',
        stage: 'connections_ready',
        progress: 8,
        message: preflight.message,
        updatedAt: preflight.checkedAt ?? new Date().toISOString(),
        lastError: null
      });

      progressTimer = window.setInterval(() => {
        void this.refreshAuditProgress().catch(() => this.handleProgressPollFailure());
      }, 1500);

      const response = await firstValueFrom(this.auditApi.runAudit(configuration));
      this.draftConfiguration.set(configuration);
      this.latestAuditResponse.set(response);
      this.auditProgress.update((current) => ({
        ...current,
        status: 'completed',
        stage: 'completed',
        progress: 100,
        message: 'Audit completed successfully.',
        lastError: null
      }));
      await this.loadAuditHistory(true).catch(() => {
        // History is optional and should not block the latest result.
      });
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to run audit.';
      this.lastError.set(message);
      await this.refreshAuditProgress().catch(() => {
        this.auditProgress.set({
          status: 'failed',
          stage: 'failed',
          progress: 100,
          message,
          updatedAt: new Date().toISOString(),
          lastError: message
        });
      });
      if (this.auditProgress().status !== 'failed') {
        this.auditProgress.set({
          status: 'failed',
          stage: 'failed',
          progress: 100,
          message,
          updatedAt: new Date().toISOString(),
          lastError: message
        });
      }
      throw error;
    } finally {
      if (progressTimer !== null) {
        window.clearInterval(progressTimer);
      }
      this.auditRunning.set(false);
    }
  }

  async refreshAuditProgress(): Promise<void> {
    const progress = await firstValueFrom(this.auditApi.loadProgress());
    const previous = this.auditProgress();
    const shouldPreserveStage =
      progress.status === 'failed' &&
      progress.stage === 'failed' &&
      previous.status === 'running' &&
      previous.stage !== 'failed';

    this.auditProgress.set(
      shouldPreserveStage
        ? {
            ...progress,
            stage: previous.stage,
            progress: Math.max(progress.progress, previous.progress)
          }
        : progress
    );
    this.progressPollFailures = 0;
  }

  private handleProgressPollFailure(): void {
    this.progressPollFailures += 1;
    const elapsedSeconds = Math.max(1, Math.floor((Date.now() - this.auditStartedAtMs) / 1000));

    this.auditProgress.update((current) => {
      if (current.status === 'completed' || current.status === 'failed') {
        return current;
      }

      const estimatedProgress = Math.min(
        90,
        Math.max(current.progress, 8 + Math.floor(elapsedSeconds / 10) * 4)
      );

      return {
        ...current,
        status: 'running',
        stage: 'progress_monitor_retrying',
        progress: estimatedProgress,
        message:
          `Audit request is still running. Progress monitor is retrying ` +
          `(${elapsedSeconds}s elapsed, ${this.progressPollFailures} retry${this.progressPollFailures === 1 ? '' : 'ies'}).`,
        updatedAt: new Date().toISOString()
      };
    });
  }

  async loadAdminOverview(force = false): Promise<void> {
    if (!this.capabilities.isAvailable('admin')) {
      this.adminOverview.set(null);
      return;
    }

    if (this.adminOverview() && !force) {
      return;
    }

    this.adminLoading.set(true);
    this.lastError.set(null);

    try {
      const overview = await firstValueFrom(this.adminService.loadOverview());
      this.adminOverview.set(overview);
    } catch (error) {
      this.lastError.set(
        error instanceof Error ? error.message : 'Unable to load admin overview.'
      );
      throw error;
    } finally {
      this.adminLoading.set(false);
    }
  }

  async loadAuditHistory(force = false): Promise<void> {
    if (!this.capabilities.isAvailable('auditHistory')) {
      this.auditHistory.set([]);
      return;
    }

    if (this.auditHistory().length > 0 && !force) {
      return;
    }

    this.historyLoading.set(true);
    this.lastError.set(null);

    try {
      const history = await firstValueFrom(this.auditApi.loadHistory());
      this.auditHistory.set(history);
    } catch (error) {
      this.lastError.set(
        error instanceof Error ? error.message : 'Unable to load audit history.'
      );
      throw error;
    } finally {
      this.historyLoading.set(false);
    }
  }

  async loadRegulationLibrary(force = false): Promise<void> {
    if (!this.capabilities.isAvailable('regulationUpload')) {
      this.regulationLibrary.set([]);
      return;
    }

    if (this.regulationLibrary().length > 0 && !force) {
      return;
    }

    this.regulationLibraryLoading.set(true);
    this.lastError.set(null);

    try {
      const entries = await firstValueFrom(this.regulationsService.list());
      this.regulationLibrary.set(entries);
    } catch (error) {
      this.lastError.set(
        error instanceof Error ? error.message : 'Unable to load the regulation library.'
      );
      throw error;
    } finally {
      this.regulationLibraryLoading.set(false);
    }
  }

  async saveLatestReport(): Promise<SavedAuditReport> {
    this.reportSaving.set(true);
    this.lastError.set(null);

    try {
      const report = await firstValueFrom(this.auditApi.saveLatestReport());
      this.auditHistory.update((history) => [report, ...history.filter((item) => item.id !== report.id)]);
      return report;
    } catch (error) {
      this.lastError.set(
        error instanceof Error ? error.message : 'Unable to save the latest report.'
      );
      throw error;
    } finally {
      this.reportSaving.set(false);
    }
  }

  async downloadSavedReport(id: string): Promise<Blob> {
    this.lastError.set(null);

    try {
      return await firstValueFrom(this.auditApi.downloadReport(id));
    } catch (error) {
      this.lastError.set(
        error instanceof Error ? error.message : 'Unable to download the report.'
      );
      throw error;
    }
  }

}
