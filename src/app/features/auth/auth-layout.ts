import { Component } from '@angular/core';
import { BrandMarkComponent } from '../../shared/brand';

/** Shared frame for sign-in and register. Short on purpose: people here want to get to their orders. */
@Component({
  selector: 'app-auth-layout',
  imports: [BrandMarkComponent],
  template: `
    <div class="auth">
      <section class="pitch">
        <div class="mark"><app-brand-mark [size]="32" body="#fbf1e4" face="#b93a14" check="#fbf1e4" />Hatid Suki</div>
        <div class="say">
          <h1>Every person’s order, checked off.</h1>
          <p>Customers scan your QR code and order, alone or for a whole group. Each person becomes a separate line that you tick off when it’s ready, so nothing gets lost in a chat thread.</p>
        </div>
      </section>
      <section class="panel"><div class="panel-inner"><ng-content /></div></section>
    </div>`,
  styles: `
    .auth { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1fr); min-height: 100vh; }
    .pitch { background: #1f1c17; color: #f4efe5; padding: clamp(1.5rem, 5vw, 3.5rem); display: flex; flex-direction: column; justify-content: space-between; gap: 3rem; }
    .mark { display: flex; align-items: center; gap: .6rem; font-weight: 750; font-size: 1.15rem; letter-spacing: -.01em; }
    .say { max-width: 30rem; }
    h1 { font-size: clamp(1.9rem, 3.2vw, 2.6rem); font-weight: 750; line-height: 1.1; margin: 0 0 1rem; }
    p { color: #d3cbbb; font-size: 1.05rem; margin: 0; }
    .panel { display: grid; place-items: center; padding: 2rem 1.25rem; background: var(--hs-bg); }
    .panel-inner { width: min(100%, 400px); }
    @media (max-width: 860px) { .auth { grid-template-columns: 1fr; } .pitch { padding: 1.25rem; gap: .75rem; } .say p { display: none; } h1 { font-size: 1.5rem; margin: 0; } }
  `,
})
export class AuthLayoutComponent {}
