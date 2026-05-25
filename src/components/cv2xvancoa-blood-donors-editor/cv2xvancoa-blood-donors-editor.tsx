import { Component, Host, Prop, State, h, EventEmitter, Event, Watch } from '@stencil/core';
import { DonorsApi, Donor, Donation, Configuration } from '../../api/blood-donors';
import { DONATION_SITES } from '../../global/sites';

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-"];

const SEX_OPTIONS = [
  { code: "M", label: "Muž" },
  { code: "F", label: "Žena" },
];

// Preferovaný typ odberu darcu (profilová preferencia)
const PREFERRED_TYPES = [
  { code: "blood", label: "Krv" },
  { code: "plasma", label: "Krvná plazma" },
  { code: "both", label: "Oboje" },
];

// Konkrétne typy odberov pri jednotlivých termínoch
const DONATION_TYPES = [
  { code: "blood", value: "Darovanie krvi" },
  { code: "plasma", value: "Darovanie krvnej plazmy" },
];

// Obmedzenia podľa NTS SR (https://www.ntssr.sk/web/o_darovani_krvi/typy_odberov).
// intervalDays = minimálny odstup medzi dvoma odbermi daného typu.
const DONATION_LIMITS: { [code: string]: { label: string; intervalDays: number } } = {
  blood: { label: "Darovanie krvi", intervalDays: 70 },   // min. ~10 týždňov
  plasma: { label: "Darovanie krvnej plazmy", intervalDays: 14 }, // 1× za 2 týždne
};
const DAY_MS = 24 * 60 * 60 * 1000;

// Stavy termínu - postupný tok riadený tlačidlami:
// Rezervácia dokončená -> (prehliadka) Spôsobilý -> Odber dokončený
//                       \-> Nespôsobilý      \-> (kedykoľvek) Zrušená rezervácia
const ST_BOOKED = "Rezervácia dokončená";
const ST_ELIGIBLE = "Spôsobilý - čaká na odber";
const ST_DONE = "Odber dokončený";
const ST_INELIGIBLE = "Nespôsobilý";
const ST_CANCELLED = "Zrušená rezervácia";

@Component({
  tag: 'cv2xvancoa-blood-donors-editor',
  styleUrl: 'cv2xvancoa-blood-donors-editor.css',
  shadow: true,
})
export class Cv2xvancoaBloodDonorsEditor {
  @Prop() entryId?: string;
  @Prop() siteId?: string;
  @Prop() apiBase?: string;
  // "worker" = plný editor pracovníka, "donor" = obmedzený self-edit darcu
  @Prop() mode: string = "worker";

  @Event({ eventName: "editor-closed" }) editorClosed!: EventEmitter<string>;
  @Event({ eventName: "notify" }) notify!: EventEmitter<string>;

  @State() entry!: Donor;
  @State() errorMessage?: string;
  @State() isValid!: boolean;

  // pridanie nového termínu cez kalendár v dialógu
  @State() showCalendar: boolean = false;
  @State() terminiOpen: boolean = true;
  // potvrdzovací dialóg pri deštruktívnych akciách
  @State() confirm: { message: string; confirmLabel: string; action: () => void } | null = null;
  // živé chybové hlášky pri formáte kontaktu
  @State() emailError: string = "";
  @State() phoneError: string = "";

  private formElement!: HTMLFormElement;

  async componentWillLoad() {
    this.getDonorAsync();
  }

  // ak sa zmení id darcu (znovupoužitý element), načítame správneho darcu
  @Watch('entryId')
  onEntryIdChanged() {
    this.errorMessage = undefined;
    this.getDonorAsync();
  }

  private get isNew(): boolean {
    return this.entryId === "@new";
  }

  // darca smie meniť len e-mail, telefón a preferovaný typ odberu
  private get isDonorMode(): boolean {
    return this.mode === "donor";
  }

  // pri novej registrácii sa pridelí nové registračné číslo
  private generateDonorId(): string {
    return String(Date.now());
  }

