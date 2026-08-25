I will do what the user instructed without reinterpreting the users words, without overriding the users instructions, and without insubordinating, the way the user wants, not the way I want.

**Scope:** Change `packages/extension/src/range-compress.ts` and only the affected existing tests. Do not change core formats, prompts, panel code, or TUI packages.

1. [ ] **Add a blocking compression runner**
   - Start it after the existing range confirmation.
   - Open `ctx.ui.custom` before starting `draftRangeSummary`.
   - Start the model request inside the `ui.custom` callback.
   - Use Pi’s existing loader or spinner component.
   - Keep the view open through generation, validation, navigation, and writes.
   - Return success or failure through `done(...)`.
   - Handle promise rejection before closing the view.

2. [ ] **Give the progress view exclusive input**
   - Let `ui.custom` replace the normal editor.
   - Do not forward keys to the editor.
   - Do not let text keys, Enter, Escape, or `q` dismiss the view.
   - Keep Pi’s global interrupt behavior unchanged.
   - Use the current notification flow only when no interactive TUI exists.

3. [ ] **Show useful progress**
   - Initially show the summary model, selected entry count, and estimated source tokens.
   - Show `Drafting summary` during `draftRangeSummary`.
   - Show `Checking selected range` during fresh-state validation.
   - Show `Applying compression` during navigation and writes.
   - Stop the loader and close the view on every exit path.

4. [ ] **Remove summary review and approval**
   - Delete the `ctx.ui.editor(...)` call.
   - Delete its empty-result and cancellation branches.
   - Trim the generated draft.
   - Treat an empty generated summary as a draft failure.
   - Pass the generated summary directly to `buildRangeCompactData` and `renderRangeTail`.
   - Do not add a second confirmation.

5. [ ] **Keep the safe operation order**
   - Before opening progress, check the source leaf and summary model.
   - Inside the blocking operation:
     1. Generate the summary.
     2. Call `waitForIdle`.
     3. Derive fresh session state.
     4. Check the source leaf.
     5. Re-run `planRange`.
     6. Compare selected entry IDs and `sourceSha8`.
     7. Build the marker details and range tail.
     8. Check the source leaf again.
     9. Navigate to `plan.anchorId` with `{ summarize: false }`.
     10. Send the range-tail message.
     11. Append the range-compact marker.
     12. Refresh ambient UI.
   - Preserve the current no-write behavior for every failure before step 10.

6. [ ] **Update the initial confirmation**
   - Keep the existing range confirmation.
   - State that the generated summary will be applied without review.
   - State that terminal input will pause until compression finishes.

7. [ ] **Make only behavior-level test changes**
   - Update the existing success case so the generated summary becomes the compressed context without an editor response.
   - Verify that compression stays busy while the model request is pending.
   - Verify that a generation error or stale range produces no session writes.
   - Keep existing safety and append-only tests unchanged when their behavior did not change.
   - Do not assert helper names, API call counts, exact progress text, exact phase order, loader internals, or removed editor calls.

8. [ ] **Validate**
   - Run the existing extension tests.
   - Run the existing type check and lint commands.
   - Confirm manually that typed input does not reach the normal editor during summary generation.
