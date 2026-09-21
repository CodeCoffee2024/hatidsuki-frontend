import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OrdersApi } from '../../core/api';
import { errorMessage } from '../../core/http';
import { Order } from '../../core/models';
import { MoneyPipe, StatusChipComponent } from '../../core/ui';
import { OrderDetailComponent } from './order-detail';

/** Search and history for every order, past and present. The board is for today's work; this is for finding things. */
@Component({
  selector: 'app-orders',
  imports: [FormsModule, DatePipe, MoneyPipe, StatusChipComponent, OrderDetailComponent, RouterLink],
  template: `
    <div class="page">
      <div class="page-head">
        <div><h1>All orders</h1><p>Find any order by name, number, date or status.</p></div>
        <a class="btn btn-primary" routerLink="/app/orders/new"><i class="bi bi-plus-lg"></i> New order</a>
      </div>

      <div class="filters card-lite">
        <div class="f grow"><label for="q">Search</label><input id="q" class="form-control" type="search" placeholder="Name, phone, person or #" [(ngModel)]="search" (ngModelChange)="changed()"></div>
        <div class="f"><label for="st">Status</label>
          <select id="st" class="form-select" [(ngModel)]="status" (ngModelChange)="changed(true)">
            <option value="">Any</option><option>New</option><option>Ready</option><option>Served</option><option>Cancelled</option>
          </select></div>
        <div class="f"><label for="pay">Payment</label>
          <select id="pay" class="form-select" [(ngModel)]="payment" (ngModelChange)="changed(true)">
            <option value="">Any</option><option value="unpaid">Cash still owed</option><option value="paid">Paid</option>
          </select></div>
        <div class="f"><label for="from">From</label><input id="from" class="form-control" type="date" [(ngModel)]="from" (ngModelChange)="changed(true)"></div>
        <div class="f"><label for="to">To</label><input id="to" class="form-control" type="date" [(ngModel)]="to" (ngModelChange)="changed(true)"></div>
        @if (hasFilters()) { <button type="button" class="btn btn-ghost align-self-end" (click)="clear()">Clear</button> }
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      <div class="card-lite table-wrap">
        @if (loading() && !rows().length) {
          <div class="p-3"><div class="skeleton" style="height: 240px"></div></div>
        } @else if (!rows().length) {
          <div class="empty"><i class="bi bi-receipt"></i><h3>{{ hasFilters() ? 'No orders match these filters' : 'No orders yet' }}</h3>
            <p>{{ hasFilters() ? 'Try clearing a filter.' : 'Orders appear here as soon as customers place them.' }}</p></div>
        } @else {
          <table class="table align-middle mb-0">
            <thead><tr><th>#</th><th>Customer</th><th>People</th><th>Placed</th><th>Deliver to</th><th>Status</th><th>Cash</th><th class="text-end">Total</th></tr></thead>
            <tbody>
              @for (o of rows(); track o.id) {
                <tr tabindex="0" (click)="selected.set(o)" (keydown.enter)="selected.set(o)">
                  <td class="num fw-semibold">#{{ o.number }}</td>
                  <td>{{ o.customerName }}<div class="small text-muted">{{ o.source }}</div></td>
                  <td class="num">{{ o.activeCount }}</td>
                  <td class="text-nowrap">{{ o.createdAtUtc | date: 'MMM d, h:mm a' }}</td>
                  <td>@if (o.deliveryLocation) { {{ o.deliveryLocation }} } @else { <span class="text-muted">None</span> }</td>
                  <td><app-status-chip [status]="o.status" /></td>
                  <td>
                    @if (o.status === 'Cancelled') { <span class="text-muted">n/a</span> }
                    @else if (o.paymentStatus === 'Paid') { <span class="chip chip-paid"><i class="bi bi-check2"></i> Paid</span> }
                    @else if (o.paymentStatus === 'PartlyPaid') { <span class="chip chip-unpaid">{{ o.paidCount }} of {{ o.activeCount }} paid</span> }
                    @else { <span class="chip chip-unpaid">Unpaid</span> }
                  </td>
                  <td class="text-end money">{{ o.total | money: o.currency }}</td>
                </tr>
              }
            </tbody>
          </table>
          <div class="pager">
            <span class="text-muted">{{ total() }} order{{ total() === 1 ? '' : 's' }}</span>
            <div class="btn-group">
              <button class="btn btn-ghost btn-sm" [disabled]="page() === 1" (click)="go(page() - 1)"><i class="bi bi-chevron-left"></i> Newer</button>
              <button class="btn btn-ghost btn-sm" [disabled]="page() * pageSize >= total()" (click)="go(page() + 1)">Older <i class="bi bi-chevron-right"></i></button>
            </div>
          </div>
        }
      </div>
    </div>
    @if (selected(); as s) { <app-order-detail [orderId]="s.id" (closed)="closeDetail()" /> }
  `,
  styles: `
    .filters { display: flex; flex-wrap: wrap; gap: .75rem; padding: 1rem; margin-bottom: 1rem; }
    .f { display: flex; flex-direction: column; gap: .2rem; min-width: 140px; } .f.grow { flex: 1; min-width: 220px; }
    .f label { font-size: .8rem; font-weight: 600; color: var(--hs-muted); }
    .table-wrap { overflow: hidden; }
    tbody tr { cursor: pointer; } tbody tr:hover { background: var(--hs-surface-2); }
    th { font-size: .82rem; color: var(--hs-muted); font-weight: 600; background: var(--hs-surface-2); }
    .pager { display: flex; justify-content: space-between; align-items: center; padding: .7rem 1rem; border-top: 1px solid var(--hs-line); }
    @media (max-width: 720px) { .table-wrap { overflow-x: auto; } .table-wrap table { min-width: 640px; } }
  `,
})
export class OrdersComponent implements OnInit {
  private readonly api = inject(OrdersApi);
  readonly pageSize = 20;

  readonly rows = signal<Order[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selected = signal<Order | null>(null);

  search = ''; status = ''; payment = ''; from = ''; to = '';
  private debounce: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() { void this.load(); }

  hasFilters() { return !!(this.search || this.status || this.payment || this.from || this.to); }
  clear() { this.search = this.status = this.payment = this.from = this.to = ''; this.page.set(1); void this.load(); }

  changed(immediate = false) {
    this.page.set(1);
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.load(), immediate ? 0 : 300);
  }
  go(p: number) { this.page.set(p); void this.load(); }
  closeDetail() { this.selected.set(null); void this.load(); }

  async load() {
    this.loading.set(true);
    try {
      const r = await this.api.list({ status: this.status, payment: this.payment, search: this.search, from: this.from, to: this.to, page: this.page(), pageSize: this.pageSize });
      this.rows.set(r.items); this.total.set(r.total); this.error.set(null);
    } catch (e) { this.error.set(errorMessage(e)); } finally { this.loading.set(false); }
  }
}
