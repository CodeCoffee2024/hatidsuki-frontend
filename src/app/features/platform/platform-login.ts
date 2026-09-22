import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { errorMessage } from '../../core/http';
import { PlatformAuthService } from '../../core/platform-auth.service';

/** The operator's own sign-in, deliberately plain and separate from any business's login page. */
@Component({
  selector: 'app-platform-login',
  imports: [ReactiveFormsModule],
  template: `
    <div class="wrap">
      <div class="card-lite panel">
        <h1>Platform admin</h1>
        <p class="text-muted">Operator access only. This is not a business login.</p>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (error()) { <div class="alert alert-danger py-2" role="alert">{{ error() }}</div> }
          <div class="mb-3">
            <label class="form-label" for="email">Email</label>
            <input id="email" class="form-control" type="email" formControlName="email" autocomplete="username">
          </div>
          <div class="mb-4">
            <label class="form-label" for="password">Password</label>
            <input id="password" class="form-control" type="password" formControlName="password" autocomplete="current-password">
          </div>
          <button class="btn btn-primary btn-lg w-100" type="submit" [disabled]="busy() || form.invalid">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
        </form>
      </div>
    </div>`,
  styles: `
    .wrap { min-height: 100vh; display: grid; place-items: center; background: var(--hs-bg); padding: 1.25rem; }
    .panel { width: min(100%, 380px); padding: 2rem 1.75rem; }
    h1 { font-size: 1.4rem; font-weight: 750; margin-bottom: .2rem; }
  `,
})
export class PlatformLoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(PlatformAuthService);
  private readonly router = inject(Router);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  async submit() {
    if (this.form.invalid) return;
    this.busy.set(true); this.error.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);
      await this.router.navigateByUrl('/platform');
    } catch (e) { this.error.set(errorMessage(e)); } finally { this.busy.set(false); }
  }
}
