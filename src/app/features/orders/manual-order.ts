import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CatalogApi, OrdersApi } from '../../core/api';
import { errorMessage } from '../../core/http';
import { DeliveryLocation, EntryForm, PublicItem } from '../../core/models';
import { MoneyPipe, ToastService } from '../../core/ui';
import { OrderPickerComponent, PickerState } from '../../shared/order-picker';
import { AuthService } from '../../core/auth.service';

/**
 * For orders that don't arrive through the QR code: a phone call, a walk-in, a message. Same pricing and rules as a
 * customer's order, so every sale ends up as a record on the dashboard.
 */
@Component({
  selector: 'app-manual-order',
  imports: [FormsModule, OrderPickerComponent, MoneyPipe, RouterLink],
  template: `
    <div class="page narrow">
      <div class="page-head">
        <div><h1>New order</h1><p>Enter an order from a phone call, a message or the counter.</p></div>
        <a class="btn btn-ghost" routerLink="/app/board">Cancel</a>
      </div>

      @if (loading()) {
        <div class="skeleton" style="height: 300px"></div>
      } @else if (!forms().length) {
        <div class="empty card-lite"><i class="bi bi-ui-checks-grid"></i><h3>No published form yet</h3>
          <p>Publish an order form first. Orders you enter here use its items.</p>
          <a class="btn btn-primary" routerLink="/app/forms">Go to forms</a></div>
      } @else {
        <div class="card-lite p-3 mb-3">
          <div class="row g-3">
            <div class="col-md-6"><label class="form-label" for="cn">Customer name</label><input id="cn" class="form-control" [(ngModel)]="name" maxlength="120" placeholder="Who is ordering?"></div>
            <div class="col-md-6"><label class="form-label" for="cp">Phone (optional)</label><input id="cp" class="form-control" [(ngModel)]="phone" maxlength="40" inputmode="tel" placeholder="So you can message them when it's ready"></div>
            <div class="col-12">
              <span class="form-label d-block">How did it come in?</span>
              <div class="seg" role="radiogroup" aria-label="Order type">
                @for (t of types; track t) { <button type="button" role="radio" [attr.aria-checked]="type === t" [class.on]="type === t" (click)="type = t">{{ t }}</button> }
              </div>
            </div>
            <div class="col-md-6"><label class="form-label" for="loc">Deliver to</label>
              <select id="loc" name="loc" class="form-select" [(ngModel)]="locationId"><option value="">No location (counter sale)</option>@for (l of locations(); track l.id) { <option [value]="l.id">{{ l.name }}</option> }</select></div>
            <div class="col-md-6"><label class="form-label" for="ln">Room, floor or landmark</label><input id="ln" name="ln" class="form-control" [(ngModel)]="deliveryNote" maxlength="200"></div>
            @if (forms().length > 1) {
              <div class="col-12"><label class="form-label" for="fm">Form</label>
                <select id="fm" class="form-select" [ngModel]="formCode()" (ngModelChange)="pick($event)">@for (f of forms(); track f.code) { <option [value]="f.code">{{ f.name }}</option> }</select></div>
            }
          </div>
        </div>

        <div class="card-lite p-3">
          <h2 class="h5 mb-3">Items</h2>
          <app-order-picker [items]="pickerItems()" [currency]="currency()" [allowGroup]="true" [maxParts]="form()?.maxParts ?? 30" [firstName]="name" (changed)="state.set($event)" />
        </div>

        <div class="bar card-lite">
          <div class="opts">
            <label class="form-check"><input class="form-check-input" type="checkbox" [(ngModel)]="markPaid"> <span class="form-check-label">Paid (cash)</span></label>
            <label class="form-check"><input class="form-check-input" type="checkbox" [(ngModel)]="markServed"> <span class="form-check-label">Handed over now</span></label>
          </div>
          <div class="sum"><span class="text-muted">{{ state().itemCount }} item{{ state().itemCount === 1 ? '' : 's' }}@if (state().people > 1) { · {{ state().people }} people }</span>
            <strong class="money">{{ state().total | money: currency() }}</strong></div>
          <button type="button" class="btn btn-primary btn-lg" [disabled]="busy() || state().itemCount === 0" (click)="submit()">{{ busy() ? 'Saving…' : 'Create order' }}</button>
        </div>
        @if (error()) { <div class="alert alert-danger mt-3">{{ error() }}</div> }
      }
    </div>`,
  styles: `
    .narrow { max-width: 780px; }
    .seg { display: inline-flex; background: #ece6da; padding: 4px; border-radius: 12px; gap: 2px; }
    .seg button { border: 0; background: transparent; padding: .45rem 1rem; border-radius: 9px; font-weight: 600; color: var(--hs-muted); }
    .seg button.on { background: #fff; color: var(--hs-ink); box-shadow: 0 1px 3px rgba(0,0,0,.12); }
    .bar { position: sticky; bottom: .75rem; margin-top: 1rem; padding: .8rem 1rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; box-shadow: 0 8px 30px rgba(31,27,22,.16); }
    .opts { display: flex; gap: 1.2rem; flex-wrap: wrap; }
    .sum { margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2; } .sum strong { font-size: 1.3rem; }
  `,
})
export class ManualOrderComponent implements OnInit {
  private readonly api = inject(OrdersApi);
  private readonly catalog = inject(CatalogApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  readonly types = ['Phone', 'Walk-in', 'Message', 'Other'];
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly forms = signal<EntryForm[]>([]);
  readonly formCode = signal('');
  readonly items = signal<PublicItem[]>([]);
  readonly locations = signal<DeliveryLocation[]>([]);
  readonly state = signal<PickerState>({ parts: [], total: 0, people: 0, itemCount: 0 });
  readonly currency = computed(() => this.auth.currency());
  readonly form = computed(() => this.forms().find(f => f.code === this.formCode()) ?? null);
  /** Only the items this form actually offers. */
  readonly pickerItems = computed(() => {
    const f = this.form();
    return f && f.itemSource === 'selected' ? this.items().filter(i => f.itemIds.includes(i.id)) : this.items();
  });

  name = ''; phone = ''; type = 'Phone'; markPaid = false; markServed = false; locationId = ''; deliveryNote = '';

  async ngOnInit() {
    try {
      const [forms, items, locations] = await Promise.all([this.api.entryForms(), this.catalog.items(), this.catalog.deliveryLocations()]);
      this.locations.set(locations);
      this.forms.set(forms);
      this.formCode.set(forms[0]?.code ?? '');
      this.items.set(items.filter(i => !i.isArchived).map(i => ({ id: i.id, name: i.name, description: i.description, price: i.price, category: i.category, unit: i.unit, isAvailable: i.isAvailable })));
    } catch (e) { this.error.set(errorMessage(e)); } finally { this.loading.set(false); }
  }

  pick(code: string) { this.formCode.set(code); }

  async submit() {
    this.busy.set(true); this.error.set(null);
    try {
      const placed = await this.api.manual({
        formCode: this.formCode(), customerName: this.name.trim() || 'Customer', customerPhone: this.phone.trim(), manualType: this.type,
        answers: {}, parts: this.state().parts, markPaid: this.markPaid, markServed: this.markServed,
        deliveryLocationId: this.locationId || null, deliveryNote: this.deliveryNote.trim() || null,
      });
      this.toast.show(`Order #${placed.number} created.`);
      await this.router.navigateByUrl('/app/board');
    } catch (e) { this.error.set(errorMessage(e)); } finally { this.busy.set(false); }
  }
}
