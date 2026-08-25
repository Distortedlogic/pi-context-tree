# Native Pi Range-Compaction Refactor Task List

## Fixed implementation contract

- Target Pi version: `0.84.3`.
- Use the public `TreeSelectorComponent` exported by `@earendil-works/pi-coding-agent`.
- Use `ctx.sessionManager.getTree()` as the live tree source.
- Use `ctx.sessionManager.getLeafId()` as the native current position.
- Open the native selector twice without navigation:
  1. First selector returns the range start entry ID.
  2. Second selector opens at the first ID and returns the range end entry ID.
- Use native Enter and cancel keys supplied by `TreeSelectorComponent`.
- Use the selector's native branch connectors, active-path marker, folding, filtering, scrolling, labels, theme, and keybindings.
- Expand a selected assistant tool-call member to its complete atomic tool-call/result group.
- Reject off-path, structural, decision-record, incomplete-turn, and incomplete-tool-group selections.
- Show invalid-selection notices and reopen the same native selector.
- Show the normalized range and token total with `ctx.ui.confirm()` after both selections.
- Apply with `ctx.navigateTree(anchorId, { summarize: false })` only after review and revalidation.
- Do not implement a local tree renderer for range selection.
- Do not deep-import Pi files.

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
- [ ] Open the first selector with the current leaf as its initial selection.
- [ ] Resolve the selected first ID through `resolveRangeEndpoint(..., "start")`.
- [ ] Reopen the first selector after an invalid first selection.
- [ ] Show `Select the last entry of the range` before the second selector.
- [ ] Open the second selector with the normalized first ID as `initialSelectedId`.
- [ ] Resolve the selected second ID through `resolveRangeEndpoint(..., "end")`.
- [ ] Reopen the second selector after an invalid second selection.
- [ ] Build the final `RangePlan` through `planRange()` only.
- [ ] Reopen the relevant selector when `planRange()` rejects a protected span.
- [ ] Cancel with no write when either selector returns `undefined`.
- [ ] Display normalized start label, end label, selected entry count, and selected token estimate with `ctx.ui.confirm()`.
- [ ] Cancel with no draft when the confirmation returns false.

---

## 2. Remove range mode from the custom panel model

File: `packages/core/src/vm/panel.ts`

- [ ] Remove `"range"` from `PanelView`.
- [ ] Remove `compressInstructions` from `PanelInput`.
- [ ] Remove the `range-apply` variant from `PanelAction`.
- [ ] Remove range eligibility fields from `PanelRow`.
- [ ] Remove range start, end, and inside-range marker fields from `PanelRow`.
- [ ] Remove the range-only protection reason field from `PanelRow`.
- [ ] Remove `compressionGroups` and `compressionGroupByEntry`.
- [ ] Remove `rangeStartId` and `rangeEndId`.
- [ ] Remove `getCompressionGroups()`.
- [ ] Remove `compressionGroupForEntry()`.
- [ ] Remove `buildRangePlan()`.
- [ ] Remove `currentRangePlan()`.
- [ ] Remove `rangeRows()`.
- [ ] Remove `clearCompressionRange()`.
- [ ] Remove `handleRangeKey()`.
- [ ] Remove the `"range"` branch from `rows()`.
- [ ] Remove the `"range"` branch from `sectionTitle()`.
- [ ] Remove the `"range"` branch from `footerHelp()`.
- [ ] Remove `r` handling from the custom tree screen.

---

## 3. Remove custom range rendering from the TUI

File: `packages/tui/src/panel.ts`

- [ ] Remove the `"range"` row-rendering case.
- [ ] Remove custom `[S]`, `[E]`, `[■]`, and `[×]` rendering.
- [ ] Remove custom range reason rendering.

File: `packages/tui/src/theme.ts`

- [ ] Remove `rangeStart` from `CtreeTheme`.
- [ ] Remove `rangeEnd` from `CtreeTheme`.
- [ ] Remove `rangeSelected` from `CtreeTheme`.
- [ ] Remove the three corresponding default theme functions.

---

## 4. Add canonical endpoint resolution to the pure planner

File: `packages/core/src/range-compress.ts`

