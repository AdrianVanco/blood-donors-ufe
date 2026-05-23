// Zdieľaný zoznam odberných miest (transfúznych staníc).
// Zatiaľ statický; neskôr môže prísť z API ako DonationSite.
export const DONATION_SITES = [
  { id: "bratislava-bory", name: "Bratislava Bory" },
  { id: "bratislava-ruzinov", name: "Bratislava Ružinov" },
  { id: "malacky", name: "Malacky" },
];

// vráti zobrazovaný názov odberného miesta podľa id
export function siteName(id?: string): string {
  return DONATION_SITES.find(s => s.id === id)?.name ?? (id || "—");
}
