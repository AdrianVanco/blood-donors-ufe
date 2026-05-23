import { Component, Host, Prop, State, h } from '@stencil/core';

declare global {
  interface Window { navigation: any; }
}

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

  @Prop() basePath: string = "";
  @Prop() apiBase: string;
  @Prop() siteId: string;

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
            oneditor-closed={() => navigate(editorMode === "donor" ? "./profile" : "./list")} >
          </cv2xvancoa-blood-donors-editor>
          : element === "calendar"
            ? <cv2xvancoa-blood-donors-calendar site-id={this.siteId} api-base={this.apiBase}>
            </cv2xvancoa-blood-donors-calendar>
            : element === "profile"
              ? <cv2xvancoa-blood-donors-profile site-id={this.siteId} api-base={this.apiBase}
                onedit-profile={(ev: CustomEvent<string>) => navigate("./self/" + ev.detail)}>
              </cv2xvancoa-blood-donors-profile>
              : <cv2xvancoa-blood-donors-list site-id={this.siteId} api-base={this.apiBase}
                onentry-clicked={(ev: CustomEvent<string>) => navigate("./entry/" + ev.detail)} >
              </cv2xvancoa-blood-donors-list>
        }

      </Host>
    );
  }
}
