import { Component, Host, Prop, State, h, Event, EventEmitter } from '@stencil/core';
import { DonorsApi, Donor, Configuration } from '../../api/blood-donors';
import { siteName } from '../../global/sites';

const PREFERRED_LABEL: { [code: string]: string } = {
  blood: "Krv",
  plasma: "Krvná plazma",
  both: "Oboje",
};

// stavy termínov (zhodné s editorom)
const ST_BOOKED = "Rezervácia dokončená";
const ST_ELIGIBLE = "Spôsobilý - čaká na odber";
const ST_CANCELLED = "Zrušená rezervácia";

// aktívna (zrušiteľná) rezervácia
function isActiveReservation(status?: string): boolean {
  return status === ST_BOOKED || status === ST_ELIGIBLE;
}

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
  @Prop() apiBase?: string;
  @Prop() siteId?: string;
  // ktorý darca je "prihlásený" (explicitné id má prednosť pred párovaním podľa emailu)
  @Prop() donorId?: string;
  // identita prihláseného používateľa (z OIDC/Dex cez hlavný komponent)
  @Prop() userEmail?: string;
  @Prop() userName?: string;
  @Prop() role?: string;

  @Event({ eventName: "edit-profile" }) editProfile!: EventEmitter<string>;

  @State() donor!: Donor;
  @State() errorMessage?: string;
  @State() showAllTermini: boolean = false;
  @State() cancelling: boolean = false;
  // prihlásený darca, ktorý ešte nemá vlastný záznam v systéme
  @State() noRecord: boolean = false;

  async componentWillLoad() {
    try {
      const configuration = new Configuration({ basePath: this.apiBase });
      const donorsApi = new DonorsApi(configuration);
      const all = await donorsApi.getDonors({ siteId: this.siteId });
      if (all && all.length > 0) {
        const byId = this.donorId
          ? all.find(d => d.donorId === this.donorId || d.id === this.donorId)
          : undefined;
        const byEmail = this.userEmail
          ? all.find(d => (d.email || "").toLowerCase() === this.userEmail!.toLowerCase())
          : undefined;
        // Prihlásený darca (máme jeho email), ktorý sa nezhoduje so žiadnym
        // záznamom -> nezobrazíme cudzí profil, ale neutrálny stav.
        if (this.userEmail && !byId && !byEmail) {
          this.noRecord = true;
        } else {
          // poradie: explicitné donorId -> zhoda emailu -> prvý (lokálny dev bez prihlásenia)
          this.donor = byId || byEmail || all[0];
        }
      } else {
        this.errorMessage = "Žiadny účet sa nenašiel.";
      }
    } catch (err: any) {
      this.errorMessage = `Nepodarilo sa načítať účet: ${err.message || "neznáma chyba"}`;
    }
  }

  // darca zruší vlastnú prebiehajúcu rezerváciu priamo z "Môj účet"
  private async cancelReservation(donation: any) {
    if (this.cancelling || !this.donor?.id) {
      return;
    }
    if (typeof confirm === "function" && !confirm("Naozaj zrušiť túto rezerváciu?")) {
      return;
    }
    this.cancelling = true;
    try {
      const updated: Donor = {
        ...this.donor,
        donations: (this.donor.donations || []).map(d =>
          d === donation ? { ...d, status: ST_CANCELLED } : d),
      };
      const configuration = new Configuration({ basePath: this.apiBase });
      const response = await new DonorsApi(configuration)
        .updateDonorRaw({ siteId: this.siteId, entryId: this.donor.id, donor: updated });
      if (response.raw.status < 299) {
        this.donor = updated; // prekreslí zoznam termínov
      } else {
        this.errorMessage = "Rezerváciu sa nepodarilo zrušiť.";
      }
    } catch (e) {
      this.errorMessage = "Rezerváciu sa nepodarilo zrušiť (chyba spojenia).";
    } finally {
      this.cancelling = false;
    }
  }

  render() {
    if (this.errorMessage) {
      return <Host><div class="error">{this.errorMessage}</div></Host>;
    }
    if (this.noRecord) {
      return (
        <Host>
          <h2 class="page-title">Môj účet</h2>
          <div class="card">
            <p>Pre tento účet{this.userEmail ? ` (${this.userEmail})` : ""} zatiaľ neexistuje darcovský záznam.</p>
            <p>Pre registráciu darcu kontaktujte pracovníka transfúznej stanice.</p>
          </div>
        </Host>
      );
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
        <h2 class="page-title">Môj účet</h2>

        <div class="card head-card">
          <md-icon class="avatar">account_circle</md-icon>
          <div class="head-text">
            <div class="name">{d.name}</div>
            <div class="head-sub">
              {d.bloodType ? <span class="badge">{d.bloodType}</span> : null}
              {d.donorId ? <span class="reg">Reg. č. {d.donorId}</span> : null}
              {this.role ? <span class={"role-pill " + (this.role === "pracovnik" ? "worker" : "donor")}>{this.role === "pracovnik" ? "Pracovník" : "Darca"}</span> : null}
            </div>
            {this.userEmail ? <div class="signed-in">Prihlásený ako {this.userEmail}</div> : null}
          </div>
          <md-filled-button class="edit-btn" onClick={() => this.editProfile.emit(d.id)}>
            <md-icon slot="icon">edit</md-icon>
            Upraviť profil
          </md-filled-button>
        </div>

        <div class="grid-2">
          <section class="card">
            <h3 class="section-title">Kontaktné údaje</h3>
            <div class="info">
              <div class="row"><span class="label">E-mail</span><span class="value">{d.email || "—"}</span></div>
              <div class="row"><span class="label">Telefónne číslo</span><span class="value">{d.phone || "—"}</span></div>
            </div>
          </section>

          <section class="card">
            <h3 class="section-title">Darcovské údaje</h3>
            <div class="info">
              <div class="row"><span class="label">Krvná skupina</span><span class="value">{d.bloodType || "—"}</span></div>
              <div class="row"><span class="label">Preferovaný typ odberu</span><span class="value">{PREFERRED_LABEL[d.preferredDonationType ?? ""] || "—"}</span></div>
              <div class="row"><span class="label">Preferované odberné miesto</span><span class="value">{siteName(d.preferredSite)}</span></div>
            </div>
          </section>
        </div>

        <section class="card">
          <h3 class="section-title">Moje termíny ({donations.length})</h3>
          {donations.length === 0
            ? <div class="empty">Zatiaľ žiadne termíny.</div>
            : <md-list>
              {(this.showAllTermini ? donations : donations.slice(0, 5)).map(donation =>
                <md-list-item>
                  <md-icon slot="start" class={"type-icon " + (donation.donationType?.code === 'plasma' ? 'plasma' : 'blood')}>bloodtype</md-icon>
                  <div slot="headline">{donation.donationType?.value ?? "Darovanie krvi"}</div>
                  <div slot="supporting-text">
                    {[
                      donation.date ? new Date(donation.date).toLocaleString("sk-SK", { dateStyle: "short", timeStyle: "short" }) : "",
                      donation.status,
                    ].filter(Boolean).join(" · ")}
                  </div>
                  {isActiveReservation(donation.status)
                    ? <md-outlined-button slot="end" class="cancel-resv" disabled={this.cancelling}
                      onClick={() => this.cancelReservation(donation)}>
                      <md-icon slot="icon">event_busy</md-icon>
                      Zrušiť rezerváciu
                    </md-outlined-button>
                    : null}
                </md-list-item>
              )}
            </md-list>
          }
          {donations.length > 5
            ? <button class="show-more" onClick={() => this.showAllTermini = !this.showAllTermini}>
              {this.showAllTermini ? "Zobraziť menej" : `Zobraziť všetky (${donations.length})`}
            </button>
            : undefined}
        </section>
      </Host>
    );
  }
}
