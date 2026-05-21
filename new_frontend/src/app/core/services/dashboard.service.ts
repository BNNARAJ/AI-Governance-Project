import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DashboardSnapshot } from '../models/governance.models';
import { BackendCapabilitiesService } from './backend-capabilities.service';
import { MockGovernanceDataSource } from '../data/mock-governance-data-source.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly capabilities = inject(BackendCapabilitiesService);
  private readonly http = inject(HttpClient);
  private readonly mock = inject(MockGovernanceDataSource);
  private readonly baseUrl = environment.backendBaseUrl.replace(/\/$/, '');

  loadDashboard(): Observable<DashboardSnapshot> {
    if (this.capabilities.mockMode()) {
      return this.mock.getDashboard();
    }

    return this.http.get<DashboardSnapshot>(`${this.baseUrl}/api/dashboard/snapshot`);
  }
}
