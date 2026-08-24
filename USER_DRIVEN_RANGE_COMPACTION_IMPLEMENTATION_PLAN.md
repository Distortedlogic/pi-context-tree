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

- [ ] Confirm `/compress` as the final slash command name.
- [ ] Define `/compress [instructions]` so optional text becomes extra summary instructions.
- [ ] Define the TUI keys:
  - [ ] `Space` on the first valid row sets the range start.
  - [ ] `Space` on the second valid row sets the range end.
  - [ ] If the second row is before the first row, normalize the range order.
  - [ ] `x` clears the current range.
  - [ ] `Enter` confirms a complete valid range.
  - [ ] `Esc` returns to the normal tree view.
  - [ ] `q` closes the panel without a change.
- [ ] Add `r` in the normal `/panel` tree view to enter range-selection mode.
- [ ] Restrict selectable entries to the active context path returned by `contextSlice`.
- [ ] Show off-path, structural, and protected entries, but do not let the user select them.
- [ ] Protect decision records from range compression.
- [ ] Protect an incomplete current user turn.
- [ ] Define safe tool-call grouping so a range cannot leave an assistant tool call without its tool result.
- [ ] Permit one or more safe message groups in a range.

### 2. Add the persisted range-compaction schema

File: `packages/core/src/types.ts`

- [ ] Add `CTREE_RANGE_COMPACT` for the append-only operation marker.
- [ ] Add `CTREE_RANGE_TAIL` for the visible summary and rebuilt continuation message.
- [ ] Add `CtreeRangeCompactData` with schema version `v: 1`.
- [ ] Store:
  - [ ] `sourceLeafId`.
  - [ ] `anchorId`.
  - [ ] `startEntryId`.
  - [ ] `endEntryId`.
  - [ ] Ordered selected entry IDs.
  - [ ] Selected token estimate.
  - [ ] Generated summary token estimate.
  - [ ] Estimated reclaimed tokens.
  - [ ] Summary model reference.
  - [ ] SHA-256 prefix for the selected serialized source.
- [ ] Add type guards for the new marker and message details.
- [ ] Keep the format permissive for unknown fields and later schema versions.

### 3. Implement pure range planning

New file: `packages/core/src/range-compress.ts`

- [ ] Add a `RangeCandidate` type for selectable tree entries.
- [ ] Add a `RangePlan` type for the complete operation.
- [ ] Build candidates from the current `contextSlice`, not from inactive history.
- [ ] Record path order, token estimate, row label, and protection state for each candidate.
- [ ] Group assistant tool-call messages with their related tool-result entries.
- [ ] Reject a range endpoint that would split a required tool-call group.
- [ ] Reject IDs that are missing, off-path, structural-only, or protected.
- [ ] Normalize reversed start and end IDs.
- [ ] Find the anchor immediately before the first selected safe group.
- [ ] Collect all selected entries in source order.
- [ ] Collect all entries after the selected range through `sourceLeafId`.
- [ ] Serialize the selected range for the summary request.
- [ ] Compute selected tokens and the source hash.
- [ ] Render the rebuilt custom message as:
  1. A short range-compaction header.
  2. The approved summary.
  3. The unchanged serialized continuation after the range, when present.
- [ ] Do not copy selected source text into the rebuilt message.
- [ ] Preserve the continuation in source order.
- [ ] Support a range that ends at the current leaf.
- [ ] Export the planner from `packages/core/src/index.ts`.

### 4. Add range state to the panel view-model

File: `packages/core/src/vm/panel.ts`

- [ ] Add `"range"` to `PanelView`.
- [ ] Add a `range-apply` action that carries a validated `RangePlan`.
- [ ] Extend `PanelRow` with:
  - [ ] Range eligibility.
  - [ ] Start marker.
  - [ ] End marker.
  - [ ] Inside-range marker.
  - [ ] Protection reason.
