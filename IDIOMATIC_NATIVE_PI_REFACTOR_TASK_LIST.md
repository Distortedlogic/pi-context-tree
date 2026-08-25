# Native Pi Range-Compaction Refactor Task List

## Fixed implementation contract

- Target Pi version: `0.84.3`.
- Use the public `TreeSelectorComponent` exported by `@earendil-works/pi-coding-agent`.
- Use `ctx.sessionManager.getTree()` as the live tree source.
- Use `ctx.sessionManager.getLeafId()` as the native current position.
- Use the native selector twice without navigation:
  1. First selector returns the range start entry ID.
  2. Second selector opens at the first ID and returns the range end entry ID.
- Use native Enter and cancel keys supplied by `TreeSelectorComponent`.
- Use the selector's native branch connectors, active-path marker, folding, filtering, scrolling, labels, theme, and keybindings.
- Do not implement a local tree renderer for range selection.
- Do not deep-import Pi files.
- Do not navigate during either selector step.
- Expand a selected assistant tool-call member to its complete atomic tool-call/result group.
- Reject off-path, structural, decision-record, incomplete-turn, and incomplete-tool-group selections.
- Show invalid-selection notices and reopen the same native selector.
- Show the normalized range and token total with `ctx.ui.confirm()` after both selections.
- Use the existing required `ctx.ui.editor()` summary review gate.
- Apply with `ctx.navigateTree(anchorId, { summarize: false })` only after review and revalidation.
- Append `ctree/range-tail` before `ctree/range-compact`.
- Keep all original JSONL entries unchanged.
- Keep `/undo` recovery through `sourceLeafId`.
- Keep offline JSONL planning in `core` for tests and `pitree`.
- Keep `pitree` read-only.

---

## 1. Replace `/compress` range selection with Pi's native selector

File: `packages/extension/src/range-compress.ts`

- [ ] Import `TreeSelectorComponent` from `@earendil-works/pi-coding-agent`.
- [ ] Delete the call to `openPanel(..., { initialView: "range" })`.
- [ ] Delete dependency on `PanelAction` for `/compress` selection.
- [ ] Add `selectNativeEntry(ctx, phase, initialSelectedId)` inside this command module.
- [ ] Implement `selectNativeEntry()` with `ctx.ui.custom()` and no overlay option.
- [ ] Pass `ctx.sessionManager.getTree()` directly to `TreeSelectorComponent`.
- [ ] Pass `ctx.sessionManager.getLeafId()` as the current leaf.
- [ ] Pass `tui.terminal.rows` as terminal height.
- [ ] Pass `done(entryId)` as the native selector's select callback.
- [ ] Pass `done(undefined)` as the native selector's cancel callback.
- [ ] Pass no label-change callback.
- [ ] Pass `initialSelectedId` to the selector constructor.
- [ ] Pass native filter mode `"default"`.
- [ ] Show `Select the first entry of the range` before the first selector.
- [ ] Show `Select the last entry of the range` before the second selector.
- [ ] Open the first selector with the current leaf as its initial selection.
- [ ] Resolve the selected first ID through the canonical range candidate map.
- [ ] Reopen the first selector after an invalid first selection.
- [ ] Normalize a valid first selection to its atomic group's `startEntryId`.
- [ ] Open the second selector with the normalized first ID as `initialSelectedId`.
- [ ] Resolve the selected second ID through the same candidate map.
- [ ] Reopen the second selector after an invalid second selection.
- [ ] Normalize a valid second selection to its atomic group's `endEntryId`.
- [ ] Build the final `RangePlan` through `planRange()` only.
- [ ] Reopen the relevant selector when `planRange()` rejects a protected span.
- [ ] Cancel with no write when either selector returns `undefined`.
- [ ] Display normalized start label, end label, selected entry count, and selected token estimate with `ctx.ui.confirm()`.
- [ ] Cancel with no draft when the confirmation returns false.
- [ ] Keep optional `/compress [instructions]` text as extra summary instructions.
- [ ] Keep draft progress notification.
- [ ] Keep required editor review.
- [ ] Keep post-editor source-leaf, selected-ID, and source-hash revalidation.
- [ ] Keep tail rendering, navigation, append order, ambient refresh, and result notification.

