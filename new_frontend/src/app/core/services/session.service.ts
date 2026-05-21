import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AppUser,
  LoginCredentials,
  RegistrationRequest
} from '../models/governance.models';
import { AuthApiService } from './auth-api.service';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private readonly authApi = inject(AuthApiService);
  private readonly storageKey = 'ai-governance-console-user';
  private readonly tokenKey = 'ai-governance-console-token';

  readonly currentUser = signal<AppUser | null>(this.readStoredUser());
  readonly authToken = signal<string | null>(this.readStoredToken());
  readonly authPending = signal(false);
  readonly authError = signal<string | null>(null);
  readonly isAuthenticated = computed(
    () => this.currentUser() !== null && this.authToken() !== null
  );

  constructor() {
    const user = this.currentUser();
    const token = this.authToken();

    if ((user && !token) || (!user && token)) {
      this.currentUser.set(null);
      this.authToken.set(null);
      this.clearStoredUser();
      this.clearStoredToken();
    }
  }

  async signIn(credentials: LoginCredentials): Promise<AppUser> {
    this.authPending.set(true);
    this.authError.set(null);

    try {
      const response = await firstValueFrom(this.authApi.login(credentials));
      this.currentUser.set(response.user);
      this.authToken.set(response.accessToken);
      this.writeStoredUser(response.user);
      this.writeStoredToken(response.accessToken);
      return response.user;
    } catch (error) {
      this.authError.set(
        error instanceof Error ? error.message : 'Sign-in failed. Please retry.'
      );
      throw error;
    } finally {
      this.authPending.set(false);
    }
  }

  async signOut(): Promise<void> {
    try {
      await firstValueFrom(this.authApi.logout());
    } catch {
      // Local cleanup still needs to happen if backend logout fails.
    }

    this.currentUser.set(null);
    this.authToken.set(null);
    this.authError.set(null);
    this.clearStoredUser();
    this.clearStoredToken();
  }

  async register(request: RegistrationRequest): Promise<AppUser> {
    this.authPending.set(true);
    this.authError.set(null);

    try {
      const response = await firstValueFrom(this.authApi.register(request));
      this.currentUser.set(response.user);
      this.authToken.set(response.accessToken);
      this.writeStoredUser(response.user);
      this.writeStoredToken(response.accessToken);
      return response.user;
    } catch (error) {
      this.authError.set(
        error instanceof Error ? error.message : 'Registration failed. Please retry.'
      );
      throw error;
    } finally {
      this.authPending.set(false);
    }
  }

  private readStoredUser(): AppUser | null {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    const raw = sessionStorage.getItem(this.storageKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AppUser;
    } catch {
      this.clearStoredUser();
      return null;
    }
  }

  private writeStoredUser(user: AppUser): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    sessionStorage.setItem(this.storageKey, JSON.stringify(user));
  }

  private readStoredToken(): string | null {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    return sessionStorage.getItem(this.tokenKey);
  }

  private writeStoredToken(token: string): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    sessionStorage.setItem(this.tokenKey, token);
  }

  private clearStoredUser(): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    sessionStorage.removeItem(this.storageKey);
  }

  private clearStoredToken(): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    sessionStorage.removeItem(this.tokenKey);
  }
}
