# AMBA → Foundry bridge implementation roadmap

Source specification: https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/docs/foundry-vtt-export-plan.md

## Direction and scope

The user initiates AMBA → Foundry export. A Foundry add-on uses AMBA REST to pull selected/queued content, then creates Foundry world Documents. Foundry → AMBA bidirectional changes are out of scope for v1. Keep the core AMBA authoring app and Foundry runtime in separate repositories.

## Milestones

1. **Bridge foundation**: manifest, GM-only browser, AMBA connection + authentication strategy, test on v14/PF2e. Scaffold started; runtime verification pending.
2. **Encounter contract**: normalize AMBA module/encounter/map/monster/PC IDs and image/grid metadata; fixtures and schema tests.
3. **Map import**: background image, 5-ft square grid, scale validation; active-scene safety and AMBA flags.
4. **Monster tokens / creature resolution**: reuse existing AMBA-owned world Actor; search Foundry PF2e world Actors/compendiums first; if missing ask AMBA's server-side PF2 Search (port 3333) and retry Foundry with canonical identity; if still absent create a **validated custom PF2e NPC Actor** from PF2/AMBA stats (with partial-import warnings); create numbered size-aware Tokens.
5. **Stats**: Native PF2e NPC sheet and supported mechanics for both found and custom Actors; populate only validated structured fields and native strike/ability Items. Preserve the complete AMBA stat block in notes/Journal, especially for partial conversions. Never invent mechanics.
6. **PCs**: optional character Tokens + sheets/Journal snapshots.
7. **Upsert and queue**: stable AMBA IDs, position preservation, explicit rebuild, authenticated export queue.
8. **Adventure packaging**: distributable content module/Adventure pack as a separate milestone.

## Acceptance slice

Given a sample module with a mapped Goblin ×3 encounter: choose it, import a correctly aligned map, create three distinct PF2e tokens and readable stats, move a token, reimport without duplication or position loss. No destructive cleanup without explicit confirmation.

## Security & compatibility

- GM-only write operations.
- Never embed an AMBA bearer token in Foundry module source or public settings.
- No proxy that bypasses AMBA authorization; scope requests to the user.
- Reject ambiguous actors, missing map files and inconsistent grids with visible warnings.
- Foundry core v14 and PF2e version require live compatibility tests before declaring support.

## Research-driven implementation notes (2026-10-23)

See [deep source audit](v14-deep-source-audit.md). Adopt the v14-native Rune Goblin approach for PF2e compendium Actor copying, source UUID identity, size-aware Token placement and save-versus-place separation. **AMBA itself must additionally tag every token instance** and preserve GM locations on reimport; the reference implementation's Combatant-token identity is insufficient for general imports.

Build a **read-only import plan** (create/update/reuse/unresolved) and tested encounter DTO before world writes. For first map smoke test, prefer creating a new Scene to avoid resizing a GM's populated Scene; retain adding to the active Scene as a separate parity workflow. Do not create mechanically misleading dummy Actors; **do** create real custom PF2e NPC Actors from trustworthy PF2 Search or AMBA stat data, and surface partial-conversion diagnostics. Move module API to `game.modules.get(MODULE_ID).api`; design authenticated AMBA access before production.

## V14 developer-board discoveries (2026-10-23)

See [Foundry developer/API boards report](foundry-developer-boards-v14-review.md). **Critical change to milestone 3:** write the AMBA map to a Scene **Level.background.src** and set `initialLevel` appropriately; do not use legacy flat `Scene.background`. A single-level Scene is the v1 target, with map scale from `grid: {type: square, size, distance: 5, units: 'ft'}`. The official v14 minimum grid size is **20 px**, though the preferred output raster may be larger. Test on v14.369/PF2e after scene creation and reload. Never automatically resize a populated Scene.

## Creature resolution decision (2026-10-23)

Read [Foundry-first creature resolution strategy](creature-resolution-strategy.md). Foundry's installed PF2e game system already ships official creature compendiums and native combat rules. In contrast Owlbear needs AMBA-generated token/stat presentation; WG maintains its own creature catalog. **Foundry lookup → AMBA/PF2 Search on port 3333 → retry Foundry using canonical identity → custom PF2e NPC from structured PF2/AMBA stat blocks**. No mandatory WG dependency for Foundry. A custom NPC must be valid for the actual PF2e system version and must retain provenance and full AMBA stat-block text. Partial mechanics are marked, not invented.
