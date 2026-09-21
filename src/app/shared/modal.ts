import { Component, ElementRef, HostListener, afterNextRender, inject, input, output } from '@angular/core';

/** A simple accessible dialog: Esc or a click outside closes it, and focus moves inside when it opens. */
@Component({
  selector: 'app-modal',
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    <div class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="heading()" [style.max-width.px]="width()" tabindex="-1">
      <header>
        <h2>{{ heading() }}</h2>
        <button type="button" class="btn-close" aria-label="Close" (click)="closed.emit()"></button>
      </header>
      <div class="body"><ng-content /></div>
    </div>`,
  styles: `
    .backdrop { position: fixed; inset: 0; background: rgba(31, 27, 22, .5); z-index: 1040; }
    .dialog { position: fixed; z-index: 1050; left: 50%; top: 50%; transform: translate(-50%, -50%); width: calc(100% - 1.5rem); max-height: calc(100vh - 2rem); overflow: auto;
      background: var(--hs-surface); border-radius: 18px; box-shadow: 0 24px 60px rgba(0,0,0,.3); outline: none; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem .4rem; }
    h2 { font-size: 1.2rem; font-weight: 750; margin: 0; }
    .body { padding: .6rem 1.25rem 1.25rem; }
  `,
})
export class ModalComponent {
  readonly heading = input.required<string>();
  readonly width = input(520);
  readonly closed = output<void>();
  private readonly host = inject(ElementRef<HTMLElement>);

  constructor() {
    afterNextRender(() => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>('input, textarea, button:not(.btn-close), [tabindex]')?.focus());
  }
  @HostListener('document:keydown.escape') onEsc() { this.closed.emit(); }
}
