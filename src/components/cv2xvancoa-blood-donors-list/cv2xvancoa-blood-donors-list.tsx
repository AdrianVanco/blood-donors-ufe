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
  @Event({ eventName: "entry-clicked" }) entryClicked: EventEmitter<string>;
  @Prop() apiBase: string;
  @Prop() siteId: string;
  @State() errorMessage: string;

  donors: Donor[];

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
    let text = parts.join(" · ");
    if (donor.eligible === false) {
      text += (text ? " · " : "") + "Nespôsobilý";
    }
    return text;
  }

  render() {
    return (
      <Host>
        {this.errorMessage
          ? <div class="error">{this.errorMessage}</div>
          :
          <md-list>
            {this.donors.map((donor) =>
              <md-list-item onClick={() => this.entryClicked.emit(donor.id)}>
                <div slot="headline">{donor.name}</div>
                <div slot="supporting-text">{this.donorSummary(donor)}</div>
                <md-icon slot="start">bloodtype</md-icon>
              </md-list-item>
            )}
          </md-list>
        }
        <md-filled-icon-button class="add-button"
          onclick={() => this.entryClicked.emit("@new")}>
          <md-icon>add</md-icon>
        </md-filled-icon-button>
      </Host>
    );
  }
}
