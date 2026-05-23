import { Component, Host, Prop, State, h, EventEmitter, Event, Watch } from '@stencil/core';
import { DonorsApi, Donor, Donation, Configuration } from '../../api/blood-donors';

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
  @Prop() entryId: string;
  @Prop() siteId: string;
  @Prop() apiBase: string;

  @Event({ eventName: "editor-closed" }) editorClosed: EventEmitter<string>;

  @State() entry: Donor;
  @State() errorMessage: string;
  @State() isValid: boolean;

  // vstupy pre pridanie nového termínu
  @State() newTerminType: string = "blood";
  @State() newTerminDate: string = "";
  @State() newTerminNote: string = "";

  private formElement: HTMLFormElement;

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
        sex: "M",
        eligible: true,
        preferredDonationType: "blood",
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
        <form ref={el => this.formElement = el}>
          <md-filled-text-field label="Meno a priezvisko"
            required pattern=".*\S.*" value={this.entry?.name}
            oninput={(ev: InputEvent) => {
              if (this.entry) { this.entry.name = this.handleInputEvent(ev) }
            }}>
            <md-icon slot="leading-icon">person</md-icon>
          </md-filled-text-field>

          <md-filled-text-field label="Registračné číslo darcu" disabled
            value={this.entry?.donorId}
            supporting-text={this.isNew ? "Pridelené automaticky" : "Registračné číslo sa nedá zmeniť"}>
            <md-icon slot="leading-icon">fingerprint</md-icon>
          </md-filled-text-field>

          {this.renderSex()}
          {this.renderBloodType()}

          <md-filled-text-field label="E-mail" type="email"
            value={this.entry?.email}
            oninput={(ev: InputEvent) => {
              if (this.entry) { this.entry.email = this.handleInputEvent(ev) }
            }}>
            <md-icon slot="leading-icon">mail</md-icon>
          </md-filled-text-field>

          <md-filled-text-field label="Telefónne číslo" type="tel"
            value={this.entry?.phone}
            oninput={(ev: InputEvent) => {
              if (this.entry) { this.entry.phone = this.handleInputEvent(ev) }
            }}>
            <md-icon slot="leading-icon">phone</md-icon>
          </md-filled-text-field>

          {this.renderPreferredType()}
          {this.renderEligibility()}

          <md-filled-text-field label="Registrovaný od" disabled
            value={new Date(this.entry?.registeredSince || Date.now()).toLocaleDateString()}>
            <md-icon slot="leading-icon">how_to_reg</md-icon>
          </md-filled-text-field>
        </form>

        {this.renderLimits()}
        {this.renderTermini()}

        <md-divider></md-divider>
        <div class="actions">
          <md-filled-tonal-button id="delete" disabled={!this.entry || this.entry?.id === "@new"}
            onClick={() => this.deleteEntry()} >
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
      <md-filled-select label="Pohlavie"
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
      <md-filled-select label="Krvná skupina"
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
      const nextEligible = lastTime + limit.intervalDays * DAY_MS;
      const tooSoon = nextEligible > now;
      const countThisYear = ofType.filter(d => new Date(d.date!).getFullYear() === thisYear).length;
      return (
        <div class={"limit-row" + (tooSoon ? " too-soon" : "")}>
          <div class="limit-type">{limit.label}</div>
          <div class="limit-detail">Počet odberov: {ofType.length}
            {code === "blood" ? ` (tento rok ${countThisYear}/${annualCap})` : ""}</div>
          <div class="limit-detail">Posledný odber: {new Date(lastTime).toLocaleDateString()}</div>
          <div class="limit-detail">
            Najskôr ďalší možný: {tooSoon ? new Date(nextEligible).toLocaleDateString() : "možný teraz"}
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
        <h3>Termíny a odbery</h3>
        {donations.length === 0
          ? <div class="termini-empty">Zatiaľ žiadne termíny.</div>
          : <md-list>
            {donations.map(donation =>
              <md-list-item class={this.terminClass(donation.status)}>
                <md-icon slot="start">bloodtype</md-icon>
                <div slot="headline">{donation.donationType?.value ?? "Darovanie krvi"}</div>
                <div slot="supporting-text">
                  {[
                    donation.date ? new Date(donation.date).toLocaleString() : "",
                    donation.status,
                    donation.note,
                  ].filter(Boolean).join(" · ")}
                </div>
                <div slot="end" class="termin-actions">
                  {this.terminActions(donation)}
                </div>
              </md-list-item>
            )}
          </md-list>
        }

        <div class="add-termin">
          <md-filled-select label="Typ odberu"
            display-text={DONATION_TYPES.find(t => t.code === this.newTerminType)?.value}
            oninput={(ev: InputEvent) => this.newTerminType = (ev.target as HTMLInputElement).value}>
            {DONATION_TYPES.map(t => (
              <md-select-option value={t.code} selected={t.code === this.newTerminType}>
                <div slot="headline">{t.value}</div>
              </md-select-option>
            ))}
          </md-filled-select>
          <md-filled-text-field label="Dátum a čas" type="datetime-local"
            value={this.newTerminDate}
            oninput={(ev: InputEvent) => this.newTerminDate = (ev.target as HTMLInputElement).value}>
          </md-filled-text-field>
          <md-filled-text-field label="Poznámka (nepovinné)"
            value={this.newTerminNote}
            oninput={(ev: InputEvent) => this.newTerminNote = (ev.target as HTMLInputElement).value}>
            <md-icon slot="leading-icon">edit_note</md-icon>
          </md-filled-text-field>
          <md-outlined-button onClick={() => this.addTermin()}>
            <md-icon slot="icon">add</md-icon>
            Rezervovať termín
          </md-outlined-button>
        </div>
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
          <md-outlined-button onClick={() => this.advanceStatus(donation, ST_CANCELLED)}>Zrušiť</md-outlined-button>,
        ];
      case ST_ELIGIBLE:
        return [
          <md-outlined-button onClick={() => this.advanceStatus(donation, ST_DONE)}>Odber dokončený</md-outlined-button>,
          <md-outlined-button onClick={() => this.advanceStatus(donation, ST_CANCELLED)}>Zrušiť</md-outlined-button>,
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

  private addTermin() {
    if (!this.entry || !this.newTerminDate) {
      return;
    }
    const type = DONATION_TYPES.find(t => t.code === this.newTerminType);
    const donation: Donation = {
      date: new Date(this.newTerminDate),
      donationType: type ? { code: type.code, value: type.value } : undefined,
      status: ST_BOOKED,
      note: this.newTerminNote || undefined,
    };
    this.entry = {
      ...this.entry,
      donations: [...(this.entry.donations || []), donation],
    };
    this.newTerminDate = "";
    this.newTerminNote = "";
  }

  private handleInputEvent(ev: InputEvent): string {
    const target = ev.target as HTMLInputElement;
    this.validateForm('silent');
    return target.value
  }

  private validateForm(mode: 'silent' | 'show-errors'): boolean {
    this.isValid = true;
    for (let i = 0; i < this.formElement.children.length; i++) {
      const element = this.formElement.children[i] as HTMLElement & {
        checkValidity?: () => boolean;
        reportValidity?: () => boolean;
      };

      let valid = true;
      if (mode === 'show-errors' && element.reportValidity) {
        valid = element.reportValidity();
      } else if (element.checkValidity) {
        valid = element.checkValidity();
      }
      this.isValid &&= valid;
    }
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
