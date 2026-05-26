import { Component, Host, Prop, State, h } from '@stencil/core';
import { getCurrentUser, CurrentUser } from '../../global/auth';

/**
 * Hlavný aplikačný komponent microfrontendu darcov krvi.
 * Podľa aktuálnej URL (relatívnej k base-path) rozhoduje, ktorá obrazovka sa
 * zobrazí - funguje ako jednoduchý router.
 *
 * Flow sa delí podľa role prihláseného používateľa (OIDC/Dex cez Envoy Gateway):
 *  - pracovník (pracovnik): zoznam darcov, plný editor ľubovoľného darcu, rezervácia
 *  - darca (darca): iba rezervácia a vlastný účet/profil (self-edit), bez zoznamu darcov
 */
@Component({
  tag: 'cv2xvancoa-blood-donors',
  styleUrl: 'cv2xvancoa-blood-donors.css',
  shadow: true,
})
export class Cv2xvancoaBloodDonors {
  @State() private relativePath = "";
  @State() private snackbar: string | null = null;
  @State() private snackbarError: boolean = false;
  @State() private snackSeq: number = 0;
  @State() private user!: CurrentUser;
  private snackTimer: any;

  @Prop() basePath: string = "";
  @Prop() apiBase?: string;
  @Prop() siteId?: string;
  // Override role len pre lokálny dev/test; v produkcii rozhoduje ID token z cookie.
  @Prop() role?: string;

  private showSnack(message: string, error = false) {
    this.snackbar = message;
    this.snackbarError = error;
    this.snackSeq++; // vždy zmení key -> notifikácia sa znova animuje aj pri rovnakom texte
    clearTimeout(this.snackTimer);
    this.snackTimer = setTimeout(() => (this.snackbar = null), 3500);
  }

  componentWillLoad() {
    this.user = getCurrentUser(this.role);

    const baseUri = new URL(this.basePath, document.baseURI || "/").pathname;

    const toRelative = (path: string) => {
      if (path.startsWith(baseUri)) {
        this.relativePath = path.slice(baseUri.length)
      } else {
        this.relativePath = ""
      }
    }

    window.navigation?.addEventListener("navigate", (ev: Event) => {
      if ((ev as any).canIntercept) { (ev as any).intercept(); }
      let path = new URL((ev as any).destination.url).pathname;
      toRelative(path);
    });

    toRelative(location.pathname)
  }

  private navigate = (path: string) => {
    const absolute = new URL(path, new URL(this.basePath, document.baseURI)).pathname;
    window.navigation.navigate(absolute)
  }

  // Odhlásenie cez gateway: reálna navigácia (nie SPA router) na logoutPath
  // z OIDC SecurityPolicy - Envoy vyčistí OIDC cookies a presmeruje na portál.
  private logout = () => {
    window.location.assign("/fea/logout");
  }

  render() {
    const isWorker = this.user?.role === "pracovnik";
    console.debug("cv2xvancoa-blood-donors.render() - path: %s, role: %s", this.relativePath, this.user?.role);

    // predvolená obrazovka podľa role: pracovník -> zoznam, darca -> vlastný účet
    let element = isWorker ? "list" : "profile";
    let entryId = "@new";
    let editorMode: string = isWorker ? "worker" : "donor";

    if (this.relativePath.startsWith("entry/")) {
      // plný editor ľubovoľného darcu - iba pracovník
      element = "editor";
      entryId = this.relativePath.split("/")[1];
      editorMode = "worker";
    } else if (this.relativePath.startsWith("self/")) {
      // darca upravuje vlastný profil - obmedzený editor
      element = "editor";
      entryId = this.relativePath.split("/")[1];
      editorMode = "donor";
    } else if (this.relativePath.startsWith("calendar")) {
      element = "calendar";
    } else if (this.relativePath.startsWith("profile")) {
      element = "profile";
    } else if (this.relativePath.startsWith("list")) {
      element = "list";
    }

    // --- Route guards podľa role ---
    // Darca nemá prístup k zoznamu darcov ani k plnému editoru (entry/).
    if (!isWorker && (element === "list" || (element === "editor" && editorMode === "worker"))) {
      element = "profile";
      editorMode = "donor";
    }
    // Pracovník nie je darca - spravuje darcov. Vlastný účet/rezervácia mu
    // nepatria (na darovanie by použil svoj osobný darcovský účet/email),
    // preto ho z týchto obrazoviek presmerujeme do zoznamu darcov.
    if (isWorker && (element === "profile" || element === "calendar")) {
      element = "list";
    }

    const navigate = this.navigate;
    const roleLabel = isWorker ? "Pracovník" : "Darca";

    return (
      <Host>
        {element !== "editor"
          ? <nav class="topnav">
            <div class="nav-actions">
              {isWorker
                ? <md-outlined-button onClick={() => navigate("./list")}>
                  <md-icon slot="icon">groups</md-icon>
                  Darcovia
                </md-outlined-button>
                : [
                  <md-outlined-button onClick={() => navigate("./calendar")}>
                    <md-icon slot="icon">event</md-icon>
                    Rezervácia
                  </md-outlined-button>,
                  <md-outlined-button onClick={() => navigate("./profile")}>
                    <md-icon slot="icon">account_circle</md-icon>
                    Môj účet
                  </md-outlined-button>,
                ]}
            </div>
            <div class="nav-identity" title={this.user?.email || ""}>
              <span class={"role-badge " + (isWorker ? "worker" : "donor")}>{roleLabel}</span>
              <span class="user-name">{this.user?.name || ""}</span>
              <button class="logout-btn" title="Odhlásiť" aria-label="Odhlásiť"
                onClick={() => this.logout()}>
                <md-icon>logout</md-icon>
              </button>
            </div>
          </nav>
          : undefined}

        {element === "editor"
          ? <cv2xvancoa-blood-donors-editor entry-id={entryId} mode={editorMode}
            site-id={this.siteId} api-base={this.apiBase}
            onNotify={(ev: CustomEvent<string>) => this.showSnack(ev.detail)}
            oneditor-closed={(ev: CustomEvent<string>) => {
              if (ev.detail === "store") this.showSnack("Darca uložený");
              else if (ev.detail === "delete") this.showSnack("Darca zmazaný");
              navigate(editorMode === "donor" ? "./profile" : "./list");
            }} >
          </cv2xvancoa-blood-donors-editor>
          : element === "calendar"
            ? <cv2xvancoa-blood-donors-calendar site-id={this.siteId} api-base={this.apiBase}
              user-email={this.user?.email}>
            </cv2xvancoa-blood-donors-calendar>
            : element === "profile"
              ? <cv2xvancoa-blood-donors-profile site-id={this.siteId} api-base={this.apiBase}
                user-email={this.user?.email} user-name={this.user?.name} role={this.user?.role}
                onedit-profile={(ev: CustomEvent<string>) => navigate("./self/" + ev.detail)}>
              </cv2xvancoa-blood-donors-profile>
              : <cv2xvancoa-blood-donors-list site-id={this.siteId} api-base={this.apiBase}
                onNotify={(ev: CustomEvent<string>) => this.showSnack(ev.detail)}
                onentry-clicked={(ev: CustomEvent<string>) => navigate("./entry/" + ev.detail)} >
              </cv2xvancoa-blood-donors-list>
        }

        {this.snackbar
          ? <div key={this.snackSeq} class={"snackbar" + (this.snackbarError ? " error" : "")}>
            <md-icon>{this.snackbarError ? "error" : "check_circle"}</md-icon>
            <span>{this.snackbar}</span>
          </div>
          : undefined}

      </Host>
    );
  }
}
