# Gevekom Docmost — Anpassungen & Re-Integrations-Anleitung

Dieser Fork von [Docmost](https://github.com/docmost/docmost) enthält Gevekom-eigene
Anpassungen. Dieses Dokument listet **alle** Änderungen gegenüber dem Upstream auf,
damit sie bei einem künftigen Docmost-Update wieder eingespielt werden können.

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

> Alle EE-Nachbauten sind **Clean-Room**: eigener Code im AGPL-Kern, **kein**
> Enterprise-Code (`apps/*/src/ee/`) kopiert. Der Server-EE-Code ist ohnehin nicht im
> öffentlichen Repo; der Client-EE-Code ist lizenzpflichtig und wird bewusst nicht genutzt.

---

## A) Ursprüngliche Fork-Anpassungen

| # | Feature | Dateien |
|---|---------|---------|
| A1 | **Export `nozip`-Flag** — liefert Seitenbaum als JSON statt ZIP | `apps/server/src/integrations/export/export.controller.ts`, `export.service.ts` (Zweig `type: 'json'` + `buildTreeWithMetadata`) |
| A2 | **Share-Button aus Seiten-Kopfzeile entfernt** | `apps/client/src/features/page/components/header/page-header-menu.tsx` (Entfernung von `PageShareModal` + Import) |
| A3 | **`authToken` automatisch aus Browser-URL entfernen** (für HAProxy-SSO-Deeplinks) | `apps/client/src/App.tsx` (`useEffect`, entfernt `?authToken=` aus search/hash) |
| A4 | **Deep-Link-Erhalt bei Login-Redirect** (search + hash) auf Basis des nativen `?redirect=`-Flows | `apps/client/src/lib/api-client.ts` (`redirectToLogin`) |
| A5 | **Dockerfile Build-Heap** `NODE_OPTIONS=--max-old-space-size=8192` in der builder-Stage | `Dockerfile` |
| A6 | **docker-compose**: eigenes Image `docmost-gevekom:0.90.1`, Postgres auf `17-alpine` gepinnt | `docker-compose.yml` |

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
- `core/auth/services/token.service.ts`: Methode `generateApiKeyToken()`

**Client — neue Dateien:**
- `apps/client/src/features/api-key/` (service, queries, types, `components/create-api-key-modal.tsx`, `components/api-key-list.tsx`)
- `apps/client/src/pages/settings/account/user-api-keys.tsx`, `pages/settings/workspace/workspace-api-keys.tsx`

**Client — Touch-Points:**
- `App.tsx`: Importe `UserApiKeys`/`WorkspaceApiKeys` zeigen auf `@/pages/settings/...` statt `@/ee/api-key/...`
- `components/settings/settings-sidebar.tsx`: `feature: Feature.API_KEYS` bei den Einträgen „API keys" und „API management" entfernt

**Modell:** API-Key = langlebiger `api_key`-JWT; Ablauf/Widerruf werden DB-seitig (Tabelle `api_keys`, Soft-Delete) in `JwtStrategy` erzwungen.

### B2) Page-Permissions

Backend-Enforcement liegt **bereits im Kern** (`PagePermissionRepo`, `PageAccessService`,
Filterung in Suche/Export/Favoriten). Nachgebaut wurde nur die **Management-API + UI**.

**Server — neue Dateien:**
- `apps/server/src/core/page/page-permission/` (`page-permission.controller.ts`, `page-permission.service.ts`, `page-permission.module.ts`, `dto/page-permission.dto.ts`)

**Server — Touch-Points:**
- `core/core.module.ts`: `PagePermissionModule` in `imports`

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
- `app.module.ts`: `AuditLogModule` statt `NoopAuditModule` (Import **und** `imports`-Array)

**Client — neue Dateien:**
- `apps/client/src/features/audit/` (service, query, types)
- `apps/client/src/pages/settings/workspace/audit-logs.tsx`

**Client — Touch-Points:**
- `App.tsx`: Import `AuditLogs` zeigt auf `@/pages/settings/...` statt `@/ee/audit/...`
- `components/settings/settings-sidebar.tsx`: `feature: Feature.AUDIT_LOGS` beim Eintrag „Audit log" entfernt

**Route:** `POST /audit` (nur Workspace-Owner/Admin). `AuditLogService` liest workspace/actor/ip aus dem CLS-`AuditContext`.

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

**Client:** *(UI-Etappe folgt — Modal im Page-Header + „Verified pages"-Übersicht)*

---

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
