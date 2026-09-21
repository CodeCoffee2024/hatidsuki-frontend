import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Order, OrderPart } from '../../core/models';
import { AgoPipe, Clock, MoneyPipe } from '../../core/ui';
import { OrderDetailComponent } from '../orders/order-detail';
import { OrderActions } from './order-actions';
import { OrderCardComponent } from './order-card';
import { BoardStore } from './board.store';

type View = 'orders' | 'people' | 'prep';

/**
 * The working screen. Every open order, oldest first, with each person as a checkbox. The counts at the top and the
 * "not seen" flags exist so an order can never sit unnoticed.
 */
@Component({
  selector: 'app-board',
  imports: [OrderCardComponent, OrderDetailComponent, MoneyPipe, AgoPipe, RouterLink],
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>Orders</h1>
          <p>Tick each person when their order is ready.</p>
        </div>
        <div class="tools">
          <div class="search">
            <i class="bi bi-search" aria-hidden="true"></i>
            <input type="search" class="form-control" placeholder="Name, person, place or #" aria-label="Search open orders" [value]="store.search()" (input)="onSearch($any($event.target).value)">
          </div>
          <button type="button" class="btn btn-ghost" (click)="store.toggleSound()" [attr.aria-pressed]="store.soundOn()"
                  [attr.title]="store.soundOn() ? 'Sound on for new orders' : 'Sound off'"
                  [attr.aria-label]="store.soundOn() ? 'Turn the new-order sound off' : 'Turn the new-order sound on'">
            <i class="bi" [class.bi-bell-fill]="store.soundOn()" [class.bi-bell-slash]="!store.soundOn()"></i>
          </button>
        </div>
      </div>

      @if (store.counters(); as c) {
        <ul class="summary" aria-label="Order counts">
          <li [class.hot]="c.unacknowledged > 0"><strong class="num">{{ c.unacknowledged }}</strong> <span>not seen yet</span></li>
          <li><strong class="num">{{ c.new }}</strong> <span>to prepare</span></li>
          <li><strong class="num">{{ c.readyWaiting }}</strong> <span>ready to hand over</span></li>
          <li><strong class="money">{{ c.cashToCollect | money }}</strong> <span>cash to collect from {{ c.unpaidOrders }} {{ c.unpaidOrders === 1 ? 'order' : 'orders' }}</span></li>
        </ul>
        @if (c.olderOpen > 0) {
          <div class="alert alert-warning" role="status">
            <strong>{{ c.olderOpen }} {{ c.olderOpen === 1 ? 'order' : 'orders' }} from before today {{ c.olderOpen === 1 ? 'is' : 'are' }} still open.</strong>
            Finish or cancel {{ c.olderOpen === 1 ? 'it' : 'them' }} so nothing gets forgotten.
          </div>
        }
      }

      <div class="seg" role="tablist" aria-label="Board view">
        <button type="button" role="tab" [class.on]="view() === 'orders'" [attr.aria-selected]="view() === 'orders'" (click)="view.set('orders')">By order</button>
        <button type="button" role="tab" [class.on]="view() === 'people'" [attr.aria-selected]="view() === 'people'" (click)="view.set('people')">By person</button>
        <button type="button" role="tab" [class.on]="view() === 'prep'" [attr.aria-selected]="view() === 'prep'" (click)="view.set('prep')">What to make</button>
      </div>

      @if (store.loading() && !store.board()) {
        <div class="grid">@for (i of [1, 2, 3]; track i) { <div class="skeleton" style="height: 320px"></div> }</div>
      } @else if (store.error() && !store.board()) {
        <div class="alert alert-danger">{{ store.error() }} <button class="btn btn-sm btn-ghost ms-2" (click)="store.refresh()">Try again</button></div>
      } @else if (store.orders().length === 0) {
        <div class="empty card-lite">
          <h3>{{ store.search() ? 'No open orders match that search' : 'Nothing to prepare right now' }}</h3>
          <p>{{ store.search() ? 'Try a different name, place or order number.' : 'New orders appear here as soon as a customer sends one.' }}</p>
          @if (!store.search()) { <a class="btn btn-primary" routerLink="/app/forms">Get your QR code</a> }
        </div>
      } @else {
        @switch (view()) {
          @case ('orders') {
            <div class="grid">
              @for (o of store.orders(); track o.id) { <app-order-card [o]="o" (details)="selected.set($event)" /> }
            </div>
          }
          @case ('people') {
            <div class="card-lite people">
              @for (r of people(); track r.part.id) {
                <div class="prow" [class.done]="r.part.isReady">
                  <button type="button" class="check" role="checkbox" [attr.aria-checked]="r.part.isReady" (click)="actions.toggleReady(r.order, r.part)" [attr.aria-label]="'Ready: ' + r.part.person"><i class="bi bi-check-lg"></i></button>
                  <div class="txt">
                    <div><strong>{{ r.part.person }}</strong> <span class="text-muted">#{{ r.order.number }}, {{ r.order.customerName }}@if (r.order.deliveryLocation) { , {{ r.order.deliveryLocation }} }</span>
                      @if (r.part.isLateAddition) { <span class="chip chip-new">Added later</span> }</div>
                    <div class="items">{{ summary(r.part) }}</div>
                  </div>
                  <span class="text-muted small">{{ r.order.createdAtUtc | ago: clock.now() }}</span>
                  <button type="button" class="paid" [class.on]="r.part.isPaid" (click)="actions.togglePaid(r.order, r.part)">{{ r.part.isPaid ? 'Paid' : (r.part.subtotal | money: r.order.currency) }}</button>
                </div>
              }
            </div>
          }
          @case ('prep') {
            <div class="card-lite prep">
              <p class="text-muted px-3 pt-3 mb-1">Everything still to make across all open orders. People already ticked are left out.</p>
              @for (l of store.board()!.prep; track l.item) {
                <div class="prep-row"><strong class="q num">{{ l.quantity }}×</strong><span class="n">{{ l.item }}</span><span class="text-muted">for {{ l.people }} {{ l.people === 1 ? 'person' : 'people' }}</span></div>
              } @empty { <div class="empty"><h3>Everything is ready</h3></div> }
            </div>
          }
        }
      }
    </div>

    @if (selected(); as s) { <app-order-detail [orderId]="s.id" (closed)="selected.set(null)" /> }
  `,
  styles: `
    .tools { display: flex; gap: .5rem; align-items: center; }
    .search { position: relative; }
    .search .bi { position: absolute; left: .8rem; top: 50%; transform: translateY(-50%); color: var(--hs-muted); }
    .search .form-control { padding-left: 2.2rem; min-width: 250px; }
    .summary { list-style: none; margin: 0 0 1.25rem; padding: .85rem 0; display: flex; flex-wrap: wrap; gap: .35rem 2rem; border-block: 1px solid var(--hs-line); }
    .summary li { display: flex; align-items: baseline; gap: .4rem; }
    .summary strong { font-size: 1.25rem; font-weight: 750; }
    .summary span { color: var(--hs-muted); }
    .summary .hot strong, .summary .hot span { color: var(--hs-attn); }
    .summary .hot span { font-weight: 600; }
    .seg { display: inline-flex; background: #e9e4d8; padding: 3px; border-radius: 9px; margin: 0 0 1.1rem; gap: 2px; }
    .seg button { border: 0; background: transparent; padding: .4rem .95rem; border-radius: 7px; font-weight: 600; color: var(--hs-muted); }
    .seg button.on { background: var(--hs-surface); color: var(--hs-ink); box-shadow: 0 1px 2px rgba(27, 25, 21, .16); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: 1rem; align-items: stretch; }
    .people { padding: .35rem; }
    .prow { display: flex; align-items: center; gap: .8rem; padding: .65rem .7rem; }
    .prow + .prow { border-top: 1px solid var(--hs-line); }
    .prow.done { background: #f1f9f3; }
    .prow .txt { flex: 1; min-width: 0; }
    .items { color: #4b453c; font-size: .92rem; }
    .check { flex: none; width: 46px; height: 46px; border-radius: 10px; border: 2px solid #c3bbab; background: var(--hs-surface); color: transparent; display: grid; place-items: center; font-size: 1.4rem; }
    .prow.done .check { background: #1f8a4c; border-color: #1f8a4c; color: #fff; }
    .paid { flex: none; min-width: 74px; border-radius: 8px; padding: .4rem .55rem; border: 1px solid var(--hs-line-strong); background: var(--hs-surface); font-weight: 650; font-size: .85rem; font-variant-numeric: tabular-nums; }
    .paid.on { background: var(--hs-paid-bg); color: var(--hs-paid); border-color: #93d6cd; }
    .prep-row { display: flex; align-items: baseline; gap: .8rem; padding: .7rem 1rem; border-top: 1px solid var(--hs-line); }
    .prep-row .q { font-size: 1.5rem; min-width: 3.6rem; }
    .prep-row .n { font-size: 1.08rem; font-weight: 650; flex: 1; }
    @media (max-width: 600px) { .search .form-control { min-width: 0; width: 100%; } .tools { width: 100%; } .search { flex: 1; } }
  `,
})
export class BoardComponent {
  readonly store = inject(BoardStore);
  readonly actions = inject(OrderActions);
  readonly clock = inject(Clock);

  readonly view = signal<View>('orders');
  readonly selected = signal<Order | null>(null);
  private debounce: ReturnType<typeof setTimeout> | null = null;

  /** Every person across all open orders, those still to prepare first: a flat checklist. */
  readonly people = computed(() => this.store.orders()
    .flatMap(order => order.parts.filter(p => !p.isCancelled).map(part => ({ order, part })))
    .sort((a, b) => Number(a.part.isReady) - Number(b.part.isReady)));

  summary(p: OrderPart) { return p.lines.map(l => `${l.quantity}× ${l.itemName}`).join(', '); }

  onSearch(value: string) {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.store.setSearch(value.trim()), 250);
  }
}
