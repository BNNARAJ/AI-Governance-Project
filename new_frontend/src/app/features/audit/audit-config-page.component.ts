import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { GovernanceWorkspaceService } from '../../core/services/governance-workspace.service';
import { AuditConfiguration, ConnectionType } from '../../core/models/governance.models';
import { BackendCapabilitiesService } from '../../core/services/backend-capabilities.service';
import { AuditApiService } from '../../core/services/audit-api.service';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SurfaceCardComponent } from '../../shared/ui/surface-card.component';

type AuditStepState = 'pending' | 'active' | 'complete' | 'error';

interface AuditStep {
  label: string;
  detail: string;
  state: AuditStepState;
}

@Component({
  selector: 'app-audit-config-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    SurfaceCardComponent
  ],
  templateUrl: './audit-config-page.component.html',
  styleUrl: './audit-config-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditConfigPageComponent {
  private readonly capabilities = inject(BackendCapabilitiesService);
  private readonly auditApi = inject(AuditApiService);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly workspace = inject(GovernanceWorkspaceService);
  private readonly router = inject(Router);

  protected readonly note = signal('');
  protected readonly selectedModelFile = signal<File | null>(null);
  protected readonly modelUploadRunning = signal(false);
  protected readonly uploadedModelName = signal('');
  protected readonly auditProgress = this.workspace.auditProgress;
  protected readonly auditPreflight = this.workspace.auditPreflight;
  protected readonly auditRunState = this.capabilities.blockedState('auditRun');
  protected readonly runAvailable = this.capabilities.isAvailable('auditRun');
  protected readonly factorInput = signal('');
  protected readonly varianceFactors = signal<string[]>([
    'Gender',
    'Location',
    'Income'
  ]);
  protected readonly presets = [
    'Age',
    'Accessibility',
    'Credit History',
    'Ethnicity',
    'Language',
    'Region'
  ];
  protected readonly formSnapshot = signal({
    modelDescription: 'Loan underwriting assistant for small business applicants',
    connectionType: 'api' as ConnectionType,
    apiMode: 'prompt',
    apiUrl: 'https://api.example.com/predict',
    apiKey: '',
    modelName: '',
    localModelName: '',
    testCount: 8
  });
  protected readonly reviewSummary = computed(() => {
    const snapshot = this.formSnapshot();
    const modelDescription = snapshot.modelDescription.trim();
    const factorCount = this.varianceFactors().length;
    const modeLabel =
      snapshot.connectionType === 'api' ? 'Hosted service review' : 'Model bundle review';
    const executionLabel =
      snapshot.apiMode === 'features' ? 'Structured feature payloads' : 'Prompt-style requests';
    const scenarioDepth =
      snapshot.testCount >= 10 ? 'Expanded coverage' : snapshot.testCount >= 6 ? 'Balanced coverage' : 'Focused coverage';

    return {
      modelDescription:
        modelDescription.length > 0
          ? modelDescription
          : 'No model description added yet.',
      factorCount,
      modeLabel,
      executionLabel,
      scenarioDepth,
      briefing: `${snapshot.testCount} review scenario${snapshot.testCount === 1 ? '' : 's'} across ${factorCount} governance factor${factorCount === 1 ? '' : 's'}.`
    };
  });
  protected readonly runExperience = computed(() => {
    const running = this.workspace.auditRunning();
    const connectionType = this.form.controls.connectionType.value;

    if (running) {
      const progress = this.auditProgress();
      return {
        title: `${this.formatStage(progress.stage)} (${progress.progress}%)`,
        detail: progress.message ||
          (connectionType === 'api'
            ? 'The .NET API is coordinating the Python audit service and compiling the latest response.'
            : 'The .NET API is preparing the uploaded model bundle and collecting the current review output.')
      };
    }

    return {
      title: 'Ready to launch',
        detail:
          connectionType === 'api'
            ? 'Use a reachable model endpoint and provide the exact LLM model name when using OpenRouter or another chat-completions provider.'
          : 'Upload a ZIP model bundle first. The review will use the uploaded model identifier returned by the backend.'
    };
  });
  protected readonly auditSteps = computed<AuditStep[]>(() => {
    const progress = this.auditProgress();
    const preflight = this.auditPreflight();
    const failed = progress.status === 'failed';
    const completed = progress.status === 'completed';
    const stageRank = failed
      ? this.failedStageRank(progress.stage, progress.message, progress.progress)
      : this.stageRank(progress.stage, progress.progress);
    const endpointReady = Boolean(preflight?.pythonReachable && preflight?.targetEndpointReachable);
    const endpointState: AuditStepState = preflight
      ? endpointReady
        ? 'complete'
        : 'error'
      : this.stepState(stageRank, 2, failed, completed);

    return [
      {
        label: 'Audit started',
        detail: 'The run request reached the governance workflow.',
        state: this.stepState(stageRank, 1, failed, completed)
      },
      {
        label: 'Endpoint connected',
        detail: preflight?.message ?? 'Checking Python and target endpoint readiness.',
        state: endpointState
      },
      {
        label: 'Test cases generation',
        detail: 'Regulation context is converted into audit scenarios.',
        state: this.stepState(stageRank, 3, failed, completed)
      },
      {
        label: 'Model testing',
        detail: 'The selected model endpoint is receiving audit prompts.',
        state: this.stepState(stageRank, 4, failed, completed)
      },
      {
        label: 'Getting responses',
        detail: 'Target model outputs are being collected for review.',
        state: this.stepState(stageRank, 5, failed, completed)
      },
      {
        label: 'Evaluation',
        detail: 'Responses are graded and final findings are compiled.',
        state: this.stepState(stageRank, 6, failed, completed)
      }
    ];
  });
  protected readonly qualityChecks = computed(() => {
    const snapshot = this.formSnapshot();
    const factors = this.varianceFactors();

    return [
      {
        label: 'Model context',
        state: snapshot.modelDescription.trim().length >= 20 ? 'Ready' : 'Needs detail'
      },
      {
        label: 'Variance coverage',
        state: factors.length >= 3 ? 'Strong' : factors.length > 0 ? 'Partial' : 'Missing'
      },
      {
        label: 'Execution depth',
        state: snapshot.testCount >= 8 ? 'Expanded' : snapshot.testCount >= 5 ? 'Standard' : 'Light'
      }
    ];
  });
  protected readonly guidanceNotes = [
    'Use the model description to explain the business outcome being reviewed, not only the technical implementation.',
    'Choose variance factors that reflect the policy and fairness questions most likely to influence release decisions.',
    'Set a test count that is large enough to surface signal patterns without overwhelming reviewers.'
  ];

  protected readonly form = this.formBuilder.nonNullable.group({
    modelDescription: [
      'Loan underwriting assistant for small business applicants',
      [Validators.required, Validators.minLength(20)]
    ],
    connectionType: ['api' as ConnectionType, Validators.required],
    apiMode: ['prompt'],
    apiUrl: ['https://api.example.com/predict'],
    apiKey: [''],
    modelName: [''],
    localModelName: [''],
    testCount: [8, [Validators.required, Validators.min(3), Validators.max(20)]]
  });

  constructor() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.formSnapshot.set(this.form.getRawValue()));

    effect(() => {
      const draft = this.workspace.draftConfiguration();
      if (!draft) {
        return;
      }

      this.form.patchValue({
        modelDescription: draft.modelDescription,
        connectionType: draft.connectionType,
        apiMode: draft.apiMode,
        apiUrl: draft.apiUrl ?? '',
        apiKey: draft.apiKey ?? '',
        modelName: draft.modelName ?? '',
        localModelName: draft.localModelName ?? '',
        testCount: draft.testCount
      });
      this.varianceFactors.set([...draft.varianceFactors]);
      this.formSnapshot.set(this.form.getRawValue());
    });
  }

  protected addFactor(value = this.factorInput().trim()): void {
    if (!value) {
      return;
    }

    this.varianceFactors.update((current) =>
      current.includes(value) ? current : [...current, value]
    );
    this.factorInput.set('');
  }

  protected removeFactor(value: string): void {
    this.varianceFactors.update((current) =>
      current.filter((entry) => entry !== value)
    );
  }

  protected setFactorInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.factorInput.set(input?.value ?? '');
  }

  protected onFactorKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    this.addFactor();
  }

  protected async saveDraft(): Promise<void> {
    const configuration = this.toConfiguration();
    if (!configuration) {
      return;
    }

    await this.workspace.saveAuditConfiguration(configuration);
    this.note.set('Scenario saved for this review session.');
  }

  protected async runAudit(): Promise<void> {
    try {
      if (this.form.controls.connectionType.value === 'upload') {
        await this.ensureModelUploaded();
      }

      const configuration = this.toConfiguration();
      if (!configuration || !this.runAvailable) {
        return;
      }

      this.note.set('');
      await this.workspace.runAudit(configuration);
      await this.router.navigateByUrl('/results');
    } catch {
      this.note.set(
        this.workspace.lastError() ??
          (this.note() ||
          'The review could not be started right now. Please try again shortly.'
          )
      );
    }
  }

  protected onModelFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.selectedModelFile.set(file);

    if (!file) {
      return;
    }

    this.form.controls.localModelName.setValue('');
    this.uploadedModelName.set('');
    this.note.set(`${file.name} selected. Upload it before running the model audit.`);
  }

  protected async uploadSelectedModel(): Promise<void> {
    await this.ensureModelUploaded(true);
  }

  protected isConnection(connectionType: ConnectionType): boolean {
    return this.form.controls.connectionType.value === connectionType;
  }

  protected formatStage(stage: string): string {
    return stage
      .replace(/[_-]+/g, ' ')
      .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
  }

  protected stepIcon(state: string): string {
    if (state === 'complete') {
      return 'OK';
    }

    if (state === 'error') {
      return '!';
    }

    if (state === 'active') {
      return '...';
    }

    return '';
  }

  private async ensureModelUploaded(force = false): Promise<void> {
    if (this.form.controls.connectionType.value !== 'upload') {
      return;
    }

    const existingModelId = this.form.controls.localModelName.value.trim();
    if (existingModelId && !force) {
      return;
    }

    const file = this.selectedModelFile();
    if (!file) {
      this.note.set('Choose a model ZIP file before running the uploaded model audit.');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.zip')) {
      this.note.set('Only .zip MLflow model bundles are supported for upload mode.');
      return;
    }

    this.modelUploadRunning.set(true);
    this.note.set('Uploading model bundle through the .NET backend...');

    try {
      const upload = await firstValueFrom(this.auditApi.uploadModel(file));
      if (!upload.modelId) {
        throw new Error('The backend did not return a model id for the uploaded bundle.');
      }

      this.form.controls.localModelName.setValue(upload.modelId);
      this.uploadedModelName.set(upload.fileName);
      this.note.set(`Model uploaded successfully. Backend model id: ${upload.modelId}`);
    } catch (error) {
      this.note.set(
        error instanceof Error
          ? error.message
          : 'Model upload failed. Please verify the backend and Python service are running.'
      );
      throw error;
    } finally {
      this.modelUploadRunning.set(false);
    }
  }

  private toConfiguration(): AuditConfiguration | null {
    if (this.form.invalid || this.varianceFactors().length === 0) {
      this.form.markAllAsTouched();
      this.note.set(
        'Add a model description, at least one variance factor, and a valid test count to continue.'
      );
      return null;
    }

    const rawValue = this.form.getRawValue();
    const normalizedApiUrl = rawValue.apiUrl.trim().toLowerCase();

    if (
      rawValue.connectionType === 'api' &&
      rawValue.apiMode === 'prompt' &&
      normalizedApiUrl.includes('openrouter.ai') &&
      rawValue.modelName.trim().length === 0
    ) {
      this.note.set('Add the exact OpenRouter model name before running the audit.');
      return null;
    }

    if (rawValue.connectionType === 'upload' && rawValue.localModelName.trim().length === 0) {
      this.note.set('Upload a model ZIP first so the backend can return the model id for testing.');
      return null;
    }

    return {
      modelDescription: rawValue.modelDescription.trim(),
      varianceFactors: this.varianceFactors(),
      testCount: rawValue.testCount,
      connectionType: rawValue.connectionType,
      apiMode: rawValue.apiMode as 'prompt' | 'features',
      apiUrl: rawValue.apiUrl.trim() || null,
      apiKey: rawValue.apiKey.trim() || null,
      modelName: rawValue.modelName.trim() || null,
      localModelName: rawValue.localModelName.trim() || null
    };
  }

  private stepState(
    currentRank: number,
    stepRank: number,
    failed: boolean,
    completed: boolean
  ): AuditStepState {
    if (completed) {
      return 'complete';
    }

    if (failed) {
      if (currentRank > stepRank) {
        return 'complete';
      }

      return currentRank === stepRank ? 'error' : 'pending';
    }

    if (currentRank === stepRank) {
      return 'active';
    }

    return currentRank > stepRank ? 'complete' : 'pending';
  }

  private stageRank(stage: string, progress = 0): number {
    if (stage === 'progress_monitor_retrying') {
      if (progress >= 82) {
        return 6;
      }

      if (progress >= 77) {
        return 5;
      }

      if (progress >= 55) {
        return 4;
      }

      if (progress >= 10) {
        return 3;
      }

      return 2;
    }

    const ranks: Record<string, number> = {
      idle: 0,
      checking_connections: 1,
      connections_ready: 2,
      configured: 2,
      starting: 1,
      preparing: 3,
      regulation_context: 3,
      retrieval: 3,
      generating_tests: 3,
      calling_target_model: 4,
      collecting_response: 5,
      grading: 6,
      compiling_results: 6,
      statistical_governance: 6,
      saving_results: 6,
      completed: 7,
      failed: 0
    };

    return ranks[stage] ?? 0;
  }

  private failedStageRank(stage: string, message: string, progress: number): number {
    const knownRank = this.stageRank(stage, progress);
    if (knownRank > 0) {
      return knownRank;
    }

    const normalizedMessage = message.toLowerCase();
    if (normalizedMessage.includes('target model') || normalizedMessage.includes('api error')) {
      return 4;
    }

    if (normalizedMessage.includes('response') || normalizedMessage.includes('json')) {
      return 5;
    }

    if (normalizedMessage.includes('grading') || normalizedMessage.includes('evaluation')) {
      return 6;
    }

    if (normalizedMessage.includes('regulation') || normalizedMessage.includes('test case')) {
      return 3;
    }

    if (
      normalizedMessage.includes('python') ||
      normalizedMessage.includes('endpoint') ||
      normalizedMessage.includes('connection')
    ) {
      return 2;
    }

    if (progress >= 82) {
      return 6;
    }

    if (progress >= 77) {
      return 5;
    }

    if (progress >= 55) {
      return 4;
    }

    if (progress >= 10) {
      return 3;
    }

    return 2;
  }
}
