# AMBA → Foundry bridge implementation roadmap

Source specification: https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/docs/foundry-vtt-export-plan.md

## Direction and scope

The user initiates AMBA → Foundry export. A Foundry add-on uses AMBA REST to pull selected/queued content, then creates Foundry world Documents. Foundry → AMBA bidirectional changes are out of scope for v1. Keep the core AMBA authoring app and Foundry runtime in separate repositories.

## Milestones

1. **Bridge foundation**: manifest, GM-only browser, AMBA connection + authentication strategy, test on v14/PF2e. Scaffold started; runtime verification pending.
2. **Encounter contract**: normalize AMBA module/encounter/map/monster/PC IDs and image/grid metadata; fixtures and schema tests.
3. **Map import**: background image, 5-ft square grid, scale validation; active-scene safety and AMBA flags.
4. **Monster tokens**: PF2e Actor compendium resolution (name + level), cloned actors, numbered instances, size-aware textures, missing-Actor diagnostics.
5. **Stats**: Journal HTML/image pages from AMBA and PF2e sheets when Actors resolve. Do not synthesize fake PF2e mechanics.
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
