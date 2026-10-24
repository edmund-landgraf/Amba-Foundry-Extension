# AMBA player-character data: verified WG import and Foundry export inputs

**Reviewed:** 2026-10-23 · **Verification:** source-code and test inspection of `edmund-landgraf/AdventureMakerByAct`; no live AMBA database or actual player account inspected. This document confirms **data and import capability**, not a playable Foundry PC exporter.

## Executive finding

**AMBA can be the authoritative source for PC content sent to Foundry.** AMBA imports Wanderer's Guide (WG) characters using uploaded JSON, linked-account character selection and public sheet URLs; creates/updates AMBA `PC` records; and saves a populated PF2e sheet as HTML. Import conversion carries WG builder choices and parks unmapped WG-owned data in a hidden `wgImportLeftover` HTML payload. Optionally it copies full WG JSON and PDF into module uploads with metadata links. **The original WG JSON is not copied by default** (`copyJson` state defaults to `false`), so a Foundry adapter must work with normalized AMBA sheet data even when the original source file is unavailable.

The Foundry PC import should be **AMBA → Foundry**, independent of WG being online at play time. WG is only an *upstream optional character source*. GM/player ownership and synchronization of live character changes are separate later concerns.

## What the schema actually stores

From [Prisma PC model](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/prisma/schema.prisma):

`PC {id: UUID, moduleId, name, sortOrder, metadata?: JSON, createdAt, updatedAt, narratives[], artifacts[], sidequests[]}`.

The **sheet mechanics are not direct Prisma PC columns**. The WG import writes a sheet **Narrative** (`format: "html"`) and `metadata.characterSheetAssetRef`, `metadata.characterSheetRuleset: "pf2e"`. Additional stat-block content may be saved as a `page` artifact; copied source WG JSON/PDF references are stored in PC metadata.

From [Pf2eCharacterSheetData](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/src/shared/pf2eCharacterSheet.ts): name/level, ancestry/heritage/background/class, deity, abilities, HP/current/temp, AC, saves, perception, skills, speed, size/traits, languages, proficiency details, melee/ranged strikes, inventory, feats, spell lists, slots, focus/innate spells, hero points, XP, notes, `wgSelections`, and `wgImportLeftover`.

Note: values are *sheet data*, not already-validated Foundry PF2e `Actor<character>` sources. The adapter must resolve Foundry Items, perform game-system calculations and validate the installed PF2e version.

## Verified import flow and code

- [WG import UI](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/src/web/WanderersGuideImportModal.tsx): `resolveNames` defaults true; `copyJson`, `copyPdf`, and `addStatBlock` each default false.
- [Service](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/src/server/services/wanderersGuideExport.ts): `runWanderersGuideImportFromJson`, `runWanderersGuideImportFromCharacter`, `runWanderersGuideImportFromPublicSheets`, `applyWgImportToPc`. Authorized API calls support preview/apply, bulk import and optional source-asset copying.
- [Conversion](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/src/shared/wanderersGuideExport/wgFriendly/wgImportToSheet.ts): WG v4/character JSON → WG-friendly doc → completed `Pf2eCharacterSheetData` → HTML. Returns warnings, unresolved references, leftovers, and stat-block HTML.
- [Mapping](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/src/shared/wanderersGuideExport/wgFriendly/wgFriendlyToSheetData.ts): ancestry/background/class/heritage; HP; abilities; AC; saves; skills; strikes; inventory; feats; spells; languages; selections; notes.
- [Preservation](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/src/shared/wanderersGuideExport/wgFriendly/collectWgImportLeftover.ts): unmapped WG-owned fields retained in `wgImportLeftover`; encyclopedia-wide data omitted intentionally.
- [Source-copy service](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/src/server/services/wgImportSourceFiles.ts): optional JSON/PDF upload and additional stat-block page.
- [WG import guide](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/docs/wanderers-guide-export.md): documents current import limitations and paths.
- [WG parser tests](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/src/shared/wanderersGuideExport/wgFriendly/wgImportToSheet.test.ts): tests ancestry/class/level, spells, inventory, compiled stats, numeric-ref resolution, and round-trip selection retention.
- [Leftover/completeness tests](https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/src/shared/wanderersGuideExport/wgFriendly/collectWgImportLeftover.test.ts): verifies hidden leftovers and no dropped top-level keys for a fixture.

