import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { PublicApi } from '../../core/api';
import { errorMessage } from '../../core/http';
import { Tracking } from '../../core/models';
import { MoneyPipe } from '../../core/ui';

/** A customer's own view of their order. It updates by itself, so they can stop asking "is it ready yet?". */
@Component({
  selector: 'app-tracking',
  imports: [MoneyPipe],
  template: `
    <div class="wrap">
      @if (t(); as o) {
        <div class="biz">{{ o.businessName }}</div>
        <section class="status" [class]="'s-' + o.status.toLowerCase()" role="status" aria-live="polite">
          
          <div>
            <h1>{{ headline(o) }}</h1>
            <p>Order #{{ o.number }}@if (o.status === 'New' && o.activeCount > 1) { · {{ o.readyCount }} of {{ o.activeCount }} people’s orders ready }</p>
          </div>
        </section>

        @if (o.deliveryTo) { <p class="deliver">Delivering to <strong>{{ o.deliveryTo }}</strong>@if (o.deliveryNote) { <span>, {{ o.deliveryNote }}</span> }.</p> }
        @if (o.status === 'New' || o.status === 'Ready') {
          <div class="bar" role="progressbar" [attr.aria-valuenow]="o.readyCount" aria-valuemin="0" [attr.aria-valuemax]="o.activeCount" aria-label="Order progress"><span [style.transform]="progress(o)"></span></div>
        }

        <ul class="people card-lite">
          @for (p of o.people; track $index) {
            <li [class.done]="p.isReady" [class.gone]="p.isCancelled">
              <span class="dot"><i class="bi" [class.bi-check-lg]="p.isReady" [class.bi-x-lg]="p.isCancelled"></i></span>
              <div><strong>{{ p.person }}</strong>@if (p.isCancelled) { <span class="text-muted">, removed</span> }<div class="text-muted small">{{ p.items.join(', ') }}</div></div>
              @if (o.activeCount > 1 && !p.isCancelled) { <span class="chip" [class.chip-ready]="p.isReady" [class.chip-new]="!p.isReady">{{ p.isReady ? 'Ready' : 'Preparing' }}</span> }
            </li>
          }
        </ul>

        <div class="total card-lite">
          <span class="text-muted">Total</span><strong class="money">{{ o.total | money: o.currency }}</strong>
          <span class="chip" [class.chip-paid]="o.paymentStatus === 'Paid'" [class.chip-unpaid]="o.paymentStatus !== 'Paid'">{{ o.paymentStatus === 'Paid' ? 'Paid' : o.paymentStatus === 'PartlyPaid' ? 'Partly paid' : 'Pay on pickup' }}</span>
        </div>
        @if (o.paymentMessage && o.paymentStatus !== 'Paid') { <p class="text-muted text-center"><i class="bi bi-cash-coin"></i> {{ o.paymentMessage }}</p> }
        <p class="text-center text-muted small">This page updates by itself. Last change {{ updated() }}.</p>
      } @else if (error()) {
        <div class="state"><i class="bi bi-search"></i><h1>We couldn’t find that order</h1><p>{{ error() }}</p></div>
      } @else {
        <div class="skeleton" style="height: 120px; margin-bottom: 1rem"></div><div class="skeleton" style="height: 240px"></div>
      }
    </div>`,
  styles: `
    :host { display: block; min-height: 100vh; background: var(--hs-bg); }
    .wrap { max-width: 560px; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
    .biz { font-weight: 800; font-size: 1.15rem; margin-bottom: 1rem; }
    .status { display: flex; gap: 1rem; align-items: center; padding: 1.1rem 1.25rem; border-radius: 10px; margin-bottom: 1rem; }
    .status h1 { font-size: 1.45rem; font-weight: 750; margin: 0; } .deliver { margin: 0 0 1rem; } .status p { margin: .15rem 0 0; }
    .s-new { background: var(--hs-new-bg); color: var(--hs-new); } .s-ready { background: var(--hs-ready-bg); color: var(--hs-ready); }
    .s-served { background: var(--hs-served-bg); color: var(--hs-served); } .s-cancelled { background: var(--hs-cancel-bg); color: var(--hs-cancel); }
    .bar { height: 10px; background: #e8e1d3; border-radius: 999px; overflow: hidden; margin-bottom: 1rem; } .bar span { display: block; height: 100%; width: 100%; background: #22a35a; transform-origin: left; transition: transform .4s; }
    @media (prefers-reduced-motion: reduce) { .bar span { transition: none; } }
    .people { list-style: none; margin: 0 0 1rem; padding: .4rem; }
    .people li { display: flex; align-items: center; gap: .8rem; padding: .7rem .6rem; } .people li + li { border-top: 1px solid var(--hs-line); }
    .people li div { flex: 1; min-width: 0; } .people li.gone { opacity: .55; }
    .dot { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #cdc4b3; display: grid; place-items: center; color: #fff; flex: none; }
    li.done .dot { background: #22a35a; border-color: #22a35a; }
    .total { display: flex; align-items: center; gap: .8rem; padding: .9rem 1rem; margin-bottom: 1rem; } .total strong { font-size: 1.35rem; margin-right: auto; }
    .state { padding: 2.5rem 0; } .state .bi { display: none; }
  `,
})
export class TrackingComponent implements OnInit, OnDestroy {
  readonly token = input.required<string>();
  private readonly api = inject(PublicApi);
  readonly t = signal<Tracking | null>(null);
  readonly error = signal<string | null>(null);
  private timer: ReturnType<typeof setInterval> | null = null;

  async ngOnInit() {
    await this.load();
    this.timer = setInterval(() => { if (!document.hidden) void this.load(); }, 15000);
  }
  ngOnDestroy() { if (this.timer) clearInterval(this.timer); }

  private async load() {
    try { this.t.set(await this.api.track(this.token())); this.error.set(null); }
    catch (e) { if (!this.t()) this.error.set(e instanceof HttpErrorResponse && e.status === 404 ? 'The link may be mistyped.' : errorMessage(e)); }
  }

  /** Scaling (not resizing) keeps the progress animation off the layout path. */
  progress(o: Tracking) { return `scaleX(${o.activeCount ? o.readyCount / o.activeCount : 0})`; }

  headline(o: Tracking) {
    return ({ New: 'We’re preparing your order', Ready: 'Your order is ready', Served: 'Picked up. Thanks for ordering.', Cancelled: 'This order was cancelled' } as Record<string, string>)[o.status] ?? o.status;
  }
  icon(o: Tracking) { return ({ New: 'bi-hourglass-split', Ready: 'bi-bag-check-fill', Served: 'bi-emoji-smile', Cancelled: 'bi-x-circle' } as Record<string, string>)[o.status] ?? 'bi-circle'; }
  updated() { const m = Math.max(0, Math.round((Date.now() - new Date(this.t()!.updatedAtUtc).getTime()) / 60000)); return m < 1 ? 'just now' : `${m} min ago`; }
}
