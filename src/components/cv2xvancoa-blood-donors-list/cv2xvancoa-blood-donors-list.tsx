import { Component, Event, EventEmitter, Host, Prop, State, h } from '@stencil/core';
import { DonorsApi, Donor, Configuration } from '../../api/blood-donors';

/**
 * Zoznam registrovaných darcov pre pracovníka transfúznej stanice (scenár Darca/R).
 * Načíta darcov z API; pri každom riadku zobrazuje pohlavie, krvnú skupinu a
 * preferovaný typ odberu. Tlačidlom „+" sa otvára registrácia nového darcu.
 */
@Component({
  tag: 'cv2xvancoa-blood-donors-list',
  styleUrl: 'cv2xvancoa-blood-donors-list.css',
  shadow: true,
})
export class Cv2xvancoaBloodDonorsList {
  @Event({ eventName: "entry-clicked" }) entryClicked!: EventEmitter<string>;
  @Event({ eventName: "notify" }) notify!: EventEmitter<string>;
  @Prop() apiBase?: string;
  @Prop() siteId?: string;
  @State() errorMessage?: string;
  @State() searchTerm: string = "";
  @State() filterSex: string = "";          // "", "M", "F"
  @State() filterEligibility: string = "";  // "", "eligible", "ineligible"
  @State() reserveDonor: Donor | null = null;  // darca, ktorému rezervujeme termín

  donors!: Donor[];

  private async getDonorsAsync(): Promise<Donor[]> {
    // be prepared for connectivity issues
    try {
      const configuration = new Configuration({
        basePath: this.apiBase,
      });

      const donorsApi = new DonorsApi(configuration);
      const response = await donorsApi.getDonorsRaw({ siteId: this.siteId })
      if (response.raw.status < 299) {
        return await response.value();
      } else {
        this.errorMessage = `Cannot retrieve list of donors: ${response.raw.statusText}`
      }
    } catch (err: any) {
      this.errorMessage = `Cannot retrieve list of donors: ${err.message || "unknown"}`
    }
    return [];
  }

  async componentWillLoad() {
    this.donors = await this.getDonorsAsync();
  }

  private donorSummary(donor: Donor): string {
    const sex = donor.sex === "F" ? "Žena" : donor.sex === "M" ? "Muž" : "";
    const preferred = donor.preferredDonationType === "plasma" ? "Krvná plazma"
      : donor.preferredDonationType === "both" ? "Oboje"
      : donor.preferredDonationType === "blood" ? "Krv" : "";
    const parts = [sex, donor.bloodType, preferred].filter(p => p && p.length > 0);
    return parts.join(" · ");
  }

  private openReserve(donor: Donor) {
    this.reserveDonor = donor;
  }

  private showReason(donor: Donor) {
    this.notify.emit(`Dôvod nespôsobilosti: ${donor.eligibilityNote || "neuvedený"}`);
  }

  // termín vybraný v kalendári – uloží rezerváciu darcovi
  private async onReserveSlot(ev: CustomEvent<{ date: Date; time: string; type: string }>) {
    const donor = this.reserveDonor;
    if (!donor) {
      return;
    }
    const { date, time, type } = ev.detail;
    const day = new Date(date);
    const [h, m] = time.split(":").map(Number);
    day.setHours(h, m, 0, 0);
    const value = type === "plasma" ? "Darovanie krvnej plazmy" : "Darovanie krvi";
    const updated: Donor = {
      ...donor,
      donations: [...(donor.donations || []), {
        date: day,
        donationType: { code: type, value },
        status: "Rezervácia dokončená",
      }],
    };
    try {
      const configuration = new Configuration({ basePath: this.apiBase });
      const response = await new DonorsApi(configuration)
        .updateDonorRaw({ siteId: this.siteId, entryId: donor.id, donor: updated });
      if (response.raw.status < 299) {
        this.donors = (this.donors || []).map(d => d.id === updated.id ? updated : d);
        this.notify.emit(`Termín rezervovaný pre darcu ${updated.name}`);
      } else {
        this.notify.emit(`Rezervácia zlyhala: ${response.raw.statusText}`);
      }
    } catch (err: any) {
      this.notify.emit(`Rezervácia zlyhala: ${err.message || "neznáma chyba"}`);
    }
    this.reserveDonor = null;
  }

  // filtrovanie podľa mena/reg. čísla + pohlavia + spôsobilosti
  private filteredDonors(): Donor[] {
    const term = (this.searchTerm || "").trim().toLowerCase();
    return (this.donors || []).filter(d => {
      const matchesText = !term
        || (d.name || "").toLowerCase().includes(term)
        || (d.donorId || "").toLowerCase().includes(term);
      const matchesSex = !this.filterSex || d.sex === this.filterSex;
      const matchesEligibility = !this.filterEligibility
        || (this.filterEligibility === "eligible" ? d.eligible !== false : d.eligible === false);
      return matchesText && matchesSex && matchesEligibility;
    });
  }

