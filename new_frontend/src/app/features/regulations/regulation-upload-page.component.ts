import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { GovernanceWorkspaceService } from '../../core/services/governance-workspace.service';
import { BackendCapabilitiesService } from '../../core/services/backend-capabilities.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { BlockedFeatureCardComponent } from '../../shared/ui/blocked-feature-card.component';
import { SurfaceCardComponent } from '../../shared/ui/surface-card.component';

@Component({
  selector: 'app-regulation-upload-page',
  standalone: true,
  imports: [
    DatePipe,
    PageHeaderComponent,
    BlockedFeatureCardComponent,
    SurfaceCardComponent
  ],
  templateUrl: './regulation-upload-page.component.html',
  styleUrl: './regulation-upload-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegulationUploadPageComponent {
  private readonly capabilities = inject(BackendCapabilitiesService);
  protected readonly workspace = inject(GovernanceWorkspaceService);
  protected readonly selectedFiles = signal<File[]>([]);
  protected readonly bannerMessage = signal('');
  protected readonly uploadSummary = this.workspace.lastUploadSummary;
  protected readonly libraryEntries = this.workspace.regulationLibrary;
  protected readonly uploadAvailable =
    this.capabilities.isAvailable('regulationUpload');
  protected readonly uploadBlockedState =
    this.capabilities.blockedState('regulationUpload');

  constructor() {
    if (this.uploadAvailable) {
      void this.workspace.loadRegulationLibrary().catch(() => {
        // Error is surfaced via workspace.lastError.
      });
    }
  }

  protected handleFileSelection(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const files = input?.files ? Array.from(input.files) : [];
    this.selectedFiles.set(files);
    this.bannerMessage.set('');
  }

  protected removeFile(name: string): void {
    this.selectedFiles.update((files) => files.filter((file) => file.name !== name));
  }

  protected async upload(): Promise<void> {
    if (!this.uploadAvailable) {
      this.bannerMessage.set('Document intake will open here once the shared library is connected.');
      return;
    }

    const files = this.selectedFiles();
    if (files.length === 0) {
      this.bannerMessage.set('Select one or more PDF documents before indexing.');
      return;
    }

    try {
      const summary = await this.workspace.uploadRegulations(files);
      this.selectedFiles.set([]);
      this.bannerMessage.set(
        `${summary.uploadedCount} source document(s) were queued and ${summary.indexedArtifacts} regulation chunks were generated.`
      );
    } catch {
      this.bannerMessage.set(
        this.workspace.lastError() ??
          'Document intake is unavailable right now. Please try again shortly.'
      );
    }
  }

  protected openDocument(downloadUrl: string): void {
    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
  }

  protected async removeFromIndex(entryId: string): Promise<void> {
    try {
      await this.workspace.removeRegulationFromIndex(entryId);
      this.bannerMessage.set('Regulation removed from the active review context. It remains available for reuse.');
    } catch {
      this.bannerMessage.set(
        this.workspace.lastError() ?? 'Unable to remove this regulation right now.'
      );
    }
  }

  protected async reuse(entryId: string): Promise<void> {
    try {
      await this.workspace.reuseRegulation(entryId);
      this.bannerMessage.set('Regulation is active again and ready for the next review.');
    } catch {
      this.bannerMessage.set(
        this.workspace.lastError() ?? 'Unable to reuse this regulation right now.'
      );
    }
  }
}