- [ ] Add range start and end state to `PanelVm`.
- [ ] Render the full session tree in range mode.
- [ ] Mark only entries in the active context path as selectable.
- [ ] Highlight every entry in the normalized selected range.
- [ ] Show the selected token total in the section title.
- [ ] Show a clear notice when only one endpoint is selected.
- [ ] Handle `Space`, `x`, `Enter`, `Esc`, and `r`.
- [ ] Build the final plan only through the pure core planner.
- [ ] Return a clear notice for invalid endpoints instead of throwing in the TUI.
- [ ] Add tree-row rendering for `CTREE_RANGE_TAIL` and `CTREE_RANGE_COMPACT`.
- [ ] Keep range mutation unavailable when `PanelInput.readOnly` is true.

### 5. Render range selection in the TUI

Files:

- `packages/tui/src/panel.ts`
- `packages/tui/src/theme.ts`

- [ ] Render a distinct start marker.
- [ ] Render a distinct end marker.
- [ ] Render all rows inside the selected range with one consistent style.
- [ ] Render protected rows as unavailable and include the protection reason.
- [ ] Keep token values and warnings visible during selection.
- [ ] Add range keys to the footer help.
- [ ] Add ANSI-safe theme functions for start, end, and selected range states.
- [ ] Keep every rendered line inside the terminal width.
- [ ] Keep the existing fixed panel height and scrolling behavior.

### 6. Add the range-summary prompt

File: `packages/extension/src/draft.ts`

- [ ] Add a range-compression system prompt.
- [ ] Require the summary to preserve:
  - [ ] User intent.
  - [ ] Decisions and rejected approaches.
  - [ ] File paths and identifiers.
  - [ ] Commands and important output.
  - [ ] Errors and failure causes.
  - [ ] External side effects.
  - [ ] Validation state.
  - [ ] Unfinished work and the next action.
- [ ] Require summary text only, with no preamble.
- [ ] Add a prompt builder that includes the selected serialized source.
- [ ] Add optional instructions from the slash command.
- [ ] Use the current model through the existing `DraftFn` dependency.
- [ ] Do not truncate individual selected messages without an explicit size error.
- [ ] Detect when the selected source cannot fit in the model context with output reserve.
- [ ] Return an actionable error when the selected source is too large.

### 7. Implement the `/compress` command and apply flow

New file: `packages/extension/src/range-compress.ts`

- [ ] Parse optional summary instructions from command arguments.
- [ ] Wait for the agent to become idle.
- [ ] Derive the current session state.
- [ ] Reject an empty session.
- [ ] Open `/panel` in range-selection mode.
- [ ] Stop without a change when the panel closes or selection is cancelled.
- [ ] Recheck `sourceLeafId` after the panel closes.
- [ ] Draft a summary from only the selected serialized range.
- [ ] Show draft progress through `ctx.ui.notify`.
- [ ] Open the summary in `ctx.ui.editor` for required user review.
- [ ] Treat an empty or cancelled editor result as a full cancellation.
- [ ] Recheck the source leaf and selected IDs after summary review.
- [ ] Recompute the plan if validation requires fresh session data.
- [ ] Render the rebuilt summary and continuation message.
- [ ] Navigate to `anchorId` with `{ summarize: false }`.
- [ ] Stop if navigation is cancelled.
- [ ] Append `CTREE_RANGE_TAIL` with `triggerTurn: false`.
- [ ] Append `CTREE_RANGE_COMPACT` after the visible custom message.
- [ ] Store the original `sourceLeafId` for recovery and undo.
- [ ] Refresh the ambient context display.
- [ ] Notify the user of the selected, summary, and reclaimed token estimates.
- [ ] Keep all original JSONL entries unchanged.
- [ ] Register the command through a `registerRangeCompress` function.

### 8. Connect range actions to the shared panel

File: `packages/extension/src/panel-cmd.ts`

- [ ] Accept `initialView: "range"` through the existing panel options.
- [ ] Handle the new `range-apply` panel action.
- [ ] Use a dynamic import for the range apply function to prevent an import cycle.
- [ ] Apply default summary instructions when range mode starts from `/panel` instead of `/compress`.
- [ ] Reopen the panel with fresh state after a completed action.
- [ ] Keep `Ctrl+Q` view-only when Pi does not provide command context.
- [ ] Keep the standalone `pitree` host read-only.

### 9. Register the command

File: `packages/extension/src/index.ts`

