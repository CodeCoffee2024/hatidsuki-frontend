import { Component, computed, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PublicLocation } from '../core/models';

const SEARCH_ABOVE = 8;

/**
 * Where should we deliver? Every order form asks this.
 * All places are shown at once as large tap targets, each with its note, so a customer on a phone chooses in one tap.
 * A long list gets a search box above it. A dropdown would hide the choices and need two taps for the same result.
 */
@Component({
  selector: 'app-location-picker',
  imports: [FormsModule],
  template: `
    <fieldset class="picker" [class.bad]="!!error()">
      <legend>Where should we deliver?<span class="req" aria-hidden="true"> *</span></legend>

      @if (locations().length > searchAbove) {
        <input type="search" class="form-control mb-2" placeholder="Search {{ locations().length }} locations" aria-label="Search delivery locations"
               [ngModel]="query()" (ngModelChange)="query.set($event)" name="locationSearch">
      }

      <div class="options" role="radiogroup" aria-label="Delivery location">
        @for (l of shown(); track l.id) {
          <label class="option" [class.on]="value() === l.id">
            <input type="radio" name="deliveryLocation" [value]="l.id" [checked]="value() === l.id" (change)="value.set(l.id)">
            <span class="dot" aria-hidden="true"></span>
            <span class="text"><strong>{{ l.name }}</strong>@if (l.note) { <small>{{ l.note }}</small> }</span>
          </label>
        } @empty {
          <p class="none">No location matches “{{ query() }}”.</p>
        }
      </div>

      <label class="detail-label" for="deliveryNote">Room, floor or landmark <span class="opt">(optional)</span></label>
      <input id="deliveryNote" name="deliveryNote" class="form-control" maxlength="200" autocomplete="off"
             placeholder="For example: Room 402, or by the blue door" [ngModel]="note()" (ngModelChange)="note.set($event)">

      @if (error()) { <div class="field-error" role="alert">{{ error() }}</div> }
    </fieldset>
  `,
  styles: `
    :host { display: block; }
    .picker { border: 0; padding: 0; margin: 0; min-width: 0; }
    legend { font-size: 1.1rem; font-weight: 700; padding: 0; margin-bottom: .6rem; float: none; width: auto; }
    .req { color: var(--hs-attn); }
    .options { display: grid; gap: .5rem; margin-bottom: .9rem; }
    .option { position: relative; display: flex; align-items: center; gap: .8rem; padding: .8rem .95rem; min-height: 56px; background: var(--hs-surface);
      border: 1px solid var(--hs-line-strong); border-radius: var(--hs-radius-sm); cursor: pointer; }
    .option:hover { border-color: var(--hs-ink); }
    .option.on { border-color: var(--hs-ink); box-shadow: inset 0 0 0 1px var(--hs-ink); background: #fff; }
    .option input { position: absolute; opacity: 0; inset: 0; cursor: pointer; }
    .option:has(input:focus-visible) { outline: 2px solid var(--hs-primary); outline-offset: 2px; }
    .dot { flex: none; width: 20px; height: 20px; border-radius: 50%; border: 2px solid #a9a193; background: #fff; }
    .option.on .dot { border-color: var(--hs-ink); background: radial-gradient(circle, var(--hs-ink) 0 45%, #fff 50%); }
    .text { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
    .text small { color: var(--hs-muted); font-size: .85rem; }
    .none { color: var(--hs-muted); margin: .25rem 0 1rem; }
    .detail-label { font-weight: 600; font-size: .92rem; margin-bottom: .3rem; display: block; }
    .opt { font-weight: 400; color: var(--hs-muted); }
    .bad .option:not(.on) { border-color: #d9a29e; }
  `,
})
export class LocationPickerComponent {
  readonly locations = input.required<PublicLocation[]>();
  readonly error = input<string | null>(null);
  /** The chosen location's id. */
  readonly value = model<string | null>(null);
  readonly note = model('');

  readonly searchAbove = SEARCH_ABOVE;
  readonly query = signal('');
  readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.locations().filter(l => l.name.toLowerCase().includes(q) || (l.note ?? '').toLowerCase().includes(q)) : this.locations();
  });
}
