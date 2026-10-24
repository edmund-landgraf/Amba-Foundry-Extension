# AMBA Foundry Extension

Separate Foundry VTT v14 / PF2e add-on for the **AMBA → Foundry** integration. AMBA is the encounter source; Foundry receives Scene, Actor, Token and Journal documents. Foundry-to-AMBA sync is outside v1 scope.

## Current state

Phase 1 **scaffold only**: manifest, configurable AMBA API origin, GM-only encounter browser, API client and unit tests. The module **does not yet import maps, tokens or stat blocks**. No verified Foundry runtime testing has been done.

## Development installation

1. Copy this folder to `<Foundry User Data>/Data/modules/amba-foundry-extension` (folder ID must match `module.json`).
2. Enable it in a Foundry v14 world using PF2e.
3. In module settings, set the AMBA API URL. Ensure CORS, authentication and HTTPS/mixed-content rules permit requests from the Foundry host. Local AMBA browser sessions may not be sent in cross-site contexts because of SameSite and third-party cookie rules; production integration needs a deliberate credential flow, **not** a hardcoded API token.
4. As GM, open the Foundry developer console and run `game.ambaBridge.open()`.
5. Select a module and list encounters.

## Next deliverables

- Validated AMBA encounter DTO and full encounter preview.
- Foundry GM panel/action instead of console entrypoint.
- Non-destructive map/grid import to an active Scene.
- PF2e compendium Actor resolution and numbered monster tokens.
- Journal stat blocks, optional PC tokens and metadata-based upsert.

See `docs/roadmap.md`. Original AMBA plan: https://github.com/edmund-landgraf/AdventureMakerByAct/blob/main/docs/foundry-vtt-export-plan.md

## Tests

Requires Node.js 20+: `npm test`. These test the standalone client helpers only, not Foundry APIs.

## Public Foundry v14 code audit

- [Deep code audit and revised import strategy](docs/v14-deep-source-audit.md)
- [Public repository shortlist](docs/public-v14-repo-research.md)
- [Pull full upstream source snapshots (Windows)](scripts/pull-research-sources.ps1) into ignored `research-sources/` — no third-party code is included in the AMBA repository.