  private async getDonorAsync(): Promise<void> {
    if (this.entryId === "@new") {
      this.isValid = false;
      this.entry = {
        id: "@new",
        donorId: this.generateDonorId(),
        eligible: true,
        registeredSince: new Date(Date.now()),
        donations: [],
      };
      return;
    }
    if (!this.entryId) {
      this.isValid = false;
      return;
    }
    try {
      const configuration = new Configuration({ basePath: this.apiBase });
      const donorsApi = new DonorsApi(configuration);

      // Pozn.: dev mock vracia pre detail vždy ten istý príklad, preto ak sa id
      // nezhoduje, načítame darcu zo zoznamu (funguje s mockom aj reálnym backendom).
      let donor: Donor | undefined;
      try {
        const single = await donorsApi.getDonor({ siteId: this.siteId, entryId: this.entryId });
        if (single && single.id === this.entryId) {
          donor = single;
        }
      } catch (e) {
        // ignorujeme - skúsime cez zoznam
      }
      if (!donor) {
        const all = await donorsApi.getDonors({ siteId: this.siteId });
        donor = (all || []).find(d => d.id === this.entryId);
      }

      if (donor) {
        this.entry = donor;
        this.isValid = true;
        // pri väčšom počte termínov ich predvolene zbalíme
        this.terminiOpen = (donor.donations?.length ?? 0) <= 4;
      } else {
        this.errorMessage = "Darcu sa nepodarilo načítať.";
      }
    } catch (err: any) {
      this.errorMessage = `Cannot retrieve donor: ${err.message || "unknown"}`;
    }
  }

  render() {
    if (this.errorMessage) {
      return (
        <Host>
          <div class="error">{this.errorMessage}</div>
        </Host>
      )
    }
    return (
      <Host>
        <h2 class="page-title">
          {this.isDonorMode ? "Úprava profilu" : (this.isNew ? "Nový darca" : "Úprava darcu")}
        </h2>
        <form ref={el => { if (el) this.formElement = el; }}>
          <section class="form-section">
            <h3 class="section-title">Všeobecné údaje</h3>
            <div class="fields">
              <md-filled-text-field class="full" label="Meno a priezvisko"
                required pattern=".*\S.*" value={this.entry?.name}
                oninput={(ev: InputEvent) => {
                  if (this.entry) { this.entry.name = this.handleInputEvent(ev) }
                }}>
                <md-icon slot="leading-icon">person</md-icon>
              </md-filled-text-field>

              <md-filled-text-field label="Registračné číslo darcu" readonly
                value={this.entry?.donorId}
                supporting-text={this.isNew ? "Pridelené automaticky" : "Registračné číslo sa nedá zmeniť"}>
                <md-icon slot="leading-icon">fingerprint</md-icon>
              </md-filled-text-field>

              <md-filled-text-field label="Registrovaný od" readonly
                value={new Date(this.entry?.registeredSince || Date.now()).toLocaleDateString("sk-SK")}>
                <md-icon slot="leading-icon">how_to_reg</md-icon>
              </md-filled-text-field>

              {this.isDonorMode ? undefined : this.renderSex()}
              {this.isDonorMode ? undefined : this.renderBloodType()}
            </div>
          </section>

          <section class="form-section">
            <h3 class="section-title">Kontaktné údaje</h3>
            <div class="fields">
              <md-filled-text-field label="E-mail" type="email"
                supporting-text="Nepovinné"
                error={!!this.emailError} error-text={this.emailError}
                value={this.entry?.email}
                oninput={(ev: InputEvent) => {
                  if (this.entry) { this.entry.email = this.handleInputEvent(ev); this.checkContact(); }
                }}>
                <md-icon slot="leading-icon">mail</md-icon>
              </md-filled-text-field>

              <md-filled-text-field label="Telefónne číslo" type="tel"
                supporting-text="Nepovinné, napr. +421 900 123 456"
                error={!!this.phoneError} error-text={this.phoneError}
                value={this.entry?.phone}
                oninput={(ev: InputEvent) => {
                  if (this.entry) { this.entry.phone = this.handleInputEvent(ev); this.checkContact(); }
                }}>
                <md-icon slot="leading-icon">phone</md-icon>
              </md-filled-text-field>
            </div>
          </section>

          <section class="form-section">
            <h3 class="section-title">Zdravotné a darcovské údaje</h3>
            <div class="fields">
              {this.renderPreferredType()}
              {this.renderPreferredSite()}
              {this.isDonorMode ? undefined : this.renderEligibility()}
            </div>
          </section>
        </form>

        {this.renderLimits()}
        {this.renderTermini()}

        <md-divider></md-divider>
        <div class="actions">
          <md-filled-tonal-button id="delete" disabled={!this.entry || this.entry?.id === "@new"}
            onClick={() => this.askConfirm("Naozaj zmazať darcu? Túto akciu nie je možné vrátiť.", "Zmazať", () => this.deleteEntry())} >
            <md-icon slot="icon">delete</md-icon>
            Zmazať
          </md-filled-tonal-button>
          <span class="stretch-fill"></span>
          <md-outlined-button id="cancel"
            onClick={() => this.editorClosed.emit("cancel")}>
            Zrušiť
          </md-outlined-button>
          <md-filled-button id="confirm"
            onClick={() => this.updateEntry()}>
            <md-icon slot="icon">save</md-icon>
            Uložiť
          </md-filled-button>
        </div>
      </Host>
    );
  }

