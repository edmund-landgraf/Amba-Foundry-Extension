# Combat runtime and synchronization: AMBA / Foundry / Wanderer's Guide / Owlbear

**Decision proposal:** 2026-10-23  
**Status:** Architecture proposal only; runtime combat synchronization **not implemented**.  
**Motivation:** In Wanderer's Guide the GM manually changes initiative and HP (for example, apply 5 damage), while Owlbear displays much of the same combat information on the map. Foundry + PF2e can become a fuller combat runtime, potentially eliminating the need for a separate WG combat tracker.

## Different kinds of "in sync"

There are **two distinct contracts** that must not be conflated:

1. **Catalog identity, not database mirroring:** Foundry PF2e Actor compendiums and AMBA's server-side PF2 Search (port 3333) may cover overlapping official creatures but have different records, source IDs, remaster names, and availability. AMBA should resolve Foundry native first, then search PF2 Search for canonical identity and retry Foundry; custom-create if still unavailable. There is **no requirement to overwrite or replicate all compendiums** into either database.
2. **Runtime state:** combat instance HP, initiative, round, turn, status conditions and visibility should appear consistently in whichever applications are used during a session. The initial contract should be **one authoritative editor per encounter**, with others displaying synchronized state. Bidirectional editing requires explicit conflict resolution and identity mappings; do not enable simultaneous blind writers.

## Target operating modes

| Mode | GM controls | Players view | AMBA responsibility | WG role |
| --- | --- | --- | --- | --- |
| Existing Owlbear + WG | WG remains initiative/HP/conditions authority | Owlbear extension and/or WG | Adventure and asset export; optional read-only mirror | **Current combat authority** |
| Foundry native (recommended) | **Foundry PF2e** Actor/Combat/Token documents and roll/damage dialogs | Foundry itself, including authorized player sheets and combat tracker | Adventure/map/encounter content, handouts, custom-creature fallback | Character authoring and optional **read-only synced** combat view |
| Transitional hybrid | One GM-selected authority, either WG or Foundry | Can include Owlbear bridge | Stable IDs, transport, reconciliation and mapping | Only an explicit mirror while the other system owns changes |

**Do not require all three VTT/sheet products in one game.** A table running Foundry need not keep Owlbear open; a table running Owlbear can keep WG as combat runtime. Native Foundry automation does not imply automatic Pathfinder rules adjudication for all actions.

## Foundry-primary event contract

Proposed *per encounter* identity mapping:
`{ambaModuleId, ambaEncounterId, wgCampaignId?, wgEncounterId?, foundryWorldId, sceneId, combatId, actorId, tokenId, combatantId, wgCombatantId?, wgCharacterId?, instanceKey}`.

- Foundry combat event types: `combatant.initiative`, `combat.round/turn`, `actor.hpCurrent/hpTemporary`, `actor.conditions`, `combatant.defeated`, `token.visible/hidden`; optional roll summaries and effects after consent.
- Origin marker: `origin: "foundry" | "wg"`, `eventId`, `revision`, `timestamp`, `sourceVersion`. De-duplicate, validate and suppress echo loops.
- All state writes are performed by an **authenticated, authorized bridge** (a trusted GM or session service) with only the necessary field scope. Never expose AMBA or WG admin credentials to players or public module source.
- **Native Foundry UI is always immediately usable**; external mirrors may lag and must show a last-sync/error indicator. A network outage must not block a turn.
- Apply changes to **the correct token instance**. PF2e unlinked NPC tokens can have synthetic Actors with per-instance HP, whereas linked PCs may share world Actors. Do not update the shared Goblin world Actor when only Goblin 2 took 5 damage.
- Distinguish `applyDamage(5)` events from absolute `setHp(15)` changes; do not apply one damage event twice. Sync absolute verified post-change values by default when mirroring, not re-executing damage logic.

## Existing WG API and implementation realities

