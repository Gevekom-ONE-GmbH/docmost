import type { IncomingHttpHeaders } from 'http';

/**
 * Normalises a raw host value (Host / X-Forwarded-Host / env entry) into the
 * canonical form we store in `workspaces.hostname`:
 * lower-cased, trimmed, port stripped, trailing dot stripped.
 *
 * Returns null for empty or obviously malformed values.
 */
export function normalizeHost(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;

  let host = raw.trim().toLowerCase();
  if (!host) return null;

  // Tolerate full URLs in env config (e.g. "https://wiki.example.com/").
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  host = host.split('/')[0];

  if (host.startsWith('[')) {
    // IPv6 literal, optionally with port: [::1]:3000
    const end = host.indexOf(']');
    if (end === -1) return null;
    host = host.slice(0, end + 1);
  } else {
    const colon = host.indexOf(':');
    if (colon !== -1) host = host.slice(0, colon);
  }

  host = host.replace(/\.+$/, '');

  if (!host || !/^[a-z0-9.\-[\]:]+$/.test(host)) return null;
  return host;
}

/**
 * Parses a comma/whitespace separated host list (WORKSPACE_HOSTS) into a
 * de-duplicated list of normalised hosts.
 */
export function parseHostList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const hosts = raw
    .split(/[,\s]+/)
    .map((entry) => normalizeHost(entry))
    .filter((entry): entry is string => !!entry);
  return Array.from(new Set(hosts));
}

function lastHeaderEntry(value: string | string[] | undefined): string {
  if (value === undefined || value === null) return undefined;
  const joined = Array.isArray(value) ? value.join(',') : value;
  const parts = joined.split(',');
  return parts[parts.length - 1]?.trim();
}

/**
 * Determines the host the client used for this request.
 *
 * The app runs Fastify with `trustProxy: true`, so — like Fastify's own
 * `request.hostname` — X-Forwarded-Host wins over Host, and for a multi-value
 * X-Forwarded-Host the LAST entry (the one appended by the nearest proxy) is
 * used.
 */
export function extractRequestHost(
  headers: IncomingHttpHeaders | undefined,
): string | null {
  if (!headers) return null;
  const forwarded = lastHeaderEntry(headers['x-forwarded-host']);
  if (forwarded) {
    return normalizeHost(forwarded);
  }
  return normalizeHost(lastHeaderEntry(headers.host));
}
