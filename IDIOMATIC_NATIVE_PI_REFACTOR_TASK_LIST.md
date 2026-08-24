# Idiomatic Native Pi Refactor Task List

## Goal

Replace custom session-tree, panel, model, schema, and test behavior with public Pi APIs and exported `pi-tui` components wherever these APIs exist.

The final `/compress` flow must look and behave like Pi's native double-`Esc` session tree. Range compaction must remain user-started, reviewed, append-only, and recoverable.

## Non-negotiable rules

- [ ] Use public Pi APIs as the source of truth.
- [ ] Do not deep-import private Pi modules.
- [ ] Do not copy a complete private Pi component into this project.
- [ ] Do not create a second live-session parser when Pi already supplies the session tree.
- [ ] Use exported `pi-tui` components for focus, scrolling, selection, keys, theme, and width handling.
- [ ] Use an established schema package when one already exists in Pi or this dependency graph.
- [ ] Do not add thin wrappers.
- [ ] Keep `core` independent from Pi for offline JSONL, `pitree`, and pure planning use.
- [ ] Keep the standalone `pitree` host read-only.
- [ ] Keep all session changes append-only.
- [ ] Keep `ctx.navigateTree(..., { summarize: false })` for range apply and undo.
- [ ] Do not change existing JSONL lines.
- [ ] Do not change `/branch`, `/merge`, `/crop`, `/panel`, `/undo`, or `pitree` behavior without an explicit compatibility test.

---

## 1. Verify the native Pi extension surface before code changes

Target sources: the pinned Pi package, Pi extension types, Pi tree selector, and `pi-tui` exports.

- [ ] Confirm the exact pinned Pi version used by the fork.
- [ ] Read the implementation used by double-`Esc` and `/tree`.
- [ ] Record the native tree node type, flatten function, row model, collapse state, preview behavior, and key flow.
- [ ] Confirm whether Pi exports its native tree selector in the current version.
- [ ] Confirm whether Pi exports a generic tree or list component that the selector uses.
- [ ] Confirm whether an extension can invoke the built-in tree selector directly.
- [ ] Confirm whether an extension can invoke a built-in command directly.
- [ ] Confirm the exact public shapes of:
  - [ ] `ctx.sessionManager.getTree()`.
  - [ ] `ctx.sessionManager.getBranch()`.
  - [ ] `ctx.sessionManager.getChildren()`.
  - [ ] `ctx.sessionManager.getEntry()`.
  - [ ] `ctx.sessionManager.getLeafId()`.
  - [ ] `ctx.sessionManager.buildSessionContext()`.
  - [ ] `ctx.ui.custom()`.
  - [ ] The theme and keybinding objects passed to `ctx.ui.custom()`.
- [ ] Confirm which `pi-tui` list, tree, scroll, focus, key, width, and text components are public.
- [ ] Record each missing public API as a Pi API gap. Do not hide an API gap behind permanent copied code.

### Upstream-first decision gate

- [ ] If the native selector is public, use it directly with the smallest supported range-selection extension point.
- [ ] If the native selector is private but can be exported without a new design, prepare an upstream Pi change that exports it.
- [ ] If native range selection needs a new API, propose one of these upstream interfaces:
  - [ ] `ctx.ui.selectTree(...)` with custom eligibility and row decoration.
  - [ ] An exported native `TreeSelectorComponent` with a selection-mode adapter.
  - [ ] A native multi-endpoint range-selection mode.
- [ ] Do not accept a permanent local clone of Pi's complete selector as the final design.
- [ ] If an upstream change cannot land now, isolate the minimum compatibility adapter in one file and add a removal issue linked to the upstream change.

---

## 2. Fix fork installation and package resolution first

Affected files:

- `package.json`
- `extensions/pi-context-tree.ts`
- Workspace package manifests under `packages/*/package.json`
- Existing source-load and package-load tests

Current risk: a Git install of the fork can resolve the published `@pi-context-tree/extension@0.1.1` instead of the fork workspace implementation.

