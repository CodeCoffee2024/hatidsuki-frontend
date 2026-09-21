import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PartInput, PublicItem } from '../core/models';
import { MoneyPipe } from '../core/ui';

interface Person { name: string; qty: Record<string, number>; }
export interface PickerState { parts: PartInput[]; total: number; people: number; itemCount: number; }

/**
 * The item list of an order. One person by default; when group ordering is allowed the customer can add more people,
 * each with their own items, so every person's order stays a separate, trackable line.
 */
@Component({
  selector: 'app-order-picker',
  imports: [FormsModule, MoneyPipe],
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
          <li class="item" [class.out]="!i.isAvailable" [class.has]="qty(i.id) > 0">
            <div class="info">
              <span class="name">{{ i.name }}</span>
              @if (i.description) { <span class="desc">{{ i.description }}</span> }
              <span class="price money">{{ i.price | money: currency() }}@if (i.unit && i.unit !== 'each') { <span class="unit"> / {{ i.unit }}</span> }</span>
            </div>
            @if (i.isAvailable) {
              <div class="stepper" role="group" [attr.aria-label]="'Quantity of ' + i.name">
                <button type="button" class="step" (click)="change(i.id, -1)" [disabled]="qty(i.id) === 0" aria-label="One fewer">−</button>
                <output class="q num" aria-live="polite">{{ qty(i.id) }}</output>
                <button type="button" class="step" (click)="change(i.id, 1)" aria-label="One more">+</button>
              </div>
            } @else {
              <span class="chip chip-muted">Sold out</span>
            }
          </li>
        }
      </ul>
    } @empty {
      <div class="empty"><i class="bi bi-basket"></i><h3>Nothing to order yet</h3><p>There are no items available right now.</p></div>
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
    .q { min-width: 2.1rem; text-align: center; font-weight: 700; font-size: 1.1rem; }
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

  readonly people = signal<Person[]>([{ name: '', qty: {} }]);
  readonly active = signal(0);
  readonly current = computed(() => this.people()[this.active()] ?? this.people()[0]);

  readonly groups = computed(() => {
    const map = new Map<string, PublicItem[]>();
    for (const i of this.items()) { const k = i.category ?? ''; (map.get(k) ?? map.set(k, []).get(k)!).push(i); }
    return [...map].map(([category, items]) => ({ category, items }));
  });

  readonly state = computed<PickerState>(() => {
    const price = new Map(this.items().map(i => [i.id, i.price]));
    const people = this.people();
    let total = 0, itemCount = 0;
    const parts: PartInput[] = [];
    people.forEach((p, idx) => {
      const lines = Object.entries(p.qty).filter(([, q]) => q > 0).map(([itemId, quantity]) => ({ itemId, quantity }));
      if (!lines.length && people.length > 1) return; // an empty person is ignored, not an error
      for (const l of lines) { total += (price.get(l.itemId) ?? 0) * l.quantity; itemCount += l.quantity; }
      const name = p.name.trim() || (idx === 0 ? this.firstName() : '');
      parts.push({ person: name || null, lines });
    });
    return { parts, total, people: parts.length, itemCount };
  });

  constructor() { effect(() => this.changed.emit(this.state())); }

  qty(id: string) { return this.current().qty[id] ?? 0; }
  count(p: Person) { return Object.values(p.qty).reduce((a, b) => a + b, 0); }

  change(id: string, delta: number) {
    const idx = this.active();
    this.people.update(list => list.map((p, i) => i !== idx ? p : { ...p, qty: { ...p.qty, [id]: Math.max(0, Math.min(99, (p.qty[id] ?? 0) + delta)) } }));
  }
  setName(name: string) { const idx = this.active(); this.people.update(l => l.map((p, i) => (i === idx ? { ...p, name } : p))); }
  addPerson(copy: boolean) {
    const prev = this.current();
    this.people.update(l => [...l, { name: '', qty: copy ? { ...prev.qty } : {} }]);
    this.active.set(this.people().length - 1);
  }
  copyPrevious() {
    const idx = this.active();
    if (idx === 0) return;
    const prev = this.people()[idx - 1];
    this.people.update(l => l.map((p, i) => (i === idx ? { ...p, qty: { ...prev.qty } } : p)));
  }
  removePerson() {
    const idx = this.active();
    this.people.update(l => l.filter((_, i) => i !== idx));
    this.active.set(Math.max(0, idx - 1));
  }
  reset() { this.people.set([{ name: '', qty: {} }]); this.active.set(0); }
}
