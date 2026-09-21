import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { OrdersApi } from '../../core/api';
import { errorMessage } from '../../core/http';
import { Board, Order } from '../../core/models';
import { chime } from '../../core/ui';

const SOUND_KEY = 'hs_sound';

/**
 * The live picture of open orders. It polls every few seconds so a new order appears (and chimes) on any screen,
 * not only the board. Actions update the local copy immediately, then the next poll confirms it.
 */
@Injectable({ providedIn: 'root' })
export class BoardStore {
  private readonly api = inject(OrdersApi);
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastUnacknowledged = -1;

  readonly board = signal<Board | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly search = signal('');
  readonly soundOn = signal(this.readSound());

  readonly counters = computed(() => this.board()?.counters ?? null);
  readonly orders = computed(() => this.board()?.orders ?? []);

  constructor() {
    // "(3) Hatid Suki" in the browser tab shows how many orders nobody has opened yet.
    effect(() => {
      const n = this.counters()?.unacknowledged ?? 0;
      document.title = n > 0 ? `(${n}) Hatid Suki` : 'Hatid Suki';
    });
  }

  start() {
    if (this.timer) return;
    void this.refresh();
    this.timer = setInterval(() => { if (!document.hidden) void this.refresh(); }, 5000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.lastUnacknowledged = -1;
    this.board.set(null);
    this.loading.set(true);
  }

  async refresh() {
    try {
      const b = await this.api.board(this.search() || undefined);
      const n = b.counters.unacknowledged;
      if (this.lastUnacknowledged >= 0 && n > this.lastUnacknowledged && this.soundOn()) chime();
      this.lastUnacknowledged = n;
      this.board.set(b);
      this.error.set(null);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  /** Swap in the order returned by an action so the screen updates instantly. */
  replace(order: Order) {
    this.board.update(b => b && { ...b, orders: b.orders.map(o => (o.id === order.id ? { ...order, answers: null, events: null } : o)) });
    void this.refresh();
  }

  setSearch(term: string) { this.search.set(term); void this.refresh(); }

  toggleSound() {
    this.soundOn.update(v => !v);
    try { localStorage.setItem(SOUND_KEY, this.soundOn() ? 'on' : 'off'); } catch { /* storage may be blocked */ }
    if (this.soundOn()) chime(); // also unlocks audio, which browsers only allow after a click
  }

  private readSound(): boolean {
    try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
  }
}
