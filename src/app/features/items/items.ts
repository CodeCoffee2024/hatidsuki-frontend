import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { CatalogApi } from '../../core/api';
import { errorMessage } from '../../core/http';
import { Item } from '../../core/models';
import { MoneyPipe, ToastService } from '../../core/ui';
import { ModalComponent } from '../../shared/modal';
import { BulkEntryComponent } from './bulk-entry';
import { ItemOptionsEditorComponent } from './item-options-editor';

/** The business's item list: what customers can order. Sold-out is one tap, even for counter staff. */
@Component({
  selector: 'app-items',
  imports: [ReactiveFormsModule, MoneyPipe, ModalComponent, BulkEntryComponent, ItemOptionsEditorComponent],
  template: `
    <div class="page">
      <div class="page-head">
        <div><h1>Items</h1><p>What customers can order. Prices and names here appear on your order form.</p></div>
        @if (canEdit()) {
          <div class="d-flex gap-2 flex-wrap">
            <button type="button" class="btn btn-primary" (click)="bulk.set(true)"><i class="bi bi-table"></i> Add many at once</button>
            <button type="button" class="btn btn-ghost" (click)="edit(null)"><i class="bi bi-plus-lg"></i> Add one item</button>
          </div>
        }
      </div>

      <div class="toolbar">
        <div class="search"><i class="bi bi-search"></i><input type="search" class="form-control" placeholder="Search items" aria-label="Search items" (input)="search($any($event.target).value)"></div>
        @if (canEdit()) {
          <label class="form-check mb-0"><input class="form-check-input" type="checkbox" [checked]="showArchived()" (change)="toggleArchived($any($event.target).checked)"> <span class="form-check-label">Show archived</span></label>
        }
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @if (loading() && !items().length) {
        <div class="skeleton" style="height: 280px"></div>
      } @else if (!items().length) {
        <div class="empty card-lite">
          <i class="bi bi-basket3"></i><h3>{{ term() ? 'No items match' : 'Add your first items' }}</h3>
          <p>{{ term() ? 'Try a different search.' : 'Type or paste your whole menu at once. It takes about a minute.' }}</p>
          @if (canEdit() && !term()) { <button class="btn btn-primary" (click)="bulk.set(true)"><i class="bi bi-table"></i> Add many at once</button> }
        </div>
      } @else {
        @for (g of groups(); track g.category) {
          <section class="card-lite group">
            <h2>{{ g.category || 'No category' }} <small>{{ g.items.length }}</small></h2>
            @for (i of g.items; track i.id) {
              <div class="row-item" [class.dim]="i.isArchived || !i.isAvailable">
                <div class="info">
                  <strong>{{ i.name }}</strong>
                  @if (i.isArchived) { <span class="chip chip-muted">Archived</span> }
                  @if (i.description) { <div class="text-muted small">{{ i.description }}</div> }
                </div>
                <span class="money price">{{ i.price | money }}</span>
                @if (!i.isArchived) {
                  <label class="switch" [title]="i.isAvailable ? 'Available. Tap to mark sold out.' : 'Sold out. Tap to make it available.'">
                    <input type="checkbox" role="switch" [checked]="i.isAvailable" (change)="setAvailable(i, $any($event.target).checked)" [attr.aria-label]="'Available: ' + i.name">
                    <span class="track"></span><span class="lbl">{{ i.isAvailable ? 'Available' : 'Sold out' }}</span>
                  </label>
                }
                @if (canEdit()) {
                  <div class="acts">
                    @if (!i.isArchived) {
                      <button type="button" class="btn btn-ghost btn-sm" (click)="optionsFor.set(i)" [attr.aria-label]="'Options for ' + i.name" title="Sizes, flavors, add-ons">
                        <i class="bi bi-sliders"></i>@if (i.optionGroups.length) { <span class="opt-count">{{ i.optionGroups.length }}</span> }
                      </button>
                    }
                    <button type="button" class="btn btn-ghost btn-sm" (click)="edit(i)" [attr.aria-label]="'Edit ' + i.name"><i class="bi bi-pencil"></i></button>
                    <button type="button" class="btn btn-ghost btn-sm" (click)="archive(i)" [attr.aria-label]="(i.isArchived ? 'Restore ' : 'Archive ') + i.name" [title]="i.isArchived ? 'Restore' : 'Archive (keeps past orders intact)'"><i class="bi" [class.bi-archive]="!i.isArchived" [class.bi-arrow-counterclockwise]="i.isArchived"></i></button>
                  </div>
                }
              </div>
            }
          </section>
        }
      }
    </div>

    @if (editing() !== undefined) {
      <app-modal [heading]="editing() ? 'Edit item' : 'Add an item'" (closed)="editing.set(undefined)">
        <form [formGroup]="form" (ngSubmit)="save()" novalidate>
          @if (formError()) { <div class="alert alert-danger py-2">{{ formError() }}</div> }
          <div class="mb-3"><label class="form-label" for="in">Name</label><input id="in" class="form-control" formControlName="name" maxlength="120" [class.is-invalid]="bad('name')">
            @if (bad('name')) { <div class="field-error">Enter an item name.</div> }</div>
          <div class="row g-3 mb-3">
            <div class="col-5"><label class="form-label" for="ip">Price</label><input id="ip" class="form-control" type="number" min="0" step="0.01" inputmode="decimal" formControlName="price" [class.is-invalid]="bad('price')">
              @if (bad('price')) { <div class="field-error">Enter a price of 0 or more.</div> }</div>
            <div class="col-7"><label class="form-label" for="ic">Category</label><input id="ic" class="form-control" formControlName="category" list="cats" maxlength="60" placeholder="e.g. Drinks">
              <datalist id="cats">@for (c of categories(); track c) { <option [value]="c"></option> }</datalist></div>
          </div>
          <div class="mb-3"><label class="form-label" for="id">Description (optional)</label><textarea id="id" class="form-control" rows="2" maxlength="1000" formControlName="description"></textarea></div>
          <div class="d-flex gap-2 justify-content-end"><button type="button" class="btn btn-ghost" (click)="editing.set(undefined)">Cancel</button>
            <button class="btn btn-primary" type="submit" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save item' }}</button></div>
        </form>
      </app-modal>
    }
    @if (bulk()) { <app-bulk-entry (closed)="bulk.set(false)" (saved)="load()" /> }
    @if (optionsFor(); as oi) {
      <app-item-options-editor [item]="oi" [allItems]="items()" [currency]="auth.currency()" (closed)="optionsFor.set(null)" (saved)="optionsFor.set(null); load()" />
    }
  `,
  styles: `
    .toolbar { display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; }
    .search { position: relative; flex: 1; min-width: 220px; max-width: 380px; }
    .search .bi { position: absolute; left: .8rem; top: 50%; transform: translateY(-50%); color: var(--hs-muted); }
    .search .form-control { padding-left: 2.2rem; }
    .group { margin-bottom: 1rem; overflow: hidden; }
    .group h2 { font-size: .95rem; color: var(--hs-ink); margin: 0; padding: .65rem 1rem; background: var(--hs-surface-2); font-weight: 700; }
    .group h2 small { font-weight: 500; margin-left: .3rem; }
    .row-item { display: flex; align-items: center; gap: 1rem; padding: .7rem 1rem; border-top: 1px solid var(--hs-line); }
    .row-item.dim .info, .row-item.dim .price { opacity: .55; }
    .info { flex: 1; min-width: 0; } .price { font-weight: 650; min-width: 84px; text-align: right; }
    .acts { display: flex; gap: .3rem; }
    .opt-count { background: var(--hs-primary); color: #fff; border-radius: 999px; font-size: .65rem; padding: 0 .35rem; margin-left: .2rem; }
    .switch { display: inline-flex; align-items: center; gap: .5rem; cursor: pointer; min-width: 108px; margin: 0; }
    .switch input { position: absolute; opacity: 0; }
    .switch .track { width: 40px; height: 24px; border-radius: 999px; background: #cfc6b6; position: relative; transition: background .15s; flex: none; }
    .switch .track::after { content: ''; position: absolute; left: 3px; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform .15s; }
    .switch input:checked + .track { background: #22a35a; } .switch input:checked + .track::after { transform: translateX(16px); }
    .switch input:focus-visible + .track { outline: 3px solid rgba(194,65,12,.55); outline-offset: 2px; }
    .switch .lbl { font-size: .85rem; font-weight: 600; color: var(--hs-muted); }
    @media (max-width: 640px) { .row-item { flex-wrap: wrap; } .info { flex: 1 0 60%; } }
  `,
})
export class ItemsComponent implements OnInit {
  private readonly api = inject(CatalogApi);
  readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly items = signal<Item[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly term = signal('');
  readonly showArchived = signal(false);
  readonly bulk = signal(false);
  readonly optionsFor = signal<Item | null>(null);
  /** undefined = closed, null = adding, Item = editing */
  readonly editing = signal<Item | null | undefined>(undefined);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly canEdit = computed(() => this.auth.canSeeMoney());
  readonly categories = computed(() => [...new Set(this.items().map(i => i.category).filter((c): c is string => !!c))].sort());
  readonly groups = computed(() => {
    const map = new Map<string, Item[]>();
    for (const i of this.items()) { const k = i.category ?? ''; (map.get(k) ?? map.set(k, []).get(k)!).push(i); }
    return [...map].map(([category, items]) => ({ category, items }));
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    price: [0, [Validators.required, Validators.min(0)]],
    category: [''],
    description: [''],
  });

  private debounce: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() { void this.load(); }
  bad(n: 'name' | 'price') { const c = this.form.controls[n]; return c.invalid && (c.touched || c.dirty); }

  search(v: string) {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => { this.term.set(v.trim()); void this.load(); }, 250);
  }
  toggleArchived(on: boolean) { this.showArchived.set(on); void this.load(); }