  private renderSex() {
    return (
      <md-filled-select label="Pohlavie" required
        display-text={SEX_OPTIONS.find(o => o.code === this.entry?.sex)?.label}
        oninput={(ev: InputEvent) => {
          if (this.entry) { this.entry.sex = (ev.target as HTMLInputElement).value }
        }}>
        <md-icon slot="leading-icon">wc</md-icon>
        {SEX_OPTIONS.map(o => (
          <md-select-option value={o.code} selected={o.code === this.entry?.sex}>
            <div slot="headline">{o.label}</div>
          </md-select-option>
        ))}
      </md-filled-select>
    );
  }

  private renderBloodType() {
    return (
      <md-filled-select label="Krvná skupina" required
        display-text={this.entry?.bloodType}
        oninput={(ev: InputEvent) => {
          if (this.entry) { this.entry.bloodType = (ev.target as HTMLInputElement).value }
        }}>
        <md-icon slot="leading-icon">bloodtype</md-icon>
        {BLOOD_TYPES.map(bt => (
          <md-select-option value={bt} selected={bt === this.entry?.bloodType}>
            <div slot="headline">{bt}</div>
          </md-select-option>
        ))}
      </md-filled-select>
    );
  }

  private renderPreferredType() {
    return (
      <md-filled-select label="Preferovaný typ odberu"
        display-text={PREFERRED_TYPES.find(o => o.code === this.entry?.preferredDonationType)?.label}
        oninput={(ev: InputEvent) => {
          if (this.entry) { this.entry.preferredDonationType = (ev.target as HTMLInputElement).value }
        }}>
        <md-icon slot="leading-icon">vaccines</md-icon>
        {PREFERRED_TYPES.map(o => (
          <md-select-option value={o.code} selected={o.code === this.entry?.preferredDonationType}>
            <div slot="headline">{o.label}</div>
          </md-select-option>
        ))}
      </md-filled-select>
    );
  }

  private renderPreferredSite() {
    return (
      <md-filled-select label="Preferované odberné miesto"
        display-text={DONATION_SITES.find(s => s.id === this.entry?.preferredSite)?.name}
        oninput={(ev: InputEvent) => {
          if (this.entry) { this.entry.preferredSite = (ev.target as HTMLInputElement).value }
        }}>
        <md-icon slot="leading-icon">place</md-icon>
        {DONATION_SITES.map(s => (
          <md-select-option value={s.id} selected={s.id === this.entry?.preferredSite}>
            <div slot="headline">{s.name}</div>
          </md-select-option>
        ))}
      </md-filled-select>
    );
  }