- [ ] Reproduce `pi install git:github.com/Distortedlogic/pi-context-tree` in a clean Pi agent directory.
- [ ] Confirm which physical extension source Pi loads after that install.
- [ ] Remove any dependency path that can silently select the old registry extension.
- [ ] Use a standard npm workspace, packed workspace, or bundled package layout that includes the fork implementation.
- [ ] Remove the thin root forwarding module if the final package layout makes it unnecessary.
- [ ] If a root entry remains required by Pi, make it the real package entry instead of a thin forwarding wrapper.
- [ ] Verify that Git install, npm install, and `pi -e .` load the same command implementation.
- [ ] Add an existing-suite test that installs or packs the fork and confirms `/compress` comes from the fork source.
- [ ] Verify update and uninstall commands.

---

## 3. Use Pi's native live-session tree

Affected files:

- `packages/extension/src/adapter.ts`
- `packages/extension/src/panel-cmd.ts`
- `packages/core/src/vm/panel.ts`
- `packages/core/src/tree.ts`
- `packages/core/src/range-compress.ts`
- `packages/pitree/src/ui.ts`

### Separate live and offline sources

- [ ] Keep `SessionTree.fromEntries()` for offline JSONL files, fixtures, and `pitree`.
- [ ] Stop rebuilding the live Pi tree from `sessionManager.getEntries()` when Pi already supplies native topology.
- [ ] Add the real read-only tree methods to `CtxLike` with Pi's exported types.
- [ ] Pass native live-tree data into the in-Pi panel.
- [ ] Keep the offline adapter explicit and separate from the live adapter.
- [ ] Do not make a generic pass-through wrapper around `sessionManager`.
- [ ] Add one purposeful adapter only where native and offline node shapes must meet a shared pure view-model contract.

### Remove the custom flat tree behavior

Current problem in `packages/core/src/vm/panel.ts`: `treeRows()` performs a custom depth-first walk and increases depth only for `ctree/fork` entries.

- [ ] Delete the fork-marker-only depth rule.
- [ ] Represent every native parent-child edge.
- [ ] Represent every native sibling branch, including branches that have no `ctree/fork` marker.
- [ ] Preserve native file order and native child order.
- [ ] Use the native current leaf and current branch path.
- [ ] Keep off-path branches in the tree.
- [ ] Use Pi's native collapse defaults.
- [ ] Use Pi's native current-row and leaf markers.
- [ ] Use Pi's native labels and branch summaries.
- [ ] Do not infer native branch topology from ctree metadata.

---

## 4. Replace the custom panel tree with the native selector presentation

Affected files:

- `packages/tui/src/panel.ts`
- `packages/tui/src/theme.ts`
- `packages/core/src/vm/panel.ts`
- `packages/extension/src/panel-cmd.ts`

### Native layout

- [ ] Render the same connector guides as Pi: `├─`, `└─`, and `│`.
- [ ] Match Pi's indentation rules.
- [ ] Match Pi's row order.
- [ ] Match Pi's collapsed-branch indicator.
- [ ] Match Pi's current path, selected row, and current leaf presentation.
- [ ] Match Pi's scroll window and keep-selected-row-visible behavior.
- [ ] Match Pi's preview or detail area when that feature is available through public APIs.
- [ ] Match Pi's help and cancel behavior.

### Reuse exported `pi-tui` behavior

- [ ] Replace custom selection-list mechanics with the exported Pi list or tree component.
- [ ] Replace custom focus state with Pi's focus interfaces.
- [ ] Use the keybinding object supplied by `ctx.ui.custom()`.
- [ ] Use Pi's key matching helpers for arrow, Enter, Space, Escape, and printable keys.
- [ ] Use Pi's width and truncation helpers for every row.
- [ ] Use Pi's scroll component or list viewport instead of local scroll arithmetic.
- [ ] Keep fixed-height behavior only if the native overlay contract requires it.
- [ ] Remove custom behavior that duplicates a public `pi-tui` feature.

