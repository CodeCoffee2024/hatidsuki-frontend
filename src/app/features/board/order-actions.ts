import { Injectable, inject } from '@angular/core';
import { OrdersApi } from '../../core/api';
import { errorMessage } from '../../core/http';
import { Order, OrderPart } from '../../core/models';
import { ToastService } from '../../core/ui';
import { BoardStore } from './board.store';

/**
 * Everything staff do to an order. Ticks and paid tags show instantly (optimistic), then the server's answer replaces
 * the local copy; if saving fails the screen is refreshed to the truth and a message explains what happened.
 */
@Injectable({ providedIn: 'root' })
export class OrderActions {
  private readonly api = inject(OrdersApi);
  private readonly store = inject(BoardStore);
  private readonly toast = inject(ToastService);

  /** Set by whichever screen shows an order in detail, so it can refresh itself from any action. */
  onUpdated: ((o: Order) => void) | null = null;

  async toggleReady(o: Order, p: OrderPart) {
    this.optimistic(o.id, ord => {
      const part = ord.parts.find(x => x.id === p.id);
      if (part) { part.isReady = !p.isReady; ord.readyCount += part.isReady ? 1 : -1; }
    });
    return this.run(() => this.api.partReady(o.id, p.id, !p.isReady));
  }

  async togglePaid(o: Order, p: OrderPart) {
    this.optimistic(o.id, ord => {
      const part = ord.parts.find(x => x.id === p.id);
      if (part) { part.isPaid = !p.isPaid; ord.paidCount += part.isPaid ? 1 : -1; }
    });
    return this.run(() => this.api.partPaid(o.id, p.id, !p.isPaid));
  }

  markAllReady(o: Order) { return this.run(() => this.api.readyAll(o.id)); }
  payAll(o: Order, paid: boolean) { return this.run(() => this.api.orderPaid(o.id, paid)); }
  seen(o: Order) { return this.run(() => this.api.acknowledge(o.id)); }
  serve(o: Order) { return this.run(() => this.api.serve(o.id), 'Marked as served.'); }
  cancel(o: Order, reason: string) { return this.run(() => this.api.cancel(o.id, reason), 'Order cancelled.'); }
  cancelPart(o: Order, p: OrderPart, reason: string) { return this.run(() => this.api.cancelPart(o.id, p.id, reason), `${p.person} removed.`); }
  notified(o: Order, channel: string | null, undo = false) { return this.run(() => this.api.notified(o.id, channel, undo)); }

  private optimistic(orderId: string, mutate: (o: Order) => void) {
    this.store.board.update(b => {
      if (!b) return b;
      return { ...b, orders: b.orders.map(o => { if (o.id !== orderId) return o; const copy = structuredClone(o); mutate(copy); return copy; }) };
    });
  }

  private async run(call: () => Promise<Order>, okMessage?: string): Promise<Order | undefined> {
    try {
      const updated = await call();
      this.store.replace(updated);
      this.onUpdated?.(updated);
      if (okMessage) this.toast.show(okMessage);
      return updated;
    } catch (e) {
      this.toast.error(errorMessage(e));
      await this.store.refresh();
      return undefined;
    }
  }
}
