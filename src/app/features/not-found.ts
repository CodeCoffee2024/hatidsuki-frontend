import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <div class="empty" style="min-height: 100vh; display: grid; place-content: center;">
      <i class="bi bi-compass"></i>
      <h1 class="h3">We can’t find that page</h1>
      <p>The link may be old or mistyped.</p>
      <div><a class="btn btn-primary" routerLink="/">Go to Hatid Suki</a></div>
    </div>`,
})
export class NotFoundComponent {}
