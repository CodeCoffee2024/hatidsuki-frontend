import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { BrandMarkComponent } from '../../shared/brand';
import { ModalComponent } from '../../shared/modal';
import { BoardStore } from '../board/board.store';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BrandMarkComponent, ModalComponent],
  template: `
    <div class="shell">
      <aside class="side" aria-label="Main">
        <a class="brand" routerLink="/app/board" aria-label="Hatid Suki home">
          <app-brand-mark [size]="30" /><span class="brand-text"><strong>Hatid Suki</strong><small>{{ auth.user()?.workspaceName }}</small></span>
        </a>

        <a class="btn btn-primary new-order" routerLink="/app/orders/new" aria-label="New order"><i class="bi bi-plus-lg"></i> <span>New order</span></a>

        <nav class="nav-list">
          <a routerLink="/app/board" routerLinkActive="active">
            <i class="bi bi-check2-square"></i><span>Board</span>
            @if ((store.counters()?.new ?? 0) > 0) { <span class="count" [attr.aria-label]="store.counters()!.new + ' new orders'">{{ store.counters()!.new }}</span> }
          </a>
          <a routerLink="/app/orders" routerLinkActive="active"><i class="bi bi-receipt"></i><span>All orders</span></a>
          <a routerLink="/app/items" routerLinkActive="active"><i class="bi bi-basket3"></i><span>Items</span></a>
          @if (auth.canSeeMoney()) {
            <a routerLink="/app/forms" routerLinkActive="active"><i class="bi bi-ui-checks-grid"></i><span>Forms &amp; QR</span></a>
            <a routerLink="/app/delivery" routerLinkActive="active"><i class="bi bi-geo-alt"></i><span>Delivery</span></a>
            <a routerLink="/app/dashboard" routerLinkActive="active"><i class="bi bi-graph-up-arrow"></i><span>Dashboard</span></a>
            <a routerLink="/app/settings" routerLinkActive="active"><i class="bi bi-gear"></i><span>Settings</span></a>
          }
        </nav>

        <div class="who">
          <div class="who-text"><strong>{{ auth.user()?.name }}</strong><small>{{ auth.user()?.role }}</small></div>
          <button type="button" class="btn btn-ghost btn-sm signout" (click)="auth.logout()" aria-label="Sign out"><i class="bi bi-box-arrow-right"></i></button>
        </div>
      </aside>

      <main class="main"><router-outlet /></main>

      <!-- Mobile only: a bottom tab bar replaces the sidebar nav. Everything not shown here lives behind "More". -->
      <nav class="tabbar" aria-label="Main">
        <a routerLink="/app/board" routerLinkActive="on">
          <i class="bi bi-check2-square"></i><span>Board</span>
          @if ((store.counters()?.new ?? 0) > 0) { <span class="dot" aria-hidden="true"></span> }
        </a>
        <a routerLink="/app/orders" routerLinkActive="on"><i class="bi bi-receipt"></i><span>Orders</span></a>
        <a routerLink="/app/orders/new" class="add" aria-label="New order"><i class="bi bi-plus-lg"></i></a>
        <a routerLink="/app/items" routerLinkActive="on"><i class="bi bi-basket3"></i><span>Items</span></a>
        @if (auth.canSeeMoney()) {
          <button type="button" (click)="more.set(true)"><i class="bi bi-three-dots"></i><span>More</span></button>
        } @else {
          <button type="button" (click)="auth.logout()"><i class="bi bi-box-arrow-right"></i><span>Sign out</span></button>
        }
      </nav>
    </div>

    @if (more()) {
      <app-modal heading="More" [width]="360" (closed)="more.set(false)">
        <nav class="more-list">
          <a routerLink="/app/forms" (click)="more.set(false)"><i class="bi bi-ui-checks-grid"></i> Forms &amp; QR</a>
          <a routerLink="/app/delivery" (click)="more.set(false)"><i class="bi bi-geo-alt"></i> Delivery</a>
          <a routerLink="/app/dashboard" (click)="more.set(false)"><i class="bi bi-graph-up-arrow"></i> Dashboard</a>
          <a routerLink="/app/settings" (click)="more.set(false)"><i class="bi bi-gear"></i> Settings</a>
          <button type="button" (click)="auth.logout()"><i class="bi bi-box-arrow-right"></i> Sign out</button>
        </nav>
      </app-modal>
    }`,
  styles: `
    .shell { display: grid; grid-template-columns: 250px 1fr; min-height: 100vh; }
    .side { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; gap: 1rem; padding: 1.1rem 1rem; background: var(--hs-surface); border-right: 1px solid var(--hs-line); }
    .brand { display: flex; align-items: center; gap: .7rem; text-decoration: none; color: var(--hs-ink); }
    .brand-text { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; }
    .brand-text small { color: var(--hs-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .new-order { display: flex; align-items: center; justify-content: center; gap: .4rem; padding: .65rem; }
    .nav-list { display: flex; flex-direction: column; gap: .15rem; flex: 1; }
    .nav-list a { display: flex; align-items: center; gap: .7rem; padding: .62rem .8rem; border-radius: 10px; color: var(--hs-ink); text-decoration: none; font-weight: 550; }
    .nav-list a:hover { background: var(--hs-surface-2); }
    .nav-list a.active { background: var(--hs-primary-soft); color: var(--hs-primary-hover); }
    .nav-list .bi { font-size: 1.1rem; width: 1.25rem; text-align: center; }
    .count { margin-left: auto; background: var(--hs-attn); color: #fff; border-radius: 4px; padding: 0 .45rem; font-size: .75rem; font-weight: 700; min-width: 1.4rem; text-align: center; }
    .who { display: flex; align-items: center; gap: .6rem; padding-top: .9rem; border-top: 1px solid var(--hs-line); }
    .who-text { display: flex; flex-direction: column; line-height: 1.15; flex: 1; min-width: 0; }
    .who-text small { color: var(--hs-muted); }
    .main { min-width: 0; }
    .tabbar { display: none; }
    .more-list { display: flex; flex-direction: column; gap: .15rem; }
    .more-list a, .more-list button { display: flex; align-items: center; gap: .8rem; padding: .8rem .7rem; border-radius: 10px; color: var(--hs-ink); text-decoration: none;
      font-weight: 550; font-size: 1rem; border: 0; background: none; width: 100%; text-align: left; min-height: 48px; }
    .more-list a:hover, .more-list button:hover { background: var(--hs-surface-2); }
    .more-list .bi { font-size: 1.15rem; width: 1.4rem; text-align: center; color: var(--hs-muted); }

    /* Mobile: the sidebar becomes a slim top bar (brand · new order · sign out); a fixed bottom tab bar replaces
       the in-sidebar nav, so wayfinding never costs a horizontal scroll or eats vertical space from the page itself. */
    @media (max-width: 860px) {
      .shell { grid-template-columns: 1fr; padding-bottom: calc(60px + env(safe-area-inset-bottom)); }
      .side { position: sticky; top: 0; z-index: 25; height: auto; flex-direction: row; align-items: center; padding: .6rem .8rem;
        gap: .6rem; border-right: 0; border-bottom: 1px solid var(--hs-line); }
      .brand-text small { display: none; }
      .nav-list, .who-text { display: none; }
      .new-order { margin-left: auto; padding: .5rem .9rem; }
      .new-order span { display: none; }
      .who { border: 0; padding: 0; }
      .signout { min-width: 44px; min-height: 44px; }

      .tabbar { display: grid; grid-template-columns: repeat(5, 1fr); position: fixed; left: 0; right: 0; bottom: 0; z-index: 25;
        background: var(--hs-surface); border-top: 1px solid var(--hs-line); padding-bottom: env(safe-area-inset-bottom); }
      .tabbar a, .tabbar button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .15rem;
        padding: .45rem .2rem; min-height: 56px; color: var(--hs-muted); text-decoration: none; font-size: .68rem; font-weight: 650;
        border: 0; background: none; position: relative; }
      .tabbar .bi { font-size: 1.3rem; }
      .tabbar a.on { color: var(--hs-primary-hover); }
      .tabbar .dot { position: absolute; top: .3rem; right: 30%; width: 8px; height: 8px; border-radius: 50%; background: var(--hs-attn); }
      .tabbar .add { color: #fff; }
      .tabbar .add .bi { background: var(--hs-primary); width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; font-size: 1.4rem; }
    }
  `,
})
export class ShellComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly store = inject(BoardStore);
  readonly more = signal(false);

  ngOnInit() { this.store.start(); }
  ngOnDestroy() { this.store.stop(); }
}
