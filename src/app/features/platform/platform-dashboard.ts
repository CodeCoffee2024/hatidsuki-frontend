import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorMessage } from '../../core/http';
import { AdminWorkspace } from '../../core/models';
import { PlatformApi } from '../../core/platform-api';
import { PlatformAuthService } from '../../core/platform-auth.service';
import { ToastService } from '../../core/ui';
import { ModalComponent } from '../../shared/modal';

/**
 * Every business on the platform, in one place. This exists for the operator only: suspending or deleting a workspace
 * here has nothing to do with any business's own Owner/Manager/Staff roles — those can't reach this page at all.
 */
@Component({
  selector: 'app-platform-dashboard',
  imports: [DatePipe, FormsModule, ModalComponent],
  template: `
    <div class="page">
      <div class="page-head">
        <div><h1>Platform admin</h1><p>Every business signed up on Hatid Suki.</p></div>
        <button type="button" class="btn btn-ghost" (click)="auth.logout()"><i class="bi bi-box-arrow-right"></i> Sign out</button>
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }} <button class="btn btn-sm btn-ghost ms-2" (click)="load()">Try again</button></div> }

      @if (loading()) {
        <div class="skeleton" style="height: 320px"></div>
      } @else if (!rows().length) {
        <div class="empty card-lite"><h3>No businesses yet</h3><p>The first one to register at /register will show up here.</p></div>
      } @else {
        <div class="card-lite table-wrap">
          <table class="table align-middle mb-0">
            <thead><tr><th>Business</th><th>Owner</th><th>Created</th><th class="text-end">Items</th><th class="text-end">Forms</th><th class="text-end">Orders</th><th>Status</th><th></th></tr></thead>
            <tbody>
              @for (w of rows(); track w.id) {
                <tr>
                  <td><strong>{{ w.name }}</strong><div class="small text-muted">{{ w.slug }} · {{ w.currency }} · {{ w.timezone }}</div></td>
                  <td>{{ w.ownerName || '—' }}<div class="small text-muted">{{ w.ownerEmail }}</div></td>
                  <td class="text-nowrap">{{ w.createdAtUtc | date: 'mediumDate' }}</td>
                  <td class="text-end num">{{ w.itemCount }}</td>
                  <td class="text-end num">{{ w.formCount }}</td>
                  <td class="text-end num">{{ w.orderCount }}</td>
                  <td>
                    @if (w.isSuspended) { <span class="chip chip-cancelled" [title]="w.suspendedReason ?? ''">Suspended</span> }
                    @else { <span class="chip chip-ready">Active</span> }
                  </td>
                  <td class="text-end">
                    <div class="d-flex gap-1 justify-content-end">
                      @if (w.isSuspended) {
                        <button type="button" class="btn btn-ghost btn-sm" [disabled]="busyId() === w.id" (click)="reactivate(w)">Reactivate</button>
                      } @else {
                        <button type="button" class="btn btn-ghost btn-sm" [disabled]="busyId() === w.id" (click)="suspending.set(w)">Suspend</button>
                      }
                      <button type="button" class="btn btn-outline-danger btn-sm" [disabled]="busyId() === w.id" (click)="deleting.set(w)">Delete</button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    @if (suspending(); as w) {
      <app-modal heading="Suspend {{ w.name }}?" (closed)="suspending.set(null)">
        <p class="text-muted">They won't be able to sign in, and their order page will show as closed to customers. This can be undone any time.</p>
        <label class="form-label" for="reason">Reason (optional, for your own records)</label>
        <input id="reason" class="form-control" [(ngModel)]="reason" maxlength="300" placeholder="e.g. unpaid invoice, abuse report">
        <div class="d-flex gap-2 mt-3 justify-content-end">
          <button type="button" class="btn btn-ghost" (click)="suspending.set(null)">Cancel</button>
          <button type="button" class="btn btn-danger" [disabled]="busyId() === w.id" (click)="suspend(w)">Suspend</button>
        </div>
      </app-modal>
    }

    @if (deleting(); as w) {
      <app-modal heading="Delete {{ w.name }}?" (closed)="deleting.set(null)">
        <p class="text-muted">This permanently deletes every item, form, order and staff account for this business. It cannot be undone.</p>
        <label class="form-label" for="confirm">Type <strong>{{ w.slug }}</strong> to confirm</label>
        <input id="confirm" class="form-control" [(ngModel)]="confirmSlug" autocomplete="off">
        <div class="d-flex gap-2 mt-3 justify-content-end">
          <button type="button" class="btn btn-ghost" (click)="deleting.set(null)">Cancel</button>
          <button type="button" class="btn btn-danger" [disabled]="confirmSlug !== w.slug || busyId() === w.id" (click)="deleteWorkspace(w)">Delete permanently</button>
        </div>
      </app-modal>
    }
  `,
  styles: `
    .table-wrap { overflow: auto; }
    th { font-size: .82rem; color: var(--hs-muted); font-weight: 600; background: var(--hs-surface-2); }
  `,
})
export class PlatformDashboardComponent implements OnInit {
  private readonly api = inject(PlatformApi);
  private readonly toast = inject(ToastService);
  readonly auth = inject(PlatformAuthService);

  readonly rows = signal<AdminWorkspace[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly suspending = signal<AdminWorkspace | null>(null);
  readonly deleting = signal<AdminWorkspace | null>(null);
  reason = '';
  confirmSlug = '';

  ngOnInit() { void this.load(); }

  async load() {
    this.loading.set(true);
    try { this.rows.set(await this.api.workspaces()); this.error.set(null); }
    catch (e) { this.error.set(errorMessage(e)); } finally { this.loading.set(false); }
  }

  async suspend(w: AdminWorkspace) {
    this.busyId.set(w.id);
    try {
      await this.api.suspend(w.id, this.reason.trim() || null);
      this.suspending.set(null); this.reason = '';
      this.toast.show(`${w.name} suspended.`);
      await this.load();
    } catch (e) { this.toast.error(errorMessage(e)); } finally { this.busyId.set(null); }
  }

  async reactivate(w: AdminWorkspace) {
    this.busyId.set(w.id);
    try { await this.api.reactivate(w.id); this.toast.show(`${w.name} reactivated.`); await this.load(); }
    catch (e) { this.toast.error(errorMessage(e)); } finally { this.busyId.set(null); }
  }

  async deleteWorkspace(w: AdminWorkspace) {
    if (this.confirmSlug !== w.slug) return;
    this.busyId.set(w.id);
    try {
      await this.api.delete(w.id);
      this.deleting.set(null); this.confirmSlug = '';
      this.toast.show(`${w.name} deleted.`);
      await this.load();
    } catch (e) { this.toast.error(errorMessage(e)); } finally { this.busyId.set(null); }
  }
}
