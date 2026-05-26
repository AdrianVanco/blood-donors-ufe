// Identita a rola prihláseného používateľa.
//
// Po prihlásení (OIDC/Dex cez Envoy Gateway) je ID token uložený v cookie
// "wac-hospital-id-token" (názov definuje authn.security-policy.yaml).
// Z tokenu prečítame email a meno. Rolu odvodíme z emailu: pracovník je
// v zozname WORKER_EMAILS, každý ďalší prihlásený používateľ je darca.
//
// WORKER_EMAILS musí ostať zhodný s worker_emails v
// blood-donors-gitops/infrastructure/opa-plugin/params/policy.rego.

export type Role = "darca" | "pracovnik";

export interface CurrentUser {
  email: string;
  name: string;
  role: Role;
}

export const WORKER_EMAILS = [
  "xvancoa@stuba.sk",
  // cvičiaci (aby sa pri hodnotení vedeli prihlásiť ako pracovník)
  "qunger@stuba.sk",
  "qmicuch@stuba.sk",
  "qsevcikm@stuba.sk",
  "qhudakm1@stuba.sk",
];

// roleOverride slúži len na lokálny dev/test (bez gateway). Reálny ID token
// z cookie má vždy prednosť. Bez cookie sa rola dá určiť aj cez ?role= v URL,
// napr. http://localhost:3333/blood-donors/?role=pracovnik
export function getCurrentUser(roleOverride?: string): CurrentUser {
  const claims = decodeIdToken();
  const email = claims?.email ?? "";
  const name = claims?.name ?? claims?.preferred_username ?? email ?? "";

  // dev prepínač roly len keď nie je prihlásenie cez cookie
  const devRole = claims ? undefined : (roleOverride ?? queryRole());
  const role: Role =
    devRole === "pracovnik" || devRole === "darca"
      ? devRole
      : WORKER_EMAILS.includes(email) ? "pracovnik" : "darca";
  return { email, name, role };
}

// dev: rola z query parametra ?role=pracovnik / ?role=darca
function queryRole(): string | undefined {
  if (typeof location === "undefined") {
    return undefined;
  }
  return new URLSearchParams(location.search).get("role") ?? undefined;
}

function decodeIdToken(): any {
  const match =
    typeof document !== "undefined" &&
    document.cookie.match(/(?:^|; )wac-hospital-id-token=([^;]+)/);
  if (!match) {
    return null;
  }
  try {
    const payload = decodeURIComponent(match[1]).split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}