  async load() {
    try {
      this.items.set(await this.api.items(this.term() || undefined, this.showArchived()));
      this.error.set(null);
    } catch (e) { this.error.set(errorMessage(e)); } finally { this.loading.set(false); }
  }

  edit(item: Item | null) {
    this.formError.set(null);
    this.form.reset({ name: item?.name ?? '', price: item?.price ?? 0, category: item?.category ?? '', description: item?.description ?? '' });
    this.editing.set(item);
  }

  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true); this.formError.set(null);
    const v = this.form.getRawValue();
    try {
      await this.api.saveItem(this.editing()?.id ?? null, { name: v.name, price: v.price, category: v.category || null, description: v.description || null, unit: null });
      this.editing.set(undefined);
      this.toast.show('Item saved.');
      await this.load();
    } catch (e) { this.formError.set(errorMessage(e)); } finally { this.saving.set(false); }
  }

  async setAvailable(i: Item, available: boolean) {
    this.items.update(l => l.map(x => (x.id === i.id ? { ...x, isAvailable: available } : x)));
    try { await this.api.setAvailability(i.id, available); this.toast.show(available ? `${i.name} is available again.` : `${i.name} marked sold out.`); }
    catch (e) { this.toast.error(errorMessage(e)); await this.load(); }
  }

  async archive(i: Item) {
    try { await this.api.setArchived(i.id, !i.isArchived); this.toast.show(i.isArchived ? 'Item restored.' : 'Item archived. Past orders keep it.'); await this.load(); }
    catch (e) { this.toast.error(errorMessage(e)); }
  }
}
