import { Component, inject, input, output, signal } from '@angular/core';
import { Order, OrderPart } from '../../core/models';
import { AgoPipe, Clock, MoneyPipe, StatusChipComponent, minutesSince } from '../../core/ui';
import { NotifyDialogComponent } from './notify-dialog';
import { OrderActions } from './order-actions';

/** One order on the board: its people, each with a tick and a cash tag, and the next thing to do. */
@Component({
  selector: 'app-order-card',
  imports: [StatusChipComponent, MoneyPipe, AgoPipe, NotifyDialogComponent],
  template: `
    <article class="card-lite order" [class.attn]="o().needsAttention" [class.stale]="o().isStale" [class.ready]="o().status === 'Ready'">
      <header>
        <div>
          <div class="title"><span class="num">#{{ o().number }}</span><strong>{{ o().customerName }}</strong></div>
          <div class="meta">
            {{ o().source ?? 'Direct link' }} · {{ o().createdAtUtc | ago: clock.now() }}
            @if (o().customerPhone) { · <a [href]="'tel:' + o().customerPhone">{{ o().customerPhone }}</a> }
          </div>
        </div>
        <app-status-chip [status]="o().status" />
      </header>

      @if (o().deliveryLocation) { <div class="where"><i class="bi bi-geo-alt" aria-hidden="true"></i> <strong>{{ o().deliveryLocation }}</strong>@if (o().deliveryNote) { <span class="text-muted">, {{ o().deliveryNote }}</span> }</div> }
      <div class="flags">
        @if (o().needsAttention) {
          <span class="chip chip-attn"><i class="bi bi-bell-fill"></i>{{ o().isStale ? 'Not seen for ' + wait() + ' min' : 'Not seen yet' }}</span>
        }
        @if (o().hasLateAddition) { <span class="chip chip-new"><i class="bi bi-person-plus"></i>Added later</span> }
        @if (o().isNotified) { <span class="chip chip-ready"><i class="bi bi-send-check"></i>Notified{{ o().notifiedChannel ? ' · ' + o().notifiedChannel : '' }}</span> }
      </div>

      <div class="progress-line">
        <div class="bar" role="progressbar" [attr.aria-valuenow]="o().readyCount" aria-valuemin="0" [attr.aria-valuemax]="o().activeCount"
             [attr.aria-label]="o().readyCount + ' of ' + o().activeCount + ' ready'"><span [style.transform]="'scaleX(' + pct() / 100 + ')'"></span></div>
        <small>{{ o().readyCount }} of {{ o().activeCount }} ready</small>
      </div>

      <ul class="parts">
        @for (p of o().parts; track p.id) {
          <li class="part" [class.done]="p.isReady" [class.gone]="p.isCancelled">
            @if (!p.isCancelled) {
              <button type="button" class="check" role="checkbox" [attr.aria-checked]="p.isReady" (click)="actions.toggleReady(o(), p)"
                      [attr.aria-label]="(p.isReady ? 'Undo ready: ' : 'Mark ready: ') + p.person"><i class="bi bi-check-lg"></i></button>
            } @else { <span class="check off" aria-hidden="true"><i class="bi bi-x-lg"></i></span> }
            <div class="txt">
              <div class="who"><strong>{{ p.person }}</strong>@if (p.isLateAddition) { <span class="chip chip-new">late</span> }@if (p.isCancelled) { <span class="chip chip-cancelled">removed</span> }</div>
              <div class="items">{{ summary(p) }}</div>
              @if (p.note) { <div class="note"><i class="bi bi-chat-left-text"></i> {{ p.note }}</div> }
            </div>
            @if (!p.isCancelled) {
              <button type="button" class="paid" [class.on]="p.isPaid" (click)="actions.togglePaid(o(), p)"
                      [attr.aria-pressed]="p.isPaid" [attr.aria-label]="(p.isPaid ? 'Paid, tap to undo: ' : 'Tag cash paid: ') + p.person">
                @if (p.isPaid) { <i class="bi bi-cash-coin"></i> Paid } @else { {{ p.subtotal | money: o().currency }} }
              </button>
            }
          </li>
        }
      </ul>

      <footer>
        <div class="total"><span class="text-muted">Total</span> <strong class="money">{{ o().total | money: o().currency }}</strong>
          @if (o().unpaidAmount > 0) { <small class="unpaid">{{ o().unpaidAmount | money: o().currency }} to collect</small> } @else { <small class="paidall"><i class="bi bi-check2"></i> all paid</small> }
        </div>
        <div class="acts">
          @if (o().needsAttention) { <button type="button" class="btn btn-ghost btn-sm" (click)="actions.seen(o())"><i class="bi bi-eye"></i> Seen</button> }
          @if (o().status === 'New') {
            <button type="button" class="btn btn-ghost btn-sm" (click)="actions.markAllReady(o())">All ready</button>
          }
          @if (o().status === 'Ready') {
            @if (!o().isNotified) { <button type="button" class="btn btn-primary btn-sm" (click)="notify.set(true)"><i class="bi bi-send"></i> Notify customer</button> }
            @else { <button type="button" class="btn btn-ghost btn-sm" (click)="notify.set(true)">Notify again</button> }
            <button type="button" class="btn btn-ink btn-sm" (click)="actions.serve(o())"><i class="bi bi-bag-check"></i> Served</button>
          }
          <button type="button" class="btn btn-ghost btn-sm" (click)="details.emit(o())" aria-label="Order details"><i class="bi bi-three-dots"></i></button>
        </div>
      </footer>
    </article>
    @if (notify()) { <app-notify-dialog [order]="o()" (closed)="notify.set(false)" /> }
  `,
  styles: `
    .order { padding: 1rem 1rem .9rem; display: flex; flex-direction: column; gap: .7rem; height: 100%; }
    /* State shows across the whole card, not in a stripe: ready orders take a soft green tint, unseen ones a red ring. */
    .order.ready { background: #f6fbf7; border-color: #bfe3cb; }
    .order.attn { border-color: #d98b86; }
    .order.stale { border-color: var(--hs-attn); }
    .where { font-size: 1rem; }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: .6rem; }
    .title { display: flex; align-items: baseline; gap: .5rem; font-size: 1.1rem; }
    .title .num { color: var(--hs-muted); font-weight: 700; }
    .meta { color: var(--hs-muted); font-size: .84rem; margin-top: .1rem; }
    .flags { display: flex; flex-wrap: wrap; gap: .35rem; }
    .flags:empty { display: none; }
    .progress-line { display: flex; align-items: center; gap: .6rem; }
    .bar { flex: 1; height: 8px; background: #eee8dc; border-radius: 999px; overflow: hidden; }
    .bar span { display: block; height: 100%; width: 100%; background: #22a35a; border-radius: 999px; transform-origin: left; transition: transform .25s ease; }
    @media (prefers-reduced-motion: reduce) { .bar span { transition: none; } }
    .progress-line small { color: var(--hs-muted); font-weight: 600; white-space: nowrap; }
    .parts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .35rem; flex: 1; }
    .part { display: flex; align-items: center; gap: .7rem; padding: .55rem .6rem; border-radius: 12px; background: var(--hs-surface-2); border: 1px solid transparent; }
    .part.done { background: #f0faf3; border-color: #cfe9d8; }
    .part.done .items { text-decoration: line-through; text-decoration-color: rgba(22, 101, 52, .4); }
    .part.gone { opacity: .55; }
    .part.gone .txt { text-decoration: line-through; }
    .check { flex: none; width: 46px; height: 46px; border-radius: 13px; border: 2px solid #cdc4b3; background: #fff; color: transparent; display: grid; place-items: center; font-size: 1.4rem; transition: all .12s; }
    .check:hover { border-color: #22a35a; }
    .part.done .check { background: #22a35a; border-color: #22a35a; color: #fff; }
    .check.off { border-style: dashed; color: #b8ae9b; cursor: default; }
    .txt { flex: 1; min-width: 0; }
    .who { display: flex; align-items: center; gap: .4rem; flex-wrap: wrap; }
    .items { color: #4b443b; font-size: .92rem; }
    .note { color: var(--hs-muted); font-size: .82rem; margin-top: .1rem; }
    .paid { flex: none; min-width: 74px; border-radius: 10px; padding: .4rem .55rem; border: 1px solid var(--hs-line); background: #fff; font-weight: 650; font-size: .85rem; color: var(--hs-ink); font-variant-numeric: tabular-nums; }
    .paid:hover { border-color: var(--hs-paid); }
    .paid.on { background: var(--hs-paid-bg); color: var(--hs-paid); border-color: #99e6d9; }
    footer { display: flex; align-items: center; justify-content: space-between; gap: .6rem; flex-wrap: wrap; padding-top: .55rem; border-top: 1px solid var(--hs-line); }
    .total { display: flex; align-items: baseline; gap: .5rem; flex-wrap: wrap; }
    .total strong { font-size: 1.1rem; }
    .unpaid { color: var(--hs-new); font-weight: 650; }
    .paidall { color: var(--hs-paid); font-weight: 650; }
    .acts { display: flex; gap: .35rem; flex-wrap: wrap; justify-content: flex-end; }
    .btn-ink { background: var(--hs-ink); border-color: var(--hs-ink); color: #fff; }
    .btn-ink:hover { background: #000; color: #fff; }
  `,
})
export class OrderCardComponent {
  readonly o = input.required<Order>();
  readonly details = output<Order>();
  readonly actions = inject(OrderActions);
  readonly clock = inject(Clock);
  readonly notify = signal(false);

  pct() { const o = this.o(); return o.activeCount ? (o.readyCount / o.activeCount) * 100 : 0; }
  wait() { return minutesSince(this.o().createdAtUtc, this.clock.now()); }
  summary(p: OrderPart) {
    return p.lines.map(l => `${l.quantity}× ${l.itemName}${l.options.length ? ` (${l.options.map(o => o.optionName).join(', ')})` : ''}`).join(', ');
  }
}
