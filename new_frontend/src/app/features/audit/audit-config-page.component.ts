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
      return {
        title: 'Running review through the integrated backend',
        detail:
          connectionType === 'api'
            ? 'The .NET API is coordinating the Python audit service and compiling the latest response. This usually takes around 15 to 30 seconds.'
            : 'The .NET API is preparing the uploaded model bundle and collecting the current review output. This usually takes around 15 to 30 seconds.'
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
}
