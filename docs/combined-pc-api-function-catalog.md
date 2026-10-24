# Combined PC API/function catalog: WG core + WGUI extensions + AMBA

**Audited:** October 23, 2026. **Scope:** actual documented endpoints that may source/build player characters, related campaign/encounter lookup, plus the *entire published WG API navigation inventory* so nothing is accidentally omitted. Not an audit of all unrelated AMBA authoring endpoints. **Do not send WG APIs or raw WG JSON directly to Foundry**: AMBA constructs a canonical export DTO, and the Foundry module constructs native PF2e Actors and embedded Items.

**Verification legend:** **Verified source** = handler/router/schema was inspected; **Published** = listed in public WGUI docs but handler not individually inspected; **Observed** = local logs establish a route responds under some auth but not its entire behavior; **Spec only** = design document explicitly says not implemented; **Unverified** = unavailable to inspect in this connected environment.

## A. Wanderer's Guide core Supabase Edge Functions

Canonical base: `https://api.wanderersguide.app/functions/v1` (or the authorized local self-hosted WG instance).

| Family | Exact POST function(s) | Data or action useful to AMBA PC builds | State |
|---|---|---|---|
| Character | `find-character` | Raw character: identity, ancestry/class/background, build choices, HP/resources, inventory, prepared spells, companions, conditions, saved calculated_stats | Verified source |
| Character | `create-character` | Write/create character in WG, not needed for Foundry export | Verified source |
| Character | `update-character` | WG character edit with `expected_updated_at` optimistic concurrency; not needed to push to Foundry | Verified source |
| Build reference | `find-ancestry` | Ancestry ID/operations and traits | Published |
| Build reference | `find-versatile-heritage` | Heritage identity/abilities | Published |
| Build reference | `find-background` | Background and boosts/skills | Published |
| Build reference | `find-class` | Class rules/operations/feats | Published |
| Build reference | `find-class-archetype` | Class archetypes | Published |
| Build reference | `find-archetype` | Dedications/archetypes | Published |
| Feats and actions | `find-ability-block` | Feats, abilities, granted features, action descriptions and operations | Published |
| Spells | `find-spell` | Spells, ranks, defenses, damage, traits, descriptions/heightening | Published |
| Inventory | `find-item` | Weapons, armor, shields, consumables, runes, equipment | Published |
| Metadata | `find-language` | Language identities | Published |
| Metadata | `find-trait` | PF2 trait identities | Published |
| Monsters | `find-creature` | Official/homebrew creature definitions; optional lookup after Foundry catalog | Published |
| Source catalog | `find-content-source` | Books and user-owned homebrew provenance | Published |
| Source catalog | `find-content-update` | Content update identity/history; not normally needed for a PC push | Published |
| Source catalog | `get-content-versions` | Catalog version/cache invalidation | Published |
| Search | `search-data` | Fuzzy/advanced matching across content | Published |
| Search | `get-content-source-stats` | Source statistics; admin/debug, not needed for push | Published |
| Homebrew writer | `create-spell`, `create-item`, `create-ability-block` | Author homebrew rules in WG; **not** necessary to import those items into Foundry | Published |
| Homebrew writer | `create-ancestry`, `create-versatile-heritage`, `create-background` | Author WG build content | Published |
| Homebrew writer | `create-class`, `create-class-archetype`, `create-archetype` | Author WG build content | Published |
| Homebrew writer | `create-creature`, `create-language`, `create-trait` | Author WG content | Published |
| Homebrew writer | `create-content-source`, `delete-content` | Sources and deletion; not part of export | Published |
| Campaign | `find-campaign`, `create-campaign` | Party/campaign identity, created campaigns | Published |
| Encounter | `find-encounter`, `create-encounter` | Encounter combatants and associated data | Published |
| Campaign | `remove-from-campaign`, `reset-campaign-key` | Campaign administration, not required for Foundry export | Published |
| GM account | `gm-add-to-group`, `gm-remove-from-group`, `gm-users-in-group`, `gm-regenerate-code` | WG GM groups and joining; not Foundry user ownership | Published |
| Account | `get-user`, `update-user` | Authenticated user profile; avoid exporting private identity/credentials | Published |
| Other (not PC) | `open-ai-request`, `vector-db-query-collection`, `vector-db-populate-collection`, `report-client-error` | AI/indexing/reporting; out of Foundry PC push | Published |

