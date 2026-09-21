import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogApi } from '../../core/api';
import { errorMessage } from '../../core/http';
import { DeliveryLocation } from '../../core/models';
import { ToastService } from '../../core/ui';
import { ModalComponent } from '../../shared/modal';

/** The places you deliver to. Customers choose one on every order form, so at least one is needed before you can publish. */
@Component({
  selector: 'app-delivery',
  imports: [FormsModule, ModalComponent],
  template: `
    <div class="page narrow">
      <div class="page-head">
        <div>
          <h1>Delivery locations</h1>
          <p>Customers choose one of these on every order form. Add the places you deliver to, and put any directions in the note.</p>
        </div>
      </div>

      <form class="add card-lite" (ngSubmit)="addMany()">
        <label class="form-label" for="many">Add locations</label>
        <textarea id="many" name="many" class="form-control" rows="3" [(ngModel)]="draft" placeholder="One place per line, for example:&#10;Building A lobby&#10;Rooftop terrace&#10;Parking area"></textarea>
        <div class="add-foot">
          <span class="text-muted small">You can add a note to each one after.</span>
          <button class="btn btn-primary" type="submit" [disabled]="busy() || !draft.trim()">{{ busy() ? 'Adding…' : 'Add' }}</button>
        </div>
        @if (addError()) { <div class="field-error">{{ addError() }}</div> }
      </form>

      @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }

      @if (loading() && !all().length) {
        <div class="skeleton" style="height: 200px"></div>
      } @else if (!all().length) {
        <div class="empty card-lite">
          <h3>No delivery locations yet</h3>
          <p>Add at least one above. Your order form can’t be published until customers have somewhere to choose.</p>
        </div>
      } @else {
        <section class="card-lite list" aria-label="Active locations">
          @for (l of active(); track l.id) {
            <div class="row-l">
              <div class="info"><strong>{{ l.name }}</strong>@if (l.note) { <span class="text-muted">{{ l.note }}</span> } @else { <span class="text-muted faint">No note</span> }</div>
              <button type="button" class="btn btn-ghost btn-sm" (click)="edit(l)" [attr.aria-label]="'Edit ' + l.name">Edit</button>
              <button type="button" class="btn btn-ghost btn-sm" (click)="setActive(l, false)" [attr.aria-label]="'Hide ' + l.name">Hide</button>
            </div>
          }
        </section>

        @if (hidden().length) {
          <h2 class="h6 mt-4 mb-2">Hidden</h2>
          <p class="text-muted small">Customers don’t see these. Past orders keep their location.</p>
          <section class="card-lite list dim" aria-label="Hidden locations">
            @for (l of hidden(); track l.id) {
              <div class="row-l">
                <div class="info"><strong>{{ l.name }}</strong></div>
                <button type="button" class="btn btn-ghost btn-sm" (click)="setActive(l, true)" [attr.aria-label]="'Show ' + l.name">Show again</button>
              </div>
            }
          </section>
        }
      }
    </div>

    @if (editing(); as e) {
      <app-modal heading="Edit location" [width]="440" (closed)="editing.set(null)">
        <form (ngSubmit)="save(e)">
          <label class="form-label" for="en">Name</label>
          <input id="en" name="en" class="form-control mb-3" [(ngModel)]="editName" maxlength="80" required>
          <label class="form-label" for="eno">Note for customers <span class="text-muted fw-normal">(optional)</span></label>
          <input id="eno" name="eno" class="form-control" [(ngModel)]="editNote" maxlength="200" placeholder="For example: Ground floor, next to the guard">
          @if (editError()) { <div class="field-error">{{ editError() }}</div> }
          <div class="d-flex gap-2 justify-content-end mt-4">
            <button type="button" class="btn btn-ghost" (click)="editing.set(null)">Cancel</button>
            <button class="btn btn-primary" type="submit" [disabled]="!editName.trim()">Save location</button>
          </div>
        </form>
      </app-modal>
    }
  `,
  styles: `
    .narrow { max-width: 760px; }
    .add { padding: 1.1rem 1.25rem; margin-bottom: 1.5rem; }
    .add-foot { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-top: .75rem; }
    .list { overflow: hidden; }
    .row-l { display: flex; align-items: center; gap: .5rem; padding: .75rem 1rem; }
    .row-l + .row-l { border-top: 1px solid var(--hs-line); }
    .info { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
    .faint { opacity: .7; }
    .dim { background: var(--hs-surface-2); }
  `,
})
export class DeliveryComponent implements OnInit {
  private readonly api = inject(CatalogApi);
  private readonly toast = inject(ToastService);

  readonly all = signal<DeliveryLocation[]>([]);
  readonly active = computed(() => this.all().filter(l => l.isActive));
  readonly hidden = computed(() => this.all().filter(l => !l.isActive));
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly addError = signal<string | null>(null);
  readonly editing = signal<DeliveryLocation | null>(null);
  readonly editError = signal<string | null>(null);
  draft = ''; editName = ''; editNote = '';

  ngOnInit() { void this.load(); }

  async load() {
    try { this.all.set(await this.api.deliveryLocations(true)); this.error.set(null); }
    catch (e) { this.error.set(errorMessage(e)); } finally { this.loading.set(false); }
  }

  async addMany() {
    this.busy.set(true); this.addError.set(null);
    try {
      const before = this.all().length;
      this.all.set(await this.api.addDeliveryLocations(this.draft.split('\n')));
      const added = this.all().length - before;
      this.draft = '';
      this.toast.show(added === 0 ? 'Those locations are already in your list.' : `${added} location${added === 1 ? '' : 's'} added.`);
    } catch (e) { this.addError.set(errorMessage(e)); } finally { this.busy.set(false); }
  }

  edit(l: DeliveryLocation) { this.editName = l.name; this.editNote = l.note ?? ''; this.editError.set(null); this.editing.set(l); }

  async save(l: DeliveryLocation) {
    this.editError.set(null);
    try {
      const saved = await this.api.saveDeliveryLocation(l.id, { name: this.editName, note: this.editNote.trim() || null });
      this.all.update(list => list.map(x => (x.id === saved.id ? saved : x)));
      this.editing.set(null);
      this.toast.show('Location saved.');
    } catch (e) { this.editError.set(errorMessage(e)); }
  }

  async setActive(l: DeliveryLocation, active: boolean) {
    try {
      const saved = await this.api.setDeliveryLocationActive(l.id, active);
      this.all.update(list => list.map(x => (x.id === saved.id ? saved : x)));
      this.toast.show(active ? `${l.name} is back on your forms.` : `${l.name} is hidden from customers.`);
    } catch (e) { this.toast.error(errorMessage(e)); }
  }
}
