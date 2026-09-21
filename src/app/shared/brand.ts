import { Component, input } from '@angular/core';

/**
 * The Hatid Suki mark: a location pin (hatid, delivered to a place) whose head is a bilao, the round woven tray, with a check.
 * This is the simple version for interface sizes. The detailed one with the woven pattern lives in public/logo-mark.svg.
 */
@Component({
  selector: 'app-brand-mark',
  template: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="24 40 464 464" [attr.width]="size()" [attr.height]="size()" aria-hidden="true" focusable="false">
      <path d="M 134.95 302.58 A 150 150 0 1 1 377.05 302.58 L 256 468 Z" [attr.fill]="body()" [attr.stroke]="body()" stroke-width="20" stroke-linejoin="round" />
      <circle cx="256" cy="214" r="108" [attr.fill]="face()" />
      <path d="M 190 220 L 240 270 L 326 164" fill="none" [attr.stroke]="check()" stroke-width="46" stroke-linecap="round" stroke-linejoin="round" />
    </svg>`,
  styles: `:host { display: inline-flex; flex: none; } svg { display: block; }`,
})
export class BrandMarkComponent {
  readonly size = input(32);
  readonly body = input('#b93a14');
  readonly face = input('#fbf1e4');
  readonly check = input('#8f2b0e');
}
