import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/http';
import { AuthLayoutComponent } from './auth-layout';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, AuthLayoutComponent],
  template: `
    <app-auth-layout>
      <h2 class="h3 fw-bold mb-1">Welcome back</h2>
      <p class="text-muted mb-4">Sign in to your business.</p>

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error()) { <div class="alert alert-danger py-2" role="alert">{{ error() }}</div> }
        <div class="mb-3">
          <label class="form-label" for="email">Email</label>
          <input id="email" class="form-control" type="email" autocomplete="username" formControlName="email" [class.is-invalid]="showError('email')">
          @if (showError('email')) { <div class="field-error">Enter your email address.</div> }
        </div>
        <div class="mb-4">
          <label class="form-label" for="password">Password</label>
          <input id="password" class="form-control" type="password" autocomplete="current-password" formControlName="password" [class.is-invalid]="showError('password')">
          @if (showError('password')) { <div class="field-error">Enter your password.</div> }
        </div>
        <button class="btn btn-primary btn-lg w-100" type="submit" [disabled]="busy()">
          {{ busy() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <p class="mt-4 mb-0 text-muted">New here? <a routerLink="/register">Create your business</a></p>

      <div class="demo mt-4">
        <strong>Try the demo bakery</strong>
        <span>demo&#64;hatidsuki.local · HatidSuki1!</span>
        <button type="button" class="btn btn-ghost btn-sm" (click)="fillDemo()">Fill it in</button>
      </div>
    </app-auth-layout>`,
  styles: `
    .demo { display: flex; align-items: center; flex-wrap: wrap; gap: .4rem .8rem; padding: .8rem 1rem; border: 1px dashed #cfc6b6; border-radius: 12px; font-size: .9rem; }
    .demo span { color: var(--hs-muted); flex: 1; }
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  showError(name: 'email' | 'password') { const c = this.form.controls[name]; return c.invalid && (c.touched || c.dirty); }
  fillDemo() { this.form.setValue({ email: 'demo@hatidsuki.local', password: 'HatidSuki1!' }); }

  async submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true); this.error.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      await this.router.navigateByUrl(returnUrl && returnUrl.startsWith('/') ? returnUrl : '/app/board');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