  private renderEligibility() {
    const eligible = this.entry?.eligible !== false; // default spôsobilý
    return [
      <md-filled-select label="Spôsobilosť na darovanie"
        display-text={eligible ? "Spôsobilý" : "Nespôsobilý"}
        oninput={(ev: InputEvent) => {
          if (this.entry) {
            const isEligible = (ev.target as HTMLInputElement).value === "true";
            this.entry = {
              ...this.entry,
              eligible: isEligible,
              eligibilityNote: isEligible ? undefined : this.entry.eligibilityNote,
            };
          }
        }}>
        <md-icon slot="leading-icon">{eligible ? "check_circle" : "cancel"}</md-icon>
        <md-select-option value="true" selected={eligible}>
          <div slot="headline">Spôsobilý</div>
        </md-select-option>
        <md-select-option value="false" selected={!eligible}>
          <div slot="headline">Nespôsobilý</div>
        </md-select-option>
      </md-filled-select>,
      eligible ? undefined :
        <md-filled-text-field label="Dôvod nespôsobilosti (napr. ochorenie)"
          required pattern=".*\S.*" value={this.entry?.eligibilityNote}
          oninput={(ev: InputEvent) => {
            if (this.entry) { this.entry.eligibilityNote = this.handleInputEvent(ev) }
          }}>
          <md-icon slot="leading-icon">edit_note</md-icon>
        </md-filled-text-field>
    ];
  }

  // Prehľad pre pracovníka: do limitov sa rátajú len uskutočnené odbery (Odber dokončený).
  private renderLimits() {
    if (this.isDonorMode) {
      return undefined; // prehľad limitov je nástroj pracovníka
    }
    const donations = (this.entry?.donations || []).filter(d => d.date && d.status === ST_DONE);
    if (donations.length === 0) {
      return undefined;
    }
    const now = Date.now();
    const thisYear = new Date().getFullYear();
    const annualCap = this.entry?.sex === "F" ? 3 : 4; // celá krv: ženy 3×, muži 4× za rok

    const rows = Object.keys(DONATION_LIMITS).map(code => {
      const limit = DONATION_LIMITS[code];
      const ofType = donations.filter(d => d.donationType?.code === code);
      if (ofType.length === 0) {
        return undefined;
      }
      const lastTime = Math.max(...ofType.map(d => new Date(d.date!).getTime()));
      const countThisYear = ofType.filter(d => new Date(d.date!).getFullYear() === thisYear).length;
      // najbližší možný = neskorší z odstupu a (pri krvi) ročného limitu
      let nextEligible = lastTime + limit.intervalDays * DAY_MS;
      const capReached = code === "blood" && countThisYear >= annualCap;
      if (capReached) {
        nextEligible = Math.max(nextEligible, new Date(thisYear + 1, 0, 1).getTime());
      }
      const tooSoon = nextEligible > now;
      return (
        <div class={"limit-row" + (tooSoon ? " too-soon" : "")}>
          <div class="limit-head">
            <span class="limit-type">{limit.label}</span>
            <span class={"limit-status" + (tooSoon ? " soon" : " ok")}>
              {tooSoon
                ? `Ďalší možný ${new Date(nextEligible).toLocaleDateString("sk-SK")}`
                : "Možný teraz"}
            </span>
          </div>
          <div class="limit-meta">
            <span>Počet odberov: {ofType.length}{code === "blood" ? ` · tento rok ${countThisYear}/${annualCap}` : ""}</span>
            <span>Posledný: {new Date(lastTime).toLocaleDateString("sk-SK")}</span>
          </div>
        </div>
      );
    }).filter(r => r !== undefined);

    if (rows.length === 0) {
      return undefined;
    }
    return (
      <div class="limits">
        <h3>Prehľad odberov a limitov</h3>
        {rows}
      </div>
    );
  }

