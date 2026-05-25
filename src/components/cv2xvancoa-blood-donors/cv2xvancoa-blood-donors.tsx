import { Component, Host, Prop, State, h } from '@stencil/core';

/**
 * Hlavný aplikačný komponent microfrontendu darcov krvi.
 * Podľa aktuálnej URL (relatívnej k base-path) rozhoduje, či sa zobrazí
 * zoznam darcov alebo editor konkrétneho darcu - funguje ako jednoduchý router.
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
  private snackTimer: any;

  @Prop() basePath: string = "";
  @Prop() apiBase?: string;
  @Prop() siteId?: string;

  private showSnack(message: string, error = false) {
    this.snackbar = message;
    this.snackbarError = error;
    this.snackSeq++; // vždy zmení key -> notifikácia sa znova animuje aj pri rovnakom texte
    clearTimeout(this.snackTimer);
    this.snackTimer = setTimeout(() => (this.snackbar = null), 3500);
  }

  componentWillLoad() {
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
  render() {
    console.debug("cv2xvancoa-blood-donors.render() - path: %s", this.relativePath);
    let element = "list"
    let entryId = "@new"
    let editorMode = "worker"

    if (this.relativePath.startsWith("entry/")) {
      element = "editor";
      entryId = this.relativePath.split("/")[1]
    } else if (this.relativePath.startsWith("self/")) {
      // darca upravuje vlastný profil - obmedzený editor
      element = "editor";
      entryId = this.relativePath.split("/")[1];
      editorMode = "donor";
    } else if (this.relativePath.startsWith("calendar")) {
      element = "calendar";
    } else if (this.relativePath.startsWith("profile")) {
      element = "profile";
    }

    const navigate = (path: string) => {
      const absolute = new URL(path, new URL(this.basePath, document.baseURI)).pathname;
      window.navigation.navigate(absolute)
    }

    return (
      <Host>
        {element !== "editor"
          ? <nav class="topnav">
            <md-outlined-button onClick={() => navigate("./calendar")}>
              <md-icon slot="icon">event</md-icon>
              Rezervácia
            </md-outlined-button>
            <md-outlined-button onClick={() => navigate("./list")}>
              <md-icon slot="icon">groups</md-icon>
              Darcovia
            </md-outlined-button>
            <md-outlined-button onClick={() => navigate("./profile")}>
              <md-icon slot="icon">account_circle</md-icon>
              Môj účet
            </md-outlined-button>
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
            ? <cv2xvancoa-blood-donors-calendar site-id={this.siteId} api-base={this.apiBase}>
            </cv2xvancoa-blood-donors-calendar>
            : element === "profile"
              ? <cv2xvancoa-blood-donors-profile site-id={this.siteId} api-base={this.apiBase}
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
