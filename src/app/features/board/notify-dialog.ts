import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { OrdersApi } from '../../core/api';
import { errorMessage } from '../../core/http';
import { Notification, Order } from '../../core/models';
import { ToastService } from '../../core/ui';
import { ModalComponent } from '../../shared/modal';
import { OrderActions } from './order-actions';

/**
 * "Tell the customer it's ready" in one tap. Opens WhatsApp / SMS / email with the message already written,
 * then tags the order Notified so a ready order can't be forgotten.
 */
@Component({
  selector: 'app-notify-dialog',
  imports: [ModalComponent],
  template: `
    <app-modal [heading]="'Tell ' + order().customerName + ' it’s ready'" (closed)="closed.emit()">
      @if (info(); as n) {
        <label class="form-label" for="msg">Message</label>
        <textarea id="msg" class="form-control mb-3" rows="4" readonly>{{ n.message }}</textarea>

        <div class="d-grid gap-2">
          <a class="btn btn-lg" [class.btn-primary]="!!n.whatsAppLink" [class.btn-ghost]="!n.whatsAppLink" [class.disabled]="!n.whatsAppLink"
             [attr.href]="n.whatsAppLink" target="_blank" rel="noopener" (click)="sent('whatsapp')"><i class="bi bi-whatsapp"></i> WhatsApp</a>
          <div class="row g-2">
            <div class="col"><a class="btn btn-ghost w-100" [class.disabled]="!n.smsLink" [attr.href]="n.smsLink" (click)="sent('sms')"><i class="bi bi-chat-dots"></i> SMS</a></div>
            <div class="col"><a class="btn btn-ghost w-100" [class.disabled]="!n.emailLink" [attr.href]="n.emailLink" (click)="sent('email')"><i class="bi bi-envelope"></i> Email</a></div>
            <div class="col"><button type="button" class="btn btn-ghost w-100" (click)="copy(n.message)"><i class="bi bi-clipboard"></i> Copy</button></div>
          </div>
        </div>
        @if (!n.whatsAppLink) { <p class="text-muted small mt-3 mb-0">No phone number on this order, so WhatsApp and SMS aren’t available. Copy the message instead.</p> }
        <hr>
        <button type="button" class="btn btn-link p-0" (click)="sent('manual')">I already told them. Mark as notified.</button>
      } @else if (error()) {
        <div class="alert alert-danger">{{ error() }}</div>
      } @else {
        <div class="skeleton" style="height: 160px"></div>
      }
    </app-modal>`,
})
export class NotifyDialogComponent implements OnInit {
  readonly order = input.required<Order>();
  readonly closed = output<void>();

  private readonly api = inject(OrdersApi);
  private readonly actions = inject(OrderActions);
  private readonly toast = inject(ToastService);

  readonly info = signal<Notification | null>(null);
  readonly error = signal<string | null>(null);

  async ngOnInit() {
    try { this.info.set(await this.api.notification(this.order().id)); } catch (e) { this.error.set(errorMessage(e)); }
  }

  /** The link itself opens in the browser; this records that the business sent it. */
  async sent(channel: string) {
    await this.actions.notified(this.order(), channel);
    this.toast.show('Marked as notified.');
    this.closed.emit();
  }

  async copy(message: string) {
    try { await navigator.clipboard.writeText(message); this.toast.show('Message copied. Paste it into any chat.'); } catch { this.toast.error('Couldn’t copy. Select the text and copy it.'); return; }
    await this.sent('copy');
  }
}
