import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CatalogApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/http';
import { FormDetail, Source } from '../../core/models';
import { ToastService } from '../../core/ui';
import { ModalComponent } from '../../shared/modal';

interface Qr { url: SafeUrl; raw: string; }

/**
 * Get the QR code, and make one for every table, flyer or post so you can see which one brings orders.
 * The QR encodes a short link that never changes, so printed codes keep working even if you rename things.
 */
@Component({
  selector: 'app-share',
  imports: [FormsModule, RouterLink, ModalComponent],
  template: `
    <div class="page screen-only">
      <a [routerLink]="['/app/forms', id()]" class="back"><i class="bi bi-chevron-left"></i> Edit form</a>
      @if (loadError()) { <div class="alert alert-danger">{{ loadError() }}</div> }
      @if (form(); as f) {
        <div class="page-head"><div><h1>QR &amp; share</h1><p>{{ f.name }}. Customers scan this code to order. They don’t need an app or an account.</p></div></div>

        <div class="hero card-lite">
          <div class="qr-box">
            @if (main(); as m) { <img [src]="m.url" width="240" height="240" alt="QR code that opens your order page"> } @else { <div class="skeleton" style="width: 240px; height: 240px"></div> }
          </div>
          <div class="hero-text">
            <h2>Your main order QR</h2>
            <p class="text-muted">Put it on the counter, the door or your menu. Customers point their phone camera at it.</p>
            <div class="link"><code>{{ f.publicUrl }}</code><button type="button" class="btn btn-ghost btn-sm" (click)="copy(f.publicUrl)"><i class="bi bi-clipboard"></i> Copy link</button></div>
            <div class="d-flex flex-wrap gap-2 mt-3">
              <button type="button" class="btn btn-primary" (click)="download('svg')"><i class="bi bi-download"></i> Download (print quality)</button>
              <button type="button" class="btn btn-ghost" (click)="download('png')">PNG</button>
              <button type="button" class="btn btn-ghost" (click)="printMain()"><i class="bi bi-printer"></i> Print a sign</button>
              <a class="btn btn-ghost" [href]="waLink()" target="_blank" rel="noopener"><i class="bi bi-whatsapp"></i> Share by WhatsApp</a>
            </div>
          </div>
        </div>

        <section class="card-lite sources">
          <header>
            <div><h2>One QR per table, flyer or post</h2><p class="text-muted mb-0">Each gets its own code. Orders are tagged with where they came from, so your dashboard shows what works.</p></div>
            @if (sources().length) { <button type="button" class="btn btn-ghost" (click)="printAll()" [disabled]="printing()"><i class="bi bi-printer"></i> {{ printing() ? 'Preparing…' : 'Print all signs' }}</button> }
          </header>

          <form class="adders" (ngSubmit)="addRange()">
            <div class="adder">
              <span class="lbl">Tables</span>
              <input class="form-control form-control-sm w-auto" style="width: 110px !important" [(ngModel)]="prefix" name="prefix" placeholder="Table" aria-label="Prefix">
              <input class="form-control form-control-sm" type="number" min="1" [(ngModel)]="from" name="from" aria-label="From number" style="width: 70px">
              <span>to</span>
              <input class="form-control form-control-sm" type="number" min="1" [(ngModel)]="to" name="to" aria-label="To number" style="width: 70px">
              <button class="btn btn-primary btn-sm" type="submit" [disabled]="busy()">Create</button>
            </div>
          </form>
          <form class="adders" (ngSubmit)="addNamed()">
            <div class="adder">
              <span class="lbl">Or one name</span>
              <input class="form-control form-control-sm" style="max-width: 260px" [(ngModel)]="single" name="single" placeholder="e.g. Flyer – March, Instagram bio" maxlength="60" aria-label="Source name">
              <button class="btn btn-ghost btn-sm" type="submit" [disabled]="busy() || !single.trim()">Add</button>
            </div>
          </form>

          @if (sources().length) {
            <table class="table align-middle mb-0">
              <thead><tr><th>Name</th><th class="text-end">Scans</th><th class="text-end">Orders</th><th></th></tr></thead>
              <tbody>
                @for (s of sources(); track s.id) {
                  <tr [class.off]="!s.isActive">
                    <td><strong>{{ s.name }}</strong> @if (!s.isActive) { <span class="chip chip-muted">Off</span> }</td>
                    <td class="text-end num">{{ s.scanCount }}</td><td class="text-end num">{{ s.ordersCount }}</td>
                    <td class="text-end text-nowrap">
                      <button type="button" class="btn btn-ghost btn-sm" (click)="view(s)"><i class="bi bi-qr-code"></i> View QR</button>
                      <button type="button" class="btn btn-ghost btn-sm" (click)="toggle(s)">{{ s.isActive ? 'Turn off' : 'Turn on' }}</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <div class="empty"><i class="bi bi-grid-3x3-gap"></i><h3>No tables or sources yet</h3><p>Create Table 1 to 10 in one step above.</p></div>
          }
        </section>
      }
    </div>

    @if (viewing(); as s) {
      <app-modal [heading]="s.name" [width]="420" (closed)="viewing.set(null); viewQr.set(null)">
        <div class="text-center">
          @if (viewQr(); as q) { <img [src]="q.url" width="280" height="280" [alt]="'QR code for ' + s.name"> } @else { <div class="skeleton mx-auto" style="width: 280px; height: 280px"></div> }
          <p class="text-muted small mt-2 mb-3"><code>{{ s.url }}</code></p>
          <button type="button" class="btn btn-primary" (click)="printOne(s)"><i class="bi bi-printer"></i> Print this sign</button>
        </div>
      </app-modal>
    }

    <!-- Printed signs: hidden on screen, the only thing visible when printing -->
    <div class="print-sheet">
      @for (t of tents(); track t.title) {
        <section class="tent">
          <div class="biz">{{ auth.user()?.workspaceName }}</div>
          <div class="scan">Scan to order</div>
          <img [src]="t.qr" alt="">
          <div class="which">{{ t.title }}</div>
          <div class="hint">Point your phone camera at the code. No app needed.</div>
        </section>
      }
    </div>
  `,
  styles: `
    .back { display: inline-block; margin-bottom: .5rem; color: var(--hs-muted); text-decoration: none; font-weight: 600; }
    .hero { display: flex; gap: 2rem; padding: 1.5rem; align-items: center; flex-wrap: wrap; margin-bottom: 1.25rem; }
    .qr-box { padding: 14px; background: #fff; border: 1px solid var(--hs-line); border-radius: 18px; }
    .qr-box img { display: block; }
    .hero-text { flex: 1; min-width: 260px; } .hero-text h2 { font-size: 1.25rem; font-weight: 750; }
    .link { display: flex; gap: .5rem; align-items: center; background: var(--hs-surface-2); border: 1px solid var(--hs-line); border-radius: 10px; padding: .35rem .35rem .35rem .7rem; flex-wrap: wrap; }
    .link code { flex: 1; overflow-wrap: anywhere; color: var(--hs-ink); }
    .sources { padding: 1.25rem; } .sources header { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .sources h2 { font-size: 1.15rem; font-weight: 750; }
    .adders { margin-bottom: .6rem; } .adder { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; } .adder .lbl { font-weight: 650; min-width: 84px; }
    table { margin-top: 1rem; } th { font-size: .82rem; color: var(--hs-muted); font-weight: 600; }
    tr.off { opacity: .6; }
    .print-sheet { display: none; }
    @media print {
      .screen-only, app-modal { display: none !important; }
      .print-sheet { display: block; }
      .tent { page-break-after: always; text-align: center; padding: 14mm 10mm; font-family: system-ui, sans-serif; color: #000; }
      .tent .biz { font-size: 26pt; font-weight: 800; }
      .tent .scan { font-size: 40pt; font-weight: 900; margin: 6mm 0; letter-spacing: -.5px; }
      .tent img { width: 110mm; height: 110mm; }
      .tent .which { font-size: 30pt; font-weight: 800; margin-top: 6mm; }
      .tent .hint { font-size: 14pt; margin-top: 4mm; color: #333; }
    }
  `,
})
export class ShareComponent implements OnInit, OnDestroy {
  readonly id = input.required<string>();
  private readonly api = inject(CatalogApi);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly form = signal<FormDetail | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly main = signal<Qr | null>(null);
  readonly sources = signal<Source[]>([]);
  readonly viewing = signal<Source | null>(null);
  readonly viewQr = signal<Qr | null>(null);
  readonly tents = signal<{ title: string; qr: SafeUrl }[]>([]);
  readonly busy = signal(false);
  readonly printing = signal(false);
  readonly waLink = computed(() => `https://wa.me/?text=${encodeURIComponent(`Order from ${this.auth.user()?.workspaceName}: ${this.form()?.publicUrl ?? ''}`)}`);