---

## 2. Remove range mode from the custom panel model

File: `packages/core/src/vm/panel.ts`

- [ ] Remove `"range"` from `PanelView`.
- [ ] Remove `compressInstructions` from `PanelInput`.
- [ ] Remove the `range-apply` variant from `PanelAction`.
- [ ] Remove range eligibility fields from `PanelRow`.
- [ ] Remove range start, end, and inside-range marker fields from `PanelRow`.
- [ ] Remove range protection reason fields used only by the custom range screen.
- [ ] Remove `compressionGroups` and `compressionGroupByEntry` panel caches.
- [ ] Remove `rangeStartId` and `rangeEndId` panel state.
- [ ] Remove `getCompressionGroups()`.
- [ ] Remove `compressionGroupForEntry()`.
- [ ] Remove `buildRangePlan()` from `PanelVm`.
- [ ] Remove `currentRangePlan()`.
- [ ] Remove `rangeRows()`.
- [ ] Remove `clearCompressionRange()`.
- [ ] Remove `handleRangeKey()`.
- [ ] Remove the `"range"` branch from `rows()`.
- [ ] Remove the `"range"` branch from `sectionTitle()`.
- [ ] Remove the `"range"` branch from `footerHelp()`.
- [ ] Remove `r` handling from the custom tree screen.
- [ ] Keep tree, crop, turn, consumer, decision, and inspect behavior unchanged.
- [ ] Keep tree-row rendering for persisted `ctree/range-tail` and `ctree/range-compact` entries.

---

## 3. Remove custom range rendering from the TUI

File: `packages/tui/src/panel.ts`

- [ ] Remove the `"range"` row-rendering case.
- [ ] Remove custom `[S]`, `[E]`, `[■]`, and `[×]` rendering.
- [ ] Remove custom range reason rendering.
- [ ] Keep token columns and warnings for all remaining panel views.
- [ ] Keep terminal-width truncation for all remaining panel views.
- [ ] Keep fixed panel height and scrolling behavior for all remaining panel views.

File: `packages/tui/src/theme.ts`

- [ ] Remove `rangeStart` from `CtreeTheme`.
- [ ] Remove `rangeEnd` from `CtreeTheme`.
- [ ] Remove `rangeSelected` from `CtreeTheme`.
- [ ] Remove the three corresponding default theme functions.
- [ ] Keep all non-range theme functions unchanged.

---

## 4. Make range candidate resolution independent from panel rows

File: `packages/core/src/range-compress.ts`

- [ ] Keep `RangeCandidate` as the canonical atomic selection group.
- [ ] Remove `label` from `RangeCandidate`; the native selector owns row labels.
- [ ] Keep `id`, `startEntryId`, `endEntryId`, `entryIds`, path indexes, tokens, selectable state, and protection reason.
- [ ] Add `candidateByEntryId(candidates)` that maps every group member ID to its canonical group.
- [ ] Add `resolveRangeEndpoint(candidates, entryId, endpoint)`.
- [ ] Make `resolveRangeEndpoint(..., "start")` return the group's `startEntryId`.
- [ ] Make `resolveRangeEndpoint(..., "end")` return the group's `endEntryId`.
- [ ] Return a typed invalid result with the existing protection reason for protected groups.
- [ ] Return a typed invalid result for IDs outside the active context candidates.
- [ ] Keep candidate creation based on `contextSlice()` for offline planning parity.
- [ ] Keep assistant tool calls and matching results in one candidate.
- [ ] Keep orphan and incomplete tool groups protected.
- [ ] Keep decision records protected.
- [ ] Keep an incomplete current user turn protected.
- [ ] Keep structural compaction and branch-summary entries protected.
- [ ] Keep unanchored first groups protected.
- [ ] Update `planRange()` to accept normalized group boundary IDs only.
- [ ] Keep reversed boundary normalization in `planRange()`.
- [ ] Keep selected source order, continuation order, token estimate, source serialization, and SHA-256 prefix.
- [ ] Keep summary-plus-continuation tail rendering unchanged.