### Native theme

Current problem in `packages/tui/src/theme.ts`: the in-Pi panel uses a custom Chalk theme instead of Pi's supplied theme.

- [ ] Use the theme passed to the Pi overlay factory.
- [ ] Map range start, range end, selected range, protected, warning, and token states through Pi theme roles.
- [ ] Keep a separate standalone theme adapter only for `pitree ui`.
- [ ] Do not use hard-coded colors in the in-Pi host.
- [ ] Keep ANSI-safe width checks through Pi's width utilities.

---

## 5. Keep range selection as a small adapter over the native tree

Affected files:

- `packages/core/src/range-compress.ts`
- `packages/core/src/vm/panel.ts`
- `packages/tui/src/panel.ts`

- [ ] Keep range-specific state limited to start group, end group, normalized span, and validation notice.
- [ ] Decorate native rows with range eligibility instead of creating a second tree row model.
- [ ] Keep `Space` start/end, `x` clear, `Enter` confirm, `Esc` return, and `q` close.
- [ ] Keep `r` as the normal panel entry to range mode.
- [ ] Keep range selection on the active model context only.
- [ ] Keep off-path rows visible but unavailable.
- [ ] Keep decision records protected.
- [ ] Keep an incomplete current user turn protected.
- [ ] Keep incomplete assistant tool-call groups protected.
- [ ] Highlight all entries in a selected atomic group.
- [ ] Show token totals from the canonical planner result.
- [ ] Return validation errors as panel notices, not thrown TUI errors.

### Remove duplicate range logic

- [ ] Keep one canonical candidate and group builder.
- [ ] Keep one canonical endpoint normalization function.
- [ ] Keep one canonical protected-entry decision.
- [ ] Keep one canonical token total.
- [ ] Keep one canonical source serialization and source hash.
- [ ] Delete duplicate range calculations from `PanelVm` after the native adapter supplies them.

---

## 6. Use standard Pi message and tool-call handling

Affected files:

- `packages/core/src/range-compress.ts`
- `packages/core/src/serialize.ts`
- `packages/core/src/types.ts`
- `packages/extension/src/draft.ts`

Current custom code includes message labels, role switches, tool-call/result matching, and transcript serialization.

- [ ] Find Pi's exported message normalization and serialization utilities.
- [ ] Reuse Pi's canonical tool-call/result relation utility if it is public.
- [ ] Reuse Pi's canonical text extraction utility if it is public.
- [ ] Reuse Pi's canonical image placeholder and token estimate behavior.
- [ ] Reuse Pi's canonical role names and message types instead of local duplicate unions where possible.
- [ ] If Pi does not export these utilities, keep one small pure module and add parity tests against Pi fixtures.
- [ ] Do not keep separate role-switch implementations in `serialize.ts`, `range-compress.ts`, `consumers.ts`, and the panel.
- [ ] Define one standard row-label formatter for offline use only.
- [ ] Ensure the summary request receives full selected messages without silent per-entry truncation.
- [ ] Keep atomic assistant tool-call groups in source order.
- [ ] Reject orphan or incomplete tool groups with a clear reason.

---

## 7. Replace manual schema guards with a standard schema solution

Affected file:

- `packages/core/src/types.ts`

Current custom code includes manual object checks for range marker data and range-tail details.

- [ ] Check whether Pi already uses and exports a schema package for session entries.
- [ ] Check existing project dependencies before adding a package.
- [ ] Use the existing schema package when it covers versioned object validation.
- [ ] Define one v1 range metadata schema.
- [ ] Infer the TypeScript type from that schema.
- [ ] Reuse the same schema for marker data and tail details.
- [ ] Allow unknown additive fields.
- [ ] Preserve unknown later schema versions without interpreting them as v1.
- [ ] Remove the hand-written field-by-field range validator.
- [ ] Keep entry-type guards small and based on the canonical schema result.
- [ ] Add malformed, unknown-field, and later-version coverage in an existing test file.

