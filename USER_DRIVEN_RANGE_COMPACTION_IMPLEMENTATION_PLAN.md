# User-Driven Session Range Compaction Implementation Plan

## Goal

Add a user-driven slash command and a full-screen session-tree TUI flow that lets the user select one continuous range of messages, generate a reviewed summary for that range, and replace the range in active context without deleting session history.

Working command name: `/compress [instructions]`.

## Required behavior

- The user starts every compression operation.
- `/compress` opens the session tree in range-selection mode.
- The user selects a start and an end in the current active context path.
- The TUI shows the complete selected range and its estimated token size.
- The extension sends only the selected range to the summary model.
- The user reviews or edits the summary before it is applied.
- The extension keeps entries after the selected range in the rebuilt context.
- The operation is append-only. Original entries stay on the previous branch.
- `/undo` restores the original source leaf.
- The operation does not use Pi's lossy summarize-on-leave flow.
- Existing `/branch`, `/merge`, `/crop`, `/panel`, and `pitree` behavior stays compatible.

## Ordered task list

### 1. Fix the command and selection contract

- [x] Confirm `/compress` as the final slash command name.
- [x] Define `/compress [instructions]` so optional text becomes extra summary instructions.
- [x] Define the TUI keys:
  - [x] `Space` on the first valid row sets the range start.
  - [x] `Space` on the second valid row sets the range end.
  - [x] If the second row is before the first row, normalize the range order.
  - [x] `x` clears the current range.
  - [x] `Enter` confirms a complete valid range.
  - [x] `Esc` returns to the normal tree view.
  - [x] `q` closes the panel without a change.
- [x] Add `r` in the normal `/panel` tree view to enter range-selection mode.
- [x] Restrict selectable entries to the active context path returned by `contextSlice`.
- [x] Show off-path, structural, and protected entries, but do not let the user select them.
- [x] Protect decision records from range compression.
- [x] Protect an incomplete current user turn.
- [x] Define safe tool-call grouping so a range cannot leave an assistant tool call without its tool result.
- [x] Permit one or more safe message groups in a range.

### 2. Add the persisted range-compaction schema

File: `packages/core/src/types.ts`

- [x] Add `CTREE_RANGE_COMPACT` for the append-only operation marker.
- [x] Add `CTREE_RANGE_TAIL` for the visible summary and rebuilt continuation message.
- [x] Add `CtreeRangeCompactData` with schema version `v: 1`.
- [x] Store:
  - [x] `sourceLeafId`.
  - [x] `anchorId`.
  - [x] `startEntryId`.
  - [x] `endEntryId`.
  - [x] Ordered selected entry IDs.
  - [x] Selected token estimate.
  - [x] Generated summary token estimate.
  - [x] Estimated reclaimed tokens.
  - [x] Summary model reference.
  - [x] SHA-256 prefix for the selected serialized source.
- [x] Add type guards for the new marker and message details.
- [x] Keep the format permissive for unknown fields and later schema versions.

### 3. Implement pure range planning

New file: `packages/core/src/range-compress.ts`

- [x] Add a `RangeCandidate` type for selectable tree entries.
- [x] Add a `RangePlan` type for the complete operation.
- [x] Build candidates from the current `contextSlice`, not from inactive history.
- [x] Record path order, token estimate, row label, and protection state for each candidate.
- [x] Group assistant tool-call messages with their related tool-result entries.
- [x] Reject a range endpoint that would split a required tool-call group.
- [x] Reject IDs that are missing, off-path, structural-only, or protected.
- [x] Normalize reversed start and end IDs.
- [x] Find the anchor immediately before the first selected safe group.
- [x] Collect all selected entries in source order.
- [x] Collect all entries after the selected range through `sourceLeafId`.
- [x] Serialize the selected range for the summary request.
- [x] Compute selected tokens and the source hash.
- [x] Render the rebuilt custom message as:
  1. A short range-compaction header.
  2. The approved summary.
  3. The unchanged serialized continuation after the range, when present.