File: `packages/core/src/index.ts`

- [ ] Export `candidateByEntryId`.
- [ ] Export `resolveRangeEndpoint` and its typed result.

---

## 5. Use Pi's real public context and model types

File: `packages/extension/src/adapter.ts`

- [ ] Import `ExtensionAPI`, `ExtensionContext`, `ExtensionCommandContext`, and `Model` from Pi's public packages.
- [ ] Replace the custom live session-manager shape with `ExtensionContext["sessionManager"]`.
- [ ] Include native `getTree()`, `getBranch()`, `getEntry()`, and `getLeafId()` through that public type.
- [ ] Replace custom `ModelLike` fields with the public Pi model type.
- [ ] Keep only the narrow fake-compatible interfaces still required by existing command unit tests.
- [ ] Remove custom method declarations that exactly duplicate public Pi declarations.
- [ ] Keep helper functions that add real domain behavior: leaf lookup, model lookup, project name, and append-ID recovery.
- [ ] Do not add pass-through wrappers.

File: `packages/extension/src/draft.ts`

- [ ] Keep `ctx.modelRegistry.complete()` as the only completion call.
- [ ] Remove obsolete comments that name the removed top-level `complete()` API.
- [ ] Use `ctx.model.maxTokens` to derive summary output reserve.
- [ ] Set output reserve to `Math.min(4096, ctx.model.maxTokens)`.
- [ ] Move prompt token estimation into one exported core helper.
- [ ] Remove direct `chars / 4` arithmetic from the extension.
- [ ] Keep the full selected serialized source in the request.
- [ ] Keep the actionable oversized-range error.

File: `packages/core/src/estimate.ts`

- [ ] Add one text-token estimate helper based on the existing Pi-parity estimator.
- [ ] Use that helper for range prompt input estimates and approved summary estimates.
- [ ] Keep gauge behavior unchanged.

---

## 6. Replace manual range schema validation with TypeBox

File: `packages/core/package.json`

- [ ] Add direct dependency `typebox` at the version resolved with Pi `0.84.3`.

File: `packages/core/src/types.ts`

- [ ] Define `CtreeRangeCompactDataSchema` with `Type.Object()`.
- [ ] Set `additionalProperties: true`.
- [ ] Define exact v1 fields and field types once.
- [ ] Derive `CtreeRangeCompactData` with `Static<typeof CtreeRangeCompactDataSchema>`.
- [ ] Keep `CtreeRangeTailDetails` as the same derived type.
- [ ] Validate marker data with `Value.Check(CtreeRangeCompactDataSchema, value)`.
- [ ] Validate tail details with the same schema.
- [ ] Keep marker and tail entry-type checks.
- [ ] Preserve unknown later versions by returning no v1 data for `v !== 1`.
- [ ] Remove the manual field-by-field `isCtreeRangeCompactData()` implementation.

File: `package-lock.json`

- [ ] Refresh the lock file after the TypeBox dependency change.

---

## 7. Disconnect shared panel actions from range apply

File: `packages/extension/src/panel-cmd.ts`

- [ ] Remove `compressInstructions` from `PanelOpenOptions`.
- [ ] Remove `DEFAULT_PANEL_RANGE_INSTRUCTIONS`.
- [ ] Remove `range-apply` dispatch from `executePanelAction()`.
- [ ] Remove the dynamic import of `range-compress.ts`.
- [ ] Remove `range` from the `/panel` command description.
- [ ] Keep panel reopen behavior for jump, branch, merge, and crop actions.
- [ ] Keep `Ctrl+Q` view-only without command context.
- [ ] Keep decisions export unchanged.

File: `packages/extension/src/index.ts`

- [ ] Keep direct `registerRangeCompress(pi, deps)` registration.
- [ ] Keep deterministic command order.
- [ ] Keep all other registrations unchanged.

---

## 8. Keep persistence, accounting, and undo behavior

File: `packages/extension/src/range-compress.ts`

