import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

const STORAGE_KEY = 'hs_platform_token';

/**
 * The platform operator's own login — entirely separate from AuthService (which holds a signed-in business's session).
 * Kept out of that service on purpose: the two token types must never be able to leak into each other's requests.
 * There is no refresh token here; the token is short-lived (an hour) and the operator just signs in again after that.
 */
@Injectable({ providedIn: 'root' })
export class PlatformAuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private token: string | null = null;
  readonly isSignedIn = signal(false);

  constructor() {
    // Session-only (not localStorage): survives a reload in this tab, gone once the tab closes.
    try { this.token = sessionStorage.getItem(STORAGE_KEY); } catch { /* storage can be blocked */ }
    this.isSignedIn.set(!!this.token);
  }

  accessToken(): string | null { return this.token; }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(this.http.post<{ accessToken: string }>('/api/platform/auth/login', { email, password }));
    this.token = res.accessToken;
    try { sessionStorage.setItem(STORAGE_KEY, res.accessToken); } catch { /* optional */ }
    this.isSignedIn.set(true);
  }

  async logout(): Promise<void> {
    this.token = null;
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* optional */ }
    this.isSignedIn.set(false);
    await this.router.navigate(['/platform/login']);
  }
}