- [ ] Import and register `registerRangeCompress`.
- [ ] Update the extension command comment.
- [ ] Keep registration order deterministic.
- [ ] Do not add a new package dependency.

### 10. Add append-only undo support

File: `packages/extension/src/undo.ts`

- [ ] Detect the latest active `CTREE_RANGE_COMPACT` marker.
- [ ] Read its `sourceLeafId`.
- [ ] Describe the action as restoring the compressed message range.
- [ ] Navigate to the original source leaf with `summarize: false` after confirmation.
- [ ] Keep the summary and marker in off-path history.
- [ ] Preserve the current last-active-mutation ordering with branch, merge, and crop operations.

### 11. Update context guidance and accounting

Files:

- `packages/extension/src/ambient.ts`
- `packages/core/src/consumers.ts`

- [ ] Add `/compress` to the red-band guidance.
- [ ] Add `/compress` to the built-in `/compact` warning.
- [ ] Classify range summaries separately from generic extension messages.
- [ ] Keep summary and continuation tokens in total context accounting.
- [ ] Keep the context gauge behavior unchanged.

### 12. Add core coverage in existing test files

Do not add a new test file.

File: `packages/core/test/crop.test.ts`

- [ ] Test valid range planning.
- [ ] Test reversed endpoint normalization.
- [ ] Test a range that reaches the leaf.
- [ ] Test a range with a continuation.
- [ ] Test off-path and missing IDs.
- [ ] Test protected decision records.
- [ ] Test incomplete current user turns.
- [ ] Test safe tool-call grouping.
- [ ] Test selected source hash stability.
- [ ] Test that rebuilt content contains the summary and continuation but not selected source text.

File: `packages/core/test/panel-vm.test.ts`

- [ ] Test entry into range mode from the tree.
- [ ] Test first and second endpoint selection.
- [ ] Test complete range highlighting.
- [ ] Test clear and cancellation keys.
- [ ] Test invalid endpoint notices.
- [ ] Test selected token totals.
- [ ] Test the emitted `range-apply` action.
- [ ] Test read-only denial.

### 13. Add TUI coverage in the existing suite

File: `packages/tui/test/panel.test.ts`

- [ ] Test start, end, and inside-range rendering.
- [ ] Test protected-row rendering.
- [ ] Test range footer help.
- [ ] Test narrow terminal widths.
- [ ] Test scrolling with a range that crosses the visible window.

### 14. Add extension coverage in existing test files

File: `packages/extension/test/index.test.ts`

- [ ] Test `/compress` registration.

File: `packages/extension/test/panel-cmd.test.ts`

- [ ] Test range action dispatch.
- [ ] Test command-context requirements.
- [ ] Test source-leaf revalidation.

File: `packages/extension/test/crop.test.ts`

- [ ] Test range apply ordering: navigate, summary message, marker.
- [ ] Test no writes after cancelled navigation.
- [ ] Test no writes after changed leaf.
- [ ] Test continuation preservation.
- [ ] Test summary-only output when the range reaches the leaf.

File: `packages/extension/test/undo.test.ts`

- [ ] Test restoration of `sourceLeafId`.
- [ ] Test ordering against later crop, merge, and branch mutations.

File: `packages/extension/test/ambient.test.ts`

- [ ] Test updated `/compress` guidance.

### 15. Add real-session and real-TUI coverage

Existing files only:

- `packages/extension/test/golden/golden-scenarios.test.ts`
- Existing files under `packages/extension/test/golden/__goldens__/`
- `packages/extension/test/golden/tui-pty.test.ts`

- [ ] Add a golden scenario with messages before, inside, and after the selected range.
- [ ] Confirm that original entries stay byte-for-byte unchanged.
- [ ] Confirm the exact append order of the range tail and marker.
- [ ] Confirm that a resumed session loads the rebuilt branch.
- [ ] Add a real-TUI flow for `/compress`.
- [ ] Select start and end with keyboard input.
- [ ] Confirm that the range screen renders.
- [ ] Confirm that apply returns to a valid Pi session without a crash.
- [ ] Confirm that Pi's summarize-on-leave prompt does not appear.

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
