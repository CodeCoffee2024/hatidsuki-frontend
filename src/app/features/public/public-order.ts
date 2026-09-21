import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PublicApi } from '../../core/api';
import { errorMessage } from '../../core/http';
import { FormField, PlacedOrder, PublicForm } from '../../core/models';
import { MoneyPipe } from '../../core/ui';
import { LocationPickerComponent } from '../../shared/location-picker';
import { OrderPickerComponent, PickerState } from '../../shared/order-picker';

const REMEMBER_KEY = 'hs_customer';

/**
 * What a customer sees after scanning a QR code. Built for a phone in one hand: big tap targets, no account, the total
 * always in view. In a group order each person is added separately so the business sees every one of them.
 */
@Component({
  selector: 'app-public-order',
  imports: [FormsModule, OrderPickerComponent, LocationPickerComponent, MoneyPipe, RouterLink],
  template: `
    <div class="wrap">
      @if (loading()) {
        <div class="skeleton" style="height: 90px; margin-bottom: 1rem"></div><div class="skeleton" style="height: 320px"></div>
      } @else if (notFound()) {
        <div class="state"><i class="bi bi-emoji-frown"></i><h1>This order page isn’t available</h1><p>The link may be old, or the business hasn’t published it yet. Please ask them for a fresh QR code.</p></div>
      } @else if (loadError()) {
        <div class="state"><i class="bi bi-wifi-off"></i><h1>We couldn’t load the page</h1><p>{{ loadError() }}</p><button class="btn btn-primary" (click)="load()">Try again</button></div>
      } @else if (placed(); as p) {
        <div class="state done" role="status">
          
          <h1>Order #{{ p.number }} received</h1>
          <p class="lead">{{ p.thankYou || 'Thanks. We’ve got your order.' }}</p>
          @if (p.deliveryTo) { <p class="deliver">Delivering to <strong>{{ p.deliveryTo }}</strong>.</p> }
          <div class="receipt card-lite">
            <div><span class="text-muted">People</span><strong class="num">{{ p.people }}</strong></div>
            <div><span class="text-muted">Total</span><strong class="money">{{ p.total | money: p.currency }}</strong></div>
          </div>
          @if (p.paymentMessage) { <p class="pay"><i class="bi bi-cash-coin"></i> {{ p.paymentMessage }}</p> }
          <a class="btn btn-primary btn-lg" [routerLink]="['/t', p.trackingToken]"><i class="bi bi-geo-alt"></i> Track my order</a>
          <button type="button" class="btn btn-link mt-2" (click)="again()">Place another order</button>
        </div>
      } @else if (form(); as f) {
        <header class="hero">
          <div class="biz">{{ f.businessName }}</div>
          @if (f.definition?.intro) { <p>{{ f.definition!.intro }}</p> }
          @if (f.sourceName) { <span class="chip chip-muted"><i class="bi bi-geo-alt"></i> {{ f.sourceName }}</span> }
        </header>

        @if (f.state === 'closed') {
          <div class="state"><i class="bi bi-moon-stars"></i><h2>Orders are paused</h2><p>{{ f.closedMessage }}</p></div>
        } @else {
          <form (ngSubmit)="submit()" novalidate>
            @for (fld of f.definition!.fields; track fld.id) {
              <div class="field" [class.has-error]="!!errors()[fld.id]">
                @switch (fld.type) {
                  @case ('heading') { <h2 class="fh">{{ fld.label }}</h2>@if (fld.helpText) { <p class="text-muted">{{ fld.helpText }}</p> } }
                  @case ('orderItems') {
                    <div class="loc"><app-location-picker [locations]="f.locations" [(value)]="locationId" [(note)]="locationNote" [error]="locationError()" /></div>
                    <h2 class="fh">{{ fld.label }}</h2>
                    @if (fld.helpText) { <p class="text-muted">{{ fld.helpText }}</p> }
                    @if (fld.orderItems?.allowGroupOrders) { <p class="text-muted small">Ordering for others too? Tap <strong>Add person</strong>. Each person’s order is kept separate.</p> }
                    <app-order-picker [items]="f.items" [currency]="f.currency" [allowGroup]="!!fld.orderItems?.allowGroupOrders" [maxParts]="fld.orderItems?.maxParts ?? 30"
                                      [firstName]="customerName()" (changed)="picker.set($event)" />
                    @if (itemsError()) { <div class="field-error" role="alert">{{ itemsError() }}</div> }
                  }
                  @case ('consent') {
                    <label class="form-check"><input class="form-check-input" type="checkbox" [checked]="single(fld) === 'true'" (change)="setSingle(fld, $any($event.target).checked ? 'true' : '')"> <span class="form-check-label">{{ fld.label }}@if (fld.required) { <span class="req"> *</span> }</span></label>
                  }
                  @default {
                    <label class="form-label" [for]="'f' + fld.id">{{ fld.label }}@if (fld.required) { <span class="req" aria-hidden="true"> *</span> }</label>
                    @if (fld.helpText) { <div class="form-text mt-0 mb-1">{{ fld.helpText }}</div> }
                    @switch (fld.type) {
                      @case ('paragraph') { <textarea [id]="'f' + fld.id" class="form-control" rows="3" maxlength="2000" [ngModel]="single(fld)" (ngModelChange)="setSingle(fld, $event)" [name]="fld.id" [class.is-invalid]="!!errors()[fld.id]"></textarea> }
                      @case ('dropdown') {
                        <select [id]="'f' + fld.id" class="form-select" [ngModel]="single(fld)" (ngModelChange)="setSingle(fld, $event)" [name]="fld.id" [class.is-invalid]="!!errors()[fld.id]">
                          <option value="">Choose…</option>@for (o of fld.options; track o) { <option [value]="o">{{ o }}</option> }
                        </select>
                      }
                      @case ('singleChoice') {
                        <div class="choices" role="radiogroup" [attr.aria-label]="fld.label">
                          @for (o of fld.options; track o) { <button type="button" role="radio" class="choice" [class.on]="single(fld) === o" [attr.aria-checked]="single(fld) === o" (click)="setSingle(fld, o)">{{ o }}</button> }
                        </div>
                      }
                      @case ('multiChoice') {
                        <div class="choices">
                          @for (o of fld.options; track o) { <button type="button" class="choice" [class.on]="multi(fld).includes(o)" [attr.aria-pressed]="multi(fld).includes(o)" (click)="toggleMulti(fld, o)">{{ o }}</button> }
                        </div>
                      }
                      @default {
                        <input [id]="'f' + fld.id" class="form-control" [name]="fld.id" [class.is-invalid]="!!errors()[fld.id]"
                               [type]="inputType(fld)" [attr.inputmode]="fld.type === 'phone' ? 'tel' : fld.type === 'number' ? 'decimal' : null"
                               [attr.autocomplete]="autocomplete(fld)" maxlength="500" [ngModel]="single(fld)" (ngModelChange)="setSingle(fld, $event)">
                      }
                    }
                  }
                }
                @if (errors()[fld.id]) { <div class="field-error" role="alert">{{ errors()[fld.id] }}</div> }
              </div>
            }

            @if (!hasItemsField()) { <div class="loc"><app-location-picker [locations]="f.locations" [(value)]="locationId" [(note)]="locationNote" [error]="locationError()" /></div> }
            @if (generalError()) { <div class="alert alert-danger" role="alert">{{ generalError() }}</div> }
            @if (f.definition!.paymentMessage) { <p class="pay-note"><i class="bi bi-cash-coin"></i> {{ f.definition!.paymentMessage }}</p> }
            <div class="spacer"></div>
            <div class="bar">
              <div class="sum">
                <span class="text-muted">{{ picker().itemCount }} item{{ picker().itemCount === 1 ? '' : 's' }}@if (picker().people > 1) { · {{ picker().people }} people }</span>
                <strong class="money">{{ picker().total | money: f.currency }}</strong>
              </div>
              <button type="submit" class="btn btn-primary btn-lg" [disabled]="busy()">{{ busy() ? 'Sending…' : 'Place order' }}</button>
            </div>
          </form>
        }
        <footer class="foot">Powered by Hatid Suki</footer>
      }
    </div>`,
  styles: `
    :host { display: block; min-height: 100vh; background: var(--hs-bg); }
    .wrap { max-width: 640px; margin: 0 auto; padding: 1.25rem 1rem 2rem; }
    .hero { padding: .5rem 0 1rem; }
    .biz { font-size: 1.7rem; font-weight: 800; letter-spacing: -.02em; }
    .hero p { color: var(--hs-muted); margin: .3rem 0 .6rem; font-size: 1.05rem; }
    .field { margin-bottom: 1.25rem; }
    .fh { font-size: 1.15rem; font-weight: 750; margin: 1.4rem 0 .5rem; }
    .form-label { font-weight: 650; margin-bottom: .25rem; } .req { color: var(--hs-attn); }
    .form-control, .form-select { padding: .75rem .9rem; font-size: 1rem; }
    .choices { display: flex; flex-wrap: wrap; gap: .5rem; }
    .choice { padding: .6rem 1rem; border-radius: 999px; border: 1px solid #d3cabb; background: #fff; font-weight: 600; min-height: 44px; }
    .choice.on { background: var(--hs-ink); border-color: var(--hs-ink); color: #fff; }
    .has-error .form-control, .has-error .form-select { border-color: var(--hs-cancel); }
    .pay-note { color: var(--hs-muted); display: flex; gap: .5rem; align-items: center; }
    .spacer { height: 88px; }
    .bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; background: var(--hs-surface); border-top: 1px solid var(--hs-line);
      padding: .75rem 1rem calc(.75rem + env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 1rem; justify-content: center; }
    .bar .sum { display: flex; flex-direction: column; line-height: 1.15; margin-right: auto; max-width: 640px; } .bar .sum strong { font-size: 1.3rem; }
    @media (min-width: 700px) { .bar { padding-left: calc((100vw - 640px) / 2 + 1rem); padding-right: calc((100vw - 640px) / 2 + 1rem); } }
    .state { padding: 2.5rem 0; } .state > .bi { display: none; } .loc { margin-bottom: 1.75rem; } .deliver { margin: 0 0 .5rem; }
    .state h1, .state h2 { font-size: 1.5rem; font-weight: 800; }
    .state.done .tick { width: 76px; height: 76px; border-radius: 50%; background: #22a35a; color: #fff; display: inline-grid; place-items: center; font-size: 2.6rem; margin-bottom: .8rem; }
    .lead { font-size: 1.1rem; color: #4b443b; }
    .receipt { display: flex; gap: 2.5rem; padding: 1rem 1.25rem; margin: 1.2rem 0; max-width: 340px; }
    .receipt div { display: flex; flex-direction: column; } .receipt strong { font-size: 1.4rem; }
    .pay { color: var(--hs-muted); }
    .foot { text-align: center; color: var(--hs-muted); font-size: .8rem; margin-top: 2rem; }
  `,
})
export class PublicOrderComponent implements OnInit {
  readonly code = input.required<string>();
  /** The QR source, from ?s=… (for example "Table 3"). */
  readonly s = input<string>();

