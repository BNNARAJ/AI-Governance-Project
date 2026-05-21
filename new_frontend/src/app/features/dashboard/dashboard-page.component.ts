import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GovernanceWorkspaceService } from '../../core/services/governance-workspace.service';
import { BackendCapabilitiesService } from '../../core/services/backend-capabilities.service';
import { SessionService } from '../../core/services/session.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { StatCardComponent } from '../../shared/ui/stat-card.component';
import { SurfaceCardComponent } from '../../shared/ui/surface-card.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    PageHeaderComponent,
    StatCardComponent,
    SurfaceCardComponent
  ],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent {
  private readonly capabilities = inject(BackendCapabilitiesService);
  private readonly session = inject(SessionService);
  protected readonly workspace = inject(GovernanceWorkspaceService);
  protected readonly currentUser = this.session.currentUser;
  protected readonly dashboardAvailable = this.capabilities.isAvailable('dashboard');

  protected readonly operatingPriorities = [
    'Curate the policy set that governs the model family before a review cycle begins.',
    'Define targeted scenarios around protected attributes, decision thresholds, and release risks.',
    'Capture audit output in a consistent format so review teams can work from the same evidence.'
  ];

  protected readonly roleActions = computed(() => {
    const role = this.currentUser()?.role;

    if (role === 'admin') {
      return [
        'Review open approval items and unresolved policy issues.',
        'Check which model reviews need attention.',
        'Confirm policy thresholds before release decisions.'
      ];
    }

    if (role === 'compliance_officer') {
      return [
        'Validate the regulation set attached to the current model.',
        'Focus on scenarios related to fairness, explainability, and compliance.',
        'Record remediation items before sign-off.'
      ];
    }

    return [
      'Confirm the target model, connection mode, and test design.',
      'Focus on the highest-risk factors first.',
      'Turn findings into action items for follow-up.'
    ];
  });

  protected readonly postureTitle = computed(() => {
    const dashboard = this.workspace.dashboard();
    if (!dashboard) {
      return 'Governance overview';
    }

    if (dashboard.stats.policyViolations > 3) {
      return 'Review attention needed';
    }

    if (dashboard.stats.avgFairness >= 7.5) {
      return 'Current posture is stable';
    }

    return 'Continue active review';
  });

  protected readonly postureCopy = computed(() => {
    const dashboard = this.workspace.dashboard();
    if (!dashboard) {
      return 'Use this page to review metrics, recent activity, and the next steps for the current governance workflow.';
    }

    return `${dashboard.stats.auditsRun} audit runs are tracked here, with an average fairness score of ${dashboard.stats.avgFairness.toFixed(1)} and ${dashboard.stats.policyViolations} items needing attention.`;
  });

  constructor() {
    if (this.dashboardAvailable) {
      void this.workspace.ensureDashboardLoaded().catch(() => {
        // Error text is exposed through workspace.lastError and rendered by template.
      });
    }
  }

  protected statusTone(status: string): 'ok' | 'warning' | 'offline' {
    if (status === 'online') {
      return 'ok';
    }

    if (status === 'warning') {
      return 'warning';
    }

    return 'offline';
  }
}
