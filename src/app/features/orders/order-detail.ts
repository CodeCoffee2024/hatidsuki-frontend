import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogApi, OrdersApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/http';
import { Order, OrderLine, OrderPart, PublicItem } from '../../core/models';
import { MoneyPipe, StatusChipComponent, ToastService } from '../../core/ui';
import { NotifyDialogComponent } from '../board/notify-dialog';
import { OrderActions } from '../board/order-actions';
import { ModalComponent } from '../../shared/modal';
import { OrderPickerComponent, PickerState } from '../../shared/order-picker';

/** Slide-in panel with everything about one order. Opening a new order also counts as "seen". */
@Component({
  selector: 'app-order-detail',
  imports: [DatePipe, FormsModule, MoneyPipe, StatusChipComponent, ModalComponent, NotifyDialogComponent, OrderPickerComponent],
  template: `
    <div class="scrim" (click)="closed.emit()"></div>
    <aside class="drawer" role="dialog" aria-modal="true" aria-label="Order details">
      @if (order(); as o) {
        <header>
          <div>
            <div class="title"><span class="num">#{{ o.number }}</span> <strong>{{ o.customerName }}</strong></div>
            <div class="text-muted small">{{ o.createdAtUtc | date: 'medium' }} · {{ o.source ?? 'Direct link' }}</div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <app-status-chip [status]="o.status" />
            <button type="button" class="btn btn-ghost btn-sm" (click)="print()" aria-label="Print ticket" title="Print ticket"><i class="bi bi-printer"></i></button>
            <button type="button" class="btn-close" aria-label="Close" (click)="closed.emit()"></button>
          </div>
        </header>

        <div class="scroll">
          @if (o.deliveryLocation) { <p class="where"><strong>Deliver to</strong> {{ o.deliveryLocation }}@if (o.deliveryNote) { <span>, {{ o.deliveryNote }}</span> }</p> }
          <section class="contact">
            @if (o.customerPhone) { <a class="btn btn-ghost btn-sm" [href]="'tel:' + o.customerPhone"><i class="bi bi-telephone"></i> {{ o.customerPhone }}</a> }
            @if (o.customerEmail) { <a class="btn btn-ghost btn-sm" [href]="'mailto:' + o.customerEmail"><i class="bi bi-envelope"></i> {{ o.customerEmail }}</a> }
            @if (o.isNotified) { <span class="chip chip-ready"><i class="bi bi-send-check"></i> Notified{{ o.notifiedChannel ? ' via ' + o.notifiedChannel : '' }}</span> }
            @if (o.channel === 'Staff') { <span class="chip chip-muted">Entered by staff</span> }
          </section>

          <h3>People <small>{{ o.readyCount }} of {{ o.activeCount }} ready · {{ o.paidCount }} of {{ o.activeCount }} paid</small></h3>
          <ul class="parts">
            @for (p of o.parts; track p.id) {
              <li class="part" [class.done]="p.isReady" [class.gone]="p.isCancelled">
                <div class="row1">
                  @if (!p.isCancelled && isOpen(o)) {
                    <button type="button" class="check" role="checkbox" [attr.aria-checked]="p.isReady" (click)="actions.toggleReady(o, p)" [attr.aria-label]="'Ready: ' + p.person"><i class="bi bi-check-lg"></i></button>
                  }
                  <div class="txt">
                    <strong>{{ p.person }}</strong>
                    @if (p.isLateAddition) { <span class="chip chip-new">added later</span> }
                    @if (p.isCancelled) { <span class="chip chip-cancelled">removed · {{ p.cancelReason }}</span> }
                    <ul class="lines">@for (l of p.lines; track $index) {
                      <li><span class="num">{{ l.quantity }}×</span> {{ l.itemName }}@if (l.options.length) { <span class="text-muted"> ({{ optionNames(l) }})</span> } <span class="text-muted money">{{ l.lineTotal | money: o.currency }}</span></li>
                    }</ul>
                    @if (p.note) { <div class="text-muted small"><i class="bi bi-chat-left-text"></i> {{ p.note }}</div> }
                  </div>
                  @if (!p.isCancelled) {
                    <div class="side">
                      <button type="button" class="paid" [class.on]="p.isPaid" (click)="actions.togglePaid(o, p)" [attr.aria-pressed]="p.isPaid">
                        @if (p.isPaid) { <i class="bi bi-cash-coin"></i> Paid } @else { {{ p.subtotal | money: o.currency }} }
                      </button>
                      @if (isOpen(o) && o.activeCount > 1) { <button type="button" class="btn btn-link btn-sm text-danger p-0" (click)="removing.set(p.id)">Remove</button> }
                    </div>
                  }
                </div>
                @if (removing() === p.id) {
                  <div class="inline-remove">
                    <input class="form-control form-control-sm" placeholder="Why? (optional)" [(ngModel)]="reason" aria-label="Reason for removing {{ p.person }}">
                    <button type="button" class="btn btn-sm btn-danger" (click)="removePart(o, p)">Remove {{ p.person }}</button>
                    <button type="button" class="btn btn-sm btn-ghost" (click)="removing.set(null)">Keep</button>
                  </div>
                }
              </li>
            }
          </ul>

          <div class="totals">
            <span>Total</span><strong class="money">{{ o.total | money: o.currency }}</strong>
            @if (o.unpaidAmount > 0) { <span class="text-muted">{{ o.unpaidAmount | money: o.currency }} still to collect</span> }
          </div>

          @if (isOpen(o)) {
            <div class="add">
              @if (!adding()) {
                <button type="button" class="btn btn-ghost w-100" (click)="startAdd()"><i class="bi bi-person-plus"></i> Add another person to this order</button>
              } @else {
                <h4>Add a person</h4>
                <app-order-picker [items]="items()" [currency]="o.currency" [allowGroup]="false" (changed)="picked.set($event)" />
                <label class="form-label mt-3" for="late-name">Who is it for?</label>
                <input id="late-name" class="form-control" [(ngModel)]="lateName" maxlength="60" placeholder="e.g. Carlo">
                <div class="d-flex gap-2 mt-3">
                  <button type="button" class="btn btn-primary" [disabled]="!canAdd()" (click)="addLate(o)">Add to order</button>
                  <button type="button" class="btn btn-ghost" (click)="adding.set(false)">Cancel</button>
                </div>
              }
            </div>
          }

          @if (o.answers?.length) {
            <h3>Form answers</h3>
            <dl class="answers">@for (a of o.answers; track $index) { <dt>{{ a.label }}</dt><dd>{{ a.values.join(', ') }}</dd> }</dl>
          }

          <h3>History</h3>
          <ol class="timeline">
            @for (e of o.events; track $index) {
              <li><time>{{ e.atUtc | date: 'shortTime' }}</time> <span>{{ e.message }}</span> @if (e.by && e.by !== 'customer') { <small class="text-muted">by {{ e.by }}</small> }</li>
            }
          </ol>
        </div>

        @if (isOpen(o)) {
          <footer>
            <button type="button" class="btn btn-ghost" (click)="actions.payAll(o, o.paymentStatus !== 'Paid')"><i class="bi bi-cash-coin"></i> {{ o.paymentStatus === 'Paid' ? 'Undo paid' : 'Everyone paid' }}</button>
            @if (o.status === 'New') { <button type="button" class="btn btn-ghost" (click)="actions.markAllReady(o)">All ready</button> }
            <button type="button" class="btn btn-ghost" (click)="notify.set(true)"><i class="bi bi-send"></i> Notify</button>
            <button type="button" class="btn btn-ink ms-auto" (click)="actions.serve(o)"><i class="bi bi-bag-check"></i> Served</button>
            <button type="button" class="btn btn-outline-danger" (click)="cancelling.set(true)">Cancel order</button>
          </footer>
        }
      } @else if (error()) {
        <div class="p-4"><div class="alert alert-danger">{{ error() }}</div></div>
      } @else {
        <div class="p-4"><div class="skeleton" style="height: 260px"></div></div>
      }
    </aside>

    <!-- Print only: a clean ticket, one section per person, independent of the on-screen panel's fixed layout. -->
    @if (order(); as o) {
      <div class="ticket">
        <header><strong>{{ auth.user()?.workspaceName }}</strong><span>Order #{{ o.number }} · {{ o.createdAtUtc | date: 'medium' }}</span></header>
        <p>{{ o.customerName }}@if (o.customerPhone) { · {{ o.customerPhone }} }@if (o.source) { · {{ o.source }} }</p>
        @if (o.deliveryLocation) { <p><strong>Deliver to:</strong> {{ o.deliveryLocation }}@if (o.deliveryNote) { , {{ o.deliveryNote }} }</p> }
        @for (p of o.parts; track p.id) {
          @if (!p.isCancelled) {
            <section class="tperson">
              <h4>{{ p.person }}@if (p.isPaid) { <span> · Paid</span> }</h4>
              <ul>
                @for (l of p.lines; track $index) {
                  <li><span>{{ l.quantity }}× {{ l.itemName }}@if (l.options.length) { <em> ({{ optionNames(l) }})</em> }@if (l.note) { <br><small>{{ l.note }}</small> }</span><span>{{ l.lineTotal | money: o.currency }}</span></li>
                }
              </ul>
              @if (p.note) { <p class="pnote">Note: {{ p.note }}</p> }
              <p class="psub">Subtotal: {{ p.subtotal | money: o.currency }}</p>
            </section>
          }
        }
        <footer><strong>Total: {{ o.total | money: o.currency }}</strong><span>{{ o.paymentStatus === 'Paid' ? 'Paid' : 'Cash on pickup' }}</span></footer>
      </div>
    }

    @if (cancelling() && order(); as o) {
      <app-modal heading="Cancel this order?" (closed)="cancelling.set(false)">
        <p>This releases everything on order #{{ o.number }}. It can’t be undone.</p>
        <label class="form-label" for="reason">Reason (optional)</label>
        <input id="reason" class="form-control" [(ngModel)]="reason" maxlength="200" placeholder="e.g. customer called to cancel">
        <div class="d-flex gap-2 mt-3 justify-content-end">
          <button type="button" class="btn btn-ghost" (click)="cancelling.set(false)">Keep order</button>
          <button type="button" class="btn btn-danger" (click)="cancelOrder(o)">Cancel order</button>
        </div>
      </app-modal>
    }
    @if (notify() && order(); as o) { <app-notify-dialog [order]="o" (closed)="notify.set(false)" /> }
  `,
  styles: `
    .ticket { display: none; }
    @media print {
      .scrim, .drawer { display: none !important; }
      .ticket { display: block; font-size: 13px; color: #000; max-width: 340px; margin: 0 auto; }
      .ticket header { display: flex; flex-direction: column; gap: .1rem; border-bottom: 1px dashed #000; padding-bottom: .5rem; margin-bottom: .5rem; }
      .ticket header strong { font-size: 1.1rem; }
      .tperson { break-inside: avoid; break-after: page; padding-top: .3rem; }
      .tperson:last-of-type { break-after: auto; }
      .tperson h4 { margin: .4rem 0; font-size: 1rem; border-bottom: 1px solid #000; padding-bottom: .2rem; }
      .tperson ul { list-style: none; margin: 0; padding: 0; }
      .tperson li { display: flex; justify-content: space-between; gap: .5rem; padding: .15rem 0; }
      .pnote, .psub { margin: .3rem 0 0; }
      .ticket footer { display: flex; justify-content: space-between; margin-top: .6rem; padding-top: .4rem; border-top: 1px dashed #000; font-size: 1.05rem; }
    }
    .scrim { position: fixed; inset: 0; background: rgba(31, 27, 22, .45); z-index: 1030; }
    .drawer { position: fixed; z-index: 1035; top: 0; right: 0; bottom: 0; width: min(100%, 580px); background: var(--hs-bg); display: flex; flex-direction: column; box-shadow: -12px 0 40px rgba(0,0,0,.2); }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 1rem 1.25rem; background: var(--hs-surface); border-bottom: 1px solid var(--hs-line); }
    .title { font-size: 1.2rem; } .title .num { color: var(--hs-muted); }
    .scroll { flex: 1; overflow: auto; padding: 1rem 1.25rem 1.5rem; }
    .where { margin: 0 0 .75rem; font-size: 1.02rem; }
    .contact { display: flex; flex-wrap: wrap; gap: .4rem; margin-bottom: .5rem; }
    h3 { font-size: .98rem; color: var(--hs-ink); margin: 1.5rem 0 .5rem; font-weight: 700; }
    h3 small { font-weight: 400; color: var(--hs-muted); margin-left: .5rem; }
    h4 { font-size: 1rem; font-weight: 700; }
    .parts { list-style: none; margin: 0; padding: 0; display: grid; gap: .5rem; }
    .part { background: var(--hs-surface); border: 1px solid var(--hs-line); border-radius: 12px; padding: .7rem .8rem; }
    .part.done { background: #f0faf3; border-color: #cfe9d8; }
    .part.gone { opacity: .55; }
    .row1 { display: flex; gap: .7rem; align-items: flex-start; }
    .check { flex: none; width: 44px; height: 44px; border-radius: 12px; border: 2px solid #cdc4b3; background: #fff; color: transparent; display: grid; place-items: center; font-size: 1.3rem; }
    .part.done .check { background: #22a35a; border-color: #22a35a; color: #fff; }
    .txt { flex: 1; min-width: 0; }
    .lines { list-style: none; padding: 0; margin: .2rem 0 0; font-size: .92rem; }
    .lines li { display: flex; gap: .4rem; }
    .lines .money { margin-left: auto; }
    .side { display: flex; flex-direction: column; align-items: flex-end; gap: .3rem; }
    .paid { min-width: 76px; border-radius: 10px; padding: .4rem .55rem; border: 1px solid var(--hs-line); background: #fff; font-weight: 650; font-size: .85rem; font-variant-numeric: tabular-nums; }
    .paid.on { background: var(--hs-paid-bg); color: var(--hs-paid); border-color: #99e6d9; }
    .inline-remove { display: flex; gap: .4rem; margin-top: .6rem; flex-wrap: wrap; }
    .inline-remove .form-control { flex: 1; min-width: 160px; }
    .totals { display: flex; align-items: baseline; gap: .8rem; margin-top: 1rem; padding-top: .8rem; border-top: 1px solid var(--hs-line); flex-wrap: wrap; }
    .totals strong { font-size: 1.3rem; }
    .add { margin-top: 1rem; padding: 1rem; background: var(--hs-surface); border: 1px dashed #cfc6b6; border-radius: 12px; }
    .answers { display: grid; grid-template-columns: max-content 1fr; gap: .3rem 1rem; margin: 0; }
    .answers dt { color: var(--hs-muted); font-weight: 500; } .answers dd { margin: 0; }
    .timeline { list-style: none; margin: 0; padding: 0 0 0 .3rem; border-left: 2px solid var(--hs-line); display: grid; gap: .5rem; }
    .timeline li { padding-left: .9rem; position: relative; font-size: .92rem; }
    .timeline li::before { content: ''; position: absolute; left: -.42rem; top: .45rem; width: 9px; height: 9px; border-radius: 50%; background: #cdc4b3; }
    .timeline time { color: var(--hs-muted); font-variant-numeric: tabular-nums; margin-right: .4rem; }
    footer { display: flex; gap: .5rem; flex-wrap: wrap; padding: .8rem 1.25rem; background: var(--hs-surface); border-top: 1px solid var(--hs-line); }
    .btn-ink { background: var(--hs-ink); border-color: var(--hs-ink); color: #fff; } .btn-ink:hover { background: #000; color: #fff; }
  `,
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  readonly orderId = input.required<string>();
  readonly closed = output<void>();

  readonly actions = inject(OrderActions);
  readonly auth = inject(AuthService);
  private readonly api = inject(OrdersApi);
  private readonly catalog = inject(CatalogApi);
  private readonly toast = inject(ToastService);

  readonly order = signal<Order | null>(null);
  readonly error = signal<string | null>(null);
  readonly removing = signal<string | null>(null);
  readonly cancelling = signal(false);
  readonly notify = signal(false);
  readonly adding = signal(false);
  readonly items = signal<PublicItem[]>([]);
  readonly picked = signal<PickerState | null>(null);
  reason = '';
  lateName = '';

  async ngOnInit() {
    // Any action taken here (or from the board) refreshes this panel from the server's answer.
    this.actions.onUpdated = o => { if (o.id === this.orderId()) this.order.set(o); };
    try {
      let o = await this.api.get(this.orderId());
      if (o.needsAttention) o = (await this.api.acknowledge(o.id)) ?? o;
      this.order.set(o);
    } catch (e) { this.error.set(errorMessage(e)); }
  }

  ngOnDestroy() { this.actions.onUpdated = null; }

  isOpen(o: Order) { return o.status === 'New' || o.status === 'Ready'; }
  optionNames(l: OrderLine) { return l.options.map(o => o.optionName).join(', '); }
  print() { window.print(); }

  async startAdd() {
    this.adding.set(true);
    if (this.items().length === 0) {
      const all = await this.catalog.items();
      this.items.set(all.filter(i => !i.isArchived).map(i => ({
        id: i.id, name: i.name, description: i.description, price: i.price, category: i.category, unit: i.unit,
        isAvailable: i.isAvailable, optionGroups: i.optionGroups,
      })));
    }
  }

  canAdd() { return (this.picked()?.itemCount ?? 0) > 0; }

  async addLate(o: Order) {
    const parts = this.picked()?.parts ?? [];
    const lines = parts.flatMap(p => p.lines);
    try {
      const updated = await this.api.addPart(o.id, { person: this.lateName.trim() || 'Late addition', lines });
      this.order.set(updated);
      this.adding.set(false); this.lateName = '';
      this.toast.show('Person added. The board will highlight it.');
    } catch (e) { this.toast.error(errorMessage(e)); }
  }

  async removePart(o: Order, p: OrderPart) {
    await this.actions.cancelPart(o, p, this.reason || 'Removed by staff');
    this.removing.set(null); this.reason = '';
  }

  async cancelOrder(o: Order) {
    await this.actions.cancel(o, this.reason || 'No reason given');
    this.cancelling.set(false); this.reason = '';
  }
}
