import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LineInput, OptionSelections, PartInput, PublicItem } from '../core/models';
import { MoneyPipe } from '../core/ui';
import { ItemOptionsPickerComponent, PickedOptions } from './item-options-picker';

/** One configured line for an item with option groups: its own quantity, distinct from a plain qty count. */
interface OptionLine { key: string; itemId: string; options: OptionSelections; quantity: number; }
interface Person { name: string; qty: Record<string, number>; optionLines: OptionLine[]; }
export interface PickerState { parts: PartInput[]; total: number; people: number; itemCount: number; }

/** A stable key so re-choosing the exact same options for an item lands on the same cart line. */
function optionsKey(options: OptionSelections): string {
  return Object.keys(options).sort().map(k => `${k}:${[...options[k]].sort().join(',')}`).join('|');
}

function unitPriceOf(item: PublicItem, options: OptionSelections): number {
  let price = item.price;
  for (const g of item.optionGroups) for (const id of options[g.id] ?? []) {
    const o = g.options.find(x => x.id === id);
    if (o) price += o.priceDelta;
  }
  return Math.max(0, price);
}

/**
 * The item list of an order. One person by default; when group ordering is allowed the customer can add more people,
 * each with their own items, so every person's order stays a separate, trackable line. Plain items keep a snappy
 * +/− stepper; items with option groups (sizes, add-ons — FS-008) open a picker so each distinct choice becomes its
 * own line (e.g. one Large and one Small of the same drink).
 */
