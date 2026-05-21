import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { GovernanceWorkspaceService } from '../../core/services/governance-workspace.service';
import { BackendCapabilitiesService } from '../../core/services/backend-capabilities.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { BlockedFeatureCardComponent } from '../../shared/ui/blocked-feature-card.component';
import { SurfaceCardComponent } from '../../shared/ui/surface-card.component';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [
    TitleCasePipe,
    PageHeaderComponent,
    BlockedFeatureCardComponent,
    SurfaceCardComponent,
    IconComponent
  ],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminPageComponent {
  private readonly capabilities = inject(BackendCapabilitiesService);
  protected readonly workspace = inject(GovernanceWorkspaceService);
  protected readonly adminAvailable = this.capabilities.isAvailable('admin');
  protected readonly adminBlockedState = this.capabilities.blockedState('admin');

  constructor() {
    if (this.adminAvailable) {
      void this.workspace.loadAdminOverview().catch(() => {
        // Error details are exposed via workspace.lastError.
      });
    }
  }
}
