import { Component, Host, Prop, State, h, EventEmitter, Event } from '@stencil/core';
import { DonorsApi, Donor, Donation, Configuration } from '../../api/blood-donors';

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-"];

const SEX_OPTIONS = [
  { code: "M", label: "Muž" },
  { code: "F", label: "Žena" },
];

// Preferred donation type of the donor (profile-level preference)
const PREFERRED_TYPES = [
  { code: "blood", label: "Krv" },
  { code: "plasma", label: "Krvná plazma" },
  { code: "both", label: "Oboje" },
];

// Concrete donation types used for individual appointments (termíny)
const DONATION_TYPES = [
  { code: "blood", value: "Darovanie krvi" },
  { code: "plasma", value: "Darovanie krvnej plazmy" },
];

/**
 * Editor darcu - pridanie, úprava a zmazanie (scenáre Darca/C, U, D).
 * Eviduje osobné a kontaktné údaje, pohlavie, krvnú skupinu, preferovaný typ odberu,
 * všeobecnú spôsobilosť na darovanie (pri nespôsobilosti s dôvodom) a zoznam termínov.
 * Registračné číslo darcu sa pri novej registrácii prideľuje automaticky a je nemenné.
 */
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

  // inputs for adding a new appointment (termín)
  @State() newTerminType: string = "blood";
  @State() newTerminDate: string = "";
  @State() newTerminStatus: string = "Rezervácia dokončená";

  private formElement: HTMLFormElement;

  async componentWillLoad() {
    this.getDonorAsync();
  }

  private get isNew(): boolean {
    return this.entryId === "@new";
  }

  // generates a new registration number for a freshly registered donor
  private generateDonorId(): string {
    return String(Date.now());
  }

  private async getDonorAsync(): Promise<Donor> {
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
      return this.entry;
    }
    if (!this.entryId) {
      this.isValid = false;
      return undefined
    }
    try {
      const configuration = new Configuration({
        basePath: this.apiBase,
      });

      const donorsApi = new DonorsApi(configuration);

      const response = await donorsApi.getDonorRaw({ siteId: this.siteId, entryId: this.entryId });

      if (response.raw.status < 299) {
        this.entry = await response.value();
        this.isValid = true;
      } else {
        this.errorMessage = `Cannot retrieve donor: ${response.raw.statusText}`
      }
    } catch (err: any) {
      this.errorMessage = `Cannot retrieve donor: ${err.message || "unknown"}`
    }
    return undefined;
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
    const eligible = this.entry?.eligible !== false; // default to eligible
    return [
      <md-filled-select label="Spôsobilosť na darovanie"
        display-text={eligible ? "Spôsobilý" : "Nespôsobilý"}
        oninput={(ev: InputEvent) => {
          if (this.entry) {
            const isEligible = (ev.target as HTMLInputElement).value === "true";
            // reassign to trigger re-render (show/hide the note field)
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
              <md-list-item>
                <md-icon slot="start">bloodtype</md-icon>
                <div slot="headline">{donation.donationType?.value ?? "Darovanie krvi"}</div>
                <div slot="supporting-text">
                  {(donation.date ? new Date(donation.date).toLocaleString() : "") +
                    (donation.status ? " · " + donation.status : "")}
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
          <md-filled-text-field label="Stav pacienta"
            value={this.newTerminStatus}
            oninput={(ev: InputEvent) => this.newTerminStatus = (ev.target as HTMLInputElement).value}>
          </md-filled-text-field>
          <md-outlined-button onClick={() => this.addTermin()}>
            <md-icon slot="icon">add</md-icon>
            Pridať termín
          </md-outlined-button>
        </div>
      </div>
    );
  }

  private addTermin() {
    if (!this.entry || !this.newTerminDate) {
      return;
    }
    const type = DONATION_TYPES.find(t => t.code === this.newTerminType);
    const donation: Donation = {
      date: new Date(this.newTerminDate),
      donationType: type ? { code: type.code, value: type.value } : undefined,
      status: this.newTerminStatus || "Rezervácia dokončená",
    };
    this.entry = {
      ...this.entry,
      donations: [...(this.entry.donations || []), donation],
    };
    this.newTerminDate = "";
    this.newTerminStatus = "Rezervácia dokončená";
  }

  private handleInputEvent(ev: InputEvent): string {
    const target = ev.target as HTMLInputElement;
    this.validateForm('silent');
    return target.value
  }

  private validateForm(mode: 'silent' | 'show-errors'): boolean {
    // check validity of elements
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
      const configuration = new Configuration({
        basePath: this.apiBase,
      });

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
      const configuration = new Configuration({
        basePath: this.apiBase,
      });

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
