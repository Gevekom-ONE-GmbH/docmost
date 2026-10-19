# Gevekom Docmost — Anpassungen & Re-Integrations-Anleitung

Dieser Fork von [Docmost](https://github.com/docmost/docmost) enthält Gevekom-eigene
Anpassungen. Dieses Dokument listet **alle** Änderungen gegenüber dem Upstream auf,
damit sie bei einem künftigen Docmost-Update wieder eingespielt werden können.

**Aktueller Stand:** Upstream **v0.96.0** (Upgrade von v0.90.1 im Oktober 2026).

## Update-Vorgehen (bewährt)

Docmost-Upgrades werden als **Rebase der Custom-Commits auf ein Upstream-Tag** gemacht,
nicht als Merge:

1. `git remote add upstream https://github.com/docmost/docmost.git` (einmalig)
2. `git fetch upstream --tags`
3. Neuen Branch vom Ziel-Tag: `git switch -c upgrade/vX.Y.Z vX.Y.Z`
4. Die unten gelisteten Änderungen neu auftragen (Cherry-Pick der Feature-Commits oder
   manuell anhand dieses Dokuments — bei größeren Upstream-Drifts ist manuell sicherer).
5. `pnpm install --frozen-lockfile` · `nx run server:build` · `nx run client:build`
6. Testen (siehe „Lokale Testumgebung" unten), dann Merge nach `main`.

**Stolpersteine (Upgrade auf v0.96.0):**
- Das lokale Tag `v0.90.1` ist **unser eigenes** Release-Tag (zeigt auf Fork-Code), nicht
  das Upstream-Tag. Upstream-Drift immer gegen den echten Upstream-Commit diffen
  (`git ls-remote upstream 'v*'`), sonst erscheinen eigene Änderungen als Upstream-Löschungen.
  Eigene Release-Tags daher künftig mit Suffix (`v0.96.0-1`, …) vergeben.
- Für `tsc --noEmit` (z. B. in Worktrees) zuerst `packages/editor-ext` und
  `packages/base-formula` bauen, sonst hunderte Schein-Fehler. Ist `pnpm` nicht im PATH:
  `corepack pnpm`.
- **Migrations-Reihenfolge:** Upstream liefert u. U. Migrationen mit **älterem**
  Zeitstempel als unsere bereits produktiv gelaufenen (z. B. `20260529-bases` /
  `20260620-personal-spaces` vs. unser `20260701-webhooks`). Deshalb ist in beiden
  Migrator-Instanzen `allowUnorderedMigrations: true` gesetzt
  (`database/migrate.ts`, `database/services/migration.service.ts`) — Touch-Point!
  Unsere Migrationsdateien **nie umbenennen** (sie stehen in `kysely_migration`).
  Migrationen laufen beim Serverstart nur mit `NODE_ENV=production`.

> Alle EE-Nachbauten sind **Clean-Room**: eigener Code im AGPL-Kern, **kein**
> Enterprise-Code (`apps/*/src/ee/`) kopiert. Der Server-EE-Code ist ohnehin nicht im
> öffentlichen Repo; der Client-EE-Code ist lizenzpflichtig und wird bewusst nicht genutzt.

---

## A) Ursprüngliche Fork-Anpassungen

| # | Feature | Dateien |
|---|---------|---------|
| A1 | **Export `nozip`-Flag** — liefert Seitenbaum als JSON statt ZIP | `apps/server/src/integrations/export/export.controller.ts`, `export.service.ts` (Zweig `type: 'json'` + `buildTreeWithMetadata`) |
| A2 | **Share-Button aus Seiten-Kopfzeile entfernt** | `apps/client/src/features/page/components/header/page-header-menu.tsx` (Entfernung von `PageShareModal` + Import aus `@/ee/page-permission`) |
| A3 | **`authToken` automatisch aus Browser-URL entfernen** (für HAProxy-SSO-Deeplinks, nur Gevekom-Workspace relevant) | `apps/client/src/App.tsx` (`useEffect` in der lazy-geladenen `App`, entfernt `?authToken=` aus search/hash, Hash bleibt erhalten) |
| A4 | **Deep-Link-Erhalt bei Login-Redirect** (search + hash) auf Basis des nativen `?redirect=`-Flows | `apps/client/src/lib/api-client.ts` (`redirectToLogin`) |
| A5 | **Dockerfile Build-Heap** `NODE_OPTIONS=--max-old-space-size=8192` in der builder-Stage | `Dockerfile` |
| A6 | **docker-compose**: eigenes Image `docmost-gevekom:0.96.0`, Postgres auf `17-alpine` gepinnt; DB-Volume auf `/var/lib/postgresql/data` (Upstreams `/var/lib/postgresql` ist das PG-18-Layout und landete bei PG 17 in einem anonymen Volume) | `docker-compose.yml` |
| A7 | **Export nur für Bearbeiter** — Viewer dürfen Seiten/Spaces nicht exportieren. `POST /pages/export` (inkl. `nozip`) prüft `validateCanEdit` statt `validateCanView` (berücksichtigt auch Seitenberechtigungen); `filterEditablePagesForExport()` entfernt nur lesbare Unterseiten samt Teilbaum. Space-Export war bereits auf Space-Admins beschränkt. UI: „Export" im Seitenmenü nur ohne `readOnly`, „Export page" im Baum nur bei Bearbeitungsrecht, „Export space" in der Sidebar nur für Space-Admins (`canExportSpace`). **Service-Accounts** für den JSON-Export brauchen Bearbeitungsrechte. MCP `get_page` bleibt für Viewer bewusst erlaubt (Entscheidung 19.10.2026). | `integrations/export/export.controller.ts`, `export.service.ts`; Client: `page-header-menu.tsx`, `space-tree-node-menu.tsx`, `space-sidebar.tsx` |

> Hinweis A4: Der frühere Cookie-basierte `originalPage`-Redirect wurde **entfernt** — er
> ist im HAProxy-SSO-Flow redundant (der Proxy übernimmt „zurück zur Originalseite" via
> `?redirect=%[url]`), und v0.90.1 hat den Redirect nativ inkl. Open-Redirect-Schutz.

---

## B) Nachgebaute Enterprise-Features (Clean-Room)

Muster jedes Features: **neue, in sich geschlossene Dateien** + wenige **Touch-Points**
in Kern-Dateien (die beim Upgrade überschrieben werden und neu aufgetragen werden müssen).

### B1) API-Keys

**Server — neue Dateien:**
- `apps/server/src/core/api-key/` (`api-key.controller.ts`, `api-key.service.ts`, `api-key.module.ts`, `dto/api-key.dto.ts`)
- `apps/server/src/database/repos/api-key/api-key.repo.ts`

**Server — Touch-Points (neu auftragen):**
- `core/core.module.ts`: `ApiKeyModule` in `imports`
- `database/database.module.ts`: `ApiKeyRepo` in `providers` **und** `exports`
- `core/auth/strategies/jwt.strategy.ts`: `validateApiKey()` nutzt Kern-`ApiKeyService` (`moduleRef.get(ApiKeyService)`) statt des EE-`require`
- ~~`token.service.ts`: `generateApiKeyToken()`~~ — seit v0.96.0 entfällt dieser Touch-Point, Upstreams `TokenService.generateApiToken()` wird genutzt

**Client — neue Dateien:**
- `apps/client/src/features/api-key/` (service, queries, types, `components/create-api-key-modal.tsx`, `components/api-key-list.tsx`)
- `apps/client/src/pages/settings/account/user-api-keys.tsx`, `pages/settings/workspace/workspace-api-keys.tsx`

**Client — Touch-Points:**
- `App.tsx`: Importe `UserApiKeys`/`WorkspaceApiKeys` zeigen auf `@/pages/settings/...` statt `@/ee/api-key/...`
- `components/settings/settings-sidebar.tsx`: `feature: Feature.API_KEYS` bei den Einträgen „API keys" und „API management" entfernt
- `components/settings/settings-queries.tsx`: Prefetch nutzt unseren API-Key-Service statt `@/ee/api-key`

**Modell:** API-Key = langlebiger `api_key`-JWT (läuft zu `expiresAt` ab, sonst nach 3650 Tagen); Ablauf/Widerruf werden DB-seitig (Tabelle `api_keys`, Soft-Delete) in `JwtStrategy` erzwungen.
Seit v0.96.0: Key-Verwaltung nur per Browser-Session (`@RequireSessionAuth`, mit API-Key → 403); `settings.api.restrictToAdmins` wird durchgesetzt (Setter bleibt lizenz-gegated); Audit-Events `api_key.created/updated/deleted`, Requests per Key haben `actorType = api_key`.

### B2) Page-Permissions

Backend-Enforcement liegt **bereits im Kern** (`PagePermissionRepo`, `PageAccessService`,
Filterung in Suche/Export/Favoriten). Nachgebaut wurde nur die **Management-API + UI**.

**Server — neue Dateien:**
- `apps/server/src/core/page/page-permission/` (`page-permission.controller.ts`, `page-permission.service.ts`, `page-permission.module.ts`, `dto/page-permission.dto.ts`)

**Server — Touch-Points:**
- `core/core.module.ts`: `PagePermissionModule` in `imports`
- `page-permission.service.ts`: schreibt Audit-Events (`page.restricted`, `page.restriction_removed`, `page.permission_added`, `page.permission_removed`, seit v0.96.0 auch `page.permission_role_changed`) via `AUDIT_SERVICE`

**Client — neue Dateien:**
- `apps/client/src/features/page-permission/` (service, queries, types, `components/page-permission-modal.tsx`)

**Client — Touch-Points:**
- `features/page/components/header/page-header-menu.tsx`: Menüpunkt „Permissions" (Icon `IconLock`) + `PagePermissionModal` eingebunden

**Routen:** `POST /pages/(permission-info|permissions|restrict|remove-restriction|add-permission|update-permission|remove-permission)`. Mutationen sind über `PageAccessService.validateCanEdit` abgesichert; Last-Writer-Guard verhindert Aussperren.

### B3) Audit Log

Der Kern emittiert Audit-Events bereits überall, verwirft sie aber via `NoopAuditService`.
Nachgebaut: echter Persistenz-Service + List-API + UI.

**Server — neue Dateien:**
- `apps/server/src/integrations/audit/` (`audit.repo.ts`, `audit-log.service.ts`, `audit.controller.ts`, `audit-log.module.ts`)

**Server — Touch-Points:**
- `app.module.ts`: `AuditLogModule` statt `NoopAuditModule` (Import **und** `imports`-Array). Seit v0.96.0 im Slot `...(enterpriseModules.length > 0 ? [] : [AuditLogModule])`

**Client — neue Dateien:**
- `apps/client/src/features/audit/` (service, query, types)
- `apps/client/src/pages/settings/workspace/audit-logs.tsx`

**Client — Touch-Points:**
- `App.tsx`: lazy-Import `AuditLogs` zeigt auf `@/pages/settings/...` statt `@/ee/audit/...`; Upstream-Routen `audit/siem` und `siem` leiten auf `/settings/audit` um (SIEM ist EE)
- `components/settings/settings-queries.tsx`: `prefetchAuditLogs` nutzt unseren Service (Infinite-Query, Key `["audit-logs", {}]`)
- `components/settings/settings-sidebar.tsx`: `feature: Feature.AUDIT_LOGS` entfernt; Label wieder „Audit log" (Upstream: „Audit logs & SIEM"), Prefetch-`case` angepasst

Seit v0.96.0 wird zusätzlich `audit.user_agent` gespeichert (Spalte aus Upstream-Migration `siem-destinations`), in der CSV-Spalte „User Agent" exportiert und als Tooltip an der IP angezeigt. Upstreams `EXCLUDED_AUDIT_EVENTS` wird von unserem Service **nicht** angewandt — wir protokollieren bewusst auch `page.created`, `comment.*` usw.

**Route:** `POST /audit` (nur Workspace-Owner/Admin). `AuditLogService` liest workspace/actor/ip aus dem CLS-`AuditContext`.

**Erweiterungen (Seiten-Nachvollziehbarkeit):** Neue Events `page.moved` (Parent-Wechsel), `page.purged` (Auto-Loeschung durch `TrashCleanupService`, Actor=System, mit Grund/Retention), `page.updated` (Titelaenderung). Reiche Metadaten via `PageAuditService` (`page/services/page-audit.service.ts`): Titel, slugId, spaceId+spaceName, parentPageId, Breadcrumb-Pfad und bei Trash/Delete/Purge die Kaskaden-Descendants (Snapshot VOR dem Loeschen). Space-Delete loggt `pageCount`. Audit-Liste/Export akzeptieren Filter `event`/`resourceType`/`resourceId` (`audit/dto/audit-query.dto.ts`); die UI hat Resource-Typ-Filter, pro-Zeile "alle Ereignisse zu dieser Ressource" (klickbar) und eine Details-Spalte.

### B4) Space Settings → Security

Backend (DTO, `space.service` schreibt `settings.sharing.disabled` /
`settings.comments.allowViewerComments`, Enforcement in `page-access.service` /
Share-Logik) sowie der Security-**Tab** liegen bereits im Kern. Der Tab ist nur an
Space-Admin gebunden (kein Feature-Flag). Nachgebaut wurden nur die zwei Toggles
(waren im EE ausgegraut) **und** die Entfernung eines Lizenz-Gates im Kern-Backend.

**Server — Touch-Point (wichtig!):**
- `core/space/services/space.service.ts` → `updateSpace()`: der Lizenz-Check-Block für
  `disablePublicSharing` / `allowViewerComments` (`licenseCheckService.hasFeature(... SECURITY_SETTINGS / VIEWER_COMMENTS ...)` → `ForbiddenException('This feature requires a valid license')`) wurde **entfernt**. Ohne diese Entfernung liefert `/spaces/update` für diese Felder 403.

**Client — neue Dateien:**
- `apps/client/src/features/space/components/security/space-public-sharing-toggle.tsx`
- `apps/client/src/features/space/components/security/space-viewer-comments-toggle.tsx`
  (Clean-Room-Kopien ohne `useHasFeature`-Gate)

**Client — Touch-Point:**
- `features/space/components/space-security-settings.tsx`: Importe zeigen auf die neuen
  Toggles unter `@/features/space/components/security/` statt `@/ee/security/components/`

### B5) Page-Verifications (voller Approval-Workflow)

DB-Tabellen (`page_verifications`, `page_verifiers`) + der Kern-Notification-Service
(`verification.notification.ts`, verarbeitet Queue-Jobs) liegen im Kern. Nachgebaut:
Repo, Service (Status-Statemachine), Controller. Der periodische Ablauf-Reconcile
hängt an einem EE-Scheduler → Ablauf-Status wird stattdessen beim Lesen aus `expires_at`
abgeleitet (Schwelle 14 Tage); Ablauf-**Benachrichtigungen** per Cron sind nicht dabei.

**Statusfluss:** `expiring`-Typ: (none) → `verified` → abgeleitet `expiring`/`expired`.
`qms`-Typ: `draft` → `in_approval` (submit) → `verified` (verify) bzw. zurück zu `draft`
(reject) → `obsolete`.

**Server — neue Dateien:**
- `apps/server/src/core/page/page-verification/` (controller, service, module, dto)
- `apps/server/src/database/repos/page/page-verification.repo.ts`

**Server — Touch-Points:**
- `core/core.module.ts`: `PageVerificationModule` in `imports`
- `database/database.module.ts`: `PageVerificationRepo` in `providers` **und** `exports`

**Routen:** `POST /pages/(verification-info|create-verification|update-verification|delete-verification|verify|submit-for-approval|reject-approval|mark-obsolete|verifications)`. Interaktive Notifications (verified / approval-requested / -rejected) werden in die `NOTIFICATION_QUEUE` eingereiht (Kern-Prozessor verarbeitet sie).

**Client — neue Dateien:**
- `apps/client/src/features/page-verification/` (service, queries, types, `components/page-verification-modal.tsx`, `components/page-verification-badge.tsx`)
- `apps/client/src/pages/settings/workspace/verified-pages.tsx`

**Client — Touch-Points:**
- `features/page/components/header/page-header-menu.tsx`: nur der Import-Pfad `@/ee/page-verification` → `@/features/page-verification` (unser `index.ts` exportiert `PageVerificationModal`, `PageVerificationBadge`, `PageVerificationMenuItem` unter denselben Namen wie EE)
- `features/editor/full-editor.tsx`: der **Shield-Badge an der Byline** — Import `PageVerificationBadge` zeigt auf `@/features/page-verification/components/page-verification-badge` statt `@/ee/page-verification` (die EE-Badge war lizenz-gegated → „Available with a paid license")
- `App.tsx`: lazy-Import `VerifiedPages` zeigt auf `@/pages/settings/...` statt `@/ee/page-verification/...`
- `components/settings/settings-queries.tsx`: `prefetchVerifiedPages` nutzt unser `getVerifications` (Key `["page-verifications", undefined]`)
- `components/settings/settings-sidebar.tsx`: `feature: Feature.PAGE_VERIFICATION` beim Eintrag „Verified pages" entfernt

**Wo die Flows anpassbar sind:**
- **Statusfluss / Ablauf-Logik (Server):** `apps/server/src/core/page/page-verification/page-verification.service.ts` — Status-Übergänge, `computeExpiresAt()` (Period/Fixed/Indefinite) und `EXPIRING_THRESHOLD_DAYS` (Vorwarn-Fenster, aktuell 14 Tage).
- **UI-Optionen (Typen, Ablaufmodi, Perioden-Einheiten):** `apps/client/src/features/page-verification/components/page-verification-modal.tsx` (Setup-Formular) und die Enums in `.../types/page-verification.types.ts`.
- **Berechtigungen (wer darf verifizieren/verwalten):** `page-verification.service.ts` (`assertCanManage`, verify/reject-Checks).

---

### B6) Webhooks (outbound)

Eigenimplementierung (inspiriert von `russellbrenner/docmost`, aber Clean-Room):
Docmost sendet HMAC-signierte HTTP-POSTs, wenn Events im Workspace passieren.

**Server — neue Dateien:**
- `apps/server/src/core/webhook/` (controller, service, module, dto)
- `apps/server/src/database/repos/webhook/webhook.repo.ts`
- `apps/server/src/database/migrations/20260701T120000-webhooks.ts` (Tabelle `webhooks`)

**Server — Touch-Points:**
- `core/core.module.ts`: `WebhookModule` in `imports`
- `database/database.module.ts`: `WebhookRepo` in `providers` **und** `exports`
- `database/types/db.d.ts` + `entity.types.ts`: `Webhooks`-Interface + Aliase (manuell,
  da kein Codegen läuft)

**Mechanik:** `WebhookService` lauscht via **expliziter** `@OnEvent(EventName.PAGE_*/SPACE_*/WORKSPACE_*)`
(kein globaler Wildcard-Umbau am EventEmitter), filtert Webhooks nach abonnierten Events,
signiert den Body mit HMAC-SHA256 (`X-Docmost-Signature: sha256=…`) und sendet per `fetch`
(Timeout, best-effort — blockiert nie den auslösenden Request). Seit v0.96.0 läuft jede
Zustellung durch Upstreams **SSRF-Schutz** (`integrations/outbound`: `OutboundUrlGuard` +
`OutboundAgentFactory`): URL wird bei Create/Update (→ 400) und vor jeder Zustellung geprüft,
die Verbindung auf die geprüfte IP gepinnt, Redirects werden nicht gefolgt. Private/interne
Ziele sind gesperrt, solange `ALLOWED_PRIVATE_NETWORKS` sie nicht freigibt (bei uns gehen
Webhooks nur an öffentliche Endpunkte). Routen:
`POST /webhooks(/create|/update|/delete)`, `GET /webhooks/events` (Admin-only).

**Client — neue Dateien:**
- `apps/client/src/features/webhook/` (service, queries, types, `components/create-webhook-modal.tsx`)
- `apps/client/src/pages/settings/workspace/webhooks.tsx`

**Client — Touch-Points:**
- `App.tsx`: Route `/settings/webhooks`
- `components/settings/settings-sidebar.tsx`: Eintrag „Webhooks" (Workspace, role admin)

### B7) Resolve Comments (EE-Feature)

Die `comments`-Tabelle (`resolved_at`, `resolved_by_id`), der Client-Service
`resolveComment` und das Resolve-Menü existieren bereits im Kern — Letzteres war
per `useHasFeature(Feature.COMMENT_RESOLUTION)` deaktiviert, die Mutation lag im EE,
und die **Backend-Route `/comments/resolve` fehlte**.

**Server — Touch-Points:**
- `core/comment/dto/update-comment.dto.ts`: `ResolveCommentDto`
- `core/comment/comment.service.ts`: `resolveComment()` (setzt/leert `resolvedAt`/`resolvedById`,
  emittiert WS-Event, Audit `comment.resolved`/`comment.reopened`); `AUDIT_SERVICE` injiziert
- `core/comment/comment.controller.ts`: `POST /comments/resolve` (nur Parent-Kommentare, `validateCanComment`)

**Client — Touch-Points:**
- `features/comment/queries/comment-query.ts`: eigene `useResolveCommentMutation` (optimistisch), statt EE
- `features/comment/components/comment-list-item.tsx`: Import auf die Kern-Mutation umgebogen, `canResolve = true` (war auf main noch per `COMMENT_RESOLUTION` gegated) und eigener Inline-`ActionIcon` statt des EE-`ResolveComment`-Buttons

Server seit v0.96.0: `/comments/resolve` mit `@OAuthScope('write')` und derselben workspace/`deletedAt`-Seitenprüfung wie die übrigen Kommentar-Routen.
- `features/comment/components/comment-menu.tsx`: `canResolve = true` (Feature-Gate entfernt)

### B8) MCP-Server (Docmost als MCP-Anbieter)

Docmost stellt einen MCP-Server unter **`/mcp`** bereit (vom `/api`-Prefix in
`main.ts` ausgenommen — seit v0.96.0 macht Upstream das selbst, kein Touch-Point mehr), damit externe AI-Clients auf den
Wiki-Inhalt zugreifen. Clean-Room, kein EE-Code; nutzt `@modelcontextprotocol/sdk`.

**Server — neue Dateien:**
- `apps/server/src/integrations/mcp/` (`mcp.controller.ts`, `mcp.service.ts`, `mcp.module.ts`)

**Server — Touch-Points:**
- `app.module.ts`: `McpModule` in `imports`
- `core/workspace/services/workspace.service.ts`: EE-Lizenz-Gate für `mcpEnabled` entfernt

**Mechanik:** Streamable-HTTP **stateless** — frischer Server+Transport pro Request, **kein** Session-Store (`sessionIdGenerator: undefined`, `enableJsonResponse`). Läuft damit hinter einem Load-Balancer über **mehrere Instanzen ohne Session-Affinität**. Auth über `JwtAuthGuard`
→ Docmost-**API-Key** als Bearer; Tools sind auf die Rechte des Users beschränkt.
Tools: `search_pages`, `get_page`, `list_spaces` (read), `create_page`, `update_page`
(write). Optionales **Space-Scoping** über `?space=<id|slug>` (Suche/Anlegen laufen dann in diesem Space). `get_page` löst Autor/letzten Bearbeiter zu **Namen** auf; das Tool **`get_users`** löst beliebige User-UUIDs → Namen/E-Mail auf. Write-Tools werden nur registriert, wenn `MCP_ALLOW_WRITE != 'false'`
(Env-Kill-Switch). Aktivierung pro Workspace über das vorhandene `mcpEnabled`-Setting.
`create_page` prüft dieselben Space-/Parent-Rechte wie `POST /api/pages/create` und schreibt
`page.created` mit `metadata.source = 'mcp'`. Upstreams `enforceMcpOauth` (EE-OAuth) wird
ignoriert — `/mcp` akzeptiert nur API-Keys.

**Client — neue Dateien:**
- `apps/client/src/pages/settings/workspace/mcp-settings.tsx` (URL + Enable-Toggle + Hinweise)

**Client — Touch-Points:**
- `App.tsx`: lazy Route `/settings/mcp`; `/settings/ai/mcp` (Upstreams lizenz-gegateter EE-Tab) leitet auf `/settings/mcp` um
- `components/settings/settings-sidebar.tsx`: Eintrag „MCP" (Workspace, role admin)

### B9) Multi-Workspace (Multi-Host-Modus)

Eine Docmost-Instanz (auch mehrere Replicas hinter dem Load-Balancer) bedient mehrere
**vollständig getrennte Workspaces**, je einen pro **vollem Hostnamen**
(`docmost.gevekom.one` → Gevekom, `wiki.svntn.ai` → svntn). Benutzer, Spaces, Seiten,
Admins und Audit-Logs sind über `workspace_id` getrennt (Schema/`JwtStrategy` des Kerns).
**Kein** Cloud-Modus (`CLOUD` bleibt `false`, keine Billing-/Lizenz-Logik); ohne
`MULTI_WORKSPACE=true` ist das Verhalten identisch zu Upstream.

**Server — neue Dateien:**
- `apps/server/src/integrations/multi-workspace/` (`multi-workspace.module.ts` (global), `workspace-resolver.service.ts`, `workspace-host-backfill.service.ts`, `host.utils.ts` + Specs)
- Specs: `core/auth/guards/setup.guard.spec.ts`, `integrations/environment/domain.service.spec.ts`

**Server — Touch-Points (neu auftragen):**
- `app.module.ts`: `MultiWorkspaceModule` in `imports`
- `common/middlewares/domain.middleware.ts`: Workspace-Auflösung komplett über `WorkspaceResolverService.resolveWorkspace(req.headers)`
- `core/share/share-seo.controller.ts`, `core/public-space/public-space-seo.controller.ts`: duplizierte Auflösung (`findFirst`/Subdomain) durch den Resolver ersetzt
- `core/auth/guards/setup.guard.ts`: Multi-Modus-Zweig + `getSetupHostname()`
- `core/auth/auth.controller.ts` (`setupWorkspace`), `core/auth/services/auth.service.ts` (`setup(dto, opts)`), `core/auth/services/signup.service.ts` (`initialSetup(dto, trx, opts)`): geprüften Host in derselben Transaktion als `workspaces.hostname` setzen
- `core/workspace/controllers/workspace.controller.ts`: Hostname-Änderung über `/workspace/update` im Multi-Modus verboten (403)
- `integrations/environment/environment.service.ts`: `isMultiWorkspace()`, `getWorkspaceHosts()`, `getDefaultWorkspaceHost()`
- `integrations/environment/domain.service.ts`: `getUrl(hostname)` liefert im Multi-Modus `<proto>://<workspace.hostname>` (Einladungs-, Passwort-Reset-, Benachrichtigungs-, Export- und Attachment-Links)
- `integrations/mcp/mcp.controller.ts` (B8): `/mcp` liegt außerhalb des `/api`-Prefix, die Domain-Middleware läuft dort nicht → der Controller prüft im Multi-Modus selbst, dass Host-Workspace = Token-Workspace (sonst 403)

**Mechanik:**
- **Auflösung:** Request-Host = `X-Forwarded-Host` (letzter Eintrag, da `trustProxy: true`), sonst `Host`; lower-case, ohne Port. Nur Hosts aus `WORKSPACE_HOSTS` werden per `findByHostname` (vergleicht `LOWER(hostname)`) aufgelöst. Unbekannter oder nicht freigegebener Host → **kein** Workspace (404), **kein** Fallback auf den ersten Workspace.
- **Setup:** Erlaubt nur für einen freigegebenen Host ohne Workspace und nur, solange kein Workspace mit `hostname IS NULL` existiert. Der Host kommt aus dem Guard (nicht aus dem Client-DTO) und wird in der Setup-Transaktion gesetzt; der Unique-Index `idx_workspaces_hostname_lower` macht parallele Setups race-sicher (409).
- **Backfill Bestands-Workspace:** `DEFAULT_WORKSPACE_HOST` wird beim Start per einzelnem bedingtem `UPDATE` gesetzt, nur wenn genau **ein** Workspace existiert, dieser `hostname IS NULL` hat und der Host freigegeben und noch frei ist. Idempotent und replica-sicher. Manuelle Alternative: `UPDATE workspaces SET hostname='docmost.gevekom.one', updated_at=now() WHERE hostname IS NULL AND (SELECT count(*) FROM workspaces)=1;`
- **Start:** `MULTI_WORKSPACE=true` ohne `WORKSPACE_HOSTS` → Start bricht ab. Workspace ohne Hostname → Warnung (nicht erreichbar, Setup gesperrt). `COLLAB_URL` gesetzt → Warnung.
- **Cookies** sind host-only (pro Host getrennt). Die Collab/WS-Auth ist token-basiert (`workspaceId` im JWT).

**Env-Variablen:**
- `MULTI_WORKSPACE=true` (Default `false`)
- `WORKSPACE_HOSTS=docmost.gevekom.one,wiki.svntn.ai` (Allowlist, Pflicht im Multi-Modus)
- `DEFAULT_WORKSPACE_HOST=docmost.gevekom.one` (einmaliger Backfill des Bestands-Workspace; im **selben** Rollout wie `MULTI_WORKSPACE=true` setzen, sonst ist Gevekom bis zum Backfill 404)
- `APP_URL` bleibt (Protokoll + Fallback); `COLLAB_URL` leer lassen

**Betrieb:** HAProxy/Swarm muss beide Hosts mit erhaltenem `Host` (oder vom Proxy gesetztem/überschriebenem `X-Forwarded-Host`) auf denselben Service leiten; TLS für beide Hosts; alle Replicas mit identischer Env. Das **Setup für einen neuen Host sofort nach Freischaltung** durchführen — der erste Besucher wird Owner (alternativ Host erst nach dem Setup im HAProxy freigeben). Der HAProxy-SSO-Flow (A3/A4) gilt nur für `docmost.gevekom.one`. `MAIL_FROM_*` ist global, für beide Workspaces gilt derselbe Absender.

## Hinweise zur Backend-API (native Docmost-Features)

Kein Fork-Code, aber für die Backend-Integration relevant:

- **Seiten-Content aktualisieren:** `POST /api/pages/update` mit
  `{ pageId, content, format: 'markdown'|'html'|'json', operation: 'replace'|'append'|'prepend' }`.
  Der Content wird über die Collaboration-Gateway (Yjs) aktualisiert, bleibt also
  mit der Live-Bearbeitung konsistent. (`title`/`icon` optional im selben Call.)
- **Seiten anlegen:** `POST /api/pages/import` (multipart, `spaceId` + `file`) — oder
  `POST /api/pages/create`.
- **Audit-Log:** `POST /api/audit` (Suche via `query`, Cursor-Pagination) und
  `POST /api/audit/export` (CSV) — nur Workspace-Owner/Admin.

## CI / Docker-Image

Der geerbte Upstream-Workflow `.github/workflows/release.yml` (Docmosts eigene
Release-Pipeline, triggert ebenfalls auf `v*` und schlägt in unserem Fork fehl)
wurde **entfernt**. Bei künftigen Upstream-Merges ggf. erneut entfernen.

`.github/workflows/build-image.yml` baut & published das Image bei jedem
**Version-Tag `v*`** (oder manuell via workflow_dispatch) nach GHCR:
`ghcr.io/gevekom-one-gmbh/docmost-gevekom:<version>` (+ `:latest`). Die Version
wird aus dem Tag abgeleitet (`v0.96.0-1` → `0.96.0-1`). Nutzt den eingebauten
`GITHUB_TOKEN` (keine zusätzlichen Secrets). Release also z. B. via
`git tag v0.96.0-1 && git push origin v0.96.0-1`.

## Lokale Testumgebung

- Image bauen: `docker build -t docmost-gevekom:<version> .`
  (Colima/Docker-VM braucht ≥ 6–8 GB RAM, sonst OOM beim `server:build`.)
- Start: `docker-compose up -d` (Override mit echtem `APP_SECRET` verwenden).
- Schneller Dev-Loop ohne Image-Rebuild:
  - Backend: `DATABASE_URL=... REDIS_URL=... APP_SECRET=... PORT=3001 NODE_ENV=production pnpm --filter ./apps/server run start:prod`
    (db/redis-Ports müssen dafür in der Compose-Datei published sein)
  - Frontend: `APP_URL=http://localhost:3001 nx run client:dev` → Vite auf :5173 (proxyt `/api`)
- Headless-Tests: Playwright-Skripte gegen die Vite-URL (Login → Feature durchklicken).

## Bekannte Betriebs-Hinweise

- **Postgres-Major-Wechsel** (z. B. 16→18) ist kein In-Place-Upgrade — vorher Backup/Dump.
- **MFA-Erzwingung** workspace-weit würde Service-Account-Logins (Bearer-Token-Flow) brechen.
- `/auth`-Endpunkte haben einen **Rate-Limiter** (Throttler).
