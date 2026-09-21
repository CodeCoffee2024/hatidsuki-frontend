import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage, fieldErrors } from '../../core/http';
import { AuthLayoutComponent } from './auth-layout';

const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'MYR', 'IDR', 'THB', 'VND', 'INR', 'JPY', 'KRW', 'AED', 'SAR', 'NZD', 'HKD', 'CNY', 'BRL', 'MXN'];
const CURRENCY_BY_ZONE: Record<string, string> = {
  'Asia/Manila': 'PHP', 'Asia/Singapore': 'SGD', 'Asia/Kuala_Lumpur': 'MYR', 'Asia/Jakarta': 'IDR', 'Asia/Bangkok': 'THB',
  'Asia/Ho_Chi_Minh': 'VND', 'Asia/Kolkata': 'INR', 'Asia/Tokyo': 'JPY', 'Asia/Seoul': 'KRW', 'Asia/Dubai': 'AED',
  'Australia/Sydney': 'AUD', 'Pacific/Auckland': 'NZD', 'Europe/London': 'GBP', 'Europe/Berlin': 'EUR', 'Europe/Paris': 'EUR',
  'America/Toronto': 'CAD', 'America/Sao_Paulo': 'BRL', 'America/Mexico_City': 'MXN',
};
const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, AuthLayoutComponent],
  template: `
    <app-auth-layout>
      <h2 class="h3 fw-bold mb-1">Create your business</h2>
      <p class="text-muted mb-4">Free to set up. Your first order form takes minutes.</p>

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error()) { <div class="alert alert-danger py-2" role="alert">{{ error() }}</div> }

        <div class="mb-3">
          <label class="form-label" for="businessName">Business name</label>
          <input id="businessName" class="form-control" formControlName="businessName" autocomplete="organization" [class.is-invalid]="bad('businessName')">
          @if (bad('businessName')) { <div class="field-error">{{ server()['businessName'] || 'Enter your business name.' }}</div> }
        </div>
        <div class="mb-3">
          <label class="form-label" for="slug">Your web name</label>
          <input id="slug" class="form-control" formControlName="slug" (input)="slugTouched = true" [class.is-invalid]="bad('slug')" spellcheck="false">
          <div class="form-text">Letters, digits and hyphens only, for example <code>{{ form.controls.slug.value || 'sunrise-bakery' }}</code></div>
          @if (bad('slug')) { <div class="field-error">{{ server()['slug'] || 'Use 3–40 lowercase letters, digits or hyphens.' }}</div> }
        </div>
        <div class="mb-3">
          <label class="form-label" for="name">Your name</label>
          <input id="name" class="form-control" formControlName="name" autocomplete="name" [class.is-invalid]="bad('name')">
          @if (bad('name')) { <div class="field-error">Enter your name.</div> }
        </div>
        <div class="mb-3">
          <label class="form-label" for="email">Email</label>
          <input id="email" class="form-control" type="email" formControlName="email" autocomplete="username" [class.is-invalid]="bad('email')">
          @if (bad('email')) { <div class="field-error">{{ server()['email'] || 'Enter a valid email address.' }}</div> }
        </div>
        <div class="mb-3">
          <label class="form-label" for="password">Password</label>
          <input id="password" class="form-control" type="password" formControlName="password" autocomplete="new-password" [class.is-invalid]="bad('password')">
          <div class="form-text">At least 10 characters.</div>
          @if (bad('password')) { <div class="field-error">Use at least 10 characters.</div> }
        </div>
        <div class="row g-2 mb-4">
          <div class="col-5">
            <label class="form-label" for="currency">Currency</label>
            <select id="currency" class="form-select" formControlName="currency">
              @for (c of currencies; track c) { <option [value]="c">{{ c }}</option> }
            </select>
          </div>
          <div class="col-7">
            <label class="form-label" for="timezone">Timezone</label>
            <select id="timezone" class="form-select" formControlName="timezone">
              @for (z of zones; track z) { <option [value]="z">{{ z }}</option> }
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-lg w-100" type="submit" [disabled]="busy()">{{ busy() ? 'Creating…' : 'Create business' }}</button>
      </form>
      <p class="mt-4 mb-0 text-muted">Already have an account? <a routerLink="/login">Sign in</a></p>
    </app-auth-layout>`,
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly currencies = CURRENCIES;
  readonly zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? ['UTC'];
  private readonly detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly server = signal<Record<string, string>>({});
  slugTouched = false;

  readonly form = this.fb.nonNullable.group({
    businessName: ['', [Validators.required, Validators.maxLength(80)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/)]],
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(10)]],
    currency: [CURRENCY_BY_ZONE[this.detectedZone] ?? 'USD'],
    timezone: [this.detectedZone],
  });
  private readonly businessName = toSignal(this.form.controls.businessName.valueChanges, { initialValue: '' });

  constructor() {
    // The web name follows the business name until the person edits it themselves.
    effect(() => { if (!this.slugTouched) this.form.controls.slug.setValue(slugify(this.businessName()), { emitEvent: false }); });
  }

  bad(name: keyof typeof this.form.controls) {
    const c = this.form.controls[name];
    return (c.invalid && (c.touched || c.dirty)) || !!this.server()[name];
  }

  async submit() {
    this.form.markAllAsTouched();
    this.server.set({}); this.error.set(null);
    if (this.form.invalid) return;
    this.busy.set(true);
    try {
      await this.auth.register(this.form.getRawValue());
      await this.router.navigateByUrl('/app/board');
    } catch (e) {
      this.server.set(fieldErrors(e));
      this.error.set(Object.keys(fieldErrors(e)).length ? null : errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
