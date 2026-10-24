# Creature resolution: Foundry-native first, PF2 Search second, AMBA custom fallback

**Decision date:** 2026-10-23  
**Status:** Integration strategy; **not yet implemented or runtime tested**.  
**Direction:** AMBA → Foundry VTT v14 world using the installed Pathfinder 2e game system.

## Why the pipeline differs from Owlbear and Wanderer's Guide

- **Owlbear Rodeo:** Primarily a visual tabletop. The AMBA Owlbear extension supplies numbered tokens and stat cards because it cannot count on a native PF2e creature compendium/mechanics engine.
- **Wanderer's Guide:** Has its own official creature catalog. AMBA's WG encounter exporter prefers native WG creature matches; the module's UI shows a fallback chain of *WG creature → port 3333 → monster block*. See `src/web/WgContainerExportModal.tsx` and `docs/wg-encounter-export.md` in AdventureMakerByAct. This is an **existing WG export-specific** pipeline, not a claim all AMBA monster lookups use WG.
- **Foundry:** Core Foundry is rules-agnostic, but the **installed PF2e game system** includes extensive official NPC/creature compendiums and mechanical Actors. Favor those, as they retain native HP, attacks, save DCs, spellcasting and other game-system functionality.

**Official reference:** [Foundry Pathfinder Second Edition game system](https://foundryvtt.com/packages/pf2e) describes included official creature data and mechanics. Some official art is separately licensed/purchased: [Monster Core token pack](https://foundryvtt.com/packages/pf2e-tokens-monster-core).

## Ordered lookup pipeline

For each AMBA encounter monster block:

0. **Reuse existing AMBA-owned import** when an exact stable `moduleId/encounterId/blockId` document is already in this world. Preserve token locations and GM edits; avoid repeated source lookups if provenance is still valid.
1. **Search Foundry first**: check existing world Actors and installed/visible PF2e Actor compendium indexes. Prefer source UUID or explicit existing mapping, then exact normalized name + level + book, then aliases; inspect possible variants, remaster/legacy sources, active PF2e system, and NPC type. Do not silently choose ambiguous matches. Import/copy the valid PF2e Actor to the world as needed; use native sheet and PF2e Token.
2. **If not found, ask AMBA's server-side PF2 Search service** (configured via `PF2E_API_BASE`, local default port 3333). The Foundry browser should access a scoped AMBA integration endpoint, **not `localhost:3333` directly**: localhost on the GM's browser may not be the AMBA server, and raw access may bypass authorization. Fetch canonical name, level, source, AoN ID/URL, alternate names and structured stat-block data.
3. **Retry Foundry** with canonical identity/aliases from PF2 Search. This is worthwhile for renamed, remastered or mis-specified AMBA creature entries; if the actual Actor remains absent, don't loop indefinitely.
4. **Create a custom PF2e NPC Actor in Foundry** using the best available structured stat block: PF2 Search data if present, otherwise AMBA's own `monster_block` content. Validate source against the installed PF2e version's NPC DataModel. Populate supported mechanical fields: name, level, size/traits, AC, HP, perception, saves, abilities, skills, speeds, immunities/resistances/weaknesses, melee/ranged Strikes as `melee` Items, actions/abilities and spellcasting where data is reliable. Use PF2e-native image/token size behavior. Preserve the source and original AMBA text.
5. **If data is incomplete**: still create a clearly flagged **custom NPC Actor + readable stat block** when the minimal PF2e Actor is valid, with warnings describing which mechanical actions are unavailable. Attach an AMBA Journal or publicNotes. For unparseable/invalid non-PF2e text, present an explicit review-required result rather than asserting a fully playable creature was created. This is *not* a journal-only default: custom Actors are the intended fallback. Never invent combat statistics silently.
6. **Create numbered Token instances**, using stable `moduleId/encounterId/blockId/copyIndex` flags to dedupe and preserve locations. Distinguish a creature Actor from three tokens representing three copies.

### Lookup examples

| AMBA creature | Foundry lookup | PF2 Search result | Outcome |
| --- | --- | --- | --- |
| Goblin Warrior ×3 | Exact native PF2e Actor | Not needed | Reuse/import native PF2e Actor; create 3 numbered tokens |
| Creature with source-name mismatch | No initial match | Canonical name + AoN/source IDs | Retry Foundry aliases; native Actor if resolved |
| New official-looking creature absent locally | No match | Structured PF2 Search result | Create **custom native PF2e NPC** populated from PF2 data; mark provenance |
| Homebrew creature | No match | No match | Convert AMBA's own stats to a **custom native PF2e NPC**; mark partial fields and preserve full stat block |
| Only a prose description | No match | No match | A review-required NPC/Journal; do not claim combat automation without stats |

## Data contract additions

```ts
type CreatureImportPlan = {
  amba: { moduleId: string; encounterId: string; blockId: string; quantity: number };
  input: { name: string; level?: number; sourceBook?: string; aonId?: number; statBlock?: unknown };
  resolution: {
    kind: "existing-amba" | "foundry-world" | "foundry-pack" | "foundry-retry" |
          "custom-pf2-search" | "custom-amba" | "review-required";
    actorUuid?: string;
    compendiumSourceUuid?: string;
    canonicalName?: string;
    confidence: "exact" | "strong" | "manual" | "unresolved";
    warnings: string[];
  };
  tokens: { instanceKey: string; label: string }[];
};
```

**Implementation note:** All successful imports must store provenance on `flags["amba-foundry-extension"]`, recording whether data came from Foundry, PF2 Search, or AMBA custom content and the source IDs/hash. Preserve author and user edits during reimport; avoid overwriting a modified world Actor on source changes unless the GM requests refresh.

## Verification and supporting code examples

- [Official PF2e NPC schema](https://github.com/foundryvtt/pf2e/blob/v14-dev/src/module/actor/npc/data.ts): fields include level, traits, abilities, AC, HP, saves, perception, skills, notes, and other NPC data. Strikes use native `melee` Items, **not** arbitrary arrays of attack JSON.
- [Official PF2e NPC behavior](https://github.com/foundryvtt/pf2e/blob/v14-dev/src/module/actor/npc/document.ts): NPC sheet/strikes and mechanics. [Base Actor](https://github.com/foundryvtt/pf2e/blob/v14-dev/src/module/actor/base.ts) handles valid creation and token sizing.
- [Rune Goblin encounter builder](https://github.com/rune-goblin/pf2e-encounter-builder/blob/main/src/encounter/save.ts): compendium `fromUuid`, world Actor from compendium, apply adjustments, create native Tokens.
- [Dosexe PF2e Creature Builder](https://github.com/dosexe/pf2e-creature-builder): current Foundry v14 custom NPC generator using creature-building rules, including traits, skills, spells and custom roadmaps. Examine code before implementing conversion; no mandatory dependency assumed.
- [PF2e Statblock Parser by GM RedVelvet](https://github.com/gmredvelvet-rgb/Pf2e-Statblock-Parser-by-GM-RedVelvet): v14-compatible example of text stat block → native Actor, but requires a separate license module; do not silently depend on it.
- [Foundry PF2e](https://foundryvtt.com/packages/pf2e): ships official creature rules data, though artwork is a separate concern.

## Test matrix and edge cases

1. Goblin ×3: native Foundry match; no :3333 call; 3 unique Tokens but no redundant Actors.
2. No Foundry match + PF2 match: retry Foundry once with canonical identity; if still absent, fully structured custom NPC; provenance recorded.
3. No Foundry and no PF2 match: parse AMBA homebrew block into custom NPC; mechanical fields available only when parsed/validated.
4. Missing image: keep a default or AMBA-generated Token image; distinguish art availability from rules availability.
5. Homonymous/remastered variant: demand source-book/level/UUID check; do not substitute unrelated NPC.
6. Weak/Elite: use PF2e `applyAdjustment` for native Actors; preserve AMBA block intent and show differences if source differs.
7. Same base creature on opposing sides: PF2e alliance can affect token disposition, so isolate Actor variants as appropriate.
8. Existing native NPC with GM changes: no silent overwrite; tokens may be reused with an explicit policy.
9. User clicks import twice: no duplicates, positions preserved.
10. Missing data and malformed stats: warnings shown; never represent a partly mapped Actor as mechanically complete.
11. PF2 Search timeout/auth error: use AMBA source fallback; no direct public access to PF2 service from untrusted Foundry client.

## Deliverable change

The previous [roadmap](roadmap.md) text said no dummy NPC on unresolved lookups and that stat blocks could fall back to a Journal. That was an overly narrow resolution policy. **The new requirement is to create playable custom PF2e NPC Actors where AMBA or PF2 Search provides sufficient structured data, with honest partial imports and attached stat blocks when full conversion is impossible.** A mechanical Actor importer is now a required Owlbear-parity task, not an optional afterthought.
