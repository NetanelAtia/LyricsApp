// Fetch JSON with a CORS-proxy fallback. On restrictive / flaky networks a
// direct request can be blocked (CORS) or dropped (ERR_NETWORK_CHANGED);
// if so, we retry the same request through a public CORS proxy.

const proxied = (url: string) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);

export async function fetchJson(url: string): Promise<any> {
  // 1) Direct.
  try {
    const res = await fetch(url);
    if (res.ok) return await res.json();
  } catch {}

  // 2) Through a CORS proxy.
  const res = await fetch(proxied(url));
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return await res.json();
}
