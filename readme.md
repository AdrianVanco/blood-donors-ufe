# cv2xvancoa-blood-donors-ufe

Microfrontend (web komponent) pre **registráciu a správu darcov krvi**. Vytvorený v rámci predmetu Vývoj webových aplikácií (WAC) pomocou knižnice [Stencil](https://stenciljs.com) a [Material Design Web Components](https://github.com/material-components/material-web).

Autor: Adrián Vančo

## Funkcionalita

Aplikáciu používajú dve role:

- **Darca** - zaregistruje sa do systému, vidí svoje kontaktné údaje a históriu darovaní, vie si upraviť kontaktné údaje.
- **Pracovník transfúznej stanice** - má prehľad o registrovaných darcoch, manuálne pridáva nových darcov, upravuje ich údaje a spôsobilosť na darovanie a ruší registrácie.

Evidované typy odberov: **darovanie krvi** a **darovanie krvnej plazmy**.

## Komponenty

- `cv2xvancoa-blood-donors` - hlavný (aplikačný) komponent, rieši navigáciu medzi zoznamom a editorom.
- `cv2xvancoa-blood-donors-list` - zoznam registrovaných darcov.
- `cv2xvancoa-blood-donors-editor` - pridanie / úprava / zmazanie darcu, jeho spôsobilosti a termínov.

## Spustenie vývojového prostredia

```bash
npm install
npm start
```

`npm start` spustí naraz vývojový server (Stencil) na `http://localhost:3333` a mock API odvodené z OpenAPI špecifikácie na porte `5000`.

## Ďalšie príkazy

```bash
npm run build      # produkčný build do priečinka www/ a dist/
npm test           # spustí spec a e2e testy
npm run openapi    # regeneruje API klienta z api/blood-donors.openapi.yaml
```

## API

API kontrakt je v `api/blood-donors.openapi.yaml`. TypeScript klient v `src/api/blood-donors/` je z neho vygenerovaný nástrojom OpenAPI Generator (konfigurácia v `openapitools.json`).

## Použitie web komponentu

```html
<cv2xvancoa-blood-donors
  site-id="bratislava-bory"
  api-base="http://localhost:5000/api"
  base-path="/blood-donors/">
</cv2xvancoa-blood-donors>
```

## Nasadenie

Docker image: `xvancoa/cv2xvancoa-blood-donors-ufe` (DockerHub účet `xvancoa`).
Kubernetes namespace: `wac-hospital` (zdieľaný klaster), microfrontend identifikovaný prefixom `cv2xvancoa`.
