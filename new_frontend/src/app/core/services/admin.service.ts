import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { MockGovernanceDataSource } from '../data/mock-governance-data-source.service';
import { AdminOverview } from '../models/governance.models';
import { BackendCapabilitiesService } from './backend-capabilities.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly capabilities = inject(BackendCapabilitiesService);
  private readonly http = inject(HttpClient);
  private readonly mock = inject(MockGovernanceDataSource);
  private readonly baseUrl = environment.backendBaseUrl.replace(/\/$/, '');

  loadOverview(): Observable<AdminOverview> {
    if (this.capabilities.mockMode()) {
      return this.mock.getAdminOverview();
    }

    return forkJoin({
      users: this.http.get<AdminOverview['users']>(`${this.baseUrl}/api/admin/users`),
      policies: this.http.get<AdminOverview['policies']>(`${this.baseUrl}/api/admin/policies`)
    }).pipe(map((response) => response));
  }
}
