import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogApi, OptionGroupInput } from '../../core/api';
import { errorMessage } from '../../core/http';
import { Item, ItemOptionGroup, SelectionType } from '../../core/models';
import { ToastService } from '../../core/ui';
import { ItemOptionsPickerComponent } from '../../shared/item-options-picker';
import { ModalComponent } from '../../shared/modal';

interface EditOption { id: string; name: string; priceDelta: number; isAvailable: boolean; isDefault: boolean; }
interface EditGroup { id: string; name: string; selectionType: SelectionType; required: boolean; minSelect: number | null; maxSelect: number | null; options: EditOption[]; }

const uid = () => crypto.randomUUID();

/**
 * "Options" section of the item editor (FS-008): sizes, flavors, add-ons with price deltas. Everything is edited
 * locally and saved as one whole set (matching how the API replaces an item's option groups in one call), with a
 * live preview using the exact widget a customer would see.
 */
@Component({
  selector: 'app-item-options-editor',
  imports: [FormsModule, ModalComponent, ItemOptionsPickerComponent],
  template: `
    <app-modal heading="Options for {{ item().name }}" [width]="760" (closed)="closed.emit()">
      @if (error()) { <div class="alert alert-danger py-2">{{ error() }}</div> }

      <div class="copy-row">
        <select class="form-select form-select-sm" [ngModel]="copyFromId" (ngModelChange)="copyFromId = $event" [disabled]="otherItems().length === 0">
          <option value="">Copy options from…</option>
          @for (o of otherItems(); track o.id) { <option [value]="o.id">{{ o.name }}</option> }
        </select>
        <button type="button" class="btn btn-ghost btn-sm" [disabled]="!copyFromId || copying()" (click)="copyFrom()">
          {{ copying() ? 'Copying…' : 'Copy' }}
        </button>
        <span class="hint">Replaces everything below (saved immediately).</span>
      </div>

      @for (g of groups(); track g.id; let gi = $index) {
        <fieldset class="group card-lite">
          <div class="row g-2 align-items-end mb-2">
            <div class="col-6"><label class="form-label small">Group name</label>
              <input class="form-control form-control-sm" [(ngModel)]="g.name" maxlength="60" placeholder="e.g. Size"></div>
            <div class="col-3"><label class="form-label small">Pick</label>
              <select class="form-select form-select-sm" [(ngModel)]="g.selectionType">
                <option value="single">One</option><option value="multiple">Several</option>
              </select></div>
            <div class="col-3 d-flex gap-1 justify-content-end">
              <button type="button" class="btn btn-ghost btn-sm" [disabled]="gi === 0" (click)="moveGroup(gi, -1)" aria-label="Move up"><i class="bi bi-arrow-up"></i></button>
              <button type="button" class="btn btn-ghost btn-sm" [disabled]="gi === groups().length - 1" (click)="moveGroup(gi, 1)" aria-label="Move down"><i class="bi bi-arrow-down"></i></button>
              <button type="button" class="btn btn-ghost btn-sm" (click)="removeGroup(gi)" aria-label="Remove group"><i class="bi bi-trash3"></i></button>
            </div>
          </div>
          <div class="row g-2 mb-2 align-items-center">
            <div class="col-auto"><label class="form-check"><input class="form-check-input" type="checkbox" [(ngModel)]="g.required"> <span class="form-check-label">Required</span></label></div>
            @if (g.selectionType === 'multiple') {
              <div class="col-auto"><label class="form-label small mb-0 me-1">Min</label><input class="form-control form-control-sm num" type="number" min="0" [(ngModel)]="g.minSelect"></div>
              <div class="col-auto"><label class="form-label small mb-0 me-1">Max</label><input class="form-control form-control-sm num" type="number" min="0" [(ngModel)]="g.maxSelect"></div>
            }
          </div>

          @for (o of g.options; track o.id; let oi = $index) {
            <div class="opt-row">
              <input class="form-control form-control-sm name" [(ngModel)]="o.name" maxlength="60" placeholder="Option name">
              <div class="delta-wrap"><span class="pfx">+</span><input class="form-control form-control-sm delta" type="number" step="0.01" [(ngModel)]="o.priceDelta"></div>
              <label class="form-check mb-0" title="Available to order"><input class="form-check-input" type="checkbox" [(ngModel)]="o.isAvailable"> <span class="form-check-label small">Available</span></label>
              <label class="form-check mb-0" title="Pre-selected in the customer's picker"><input class="form-check-input" type="checkbox" [(ngModel)]="o.isDefault"> <span class="form-check-label small">Default</span></label>
              <div class="opt-acts">
                <button type="button" class="btn btn-ghost btn-sm" [disabled]="oi === 0" (click)="moveOption(gi, oi, -1)" aria-label="Move up"><i class="bi bi-arrow-up"></i></button>
                <button type="button" class="btn btn-ghost btn-sm" [disabled]="oi === g.options.length - 1" (click)="moveOption(gi, oi, 1)" aria-label="Move down"><i class="bi bi-arrow-down"></i></button>
                <button type="button" class="btn btn-ghost btn-sm" (click)="removeOption(gi, oi)" aria-label="Remove option"><i class="bi bi-x-lg"></i></button>
              </div>
            </div>
          }
          <button type="button" class="btn btn-ghost btn-sm mt-1" (click)="addOption(gi)"><i class="bi bi-plus-lg"></i> Add option</button>
        </fieldset>
      }
      <button type="button" class="btn btn-ghost mb-3" [disabled]="groups().length >= 10" (click)="addGroup()"><i class="bi bi-plus-lg"></i> Add option group</button>

      <div class="d-flex gap-2 justify-content-between align-items-center">
        <button type="button" class="btn btn-ghost" [disabled]="groups().length === 0" (click)="preview.set(true)"><i class="bi bi-eye"></i> Preview</button>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-ghost" (click)="closed.emit()">Cancel</button>
          <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save()">{{ saving() ? 'Saving…' : 'Save options' }}</button>
        </div>
      </div>
    </app-modal>

    @if (preview()) {
      <app-item-options-picker [item]="{ id: item().id, name: item().name, price: item().price, optionGroups: previewGroups() }"
                                [currency]="currency()" mode="preview" (closed)="preview.set(false)" />
    }
  `,
  styles: `
    .copy-row { display: flex; align-items: center; gap: .5rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .copy-row select { max-width: 240px; }
    .hint { color: var(--hs-muted); font-size: .78rem; }
    .group { margin-bottom: 1rem; padding: .9rem 1rem; }
    .num { width: 70px; }
    .opt-row { display: flex; align-items: center; gap: .5rem; margin-bottom: .4rem; }
    .opt-row .name { flex: 1; min-width: 0; }
    .delta-wrap { display: flex; align-items: center; gap: .25rem; }
    .delta-wrap .pfx { color: var(--hs-muted); }
    .delta { width: 90px; }
    .opt-acts { display: flex; gap: .1rem; flex: none; }
  `,
})
export class ItemOptionsEditorComponent implements OnInit {
  readonly item = input.required<Item>();
  readonly allItems = input.required<Item[]>();
  readonly currency = input.required<string>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  private readonly api = inject(CatalogApi);
  private readonly toast = inject(ToastService);

