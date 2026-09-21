import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { CatalogApi } from '../../core/api';
import { errorMessage } from '../../core/http';
import { FormDefinition, FormDetail, FormField, FieldType, Item } from '../../core/models';
import { ToastService } from '../../core/ui';

const TYPES: { value: FieldType; label: string; icon: string }[] = [
  { value: 'shortText', label: 'Short answer', icon: 'bi-input-cursor-text' },
  { value: 'paragraph', label: 'Long answer', icon: 'bi-text-paragraph' },
  { value: 'phone', label: 'Phone number', icon: 'bi-telephone' },
  { value: 'email', label: 'Email', icon: 'bi-envelope' },
  { value: 'number', label: 'Number', icon: 'bi-123' },
  { value: 'singleChoice', label: 'Choose one', icon: 'bi-record-circle' },
  { value: 'dropdown', label: 'Dropdown', icon: 'bi-menu-button-wide' },
  { value: 'multiChoice', label: 'Choose many', icon: 'bi-check2-square' },
  { value: 'date', label: 'Date', icon: 'bi-calendar-event' },
  { value: 'time', label: 'Time', icon: 'bi-clock' },
  { value: 'consent', label: 'Agree checkbox', icon: 'bi-patch-check' },
  { value: 'heading', label: 'Heading / text', icon: 'bi-type-h2' },
  { value: 'orderItems', label: 'Your item list', icon: 'bi-basket3' },
];
const ROLES = [
  { value: '', label: 'None' }, { value: 'customerName', label: 'Customer’s name' }, { value: 'customerPhone', label: 'Customer’s phone' },
  { value: 'customerEmail', label: 'Customer’s email' }, { value: 'notes', label: 'Notes' }, { value: 'address', label: 'Address' },
  { value: 'fulfillmentDate', label: 'Pickup / delivery date' },
];
const isChoice = (t: FieldType) => t === 'singleChoice' || t === 'dropdown' || t === 'multiChoice';

/**
 * Drag your item list in among the other questions. Changes save by themselves; "Publish" makes the current version live
 * for customers (and checks it first so you never publish something they can't use).
 */
