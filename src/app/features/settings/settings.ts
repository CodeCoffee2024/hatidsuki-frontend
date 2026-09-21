import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CatalogApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/http';
import { ToastService } from '../../core/ui';

const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'MYR', 'IDR', 'THB', 'VND', 'INR', 'JPY', 'KRW', 'AED', 'SAR', 'NZD', 'HKD', 'CNY', 'BRL', 'MXN'];

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule],
  template: `
    <div class="page narrow">
      <div class="page-head"><div><h1>Settings</h1><p>Your business details.</p></div></div>
      <form class="card-lite p-3 p-md-4" [formGroup]="form" (ngSubmit)="save()" novalidate>
        @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }
        <div class="mb-3"><label class="form-label" for="n">Business name</label><input id="n" class="form-control" formControlName="name" maxlength="80" [class.is-invalid]="form.controls.name.invalid && form.controls.name.touched">
          <div class="form-text">Shown to customers at the top of your order page.</div></div>
        <div class="row g-3 mb-3">
          <div class="col-sm-4"><label class="form-label" for="c">Currency</label><select id="c" class="form-select" formControlName="currency">@for (c of currencies; track c) { <option [value]="c">{{ c }}</option> }</select></div>
          <div class="col-sm-8"><label class="form-label" for="z">Timezone</label><select id="z" class="form-select" formControlName="timezone">@for (z of zones; track z) { <option [value]="z">{{ z }}</option> }</select>
            <div class="form-text">Used for “today”, opening hours and your dashboard days.</div></div>
        </div>
        <div class="mb-4"><label class="form-label" for="p">Phone country code</label>
          <div class="input-group" style="max-width: 200px"><span class="input-group-text">+</span><input id="p" class="form-control" formControlName="phoneCountryCode" inputmode="numeric" maxlength="4" placeholder="63"></div>
          <div class="form-text">Turns a local number like 0917… into a working WhatsApp/SMS link when you tell customers their order is ready.</div></div>
        <button class="btn btn-primary" type="submit" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save changes' }}</button>
      </form>
    </div>`,
  styles: `.narrow { max-width: 720px; }`,
})
export class SettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CatalogApi);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly currencies = CURRENCIES;
  readonly zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? ['UTC'];
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: [this.auth.user()?.workspaceName ?? '', [Validators.required, Validators.maxLength(80)]],
    currency: [this.auth.user()?.currency ?? 'USD'],
    timezone: [this.auth.user()?.timezone ?? 'UTC'],
    phoneCountryCode: [this.auth.user()?.phoneCountryCode ?? ''],
  });

  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true); this.error.set(null);
    try {
      const v = this.form.getRawValue();
      this.auth.updateUser(await this.api.updateWorkspace({ ...v, phoneCountryCode: v.phoneCountryCode || null }));
      this.toast.show('Settings saved.');
    } catch (e) { this.error.set(errorMessage(e)); } finally { this.saving.set(false); }
  }
}