- [x] Do not copy selected source text into the rebuilt message.
- [x] Preserve the continuation in source order.
- [x] Support a range that ends at the current leaf.
- [x] Export the planner from `packages/core/src/index.ts`.

### 4. Add range state to the panel view-model

File: `packages/core/src/vm/panel.ts`

- [x] Add `"range"` to `PanelView`.
- [x] Add a `range-apply` action that carries a validated `RangePlan`.
- [x] Extend `PanelRow` with:
  - [x] Range eligibility.
  - [x] Start marker.
  - [x] End marker.
  - [x] Inside-range marker.
  - [x] Protection reason.
- [x] Add range start and end state to `PanelVm`.
- [x] Render the full session tree in range mode.
- [x] Mark only entries in the active context path as selectable.
- [x] Highlight every entry in the normalized selected range.
- [x] Show the selected token total in the section title.
- [x] Show a clear notice when only one endpoint is selected.
- [x] Handle `Space`, `x`, `Enter`, `Esc`, and `r`.
- [x] Build the final plan only through the pure core planner.
- [x] Return a clear notice for invalid endpoints instead of throwing in the TUI.
- [x] Add tree-row rendering for `CTREE_RANGE_TAIL` and `CTREE_RANGE_COMPACT`.
- [x] Keep range mutation unavailable when `PanelInput.readOnly` is true.

### 5. Render range selection in the TUI

Files:

- `packages/tui/src/panel.ts`
- `packages/tui/src/theme.ts`

- [x] Render a distinct start marker.
- [x] Render a distinct end marker.
- [x] Render all rows inside the selected range with one consistent style.
- [x] Render protected rows as unavailable and include the protection reason.
- [x] Keep token values and warnings visible during selection.
- [x] Add range keys to the footer help.
- [x] Add ANSI-safe theme functions for start, end, and selected range states.
- [x] Keep every rendered line inside the terminal width.
- [x] Keep the existing fixed panel height and scrolling behavior.

### 6. Add the range-summary prompt

File: `packages/extension/src/draft.ts`

- [x] Add a range-compression system prompt.
- [x] Require the summary to preserve:
  - [x] User intent.
  - [x] Decisions and rejected approaches.
  - [x] File paths and identifiers.
  - [x] Commands and important output.
  - [x] Errors and failure causes.
  - [x] External side effects.
  - [x] Validation state.
  - [x] Unfinished work and the next action.
- [x] Require summary text only, with no preamble.
- [x] Add a prompt builder that includes the selected serialized source.
- [x] Add optional instructions from the slash command.
- [x] Use the current model through the existing `DraftFn` dependency.
- [x] Do not truncate individual selected messages without an explicit size error.
- [x] Detect when the selected source cannot fit in the model context with output reserve.
- [x] Return an actionable error when the selected source is too large.

### 7. Implement the `/compress` command and apply flow

New file: `packages/extension/src/range-compress.ts`

- [x] Parse optional summary instructions from command arguments.
- [x] Wait for the agent to become idle.
- [x] Derive the current session state.
- [x] Reject an empty session.
- [x] Open `/panel` in range-selection mode.
- [x] Stop without a change when the panel closes or selection is cancelled.
- [x] Recheck `sourceLeafId` after the panel closes.
- [x] Draft a summary from only the selected serialized range.
- [x] Show draft progress through `ctx.ui.notify`.
- [x] Open the summary in `ctx.ui.editor` for required user review.
- [x] Treat an empty or cancelled editor result as a full cancellation.
- [x] Recheck the source leaf and selected IDs after summary review.
- [x] Recompute the plan if validation requires fresh session data.
- [x] Render the rebuilt summary and continuation message.
- [x] Navigate to `anchorId` with `{ summarize: false }`.
- [x] Stop if navigation is cancelled.
- [x] Append `CTREE_RANGE_TAIL` with `triggerTurn: false`.
- [x] Append `CTREE_RANGE_COMPACT` after the visible custom message.
- [x] Store the original `sourceLeafId` for recovery and undo.
- [x] Refresh the ambient context display.
- [x] Notify the user of the selected, summary, and reclaimed token estimates.
- [x] Keep all original JSONL entries unchanged.
- [x] Register the command through a `registerRangeCompress` function.

