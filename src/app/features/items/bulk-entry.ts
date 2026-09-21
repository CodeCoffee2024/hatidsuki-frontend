import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogApi } from '../../core/api';
import { errorMessage } from '../../core/http';
import { BulkResult } from '../../core/models';
import { ToastService } from '../../core/ui';
import { ModalComponent } from '../../shared/modal';

type Col = 'name' | 'price' | 'category' | 'description';
const COLS: Col[] = ['name', 'price', 'category', 'description'];
interface Row { name: string; price: string; category: string; description: string; status?: string; message?: string | null; }
const blank = (): Row => ({ name: '', price: '', category: '', description: '' });

/** Split CSV/TSV text into cells, honouring quotes. The delimiter is detected from the first line. */
function parseDelimited(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  const delim = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

/**
 * Type or paste a whole item list like a spreadsheet. Enter moves down a row, Tab moves across, and pasting from Excel or
 * Google Sheets fills many rows at once. "Check" shows what would happen to every row before anything is saved.
 */
@Component({
  selector: 'app-bulk-entry',
  imports: [FormsModule, ModalComponent],
  template: `
    <app-modal heading="Add many items" [width]="900" (closed)="closed.emit()">
      @if (!result() || result()!.dryRun) {
        <p class="text-muted">Type your items below, or paste rows straight from a spreadsheet. Only the name and price are required.</p>
        <div class="tools">
          <label class="btn btn-ghost btn-sm mb-0"><i class="bi bi-upload"></i> Upload CSV<input type="file" accept=".csv,.tsv,.txt,text/csv" hidden (change)="onFile($any($event.target))"></label>
          <button type="button" class="btn btn-ghost btn-sm" (click)="template()"><i class="bi bi-download"></i> Template</button>
          <button type="button" class="btn btn-ghost btn-sm" (click)="addRows(5)"><i class="bi bi-plus"></i> 5 more rows</button>
          <div class="ms-auto d-flex align-items-center gap-2">
            <label class="mb-0 small text-muted" for="dup">If an item already exists</label>
            <select id="dup" class="form-select form-select-sm w-auto" [(ngModel)]="onDuplicate"><option value="skip">Skip it</option><option value="update">Update its price</option></select>
          </div>
        </div>

        <div class="grid-wrap">
          <table class="grid" aria-label="Items to add">
            <thead><tr><th class="n">#</th><th>Name *</th><th class="pr">Price *</th><th>Category</th><th>Description</th><th class="st">Result</th></tr></thead>
            <tbody>
              @for (r of rows(); track $index; let i = $index) {
                <tr [class.err]="r.status === 'error'" [class.skip]="r.status === 'skipped'">
                  <td class="n">{{ i + 1 }}</td>
                  @for (c of cols; track c) {
                    <td [class.pr]="c === 'price'">
                      <input class="cell" [id]="'r' + i + c" [attr.aria-label]="c + ' of row ' + (i + 1)" [inputMode]="c === 'price' ? 'decimal' : 'text'"
                             [ngModel]="r[c]" (ngModelChange)="set(i, c, $event)" (paste)="onPaste($event, i, c)" (keydown.enter)="enter($event, i, c)" autocomplete="off">
                    </td>
                  }
                  <td class="st">
                    @if (r.status === 'created') { <span class="chip chip-ready">New</span> }
                    @else if (r.status === 'updated') { <span class="chip chip-new">Update</span> }
                    @else if (r.status === 'skipped') { <span class="chip chip-muted" [title]="r.message ?? ''">Skip</span> }
                    @else if (r.status === 'error') { <span class="chip chip-cancelled" [title]="r.message ?? ''">{{ r.message }}</span> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (error()) { <div class="alert alert-danger mt-3">{{ error() }}</div> }
        @if (result(); as r) {
          <div class="summary mt-3" role="status">
            <span class="chip chip-ready">{{ r.created }} new</span>
            @if (r.updated) { <span class="chip chip-new">{{ r.updated }} to update</span> }
            @if (r.skipped) { <span class="chip chip-muted">{{ r.skipped }} skipped</span> }
            @if (r.errors) { <span class="chip chip-cancelled">{{ r.errors }} need fixing</span> }
          </div>
        }
        <div class="d-flex gap-2 justify-content-end mt-3">
          <button type="button" class="btn btn-ghost" (click)="closed.emit()">Cancel</button>
          <button type="button" class="btn btn-ghost" [disabled]="busy() || filled() === 0" (click)="run(true)">Check</button>
          <button type="button" class="btn btn-primary" [disabled]="busy() || filled() === 0" (click)="run(false)">{{ busy() ? 'Saving…' : 'Save ' + filled() + ' item' + (filled() === 1 ? '' : 's') }}</button>
        </div>
      } @else {
        <div class="done">
          <i class="bi bi-check-circle-fill"></i>
          <h3>{{ result()!.created + result()!.updated }} item{{ result()!.created + result()!.updated === 1 ? '' : 's' }} saved</h3>
          <p class="text-muted">{{ result()!.created }} new@if (result()!.updated) { , {{ result()!.updated }} updated }@if (result()!.skipped) { , {{ result()!.skipped }} skipped }@if (result()!.errors) { , {{ result()!.errors }} couldn’t be saved }.</p>
          @if (result()!.errors) {
            <ul class="errs">@for (x of failed(); track x.row) { <li>Row {{ x.row }}: {{ x.message }}</li> }</ul>
          }
          <button type="button" class="btn btn-primary" (click)="closed.emit()">Done</button>
        </div>
      }
    </app-modal>`,
  styles: `
    .tools { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; margin-bottom: .75rem; }
    .grid-wrap { max-height: 46vh; overflow: auto; border: 1px solid var(--hs-line); border-radius: 12px; }
    .grid { width: 100%; border-collapse: collapse; font-size: .95rem; }
    .grid th { position: sticky; top: 0; background: var(--hs-surface-2); font-size: .74rem; text-transform: uppercase; letter-spacing: .06em; color: var(--hs-muted); padding: .5rem .5rem; text-align: left; z-index: 1; }
    .grid td { border-top: 1px solid var(--hs-line); padding: 0; }
    .n { width: 38px; text-align: center; color: var(--hs-muted); font-variant-numeric: tabular-nums; } .pr { width: 110px; } .st { width: 150px; padding: 0 .5rem !important; }
    .cell { width: 100%; border: 0; padding: .6rem .6rem; background: transparent; }
    .cell:focus { outline: 2px solid var(--hs-primary); outline-offset: -2px; background: #fffaf6; }
    tr.err td { background: #fff5f5; } tr.skip td { background: #faf8f4; }
    .summary { display: flex; gap: .4rem; flex-wrap: wrap; }
    .done { text-align: center; padding: 1.5rem 0; } .done .bi { font-size: 2.6rem; color: #22a35a; }
    .errs { text-align: left; color: var(--hs-cancel); max-width: 480px; margin: 1rem auto; }
  `,
})
export class BulkEntryComponent {
  readonly closed = output<void>();
  readonly saved = output<void>();
  private readonly api = inject(CatalogApi);
  private readonly toast = inject(ToastService);

  readonly cols = COLS;
  readonly rows = signal<Row[]>(Array.from({ length: 8 }, blank));
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<BulkResult | null>(null);
  onDuplicate: 'skip' | 'update' = 'skip';

  readonly failed = computed(() => this.result()?.rows.filter(r => r.status === 'error') ?? []);
  filled() { return this.rows().filter(r => r.name.trim() || r.price.trim() || r.category.trim()).length; }

  set(i: number, c: Col, v: string) { this.rows.update(l => l.map((r, idx) => (idx === i ? { ...r, [c]: v, status: undefined, message: null } : r))); }
  addRows(n: number) { this.rows.update(l => [...l, ...Array.from({ length: n }, blank)]); }

  /** Enter moves down a row in the same column, adding a row at the bottom, like a spreadsheet. */
  enter(e: Event, i: number, c: Col) {
    e.preventDefault();
    if (i === this.rows().length - 1) this.addRows(1);
    setTimeout(() => document.getElementById(`r${i + 1}${c}`)?.focus());
  }

  /** Pasting several cells (from Excel / Google Sheets) fills the grid instead of dumping one big string in a cell. */
  onPaste(e: ClipboardEvent, i: number, c: Col) {
    const text = e.clipboardData?.getData('text') ?? '';
    if (!text.includes('\t') && !/\r?\n/.test(text.trim())) return; // a single value: let the browser paste normally
    e.preventDefault();
    this.fill(parseDelimited(text), COLS.indexOf(c), i);
  }

  async onFile(input: HTMLInputElement) {
    const file = input.files?.[0]; input.value = '';
    if (!file) return;
    if (file.size > 1_000_000) { this.error.set('That file is too large (limit 1 MB).'); return; }
    const table = parseDelimited(await file.text());
    if (!table.length) return;
    // If the first row looks like headers, map columns by name so any column order works.
    const head = table[0].map(h => h.trim().toLowerCase());
    const find = (re: RegExp) => head.findIndex(h => re.test(h));
    const map = { name: find(/name|item|product/), price: find(/price|cost|amount/), category: find(/categ|group|type/), description: find(/desc|note/) };
    if (map.name >= 0 && map.price >= 0) {
      const body = table.slice(1).map(r => COLS.map(k => (map[k] >= 0 ? r[map[k]] ?? '' : '')));
      this.rows.set(this.pad(body.map(cells => ({ name: cells[0], price: cells[1], category: cells[2], description: cells[3] }))));
    } else this.fill(table, 0, 0);
    this.result.set(null); this.error.set(null);
  }

  template() {
    const csv = 'Name,Price,Category,Description\nPandesal (6 pcs),60,Bread,Fresh every morning\nIced Latte,120,Drinks,\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'hatidsuki-items-template.csv'; a.click(); URL.revokeObjectURL(a.href);
  }

  async run(dryRun: boolean) {
    this.busy.set(true); this.error.set(null);
    const sent = this.rows().map((r, idx) => ({ r, idx })).filter(x => x.r.name.trim() || x.r.price.trim() || x.r.category.trim());
    try {
      const res = await this.api.bulk(sent.map(x => ({ name: x.r.name, price: x.r.price, category: x.r.category, description: x.r.description })), this.onDuplicate, dryRun);
      if (dryRun) {
        // Show each row's outcome next to it. Server row numbers count only the rows we sent.
        this.rows.update(l => l.map((r, idx) => { const k = sent.findIndex(x => x.idx === idx); const rr = k >= 0 ? res.rows[k] : undefined; return rr ? { ...r, status: rr.status, message: rr.message } : r; }));
        this.result.set(res);
      } else {
        this.result.set(res);
        this.saved.emit();
        this.toast.show(`${res.created + res.updated} items saved.`);
      }
    } catch (e) { this.error.set(errorMessage(e)); } finally { this.busy.set(false); }
  }

  private fill(table: string[][], startCol: number, startRow: number) {
    const rows = [...this.rows()];
    table.forEach((cells, dy) => {
      const y = startRow + dy;
      while (rows.length <= y) rows.push(blank());
      const row = { ...rows[y], status: undefined, message: null };
      cells.forEach((v, dx) => { const col = COLS[startCol + dx]; if (col) row[col] = v.trim(); });
      rows[y] = row;
    });
    this.rows.set(rows);
    this.result.set(null);
  }

  private pad(list: Partial<Row>[]): Row[] {
    const rows = list.map(x => ({ ...blank(), ...x } as Row));
    while (rows.length < 8) rows.push(blank());
    return rows;
  }
}
