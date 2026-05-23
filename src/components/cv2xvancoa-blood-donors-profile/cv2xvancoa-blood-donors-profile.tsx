import { Component, Host, Prop, State, h, Event, EventEmitter } from '@stencil/core';
import { DonorsApi, Donor, Configuration } from '../../api/blood-donors';
import { siteName } from '../../global/sites';

const PREFERRED_LABEL: { [code: string]: string } = {
  blood: "Krv",
  plasma: "Krvná plazma",
  both: "Oboje",
};

/**
 * Obrazovka "Môj účet" - vlastný pohľad darcu (scenár Darca/CRUD: prezeranie profilu a histórie).
 * Bez prihlásenia je naviazaná na konkrétneho darcu (donorId), inak na prvého v zozname.
 */
@Component({
  tag: 'cv2xvancoa-blood-donors-profile',
  styleUrl: 'cv2xvancoa-blood-donors-profile.css',
  shadow: true,
})
export class Cv2xvancoaBloodDonorsProfile {
  @Prop() apiBase: string;
  @Prop() siteId: string;
  // ktorý darca je "prihlásený" (zatiaľ bez auth - default prvý darca)
  @Prop() donorId: string;

  @Event({ eventName: "edit-profile" }) editProfile: EventEmitter<string>;

  @State() donor: Donor;
  @State() errorMessage: string;

  async componentWillLoad() {
    try {
      const configuration = new Configuration({ basePath: this.apiBase });
      const donorsApi = new DonorsApi(configuration);
      const all = await donorsApi.getDonors({ siteId: this.siteId });
      if (all && all.length > 0) {
        this.donor = this.donorId
          ? all.find(d => d.donorId === this.donorId || d.id === this.donorId) || all[0]
          : all[0];
      } else {
        this.errorMessage = "Žiadny účet sa nenašiel.";
      }
    } catch (err: any) {
      this.errorMessage = `Nepodarilo sa načítať účet: ${err.message || "neznáma chyba"}`;
    }
  }

  render() {
    if (this.errorMessage) {
      return <Host><div class="error">{this.errorMessage}</div></Host>;
    }
    if (!this.donor) {
      return <Host><div class="loading">Načítavam…</div></Host>;
    }
    const d = this.donor;
    const donations = (d.donations || [])
      .slice()
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    return (
      <Host>
        <h2>Môj účet</h2>
        <div class="name">{d.name}</div>

        <div class="info">
          <div class="row"><span class="label">E-mail:</span><span>{d.email || "—"}</span></div>
          <div class="row"><span class="label">Telefónne číslo:</span><span>{d.phone || "—"}</span></div>
          <div class="row"><span class="label">Krvná skupina:</span><span>{d.bloodType || "—"}</span></div>
          <div class="row"><span class="label">Preferovaný typ odberu:</span>
            <span>{PREFERRED_LABEL[d.preferredDonationType] || "—"}</span></div>
          <div class="row"><span class="label">Preferované odberné miesto:</span>
            <span>{siteName(d.preferredSite)}</span></div>
        </div>

        <md-filled-button onClick={() => this.editProfile.emit(d.id)}>
          <md-icon slot="icon">edit</md-icon>
          Upraviť profil
        </md-filled-button>

        <md-divider></md-divider>

        <h3>Moje termíny</h3>
        {donations.length === 0
          ? <div class="empty">Zatiaľ žiadne termíny.</div>
          : <md-list>
            {donations.map(donation =>
              <md-list-item>
                <md-icon slot="start">bloodtype</md-icon>
                <div slot="headline">{donation.donationType?.value ?? "Darovanie krvi"}</div>
                <div slot="supporting-text">
                  {[
                    donation.date ? new Date(donation.date).toLocaleString() : "",
                    donation.status,
                  ].filter(Boolean).join(" · ")}
                </div>
              </md-list-item>
            )}
          </md-list>
        }
      </Host>
    );
  }
}