### 8. Connect range actions to the shared panel

File: `packages/extension/src/panel-cmd.ts`

- [x] Accept `initialView: "range"` through the existing panel options.
- [x] Handle the new `range-apply` panel action.
- [x] Use a dynamic import for the range apply function to prevent an import cycle.
- [x] Apply default summary instructions when range mode starts from `/panel` instead of `/compress`.
- [x] Reopen the panel with fresh state after a completed action.
- [x] Keep `Ctrl+Q` view-only when Pi does not provide command context.
- [x] Keep the standalone `pitree` host read-only.

### 9. Register the command

File: `packages/extension/src/index.ts`

- [x] Import and register `registerRangeCompress`.
- [x] Update the extension command comment.
- [x] Keep registration order deterministic.
- [x] Do not add a new package dependency.

### 10. Add append-only undo support

File: `packages/extension/src/undo.ts`

- [x] Detect the latest active `CTREE_RANGE_COMPACT` marker.
- [x] Read its `sourceLeafId`.
- [x] Describe the action as restoring the compressed message range.
- [x] Navigate to the original source leaf with `summarize: false` after confirmation.
- [x] Keep the summary and marker in off-path history.
- [x] Preserve the current last-active-mutation ordering with branch, merge, and crop operations.

### 11. Update context guidance and accounting

Files:

- `packages/extension/src/ambient.ts`
- `packages/core/src/consumers.ts`

- [x] Add `/compress` to the red-band guidance.
- [x] Add `/compress` to the built-in `/compact` warning.
- [x] Classify range summaries separately from generic extension messages.
- [x] Keep summary and continuation tokens in total context accounting.
- [x] Keep the context gauge behavior unchanged.

### 12. Add core coverage in existing test files

Do not add a new test file.

File: `packages/core/test/crop.test.ts`

- [x] Test valid range planning.
- [x] Test reversed endpoint normalization.
- [x] Test a range that reaches the leaf.
- [x] Test a range with a continuation.
- [x] Test off-path and missing IDs.
- [x] Test protected decision records.
- [x] Test incomplete current user turns.
- [x] Test safe tool-call grouping.
- [x] Test selected source hash stability.
- [x] Test that rebuilt content contains the summary and continuation but not selected source text.

File: `packages/core/test/panel-vm.test.ts`

- [x] Test entry into range mode from the tree.
- [x] Test first and second endpoint selection.
- [x] Test complete range highlighting.
- [x] Test clear and cancellation keys.
- [x] Test invalid endpoint notices.
- [x] Test selected token totals.
- [x] Test the emitted `range-apply` action.
- [x] Test read-only denial.

### 13. Add TUI coverage in the existing suite

File: `packages/tui/test/panel.test.ts`

- [x] Test start, end, and inside-range rendering.
- [x] Test protected-row rendering.
- [x] Test range footer help.
- [x] Test narrow terminal widths.
- [x] Test scrolling with a range that crosses the visible window.

### 14. Add extension coverage in existing test files

File: `packages/extension/test/index.test.ts`

- [x] Test `/compress` registration.

File: `packages/extension/test/panel-cmd.test.ts`

- [x] Test range action dispatch.
- [x] Test command-context requirements.
- [x] Test source-leaf revalidation.

File: `packages/extension/test/crop.test.ts`

- [x] Test range apply ordering: navigate, summary message, marker.
- [x] Test no writes after cancelled navigation.
- [x] Test no writes after changed leaf.
- [x] Test continuation preservation.
- [x] Test summary-only output when the range reaches the leaf.

File: `packages/extension/test/undo.test.ts`