@Component({
  selector: 'app-order-picker',
  imports: [FormsModule, MoneyPipe, ItemOptionsPickerComponent],
  template: `
    @if (allowGroup()) {
      <div class="people" role="tablist" aria-label="People in this order">
        @for (p of people(); track $index) {
          <button type="button" class="person-tab" role="tab" [class.on]="$index === active()" [attr.aria-selected]="$index === active()" (click)="active.set($index)">
            <span>{{ p.name || 'Person ' + ($index + 1) }}</span>
            @if (count(p) > 0) { <span class="pill">{{ count(p) }}</span> }
          </button>
        }
        @if (people().length < maxParts()) {
          <button type="button" class="person-tab add" (click)="addPerson(false)"><i class="bi bi-person-plus"></i> Add person</button>
        }
      </div>

      <div class="person-head">
        <label class="visually-hidden" [for]="'pn' + active()">Name of person {{ active() + 1 }}</label>
        <input [id]="'pn' + active()" class="form-control" [ngModel]="current().name" (ngModelChange)="setName($event)"
               [placeholder]="people().length > 1 ? 'Who is this for?' : 'Name (optional for just you)'" maxlength="60" autocomplete="off">
        <div class="person-actions">
          @if (people().length > 1 && active() > 0) {
            <button type="button" class="btn btn-ghost btn-sm" (click)="copyPrevious()" title="Copy the previous person's items"><i class="bi bi-files"></i> Same as previous</button>
          }
          @if (people().length > 1) {
            <button type="button" class="btn btn-ghost btn-sm" (click)="removePerson()" aria-label="Remove this person"><i class="bi bi-trash3"></i></button>
          }
        </div>
      </div>
    }

    @for (g of groups(); track g.category) {
      @if (g.category) { <h3 class="cat">{{ g.category }}</h3> }
      <ul class="items">
        @for (i of g.items; track i.id) {
          <li class="item" [class.out]="!i.isAvailable" [class.has]="qty(i.id) > 0 || linesFor(i.id).length > 0">
            <div class="info">
              <span class="name">{{ i.name }}</span>
              @if (i.description) { <span class="desc">{{ i.description }}</span> }
              <span class="price money">{{ i.price | money: currency() }}@if (i.unit && i.unit !== 'each') { <span class="unit"> / {{ i.unit }}</span> }</span>
            </div>
            @if (i.isAvailable) {
              @if (i.optionGroups.length === 0) {
                <div class="stepper" role="group" [attr.aria-label]="'Quantity of ' + i.name">
                  <button type="button" class="step" (click)="change(i.id, -1)" [disabled]="qty(i.id) === 0" aria-label="One fewer">−</button>
                  <output class="q num" aria-live="polite">{{ qty(i.id) }}</output>
                  <button type="button" class="step" (click)="change(i.id, 1)" aria-label="One more">+</button>
                </div>
              } @else {
                <button type="button" class="btn btn-ghost btn-sm choose" (click)="pickerItem.set(i)">
                  {{ linesFor(i.id).length ? 'Add another' : 'Choose' }}
                </button>
              }
            } @else {
              <span class="chip chip-muted">Sold out</span>
            }
          </li>
          @for (l of linesFor(i.id); track l.key) {
            <li class="option-line">
              <span class="opt-summary">{{ summarize(i, l.options) }}</span>
              <span class="money">{{ unitPriceOf(i, l.options) | money: currency() }}</span>
              <div class="stepper sm" role="group" [attr.aria-label]="'Quantity'">
                <button type="button" class="step" (click)="changeOptionLine(l.key, -1)" aria-label="One fewer">−</button>
                <output class="q num" aria-live="polite">{{ l.quantity }}</output>
                <button type="button" class="step" (click)="changeOptionLine(l.key, 1)" aria-label="One more">+</button>
              </div>
              <button type="button" class="btn btn-ghost btn-sm" (click)="editingLine.set(l); pickerItem.set(i)" [attr.aria-label]="'Edit'"><i class="bi bi-pencil"></i></button>
            </li>
          }
        }
      </ul>
    } @empty {
      <div class="empty"><i class="bi bi-basket"></i><h3>Nothing to order yet</h3><p>There are no items available right now.</p></div>
    }

    @if (pickerItem(); as pi) {
      <app-item-options-picker [item]="pi" [currency]="currency()" [initial]="editingLine() ? { options: editingLine()!.options, quantity: editingLine()!.quantity } : null"
                                (confirmed)="onConfirm(pi.id, $event)" (closed)="pickerItem.set(null); editingLine.set(null)" />
    }
  `,
  styles: `
    :host { display: block; }
    .people { display: flex; gap: .4rem; flex-wrap: wrap; margin-bottom: .75rem; }
    .person-tab { display: inline-flex; align-items: center; gap: .4rem; border: 1px solid var(--hs-line); background: var(--hs-surface); border-radius: 999px; padding: .4rem .85rem; font-weight: 600; color: var(--hs-ink); }
    .person-tab.on { background: var(--hs-ink); color: #fff; border-color: var(--hs-ink); }
    .person-tab.add { color: var(--hs-primary-hover); border-style: dashed; }
    .pill { background: var(--hs-primary); color: #fff; border-radius: 999px; font-size: .72rem; padding: 0 .45rem; }
    .person-head { display: flex; gap: .5rem; align-items: center; margin-bottom: .5rem; }
    .person-head .form-control { flex: 1; }
    .person-actions { display: flex; gap: .35rem; }
    .cat { font-size: .78rem; text-transform: uppercase; letter-spacing: .08em; color: var(--hs-muted); margin: 1.1rem 0 .4rem; font-weight: 700; }
    .items { list-style: none; margin: 0; padding: 0; display: grid; gap: .5rem; }
    .item { display: flex; align-items: center; gap: .8rem; background: var(--hs-surface); border: 1px solid var(--hs-line); border-radius: 12px; padding: .7rem .9rem; }
    .item.has { border-color: var(--hs-primary); background: #fffaf6; }
    .item.out { opacity: .6; }
    .info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .name { font-weight: 650; }
    .desc { color: var(--hs-muted); font-size: .85rem; }
    .price { font-weight: 600; margin-top: .1rem; }
    .unit { color: var(--hs-muted); font-weight: 400; }
    .stepper { display: inline-flex; align-items: center; gap: .15rem; }
    .step { width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--hs-line); background: var(--hs-surface); font-size: 1.35rem; line-height: 1; color: var(--hs-ink); }
    .step:hover:not(:disabled) { background: var(--hs-primary-soft); border-color: var(--hs-primary); }
    .step:disabled { opacity: .35; }
    .stepper.sm .step { width: 38px; height: 38px; font-size: 1.1rem; }
    .q { min-width: 2.1rem; text-align: center; font-weight: 700; font-size: 1.1rem; }
    .choose { min-height: 44px; }
    .option-line { display: flex; align-items: center; flex-wrap: wrap; gap: .5rem .6rem; margin: -.25rem 0 0 .75rem; padding: .5rem .7rem;
      background: var(--hs-surface-2); border-radius: 10px; }
    .opt-summary { flex: 1 1 100%; min-width: 0; font-size: .9rem; color: var(--hs-ink); }
    @media (max-width: 420px) { .option-line { margin-left: .25rem; } }
  `,
})
export class OrderPickerComponent {
  readonly items = input.required<PublicItem[]>();
  readonly currency = input.required<string>();
  readonly allowGroup = input(false);
  readonly maxParts = input(30);
  /** Name to put on the first person when the customer has typed theirs elsewhere on the form. */
  readonly firstName = input('');
  readonly changed = output<PickerState>();

  readonly people = signal<Person[]>([{ name: '', qty: {}, optionLines: [] }]);
  readonly active = signal(0);
  readonly current = computed(() => this.people()[this.active()] ?? this.people()[0]);
  readonly pickerItem = signal<PublicItem | null>(null);
  readonly editingLine = signal<OptionLine | null>(null);

  readonly unitPriceOf = unitPriceOf;