  readonly saving = signal(false);
  readonly copying = signal(false);
  readonly error = signal<string | null>(null);
  readonly preview = signal(false);
  copyFromId = '';
  readonly otherItems = computed(() => this.allItems().filter(i => i.id !== this.item().id && !i.isArchived));

  readonly groups = signal<EditGroup[]>([]);

  ngOnInit() {
    this.groups.set(this.toEditable(this.item().optionGroups));
  }

  /** A plain method, not a computed(): the fields below are edited by mutating nested objects in place (see the
   * template), which a computed()'s dependency tracking would not notice. Called fresh each time it's used. */
  previewGroups(): ItemOptionGroup[] {
    return this.groups().map((g, gi) => ({
      id: g.id, name: g.name || 'Untitled', selectionType: g.selectionType, required: g.required,
      minSelect: g.minSelect, maxSelect: g.maxSelect, sortOrder: gi,
      options: g.options.map((o, oi) => ({ id: o.id, name: o.name || 'Untitled', priceDelta: o.priceDelta || 0, isAvailable: o.isAvailable, isDefault: o.isDefault, sortOrder: oi })),
    }));
  }

  private toEditable(groups: ItemOptionGroup[]): EditGroup[] {
    return groups.map(g => ({
      id: g.id, name: g.name, selectionType: g.selectionType, required: g.required, minSelect: g.minSelect, maxSelect: g.maxSelect,
      options: g.options.map(o => ({ id: o.id, name: o.name, priceDelta: o.priceDelta, isAvailable: o.isAvailable, isDefault: o.isDefault })),
    }));
  }

  addGroup() {
    this.groups.update(l => [...l, { id: uid(), name: '', selectionType: 'single', required: false, minSelect: null, maxSelect: null, options: [] }]);
  }
  removeGroup(i: number) { this.groups.update(l => l.filter((_, x) => x !== i)); }
  moveGroup(i: number, dir: -1 | 1) {
    this.groups.update(l => { const c = [...l]; const [g] = c.splice(i, 1); c.splice(i + dir, 0, g); return c; });
  }
  addOption(gi: number) {
    this.groups.update(l => l.map((g, i) => (i !== gi ? g : { ...g, options: [...g.options, { id: uid(), name: '', priceDelta: 0, isAvailable: true, isDefault: false }] })));
  }
  removeOption(gi: number, oi: number) {
    this.groups.update(l => l.map((g, i) => (i !== gi ? g : { ...g, options: g.options.filter((_, x) => x !== oi) })));
  }
  moveOption(gi: number, oi: number, dir: -1 | 1) {
    this.groups.update(l => l.map((g, i) => {
      if (i !== gi) return g;
      const opts = [...g.options]; const [o] = opts.splice(oi, 1); opts.splice(oi + dir, 0, o);
      return { ...g, options: opts };
    }));
  }

  async save() {
    this.saving.set(true); this.error.set(null);
    const groups: OptionGroupInput[] = this.groups().map(g => ({
      id: g.id, name: g.name.trim(), selectionType: g.selectionType, required: g.required,
      minSelect: g.selectionType === 'multiple' ? g.minSelect : null, maxSelect: g.selectionType === 'multiple' ? g.maxSelect : null,
      options: g.options.map(o => ({ id: o.id, name: o.name.trim(), priceDelta: o.priceDelta || 0, isAvailable: o.isAvailable, isDefault: o.isDefault })),
    }));
    try {
      await this.api.saveOptionGroups(this.item().id, groups);
      this.toast.show('Options saved.');
      this.saved.emit();
    } catch (e) { this.error.set(errorMessage(e)); } finally { this.saving.set(false); }
  }

  async copyFrom() {
    const sourceId = this.copyFromId;
    if (!sourceId) return;
    this.copying.set(true); this.error.set(null);
    try {
      const updated = await this.api.copyOptionsFrom(this.item().id, sourceId);
      this.groups.set(this.toEditable(updated.optionGroups));
      this.toast.show('Options copied.');
      this.saved.emit();
    } catch (e) { this.error.set(errorMessage(e)); } finally { this.copying.set(false); }
  }
}
