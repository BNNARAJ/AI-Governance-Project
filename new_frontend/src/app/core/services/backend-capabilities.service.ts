import { computed, Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  BackendCapabilities,
  BackendCapabilityKey,
  BlockedFeatureState,
  FrontendMode
} from '../models/governance.models';

const FEATURE_STATES: Record<BackendCapabilityKey, BlockedFeatureState> = {
  auth: {
    title: 'Access',
    message:
      'Use your workspace credentials to access the application.',
    ownerNote: 'Ready to use'
  },
  dashboard: {
    title: 'Dashboard',
    message:
      'Dashboard metrics will appear here when live data is connected.',
    ownerNote: 'Coming soon'
  },
  regulationUpload: {
    title: 'Regulations',
    message:
      'Upload and indexing for regulation documents will appear here when the flow is connected.',
    ownerNote: 'Coming soon'
  },
  auditConfigurationSave: {
    title: 'Saved configurations',
    message:
      'Shared audit configurations will appear here when saving is available.',
    ownerNote: 'Coming soon'
  },
  auditRun: {
    title: 'Audit run',
    message:
      'Run an audit and review the current findings for the selected model.',
    ownerNote: 'Ready to use'
  },
  auditHistory: {
    title: 'Audit history',
    message:
      'Previous audit runs will appear here when history is available.',
    ownerNote: 'Coming soon'
  },
  reportDownload: {
    title: 'Reports',
    message:
      'Downloadable reports will appear here when export is available.',
    ownerNote: 'Coming soon'
  },
  admin: {
    title: 'Admin',
    message:
      'User and policy management will appear here when admin tools are connected.',
    ownerNote: 'Coming soon'
  }
};

@Injectable({
  providedIn: 'root'
})
export class BackendCapabilitiesService {
  readonly mode = signal<FrontendMode>(environment.frontendMode as FrontendMode);
  readonly capabilities = signal<BackendCapabilities>({
    ...environment.backendCapabilities
  });

  readonly integrationMode = computed(() => this.mode() === 'integration');
  readonly mockMode = computed(() => this.mode() === 'mock');

  isAvailable(feature: BackendCapabilityKey): boolean {
    return this.mockMode() || this.capabilities()[feature];
  }

  blockedState(feature: BackendCapabilityKey): BlockedFeatureState {
    return FEATURE_STATES[feature];
  }

  modeLabel(): string {
    return this.integrationMode() ? 'integration' : 'mock';
  }
}