- [ ] Keep `CTREE_RANGE_TAIL` append with `{ triggerTurn: false }`.
- [ ] Keep `CTREE_RANGE_COMPACT` append after the tail.
- [ ] Keep `sourceLeafId`, `anchorId`, normalized boundaries, ordered selected IDs, token values, model reference, and source hash.

File: `packages/extension/src/undo.ts`

- [ ] Keep latest-active range marker detection.
- [ ] Keep restoration to `sourceLeafId` with `{ summarize: false }`.
- [ ] Keep range tail and marker in off-path history.
- [ ] Keep ordering against later branch, merge, and crop mutations.

File: `packages/core/src/consumers.ts`

- [ ] Keep range-tail tokens in total context accounting.
- [ ] Keep the separate `range summaries` bucket.

File: `packages/extension/src/ambient.ts`

- [ ] Keep `/compress` in red-band guidance.
- [ ] Keep `/compress` in Pi `/compact` guidance.
- [ ] Keep gauge calculations unchanged.

---

## 9. Replace range panel tests with native-selector command tests

File: `packages/core/test/crop.test.ts`

- [ ] Update candidate tests for removal of `RangeCandidate.label`.
- [ ] Add start-member normalization coverage.
- [ ] Add end-member normalization coverage.
- [ ] Keep valid planning, reversed range, leaf range, continuation, protected entry, tool group, hash, and rebuilt-tail tests.

File: `packages/core/test/panel-vm.test.ts`

- [ ] Delete the complete `PanelVm range selection` test section.
- [ ] Keep persisted range-tail and range-marker tree-row coverage.
- [ ] Keep all non-range panel tests unchanged.

File: `packages/tui/test/panel.test.ts`

- [ ] Delete the complete `ContextPanel range selection` test section.
- [ ] Remove range theme assertions.
- [ ] Keep non-range width, scrolling, crop, consumer, decision, action, and TUI smoke tests.

File: `packages/extension/test/panel-cmd.test.ts`

- [ ] Delete range-action dispatch tests.
- [ ] Delete panel-specific range source-leaf revalidation tests.
- [ ] Keep command-context coverage for remaining panel mutations.

---

## 10. Add native two-pass selector coverage

File: `packages/extension/test/crop.test.ts`

- [ ] Add a fake `ctx.ui.custom()` driver that receives `TreeSelectorComponent` instances.
- [ ] Return a start ID from the first native selector.
- [ ] Return an end ID from the second native selector.
- [ ] Assert that `ctx.sessionManager.getTree()` supplies both selectors.
- [ ] Assert that neither selector calls `navigateTree()`.
- [ ] Assert that the second selector receives the normalized first ID as `initialSelectedId`.
- [ ] Assert first-selector cancellation writes nothing.
- [ ] Assert second-selector cancellation writes nothing.
- [ ] Assert invalid off-path selection shows a notice and reopens the same selector.
- [ ] Assert protected decision selection shows a notice and reopens the same selector.
- [ ] Assert selecting a tool-result member expands to the complete group boundary.
- [ ] Assert the standard range confirmation shows normalized labels and token total.
- [ ] Assert confirmation cancellation writes nothing.
- [ ] Keep draft failure, editor cancellation, changed leaf, changed source, navigation cancellation, append order, continuation, and leaf-range coverage.

File: `packages/extension/test/index.test.ts`

- [ ] Keep `/compress` registration coverage.

File: `packages/extension/test/undo.test.ts`

- [ ] Keep range restoration and latest-mutation ordering coverage.

File: `packages/extension/test/ambient.test.ts`

- [ ] Keep `/compress` guidance coverage.

---

## 11. Update real Pi coverage

File: `packages/extension/test/golden/tui-pty.test.ts`

- [ ] Replace custom range-screen key input with native selector input.
- [ ] Open `/compress`.
- [ ] Select start with native Enter.
- [ ] Select end with native Enter.
- [ ] Accept the standard range confirmation.
- [ ] Accept the summary editor review.
- [ ] Assert native `Session Tree` rendering.
- [ ] Assert native branch connector output.
- [ ] Assert apply returns to a usable Pi prompt.
- [ ] Assert no summarize-on-leave prompt appears.
- [ ] Assert range tail precedes range marker.
- [ ] Assert original source remains in JSONL.

