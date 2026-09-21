import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DashboardApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/http';
import { Dashboard } from '../../core/models';
import { MoneyPipe } from '../../core/ui';

type Preset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PERIOD: Record<Preset, string> = { today: 'Today', yesterday: 'Yesterday', '7d': 'Over the last 7 days', '30d': 'Over the last 30 days', custom: 'In this period' };

/**
 * Sales and order records, straight from the orders you have taken. Cancelled orders never count as sales, and
 * "cash collected" is only what you have tagged paid.
 */
@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, MoneyPipe, RouterLink],
  template: `
    <div class="page">
      <div class="page-head">
        <div><h1>Dashboard</h1></div>
        <div class="range">
          <div class="seg" role="group" aria-label="Date range">
            @for (p of presets; track p.id) { <button type="button" [class.on]="preset() === p.id" [attr.aria-pressed]="preset() === p.id" (click)="choose(p.id)">{{ p.label }}</button> }
          </div>
          @if (preset() === 'custom') {
            <input type="date" class="form-control form-control-sm" [ngModel]="from()" (ngModelChange)="from.set($event); load()" aria-label="From date">
            <span class="text-muted">to</span>
            <input type="date" class="form-control form-control-sm" [ngModel]="to()" (ngModelChange)="to.set($event); load()" aria-label="To date">
          }
        </div>
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }} <button class="btn btn-sm btn-ghost ms-2" (click)="load()">Try again</button></div> }

      @if (loading() && !d()) {
        <div class="skeleton" style="height: 120px; margin-bottom: 1rem"></div><div class="skeleton" style="height: 260px"></div>
      } @else if (d(); as data) {
        @if (data.kpis.orders === 0 && data.kpis.outstanding === 0) {
          <div class="empty card-lite">
            <h3>No orders in this period</h3>
            <p>Once customers order, you’ll see sales, your top items and your busiest hours here.</p>
            <a class="btn btn-primary" routerLink="/app/forms">Get your QR code</a>
          </div>
        } @else {
          <p class="sentence">{{ period() }} you took <strong>{{ data.kpis.orders }}</strong> {{ data.kpis.orders === 1 ? 'order' : 'orders' }}
            for <strong>{{ data.kpis.people }}</strong> {{ data.kpis.people === 1 ? 'person' : 'people' }}, worth <strong class="money">{{ data.kpis.sales | money: data.currency }}</strong>.</p>

          <dl class="figures card-lite">
            <div class="fig"><dt>Sales</dt><dd class="money">{{ data.kpis.sales | money: data.currency }}</dd><dd class="cmp">{{ compare(data.kpis.sales, data.previous?.sales) }}</dd></div>
            <div class="fig"><dt>Orders</dt><dd class="num">{{ data.kpis.orders }}</dd><dd class="cmp">{{ compare(data.kpis.orders, data.previous?.orders) }}</dd></div>
            <div class="fig"><dt>Average order</dt><dd class="money">{{ data.kpis.averageOrder | money: data.currency }}</dd><dd class="cmp">{{ data.kpis.cancelled }} cancelled</dd></div>
            <div class="fig"><dt>Cash collected</dt><dd class="money">{{ data.kpis.collected | money: data.currency }}</dd><dd class="cmp">tagged paid in this period</dd></div>
            <div class="fig owed"><dt>Cash still to collect</dt><dd class="money">{{ data.kpis.outstanding | money: data.currency }}</dd><dd class="cmp">from all unpaid orders</dd></div>
          </dl>

          <section class="card-lite panel">
            <header><h2>Sales by day</h2><button type="button" class="btn btn-ghost btn-sm" (click)="asTable.set(!asTable())">{{ asTable() ? 'Show chart' : 'Show as table' }}</button></header>
            @if (!asTable()) {
              <div class="chart" role="img" [attr.aria-label]="'Sales per day. The highest day was ' + (max() | money: data.currency)">
                @for (p of data.series; track p.date) {
                  <div class="col" [title]="p.date + ': ' + p.orders + ' orders'">
                    <span class="val">{{ p.sales > 0 ? (p.sales | money: data.currency) : '' }}</span>
                    <div class="bar" [style.height.%]="max() ? (p.sales / max()) * 100 : 0" [class.empty-bar]="p.sales === 0"></div>
                    <span class="day">{{ shortDay(p.date) }}</span>
                  </div>
                }
              </div>
            } @else {
              <table class="table table-sm mb-0"><thead><tr><th>Day</th><th class="text-end">Orders</th><th class="text-end">Sales</th></tr></thead>
                <tbody>@for (p of data.series; track p.date) { <tr><td>{{ p.date }}</td><td class="text-end num">{{ p.orders }}</td><td class="text-end money">{{ p.sales | money: data.currency }}</td></tr> }</tbody></table>
            }
          </section>

          <div class="two">
            <section class="card-lite panel">
              <header><h2>Top items</h2></header>
              @for (t of data.topItems; track t.name) {
                <div class="hbar"><div class="hl"><span>{{ t.name }}</span><strong class="num">{{ t.quantity }}</strong></div>
                  <div class="track"><span [style.width.%]="(t.quantity / data.topItems[0].quantity) * 100"></span></div></div>
              } @empty { <p class="text-muted">No items sold yet.</p> }
            </section>
            <section class="card-lite panel">
              <header><h2>Where orders come from</h2></header>
              @for (s of data.bySource; track s.source) {
                <div class="hbar"><div class="hl"><span>{{ s.source }}</span><span><strong class="num">{{ s.orders }}</strong> <small class="text-muted">{{ s.sales | money: data.currency }}</small></span></div>
                  <div class="track alt"><span [style.width.%]="(s.orders / data.bySource[0].orders) * 100"></span></div></div>
              } @empty { <p class="text-muted">No orders yet.</p> }
              <p class="text-muted small mt-3 mb-0">Give each table or flyer its own QR code to see which one works.</p>
            </section>
          </div>

          <div class="two">
            <section class="card-lite panel">
              <header><h2>Delivered to</h2></header>
              @for (l of data.byLocation; track l.location) {
                <div class="hbar"><div class="hl"><span>{{ l.location }}</span><span><strong class="num">{{ l.orders }}</strong> <small class="text-muted">{{ l.people }} {{ l.people === 1 ? 'person' : 'people' }}</small></span></div>
                  <div class="track alt"><span [style.width.%]="(l.orders / data.byLocation[0].orders) * 100"></span></div></div>
              } @empty { <p class="text-muted">No orders yet.</p> }
            </section>
            <section class="card-lite panel">
              <header><h2>Busiest times</h2></header>
              <div class="heat" role="img" aria-label="Orders by day of the week and hour">
                <div class="hrow head"><span></span>@for (h of hours; track h) { <span class="hh">{{ hourLabel(h) }}</span> }</div>
                @for (day of [1,2,3,4,5,6,0]; track day) {
                  <div class="hrow"><span class="dl">{{ days[day] }}</span>
                    @for (h of hours; track h) { <span class="cell" [style.--a]="intensity(day, h)" [title]="days[day] + ' ' + hourLabel(h) + ': ' + count(day, h) + ' orders'">{{ count(day, h) || '' }}</span> }
                  </div>
                }
              </div>
            </section>
          </div>
        }
      }
    </div>`,
  styles: `
    .range { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
    .range .form-control { width: auto; }
    .seg { display: inline-flex; background: #e9e4d8; padding: 3px; border-radius: 9px; gap: 2px; flex-wrap: wrap; }
    .seg button { border: 0; background: transparent; padding: .4rem .85rem; border-radius: 7px; font-weight: 600; color: var(--hs-muted); font-size: .9rem; }
    .seg button.on { background: var(--hs-surface); color: var(--hs-ink); box-shadow: 0 1px 2px rgba(27, 25, 21, .16); }
    .sentence { font-size: 1.25rem; line-height: 1.45; max-width: 48rem; margin: 0 0 1.25rem; }
    .figures { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); margin: 0 0 1.25rem; }
    .fig { padding: .95rem 1.1rem; display: flex; flex-direction: column; gap: .1rem; }
    .fig + .fig { border-left: 1px solid var(--hs-line); }
    .fig dt { font-weight: 500; color: var(--hs-muted); font-size: .9rem; }
    .fig dd { margin: 0; }
    .fig dd:nth-of-type(1) { font-size: 1.35rem; font-weight: 700; }
    .fig .cmp { font-size: .84rem; color: var(--hs-muted); }
    .fig.owed dd:nth-of-type(1) { color: var(--hs-new); }
    @media (max-width: 720px) { .fig + .fig { border-left: 0; border-top: 1px solid var(--hs-line); } }
    .panel { padding: 1rem 1.1rem 1.1rem; margin-bottom: 1rem; }
    .panel header { display: flex; justify-content: space-between; align-items: center; margin-bottom: .8rem; gap: 1rem; } .panel h2 { font-size: 1.05rem; font-weight: 700; margin: 0; }
    .chart { display: flex; align-items: flex-end; gap: .5rem; height: 220px; padding-top: 1.5rem; overflow-x: auto; }
    .col { flex: 1; min-width: 44px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: .25rem; }
    .col .bar { width: 100%; max-width: 64px; background: var(--hs-ink); border-radius: 3px 3px 0 0; min-height: 3px; }
    .col .bar.empty-bar { background: #ddd6c7; }
    .col .val { font-size: .68rem; color: var(--hs-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .col .day { font-size: .75rem; color: var(--hs-muted); }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; } @media (max-width: 820px) { .two { grid-template-columns: 1fr; } }
    .hbar { margin-bottom: .7rem; } .hl { display: flex; justify-content: space-between; gap: 1rem; margin-bottom: .2rem; }
    .track { height: 6px; background: #ebe6da; border-radius: 3px; overflow: hidden; } .track span { display: block; height: 100%; background: var(--hs-ink); } .track.alt span { background: var(--hs-primary); }
    .heat { overflow-x: auto; } .hrow { display: grid; grid-template-columns: 38px repeat(17, minmax(26px, 1fr)); gap: 3px; margin-bottom: 3px; min-width: 520px; align-items: center; }
    .hh { font-size: .66rem; color: var(--hs-muted); text-align: center; } .dl { font-size: .78rem; color: var(--hs-muted); font-weight: 600; }
    .cell { height: 26px; border-radius: 4px; background: rgba(185, 58, 20, calc(var(--a) * .95 + .06)); font-size: .7rem; display: grid; place-items: center; color: #fff; font-weight: 700; }
  `,
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(DashboardApi);
  private readonly auth = inject(AuthService);

  readonly presets: { id: Preset; label: string }[] = [
    { id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }, { id: '7d', label: '7 days' }, { id: '30d', label: '30 days' }, { id: 'custom', label: 'Custom' },
  ];
  readonly days = DAYS;
  readonly hours = Array.from({ length: 17 }, (_, i) => i + 6); // 6am to 10pm
  readonly d = signal<Dashboard | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly preset = signal<Preset>('7d');
  readonly from = signal('');
  readonly to = signal('');
  readonly asTable = signal(false);
  readonly max = computed(() => Math.max(0, ...(this.d()?.series.map(s => s.sales) ?? [0])));
  readonly period = computed(() => PERIOD[this.preset()]);
  private peak = computed(() => Math.max(1, ...(this.d()?.busiest.map(b => b.orders) ?? [1])));

  ngOnInit() { this.choose('7d'); }

  choose(p: Preset) {
    this.preset.set(p);
    if (p !== 'custom') {
      const today = this.today(); const back = (n: number) => this.addDays(today, -n);
      const range = { today: [today, today], yesterday: [back(1), back(1)], '7d': [back(6), today], '30d': [back(29), today] }[p] as [string, string];
      this.from.set(range[0]); this.to.set(range[1]);
    }
    void this.load();
  }

  async load() {
    if (!this.from() || !this.to()) return;
    this.loading.set(true);
    try { this.d.set(await this.api.get(this.from(), this.to())); this.error.set(null); }
    catch (e) { this.error.set(errorMessage(e)); } finally { this.loading.set(false); }
  }

  count(day: number, hour: number) { return this.d()?.busiest.find(b => b.dayOfWeek === day && b.hour === hour)?.orders ?? 0; }
  intensity(day: number, hour: number) { const c = this.count(day, hour); return c ? 0.15 + (c / this.peak()) * 0.85 : 0; }
  hourLabel(h: number) { return h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`; }
  shortDay(date: string) { const [y, m, dd] = date.split('-').map(Number); return new Date(y, m - 1, dd).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }); }

  /** Plain words instead of arrows: "12% more than the period before". */
  compare(now: number, before: number | undefined) {
    if (before === undefined) return '';
    if (before === 0) return now > 0 ? 'nothing in the period before' : '';
    const change = Math.round(((now - before) / before) * 100);
    return change === 0 ? 'same as the period before' : `${Math.abs(change)}% ${change > 0 ? 'more' : 'less'} than the period before`;
  }

  private today() { return new Intl.DateTimeFormat('en-CA', { timeZone: this.auth.user()?.timezone ?? 'UTC' }).format(new Date()); }
  private addDays(iso: string, n: number) { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1, d + n)); return dt.toISOString().slice(0, 10); }
}
