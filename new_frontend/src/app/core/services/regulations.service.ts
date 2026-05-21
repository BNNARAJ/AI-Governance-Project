import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
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

    return this.http.get<RegulationLibraryEntry[]>(`${this.baseUrl}/api/regulations`).pipe(
      catchError((error) =>
        throwError(() => new Error(this.toErrorMessage(error, 'Unable to load regulations.')))
      )
    );
  }

  upload(files: readonly File[]): Observable<RegulationUploadSummary> {
    if (this.capabilities.mockMode()) {
      return this.mock.uploadRegulations(files);
    }

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file, file.name));
    return this.http
      .post<RegulationUploadSummary>(`${this.baseUrl}/api/regulations/upload`, formData)
      .pipe(
        catchError((error) =>
          throwError(() => new Error(this.toErrorMessage(error, 'Regulation upload failed.')))
        )
      );
  }

  removeFromActiveIndex(entryId: string): Observable<RegulationLibraryEntry> {
    return this.http
      .delete<RegulationLibraryEntry>(`${this.baseUrl}/api/regulations/${entryId}`)
      .pipe(
        catchError((error) =>
          throwError(() => new Error(this.toErrorMessage(error, 'Unable to remove regulation.')))
        )
      );
  }

  reuse(entryId: string): Observable<RegulationLibraryEntry> {
    return this.http
      .post<RegulationLibraryEntry>(`${this.baseUrl}/api/regulations/${entryId}/reuse`, {})
      .pipe(
        catchError((error) =>
          throwError(() => new Error(this.toErrorMessage(error, 'Unable to reuse regulation.')))
        )
      );
  }

  private toErrorMessage(error: any, fallback: string): string {
    const payload = error?.error;
    if (typeof payload === 'string' && payload.trim()) {
      return payload;
    }

    const details = payload?.details ?? payload?.detail;
    if (typeof details === 'string' && details.trim()) {
      return details;
    }

    const message = payload?.message ?? error?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
}
