export const environment = {
  production: false,
  backendBaseUrl: 'http://localhost:5079',
  frontendMode: 'integration',
  useMockFallback: false,
  backendCapabilities: {
    auth: true,
    dashboard: true,
    regulationUpload: true,
    auditConfigurationSave: false,
    auditRun: true,
    auditHistory: true,
    reportDownload: true,
    admin: true
  }
};