@Component({
  selector: 'app-form-builder',
  imports: [FormsModule, RouterLink],
  template: `
    @if (loading()) {
      <div class="page"><div class="skeleton" style="height: 400px"></div></div>
    } @else if (loadError()) {
      <div class="page"><div class="alert alert-danger">{{ loadError() }}</div><a routerLink="/app/forms" class="btn btn-ghost">Back to forms</a></div>
    } @else if (form(); as f) {
      <div class="page">
        <a routerLink="/app/forms" class="back"><i class="bi bi-chevron-left"></i> Forms</a>
        <div class="page-head">
          <div class="title-edit">
            <label class="visually-hidden" for="fname">Form name</label>
            <input id="fname" class="name-input" [ngModel]="name()" (ngModelChange)="setName($event)" maxlength="80">
            <span class="save" [class.err]="saveState() === 'error'" aria-live="polite">
              @switch (saveState()) { @case ('saving') { Saving… } @case ('saved') { <i class="bi bi-check2"></i> Saved } @case ('error') { Couldn’t save. Trying again. } @default { } }
            </span>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            @if (f.status !== 'Draft') { <a class="btn btn-ghost" [routerLink]="['/app/forms', f.id, 'share']"><i class="bi bi-qr-code"></i> QR &amp; share</a> }
            <button type="button" class="btn btn-primary" [disabled]="publishing()" (click)="publish()">
              <i class="bi bi-broadcast"></i> {{ publishing() ? 'Checking…' : (f.status === 'Draft' ? 'Publish' : (f.hasUnpublishedChanges ? 'Publish changes' : 'Published')) }}
            </button>
          </div>
        </div>

        @if (problems().length) {
          <div class="alert alert-warning" role="alert">
            <strong>Fix these before publishing:</strong>
            <ul class="mb-0 mt-1">@for (p of problems(); track p) { <li>{{ p }}</li> }</ul>
          </div>
        }

        <div class="layout">
          <section>
            <p class="text-muted">Customers fill these in from top to bottom. Use the arrows to reorder.</p>
            <div class="locked card-lite">
              <strong>Delivery location</strong>
              <span class="text-muted">Every order form asks this, so it isn’t listed here. It appears just above your item list, and customers choose from the places on your <a routerLink="/app/delivery">Delivery page</a>.</span>
            </div>
            @for (fld of def().fields; track fld.id; let i = $index; let last = $last) {
              <article class="field card-lite" [class.items]="fld.type === 'orderItems'">
                <div class="fhead">
                  <span class="ticon"><i class="bi" [class]="icon(fld.type)"></i></span>
                  <select class="form-select form-select-sm type" [ngModel]="fld.type" (ngModelChange)="patch(fld.id, { type: $event })" [attr.aria-label]="'Type of field ' + (i + 1)">
                    @for (t of types; track t.value) { <option [value]="t.value">{{ t.label }}</option> }
                  </select>
                  <span class="spacer"></span>
                  <button type="button" class="btn btn-ghost btn-sm" (click)="move(i, -1)" [disabled]="i === 0" aria-label="Move up"><i class="bi bi-arrow-up"></i></button>
                  <button type="button" class="btn btn-ghost btn-sm" (click)="move(i, 1)" [disabled]="last" aria-label="Move down"><i class="bi bi-arrow-down"></i></button>
                  <button type="button" class="btn btn-ghost btn-sm" (click)="remove(fld.id)" aria-label="Delete field"><i class="bi bi-trash3"></i></button>
                </div>

                <label class="visually-hidden" [for]="'l' + fld.id">Question</label>
                <input [id]="'l' + fld.id" class="form-control label-input" [ngModel]="fld.label" (ngModelChange)="patch(fld.id, { label: $event })" placeholder="Question or label" maxlength="120">

                @if (fld.type !== 'heading') {
                  <input class="form-control form-control-sm mt-2" [ngModel]="fld.helpText ?? ''" (ngModelChange)="patch(fld.id, { helpText: $event })" placeholder="Help text (optional)" maxlength="200" aria-label="Help text">
                }

                @if (isChoice(fld.type)) {
                  <label class="form-label small mt-2 mb-1" [for]="'o' + fld.id">Choices, one per line</label>
                  <textarea [id]="'o' + fld.id" class="form-control form-control-sm" rows="3" [ngModel]="fld.options.join('\\n')" (ngModelChange)="setOptions(fld.id, $event)"></textarea>
                }

                @if (fld.type === 'orderItems' && fld.orderItems; as oi) {
                  <div class="oi">
                    <p class="small mb-2"><i class="bi bi-info-circle"></i> This is where customers pick from your item list ({{ items().length }} item{{ items().length === 1 ? '' : 's' }} in your catalog).</p>
                    <div class="form-check form-switch">
                      <input class="form-check-input" type="checkbox" role="switch" [id]="'g' + fld.id" [ngModel]="oi.allowGroupOrders" (ngModelChange)="patchOi(fld.id, { allowGroupOrders: $event })">
                      <label class="form-check-label" [for]="'g' + fld.id"><strong>Allow ordering for several people</strong><br><span class="text-muted small">Each person becomes a separate line you tick off, so nobody in a group order gets missed.</span></label>
                    </div>
                    <div class="mt-3">
                      <span class="form-label small d-block mb-1">Which items appear?</span>
                      <div class="seg" role="radiogroup" aria-label="Item source">
                        <button type="button" role="radio" [attr.aria-checked]="oi.source === 'all'" [class.on]="oi.source === 'all'" (click)="patchOi(fld.id, { source: 'all' })">All my items</button>
                        <button type="button" role="radio" [attr.aria-checked]="oi.source === 'selected'" [class.on]="oi.source === 'selected'" (click)="patchOi(fld.id, { source: 'selected' })">Only some</button>
                      </div>
                      @if (oi.source === 'selected') {
                        <div class="picklist">
                          @for (it of items(); track it.id) {
                            <label class="form-check"><input class="form-check-input" type="checkbox" [checked]="oi.itemIds.includes(it.id)" (change)="toggleItem(fld.id, it.id)"> <span class="form-check-label">{{ it.name }}</span></label>
                          } @empty { <span class="text-muted small">Add items to your catalog first.</span> }
                        </div>
                      }
                    </div>
                  </div>
                }

                @if (fld.type !== 'heading' && fld.type !== 'orderItems') {
                  <div class="opts">
                    <label class="form-check form-switch mb-0"><input class="form-check-input" type="checkbox" role="switch" [ngModel]="fld.required" (ngModelChange)="patch(fld.id, { required: $event })"> <span class="form-check-label">Required</span></label>
                    @if (fld.type !== 'consent') {
                      <div class="role"><label class="small text-muted" [for]="'r' + fld.id">Use as</label>
                        <select [id]="'r' + fld.id" class="form-select form-select-sm" [ngModel]="fld.role ?? ''" (ngModelChange)="patch(fld.id, { role: $event || null })">
                          @for (r of roles; track r.value) { <option [value]="r.value">{{ r.label }}</option> }
                        </select></div>
                    }
                  </div>
                }
              </article>
            }

            <div class="add-bar">
              <span class="text-muted small me-2">Add a field:</span>
              @for (t of types; track t.value) {
                @if (t.value !== 'orderItems' || !hasItems()) {
                  <button type="button" class="btn btn-ghost btn-sm" (click)="add(t.value)"><i class="bi" [class]="t.icon"></i> {{ t.label }}</button>
                }
              }
            </div>
          </section>

          <aside class="card-lite side">
            <h2>What customers see</h2>
            <label class="form-label small" for="intro">Welcome message</label>
            <textarea id="intro" class="form-control mb-3" rows="2" [ngModel]="def().intro ?? ''" (ngModelChange)="patchDef({ intro: $event })" maxlength="500"></textarea>
            <label class="form-label small" for="ty">After they order</label>
            <textarea id="ty" class="form-control mb-3" rows="2" [ngModel]="def().thankYou ?? ''" (ngModelChange)="patchDef({ thankYou: $event })" maxlength="300"></textarea>
            <label class="form-label small" for="pm">About payment</label>
            <input id="pm" class="form-control mb-1" [ngModel]="def().paymentMessage ?? ''" (ngModelChange)="patchDef({ paymentMessage: $event })" maxlength="200">
            <div class="form-text mb-3">Payments are cash. This message tells customers when to pay.</div>
            <label class="form-label small" for="cm">When orders are paused</label>
            <input id="cm" class="form-control" [ngModel]="def().closedMessage ?? ''" (ngModelChange)="patchDef({ closedMessage: $event })" placeholder="We’re not taking orders right now." maxlength="200">
            <hr>
            <div class="status-line">
              <span class="chip" [class.chip-ready]="f.status === 'Published'" [class.chip-served]="f.status !== 'Published'">{{ f.status === 'Published' ? 'Live' : f.status }}</span>
              @if (f.publishedVersion) { <small class="text-muted">Version {{ f.publishedVersion }}</small> }
            </div>
            @if (f.status !== 'Draft') { <a class="small" [href]="f.publicUrl" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> Open customer page</a> }
          </aside>
        </div>
      </div>
    }
  `,
  styles: `
    .back { display: inline-block; margin-bottom: .5rem; color: var(--hs-muted); text-decoration: none; font-weight: 600; }
    .title-edit { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .name-input { border: 0; border-bottom: 2px dashed transparent; background: transparent; font-size: 1.6rem; font-weight: 750; padding: 0 0 .1rem; min-width: 260px; }
    .name-input:hover, .name-input:focus { border-bottom-color: var(--hs-line); outline: none; }
    .save { color: var(--hs-muted); font-size: .88rem; min-width: 90px; } .save.err { color: var(--hs-cancel); }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 1.25rem; align-items: start; }
    .locked { padding: .8rem 1rem; margin-bottom: .75rem; display: flex; flex-direction: column; gap: .15rem; background: var(--hs-surface-2); }
    .field { padding: .9rem 1rem 1rem; margin-bottom: .75rem; }
    .field.items { border: 2px solid var(--hs-primary); background: #fffaf6; }
    .fhead { display: flex; align-items: center; gap: .4rem; margin-bottom: .6rem; }
    .ticon { width: 30px; height: 30px; border-radius: 8px; background: var(--hs-primary-soft); color: var(--hs-primary-hover); display: grid; place-items: center; flex: none; }
    .type { width: auto; max-width: 180px; } .spacer { flex: 1; }
    .label-input { font-weight: 650; }
    .oi { margin-top: .8rem; padding-top: .8rem; border-top: 1px dashed #e0c9b8; }
    .seg { display: inline-flex; background: #ece6da; padding: 3px; border-radius: 10px; gap: 2px; }
    .seg button { border: 0; background: transparent; padding: .35rem .8rem; border-radius: 8px; font-weight: 600; color: var(--hs-muted); font-size: .9rem; }
    .seg button.on { background: #fff; color: var(--hs-ink); box-shadow: 0 1px 3px rgba(0,0,0,.12); }
    .picklist { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: .2rem .8rem; margin-top: .6rem; max-height: 200px; overflow: auto; }
    .opts { display: flex; align-items: center; gap: 1.2rem; flex-wrap: wrap; margin-top: .8rem; }
    .role { display: flex; align-items: center; gap: .4rem; margin-left: auto; } .role select { width: auto; }
    .add-bar { display: flex; flex-wrap: wrap; gap: .4rem; align-items: center; padding: .9rem; border: 2px dashed #d9d2c5; border-radius: 14px; }
    .side { padding: 1rem; position: sticky; top: 1rem; } .side h2 { font-size: 1rem; font-weight: 700; margin-bottom: .8rem; }
    .status-line { display: flex; align-items: center; gap: .6rem; margin-bottom: .5rem; }
    @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } .side { position: static; } }
  `,
})
export class FormBuilderComponent implements OnInit, OnDestroy {
  readonly id = input.required<string>();