---

## 8. Use Pi's standard model limits and draft path

Affected file:

- `packages/extension/src/draft.ts`

Current custom code estimates prompt fit with direct character arithmetic and a fixed output reserve.

- [ ] Use the current model from Pi's command context.
- [ ] Use Pi's model registry and standard auth path.
- [ ] Use the existing `DraftFn` dependency injection point.
- [ ] Use the model's declared `contextWindow` and `maxTokens`.
- [ ] Reuse Pi's token estimator when it is public.
- [ ] Otherwise, call the single estimator from `core`; do not repeat `chars / 4` in the extension.
- [ ] Derive output reserve from the selected model instead of a fixed unexplained constant.
- [ ] Account for system prompt, user prompt, and required output reserve once.
- [ ] Return one actionable size error.
- [ ] Keep the full selected source intact when it fits.
- [ ] Keep the summary-only response contract and required review gate.

---

## 9. Make the apply flow use one Pi command-context service

Affected files:

- `packages/extension/src/range-compress.ts`
- `packages/extension/src/panel-cmd.ts`
- `packages/extension/src/adapter.ts`
- `packages/extension/src/crop-cmd.ts`
- `packages/extension/src/merge.ts`

Current custom code repeats wait, leaf validation, navigation, message append, marker append, notification, and ambient refresh patterns.

- [ ] Identify the smallest shared mutation service that has real behavior and is not a thin wrapper.
- [ ] Centralize idle wait and source-leaf revalidation.
- [ ] Centralize the exact `navigateTree(..., { summarize: false })` apply gate.
- [ ] Centralize append ordering only when crop, merge, and range use the same invariant.
- [ ] Keep command-specific planning and metadata outside the shared service.
- [ ] Keep all Pi writes behind the established adapter boundary.
- [ ] Recheck the source leaf after panel close.
- [ ] Recheck source leaf, selected IDs, and source hash after editor review.
- [ ] Stop before writes on draft, editor, validation, or navigation cancellation.
- [ ] Append `ctree/range-tail` with `{ triggerTurn: false }` and no `deliverAs`.
- [ ] Append `ctree/range-compact` after the visible tail.
- [ ] Refresh ambient UI after successful writes only.

### Remove the panel import cycle cleanly

Current code uses a dynamic import from `panel-cmd.ts` to `range-compress.ts`.

- [ ] Move shared panel action contracts into a neutral module if that removes the cycle without a wrapper.
- [ ] Inject action handlers into the panel host when Pi's architecture supports that pattern.
- [ ] Keep the dynamic import only if it remains the standard ESM solution after the module boundary is corrected.
- [ ] Do not create a pass-through module only to change import direction.

---

## 10. Use a standard mutation registry for undo and tree rendering

Affected files:

- `packages/extension/src/undo.ts`
- `packages/core/src/ctree.ts`
- `packages/core/src/vm/panel.ts`

Current custom code adds one `if` branch per mutation type in the extension.

- [ ] Move marker interpretation into a pure core mutation model.
- [ ] Define the recovery target and user description for branch, merge, crop, and range markers in one registry or discriminated reducer.
- [ ] Keep reverse active-path order as the sole last-mutation rule.
- [ ] Use canonical schema parsing before a marker enters that model.
- [ ] Let the panel and undo command consume the same mutation interpretation.
- [ ] Keep `navigateTree(target, { summarize: false })` as the only undo write-like action.
- [ ] Keep new summary and marker entries off-path after undo.
- [ ] Remove duplicate marker-label formatting from the panel and undo command.

---

## 11. Standardize consumer accounting and ambient guidance

Affected files:

- `packages/core/src/consumers.ts`
- `packages/extension/src/ambient.ts`