  private renderTermini() {
    const donations = (this.entry?.donations || [])
      .slice()
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    return (
      <div class="termini">
        {this.isDonorMode ? undefined :
        <div class="add-termin">
          {this.entry?.eligible === false
            ? <div class="termini-empty">Darca je nespôsobilý — termín nie je možné rezervovať.</div>
            : <md-outlined-button onClick={() => this.showCalendar = true}>
              <md-icon slot="icon">calendar_month</md-icon>
              Rezervovať nový termín
            </md-outlined-button>}
        </div>}

        <button type="button" class="termini-header"
          onClick={() => this.terminiOpen = !this.terminiOpen}>
          <span>Termíny a odbery ({donations.length})</span>
          <md-icon>{this.terminiOpen ? "expand_less" : "expand_more"}</md-icon>
        </button>

        {this.terminiOpen
          ? (donations.length === 0
            ? <div class="termini-empty">Zatiaľ žiadne termíny.</div>
            : <md-list>
              {donations.map(donation =>
                <md-list-item class={this.terminClass(donation.status)}>
                  <md-icon slot="start" class={"type-icon " + (donation.donationType?.code === 'plasma' ? 'plasma' : 'blood')}>bloodtype</md-icon>
                  <div slot="headline">{donation.donationType?.value ?? "Darovanie krvi"}</div>
                  <div slot="supporting-text">
                    {[
                      donation.date ? new Date(donation.date).toLocaleString("sk-SK", { dateStyle: "short", timeStyle: "short" }) : "",
                      donation.status,
                      donation.note,
                    ].filter(Boolean).join(" · ")}
                  </div>
                  <div slot="end" class="termin-actions">
                    {this.terminActions(donation)}
                  </div>
                </md-list-item>
              )}
            </md-list>)
          : undefined}

        {this.showCalendar
          ? <md-dialog open onClosed={() => this.showCalendar = false}>
            <div slot="headline">Rezervácia termínu</div>
            <div slot="content">
              <cv2xvancoa-blood-donors-calendar picker-mode
                site-id={this.siteId} api-base={this.apiBase}
                donations={this.entry?.donations} sex={this.entry?.sex}
                donor-eligible={this.entry?.eligible !== false}
                onslot-selected={(ev: CustomEvent<{ date: Date; time: string; type: string }>) => this.onSlotPicked(ev)}>
              </cv2xvancoa-blood-donors-calendar>
            </div>
            <div slot="actions">
              <md-outlined-button onClick={() => this.showCalendar = false}>Zavrieť</md-outlined-button>
            </div>
          </md-dialog>
          : undefined}

        {this.confirm
          ? <md-dialog open class="confirm-dialog" onClosed={() => this.confirm = null}>
            <div slot="headline">Potvrdenie</div>
            <div slot="content">{this.confirm.message}</div>
            <div slot="actions">
              <md-outlined-button onClick={() => this.confirm = null}>Späť</md-outlined-button>
              <md-filled-button class="danger" onClick={() => this.runConfirm()}>
                {this.confirm.confirmLabel}
              </md-filled-button>
            </div>
          </md-dialog>
          : undefined}
      </div>
    );
  }

  private terminClass(status?: string): string {
    if (status === ST_CANCELLED || status === ST_INELIGIBLE) {
      return "cancelled";
    }
    return "";
  }