**Test evidence is code inspection, not a fresh test run.** The repository also includes `scripts/wg-import-completeness.mts`, which audits sample/local WG characters, but its execution or result was not verified here.

## Fidelity and completeness caveats

1. Original WG source `JSON` may not have been copied: default is **off**. A hidden leftover payload retains selected otherwise-unmapped data but is not a byte-for-byte source archive. Re-parsing edited HTML may lose builder provenance or subtle spell/item details.
2. Some WG operation choices and numerical IDs may be unresolved without WG API access. Tests show compiled WG v4 information can populate visible stats, but **not every imported character has a complete, validated mechanical build**. Older user guide warns that computed stats are blank for some import-v1 formats; inspect actual imported records instead of relying on that blanket statement.
3. Ancestry/class/feat/item/spell labels in AMBA are **not automatically Foundry Item UUIDs**. Foundry PF2e requires the correct source Items, rule elements, feats, class, ancestry, heritage, background, equipment, spellcasting entries and prepared/known spell relationships for its automation to function.
4. HP, hero points, inventory quantities, conditions, spell slots and other character state can evolve during play. Initial PC import is **content transfer**; do not overwrite an active Foundry PC's runtime state on repeat export. Reimport should be explicit and previewed.
5. Foundry player ownership must be mapped to Foundry users; WG account ownership does not automatically map to a Foundry user.

## Proposed PC export contract

Define an **AMBA canonical PC DTO** (server-side) that is independent of WG's source representation. Populate from `PC.metadata` plus the actual sheet narrative and artifacts. When a source JSON copy exists, optionally use it as *supplemental provenance* and disambiguation material, not as an always-present dependency.

```ts
type AmbaPcForFoundry = {
  pcId: string; moduleId: string; revision: string;
  identity: { name: string; level: number; ancestry?: string; heritage?: string;
              background?: string; className?: string; playerName?: string };
  mechanics: { abilities?: Record<string, number>; hp?: { max?: number; current?: number; temp?: number };
               ac?: number; saves?: Record<string, string>; skills?: unknown[];
               languages?: string[]; speed?: string; feats?: unknown[]; inventory?: unknown[];
               spells?: unknown; heroPoints?: number };
  provenance: { origin: "wg" | "amba"; wgCharacterId?: number;
                sourceJsonAvailable: boolean; unresolved: string[] };
  sheet: { html: string; statBlockHtml?: string; leftovers?: unknown };
  media: { portraitUrl?: string; tokenImageUrl?: string };
};
```

**Implement in phases**:

1. Read-only normalized PC preview with field-coverage report; identify WG JSON availability, unresolved feats/Items/spells and rule selections.
2. Create or reuse a valid Foundry PF2e **character Actor** with basic identity and sheet + image, not just a generic token.
3. Match and import **native PF2e embedded Items** (class, ancestry, background, heritage, feats, gear, spells), resolving identity/version safely and displaying ambiguous/unresolved rows. Rely on PF2e rules to recalculate derived stats.
4. Compare AMBA's HP/AC/saves against Foundry-derived results, surface differences rather than force overriding calculated values.
5. Optional PC Token in Scene; explicit user ownership binding, no duplicate Actors on reimport, preserve live HP/spell slots/conditions.
6. Later: WG source refresh and/or live character sync, only if explicitly desired. No WG connectivity needed for basic Foundry export.

## Confirmation boundary

This analysis verifies **capabilities in source code and test cases**. It does **not** verify which individual PCs in a live AMBA module have complete original WG JSON, nonempty `wgSelections`, resolved Items/spells or playable PF2e mechanical representations. That requires querying chosen AMBA PC records or exported fixtures and validating against an actual Foundry v14/PF2e installation.
