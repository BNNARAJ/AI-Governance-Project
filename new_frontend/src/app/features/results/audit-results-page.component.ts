import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GovernanceWorkspaceService } from '../../core/services/governance-workspace.service';
import { BackendCapabilitiesService } from '../../core/services/backend-capabilities.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SurfaceCardComponent } from '../../shared/ui/surface-card.component';

@Component({
  selector: 'app-audit-results-page',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    PageHeaderComponent,
    SurfaceCardComponent
  ],
  templateUrl: './audit-results-page.component.html',
  styleUrl: './audit-results-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditResultsPageComponent {
  private readonly capabilities = inject(BackendCapabilitiesService);
  protected readonly workspace = inject(GovernanceWorkspaceService);
  protected readonly response = this.workspace.latestAuditResponse;
  protected readonly auditHistory = this.workspace.auditHistory;
  protected readonly historyAvailable = this.capabilities.isAvailable('auditHistory');
  protected readonly reportAvailable = this.capabilities.isAvailable('reportDownload');
  protected readonly actionNotice = signal<string | null>(null);

  constructor() {
    if (this.historyAvailable) {
      void this.workspace.loadAuditHistory().catch(() => {
        // Error is surfaced via workspace.lastError.
      });
    }
  }

  protected async saveLatestReport(): Promise<void> {
    try {
      const saved = await this.workspace.saveLatestReport();
      this.actionNotice.set(`Saved a report snapshot for ${saved.modelDescription}.`);
    } catch {
      this.actionNotice.set(
        this.workspace.lastError() ?? 'The report could not be saved right now.'
      );
    }
  }

  protected async downloadReport(id: string, modelDescription: string): Promise<void> {
    try {
      const blob = await this.workspace.downloadSavedReport(id);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${modelDescription.replace(/\s+/g, '_') || 'audit-report'}.pdf`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      this.actionNotice.set(`Downloaded ${modelDescription}.`);
    } catch {
      this.actionNotice.set(
        this.workspace.lastError() ?? 'The report download could not be completed.'
      );
    }
  }

  protected latestSavedReportId(): string | null {
    return this.auditHistory()[0]?.id ?? null;
  }

  protected scoreTone(score: number): 'good' | 'warning' | 'bad' {
    if (score >= 7) {
      return 'good';
    }

    if (score >= 4) {
      return 'warning';
    }

    return 'bad';
  }

  protected scoreLabel(score: number): string {
    if (score >= 8) {
      return 'Excellent';
    }

    if (score >= 7) {
      return 'Good';
    }

    if (score >= 5) {
      return 'Fair';
    }

    if (score >= 3) {
      return 'Poor';
    }

    return 'Critical';
  }
}