  // Tlačidlá na posun stavu termínu podľa aktuálneho stavu.
  // Tlačidlo "Späť" umožní opraviť preklik (vráti termín na začiatok toku).
  private terminActions(donation: Donation) {
    if (this.isDonorMode) {
      return undefined; // darca termíny nespravuje, len ich vidí (rezervuje cez kalendár)
    }
    const back = (
      <md-outlined-button onClick={() => this.advanceStatus(donation, ST_BOOKED)}>
        <md-icon slot="icon">undo</md-icon>
        Späť
      </md-outlined-button>
    );
    switch (donation.status) {
      case ST_BOOKED:
        return [
          <md-outlined-button onClick={() => this.advanceStatus(donation, ST_ELIGIBLE)}>Spôsobilý</md-outlined-button>,
          <md-outlined-button onClick={() => this.markIneligible(donation)}>Nespôsobilý</md-outlined-button>,
          <md-outlined-button onClick={() => this.askConfirm("Naozaj zrušiť tento termín?", "Zrušiť termín", () => this.advanceStatus(donation, ST_CANCELLED))}>Zrušiť</md-outlined-button>,
        ];
      case ST_ELIGIBLE:
        return [
          <md-outlined-button onClick={() => this.advanceStatus(donation, ST_DONE)}>Odber dokončený</md-outlined-button>,
          <md-outlined-button onClick={() => this.askConfirm("Naozaj zrušiť tento termín?", "Zrušiť termín", () => this.advanceStatus(donation, ST_CANCELLED))}>Zrušiť</md-outlined-button>,
          back,
        ];
      default:
        // ST_DONE, ST_INELIGIBLE, ST_CANCELLED - terminálne stavy: umožníme opravu prekliku
        return [back];
    }
  }

  private advanceStatus(target: Donation, status: string, note?: string) {
    if (!this.entry) {
      return;
    }
    this.entry = {
      ...this.entry,
      donations: (this.entry.donations || []).map(d =>
        d === target ? { ...d, status, note: note !== undefined ? note : d.note } : d),
    };
    this.persist("Stav termínu uložený");
  }

  // pri nespôsobilosti sa zaznamená dôvod (povinný)
  private markIneligible(target: Donation) {
    let reason = window.prompt("Dôvod nespôsobilosti (povinné):", target.note || "");
    // ak používateľ potvrdí prázdny dôvod, pýtame sa znova
    while (reason !== null && reason.trim() === "") {
      reason = window.prompt("Dôvod nespôsobilosti je povinný. Zadajte dôvod:", "");
    }
    if (reason === null) {
      return; // používateľ zrušil
    }
    this.advanceStatus(target, ST_INELIGIBLE, reason.trim());
  }

  // termín vybraný v kalendári (picker v dialógu) – hneď ho pridá darcovi
  private onSlotPicked(ev: CustomEvent<{ date: Date; time: string; type: string }>) {
    this.showCalendar = false;
    if (!this.entry) {
      return;
    }
    const { date, time, type } = ev.detail;
    const day = new Date(date);
    const [h, m] = time.split(":").map(Number);
    day.setHours(h, m, 0, 0);
    const dt = DONATION_TYPES.find(t => t.code === type);
    const donation: Donation = {
      date: day,
      donationType: dt ? { code: dt.code, value: dt.value } : undefined,
      status: ST_BOOKED,
    };
    this.entry = {
      ...this.entry,
      donations: [...(this.entry.donations || []), donation],
    };
    this.persist("Termín pridaný");
  }

  // okamžité uloženie zmien termínov do backendu (pri existujúcom darcovi)
  private async persist(message: string) {
    if (!this.entry) {
      return;
    }
    if (this.entryId === "@new") {
      // nový darca ešte nie je vytvorený – termíny sa uložia spolu cez "Uložiť"
      this.notify.emit(`${message} – nezabudnite uložiť darcu`);
      return;
    }
    try {
      const configuration = new Configuration({ basePath: this.apiBase });
      const response = await new DonorsApi(configuration)
        .updateDonorRaw({ siteId: this.siteId, entryId: this.entryId, donor: this.entry });
      if (response.raw.status < 299) {
        this.notify.emit(message);
      } else {
        this.errorMessage = `Uloženie zlyhalo: ${response.raw.statusText}`;
      }
    } catch (err: any) {
      this.errorMessage = `Uloženie zlyhalo: ${err.message || "neznáma chyba"}`;
    }
  }

