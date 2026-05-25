import { Component, Host, Prop, State, Event, EventEmitter, h } from '@stencil/core';
import { DONATION_SITES as SITES } from '../../global/sites';
import { DonorsApi, Configuration, Donation } from '../../api/blood-donors';

// obmedzenia NTS SR: min. odstup medzi odbermi daného typu + ročný strop pre krv
const ST_DONE = "Odber dokončený";
const INTERVAL_DAYS: { [code: string]: number } = { blood: 70, plasma: 14 };
const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS = ["Január", "Február", "Marec", "Apríl", "Máj", "Jún",
  "Júl", "August", "September", "Október", "November", "December"];
const DOW_SHORT = ["Po", "Ut", "St", "Št", "Pi", "So", "Ne"];
const DOW_FULL = ["Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota", "Nedeľa"];

// vygeneruje 15-minútové sloty pre darovanie krvi (08:00 - 10:30)
function bloodSlots(): string[] {
  const slots: string[] = [];
  for (let m = 8 * 60; m <= 10 * 60 + 30; m += 15) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return slots;
}

@Component({
  tag: 'cv2xvancoa-blood-donors-calendar',
  styleUrl: 'cv2xvancoa-blood-donors-calendar.css',
  shadow: true,
})
export class Cv2xvancoaBloodDonorsCalendar {
  @Prop() apiBase?: string;
  @Prop() siteId?: string;
  // ktorý darca je "prihlásený" (zatiaľ bez auth - default prvý darca)
  @Prop() donorId?: string;
  // picker režim: kalendár sa použije ako výber termínu (napr. v dialógu editora)
  // a namiesto hlášky emituje vybraný termín
  @Prop() pickerMode?: boolean = false;
  // termíny darcu, pohlavie a spôsobilosť – na kontrolu pri rezervácii (picker režim)
  @Prop() donations?: Donation[];
  @Prop() sex?: string;
  @Prop() donorEligible?: boolean = true;
  @Prop() preselectType?: string;

  @Event({ eventName: "slot-selected" }) slotSelected!: EventEmitter<{ date: Date; time: string; type: string }>;

  @State() type: 'blood' | 'plasma' = 'blood';
  @State() site!: string;
  @State() monthCursor: Date = startOfMonth(new Date());
  @State() selectedDay: Date | null = null;
  @State() selectedSlot: string | null = null;
  @State() notice: string | null = null;
  @State() noticeKind: 'ok' | 'warn' = 'ok';
  // spôsobilosť prihláseného darcu (nespôsobilý si nemôže rezervovať termín)
  @State() eligible: boolean = true;

  async componentWillLoad() {
    this.site = this.siteId || SITES[0].id;
    // v picker režime (pracovník) dostávame termíny/pohlavie/spôsobilosť cez props,
    // takže nenačítavame žiadneho "prihláseného" darcu
    if (this.pickerMode) {
      // kalendár otvoríme rovno na typ zvolený v zozname/editore
      if (this.preselectType === 'plasma' || this.preselectType === 'blood') {
        this.type = this.preselectType;
      }
      return;
    }
    // self-service darcu: predvyplníme preferencie a načítame jeho termíny + pohlavie
    // (kvôli kontrole odstupu a ročného limitu aj pri vlastnej rezervácii)
    try {
      const configuration = new Configuration({ basePath: this.apiBase });
      const all = await new DonorsApi(configuration).getDonors({ siteId: this.siteId });
      const me = all && all.length > 0
        ? (this.donorId ? all.find(d => d.donorId === this.donorId || d.id === this.donorId) || all[0] : all[0])
        : undefined;
      if (me) {
        if (me.preferredSite && SITES.some(s => s.id === me.preferredSite)) {
          this.site = me.preferredSite;
        }
        // preferovaný typ: plazma -> plazma; krv aj "oboje" -> krv (default)
        this.type = me.preferredDonationType === 'plasma' ? 'plasma' : 'blood';
        this.eligible = me.eligible !== false;
        this.donations = me.donations;
        this.sex = me.sex;
      }
    } catch (e) {
      // ponecháme predvolené hodnoty
    }
  }

  private setType(type: 'blood' | 'plasma') {
    this.type = type;
    this.selectedDay = null;
    this.selectedSlot = null;
  }