- [x] Test restoration of `sourceLeafId`.
- [x] Test ordering against later crop, merge, and branch mutations.

File: `packages/extension/test/ambient.test.ts`

- [x] Test updated `/compress` guidance.

### 15. Add real-session and real-TUI coverage

Existing files only:

- `packages/extension/test/golden/golden-scenarios.test.ts`
- Existing files under `packages/extension/test/golden/__goldens__/`
- `packages/extension/test/golden/tui-pty.test.ts`

- [x] Add a golden scenario with messages before, inside, and after the selected range.
- [x] Confirm that original entries stay byte-for-byte unchanged.
- [x] Confirm the exact append order of the range tail and marker.
- [x] Confirm that a resumed session loads the rebuilt branch.
- [x] Add a real-TUI flow for `/compress`.
- [x] Select start and end with keyboard input.
- [x] Confirm that the range screen renders.
- [x] Confirm that apply returns to a valid Pi session without a crash.
- [x] Confirm that Pi's summarize-on-leave prompt does not appear.

### 16. Update user and design documentation

Files:

- `README.md`
- `docs/USAGE.md`
- `docs/pi-context-tree-spec.md`
- `docs/pi-context-tree-architecture.md`
- `CHANGELOG.md`

- [ ] Document `/compress [instructions]`.
- [ ] Document all range-selection keys.
- [ ] Explain that only the active context path is selectable.
- [ ] Explain protected entries and safe tool-call groups.
- [ ] Explain the required summary review gate.
- [ ] Explain append-only recovery and `/undo`.
- [ ] Explain the difference between `/compress`, `/crop`, `/merge`, and Pi's `/compact`.
- [ ] Add the new custom entry schemas and write order to the architecture document.
- [ ] Update panel screenshots or demo assets only after the final UI is stable.

### 17. Run all verification

- [ ] Run `npm run check`.
- [ ] Run `npm test`.
- [ ] Run the existing real-TUI tests when `pi` and `expect` are available.
- [ ] Load the extension from the source tree with `pi -e .`.
- [ ] Test `/compress` on a short linear session.
- [ ] Test `/compress` on a session with tool calls.
- [ ] Test `/compress` on a branched session.
- [ ] Test a range with later messages that must remain in context.
- [ ] Test cancellation at range selection, summary drafting failure, editor review, and navigation.
- [ ] Test `/undo` after range compression.
- [ ] Test resume after range compression.
- [ ] Confirm that the worktree contains no generated or unrelated files.

### 18. Prepare the upstream change

- [ ] Review the final diff for unrelated changes.
- [ ] Commit the implementation with a small accurate message.
- [ ] Push `feat/user-driven-range-compaction` to `origin`.
- [ ] Open a pull request from `Distortedlogic:feat/user-driven-range-compaction` to `navbytes:main`.
- [ ] Include behavior, safety rules, append-only design, and verification results in the pull request.

### 19. Install and smoke-test the fork

- [ ] Remove the old installed package only when the implementation is ready.
- [ ] Install the feature branch:

  ```sh
  pi install git:github.com/Distortedlogic/pi-context-tree@feat/user-driven-range-compaction
  ```

- [ ] Restart Pi.
- [ ] Confirm that `/compress`, `/panel`, `/crop`, `/merge`, and `/undo` register once.
- [ ] Run one end-to-end range compression.
- [ ] Run `/undo` and confirm that the original source branch returns.

## Completion criteria

The feature is complete only when all of these statements are true:

- [ ] A user can start range compression with a slash command.
- [ ] The session-tree TUI selects a visible start and end.
- [ ] The planner rejects unsafe or off-path ranges.
- [ ] The model receives only the selected range.
- [ ] The user approves the summary before any session write.
- [ ] Later context remains available after compression.
- [ ] Original history remains recoverable.
- [ ] `/undo` restores the original source leaf.
- [ ] Existing commands and read-only `pitree` behavior still work.
- [ ] Type checks, lint checks, unit tests, golden tests, and real-TUI tests pass.