  // potvrdzovací dialóg pri deštruktívnych akciách
  private askConfirm(message: string, confirmLabel: string, action: () => void) {
    this.confirm = { message, confirmLabel, action };
  }

  private runConfirm() {
    const action = this.confirm?.action;
    this.confirm = null;
    action?.();
  }

  private handleInputEvent(ev: InputEvent): string {
    const target = ev.target as HTMLInputElement;
    this.validateForm('silent');
    return target.value
  }

  // živá kontrola formátu e-mailu a telefónu (nepovinné polia)
  private checkContact() {
    const e = this.entry;
    this.emailError = e?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email)
      ? "Zadajte platný e-mail" : "";
    this.phoneError = e?.phone && !/^[0-9 +()\-]{6,}$/.test(e.phone.trim())
      ? "Zadajte platné telefónne číslo (číslice, medzery, + ( ) -)" : "";
  }

  private validateForm(mode: 'silent' | 'show-errors'): boolean {
    // živé chyby kontaktu (e-mail/telefón) – aj pri uložení
    this.checkContact();
    // 1) vizuálna validácia polí (Material hlášky pri poliach)
    let fieldsOk = true;
    const controls = this.formElement
      ? this.formElement.querySelectorAll('md-filled-text-field, md-filled-select')
      : [];
    controls.forEach((element: any) => {
      const ok = mode === 'show-errors' && element.reportValidity
        ? element.reportValidity()
        : (element.checkValidity ? element.checkValidity() : true);
      fieldsOk = fieldsOk && ok;
    });

    // 2) explicitná kontrola povinných údajov a formátov (spoľahlivé zablokovanie)
    const e = this.entry;
    const emailOk = !e?.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email);
    const phoneOk = !e?.phone || /^[0-9 +()\-]{6,}$/.test(e.phone.trim());
    const nameOk = !!(e && e.name && e.name.trim());
    // pohlavie + krvná skupina sú povinné (len v režime pracovníka, kde sa editujú)
    const workerFieldsOk = this.isDonorMode || (!!e?.sex && !!e?.bloodType);
    // dôvod nespôsobilosti je povinný, keď je darca označený ako nespôsobilý
    const eligibilityOk = this.isDonorMode || e?.eligible !== false
      || !!(e?.eligibilityNote && e.eligibilityNote.trim());
    const dataOk = !!e && nameOk && workerFieldsOk && eligibilityOk && emailOk && phoneOk;

    this.isValid = fieldsOk && dataOk;
    return this.isValid;
  }

  private async updateEntry() {
    if (!this.validateForm('show-errors')) {
      return;
    }

    try {
      const configuration = new Configuration({ basePath: this.apiBase });
      const donorsApi = new DonorsApi(configuration);

      const response = this.entryId == "@new" ?
        await donorsApi.createDonorRaw({ siteId: this.siteId, donor: this.entry }) :
        await donorsApi.updateDonorRaw({ siteId: this.siteId, entryId: this.entryId, donor: this.entry });

      if (response.raw.status < 299) {
        this.editorClosed.emit("store")
      } else {
        this.errorMessage = `Cannot store donor: ${response.raw.statusText}`
      }
    } catch (err: any) {
      this.errorMessage = `Cannot store donor: ${err.message || "unknown"}`
    }
  }

  private async deleteEntry() {
    try {
      const configuration = new Configuration({ basePath: this.apiBase });
      const donorsApi = new DonorsApi(configuration);

      const response = await donorsApi.deleteDonorRaw({ siteId: this.siteId, entryId: this.entryId });
      if (response.raw.status < 299) {
        this.editorClosed.emit("delete")
      } else {
        this.errorMessage = `Cannot delete donor: ${response.raw.statusText}`
      }
    } catch (err: any) {
      this.errorMessage = `Cannot delete donor: ${err.message || "unknown"}`
    }
  }
}
