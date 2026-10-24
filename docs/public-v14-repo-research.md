# Public Foundry VTT v14 GitHub research

Reviewed: 2026-10-23. Scope: targeted public-repository survey, **not** an exhaustive inventory of every GitHub repository that supports v14. Sources are linked below; all third-party code remains in its original repositories (no source code copied).

## Relevant public repositories

| Repository | v14 evidence | Reusable approach | AMBA decision |
| --- | --- | --- | --- |
| [RustyJimjams/pf2e-encounter-builder](https://github.com/RustyJimjams/pf2e-encounter-builder) | README: verified v14 build 361, PF2e 8.1.2; minimum v13 | Create Scene; import fresh PF2e Actor copies; place clustered Tokens in existing Scene; GM-only encounter UI | **Priority 1**: study Actor cloning, compendium matching, Scene/Token create flow; test behavior under target versions |
| [rune-goblin/runegoblin-foundrytemplate](https://github.com/rune-goblin/runegoblin-foundrytemplate) | README: v14-only APIs, v14-verified | ApplicationV2 + Svelte 5, TypeScript + Vite, setup/deploy, release artifacts, compendium and Adventure build, UUID normalization | **Priority 1**: adopt concepts; decide whether to migrate our small starter to this tooling after first live smoke test |
| [foundryvtt/pf2e](https://github.com/foundryvtt/pf2e/tree/v14-dev) | Active v14-dev branch | Canonical PF2e data models, Actor/Token handling, compendium packs, tests, types | **Primary compatibility reference**; do not invent system data or override document classes |
| [fchrysoulas/MK-Compendiums](https://github.com/fchrysoulas/MK-Compendiums) | README supports v13/v14 | GM-only browsing, upsert/add-only/create-new/replace semantics, reference auditing | **Priority 2**: model safe import modes and diagnostics; no dependency required |
| [DFreds/dfreds-foundry-types](https://github.com/DFreds/dfreds-foundry-types) | v14 type package versioned against core builds | TypeScript compilation against Foundry types maintained from PF2e | **Priority 2**: use pinned version when migrating to TS |
| [Drental/foundryvtt-pf2e-f-is-for-flatfooted](https://github.com/Drental/foundryvtt-pf2e-f-is-for-flatfooted) | README v14.0.1 compatibility | Lightweight module manifests, keybindings, scene/token interaction | Reference only for small module practices |
| [roi007leaf/pf2e-combater](https://github.com/roi007leaf/pf2e-combater) | README requires v14 + PF2e | Token controls toolbar and combat panel integration; requires socketlib | Reference only for later interactive UI, not phase-1 dependency |
| [foundryvtt/dnd5e](https://github.com/foundryvtt/dnd5e/wiki/Adventure-Importer) | Wiki importer docs updated 2026-09 | Adventure import actions and hooks | Conceptual reference for future packaging only; do not import D&D 5e schema into PF2e |

## Official Foundry v14 APIs to check before implementation

- [v14 API index](https://foundryvtt.com/api/v14/): current public document and Application APIs.
- [Actor document](https://foundryvtt.com/api/v14/classes/foundry.documents.Actor.html): `getTokenDocument`, createDocuments, compendium imports.
- [JournalEntry document](https://foundryvtt.com/api/v14/classes/foundry.documents.JournalEntry.html): Journal pages for non-mechanical AMBA stat blocks.
- [Foundry document overview](https://foundryvtt.com/api/v14/modules/foundry.documents.html): parent/pack create options, batched operations.
- [Compendium guidance](https://github.com/foundryvtt/foundryvtt/blob/master/articles/compendium.html): importing single documents makes independent world copies, names do not dedupe, IDs need explicit attention.

## Recommended strategy adjustments

1. **Keep dedicated repo and AMBA → Foundry direction.** The Foundry module is a consumer of AMBA's normalized encounter DTO; AMBA retains authoring ownership. Foundry world edits do not sync back in v1.
2. **Use v14-native ApplicationV2 UI.** Our current browser is a proof-of-concept. Evaluate the template's typed ApplicationV2 patterns before expanding UI. Avoid tying the bridge to an unnecessary Svelte runtime until justified.
3. **Reuse proven PF2e compendium Actors.** Read pack indexes; resolve by name + level with ambiguity warnings; import/clone valid Actors, and use Token documents linked to those Actors. Never infer a full PF2e `system` payload from AMBA prose.
4. **Two distinct workflows:** *Place into active scene* (fast, non-destructive) and *Create new encounter scene* (repeatable prep). Existing-scene placement should ship first, new Scene second. Neither should clear user documents by default.
5. **Design upsert before shipping imports.** Use `flags.amba-foundry-extension` and stable keys such as `moduleId:encounterId:monsterBlockId:copyIndex`; preserve current token positions on repeat imports. Explicit destructive rebuild only with GM confirmation. Name matching is insufficient.
6. **Maps:** normalize AMBA dimensions, pixels-per-grid-square, and 5 ft distance before Scene edits. Validate aspect ratio and warn on inconsistent grid. Add map availability and asset-hosting checks.
7. **Stat-block fallback:** create a readable Journal page for every monster block; link native PF2e Actor sheets only when a trustworthy compendium Actor resolves.
8. **Production hardening:** authenticated AMBA transport/CORS, correct GM permission, publicly downloadable manifest + versioned release zip, smoke tests on actual Foundry v14/PF2e supported versions.
9. **Adventure packaging later:** use the template's compendium/Adventure source/build strategy as a candidate, not a dependency now; only implement after live imports work.

## Next engineering tasks

- Verify `module.json`, `DialogV2`, and `game.ambaBridge` entrypoint against a real Foundry v14/PF2e instance (not yet runtime-tested).
- Read source for `pf2e-encounter-builder` Actor clone and token placement code and compare with official v14 APIs.
- Define a tested AMBA encounter DTO with stable instance identifiers.
- Implement read-only **dry-run import preview** listing planned map, Actor, Token, Journal actions and unresolved assets.
- Implement active-scene map import guarded by GM role, document flags, and tests.
- Implement monster Actor resolution and numbered Token placement.
- Add a release workflow and installable manifest once actual Foundry compatibility is verified.

## Constraints

This document records research and implementation decisions. It does not vendor any third-party code, imply their licenses authorize reuse, or claim the entire GitHub universe was searched. Verify licenses before copying any source or adopting an existing template directly.
