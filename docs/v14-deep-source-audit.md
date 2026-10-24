> **V14 map/schema correction:** Read [Foundry developer/API board findings](foundry-developer-boards-v14-review.md) before coding maps. v14 stores map backgrounds on **Level** documents; old flat `Scene.background` is no longer in the Scene schema. The documented grid minimum is **20 px**, not 50 px.

# Deep source audit: public Foundry v14 projects

Date: 2026-10-23 · Status: **code-reviewed reference implementations; not runtime-tested in our Foundry world**

**Scope of this dump:** detailed, path-level inspection of the implementation files that control PF2e Actor imports, creature lookup, Scene Token placement, ApplicationV2 UI, compendium upserts, and Adventure building. This is an engineering *code audit*, **not** a claim that all source files from every upstream repo were mirrored or executed. To obtain complete working-tree snapshots, use `scripts/pull-research-sources.ps1` (clones upstream sources into ignored `research-sources/`). Upstream remains canonical. No third-party source is copied into AMBA.

## Executive decision

**Promote [rune-goblin/pf2e-encounter-builder](https://github.com/rune-goblin/pf2e-encounter-builder) to first implementation reference**, ahead of RustyJimjams. It uses v14-specific APIs, pulls valid PF2e compendium Actors, deduplicates those by source + Weak/Elite variant + alliance, and deliberately separates saving a Combat from placing missing Tokens. Borrow its *approach* to compendium lookup, Actor copying, and size-aware Token generation. **Do not use its combatant-only identity as our reimport scheme**: AMBA needs stable token-instance flags independent of Combat.

Use [rune-goblin/runegoblin-foundrytemplate](https://github.com/rune-goblin/runegoblin-foundrytemplate) for **ApplicationV2, release pipeline, build tooling, and later Adventure packs**. Use [fchrysoulas/MK-Compendiums](https://github.com/fchrysoulas/MK-Compendiums) for **preflight validation, explicit import modes, and rollback design**, not as a dependency. Treat [foundryvtt/pf2e](https://github.com/foundryvtt/pf2e/tree/v14-dev) as authoritative for **ActorPF2e mechanics**.

## 1. Complete upstream source locations

Download complete upstream working trees (read licenses before reusing code):

| Project | Source checkout URL | License notes | Scope in this review |
| --- | --- | --- | --- |
| [Rune Goblin PF2e Encounter Builder](https://github.com/rune-goblin/pf2e-encounter-builder) | [ZIP](https://github.com/rune-goblin/pf2e-encounter-builder/archive/refs/heads/main.zip) | `package.json` says MIT; standalone `LICENSE` was not found during this check—verify before source reuse | Deep: `src/index.ts`, `src/data/creatures.ts`, `src/encounter/save.ts`, `src/encounter/math.ts`, `src/ui/EncounterBuilderApp.ts`, `README-dev.md`, `module.json` |
| [Rune Goblin v14 template](https://github.com/rune-goblin/runegoblin-foundrytemplate) | [ZIP](https://github.com/rune-goblin/runegoblin-foundrytemplate/archive/refs/heads/main.zip) | Template code MIT, third-party content separate | Deep: `src/index.ts`, `src/ui/ExampleApp.ts`, `src/adventure.ts`, `scripts/build-adventure.ts`, `scripts/normalize-refs.ts`, `scripts/pack.ts`, `scripts/deploy.ts`, `.github/workflows/{ci,release}.yml`, E2E README |
| [RustyJimjams PF2e builder](https://github.com/RustyJimjams/pf2e-encounter-builder) | [ZIP](https://github.com/RustyJimjams/pf2e-encounter-builder/archive/refs/heads/main.zip) | MIT | Deep: `scripts/main.js`, `scripts/encounter-builder.js`, `scripts/encounter-generator.js`, `scripts/xp-calculator.js`, `module.json` |
| [MK-Compendiums](https://github.com/fchrysoulas/MK-Compendiums) | [ZIP](https://github.com/fchrysoulas/MK-Compendiums/archive/refs/heads/main.zip) | MIT | Deep: `scripts/main.js`, `scripts/importer.js`, `scripts/utils.js`, `module.json` |
| [PF2e system](https://github.com/foundryvtt/pf2e/tree/v14-dev) | [v14-dev ZIP](https://github.com/foundryvtt/pf2e/archive/refs/heads/v14-dev.zip) | Apache-2.0 for system software; Paizo content requires separate rights | Focus: `src/module/actor/base.ts` Actor creation/token sizing, package manifest. **Large repo; not mirrored here.** |

### Core code entrypoints

- [Rune Goblin — save.ts](https://github.com/rune-goblin/pf2e-encounter-builder/blob/main/src/encounter/save.ts): `groupEntries`, `ensureActors`, `saveEncounter`, `missingFromScene`, `addEncounterToScene`, `centerTokens`, `encounterFromCombat`.
- [Rune Goblin — creatures.ts](https://github.com/rune-goblin/pf2e-encounter-builder/blob/main/src/data/creatures.ts): `INDEX_FIELDS`, `entryToCreature`, `creatureFromUuid`, `worldSourceId`, `mergeCreatures`, `loadCreatures`.
- [Rune Goblin — index.ts](https://github.com/rune-goblin/pf2e-encounter-builder/blob/main/src/index.ts): render Combat Tracker controls, GM guard, Foundry hooks and public module API.
- [Rune Goblin template — ExampleApp.ts](https://github.com/rune-goblin/runegoblin-foundrytemplate/blob/main/src/ui/ExampleApp.ts): `ApplicationV2` lifecycle, Svelte `mount/unmount`.
- [Rune Goblin template — build-adventure.ts](https://github.com/rune-goblin/runegoblin-foundrytemplate/blob/main/scripts/build-adventure.ts): bundled document ID and cross-link conversion.
- [MK-Compendiums — importer.js](https://github.com/fchrysoulas/MK-Compendiums/blob/main/scripts/importer.js): `preflightModelSource`, `importPackFromPayload`, upsert/create-new/replace, snapshot/rollback.
- [PF2e — actor/base.ts](https://github.com/foundryvtt/pf2e/blob/v14-dev/src/module/actor/base.ts): `ActorPF2e.createDocuments`, `preparePrototypeToken`, `getTokenDocument`.

## 2. Rune Goblin encounter builder: detailed behavioral trace

**Data discovery (`src/data/creatures.ts`)**

1. Lazily enumerate visible Actor compendia with `game.packs.filter`, checking user permission.
2. Query **indexes** with specific `system.details.level.value`, `system.traits`, publication and art fields, not `pack.getDocuments()` for thousands of creatures.
3. Skip invalid/missing index records and warn per failed pack rather than lose the whole result.
4. Collect native world NPCs separately. If a world Actor has `_stats.compendiumSource` (or legacy `flags.core.sourceId`), use that source to avoid showing it again as a duplicate compendium result.
5. Cache successful searches for the session; do **not** freeze a partial result after a pack error.

**Import (`src/encounter/save.ts`)**

1. Group repeated entries by `compendiumUUID|base/weak/elite|ally/enemy`; preserve count.
2. Find an existing imported Actor in a dedicated Actor folder using source UUID, variant/adjustment, and side/alliance.
3. For a missing Actor, resolve with `fromUuid`, convert the valid source via `game.actors.fromCompendium(src)`, create the world Actor, optionally invoke PF2e `applyAdjustment`, then set `system.details.alliance`.
4. Creates a **scene-less Combat** with one Combatant per quantity, storing side as module flags; it deliberately does not place tokens immediately.
5. On *Add to Scene*, filter combatants that already have tokens on that Scene; for missing ones call Actor `getTokenDocument`, arrange them by *actual token width/height* (not one square per creature), create embedded Tokens on the Scene, and update Combatants with token/scene/actor IDs.
6. The inverse function rebuilds an encounter list from Combatants and resolves source UUID/Weak/Elite state, avoiding token-synthetic Actor UUIDs for duplicates.

**Take from it:** fast index search, source UUID tracing, system-valid Actor copies, separate preflight/save/deploy, width-aware placement, GM guard, app/sidebar hooks and no-duplicate-per-combatant placement.

**Do not copy blindly:** its reimport protection is based on **Combatant ↔ Token**, not `moduleId/encounterId/blockId/copyIndex`. AMBA imports can happen without a Combat; repeated clicks must dedupe by AMBA flags even across sessions. Also Actor folder and source/variant alone are insufficient to distinguish multiple AMBA encounters sharing the same creature unless Actor reuse is explicitly intended.

**PF2e nuance:** the builder notes that a creature Actor's `system.details.alliance` affects disposition, potentially overriding a token's own disposition. Keep separate Actor variants by side if both friendly and hostile examples of the same creature are needed.

## 3. RustyJimjams builder: detailed behavior and why not to base our importer on it

- `scripts/encounter-generator.js` performs lightweight `pack.getIndex({fields})` lookups. It deduplicates by lowercase **name + level**, which can discard different remastered/homebrew creatures with identical labels. AMBA must preserve pack/UUID identity, not dedupe by name alone.
- `scripts/encounter-builder.js` `_onCreateScene` creates a Scene of **4000×3000** and **100 pixels/grid**, then inserts Tokens at spiral positions. This does not use AMBA map dimensions or grid size; not suitable for our map import.
- `_onPushToScene` pushes Tokens into any selected existing Scene. For each entry, `_resolveOrCreateActor` uses `game.actors.importFromCompendium(... keepId:false)`; repeated pushes can therefore produce redundant imported Actors and tokens. It has no AMBA stable-instance flags/upsert.
- If compendium resolution fails, it creates a minimal `npc`/`hazard` Actor by name, which risks presenting an invalid or mechanically misleading sheet. **AMBA should fail loudly on missing PF2e Actors and still deliver the AMBA prose stat block as Journal**, rather than silently fabricating a game-ready NPC.
- Positions are spiral and do not account for multi-square creature footprints: overlap risk for Large/Huge creatures.
- Its `main.js` token toolbar integration and v13→v14 compatibility shim are useful only as examples; our module can target v14 directly.

**Take:** cheap selected-pack indexing; simple GM UI; no need for encounter-generation logic or XP calculator for the bridge.

## 4. PF2e v14 system source: authoritative constraints

In `src/module/actor/base.ts`, Actor creation extends core Foundry behavior rather than acting as generic bags of JSON. It migrates incoming Actor sources, injects PF2e token settings and calculates default footprint from `system.traits.size`. `getTokenDocument` can fill width/height from system size, and `preparePrototypeToken` updates token scaling.

**AMBA implications:**
- Create valid NPCs from existing PF2e compendium sources; avoid inventing a `system` schema or registering a custom Actor type.
- Let PF2e choose creature footprint and auto-scale, then apply AMBA art, numbered token name and staging coordinates.
- Prefer `fromUuid`/source identifiers to a name-only resolver; when AMBA knows only name and level, show candidates with source pack/version and require resolution for ambiguous matches.
- If an Actor is absent, a descriptive Journal is still acceptable, **but not a functioning PF2e combatant**.
- Do not assume a generic `actorLink` policy: PCs are linked by default while NPC tokens may be synthetic; confirm semantics before generating Scene Tokens.

## 5. Template: full build and UI route

- `src/index.ts`: hooks plus `game.modules.get(id).api` (prefer this Foundry convention over our scaffold's `game.ambaBridge` global).
- `src/ui/ExampleApp.ts`: `ApplicationV2` wrapper; create one Svelte root, reuse across render cycles, unmount on close. The app's render/update lifetime is carefully handled.
- `scripts/pack.ts`: compile tracked `packs/_source/<pack>/*.json` to LevelDB using the Foundry CLI. Skip locked packs with warnings, not silent success.
- `scripts/build-adventure.ts`: collect bundled Scenes/Actors/Journals into one Adventure document; drop tokens without bundled actors, link remaining actor IDs; rewrite refs to bundled compendia into world UUIDs, leave runtime library-pack refs intact; stable 16-character Adventure ID.
- `scripts/normalize-refs.ts`: inverse pass from world UUIDs back to canonical module compendium references after editing/unpacking.
- `scripts/deploy.ts`: produces an installable module tree with built `dist/`, localization, packs, and assets.
- `.github/workflows/ci.yml`: Node install, lockfile validation, TS/Svelte typecheck, Vitest.
- `.github/workflows/release.yml`: tag-triggered manifest stamping, build, and release ZIP.
- `src/tests/e2e/README.md`: local **licensed Foundry v14** + migrated PF2e test world via Playwright; test-created documents should be cleaned up.

**AMBA decision:** adopt TypeScript/Vite/typecheck/test/release *concepts*, but **do not immediately replace our lightweight JS scaffold with Svelte**. Choose this migration once the API contract and first map import are proven. Adventure pack tooling is phase 2, not needed for the initial live bridge.

**Important distribution pitfall:** Compendium or Adventure imports create **world copies**. A later update to AMBA or the Foundry module will not automatically update world documents. Our reimport policy must explicitly track and preserve edits.

## 6. MK-Compendiums: safety and recovery reference

The compendium importer is ~939 lines and uses separate `utils.js` (~836 lines). Its important flow:

1. GM-only import; reject mismatched pack/document types, empty payloads, invalid folders.
2. Build explicit old→new ID maps, rewrite internal references, clean sources, then run **strict DataModel preflight** before any write.
3. Request confirmation before modifying a system/module-owned pack. Temporarily unlock only with GM consent and relock in `finally`.
4. Support `upsert`, `add only`, `create as new`, and destructive `replace`.
5. Ordinary upsert compares **document IDs** and batches creates/updates. This is correct for pack restores but not enough for AMBA, where IDs may be regenerated and token position is player-edited.
6. On destructive replace, save a recovery JSON snapshot first and attempt rollback if replacing fails; retain the recovery artifact when automatic rollback fails.

**AMBA decision:** implement separate **preview → validate → plan → apply** stages. Upsert by AMBA business keys stored in `flags.amba-foundry-extension`, not solely by Foundry document IDs. Never delete non-AMBA docs. GM-confirmed rebuild should have a dry-run count and preferably recovery export; no automatic destructive default.

## 7. AMBA-specific architecture after this audit

```text
AMBA API (authoritative encounter)
    |
    v
normalizeEncounterDTO()      <- static fixtures, API contract and validation
    |
    v
planImport()                 <- dry run: map, actors, tokens, journals, warnings
    |
    v
resolvePf2eActors()          <- pack indexes, source UUID + level checks, ambiguity UI
    |
    v
upsertAmbaSceneDocuments()   <- AMBA flags, batching, preserve GM token x/y
    |                  |
    +--> Maps/Scenes   +--> Actors/Tokens/Journals
    |
    v
reportImport()               <- created/updated/reused/skipped/error summaries
```

Recommended stable flag identity:

- Scene: `{ moduleId, encounterId, kind: "scene" }`
- Actor: `{ sourceUuid, adjustment, alliance, kind: "npc" }` (and explicit module/encounter scope if not shared)
- Token: `{ moduleId, encounterId, blockId, copyIndex, instanceKey, kind: "monster-token" }`
- Journal: `{ moduleId, encounterId, blockId, kind: "stat-block" }`

**Idempotence:** on reimport, existing Token position wins over AMBA staging positions. Reuse Actor when source identity/variant/side matches; update AMBA-owned text/media only when opted into refresh. Never auto-delete removed monster copies; mark them stale for explicit review.

**Map — corrected after public v14 developer/API board research (2026-10-23):** v14 Scene schema has a `levels` embedded collection and `initialLevel`; the background image lives in a **Level** (`levels[].background.src`), not in legacy top-level `Scene.background`. Create a new single-Level Scene with a durable Foundry-accessible image path, normalized width/height and squares, and `grid.size`, `grid.distance:5`, `grid.units:"ft"`. The official v14 `CONST.GRID_MIN_SIZE` is **20px**, not 50px ([source](https://foundryvtt.com/api/v14/variables/CONST.GRID_MIN_SIZE.html)). Rerasterize or reject below-minimum maps; warn before modifying a populated Scene's geometry. Test the actual level/background serialization and rendering on v14.369. See [developer board findings](foundry-developer-boards-v14-review.md).

**Authentication:** our scaffold uses browser `fetch(credentials:"include")`; cross-origin AMBA sessions may fail because of SameSite/CORS/mixed-content rules. Design an authenticated, scoped connection/pairing flow before shipping remote push/queue. No unrestricted public API and no token embedded in the public module.

**UI:** v14 ApplicationV2 GM console/sidebar action; a compact read-only preview can start as DialogV2. Register public API at `game.modules.get(MODULE_ID).api`, not as a new property on `game`. Keep controls GM-only and sanitize untrusted stat-block HTML.

## 8. Concrete change list for Amba-Foundry-Extension

### P0 — correct the foundation

1. Move API entrypoint from `game.ambaBridge` to `game.modules.get(MODULE_ID).api`, with a temporary backward-compatibility alias only if desired.
2. Introduce `encounterDTO` normalization/validation and **source-specific AMBA fixtures** before enabling world writes.
3. Make a read-only import plan: create/update/no-op/unresolved lists, counts, and warnings.
4. Pin tested Foundry 14 build/PF2e version; separate unit testing from real-world smoke testing.
5. Document authenticated API connectivity/CORS rather than assuming browser cookies cross origins.

### P1 — Owlbear parity

6. Import an AMBA map to **new Scene first** for a safer geometry test; then add an option to update an existing Scene. Both should be available eventually.
7. Build `resolvePf2eActor` using indexed compendium UUIDs, level/source checks, and an ambiguity UI.
8. Use `game.actors.fromCompendium` + validated world Actor creation with source/variant/alliance reuse.
9. Create numbered Tokens via `actor.getTokenDocument()`; use each token's actual width/height in staging; AMBA flags for idempotence.
10. Generate readable Journal stat blocks from AMBA blocks with an explicit unresolved-Actor warning.
11. Add optional PC token placement and scene-visible sheet snapshots.
12. Add save/queue/reimport behavior only after metadata-based upsert and no-duplicate tests pass.

### P2 — packaging

13. Adopt a scoped TypeScript/Vite build, CI typecheck and GitHub release manifest/zip.
14. Implement deterministic Adventure source packs and reference rewriting **only when full-module packaging is requested**.

## 9. Tests and risk register

| Test | Expected |
| --- | --- |
| Goblin ×3 import | One or intentionally reused PF2e Actor, three uniquely flagged/numbered tokens |
| Import twice | Zero duplicated tokens/Actors/Journals; coordinates preserved |
| Large/Huge creature | Width/height from PF2e, staging no overlap |
| Same name + level in two packs | Ambiguous candidate warning, no silent choice |
| Homebrew-only stat block | Journal created, no fake mechanical NPC |
| Missing/raster-unusable map | Warning, no destructive Scene geometry change |
| Different encounter shares creature | Actor reuse by explicit policy, Tokens remain separately identified |
| Friendly + hostile same creature | No unintended PF2e alliance/disposition coupling |
| Existing non-AMBA objects | Never altered or deleted by ordinary import |
| Partial document write fails | Actionable result and recoverable state; no implied atomic transaction |
| Auth/CORS failure | Readable connection guidance, no hidden insecure fallback |
| Release artifact | Installable module `module.json`, JS/CSS, image assets, test in real v14 PF2e world |

## 10. Source verification and limits

Review performed via GitHub's file-content API (complete contents for selected source files, plus targeted line ranges in very large files), GitHub manifests and README material, and official [Foundry v14 Scene](https://foundryvtt.com/api/v14/classes/foundry.documents.Scene.html), [Actor](https://foundryvtt.com/api/v14/classes/foundry.documents.Actor.html), [DialogV2](https://foundryvtt.com/api/v14/classes/foundry.applications.api.DialogV2.html), and [grid](https://foundryvtt.com/api/v14/interfaces/foundry.grid.types.GridConfiguration.html) references. No Foundry server, GitHub full-clone network path, dependency install, or runtime execution was available to verify behavior. The source-pull script enables a **complete local working-tree dump** of the four focused repos; PF2e is optional because of its large size. Do not run upstream build scripts blindly.