- [ ] Remove `label` from `RangeCandidate`.
- [ ] Remove the range candidate row-label formatter.
- [ ] Add `candidateByEntryId(candidates)` that maps every group member ID to its canonical group.
- [ ] Add the result union `RangeEndpointResult`.
- [ ] Add `resolveRangeEndpoint(candidates, entryId, endpoint)`.
- [ ] Return the group's `startEntryId` for endpoint `"start"`.
- [ ] Return the group's `endEntryId` for endpoint `"end"`.
- [ ] Return the existing protection reason for protected groups.
- [ ] Return `entry is not in the active context` for an unmapped ID.
- [ ] Update `planRange()` to accept normalized group boundary IDs only.

File: `packages/core/src/index.ts`

- [ ] Export `candidateByEntryId`.
- [ ] Export `RangeEndpointResult`.
- [ ] Export `resolveRangeEndpoint`.

---

## 5. Use Pi's public live context types

File: `packages/extension/src/adapter.ts`

- [ ] Import `ExtensionAPI`, `ExtensionContext`, `ExtensionCommandContext`, and `Model` from Pi's public packages.
- [ ] Replace the custom session-manager shape with `ExtensionContext["sessionManager"]`.
- [ ] Replace custom `ModelLike` fields with the public Pi model type.
- [ ] Remove custom declarations that duplicate public `getTree()`, `getBranch()`, `getEntry()`, `getLeafId()`, and `ModelRegistry.complete()` declarations.
- [ ] Update fake-facing test types with `Pick<>` from the public interfaces.

File: `packages/extension/src/draft.ts`

- [ ] Remove obsolete comments that name the removed top-level Pi AI `complete()` API.
- [ ] Set summary output reserve to `Math.min(4096, ctx.model.maxTokens)`.
- [ ] Replace direct prompt token arithmetic with the core text-token estimator.

File: `packages/core/src/estimate.ts`

- [ ] Add `estimateTextTokens(text)` using the existing Pi-parity token ratio.
- [ ] Use `estimateTextTokens()` for approved range summaries.
- [ ] Use `estimateTextTokens()` for range prompt size checks.

---

## 6. Replace manual range schema validation with TypeBox

File: `packages/core/package.json`

- [ ] Add direct dependency `typebox` at the version resolved with Pi `0.84.3`.

File: `packages/core/src/types.ts`

- [ ] Import `Type` and `Static` from `typebox`.
- [ ] Import `Value` from `typebox/value`.
- [ ] Define `CtreeRangeCompactDataSchema` with `Type.Object()`.
- [ ] Set `additionalProperties: true`.
- [ ] Define all v1 fields once in the schema.
- [ ] Derive `CtreeRangeCompactData` with `Static<typeof CtreeRangeCompactDataSchema>`.
- [ ] Keep `CtreeRangeTailDetails` as the same derived type.
- [ ] Validate marker data with `Value.Check(CtreeRangeCompactDataSchema, value)`.
- [ ] Validate tail details with the same schema.
- [ ] Return no v1 data for `v !== 1`.
- [ ] Delete the manual field-by-field `isCtreeRangeCompactData()` implementation.

File: `package-lock.json`

- [ ] Refresh the lock file.

---

## 7. Disconnect shared panel actions from range apply

File: `packages/extension/src/panel-cmd.ts`

- [ ] Remove `compressInstructions` from `PanelOpenOptions`.
- [ ] Remove `DEFAULT_PANEL_RANGE_INSTRUCTIONS`.
- [ ] Remove `range-apply` dispatch from `executePanelAction()`.
- [ ] Remove the dynamic import of `range-compress.ts`.
- [ ] Remove `range` from the `/panel` command description.

---

## 8. Replace range panel tests with endpoint resolver tests

File: `packages/core/test/crop.test.ts`

- [ ] Remove assertions for `RangeCandidate.label`.
- [ ] Add `candidateByEntryId()` coverage.
- [ ] Add start-member normalization coverage.
- [ ] Add end-member normalization coverage.
- [ ] Add protected endpoint result coverage.
- [ ] Add off-path endpoint result coverage.

