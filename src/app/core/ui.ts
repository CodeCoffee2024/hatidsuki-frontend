import { Component, Injectable, Pipe, PipeTransform, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';

// ---- toasts ---------------------------------------------------------------------------------------

export interface Toast { id: number; message: string; kind: 'ok' | 'error' | 'info'; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(message: string, kind: Toast['kind'] = 'ok', ms = 4200) {
    const id = ++this.seq;
    this.toasts.update(t => [...t, { id, message, kind }]);
    setTimeout(() => this.dismiss(id), ms);
  }
  error(message: string) { this.show(message, 'error', 6000); }
  dismiss(id: number) { this.toasts.update(t => t.filter(x => x.id !== id)); }
}

@Component({
  selector: 'app-toast-host',
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      @for (t of toasts.toasts(); track t.id) {
        <div class="toast-item" [class.err]="t.kind === 'error'" role="status">
          <i class="bi" [class.bi-check-circle-fill]="t.kind === 'ok'" [class.bi-exclamation-triangle-fill]="t.kind === 'error'" [class.bi-info-circle-fill]="t.kind === 'info'"></i>
          <span>{{ t.message }}</span>
          <button type="button" class="btn-close btn-close-white" aria-label="Dismiss" (click)="toasts.dismiss(t.id)"></button>
        </div>
      }
    </div>`,
  styles: `
    .toast-stack { position: fixed; z-index: 2000; right: 1rem; bottom: 1rem; display: flex; flex-direction: column; gap: .5rem; max-width: min(92vw, 380px); }
    .toast-item { display: flex; align-items: center; gap: .6rem; background: #1f1b16; color: #fff; padding: .7rem .9rem; border-radius: 12px; box-shadow: 0 8px 28px rgba(0,0,0,.25); font-size: .92rem; }
    .toast-item.err { background: #991b1b; }
    .toast-item span { flex: 1; }
    .btn-close { font-size: .7rem; }
  `,
})
export class ToastHostComponent { readonly toasts = inject(ToastService); }

// ---- time ------------------------------------------------------------------------------------------

/** A shared clock so "9 min ago" labels stay fresh without every component running its own timer. */
@Injectable({ providedIn: 'root' })
export class Clock {
  readonly now = signal(Date.now());
  constructor() { setInterval(() => this.now.set(Date.now()), 15000); }
}

@Pipe({ name: 'ago' })
export class AgoPipe implements PipeTransform {
  /** Pass the clock signal's value as the argument so the label refreshes as time passes. */
  transform(iso: string | null | undefined, now: number): string {
    if (!iso) return '';
    const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h} h ${mins % 60} min ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}

export function minutesSince(iso: string, now: number): number { return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000)); }

// ---- money -----------------------------------------------------------------------------------------

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  private readonly auth = inject(AuthService);
  private readonly cache = new Map<string, Intl.NumberFormat>();

  transform(value: number | null | undefined, currency?: string | null): string {
    const code = currency || this.auth.currency();
    let fmt = this.cache.get(code);
    if (!fmt) { fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits: 2 }); this.cache.set(code, fmt); }
    return fmt.format(value ?? 0);
  }
}

// ---- small shared pieces ------------------------------------------------------------------------------

/** Status chip: colour and words together, never colour alone. */
@Component({
  selector: 'app-status-chip',
  template: `<span class="chip" [class]="'chip-' + status.toLowerCase()"><i class="bi" [class]="icon()"></i>{{ status }}</span>`,
  inputs: ['status'],
})
export class StatusChipComponent {
  status = 'New';
  icon() { return ({ New: 'bi-hourglass-split', Ready: 'bi-check-circle', Served: 'bi-bag-check', Cancelled: 'bi-x-circle' } as Record<string, string>)[this.status] ?? 'bi-circle'; }
}

/** Plays a short two-tone chime (Web Audio, no file needed). Browsers only allow it after the user has interacted with the page. */
export function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((f, i) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.value = f; osc.type = 'sine'; osc.connect(gain); gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.start(t); osc.stop(t + 0.32);
    });
  } catch { /* sound is a nice-to-have */ }
}
