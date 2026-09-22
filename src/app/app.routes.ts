import { Routes } from '@angular/router';
import { authGuard, guestGuard, platformAuthGuard, roleGuard } from './core/http';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login').then(m => m.LoginComponent) },
  { path: 'register', canActivate: [guestGuard], loadComponent: () => import('./features/auth/register').then(m => m.RegisterComponent) },

  // The platform operator's own console. Deliberately outside /app: no business's Owner/Manager/Staff role reaches this.
  { path: 'platform/login', loadComponent: () => import('./features/platform/platform-login').then(m => m.PlatformLoginComponent) },
  { path: 'platform', canActivate: [platformAuthGuard], loadComponent: () => import('./features/platform/platform-dashboard').then(m => m.PlatformDashboardComponent) },

  // Customer-facing pages: no sign-in. Reached from a QR code.
  { path: 'q/:code', loadComponent: () => import('./features/public/public-order').then(m => m.PublicOrderComponent) },
  { path: 't/:token', loadComponent: () => import('./features/public/tracking').then(m => m.TrackingComponent) },

  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell').then(m => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'board' },
      { path: 'board', title: 'Orders board', loadComponent: () => import('./features/board/board').then(m => m.BoardComponent) },
      { path: 'orders', title: 'All orders', loadComponent: () => import('./features/orders/orders').then(m => m.OrdersComponent) },
      { path: 'orders/new', title: 'New order', loadComponent: () => import('./features/orders/manual-order').then(m => m.ManualOrderComponent) },
      { path: 'items', title: 'Items', loadComponent: () => import('./features/items/items').then(m => m.ItemsComponent) },
      { path: 'forms', title: 'Forms', canActivate: [roleGuard('Owner', 'Manager')], loadComponent: () => import('./features/forms/forms').then(m => m.FormsComponent) },
      { path: 'forms/:id', title: 'Edit form', canActivate: [roleGuard('Owner', 'Manager')], loadComponent: () => import('./features/forms/form-builder').then(m => m.FormBuilderComponent) },
      { path: 'forms/:id/share', title: 'QR & share', canActivate: [roleGuard('Owner', 'Manager')], loadComponent: () => import('./features/forms/share').then(m => m.ShareComponent) },
      { path: 'delivery', title: 'Delivery locations', canActivate: [roleGuard('Owner', 'Manager')], loadComponent: () => import('./features/delivery/delivery').then(m => m.DeliveryComponent) },
      { path: 'dashboard', title: 'Dashboard', canActivate: [roleGuard('Owner', 'Manager')], loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardComponent) },
      { path: 'settings', title: 'Settings', canActivate: [roleGuard('Owner', 'Manager')], loadComponent: () => import('./features/settings/settings').then(m => m.SettingsComponent) },
    ],
  },

  { path: '', pathMatch: 'full', redirectTo: 'app' },
  { path: '**', title: 'Not found', loadComponent: () => import('./features/not-found').then(m => m.NotFoundComponent) },
];