  readonly groups = computed(() => {
    const map = new Map<string, PublicItem[]>();
    for (const i of this.items()) { const k = i.category ?? ''; (map.get(k) ?? map.set(k, []).get(k)!).push(i); }
    return [...map].map(([category, items]) => ({ category, items }));
  });

  readonly state = computed<PickerState>(() => {
    const byId = new Map(this.items().map(i => [i.id, i]));
    const people = this.people();
    let total = 0, itemCount = 0;
    const parts: PartInput[] = [];
    people.forEach((p, idx) => {
      const lines: LineInput[] = [];
      for (const [itemId, quantity] of Object.entries(p.qty)) {
        if (quantity <= 0) continue;
        const item = byId.get(itemId);
        lines.push({ itemId, quantity });
        total += (item?.price ?? 0) * quantity; itemCount += quantity;
      }
      for (const l of p.optionLines) {
        const item = byId.get(l.itemId);
        if (!item) continue;
        lines.push({ itemId: l.itemId, quantity: l.quantity, options: l.options });
        total += unitPriceOf(item, l.options) * l.quantity; itemCount += l.quantity;
      }
      if (!lines.length && people.length > 1) return; // an empty person is ignored, not an error
      const name = p.name.trim() || (idx === 0 ? this.firstName() : '');
      parts.push({ person: name || null, lines });
    });
    return { parts, total, people: parts.length, itemCount };
  });

  constructor() { effect(() => this.changed.emit(this.state())); }

  qty(id: string) { return this.current().qty[id] ?? 0; }
  linesFor(itemId: string) { return this.current().optionLines.filter(l => l.itemId === itemId); }
  count(p: Person) { return Object.values(p.qty).reduce((a, b) => a + b, 0) + p.optionLines.reduce((a, l) => a + l.quantity, 0); }
  summarize(item: PublicItem, options: OptionSelections) {
    const names = item.optionGroups.flatMap(g => (options[g.id] ?? []).map(id => g.options.find(o => o.id === id)?.name)).filter(Boolean);
    return names.length ? names.join(', ') : 'No add-ons';
  }

  change(id: string, delta: number) {
    const idx = this.active();
    this.people.update(list => list.map((p, i) => i !== idx ? p : { ...p, qty: { ...p.qty, [id]: Math.max(0, Math.min(99, (p.qty[id] ?? 0) + delta)) } }));
  }
  setName(name: string) { const idx = this.active(); this.people.update(l => l.map((p, i) => (i === idx ? { ...p, name } : p))); }
  addPerson(copy: boolean) {
    const prev = this.current();
    this.people.update(l => [...l, { name: '', qty: copy ? { ...prev.qty } : {}, optionLines: copy ? prev.optionLines.map(x => ({ ...x })) : [] }]);
    this.active.set(this.people().length - 1);
  }
  copyPrevious() {
    const idx = this.active();
    if (idx === 0) return;
    const prev = this.people()[idx - 1];
    this.people.update(l => l.map((p, i) => (i === idx ? { ...p, qty: { ...prev.qty }, optionLines: prev.optionLines.map(x => ({ ...x })) } : p)));
  }
  removePerson() {
    const idx = this.active();
    this.people.update(l => l.filter((_, i) => i !== idx));
    this.active.set(Math.max(0, idx - 1));
  }
  reset() { this.people.set([{ name: '', qty: {}, optionLines: [] }]); this.active.set(0); }

  // ---- items with option groups ----
  onConfirm(itemId: string, picked: PickedOptions) {
    const idx = this.active();
    const editing = this.editingLine();
    const key = `${itemId}::${optionsKey(picked.options)}`;
    this.people.update(list => list.map((p, i) => {
      if (i !== idx) return p;
      // Editing removes the line's old entry first, so re-saving with unchanged options replaces it rather than adding to it;
      // only a genuine collision with a *different* line merges quantities.
      const withoutEdited = editing ? p.optionLines.filter(l => l.key !== editing.key) : p.optionLines;
      const existing = withoutEdited.find(l => l.key === key);
      const lines = existing
        ? withoutEdited.map(l => (l.key === key ? { ...l, quantity: Math.min(99, l.quantity + picked.quantity) } : l))
        : [...withoutEdited, { key, itemId, options: picked.options, quantity: picked.quantity }];
      return { ...p, optionLines: lines };
    }));
    this.pickerItem.set(null); this.editingLine.set(null);
  }
  changeOptionLine(key: string, delta: number) {
    const idx = this.active();
    this.people.update(list => list.map((p, i) => {
      if (i !== idx) return p;
      const lines = p.optionLines.map(l => (l.key === key ? { ...l, quantity: l.quantity + delta } : l)).filter(l => l.quantity > 0);
      return { ...p, optionLines: lines };
    }));
  }
}