  private readonly api = inject(CatalogApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly types = TYPES;
  readonly roles = ROLES;
  readonly isChoice = isChoice;

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly form = signal<FormDetail | null>(null);
  readonly name = signal('');
  readonly def = signal<FormDefinition>({ fields: [] });
  readonly items = signal<Item[]>([]);
  readonly problems = signal<string[]>([]);
  readonly saveState = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  readonly publishing = signal(false);
  readonly hasItems = computed(() => this.def().fields.some(f => f.type === 'orderItems'));

  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;

  async ngOnInit() {
    try {
      const [form, items] = await Promise.all([this.api.form(this.id()), this.api.items()]);
      this.form.set(form); this.name.set(form.name); this.def.set(structuredClone(form.draft));
      this.items.set(items.filter(i => !i.isArchived));
    } catch (e) { this.loadError.set(errorMessage(e)); } finally { this.loading.set(false); }
  }

  ngOnDestroy() { if (this.timer) clearTimeout(this.timer); if (this.dirty) void this.saveNow(); }

  icon(t: FieldType) { return TYPES.find(x => x.value === t)?.icon ?? 'bi-question'; }

  // ---- editing (every change is immutable, then autosaved) ----
  setName(v: string) { this.name.set(v); this.changed(); }
  patchDef(p: Partial<FormDefinition>) { this.def.update(d => ({ ...d, ...p })); this.changed(); }
  patch(id: string, p: Partial<FormField>) {
    this.def.update(d => ({ ...d, fields: d.fields.map(f => {
      if (f.id !== id) return f;
      const next = { ...f, ...p };
      if (p.type && p.type !== f.type) {
        next.orderItems = p.type === 'orderItems' ? { source: 'all', itemIds: [], allowGroupOrders: true, maxParts: 30, allowLineNotes: false } : null;
        if (isChoice(p.type) && next.options.length === 0) next.options = ['Option 1', 'Option 2'];
        if (p.type === 'orderItems') { next.role = null; next.required = true; }
      }
      return next;
    }) }));
    this.changed();
  }
  patchOi(id: string, p: Partial<NonNullable<FormField['orderItems']>>) {
    this.def.update(d => ({ ...d, fields: d.fields.map(f => (f.id === id && f.orderItems ? { ...f, orderItems: { ...f.orderItems, ...p } } : f)) }));
    this.changed();
  }
  toggleItem(fieldId: string, itemId: string) {
    const f = this.def().fields.find(x => x.id === fieldId);
    const ids = f?.orderItems?.itemIds ?? [];
    this.patchOi(fieldId, { itemIds: ids.includes(itemId) ? ids.filter(x => x !== itemId) : [...ids, itemId] });
  }
  setOptions(id: string, text: string) { this.patch(id, { options: text.split('\n').map(s => s.trim()).filter(Boolean) }); }

  add(type: FieldType) {
    const label = type === 'orderItems' ? 'Your order' : TYPES.find(t => t.value === type)!.label;
    const field: FormField = { id: crypto.randomUUID(), type, label, required: type === 'orderItems', role: null, helpText: null, options: isChoice(type) ? ['Option 1', 'Option 2'] : [],
      orderItems: type === 'orderItems' ? { source: 'all', itemIds: [], allowGroupOrders: true, maxParts: 30, allowLineNotes: false } : null };
    this.def.update(d => ({ ...d, fields: [...d.fields, field] }));
    this.changed();
  }
  remove(id: string) { this.def.update(d => ({ ...d, fields: d.fields.filter(f => f.id !== id) })); this.changed(); }
  move(i: number, delta: number) {
    this.def.update(d => { const fields = [...d.fields]; const j = i + delta; if (j < 0 || j >= fields.length) return d; [fields[i], fields[j]] = [fields[j], fields[i]]; return { ...d, fields }; });
    this.changed();
  }

  // ---- saving ----
  private changed() {
    this.dirty = true; this.problems.set([]);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.saveNow(), 800);
  }

