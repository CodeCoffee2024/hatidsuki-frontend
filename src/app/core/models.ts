// Shapes returned by the Hatid Suki API (camelCase JSON).

export type Role = 'Owner' | 'Manager' | 'Staff';

export interface User {
  id: string; name: string; email: string; role: Role;
  workspaceId: string; workspaceName: string; currency: string; timezone: string; phoneCountryCode: string;
}
export interface Session { accessToken: string; user: User; }

export interface Item {
  id: string; name: string; description: string | null; price: number; category: string | null;
  unit: string; isAvailable: boolean; isArchived: boolean; sortOrder: number;
}

export type FieldType = 'shortText' | 'paragraph' | 'number' | 'email' | 'phone' | 'singleChoice' | 'dropdown'
  | 'multiChoice' | 'date' | 'time' | 'consent' | 'heading' | 'orderItems';

export interface OrderItemsSettings {
  source: 'all' | 'selected'; itemIds: string[]; allowGroupOrders: boolean; maxParts: number; allowLineNotes: boolean;
}
export interface FormField {
  id: string; type: FieldType; label: string; helpText?: string | null; required: boolean;
  role?: string | null; options: string[]; orderItems?: OrderItemsSettings | null;
}
export interface FormDefinition {
  intro?: string | null; thankYou?: string | null; paymentMessage?: string | null; closedMessage?: string | null;
  fields: FormField[];
}
export interface FormListItem {
  id: string; name: string; status: 'Draft' | 'Published' | 'Closed'; shortCode: string; publishedVersion: number | null;
  hasUnpublishedChanges: boolean; ordersCount: number; publicUrl: string;
}
export interface FormDetail {
  id: string; name: string; status: 'Draft' | 'Published' | 'Closed'; shortCode: string; publishedVersion: number | null;
  hasUnpublishedChanges: boolean; draft: FormDefinition; publicUrl: string;
}
export interface PublishResult { published: boolean; problems: string[]; form: FormDetail | null; }
export interface Source { id: string; name: string; code: string; isActive: boolean; scanCount: number; ordersCount: number; url: string; }

// ---- customer-facing ----
export interface PublicItem {
  id: string; name: string; description: string | null; price: number; category: string | null; unit: string; isAvailable: boolean;
}
export interface PublicLocation { id: string; name: string; note: string | null; }
export interface PublicForm {
  code: string; businessName: string; currency: string; formName: string; state: 'open' | 'closed';
  closedMessage: string | null; definition: FormDefinition | null; items: PublicItem[]; version: number; sourceName: string | null;
  locations: PublicLocation[];
}
export interface LineInput { itemId: string; quantity: number; note?: string | null; }
export interface PartInput { person: string | null; note?: string | null; lines: LineInput[]; }
export interface PlacedOrder {
  orderId: string; number: number; total: number; currency: string; trackingToken: string;
  thankYou: string | null; paymentMessage: string | null; people: number; deliveryTo: string | null;
}
export interface TrackingPart { person: string; isReady: boolean; isCancelled: boolean; items: string[]; }
export interface Tracking {
  number: number; status: OrderStatus; readyCount: number; activeCount: number; businessName: string; currency: string;
  total: number; paymentMessage: string | null; paymentStatus: string; updatedAtUtc: string; people: TrackingPart[];
  deliveryTo: string | null; deliveryNote: string | null;
}

// ---- orders ----
export type OrderStatus = 'New' | 'Ready' | 'Served' | 'Cancelled';
export interface OrderLine { itemName: string; quantity: number; unitPrice: number; lineTotal: number; note: string | null; }
export interface OrderPart {
  id: string; person: string; note: string | null; isReady: boolean; isPaid: boolean; paidBy: string | null;
  isCancelled: boolean; cancelReason: string | null; isLateAddition: boolean; subtotal: number; lines: OrderLine[];
}
export interface OrderAnswer { label: string; type: string; values: string[]; }
export interface OrderEvent { atUtc: string; type: string; message: string; by: string | null; }
export interface Order {
  id: string; number: number; status: OrderStatus; paymentStatus: 'Unpaid' | 'PartlyPaid' | 'Paid';
  customerName: string; customerPhone: string | null; customerEmail: string | null; source: string | null; channel: string;
  total: number; currency: string; createdAtUtc: string; updatedAtUtc: string; needsAttention: boolean; isStale: boolean;
  hasLateAddition: boolean; isNotified: boolean; notifiedChannel: string | null; activeCount: number; readyCount: number;
  paidCount: number; unpaidAmount: number; trackingToken: string; parts: OrderPart[]; answers: OrderAnswer[] | null; events: OrderEvent[] | null;
  deliveryLocation: string | null; deliveryNote: string | null;
}
export interface BoardCounters { new: number; readyWaiting: number; unacknowledged: number; unpaidOrders: number; cashToCollect: number; olderOpen: number; }
export interface PrepLine { item: string; quantity: number; people: number; }
export interface Board { orders: Order[]; counters: BoardCounters; prep: PrepLine[]; serverTimeUtc: string; }
export interface EntryForm { code: string; name: string; allowGroupOrders: boolean; maxParts: number; itemSource: 'all' | 'selected'; itemIds: string[]; }
export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number; }
export interface Notification { message: string; whatsAppLink: string | null; smsLink: string | null; emailLink: string | null; trackingLink: string; }

export interface DeliveryLocation { id: string; name: string; note: string | null; isActive: boolean; sortOrder: number; }

// ---- items bulk ----
export interface BulkRow { name: string; price: string; category: string; description?: string; unit?: string; }
export interface BulkRowResult { row: number; status: 'created' | 'updated' | 'skipped' | 'error'; message: string | null; }
export interface BulkResult { created: number; updated: number; skipped: number; errors: number; dryRun: boolean; rows: BulkRowResult[]; }

// ---- dashboard ----
export interface Kpis { orders: number; people: number; sales: number; collected: number; outstanding: number; averageOrder: number; cancelled: number; }
export interface Dashboard {
  from: string; to: string; currency: string; timezone: string; kpis: Kpis; previous: Kpis | null;
  series: { date: string; orders: number; sales: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
  bySource: { source: string; orders: number; sales: number }[];
  byStatus: { status: string; count: number }[];
  busiest: { dayOfWeek: number; hour: number; orders: number }[];
  byLocation: { location: string; orders: number; people: number }[];
}
