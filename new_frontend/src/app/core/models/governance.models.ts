export type UserRole = 'admin' | 'compliance_officer' | 'ai_developer';
export type ConnectionType = 'api' | 'upload';
export type ApiMode = 'prompt' | 'features';
export type PlatformStatus = 'online' | 'warning' | 'offline';
export type FrontendMode = 'integration' | 'mock';
export type BackendCapabilityKey =
  | 'auth'
  | 'dashboard'
  | 'regulationUpload'
  | 'auditConfigurationSave'
  | 'auditRun'
  | 'auditHistory'
  | 'reportDownload'
  | 'admin';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegistrationRequest {
  username: string;
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  department: string;
}

export interface AppUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  department: string;
}

export interface DashboardStats {
  indexedRegulations: number;
  auditsRun: number;
  avgFairness: number;
  policyViolations: number;
}

export interface HealthSignal {
  name: string;
  status: PlatformStatus;
  description: string;
}

export interface BackendCapabilities {
  auth: boolean;
  dashboard: boolean;
  regulationUpload: boolean;
  auditConfigurationSave: boolean;
  auditRun: boolean;
  auditHistory: boolean;
  reportDownload: boolean;
  admin: boolean;
}

export interface BlockedFeatureState {
  title: string;
  message: string;
  ownerNote: string;
}

export interface AuditHistoryEntry {
  id: string;
  modelDescription: string;
  timestamp: string;
  testCount: number;
  avgFairness: number;
  avgCompliance: number;
  avgAccuracy: number;
  riskLevel: 'Low' | 'Medium' | 'High';
}

export interface DashboardSnapshot {
  stats: DashboardStats;
  history: AuditHistoryEntry[];
  healthSignals: HealthSignal[];
}

export interface RegulationUploadSummary {
  uploadedCount: number;
  indexedArtifacts: number;
  sourceNames: string[];
  indexedAt: string;
  uploadedEntries?: RegulationLibraryEntry[];
}

export interface RegulationLibraryEntry {
  id: string;
  fileName: string;
  uploadedAt: string;
  status: string;
  active: boolean;
  sourceKey: string | null;
  fileUrl: string | null;
  downloadUrl: string;
}

export interface AuditConfiguration {
  modelDescription: string;
  varianceFactors: string[];
  testCount: number;
  connectionType: ConnectionType;
  apiMode: ApiMode;
  apiUrl: string | null;
  apiKey: string | null;
  modelName: string | null;
  localModelName: string | null;
}

export interface UploadedModelBundle {
  modelId: string;
  fileName: string;
  status: string;
  message: string;
  modelAuditId: number | null;
  modelZipUrl: string | null;
  detectedArtifacts: unknown;
  modelMetadata: unknown;
  modelInspection: unknown;
}

export interface AuditProgress {
  status: 'idle' | 'running' | 'completed' | 'failed' | string;
  stage: string;
  progress: number;
  message: string;
  updatedAt: string | null;
  lastError: string | null;
}

export interface AuditPreflight {
  pythonReachable: boolean;
  targetEndpointReachable: boolean;
  targetStatusCode: number | null;
  targetStatus: string;
  message: string;
  checkedAt: string | null;
}

export interface AuditResultItem {
  id: string;
  prompt: string;
  riskArea: string;
  expectedBehavior: string;
  actualResponse: string;
  fairness: number;
  compliance: number;
  accuracy: number;
  reasoning: string;
}

export interface StatisticalRuleResult {
  metricName: string;
  operator: string;
  thresholdMin: number | null;
  thresholdMax: number | null;
  actualValue: number | null;
  status: string;
  severity: string;
}

export interface HybridValidationSummary {
  overallStatus: string;
  fairnessMetrics: Record<string, unknown>;
  fairnessMatrices: Record<string, unknown>;
  ruleResults: StatisticalRuleResult[];
}

export interface DeterministicDatasetSummary {
  rowCount: number;
  totalRowsEvaluated: number;
  previewRowLimit: number;
  previewRowCount: number;
  sourceMode: string;
  truncated: boolean;
  rows: Record<string, unknown>[];
}

export interface AuditReportSummary {
  modelDescription: string;
  varianceFactors: string[];
  testCount: number;
  avgFairness: number;
  avgCompliance: number;
  avgAccuracy: number;
  timestamp: string;
}

export interface AuditReport {
  id: string;
  status: 'Completed';
  policyViolations: number;
  summary: AuditReportSummary;
  results: AuditResultItem[];
}

export interface CurrentAuditResponse {
  auditId: string;
  modelUsed: string;
  status: string;
  score: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  findings: string[];
  timestamp: string;
  responseLabel: string;
  policyViolations: number;
  llmModelName: string | null;
  summary: {
    avgFairness: number;
    avgCompliance: number;
    avgAccuracy: number;
    testCount: number;
    varianceFactors: string[];
  };
  results: AuditResultItem[];
  warnings: string[];
  hybridValidation: HybridValidationSummary | null;
  deterministicDataset: DeterministicDatasetSummary | null;
  statisticalGovernance: unknown;
  metricGlossary: unknown;
}

export interface SavedAuditReport {
  id: string;
  modelDescription: string;
  fairnessScore: number;
  complianceScore: number;
  accuracyScore: number;
  createdAt: string;
}

export interface GovernancePolicy {
  id: string;
  name: string;
  owner: string;
  minFairness: number;
  minCompliance: number;
  minAccuracy: number;
}

export interface AdminOverview {
  users: AppUser[];
  policies: GovernancePolicy[];
}
