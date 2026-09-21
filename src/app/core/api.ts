import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Board, BulkResult, EntryForm, BulkRow, Dashboard, FormDefinition, FormDetail, FormListItem, Item, Notification, Order, Paged,
  DeliveryLocation, PartInput, PlacedOrder, PublicForm, PublishResult, Source, Tracking, User
} from './models';

const params = (o: Record<string, string | number | boolean | null | undefined>) => {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
  return p;
};

/** Items, forms, QR codes and workspace settings (owners and managers). */
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);

  items(search?: string, includeArchived = false) {
    return firstValueFrom(this.http.get<Item[]>('/api/items', { params: params({ search, includeArchived }) }));
  }
  saveItem(id: string | null, body: { name: string; price: number; category: string | null; description: string | null; unit: string | null }) {
    return firstValueFrom(id ? this.http.put<Item>(`/api/items/${id}`, body) : this.http.post<Item>('/api/items', body));
  }
  setAvailability(id: string, available: boolean) { return firstValueFrom(this.http.put<Item>(`/api/items/${id}/availability`, { available })); }
  setArchived(id: string, archived: boolean) { return firstValueFrom(this.http.put<Item>(`/api/items/${id}/archived`, { archived })); }
  bulk(rows: BulkRow[], onDuplicate: 'skip' | 'update', dryRun: boolean) {
    return firstValueFrom(this.http.post<BulkResult>('/api/items/bulk', { rows, onDuplicate, dryRun }));
  }

  forms() { return firstValueFrom(this.http.get<FormListItem[]>('/api/forms')); }
  form(id: string) { return firstValueFrom(this.http.get<FormDetail>(`/api/forms/${id}`)); }
  createForm(name: string) { return firstValueFrom(this.http.post<FormDetail>('/api/forms', { name })); }
  saveForm(id: string, name: string, definition: FormDefinition) {
    return firstValueFrom(this.http.put<FormDetail>(`/api/forms/${id}`, { name, definition }));
  }
  publish(id: string) { return firstValueFrom(this.http.post<PublishResult>(`/api/forms/${id}/publish`, {})); }
  setFormStatus(id: string, action: 'close' | 'reopen') { return firstValueFrom(this.http.post<FormListItem>(`/api/forms/${id}/status`, { action })); }

  sources(formId: string) { return firstValueFrom(this.http.get<Source[]>(`/api/forms/${formId}/sources`)); }
  addSources(formId: string, body: { names?: string[]; prefix?: string; from?: number; to?: number }) {
    return firstValueFrom(this.http.post<Source[]>(`/api/forms/${formId}/sources`, body));
  }
  setSourceActive(formId: string, sourceId: string, active: boolean) {
    return firstValueFrom(this.http.put<void>(`/api/forms/${formId}/sources/${sourceId}`, { active }));
  }
  /** The QR image is fetched with the sign-in token, then shown from a local blob URL. */
  qr(formId: string, format: 'svg' | 'png', sourceId?: string, size = 900) {
    return firstValueFrom(this.http.get(`/api/forms/${formId}/qr`, { params: params({ format, source: sourceId, size }), responseType: 'blob' }));
  }

  deliveryLocations(includeHidden = false) {
    return firstValueFrom(this.http.get<DeliveryLocation[]>('/api/delivery-locations', { params: params({ includeHidden }) }));
  }
  saveDeliveryLocation(id: string | null, body: { name: string; note: string | null }) {
    return firstValueFrom(id ? this.http.put<DeliveryLocation>(`/api/delivery-locations/${id}`, body) : this.http.post<DeliveryLocation>('/api/delivery-locations', body));
  }
  addDeliveryLocations(names: string[]) { return firstValueFrom(this.http.post<DeliveryLocation[]>('/api/delivery-locations/bulk', { names })); }
  setDeliveryLocationActive(id: string, active: boolean) { return firstValueFrom(this.http.put<DeliveryLocation>(`/api/delivery-locations/${id}/active`, { active })); }

  updateWorkspace(body: { name: string; currency: string; timezone: string; phoneCountryCode: string | null }) {
    return firstValueFrom(this.http.put<User>('/api/auth/workspace', body));
  }
}

/** Everything staff do with orders. */
@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly http = inject(HttpClient);
  private post<T>(path: string, body: unknown = {}) { return firstValueFrom(this.http.post<T>(`/api/orders/${path}`, body)); }

  board(search?: string) { return firstValueFrom(this.http.get<Board>('/api/orders/board', { params: params({ search }) })); }
  list(q: { status?: string; payment?: string; search?: string; from?: string; to?: string; page?: number; pageSize?: number }) {
    return firstValueFrom(this.http.get<Paged<Order>>('/api/orders', { params: params(q) }));
  }
  get(id: string) { return firstValueFrom(this.http.get<Order>(`/api/orders/${id}`)); }
  entryForms() { return firstValueFrom(this.http.get<EntryForm[]>('/api/orders/entry-forms')); }

  partReady(id: string, partId: string, ready: boolean) { return this.post<Order>(`${id}/parts/${partId}/ready`, { ready }); }
  readyAll(id: string) { return this.post<Order>(`${id}/ready-all`); }
  serve(id: string) { return this.post<Order>(`${id}/serve`); }
  cancel(id: string, reason: string) { return this.post<Order>(`${id}/cancel`, { reason }); }
  partPaid(id: string, partId: string, paid: boolean) { return this.post<Order>(`${id}/parts/${partId}/paid`, { paid }); }
  orderPaid(id: string, paid: boolean) { return this.post<Order>(`${id}/paid`, { paid }); }
  acknowledge(id: string) { return this.post<Order>(`${id}/acknowledge`); }
  notified(id: string, channel: string | null, undo = false) { return this.post<Order>(`${id}/notified`, { channel, undo }); }
  notification(id: string) { return firstValueFrom(this.http.get<Notification>(`/api/orders/${id}/notification`)); }
  addPart(id: string, part: PartInput) { return this.post<Order>(`${id}/parts`, part); }
  cancelPart(id: string, partId: string, reason: string) { return this.post<Order>(`${id}/parts/${partId}/cancel`, { reason }); }

  manual(body: {
    formCode: string; customerName: string; customerPhone: string; manualType: string;
    answers: Record<string, string[]>; parts: PartInput[]; markPaid: boolean; markServed: boolean;
    deliveryLocationId: string | null; deliveryNote: string | null;
  }) { return this.post<PlacedOrder>('manual', body); }
}

/** What customers reach from a QR code: no sign-in needed. */
@Injectable({ providedIn: 'root' })
export class PublicApi {
  private readonly http = inject(HttpClient);

  form(code: string, source?: string) { return firstValueFrom(this.http.get<PublicForm>(`/api/public/forms/${code}`, { params: params({ s: source }) })); }
  placeOrder(body: {
    formCode: string; sourceCode: string | null; idempotencyKey: string; answers: Record<string, string[]>; parts: PartInput[];
    deliveryLocationId: string | null; deliveryNote: string | null;
  }) { return firstValueFrom(this.http.post<PlacedOrder>('/api/public/orders', body)); }
  track(token: string) { return firstValueFrom(this.http.get<Tracking>(`/api/public/track/${token}`)); }
}

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly http = inject(HttpClient);
  get(from?: string, to?: string) { return firstValueFrom(this.http.get<Dashboard>('/api/dashboard', { params: params({ from, to }) })); }
}
