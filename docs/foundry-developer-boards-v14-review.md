# Foundry VTT developer/API boards — AMBA relevance review

**Reviewed:** 2026-10-23  
**Latest official v14 stable release checked:** [14.369 (2026-10-08)](https://foundryvtt.com/releases/14.369)  
**Scope:** Public and searchable Foundry developer discussion sources plus official v14 APIs/release notes to verify recommendations. Findings are prioritized for the separate **AMBA → Foundry** bridge. This was a targeted sweep of relevant categories and issues, **not all Discord conversations or every historical issue**.

## 1. Where the developer discussion actually lives

| Board/resource | URL | Accessibility and reliability | AMBA usage |
| --- | --- | --- | --- |
| Official core GitHub **Issues**, especially `api`, `breaking`, `scenes`, `tokens`, `compendium`, `packages`, `appV2` labels | https://github.com/foundryvtt/foundryvtt/issues | Public, searchable, dated; outcomes show issue status/build | **Primary** for v14 feature and bug decisions |
| Official core GitHub **Discussions** | https://github.com/foundryvtt/foundryvtt/discussions | Public; mixed migration announcements/Q&A; some dynamic lists fail to render anonymously | Reference for migration explanations |
| The Forge Discourse **Package Development** category | https://forums.forge-vtt.com/c/package-development/11 | Public, searchable threads; most low-level API examples are **2020-era** | Secondary, use for concepts, **never blindly copy old APIs** |
| Foundry official **#dev-support** and **#module-development** Discord channels | https://foundryvtt.com/article/migration/ and https://foundryvtt.com/article/package-release-api/ | Real-time official/community developer support; individual Discord threads not fully accessible from public web | Request clarification there later if API behavior uncertain |
| Official v14 **API reference** | https://foundryvtt.com/api/v14/ | API contract (not discussion board); documentation view observed at v14.368 | **Final implementation check** |
| Official v14 **release notes** | https://foundryvtt.com/releases/ | Core team documents resolved issue IDs and stable build numbers | Prefer current stable changelog over old discussion |

The Forge's [category explanation](https://forums.forge-vtt.com/t/about-the-package-development-category/6126) explicitly says its archive was created to make otherwise-unsearchable developer Discord questions persistent.

## 2. P0 — v14 map/Scene Levels is an actual architecture change

**Evidence:**
- [Foundry v14 Stable 1 (14.359), released 2026-04-01](https://foundryvtt.com/releases/14.359): native multi-level Scenes are the flagship v14 feature. Simple one-level scenes are still supported, but levels are part of the internal model.
- Official [BaseScene schema](https://foundryvtt.com/api/v14/classes/foundry.documents.BaseScene.html) lists `levels` and `initialLevel`, **not the old flat `background` field**.
- Official [Level schema](https://foundryvtt.com/api/v14/classes/foundry.documents.Level.html) includes `background`, `foreground`, `fog`, `textures`, and `elevation`.
- An independent real-world [v14 map importer report](https://github.com/gmtoolkit/foundryvtt-golarion-maps/blob/main/DECISIONS.md) documented how `Scene.create({background:...})` silently lost its background when moving to v14 and required `levels[].background.src`.

**AMBA change:** model a default AMBA map as **one Scene with one Level** and map the image to that Level's background; set the initial Level explicitly where appropriate. Before implementation, capture a known-good v14.369 Scene document in a disposable PF2e world, verify `levels` payload and initial-level options, and assert the image actually renders after reload. Use `Scene.createDocuments` / document update APIs, **not direct LevelDB modification**. Our previous documentation said only “Scene background”; that is insufficient and potentially incorrect in v14.

**Existing Scene edits:** do not casually resize or shift a populated Scene; geometry changes can reposition Tokens/Regions unexpectedly. v14.369 explicitly fixed [placeables repositioning on Scene resize (#14159)](https://foundryvtt.com/releases/14.369) and [region scaling during Scene resize (#14158)](https://foundryvtt.com/releases/14.369). Prefer create-new-Scene as first map import; make update-existing a separate opt-in mode after preservation tests.

**Grid:** official [v14 GRID_MIN_SIZE](https://foundryvtt.com/api/v14/variables/CONST.GRID_MIN_SIZE.html) = **20** pixels, not 50. [GridConfiguration](https://foundryvtt.com/api/v14/interfaces/foundry.grid.types.GridConfiguration.html) has `size`, `distance`, `units`. Use `grid: {type: CONST.GRID_TYPES.SQUARE, size: ..., distance: 5, units: 'ft'}`, validate dimensions/aspect before applying.

## 3. P0 — the public API migration boundary is real

- [v14 compatibility removals, core issue #13436](https://github.com/foundryvtt/foundryvtt/issues/13436), closed in v14 Prototype 1 (14.349), lists old grid and ApplicationV2 interfaces that have been removed. `GridLayer#size` is replaced by `canvas.grid.size`, and `ApplicationV2#bringToTop` became `bringToFront`.
- [Official migration guides](https://foundryvtt.com/article/migration/) are the intended reference for breaking changes, and official API docs distinguish supported Public from unstable Private methods.
- v14's [Document and DataModel guidance](https://foundryvtt.com/api/v14/modules/foundry.documents.html) documents validated creation/update through Document APIs, hierarchy and embedded-document parent relationships.

**AMBA change:** target v14 explicitly; reject old examples in The Forge/GitHub issues when signatures are obsolete. Use public `foundry.documents.*`, `foundry.applications.api.*`, `Scene.createEmbeddedDocuments('Token', ...)`, and documented grid APIs. Avoid overrides of PF2e classes or private canvas internals.

## 4. P0 — repeated imports must preserve user data

- [v14 Prototype 1 notes](https://foundryvtt.com/releases/14.349) introduced batched operations across collections, and improved `DocumentCollection#importDocument` conflict handling for a supplied existing ID.
- v14.369 [fixes](https://foundryvtt.com/releases/14.369) include data-operation cache integrity (#14820), embedded collection replacement (#14373), and Adventure exporter duplication (#14765). These reinforce the need to test failure/retry—not a reason to expect every import workflow to be atomic.
- Older, still educational [Forge discussion on setFlag persistence](https://forums.forge-vtt.com/t/why-does-setflag-seem-to-work-but-when-i-refresh-the-data-wasnt-really-changed/7127) points out aliasing and unawaited write races; code samples are from **2020** and not to be reused verbatim.

**AMBA change:** implement `planImport() → validate → apply → report` with durable business identity flags on AMBA-owned Actors/Scene/Tokens/Journals. Await all writes. Make the import retryable; use document transactions/batches only after checking actual v14 semantics, especially when multiple document collections are involved. Preserve GM token x/y and all non-AMBA documents. No default destructive “replace all”.

## 5. P1 — token movement and scene level semantics

- [`Scene#moveTokens`, issue #13580](https://github.com/foundryvtt/foundryvtt/issues/13580), completed for v14 Prototype 2 (14.352), provides a public multi-token move/resize API. It is relevant to **later** repositioning and rebuild operations; AMBA should avoid calling it during reimport when the user has moved tokens.
- v14 [Scene API reference](https://foundryvtt.com/api/v14/classes/foundry.documents.Scene.html) includes `availableLevels`, `firstLevel`, `initialLevel`, and `getUserLevel` among its interface.
- [v14 Stable 1 scene-level introduction](https://foundryvtt.com/releases/14.359) says Tokens and other placeables can belong to levels. Our token staging must be aware of the target level and elevation in future multi-level encounters.

**AMBA change:** v1 supports only **single-level** AMBA tactical maps. Tag the AMBA Level and place matching tokens on that level (confirm exact Token/Level relation against v14 API). A future Scene map stack can opt into multiple floors and elevation—but do not assume it works just by adding map images.

## 6. P1 — module UI and packaging

- [AppV2 issue #14315](https://github.com/foundryvtt/foundryvtt/issues/14315) reported misdirected menu click targets; v14.369 [lists the fix](https://foundryvtt.com/releases/14.369). Test GM button callbacks on **14.369** rather than infer behavior from old bug reports.
- [v14 package manifest compatibility issue #13024](https://github.com/foundryvtt/foundryvtt/issues/13024) clarifies legacy `minimumCoreVersion` vs `compatibility.minimum`; our new module manifest already uses the modern structure.
- [system generation compatibility issue #13160](https://github.com/foundryvtt/foundryvtt/issues/13160), completed in 14.355, improves coarse matching of system major versions.
- [dependency installation issue #14372](https://github.com/foundryvtt/foundryvtt/issues/14372) impacted missing/unlisted optional packages and Quickstart Adventure worlds; closed Sep 14, 2026 for **14.368**. Avoid requiring unlisted helpers by default.
- [Official package release API](https://foundryvtt.com/article/package-release-api/) documents manifest/releases and an opt-in authenticated publish workflow. The release token must be kept secret in GitHub Actions secrets, never in repository files.

**AMBA change:** use `ApplicationV2` for GM import app; prefer `game.modules.get(id).api` for public API; add appropriate manifest compatibility and release ZIP when runtime-tested. Module works without a third-party helper dependency.

## 7. P1 — AMBA transport and hosted image assets

- v14.369 [release notes](https://foundryvtt.com/releases/14.369) introduce easier native HTTPS configuration for Foundry hosting. This **does not** resolve AMBA cross-origin CORS, mixed content, private image authorization, or session-cookie restrictions by itself.
- [Forge developer Q&A on two-site communication](https://forums.forge-vtt.com/t/how-to-create-a-communication-channel-between-two-sites/6772) is a **2020 browser-extension discussion**, not a recommended modern authentication design.
- [Media Optimization Guide](https://foundryvtt.com/article/media/) and [Content Packaging Guide](https://foundryvtt.com/article/packaging-guide/) support retaining durable, correctly packaged art for users.

**AMBA change:** settle authenticated AMBA bridge API design and asset-hosting/upload policy before considering remote `push` finished. Prefer signed/authorized image access or durable Foundry-local uploaded assets with correctly scoped credentials, rather than permanent references to development `localhost` URLs. Test self-hosted HTTPS and a Forge-hosted environment with proper CORS and no public leaking of private AMBA maps.

## 8. Lower-priority/historical boards we reviewed

- [Forge — synthetic Actor and Item creation](https://forums.forge-vtt.com/t/how-do-i-retrieve-a-newly-created-item-object-when-created-on-a-synthetic-actor/7182), **2020**: old APIs and issue resolved around Foundry 0.7.2; **not** evidence of a v14 current bug.
- [Forge — Package Development category](https://forums.forge-vtt.com/c/package-development/11) has many 2020-era Hooks, Handlebars, manifest, localization posts and some 2026 hosting questions. Useful topic taxonomy but *not* preferred authority over current official v14 docs.
- [Journal editing disconnect report #14645](https://github.com/foundryvtt/foundryvtt/issues/14645), opened 2026-07-28, marked non-repro at review: not evidence of a confirmed general v14 Journal import defect; preserve editor state and avoid unnecessary rewrites nevertheless.

## 9. Decisions incorporated into AMBA Foundry plan

1. **Correct map writer**: write image into a `Level` within a new `Scene`—not legacy top-level `Scene.background`.
2. **Grid minimum correction:** replace 50px assumption with **20px** per v14 API. Prefer 100–140px per AMBA square when assets permit; this is a visual-quality choice, not a platform minimum.
3. **Pin smoke target:** latest verified official stable version at review **14.369**; match an installed PF2e v14-compatible release, and record actual core/system build tested before setting manifest `verified`.
4. **Keep single-level v1**: no automatic Level stacks, lighting, walls, Regions, or multi-elevation tokens yet; design DTO with optional level expansion.
5. **Scene resizing safeguard**: create new Scene first, do not resize GMs' populated Scenes automatically.
6. **Preflight and idempotence**: preserve user changes through AMBA flags and no-op handling; make retries safe after partial writes.
7. **Add public board regression watchlist** to release review (manual, not automated): `api`, `breaking`, `scenes`, `tokens`, `compendium`, `packages`, `appV2`; read actual issue status and latest stable notes.
8. **Authentication and image permanence** are blocking design concerns, independent of document construction.

## 10. Acceptance updates

- New AMBA Scene creates at least one valid Level with `background.src`, visible image and correct 5-ft grid.
- After reload, Scene and Level exist and image remains visible.
- Map with square-size below `CONST.GRID_MIN_SIZE` is rejected/rerasterized with a warning; valid 20+ passes schema and quality preflight.
- Reimport after GM moves a token makes no position changes.
- Importing the same encounter twice creates no duplicate AMBA-owned docs.
- Existing Scene resize requires explicit acknowledgement and a backup/preview when Tokens or Regions already exist.
- Module UI callbacks and GM permission tests pass on **14.369** (and documented target PF2e build).
- Wrong API base URL, CORS, expired authorization, and unavailable private map image each produce distinct actionable warnings.

## Limits

GitHub Discussions may be difficult to render fully while logged out; Discord history isn't globally searchable. This report prioritizes **public dated issues** and verifies conclusions against official v14 API/release docs. It doesn't claim to read every developer discussion or to run Foundry. Source links are for independent verification; no external posts are republished verbatim.