  render() {
    const donors = this.filteredDonors();
    return (
      <Host>
        <h2 class="page-title">Darcovia krvi</h2>
        <md-filled-text-field class="search" label="Hľadať darcu (meno alebo reg. číslo)"
          value={this.searchTerm}
          oninput={(ev: InputEvent) => this.searchTerm = (ev.target as HTMLInputElement).value}>
          <md-icon slot="leading-icon">search</md-icon>
        </md-filled-text-field>

        <div class="filters">
          <md-filled-select class="filter" label="Pohlavie"
            display-text={this.filterSex === "M" ? "Muž" : this.filterSex === "F" ? "Žena" : "Všetci"}
            oninput={(ev: InputEvent) => this.filterSex = (ev.target as HTMLInputElement).value}>
            <md-icon slot="leading-icon">wc</md-icon>
            <md-select-option value="" selected={!this.filterSex}><div slot="headline">Všetci</div></md-select-option>
            <md-select-option value="M" selected={this.filterSex === "M"}><div slot="headline">Muž</div></md-select-option>
            <md-select-option value="F" selected={this.filterSex === "F"}><div slot="headline">Žena</div></md-select-option>
          </md-filled-select>

          <md-filled-select class="filter" label="Spôsobilosť"
            display-text={this.filterEligibility === "eligible" ? "Spôsobilí" : this.filterEligibility === "ineligible" ? "Nespôsobilí" : "Všetci"}
            oninput={(ev: InputEvent) => this.filterEligibility = (ev.target as HTMLInputElement).value}>
            <md-icon slot="leading-icon">verified</md-icon>
            <md-select-option value="" selected={!this.filterEligibility}><div slot="headline">Všetci</div></md-select-option>
            <md-select-option value="eligible" selected={this.filterEligibility === "eligible"}><div slot="headline">Spôsobilí</div></md-select-option>
            <md-select-option value="ineligible" selected={this.filterEligibility === "ineligible"}><div slot="headline">Nespôsobilí</div></md-select-option>
          </md-filled-select>
        </div>

        {this.errorMessage
          ? <div class="error">{this.errorMessage}</div>
          : donors.length === 0
            ? <div class="empty">Žiadny darca nevyhovuje hľadaniu.</div>
            : <md-list>
              {donors.map((donor) =>
                <md-list-item onClick={() => this.entryClicked.emit(donor.id)}>
                  <md-icon slot="start">bloodtype</md-icon>
                  <div slot="headline">{donor.name}</div>
                  <div slot="supporting-text">
                    {[this.donorSummary(donor), donor.donorId ? `Reg. č. ${donor.donorId}` : ""]
                      .filter(Boolean).join(" · ")}
                  </div>
                  <div slot="end" class="row-end">
                    <span class={"elig " + (donor.eligible === false ? "no" : "ok")}>
                      {donor.eligible === false ? "Nespôsobilý" : "Môže darovať"}
                    </span>
                    {donor.eligible === false
                      ? <button class="reserve-btn" title="Zobraziť dôvod nespôsobilosti"
                          onClick={(ev: MouseEvent) => { ev.stopPropagation(); this.showReason(donor); }}>
                          <md-icon>info</md-icon>
                        </button>
                      : <button class="reserve-btn" title="Rezervovať termín"
                          onClick={(ev: MouseEvent) => { ev.stopPropagation(); this.openReserve(donor); }}>
                          <md-icon>event_available</md-icon>
                        </button>}
                  </div>
                </md-list-item>
              )}
            </md-list>
        }
        <md-filled-icon-button class="add-button"
          onclick={() => this.entryClicked.emit("@new")}>
          <md-icon>add</md-icon>
        </md-filled-icon-button>

        {this.reserveDonor
          ? <md-dialog open onClosed={() => this.reserveDonor = null}>
            <div slot="headline">Rezervácia termínu: {this.reserveDonor.name}</div>
            <div slot="content">
              <cv2xvancoa-blood-donors-calendar picker-mode
                site-id={this.siteId} api-base={this.apiBase}
                donations={this.reserveDonor.donations} sex={this.reserveDonor.sex}
                onslot-selected={(ev: CustomEvent<{ date: Date; time: string; type: string }>) => this.onReserveSlot(ev)}>
              </cv2xvancoa-blood-donors-calendar>
            </div>
            <div slot="actions">
              <md-outlined-button onClick={() => this.reserveDonor = null}>Zavrieť</md-outlined-button>
            </div>
          </md-dialog>
          : undefined}
      </Host>
    );
  }
}