  private async saveNow(): Promise<boolean> {
    if (!this.dirty || !this.form()) return true;
    this.saveState.set('saving');
    this.dirty = false;
    try {
      const saved = await this.api.saveForm(this.id(), this.name().trim() || 'Untitled form', this.def());
      this.form.set(saved);
      this.saveState.set('saved');
      return true;
    } catch (e) {
      this.dirty = true;
      this.saveState.set('error');
      if (e instanceof HttpErrorResponse && e.status === 422) this.toast.error(errorMessage(e)); // the form itself is invalid, so retrying won't help
      else this.timer = setTimeout(() => void this.saveNow(), 4000);
      return false;
    }
  }

  async publish() {
    this.publishing.set(true); this.problems.set([]);
    try {
      if (this.timer) clearTimeout(this.timer);
      if (!(await this.saveNow())) return;
      try {
        const r = await this.api.publish(this.id());
        this.form.set(r.form);
        this.toast.show('Published! Customers can order now.');
        await this.router.navigate(['/app/forms', this.id(), 'share']);
      } catch (e) {
        if (e instanceof HttpErrorResponse && e.status === 422) this.problems.set((e.error as { problems: string[] }).problems);
        else this.toast.error(errorMessage(e));
      }
    } finally { this.publishing.set(false); }
  }
}