- [ ] Use a central custom-message classification table instead of repeated custom-type switches.
- [ ] Keep full range-tail content in token accounting.
- [ ] Keep range summaries separate from generic extension messages.
- [ ] Keep Pi's native `getContextUsage()` as the primary gauge source.
- [ ] Keep one canonical fallback estimator.
- [ ] Do not alter native gauge behavior while refactoring tree selection.
- [ ] Keep `/compress` in red-band and `/compact` guidance.
- [ ] Keep guidance text separate from context-measurement logic.

---

## 12. Keep registration direct and standard

Affected file:

- `packages/extension/src/index.ts`

- [ ] Keep one direct `registerRangeCompress(pi, deps)` call.
- [ ] Keep deterministic command order.
- [ ] Keep command registration free from packaging indirection.
- [ ] Do not add a registration wrapper.
- [ ] Confirm `/compress` appears in Pi autocomplete and `get_commands` after Git install and source load.

---

## 13. Refactor tests that duplicate implementation behavior

### Core tests

Affected files:

- `packages/core/test/crop.test.ts`
- `packages/core/test/panel-vm.test.ts`

- [ ] Keep pure range planning tests independent from Pi.
- [ ] Move range cases into an existing test file only if project policy still forbids a focused new file.
- [ ] Test the canonical group builder once.
- [ ] Test native-adapter parity separately from pure planner behavior.
- [ ] Replace repeated key-navigation loops with an existing test helper or a substantive panel driver.
- [ ] Do not copy planner logic into expected-value setup.

### TUI tests

Affected file:

- `packages/tui/test/panel.test.ts`

- [ ] Render the component that uses Pi's exported list/tree behavior.
- [ ] Add native connector-guide assertions.
- [ ] Add native collapse and sibling-branch assertions.
- [ ] Keep start, end, inside-range, protected, narrow-width, and scrolling coverage.
- [ ] Use the existing virtual terminal harness instead of direct string-only tests where native focus or scrolling matters.
- [ ] Remove test helpers that duplicate component navigation rules.

### Extension tests

Affected files:

- `packages/extension/test/index.test.ts`
- `packages/extension/test/panel-cmd.test.ts`
- `packages/extension/test/crop.test.ts`
- `packages/extension/test/undo.test.ts`
- `packages/extension/test/ambient.test.ts`

- [ ] Update fakes to implement Pi's native read-only tree methods.
- [ ] Keep command-context denial coverage.
- [ ] Keep source-leaf revalidation coverage.
- [ ] Keep exact write-order coverage.
- [ ] Keep cancellation coverage for selection, draft, editor, validation, and navigation.
- [ ] Keep undo order coverage through the shared mutation model.
- [ ] Keep ambient guidance coverage independent from tree rendering.

### Real-session and real-TUI tests

Affected files:

- `packages/extension/test/golden/golden-scenarios.test.ts`
- Existing files under `packages/extension/test/golden/__goldens__/`
- `packages/extension/test/golden/tui-pty.test.ts`

Current problem: the resumed-session range scenario manually creates range entries instead of running the real `/compress` command.

- [ ] Replace the manually seeded range tail and marker with a real command-driven scenario when Pi exposes a testable native selector action.
- [ ] If RPC cannot host the selector, expose a standard test seam at the panel action boundary; do not add a production-only hidden command.
- [ ] Keep byte-for-byte source-entry assertions.
- [ ] Keep exact tail-before-marker assertions.
- [ ] Keep resumed-context assertions.
- [ ] Keep the no-`branch_summary` assertion.
- [ ] Reuse the existing PTY harness instead of adding a second custom Expect driver.
- [ ] Replace fixed sleeps with event-based waits where Pi's terminal events allow it.
- [ ] Keep a time-driven fallback only for terminal repaint events that cannot be observed reliably.
- [ ] Run real-TUI tests when `pi` and `expect` are available.

---

## 14. Update user and design documents after the refactor

Affected files:

- `README.md`
- `docs/USAGE.md`
- `docs/pi-context-tree-spec.md`
- `docs/pi-context-tree-architecture.md`
- `CHANGELOG.md`
- `USER_DRIVEN_RANGE_COMPACTION_IMPLEMENTATION_PLAN.md`

