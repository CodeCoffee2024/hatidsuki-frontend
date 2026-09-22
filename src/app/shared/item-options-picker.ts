import { Component, computed, input, output, signal } from '@angular/core';
import { ItemOptionGroup, OptionSelections } from '../core/models';
import { MoneyPipe } from '../core/ui';
import { ModalComponent } from './modal';

export interface PickedOptions { options: OptionSelections; quantity: number; }

/**
 * How a customer customizes one item: choose from its option groups (size, flavor, add-ons…), see the price update
 * live, and set a quantity. Also reused, unchanged, as the "preview" in the owner's item editor (FS-008 AC2) — it's
 * literally the same widget a customer would see.
 */
@Component({
  selector: 'app-item-options-picker',
  imports: [MoneyPipe, ModalComponent],
  template: `
    <app-modal [heading]="item().name" (closed)="closed.emit()">
      @if (mode() === 'preview') { <p class="preview-note"><i class="bi bi-eye"></i> This is what a customer sees.</p> }
      @for (g of item().optionGroups; track g.id) {
        <fieldset class="group">
          <legend>{{ g.name }}@if (g.required) { <span class="req"> *</span> }
            @if (g.selectionType === 'multiple') { <span class="hint">{{ hint(g) }}</span> }
          </legend>
          <div class="opts">
            @for (o of g.options; track o.id) {
              <button type="button" class="opt" [class.on]="isChosen(g, o.id)" [class.out]="!o.isAvailable"
                      [disabled]="!o.isAvailable" (click)="toggle(g, o.id)">
                <span class="name">{{ o.name }}</span>
                @if (!o.isAvailable) { <span class="chip chip-muted">Sold out</span> }
                @else if (o.priceDelta !== 0) { <span class="delta">{{ o.priceDelta > 0 ? '+' : '' }}{{ o.priceDelta | money: currency() }}</span> }
              </button>
            }
          </div>
        </fieldset>
      }

      @if (problem()) { <p class="field-error" role="alert">{{ problem() }}</p> }

      <div class="qty-row">
        <span class="lbl">Quantity</span>
        <div class="stepper" role="group" aria-label="Quantity">
          <button type="button" class="step" (click)="quantity.set(Math.max(1, quantity() - 1))" [disabled]="quantity() <= 1" aria-label="One fewer">−</button>
          <output class="q num" aria-live="polite">{{ quantity() }}</output>
          <button type="button" class="step" (click)="quantity.set(Math.min(99, quantity() + 1))" aria-label="One more">+</button>
        </div>
      </div>

      <div class="foot">
        <span class="total money">{{ unitPrice() * quantity() | money: currency() }}</span>
        @if (mode() === 'order') {
          <button type="button" class="btn btn-primary" [disabled]="!!problem()" (click)="confirm()">Add to order</button>
        } @else {
          <button type="button" class="btn btn-ghost" (click)="closed.emit()">Close preview</button>
        }
      </div>
    </app-modal>
  `,
  styles: `
    .preview-note { color: var(--hs-muted); font-size: .85rem; margin: -.3rem 0 .8rem; }
    .group { border: 0; padding: 0; margin: 0 0 1.1rem; }
    legend { font-weight: 700; padding: 0 0 .4rem; width: 100%; }
    .req { color: var(--hs-attn); } .hint { font-weight: 500; color: var(--hs-muted); font-size: .8rem; margin-left: .4rem; }
    .opts { display: flex; flex-wrap: wrap; gap: .5rem; }
    .opt { display: inline-flex; align-items: center; gap: .5rem; padding: .55rem .9rem; border-radius: 12px; border: 1px solid var(--hs-line);
      background: var(--hs-surface); font-weight: 600; min-height: 44px; }
    .opt.on { background: var(--hs-ink); border-color: var(--hs-ink); color: #fff; }
    .opt.out { opacity: .5; }
    .opt .delta { font-weight: 500; opacity: .85; }
    .qty-row { display: flex; align-items: center; justify-content: space-between; margin: 1rem 0; }
    .lbl { font-weight: 650; }
    .stepper { display: inline-flex; align-items: center; gap: .15rem; }
    .step { width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--hs-line); background: var(--hs-surface); font-size: 1.25rem; }
    .step:disabled { opacity: .35; }
    .q { min-width: 2rem; text-align: center; font-weight: 700; }
    .foot { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-top: 1px solid var(--hs-line); padding-top: 1rem; }
    .total { font-size: 1.25rem; font-weight: 750; }
  `,
})
export class ItemOptionsPickerComponent {
  readonly item = input.required<{ id: string; name: string; price: number; optionGroups: ItemOptionGroup[] }>();
  readonly currency = input.required<string>();
  readonly mode = input<'order' | 'preview'>('order');
  readonly initial = input<PickedOptions | null>(null);
  readonly confirmed = output<PickedOptions>();
  readonly closed = output<void>();

  readonly Math = Math;
  readonly selections = signal<OptionSelections>({});
  readonly quantity = signal(1);

  constructor() {
    const init = this.initial();
    if (init) { this.selections.set(init.options); this.quantity.set(init.quantity); }
    else this.selections.set(this.defaultSelections());
  }

  private defaultSelections(): OptionSelections {
    const out: OptionSelections = {};
    for (const g of this.item().optionGroups) {
      const defaults = g.options.filter(o => o.isDefault && o.isAvailable).map(o => o.id);
      if (defaults.length) out[g.id] = g.selectionType === 'single' ? [defaults[0]] : defaults;
    }
    return out;
  }

  isChosen(g: ItemOptionGroup, optionId: string) { return (this.selections()[g.id] ?? []).includes(optionId); }

  hint(g: ItemOptionGroup) {
    const min = g.required ? Math.max(1, g.minSelect ?? 1) : g.minSelect ?? 0;
    const max = g.maxSelect ?? g.options.length;
    return min > 0 ? `Choose ${min === max ? min : min + '–' + max}` : `Choose up to ${max}`;
  }

  toggle(g: ItemOptionGroup, optionId: string) {
    this.selections.update(sel => {
      const current = sel[g.id] ?? [];
      if (g.selectionType === 'single') return { ...sel, [g.id]: current.includes(optionId) && !g.required ? [] : [optionId] };
      const max = g.maxSelect ?? g.options.length;
      if (current.includes(optionId)) return { ...sel, [g.id]: current.filter(x => x !== optionId) };
      if (current.length >= max) return sel; // at the limit; ignore the tap rather than silently bumping something off
      return { ...sel, [g.id]: [...current, optionId] };
    });
  }

  readonly unitPrice = computed(() => {
    let price = this.item().price;
    const sel = this.selections();
    for (const g of this.item().optionGroups) for (const id of sel[g.id] ?? []) {
      const o = g.options.find(x => x.id === id);
      if (o) price += o.priceDelta;
    }
    return Math.max(0, price);
  });

  readonly problem = computed(() => {
    const sel = this.selections();
    for (const g of this.item().optionGroups) {
      const chosen = (sel[g.id] ?? []).filter(id => g.options.some(o => o.id === id && o.isAvailable));
      if (g.selectionType === 'single') { if (g.required && chosen.length === 0) return `Choose an option for "${g.name}".`; }
      else {
        const min = g.required ? Math.max(1, g.minSelect ?? 1) : g.minSelect ?? 0;
        if (chosen.length < min) return `Choose at least ${min} for "${g.name}".`;
      }
    }
    return null;
  });

  confirm() { if (!this.problem()) this.confirmed.emit({ options: this.selections(), quantity: this.quantity() }); }
}
