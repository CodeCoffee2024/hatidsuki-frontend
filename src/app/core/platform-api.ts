import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminWorkspace } from './models';
import { PlatformAuthService } from './platform-auth.service';

/** Every call here attaches the platform-admin token itself — it deliberately does not go through authInterceptor. */
@Injectable({ providedIn: 'root' })
export class PlatformApi {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(PlatformAuthService);

  private headers() { return { Authorization: `Bearer ${this.auth.accessToken() ?? ''}` }; }

  workspaces() {
    return firstValueFrom(this.http.get<AdminWorkspace[]>('/api/platform/workspaces', { headers: this.headers() }));
  }
  suspend(id: string, reason: string | null) {
    return firstValueFrom(this.http.post<void>(`/api/platform/workspaces/${id}/suspend`, { reason }, { headers: this.headers() }));
  }
  reactivate(id: string) {
    return firstValueFrom(this.http.post<void>(`/api/platform/workspaces/${id}/reactivate`, {}, { headers: this.headers() }));
  }
  delete(id: string) {
    return firstValueFrom(this.http.delete<void>(`/api/platform/workspaces/${id}`, { headers: this.headers() }));
  }
}