File: `packages/core/test/panel-vm.test.ts`

- [ ] Delete the complete `PanelVm range selection` test section.

File: `packages/tui/test/panel.test.ts`

- [ ] Delete the complete `ContextPanel range selection` test section.

File: `packages/extension/test/panel-cmd.test.ts`

- [ ] Delete range-action dispatch tests.
- [ ] Delete panel-specific range source-leaf revalidation tests.

---

## 9. Add native two-pass selector command coverage

File: `packages/extension/test/crop.test.ts`

- [ ] Add a fake `ctx.ui.custom()` driver for `TreeSelectorComponent`.
- [ ] Return a start ID from the first selector.
- [ ] Return an end ID from the second selector.
- [ ] Assert both selectors receive `ctx.sessionManager.getTree()` data.
- [ ] Assert neither selector calls `navigateTree()`.
- [ ] Assert the second selector receives the normalized first ID as `initialSelectedId`.
- [ ] Assert first-selector cancellation writes nothing.
- [ ] Assert second-selector cancellation writes nothing.
- [ ] Assert invalid off-path selection shows a notice and reopens the selector.
- [ ] Assert protected decision selection shows a notice and reopens the selector.
- [ ] Assert selecting a tool-result member expands to the complete group boundary.
- [ ] Assert the standard range confirmation shows normalized labels and token total.
- [ ] Assert confirmation cancellation writes nothing.

---

## 10. Update real Pi coverage

File: `packages/extension/test/golden/tui-pty.test.ts`

- [ ] Replace custom range-screen key input with native selector input.
- [ ] Select start with native Enter.
- [ ] Select end with native Enter.
- [ ] Accept the standard range confirmation.
- [ ] Assert native `Session Tree` rendering.
- [ ] Assert native branch connector output.

File: `packages/extension/test/golden/golden-scenarios.test.ts`

- [ ] Replace manually constructed range metadata with metadata returned by the canonical range apply helper.

Existing files under `packages/extension/test/golden/__goldens__/`

- [ ] Re-record deterministic output changes from the native-selector refactor.

---

## 11. Update documentation to the native two-pass flow

File: `README.md`

- [ ] Replace custom range-mode instructions with two native session-tree selections.
- [ ] Replace Space and range-marker instructions with native Enter selection instructions.
- [ ] Document invalid-selection notice and selector reopen behavior.

File: `docs/USAGE.md`

- [ ] Document first native tree selection for start.
- [ ] Document second native tree selection for end.
- [ ] Document native cancel behavior.
- [ ] Document the standard range confirmation.
- [ ] Remove `[S]`, `[E]`, `[■]`, and `[×]` descriptions.
- [ ] Remove `r` range-mode instructions from the custom panel.

File: `docs/pi-context-tree-spec.md`

- [ ] Replace the custom range panel contract with the two-pass `TreeSelectorComponent` contract.

File: `docs/pi-context-tree-architecture.md`

- [ ] State that Pi `0.84.3` publicly exports `TreeSelectorComponent`.
- [ ] Document direct `sessionManager.getTree()` input.
- [ ] Document two selector calls and no navigation during selection.
- [ ] Remove the obsolete statement that Pi does not export its selector.
- [ ] Remove the custom range tree-flattening design.

File: `CHANGELOG.md`

- [ ] Replace custom range-mode claims with native two-pass tree selection.

File: `USER_DRIVEN_RANGE_COMPACTION_IMPLEMENTATION_PLAN.md`

- [ ] Replace custom range-mode design notes with native two-pass selection notes.

---

## 12. Delete obsolete range implementation code

- [ ] Delete every custom range row and marker style from the panel and TUI.
- [ ] Delete every custom range key handler.
- [ ] Delete custom range panel state.
- [ ] Delete panel-to-range dynamic dispatch.
- [ ] Delete duplicated endpoint calculations outside `range-compress.ts`.
- [ ] Delete manual range schema field checks.
- [ ] Delete direct extension-level token arithmetic.
- [ ] Delete obsolete comments that describe Pi `0.79.1` APIs.
- [ ] Leave no compatibility branch for the removed custom range screen.

---

## 13. Verification after implementation

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
