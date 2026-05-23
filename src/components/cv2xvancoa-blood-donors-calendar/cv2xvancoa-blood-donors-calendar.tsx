import { Component, Host, Prop, State, h } from '@stencil/core';

// Odberné miesta (zatiaľ statický zoznam; neskôr z API / DonationSite)
const SITES = [
  { id: "bratislava-bory", name: "Bratislava Bory" },
  { id: "bratislava-ruzinov", name: "Bratislava Ružinov" },
  { id: "malacky", name: "Malacky" },
];

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
  @Prop() apiBase: string;
  @Prop() siteId: string;

  @State() type: 'blood' | 'plasma' = 'blood';
  @State() site: string;
  @State() monthCursor: Date = startOfMonth(new Date());
  @State() selectedDay: Date | null = null;
  @State() selectedSlot: string | null = null;
  @State() notice: string | null = null;

  componentWillLoad() {
    this.site = this.siteId || SITES[0].id;
  }

  private setType(type: 'blood' | 'plasma') {
    this.type = type;
    this.selectedDay = null;
    this.selectedSlot = null;
  }

  // dostupnosť dňa: nie v minulosti; krv Po-Pi, plazma len Po-Št
  private isAvailable(date: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      return false;
    }
    const isoDow = date.getDay() === 0 ? 7 : date.getDay(); // 1=Po .. 7=Ne
    return this.type === 'plasma' ? isoDow >= 1 && isoDow <= 4 : isoDow >= 1 && isoDow <= 5;
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

  private selectDay(date: Date) {
    if (!this.isAvailable(date)) {
      return;
    }
    this.selectedDay = date;
    this.selectedSlot = null;
  }

  private reserve() {
    if (!this.selectedDay || !this.selectedSlot) {
      return;
    }
    const d = this.selectedDay;
    const siteName = SITES.find(s => s.id === this.site)?.name ?? this.site;
    const typeName = this.type === 'plasma' ? "darovanie krvnej plazmy" : "darovanie krvi";
    this.notice = `Rezervácia úspešná: ${typeName}, ${siteName}, ${formatDay(d)} o ${this.selectedSlot}.`;
    this.selectedDay = null;
    this.selectedSlot = null;
  }

  render() {
    const left = this.monthCursor;
    const right = new Date(left.getFullYear(), left.getMonth() + 1, 1);
    const atCurrentMonth = left.getTime() <= startOfMonth(new Date()).getTime();
    return (
      <Host>
        {this.notice
          ? <div class="notice">
            <md-icon>check_circle</md-icon>
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

        <div class="months">
          <md-filled-icon-button class="nav-btn" disabled={atCurrentMonth} onClick={() => this.shiftMonths(-1)}>
            <md-icon>chevron_left</md-icon>
          </md-filled-icon-button>
          {this.renderMonth(left)}
          {this.renderMonth(right)}
          <md-filled-icon-button class="nav-btn" onClick={() => this.shiftMonths(1)}>
            <md-icon>chevron_right</md-icon>
          </md-filled-icon-button>
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
        <div class="month-title">{MONTHS[month]} {year}</div>
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
      <div class="slots-panel">
        <h3>{formatDay(this.selectedDay)}</h3>
        <div class="slots">
          {slots.map(s => (
            <button class={"slot" + (this.type === 'plasma' ? " plasma" : " blood") + (this.selectedSlot === s ? " selected" : "")}
              onClick={() => this.selectedSlot = s}>{s}</button>
          ))}
        </div>
        {this.selectedSlot
          ? <div class="confirm">
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
