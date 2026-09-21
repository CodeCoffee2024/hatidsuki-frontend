import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { BrandMarkComponent } from '../../shared/brand';
import { BoardStore } from '../board/board.store';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BrandMarkComponent],
  template: `
    <div class="shell">
      <aside class="side" aria-label="Main">
        <a class="brand" routerLink="/app/board" aria-label="Hatid Suki home">
          
          <app-brand-mark [size]="30" /><span class="brand-text"><strong>Hatid Suki</strong><small>{{ auth.user()?.workspaceName }}</small></span>
        </a>

        <a class="btn btn-primary new-order" routerLink="/app/orders/new"><i class="bi bi-plus-lg"></i> New order</a>

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
          <button type="button" class="btn btn-ghost btn-sm" (click)="auth.logout()" aria-label="Sign out"><i class="bi bi-box-arrow-right"></i></button>
        </div>
      </aside>
      <main class="main"><router-outlet /></main>
    </div>`,
  styles: `
    .shell { display: grid; grid-template-columns: 250px 1fr; min-height: 100vh; }
    .side { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; gap: 1rem; padding: 1.1rem 1rem; background: var(--hs-surface); border-right: 1px solid var(--hs-line); }
    .brand { display: flex; align-items: center; gap: .7rem; text-decoration: none; color: var(--hs-ink); }
    .logo { width: 38px; height: 38px; border-radius: 11px; background: var(--hs-primary); color: #fff; display: grid; place-items: center; font-size: 1.15rem; }
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
    .avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--hs-primary-soft); color: var(--hs-primary-hover); display: grid; place-items: center; font-weight: 700; }
    .who-text { display: flex; flex-direction: column; line-height: 1.15; flex: 1; min-width: 0; }
    .who-text small { color: var(--hs-muted); }
    .main { min-width: 0; }

    @media (max-width: 860px) {
      .shell { grid-template-columns: 1fr; }
      .side { position: static; height: auto; flex-direction: row; flex-wrap: wrap; align-items: center; padding: .6rem .8rem; gap: .5rem; border-right: 0; border-bottom: 1px solid var(--hs-line); }
      .brand-text small, .who-text { display: none; }
      .new-order { order: 2; margin-left: auto; padding: .45rem .8rem; }
      .who { order: 3; border: 0; padding: 0; }
      .nav-list { order: 4; flex: 0 0 100%; flex-direction: row; overflow-x: auto; gap: .25rem; padding-bottom: .1rem; }
      .nav-list a { padding: .5rem .7rem; white-space: nowrap; }
      .nav-list a span:not(.count) { font-size: .9rem; }
    }
  `,
})
export class ShellComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly store = inject(BoardStore);

  ngOnInit() { this.store.start(); }
  ngOnDestroy() { this.store.stop(); }
  initial() { return (this.auth.user()?.name ?? '?').charAt(0).toUpperCase(); }
}