Reviewed from [AdventureMakerByAct's WG source checkout](https://github.com/edmund-landgraf/AdventureMakerByAct/tree/main/scripts/_wg-src) and [AMBA WG encounter exporter](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/docs/wg-encounter-export.md):

- WG `EncounterSchema` has `combatants.list[]` with stable `_id`, `initiative` and `data`; `create-encounter` is an **upsert of the full encounter combatants object**, not a documented per-combatant patch API. In its UI, encounter writes are debounced (~200ms). **Blindly writing a Foundry snapshot back into WG can clobber active WG edits.**
- WG **PC combatants** reference a WG Character ID; the current UI uses `createEncounterCharacterWriter` for PC HP and conditions, with `find-character` and version-checked `update-character` + three-way merge/conflict handling. **For PCs, do not assume updating the WG Encounter combatant row updates the Character's HP.**
- WG **creature combatants** may carry a creature snapshot and per-combatant data, separate from PCs. Initiative is stored in the encounter row; mutable NPC HP may live in that encounter's combatant entity/data.
- AMBA's `docs/wg-encounter-export.md` currently documents a one-shot export to WG, not a continuous combat-state bridge. AMBA `docs/play-now-execution-plan.md` explicitly does **not** include combat tracking or real-time WebSocket sync in its MVP.
- Therefore: WG bidirectional live combat sync is an **additional scoped integration milestone**, not an existing capability. Investigate authorization and WG APIs before promising real-time two-way updates.

## Staged build

### Stage 1: Native Foundry combat (no WG sync required)

1. AMBA encounter/creature/map import.
2. Foundry Combat document with native PF2e Actors/Tokens.
3. GM can roll initiative, use native attacks, apply damage/healing, change conditions and end turns without WG.
4. Players see the relevant Foundry controls/map under their permissions.
5. Stable AMBA↔Foundry mapping and no-duplicate scene imports. Preserve synthetic Token HP, not just Actor name.

### Stage 2: Read-only combat mirroring

1. Listen to documented Foundry `updateCombat`, `updateCombatant`, `updateActor`, `updateToken`, and condition/effect hooks (verify exact v14+PF2e signatures at runtime).
2. Normalize changed values into versioned combat snapshots or events.
3. Offer an **optional player-facing AMBA/WG companion view** if there is a supported and authorized consumer; don't assume a WG app tab auto-refreshes when its backing data changes.
4. Never silently write to WG on every Foundry event until its concurrency semantics and permissions are accounted for.

### Stage 3: Carefully reconciled WG mirror (opt-in)

1. Prove a valid WG encounter mapping and stable combatant identity mapping. Distinguish WG PC Character source from NPC encounter instances.
2. For WG reads, map initiative, HP, conditions and relevant round state. Verify whether WG models round/turn as an encounter field at all (the current schema has no explicit round field; the UI may keep a separate round log).
3. For WG writes, refetch the authoritative WG encounter/character, merge **only intended runtime fields** into fresh data, and handle concurrent edits, errors and audit logs.
4. **One-way authoritative updates from Foundry** is the default. Reverse edits (WG→Foundry) only after the user enables WG-primary or a conflict-resolution UI, with revision checks preventing ping-pong loops.
5. Test near-simultaneous edits and network interruption before enabling automatic writes.

## Acceptance tests

- Goblin 1, 2, 3 share creature definition but have independent current HP on synthetic Tokens.
- GM applies 5 damage to Goblin 2 in Foundry; Goblin 1 & 3 HP are unchanged; all Foundry clients see the new HP.
- Combat tracker initiative and active turn remain correct after reload.
- If a mirror is enabled, the companion UI eventually shows Goblin 2's resulting **absolute HP**, not “apply 5 damage again”.
- If WG is primary, a WG PC's current HP update uses its Character record, not only the Encounter snapshot.
- A stale/offline mirror never overwrites newer authoritative combat data.
- GM moves a token on a map; reimporting AMBA adventure content preserves its x/y, current HP and effects.
- Tables not using WG or Owlbear can run combat entirely inside Foundry.

## Implementation warning

Do not define “in sync” as continuously copying entire `Combat`/WG `Encounter` JSON objects in both directions. Use explicit per-field/per-instance state, ownership and revision mapping. This is a separate feature from Foundry/PF2 Search creature lookup.

## References

- [Foundry combat overview](https://foundryvtt.com/article/combat/)
- [Foundry v14 Combat API](https://foundryvtt.com/api/v14/classes/foundry.documents.Combat.html)
- [Foundry v14 updateCombatant hook](https://foundryvtt.com/api/v14/functions/hookEvents.updateCombatant.html)
- [Rune Goblin Encounter Builder](https://github.com/rune-goblin/pf2e-encounter-builder/blob/main/src/encounter/save.ts)
- [WG encounter panel](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/scripts/_wg-src/frontend/src/pages/campaign/panels/EncountersPanel.tsx)
- [WG encounter upsert function](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/scripts/_wg-src/supabase/functions/create-encounter/index.ts)
- [WG PC combat writer](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/scripts/_wg-src/frontend/src/utils/encounter-character-writer.ts)
