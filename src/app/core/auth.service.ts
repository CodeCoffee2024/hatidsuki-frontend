import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Role, Session, User } from './models';

/**
 * Holds the signed-in user. The short-lived access token lives only in memory (never localStorage);
 * the long-lived refresh token is an httpOnly cookie the browser sends to /api/auth/refresh by itself.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private token: string | null = null;
  private refreshing: Promise<boolean> | null = null;

  readonly user = signal<User | null>(null);
  readonly isSignedIn = computed(() => this.user() !== null);
  readonly canSeeMoney = computed(() => this.user()?.role === 'Owner' || this.user()?.role === 'Manager');
  readonly currency = computed(() => this.user()?.currency ?? 'USD');

  accessToken(): string | null { return this.token; }
  hasRole(...roles: Role[]): boolean { const r = this.user()?.role; return !!r && roles.includes(r); }

  /** On page load: try to resume the session from the refresh cookie. Never throws. */
  async init(): Promise<void> { await this.refresh(); }

  async login(email: string, password: string): Promise<void> {
    this.apply(await firstValueFrom(this.http.post<Session>('/api/auth/login', { email, password })));
  }

  async register(body: {
    businessName: string; slug: string; name: string; email: string; password: string; currency: string; timezone: string;
  }): Promise<void> {
    this.apply(await firstValueFrom(this.http.post<Session>('/api/auth/register', body)));
  }

  async logout(): Promise<void> {
    try { await firstValueFrom(this.http.post('/api/auth/logout', {})); } catch { /* signing out locally anyway */ }
    this.clear();
    await this.router.navigate(['/login']);
  }

  /** Concurrent callers share one refresh (the refresh token is single-use). */
  refresh(): Promise<boolean> {
    this.refreshing ??= (async () => {
      try {
        this.apply(await firstValueFrom(this.http.post<Session>('/api/auth/refresh', {})));
        return true;
      } catch {
        this.clear();
        return false;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  updateUser(user: User) { this.user.set(user); }
  clear() { this.token = null; this.user.set(null); }

  private apply(s: Session) { this.token = s.accessToken; this.user.set(s.user); }
}
