import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppUser, LoginCredentials, RegistrationRequest } from '../models/governance.models';

interface AuthApiResponse {
  accessToken: string;
  user: AppUser;
}

@Injectable({
  providedIn: 'root'
})
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.backendBaseUrl.replace(/\/$/, '');

  login(credentials: LoginCredentials): Observable<AuthApiResponse> {
    return this.http
      .post<AuthApiResponse>(`${this.baseUrl}/api/auth/login`, credentials)
      .pipe(catchError((error) => this.toUserMessage(error, 'Sign-in failed.')));
  }

  register(request: RegistrationRequest): Observable<AuthApiResponse> {
    return this.http
      .post<AuthApiResponse>(`${this.baseUrl}/api/auth/register`, request)
      .pipe(catchError((error) => this.toUserMessage(error, 'Registration failed.')));
  }

  me(): Observable<AppUser> {
    return this.http.get<AppUser>(`${this.baseUrl}/api/auth/me`);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/api/auth/logout`, {});
  }

  private toUserMessage(error: unknown, fallback: string): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      const message =
        typeof error.error?.message === 'string' && error.error.message.trim().length > 0
          ? error.error.message
          : fallback;

      return throwError(() => new Error(message));
    }

    return throwError(() => new Error(fallback));
  }
}