Published exact routes taken from [WGUI docs navigation](https://github.com/wanderers-guide/wanderers-guide/blob/main/docs/docs.json). The base API key needs **per-character client access grant** to read individual PCs, as documented in [authentication](https://github.com/wanderers-guide/wanderers-guide/blob/main/docs/api-reference/authentication.mdx). `find-character` does **not** return a frontend-generated full v4 compiler snapshot by itself.

### WG frontend functions which are **not** Edge Functions

| Function/source | Output | Export value |
|---|---|---|
| `frontend/src/process/export/json/json-v4.ts :: jsonV4`, `getJsonV4Content` | `{version:4, character, content}` full compiled character + feats/gear/spells/senses/proficiencies/companions | Best optional enrichment if AMBA retained that source JSON |
| `frontend/src/process/export/export-to-json.ts :: exportToJSON` | Browser download of v4 JSON | Browser wrapper, no HTTP endpoint |
| `frontend/src/process/export/export-to-pdf.ts :: exportToPDF` | Browser PDF | Sheet reference, not game-system document |

## B. WGUI extension Edge Functions

Source repo/Windows checkout for `WanderersGuideUI` was **not reachable through the current connected GitHub installation or container**. The user refers to **12 custom extension functions**; available evidence verifies **two deployed names** from October 8 Supabase Kong logs in user-provided Library files. Others must be enumerated from the actual `supabase/functions/`/overlay manifest before claiming completeness.

| Exact route relative to `/functions/v1/` | Purpose | Evidence/status | Foundry relevance |
|---|---|---|---|
| `wgui-ext-find-campaign-characters` | Campaign character lookup | **Observed** POST 200 after authenticated request (log, 2026-10-08); 401 unauthenticated | Discover party PCs with allowed access |
| `wgui-ext-find-encounter` | Retrieve WGUI encounter | **Observed** POST 200 with valid authentication, 401 before | Encounter combatants/identity; optional |
| `wgui-export-character` | Full compiled WG character JSON or PDF, proposed | **Spec only**: `AdventureMakerByAct/docs/wg-character-export-edge.md` explicitly states *not implemented* and says proposed handler lives outside core in `WanderersGuideUI/supabase/wgui-export/`. AMBA has a reachability-check and raw-result client, **not proof that deployment exists** | If actually deployed, best server-side compiled snapshot, but verify and don't rely on it |
| **Remaining custom WGUI extension functions** | Names not established | **Unverified**, not safe to invent 9–10 endpoint names | Audit the actual overlay source; evaluate PC-specific handlers |

**Provenance of observed WGUI functions:** October 8, 2026 user Library logs `Pasted text(20261008-025010).txt` and `Pasted text(20261008-024416).txt`; these show 401 before successful authenticated WGUI-origin calls (200). Logs show route existence/availability at that time, not the full response schema nor present-day uptime.

## C. AMBA PC and Wanderer's Guide HTTP API

**AMBA bases:** authenticated `/api/v1` canonical, plus legacy `/api` aliases where mounted. Actual source [mountApi.ts](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/src/server/routes/v1/mountApi.ts), [pcs.ts](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/src/server/routes/pcs.ts), [wanderersGuide.ts](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/src/server/routes/wanderersGuide.ts), [owlbearExtension.ts](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/src/server/routes/owlbearExtension.ts).

| Method | Endpoint suffix (after `/api/v1`) | What it delivers | Status |
|---|---|---|---|
| GET | `/modules` | Modules user can access | Existing |
| GET | `/modules/:moduleId/pcs` | AMBA PCs with nested sheet narratives/artifacts/sidequests/metadata | Existing |
| GET | `/modules/:moduleId/pcs/:pcId/token.svg` | Token artwork for a PC | Existing |
| GET | `/modules/:moduleId/pcs/:pcId/note.svg` | PC note/card art | Existing |
| GET | `/modules/:moduleId/pcs/:pcId/sheet.png` | Rendered PC sheet graphic | Existing |
| POST | `/modules/:moduleId/pcs` | Create AMBA PC | Existing |
| PATCH | `/modules/:moduleId/pcs/:pcId` | Update PC name/order/metadata | Existing |
| DELETE | `/modules/:moduleId/pcs/:pcId` | Remove PC | Existing, not part of Foundry push |
| POST | `/modules/:moduleId/pcs/:pcId/character-sheet` | Inject/create PC sheet for ruleset | Existing |
| POST | `/modules/:moduleId/pcs/:pcId/convert-to-npc` | Convert PC to AMBA NPC | Existing |
| POST/PATCH/DELETE | `/modules/:moduleId/pcs/:pcId/sidequests[/...]` | PC narrative sidequest management | Existing |
| POST | `/narratives` | Create sheet/biography narrative | Existing |
| POST | `/artifacts` | Character sheet media/stat-block artifacts | Existing |
| POST | `/companions` | Companion/sidequest artifact infrastructure (not guaranteed PF2e familiar semantics) | Existing |
| GET | `/integrations/wanderers-guide/account` | WG linked account state | Existing |
| PUT/DELETE | `/integrations/wanderers-guide/account` | Link/unlink WG account | Existing |
| POST | `/integrations/wanderers-guide/books` | WG content-book lookup | Existing |
| POST | `/integrations/wanderers-guide/preview` | AMBA sheet → WG preview and unresolved refs | Existing |
| POST | `/integrations/wanderers-guide/preview-stream` | Streaming WG export preview | Existing |
| POST | `/integrations/wanderers-guide/export` | AMBA sheet → WG character | Existing |
| POST | `/integrations/wanderers-guide/export-step` | Staged WG export | Existing |
| GET | `/integrations/wanderers-guide/export-character/status` | Checks extra WGUI character-export stack availability | Existing check; does not prove WGUI function deployed |
| GET | `/integrations/wanderers-guide/characters` | List authorized WG characters | Existing |
| POST | `/integrations/wanderers-guide/import-from-json` | WG JSON → AMBA normalized PC sheet, optionally save/source-copy | Existing |
| POST | `/integrations/wanderers-guide/import-from-character` | Authorized WG account PC → AMBA sheet | Existing |
| POST | `/integrations/wanderers-guide/import-from-public-sheets` | Public WG sheet URL(s) → AMBA sheet | Existing |
| POST | `/integrations/wanderers-guide/character-sheet/link-rules` | Link/rules annotate PC sheet | Existing |
| POST | `/integrations/wanderers-guide/shop/link-items` | Link shop inventory items to WG content | Existing |
| GET | `/integrations/wanderers-guide/campaign/status` | WG campaign linking status | Existing |
| GET | `/integrations/wanderers-guide/campaign/list` | WG campaign discovery | Existing |
| POST | `/integrations/wanderers-guide/campaign/create` | Create WG campaign | Existing |
| POST | `/integrations/wanderers-guide/campaign/delete` | Remove WG campaign | Existing |
| POST | `/integrations/wanderers-guide/encounter/preview` | AMBA encounter preview for WG | Existing |
| POST | `/integrations/wanderers-guide/encounter/export` | AMBA encounter → WG | Existing |
| GET | `/integrations/wanderers-guide/gadget-shop/levels` | WG gadget shop levels | Existing |
| POST | `/integrations/wanderers-guide/gadget-shop/roll` | WG gadget shop random results | Existing |
| POST | `/integrations/wanderers-guide/debug/sample-cleric-l1-json`, `/debug/sample-cleric-l3-json`, `/debug/create-sample-cleric-l1`, `/debug/create-sample-cleric-l3` | Diagnostic samples; not production PC export | Existing developer tools |
| GET | `/owlbear/extension/modules/:moduleId/pcs` | Existing extension-compatible PC listing | Existing |
| GET | `/owlbear/extension/modules/:moduleId/pcs/:pcId/token.svg`, `note.svg`, `sheet.png` | Token/card/sheet assets (auth-specific) | Existing |

**Not implemented yet:** `GET /api/v1/integrations/foundry/modules/:moduleId/pcs/:pcId` returning a normalized, versioned, enriched **Foundry PC DTO** (proposal). Existing AMBA routes are not a license to bypass user/GM authorization.

## D. Consolidated Foundry PC build outputs

| Native Foundry PF2e output | Authoritative source inputs | Mapper in AMBA/Foundry | Gap |
|---|---|---|---|
| Character Actor identity/level/portrait/ownership | AMBA PC UUID/name/meta/image + GM account mapping | Actor + flags | Owner mapping |
| Class, ancestry, heritage, background, deity | AMBA sheet and WG `find-*`/v4 source | Find exact native PF2e pack Items and embed | Cross-catalog identity |
| Boosts, proficiencies, skills, HP, AC, saves | AMBA normalized sheet + WG selections and compiled stats | Build native Actor + Items; Foundry recalculates | Selection conversion and validation |
| Feats/actions/rule elements | WG ability-block references, AMBA feats, Foundry packs | Native `feat`/`action` Items | Ambiguity/homebrew |
| Inventory, weapons, armor, shield, runes, coins | AMBA sheet + WG `find-item`/inventory + Foundry packs | Physical embedded Items | Containers/runes correctness |
| Spells, focus/innate/ritual, prepared and slots | AMBA sheet, WG raw/compiled `spells`, WG `find-spell` | Native `spellcastingEntry` + `spell` Items | Preparation semantics |
| Companions/familiars | WG `companions`, AMBA artifacts, Foundry PF2e | Separate Actors/token ownership | Association and build details |
| Conditions incl. persistent fire | WG details if structured, Foundry PF2e conditions | Native Condition Items | Formula/type/recovery DC must be known |
| Token/scene position/art | AMBA map and token SVG, foundry instance flags | TokenDocuments/Scene Levels | Asset storage/position |
| Reimport without clobbering play state | AMBA ID + revision, Foundry existing Actor | Stable flags and dry-run plan | Implementation required |

### Architecture boundary

```
Public/authorized WG Edge API + verified private WGUI custom Edge funcs
     + existing AMBA PC/metadata/HTML/artifacts and optional source JSON
                   |
                   v
          AMBA buildFoundryPcDTO()
   (normalizes and redacts, resolves references, preserves provenance)
                   |
                   v
   Foundry Bridge importer → PF2e compendia matching
                   |
                   v
   Native Actor(character), class/ancestry/feats, physical Items,
   spellcastingEntry + spells, conditions, familiar, artwork, token
```

**Need to finish inventory:** inspect the actual `WanderersGuideUI` overlay's `supabase/functions` or `supabase/wgui-*` directories to enumerate all 12 custom functions. The current connected GitHub search did not expose that repo; user Windows `D:\repos` is not mounted in this environment. Do not infer 10 missing names from a claimed count.
