import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CatalogApi } from '../../core/api';
import { errorMessage } from '../../core/http';
import { FormListItem } from '../../core/models';
import { ToastService } from '../../core/ui';
import { ModalComponent } from '../../shared/modal';

@Component({
  selector: 'app-forms',
  imports: [FormsModule, RouterLink, ModalComponent],
  template: `
    <div class="page">
      <div class="page-head">
        <div><h1>Forms &amp; QR codes</h1><p>An order form is your items plus the questions you want answered. Publish it, then share its QR code.</p></div>
        <button type="button" class="btn btn-primary" (click)="creating.set(true)"><i class="bi bi-plus-lg"></i> New form</button>
      </div>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @if (loading() && !forms().length) {
        <div class="skeleton" style="height: 180px"></div>
      } @else if (!forms().length) {
        <div class="empty card-lite"><i class="bi bi-ui-checks-grid"></i><h3>Create your first order form</h3>
          <p>We’ll start you with the essentials: name, phone, your item list and notes. You can change anything.</p>
          <button class="btn btn-primary" (click)="creating.set(true)">Create a form</button></div>
      } @else {
        <div class="cards">
          @for (f of forms(); track f.id) {
            <article class="card-lite form-card">
              <header>
                <div><h2>{{ f.name }}</h2>
                  <span class="chip" [class.chip-ready]="f.status === 'Published'" [class.chip-served]="f.status !== 'Published'"><i class="bi" [class.bi-broadcast]="f.status === 'Published'" [class.bi-pencil]="f.status === 'Draft'" [class.bi-pause-circle]="f.status === 'Closed'"></i>{{ f.status === 'Published' ? 'Live' : f.status === 'Draft' ? 'Draft' : 'Closed' }}</span>
                  @if (f.hasUnpublishedChanges && f.status !== 'Draft') { <span class="chip chip-new">Unpublished changes</span> }
                </div>
                <div class="stat"><strong class="num">{{ f.ordersCount }}</strong><small>orders</small></div>
              </header>
              @if (f.status !== 'Draft') {
                <div class="link"><i class="bi bi-link-45deg"></i><code>{{ f.publicUrl }}</code>
                  <button type="button" class="btn btn-ghost btn-sm" (click)="copy(f.publicUrl)" aria-label="Copy link"><i class="bi bi-clipboard"></i></button></div>
              }
              <footer>
                <a class="btn btn-ghost btn-sm" [routerLink]="['/app/forms', f.id]"><i class="bi bi-pencil-square"></i> Edit</a>
                @if (f.status !== 'Draft') { <a class="btn btn-primary btn-sm" [routerLink]="['/app/forms', f.id, 'share']"><i class="bi bi-qr-code"></i> QR &amp; share</a> }
                @if (f.status === 'Published') { <button type="button" class="btn btn-ghost btn-sm" (click)="setStatus(f, 'close')"><i class="bi bi-pause"></i> Pause orders</button> }
                @if (f.status === 'Closed') { <button type="button" class="btn btn-ghost btn-sm" (click)="setStatus(f, 'reopen')"><i class="bi bi-play"></i> Reopen</button> }
              </footer>
            </article>
          }
        </div>
      }
    </div>

    @if (creating()) {
      <app-modal heading="New order form" (closed)="creating.set(false)">
        <form (ngSubmit)="create()">
          <label class="form-label" for="fn">Name</label>
          <input id="fn" name="fn" class="form-control" [(ngModel)]="newName" maxlength="80" placeholder="e.g. Lunch orders" required>
          <p class="text-muted small mt-2">Only you see this name. Customers see your business name.</p>
          @if (createError()) { <div class="alert alert-danger py-2">{{ createError() }}</div> }
          <div class="d-flex gap-2 justify-content-end"><button type="button" class="btn btn-ghost" (click)="creating.set(false)">Cancel</button>
            <button type="submit" class="btn btn-primary" [disabled]="!newName.trim() || busy()">Create form</button></div>
        </form>
      </app-modal>
    }
  `,
  styles: `
    .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); gap: 1rem; }
    .form-card { padding: 1.1rem; display: flex; flex-direction: column; gap: .8rem; }
    .form-card header { display: flex; justify-content: space-between; gap: 1rem; }
    .form-card h2 { font-size: 1.15rem; font-weight: 700; margin: 0 0 .4rem; }
    .form-card header .chip + .chip { margin-left: .3rem; }
    .stat { text-align: right; line-height: 1.1; } .stat strong { font-size: 1.7rem; display: block; } .stat small { color: var(--hs-muted); }
    .link { display: flex; align-items: center; gap: .4rem; background: var(--hs-surface-2); border: 1px solid var(--hs-line); border-radius: 10px; padding: .3rem .3rem .3rem .6rem; min-width: 0; }
    .link code { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--hs-ink); }
    .form-card footer { display: flex; gap: .4rem; flex-wrap: wrap; margin-top: auto; }
  `,
})
export class FormsComponent implements OnInit {
  private readonly api = inject(CatalogApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly forms = signal<FormListItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly creating = signal(false);
  readonly busy = signal(false);
  readonly createError = signal<string | null>(null);
  newName = '';

  async ngOnInit() { await this.load(); }

  async load() {
    try { this.forms.set(await this.api.forms()); this.error.set(null); }
    catch (e) { this.error.set(errorMessage(e)); } finally { this.loading.set(false); }
  }

  async create() {
    this.busy.set(true); this.createError.set(null);
    try {
      const f = await this.api.createForm(this.newName.trim());
      await this.router.navigate(['/app/forms', f.id]);
    } catch (e) { this.createError.set(errorMessage(e)); } finally { this.busy.set(false); }
  }

  async setStatus(f: FormListItem, action: 'close' | 'reopen') {
    try { await this.api.setFormStatus(f.id, action); this.toast.show(action === 'close' ? 'Orders paused. Customers see a closed message.' : 'Orders are open again.'); await this.load(); }
    catch (e) { this.toast.error(errorMessage(e)); }
  }

  async copy(url: string) {
    try { await navigator.clipboard.writeText(url); this.toast.show('Link copied.'); } catch { this.toast.error('Couldn’t copy the link.'); }
  }
}
