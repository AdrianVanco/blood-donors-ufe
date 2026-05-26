// Identita a rola prihláseného používateľa.
//
// Na klastri sú OIDC cookies (id/access token) HttpOnly, takže ich JavaScript
// nevie prečítať. Identitu preto získavame z backendu cez endpoint /whoami,
// kam gateway/OPA dopĺňa hlavičky x-forwarded-email a x-forwarded-roles.
// Backend vráti aj príznak "worker" (pracovník podľa role alebo emailu).
//
// WORKER_EMAILS slúži len ako fallback (lokálny dev bez gateway); na klastri
// rozhoduje pole "worker" z /whoami. Drž ho zhodný s worker_emails v
// policy.rego a workerEmails v blood-donors-webapi/internal/blood_donors/auth.go.

export type Role = "darca" | "pracovnik";

export interface CurrentUser {
  email: string;
  name: string;
  role: Role;
}

export const WORKER_EMAILS = [
  "xvancoa@stuba.sk",
  "qunger@stuba.sk",
  "qmicuch@stuba.sk",
  "qsevcikm@stuba.sk",
  "qhudakm1@stuba.sk",
];

// getCurrentUser zistí identitu z /whoami. roleOverride (?role= alebo prop)
// sa použije len v lokálnom dev režime, keď nie je reálna identita.
export async function getCurrentUser(apiBase?: string, roleOverride?: string): Promise<CurrentUser> {
  let email = "";
  let name = "";
  let workerApi = false;
  let hasIdentity = false;

  try {
    const base = apiBase ?? "";
    const res = await fetch(`${base}/whoami`, { credentials: "include" });
    if (res.ok) {
      const w = await res.json();
      email = (w.email ?? "").toString();
      name = (w.name ?? "").toString();
      workerApi = w.worker === true;
      hasIdentity = email !== "" || workerApi;
    }
  } catch (_e) {
    // lokálny dev bez backendu / bez /whoami
  }

  // reálna identita (klaster) -> rola podľa backendu
  if (hasIdentity) {
    return { email, name: name || email, role: workerApi ? "pracovnik" : "darca" };
  }

  // bez reálnej identity (mock/dev) -> rola z ?role= alebo prop, inak darca
  const dev = roleOverride === "pracovnik" || roleOverride === "darca" ? roleOverride : queryRole();
  const role: Role =
    dev === "pracovnik" || dev === "darca"
      ? dev
      : WORKER_EMAILS.includes(email) ? "pracovnik" : "darca";
  return { email, name: name || email, role };
}

// dev: rola z query parametra ?role=pracovnik / ?role=darca
function queryRole(): string | undefined {
  if (typeof location === "undefined") {
    return undefined;
  }
  return new URLSearchParams(location.search).get("role") ?? undefined;
}
