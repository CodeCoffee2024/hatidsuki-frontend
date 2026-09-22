import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { Role } from './models';
import { PlatformAuthService } from './platform-auth.service';

const isAuthCall = (url: string) => url.includes('/api/auth/login') || url.includes('/api/auth/register') || url.includes('/api/auth/refresh');
// Platform-admin calls carry their own bearer token (see PlatformApi) and must never receive the tenant's token instead.
const needsToken = (url: string) => url.startsWith('/api/') && !url.startsWith('/api/public/') && !url.startsWith('/api/platform/') && !isAuthCall(url);

/** Adds the bearer token, and on a 401 silently refreshes once and retries the request. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const withToken = (token: string | null) =>
    token && needsToken(req.url) ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(withToken(auth.accessToken())).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && needsToken(req.url)) {
        return from(auth.refresh()).pipe(
          switchMap(ok => {
            if (ok) return next(withToken(auth.accessToken()));
            void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
            return throwError(() => err);
          }));
      }
      return throwError(() => err);
    }));
};

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.isSignedIn() || inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const roleGuard = (...roles: Role[]): CanActivateFn => () =>
  inject(AuthService).hasRole(...roles) || inject(Router).createUrlTree(['/app/board']);

export const guestGuard: CanActivateFn = () =>
  !inject(AuthService).isSignedIn() || inject(Router).createUrlTree(['/app/board']);

export const platformAuthGuard: CanActivateFn = () =>
  inject(PlatformAuthService).isSignedIn() || inject(Router).createUrlTree(['/platform/login']);

/** Turns any API failure into a sentence a person can act on. */
export function errorMessage(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'Can’t reach the server. Check your connection and try again.';
    if (e.status === 429) return 'Too many requests. Please wait a moment and try again.';
    const body = e.error as { title?: string; errors?: Record<string, string[]> } | null;
    const first = body?.errors && Object.values(body.errors).flat()[0];
    return first ?? body?.title ?? 'Something went wrong. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

/** Field-level errors from a 400 response, keyed by field name. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof HttpErrorResponse)) return {};
  const errors = (e.error as { errors?: Record<string, string[]> } | null)?.errors ?? {};
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v[0]]));
}