  // dostupnosť dňa: nie v minulosti; krv Po-Pi, plazma len Po-Št;
  // + dodržanie odstupu od posledného odberu a ročného limitu krvi
  private isAvailable(date: Date): boolean {
    // nespôsobilému darcovi (v picker režime pracovníka) nedovolíme rezerváciu
    if (this.pickerMode && this.donorEligible === false) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      return false;
    }
    const isoDow = date.getDay() === 0 ? 7 : date.getDay(); // 1=Po .. 7=Ne
    const dayOk = this.type === 'plasma' ? isoDow >= 1 && isoDow <= 4 : isoDow >= 1 && isoDow <= 5;
    if (!dayOk) {
      return false;
    }
    // odstup od posledného dokončeného odberu daného typu
    const next = this.nextEligibleDate();
    if (next && date.getTime() < next.getTime()) {
      return false;
    }
    // ročný limit krvi (ženy 3×, muži 4× za kalendárny rok)
    if (this.type === 'blood') {
      const cap = this.sex === 'F' ? 3 : 4;
      const doneThatYear = (this.donations || []).filter(d =>
        d.status === ST_DONE && d.donationType?.code === 'blood'
        && d.date && new Date(d.date).getFullYear() === date.getFullYear()).length;
      if (doneThatYear >= cap) {
        return false;
      }
    }
    return true;
  }

  // najbližší možný dátum odberu aktuálneho typu – zohľadňuje odstup od posledného
  // dokončeného odberu AJ ročný limit krvi (ak je vyčerpaný, najskôr budúci rok)
  private nextEligibleDate(): Date | null {
    let candidate: Date | null = null;

    // odstup od posledného dokončeného odberu daného typu
    const done = (this.donations || []).filter(d =>
      d.status === ST_DONE && d.donationType?.code === this.type && d.date);
    if (done.length > 0) {
      const last = Math.max(...done.map(d => new Date(d.date!).getTime()));
      const n = new Date(last + (INTERVAL_DAYS[this.type] || 0) * DAY_MS);
      n.setHours(0, 0, 0, 0);
      candidate = n;
    }

    // ročný limit krvi (ženy 3×, muži 4×): ak je tento rok vyčerpaný, najskôr 1. januára budúceho roka
    if (this.type === 'blood') {
      const cap = this.sex === 'F' ? 3 : 4;
      const year = new Date().getFullYear();
      const yearDone = (this.donations || []).filter(d =>
        d.status === ST_DONE && d.donationType?.code === 'blood'
        && d.date && new Date(d.date).getFullYear() === year).length;
      if (yearDone >= cap) {
        const jan1 = new Date(year + 1, 0, 1);
        if (!candidate || jan1.getTime() > candidate.getTime()) {
          candidate = jan1;
        }
      }
    }

    return candidate;
  }

  private slotsForType(): string[] {
    return this.type === 'plasma' ? ["11:00", "13:00"] : bloodSlots();
  }

  private shiftMonths(delta: number) {
    const target = new Date(this.monthCursor.getFullYear(), this.monthCursor.getMonth() + delta, 1);
    // nedovolíme navigovať pred aktuálny mesiac
    if (target.getTime() < startOfMonth(new Date()).getTime()) {
      return;
    }
    this.monthCursor = target;
  }

  private slotsPanelEl?: HTMLElement;
  private confirmEl?: HTMLElement;

  // plynulý scroll na ďalší krok po renderi
  private scrollToEl(getEl: () => HTMLElement | undefined) {
    setTimeout(() => getEl()?.scrollIntoView({ behavior: "smooth", block: "center" }), 70);
  }

  private selectDay(date: Date) {
    if (!this.isAvailable(date)) {
      return;
    }
    this.selectedDay = date;
    this.selectedSlot = null;
    // po výbere dňa scrollni na výber času
    this.scrollToEl(() => this.slotsPanelEl);
  }

  private selectSlot(slot: string) {
    this.selectedSlot = slot;
    // po výbere času scrollni na potvrdzovacie tlačidlo
    this.scrollToEl(() => this.confirmEl);
  }

  private reserve() {
    if (!this.selectedDay || !this.selectedSlot) {
      return;
    }
    // picker režim (pracovník v editore): emitujeme vybraný termín a končíme
    if (this.pickerMode) {
      this.slotSelected.emit({ date: this.selectedDay, time: this.selectedSlot, type: this.type });
      this.selectedDay = null;
      this.selectedSlot = null;
      return;
    }
    // nespôsobilý darca si nemôže rezervovať termín
    if (!this.eligible) {
      this.noticeKind = 'warn';
      this.notice = "Nie ste spôsobilý na darovanie, termín si nemôžete rezervovať. Kontaktujte transfúznu stanicu.";
      return;
    }
    const d = this.selectedDay;
    const siteName = SITES.find(s => s.id === this.site)?.name ?? this.site;
    const typeName = this.type === 'plasma' ? "darovanie krvnej plazmy" : "darovanie krvi";
    this.noticeKind = 'ok';
    this.notice = `Rezervácia úspešná: ${typeName}, ${siteName}, ${formatDay(d)} o ${this.selectedSlot}.`;
    this.selectedDay = null;
    this.selectedSlot = null;
  }

  render() {
    const left = this.monthCursor;
    const atCurrentMonth = left.getTime() <= startOfMonth(new Date()).getTime();
    const nextElig = this.nextEligibleDate();
    const eligInfo = nextElig && nextElig.getTime() > Date.now() ? nextElig : null;
    return (
      <Host>
        {this.pickerMode ? undefined : <h2 class="page-title">Rezervácia termínu</h2>}

        {!this.pickerMode && !this.eligible
          ? <div class="notice warn">
            <md-icon>error</md-icon>
            <span>Nie ste spôsobilý na darovanie, rezervácia termínu nie je možná. Kontaktujte transfúznu stanicu.</span>
          </div>
          : undefined}

        {this.notice
          ? <div class={"notice " + this.noticeKind}>
            <md-icon>{this.noticeKind === 'warn' ? 'error' : 'check_circle'}</md-icon>
            <span>{this.notice}</span>
            <md-icon class="notice-close" onClick={() => this.notice = null}>close</md-icon>
          </div>
          : undefined}

        <div class="toolbar">
          <div class="type-toggle">
            <button class={"type plasma" + (this.type === 'plasma' ? " active" : "")}
              onClick={() => this.setType('plasma')}>Darovanie krvnej plazmy</button>
            <button class={"type blood" + (this.type === 'blood' ? " active" : "")}
              onClick={() => this.setType('blood')}>Darovanie krvi</button>
          </div>
          <md-filled-select label="Odberné miesto"
            display-text={SITES.find(s => s.id === this.site)?.name}
            oninput={(ev: InputEvent) => this.site = (ev.target as HTMLInputElement).value}>
            {SITES.map(s => (
              <md-select-option value={s.id} selected={s.id === this.site}>
                <div slot="headline">{s.name}</div>
              </md-select-option>
            ))}
          </md-filled-select>
        </div>

        {this.pickerMode && this.donorEligible === false
          ? <div class="notice warn">
            <md-icon>error</md-icon>
            <span>Darca je nespôsobilý na darovanie — termín nie je možné rezervovať.</span>
          </div>
          : undefined}

        {eligInfo
          ? <div class="notice warn">
            <md-icon>info</md-icon>
            <span>Najbližší možný {this.type === 'plasma' ? 'odber plazmy' : 'odber krvi'}: {eligInfo.toLocaleDateString('sk-SK')} (skoršie dni sú nedostupné).</span>
          </div>
          : undefined}

        <div class={"calendar" + (this.pickerMode ? " picker" : "")}>
          <div class="cal-nav">
            <md-filled-icon-button class="nav-btn" disabled={atCurrentMonth} onClick={() => this.shiftMonths(-1)}>
              <md-icon>chevron_left</md-icon>
            </md-filled-icon-button>
            <div class="cal-title">{MONTHS[left.getMonth()]} {left.getFullYear()}</div>
            <md-filled-icon-button class="nav-btn" onClick={() => this.shiftMonths(1)}>
              <md-icon>chevron_right</md-icon>
            </md-filled-icon-button>
          </div>
          <div class="months">
            {this.renderMonth(left)}
          </div>
        </div>

        <div class="legend">
          <span class="legend-item"><span class={"swatch available " + this.type}></span> Dostupné termíny</span>
          <span class="legend-item"><span class="swatch unavailable"></span> Nedostupné termíny</span>
        </div>

        {this.renderSlots()}
      </Host>
    );
  }

  private renderMonth(monthDate: Date) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() === 0 ? 7 : first.getDay()) - 1; // koľko prázdnych buniek pred 1.
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: any[] = [];
    for (let i = 0; i < offset; i++) {
      cells.push(<div class="cell empty"></div>);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const available = this.isAvailable(date);
      const selected = this.selectedDay && sameDay(this.selectedDay, date);
      cells.push(
        <button
          class={"cell day" + (available ? " available " + this.type : " unavailable") + (selected ? " selected" : "")}
          disabled={!available}
          onClick={() => this.selectDay(date)}>
          {day}
        </button>
      );
    }

    return (
      <div class="month">
        <div class="dow-row">
          {DOW_SHORT.map(d => <div class="dow">{d}</div>)}
        </div>
        <div class="grid">{cells}</div>
      </div>
    );
  }

  private renderSlots() {
    if (!this.selectedDay) {
      return undefined;
    }
    const slots = this.slotsForType();
    return (
      <div class="slots-panel" ref={el => this.slotsPanelEl = el as HTMLElement}>
        <h3>{formatDay(this.selectedDay)}</h3>
        <div class="slots">
          {slots.map(s => (
            <button class={"slot" + (this.type === 'plasma' ? " plasma" : " blood") + (this.selectedSlot === s ? " selected" : "")}
              onClick={() => this.selectSlot(s)}>{s}</button>
          ))}
        </div>
        {this.selectedSlot
          ? <div class="confirm" ref={el => this.confirmEl = el as HTMLElement}>
            <h3>{formatDay(this.selectedDay)} o {this.selectedSlot}</h3>
            <md-filled-button onClick={() => this.reserve()}>
              <md-icon slot="icon">event_available</md-icon>
              Rezervovať
            </md-filled-button>
          </div>
          : undefined}
      </div>
    );
  }
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDay(d: Date): string {
  const isoDow = d.getDay() === 0 ? 7 : d.getDay();
  return `${DOW_FULL[isoDow - 1]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}