File: `packages/extension/test/golden/golden-scenarios.test.ts`

- [ ] Keep byte-preservation and resumed-context coverage.
- [ ] Replace manually constructed range metadata with metadata produced by the canonical planner helper.
- [ ] Keep exact append-order assertions.
- [ ] Keep absence of `branch_summary`.

Existing files under `packages/extension/test/golden/__goldens__/`

- [ ] Re-record only deterministic Pi `0.84.3` format changes produced by the refactor.

---

## 12. Update documentation to the native two-pass flow

File: `README.md`

- [ ] Replace custom range-mode documentation with the two native session-tree selections.
- [ ] Replace Space/start/end marker instructions with native Enter selection instructions.
- [ ] Explain invalid-selection notice and selector reopen behavior.
- [ ] Keep review, append-only recovery, command comparison, and `/undo` documentation.

File: `docs/USAGE.md`

- [ ] Document first native tree selection for start.
- [ ] Document second native tree selection for end.
- [ ] Document native cancel behavior.
- [ ] Document the standard range confirmation.
- [ ] Remove custom `[S]`, `[E]`, `[■]`, and `[×]` descriptions.
- [ ] Remove `r` range-mode instructions from the custom panel.

File: `docs/pi-context-tree-spec.md`

- [ ] Replace the custom range panel contract with the fixed two-pass `TreeSelectorComponent` contract.
- [ ] Keep active-context, protected-group, review, persistence, and undo requirements.

File: `docs/pi-context-tree-architecture.md`

- [ ] State that Pi `0.84.3` publicly exports `TreeSelectorComponent`.
- [ ] Document direct `sessionManager.getTree()` input.
- [ ] Document two selector calls and no navigation during selection.
- [ ] Remove the obsolete statement that Pi does not export its selector.
- [ ] Remove the custom tree-flattening design.

File: `CHANGELOG.md`

- [ ] Replace custom range-mode claims with native two-pass tree selection.

File: `USER_DRIVEN_RANGE_COMPACTION_IMPLEMENTATION_PLAN.md`

- [ ] Update completed design notes to match the native selector flow.

---

## 13. Delete obsolete implementation code

- [ ] Delete every custom range row and marker style from the panel and TUI.
- [ ] Delete every custom range key handler.
- [ ] Delete custom range panel state.
- [ ] Delete panel-to-range dynamic dispatch.
- [ ] Delete duplicated endpoint calculations outside `range-compress.ts`.
- [ ] Delete manual range schema field checks.
- [ ] Delete direct extension-level token arithmetic.
- [ ] Delete obsolete comments that describe Pi `0.79.1` APIs.
- [ ] Keep no compatibility branch for the removed custom range screen.

---

## 14. Verification

- [ ] Run `npm install`.
- [ ] Run `npm run check`.
- [ ] Run `npm test`.
- [ ] Run real Pi RPC tests.
- [ ] Run real-TUI tests with `pi` and `expect` available.
- [ ] Load with `pi -e .`.
- [ ] Install with `pi install git:github.com/Distortedlogic/pi-context-tree` in an isolated Pi agent directory.
- [ ] Confirm `/compress` opens Pi's native `Session Tree` twice.
- [ ] Confirm native branching works without `ctree/fork` markers.
- [ ] Confirm no selection step calls `navigateTree()`.
- [ ] Confirm no summarize-on-leave prompt appears.
- [ ] Confirm tool-call groups remain atomic.
- [ ] Confirm later continuation remains in context.
- [ ] Confirm all cancellation paths write nothing.
- [ ] Confirm tail-before-marker order.
- [ ] Confirm `/undo` restores `sourceLeafId`.
- [ ] Confirm resume uses the rebuilt branch.
- [ ] Confirm original JSONL bytes remain unchanged.
- [ ] Confirm `pitree` remains read-only.
- [ ] Confirm the worktree has no generated or unrelated files.
