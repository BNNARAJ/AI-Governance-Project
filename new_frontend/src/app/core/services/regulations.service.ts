import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  RegulationLibraryEntry,
  RegulationUploadSummary
} from '../models/governance.models';
import { BackendCapabilitiesService } from './backend-capabilities.service';
import { MockGovernanceDataSource } from '../data/mock-governance-data-source.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RegulationsService {
  private readonly capabilities = inject(BackendCapabilitiesService);
  private readonly http = inject(HttpClient);
  private readonly mock = inject(MockGovernanceDataSource);
  private readonly baseUrl = environment.backendBaseUrl.replace(/\/$/, '');

  list(): Observable<RegulationLibraryEntry[]> {
    if (this.capabilities.mockMode()) {
      return this.mock.getRegulations();
    }

    return this.http.get<RegulationLibraryEntry[]>(`${this.baseUrl}/api/regulations`);
  }

  upload(files: readonly File[]): Observable<RegulationUploadSummary> {
    if (this.capabilities.mockMode()) {
      return this.mock.uploadRegulations(files);
    }

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file, file.name));
    return this.http.post<RegulationUploadSummary>(
      `${this.baseUrl}/api/regulations/upload`,
      formData
    );
  }

  removeFromActiveIndex(entryId: string): Observable<RegulationLibraryEntry> {
    return this.http.delete<RegulationLibraryEntry>(
      `${this.baseUrl}/api/regulations/${entryId}`
    );
  }

  reuse(entryId: string): Observable<RegulationLibraryEntry> {
    return this.http.post<RegulationLibraryEntry>(
      `${this.baseUrl}/api/regulations/${entryId}/reuse`,
      {}
    );
  }
}