  prefix = 'Table'; from = 1; to = 10; single = '';
  private urls: string[] = [];

  async ngOnInit() {
    try {
      const f = await this.api.form(this.id());
      this.form.set(f);
      if (f.status === 'Draft') { this.loadError.set('Publish this form first. Its QR code will appear here.'); return; }
      this.main.set(await this.qr());
      this.sources.set(await this.api.sources(this.id()));
    } catch (e) { this.loadError.set(errorMessage(e)); }
  }

  ngOnDestroy() { this.urls.forEach(u => URL.revokeObjectURL(u)); }

  private async qr(sourceId?: string): Promise<Qr> {
    const blob = await this.api.qr(this.id(), 'svg', sourceId);
    const raw = URL.createObjectURL(blob); this.urls.push(raw);
    return { raw, url: this.sanitizer.bypassSecurityTrustUrl(raw) };
  }

  async copy(url: string) { try { await navigator.clipboard.writeText(url); this.toast.show('Link copied.'); } catch { this.toast.error('Couldn’t copy the link.'); } }

  async download(format: 'svg' | 'png') {
    try {
      const blob = await this.api.qr(this.id(), format);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${this.form()?.name ?? 'order'}-qr.${format}`; a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { this.toast.error(errorMessage(e)); }
  }

  async addRange() {
    if (this.to < this.from) { this.toast.error('The last number must be at least the first.'); return; }
    await this.add({ prefix: this.prefix.trim() || 'Table', from: this.from, to: this.to });
  }
  async addNamed() { await this.add({ names: [this.single] }); this.single = ''; }

  private async add(body: { names?: string[]; prefix?: string; from?: number; to?: number }) {
    this.busy.set(true);
    try { this.sources.set(await this.api.addSources(this.id(), body)); this.toast.show('Added.'); }
    catch (e) { this.toast.error(errorMessage(e)); } finally { this.busy.set(false); }
  }

  async toggle(s: Source) {
    try { await this.api.setSourceActive(this.id(), s.id, !s.isActive); this.sources.update(l => l.map(x => (x.id === s.id ? { ...x, isActive: !s.isActive } : x))); }
    catch (e) { this.toast.error(errorMessage(e)); }
  }

  async view(s: Source) { this.viewing.set(s); this.viewQr.set(await this.qr(s.id)); }

  printMain() { const m = this.main(); if (m) this.print([{ title: this.form()?.name ?? 'Order here', qr: m.url }]); }
  async printOne(s: Source) { const q = this.viewQr() ?? (await this.qr(s.id)); this.print([{ title: s.name, qr: q.url }]); }
  async printAll() {
    this.printing.set(true);
    try {
      const tents = [];
      for (const s of this.sources().filter(x => x.isActive)) tents.push({ title: s.name, qr: (await this.qr(s.id)).url });
      this.print(tents);
    } catch (e) { this.toast.error(errorMessage(e)); } finally { this.printing.set(false); }
  }

  private print(tents: { title: string; qr: SafeUrl }[]) {
    this.tents.set(tents);
    // Wait a beat so the sign images are in the page before the print dialog opens.
    setTimeout(() => window.print(), 250);
  }
}