- [ ] State that `/compress` uses Pi's native session tree model.
- [ ] State whether the selector is directly exported by Pi or uses a temporary compatibility adapter.
- [ ] Document native connector, collapse, path, and leaf behavior.
- [ ] Keep all range keys accurate.
- [ ] Keep active-context and protected-group rules accurate.
- [ ] Keep review, append-only recovery, and `/undo` documentation accurate.
- [ ] Update architecture diagrams to show the native live-tree adapter and separate offline tree model.
- [ ] Remove claims that a custom flattened panel is equivalent to Pi's native tree.
- [ ] Update screenshots only after the native UI is final.
- [ ] Add the upstream Pi issue or pull request link to the architecture document.

---

## 15. Remove obsolete custom code

Complete this section only after replacement tests pass.

- [ ] Remove the custom fork-marker-only DFS tree renderer from `packages/core/src/vm/panel.ts`.
- [ ] Remove duplicate live tree reconstruction from `getEntries()`.
- [ ] Remove custom in-Pi Chalk theme paths that the Pi theme replaces.
- [ ] Remove local focus and scroll logic replaced by exported `pi-tui` components.
- [ ] Remove duplicate key decoding replaced by Pi keybindings.
- [ ] Remove duplicate message-label and role-switch code replaced by canonical utilities.
- [ ] Remove duplicate tool-call grouping code.
- [ ] Remove direct extension-level token arithmetic.
- [ ] Remove manual range schema field checks.
- [ ] Remove duplicate mutation marker interpretation.
- [ ] Remove the dynamic import if the corrected module boundary makes it unnecessary.
- [ ] Remove stale package forwarding or registry dependencies.
- [ ] Remove obsolete tests that only assert deleted custom behavior.

---

## 16. Verification gate

- [ ] `npm ci` succeeds from a clean checkout.
- [ ] `npm run check` passes.
- [ ] `npm test` passes.
- [ ] Existing real-Pi RPC tests pass.
- [ ] Existing real-TUI tests pass when `pi` and `expect` are available.
- [ ] `pi -e .` loads the source implementation.
- [ ] `pi install git:github.com/Distortedlogic/pi-context-tree` loads the same implementation.
- [ ] `/compress` opens a tree that matches double-`Esc` branch topology and visual rules.
- [ ] A short linear session works.
- [ ] A native branched session works without ctree fork markers.
- [ ] A session with nested branches works.
- [ ] A session with assistant tool calls works.
- [ ] A session after native Pi compaction works.
- [ ] Off-path branches stay visible and unavailable.
- [ ] Reverse endpoint selection normalizes correctly.
- [ ] A range that ends at the leaf works.
- [ ] A range with later continuation keeps the continuation in source order.
- [ ] Selection cancellation writes nothing.
- [ ] Draft failure writes nothing.
- [ ] Editor cancellation writes nothing.
- [ ] Source change during review writes nothing.
- [ ] Navigation cancellation writes nothing.
- [ ] Apply writes tail before marker.
- [ ] Apply writes no Pi branch summary.
- [ ] `/undo` restores the original source leaf.
- [ ] Resume loads the rebuilt branch.
- [ ] Original source lines remain byte-for-byte unchanged.
- [ ] `pitree ui` remains read-only.
- [ ] No generated or unrelated files remain in the worktree.

---

## Final acceptance criteria

- [ ] The in-Pi tree source is Pi's native session tree.
- [ ] Native branches display correctly even when no `ctree/fork` marker exists.
- [ ] The range selector uses public Pi and `pi-tui` APIs wherever available.
- [ ] Any unavoidable compatibility code is isolated, tested, and linked to an upstream removal path.
- [ ] No package install can silently load the old published extension.
- [ ] No selected tool-call group can be split.
- [ ] No operation mutates or deletes an existing JSONL line.
- [ ] The summary review gate is mandatory.
- [ ] `/undo` and resume remain reliable.
- [ ] User documentation matches the final native behavior.