  private readonly api = inject(PublicApi);

  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly form = signal<PublicForm | null>(null);
  readonly placed = signal<PlacedOrder | null>(null);
  readonly busy = signal(false);
  readonly errors = signal<Record<string, string>>({});
  readonly itemsError = signal<string | null>(null);
  readonly generalError = signal<string | null>(null);
  readonly picker = signal<PickerState>({ parts: [], total: 0, people: 0, itemCount: 0 });
  readonly locationId = signal<string | null>(null);
  readonly locationNote = signal('');
  readonly locationError = signal<string | null>(null);
  readonly hasItemsField = computed(() => !!this.form()?.definition?.fields.some(x => x.type === 'orderItems'));
  private readonly answers = signal<Record<string, string[]>>({});
  private idempotencyKey = crypto.randomUUID();

  readonly customerName = computed(() => {
    const f = this.form()?.definition?.fields.find(x => x.role === 'customerName');
    return f ? (this.answers()[f.id]?.[0] ?? '') : '';
  });

  ngOnInit() { void this.load(); }

  async load() {
    this.loading.set(true); this.notFound.set(false); this.loadError.set(null);
    try {
      const f = await this.api.form(this.code(), this.s());
      this.form.set(f);
      this.remember(f, 'restore');
      this.restoreLocation(f);
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404) this.notFound.set(true); else this.loadError.set(errorMessage(e));
    } finally { this.loading.set(false); }
  }

  // ---- answers ----
  single(f: FormField) { return this.answers()[f.id]?.[0] ?? ''; }
  multi(f: FormField) { return this.answers()[f.id] ?? []; }
  setSingle(f: FormField, v: string) { this.answers.update(a => ({ ...a, [f.id]: v ? [v] : [] })); this.clearError(f.id); }
  toggleMulti(f: FormField, v: string) {
    const cur = this.multi(f);
    this.answers.update(a => ({ ...a, [f.id]: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] }));
    this.clearError(f.id);
  }
  inputType(f: FormField) { return ({ email: 'email', phone: 'tel', number: 'number', date: 'date', time: 'time' } as Record<string, string>)[f.type] ?? 'text'; }
  autocomplete(f: FormField) { return ({ customerName: 'name', customerPhone: 'tel', customerEmail: 'email', address: 'street-address' } as Record<string, string>)[f.role ?? ''] ?? 'off'; }
  private clearError(id: string) { if (this.errors()[id]) this.errors.update(e => { const { [id]: _, ...rest } = e; return rest; }); }

  // ---- submit ----
  private validate(): boolean {
    const f = this.form()!; const errs: Record<string, string> = {}; let itemsError: string | null = null;
    for (const fld of f.definition!.fields) {
      if (fld.type === 'heading') continue;
      if (fld.type === 'orderItems') { if (this.picker().itemCount === 0) itemsError = 'Add at least one item to your order.'; continue; }
      const v = this.answers()[fld.id] ?? [];
      if (fld.required && (v.length === 0 || (fld.type === 'consent' && v[0] !== 'true'))) errs[fld.id] = fld.type === 'consent' ? `Please tick “${fld.label}”.` : `${fld.label} is required.`;
    }
    const groupNames = this.picker().parts.length > 1 && this.picker().parts.some(p => !p.person);
    if (groupNames) itemsError = 'Give each person a name so the business knows whose order is whose.';
    const noLocation = !this.locationId();
    this.locationError.set(noLocation ? 'Choose where we should deliver your order.' : null);
    this.errors.set(errs); this.itemsError.set(itemsError);
    return Object.keys(errs).length === 0 && !itemsError && !noLocation;
  }

  async submit() {
    this.generalError.set(null);
    if (!this.validate()) {
      setTimeout(() => document.querySelector('.has-error, .field-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return;
    }
    this.busy.set(true);
    try {
      const f = this.form()!;
      const placed = await this.api.placeOrder({
        formCode: f.code, sourceCode: this.s() ?? null, idempotencyKey: this.idempotencyKey,
        answers: this.answers(), parts: this.picker().parts,
        deliveryLocationId: this.locationId(), deliveryNote: this.locationNote().trim() || null,
      });
      this.remember(f, 'save');
      this.saveLocation(f);
      this.placed.set(placed);
      window.scrollTo({ top: 0 });
    } catch (e) {
      this.showServerErrors(e);
    } finally { this.busy.set(false); }
  }

  private showServerErrors(e: unknown) {
    if (e instanceof HttpErrorResponse && e.status === 400) {
      const raw = (e.error as { errors?: Record<string, string[]> }).errors ?? {};
      const fields: Record<string, string> = {}; const other: string[] = [];
      for (const [k, v] of Object.entries(raw)) { if (k.startsWith('field:')) fields[k.slice(6)] = v[0]; else if (k === 'deliveryLocation') this.locationError.set(v[0]); else other.push(...v); }
      this.errors.set(fields);
      // Something like "Iced Latte is sold out" belongs next to the items so the customer can fix it.
      this.itemsError.set(other.length ? [...new Set(other)].join(' ') : null);
      if (!other.length && !Object.keys(fields).length) this.generalError.set(errorMessage(e));
      setTimeout(() => document.querySelector('.has-error, .field-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    } else this.generalError.set(errorMessage(e));
  }

  again() { this.placed.set(null); this.idempotencyKey = crypto.randomUUID(); this.answers.update(a => ({ ...a })); this.picker.set({ parts: [], total: 0, people: 0, itemCount: 0 }); void this.load(); }

  /** Preselect the place this phone chose last time, if it is still on the list. */
  private restoreLocation(f: PublicForm) {
    try {
      const saved = JSON.parse(localStorage.getItem('hs_location_' + f.code) ?? 'null') as { id: string; note: string } | null;
      if (saved && f.locations.some(l => l.id === saved.id)) { this.locationId.set(saved.id); this.locationNote.set(saved.note ?? ''); }
      else if (f.locations.length === 1) this.locationId.set(f.locations[0].id); // nothing to choose between
    } catch { /* storage can be blocked; the customer just picks again */ }
  }

  private saveLocation(f: PublicForm) {
    try { localStorage.setItem('hs_location_' + f.code, JSON.stringify({ id: this.locationId(), note: this.locationNote().trim() })); } catch { /* optional */ }
  }

  /** Remember the customer's name and phone on this device only, so a repeat order is faster. */
  private remember(f: PublicForm, mode: 'save' | 'restore') {
    const roles = (f.definition?.fields ?? []).filter(x => x.role === 'customerName' || x.role === 'customerPhone' || x.role === 'customerEmail');
    try {
      if (mode === 'save') {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify(Object.fromEntries(roles.map(r => [r.role, this.answers()[r.id]?.[0] ?? '']))));
      } else {
        const saved = JSON.parse(localStorage.getItem(REMEMBER_KEY) ?? '{}') as Record<string, string>;
        this.answers.update(a => ({ ...a, ...Object.fromEntries(roles.filter(r => saved[r.role!]).map(r => [r.id, [saved[r.role!]]])) }));
      }
    } catch { /* storage can be blocked; ordering still works */ }
  }
}
