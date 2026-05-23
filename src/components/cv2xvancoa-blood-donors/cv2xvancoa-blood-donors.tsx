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

    if (this.relativePath.startsWith("entry/")) {
      element = "editor";
      entryId = this.relativePath.split("/")[1]
    } else if (this.relativePath.startsWith("calendar")) {
      element = "calendar";
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
          </nav>
          : undefined}

        {element === "editor"
          ? <cv2xvancoa-blood-donors-editor entry-id={entryId}
            site-id={this.siteId} api-base={this.apiBase}
            oneditor-closed={() => navigate("./list")} >
          </cv2xvancoa-blood-donors-editor>
          : element === "calendar"
            ? <cv2xvancoa-blood-donors-calendar site-id={this.siteId} api-base={this.apiBase}>
            </cv2xvancoa-blood-donors-calendar>
            : <cv2xvancoa-blood-donors-list site-id={this.siteId} api-base={this.apiBase}
              onentry-clicked={(ev: CustomEvent<string>) => navigate("./entry/" + ev.detail)} >
            </cv2xvancoa-blood-donors-list>
        }

      </Host>
    );
  }
}
