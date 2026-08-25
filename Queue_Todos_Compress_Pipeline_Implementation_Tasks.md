# Queue Todos Compress Pipeline Implementation Tasks

- Keep the Markdown plan as the only source of task content and checkbox state.
- Keep future batch text out of agent messages, tool results, prompt guidance, and custom context entries.
- Keep `/compress` available as the direct user command.
- Use the same context-tree compression service for user-command and pipeline-event calls.
- Use only `remark`, `remark-gfm`, `write-file-atomic`, the existing `typebox`, Node file APIs, and Pi extension APIs for this work.
- Do not add another parser, watcher, event bus, state framework, orchestration package, thin wrapper, or custom global registry.
- Update only existing test files in repositories that have tests.
- Do not add a test suite to `pi-true-queue`.

## 1. Prepare clean compatible fork baselines

- [ ] Complete and commit the work in `IDIOMATIC_NATIVE_PI_REFACTOR_TASK_LIST.md` before pipeline implementation starts.
- [ ] Start pipeline changes from clean `queue-todos-compress-loop` branches in `pi-context-tree`, `rpiv-mono`, and `true-queue`.
- [ ] Rebase each pipeline branch on its current fork base without mixing unrelated changes into pipeline commits.
- [ ] Align extension development and type dependencies with Pi `0.84.2`.
- [ ] Align event payload validation with `typebox` `1.3.7`.
- [ ] Add the public Pi session-action API required for an extension event handler to run `waitForIdle()` and `navigateTree()` safely.
- [ ] Define the public session-action API as one serialized operation that supplies a fresh session-bound command context to its callback.
- [ ] Reject the session action when the session changes before or during the callback.
- [ ] Do not expose private runner handlers or deep Pi imports through this API.
- [ ] Use the public session-action API for pipeline compression apply. Do not cache a command context or pass a command context through `pi.events`.
- [ ] Change the `pi-true-queue` shortcut from `ctrl+q` to `ctrl+shift+q`.
- [ ] Keep `ctrl+q` assigned to `pi-context-tree`.
- [ ] Load all three fork sources together and remove command, shortcut, and package-resolution collisions.

## 2. Define the fixed four-channel protocol

- [ ] Define the todo plan request channel as `rpiv-todo:plan:v1:request`.
- [ ] Define the todo plan result channel as `rpiv-todo:plan:v1:result`.
- [ ] Define the compression request channel as `pi-context-tree:compress:v1:request`.
- [ ] Define the compression result channel as `pi-context-tree:compress:v1:result`.
- [ ] Define TypeBox schemas for every request and result payload at each producer and consumer boundary.
- [ ] Include one `operationId` created with `crypto.randomUUID()` in every request and matching result.
- [ ] Include `runId`, `batchId`, and protocol version in every plan-run request and result.
- [ ] Use closed result states. Do not use free-form result status strings.
- [ ] Use `success` and `failed` for terminal plan request results.
- [ ] Use `accepted`, `applied`, `cancelled`, `failed`, and `undone` for compression results.
- [ ] Put error codes and user-safe messages in failed results.
- [ ] Use a fixed 5,000 ms timeout for plan requests and initial compression acceptance.
- [ ] Make context-tree emit `accepted` synchronously before draft and review work starts.
- [ ] Cancel the 5,000 ms compression timeout when `accepted` arrives.
- [ ] Do not apply a timeout while the user reviews the summary.
- [ ] Pause plan execution when plan results or compression acceptance do not arrive before the timeout.
- [ ] Reject duplicate completed operation IDs without repeating file, context, or queue mutations.
- [ ] Do not add probe, capability, lifecycle, queue-boundary, or progress channels.

## 3. Replace the agent todo tool with a file-backed plan model

- [ ] Add `remark`, `remark-gfm`, and `write-file-atomic` to `packages/rpiv-todo/package.json`.
- [ ] Remove `registerTodoTool(pi)` from `packages/rpiv-todo/index.ts`.
- [ ] Remove todo tool registration, schema, execution, response-envelope, and agent-rendering code from `packages/rpiv-todo/todo.ts` and `packages/rpiv-todo/tool/`.
- [ ] Remove todo `promptSnippet`, `promptGuidelines`, and guidance configuration.
- [ ] Remove replay of task snapshots from `todo` tool results.
- [ ] Keep the existing `/todos` user display and todo overlay.
- [ ] Replace agent task types with a file plan model that contains:
  - [ ] Canonical file path.
  - [ ] Level-one title.
  - [ ] Shared preamble Markdown.
  - [ ] Ordered level-two batches.
  - [ ] Batch identity derived from its one-based ordinal and normalized level-two heading.
  - [ ] Exact batch Markdown.
  - [ ] Checkbox source positions.
  - [ ] Completion state.
  - [ ] Structure digest.
- [ ] Keep in-progress display state outside the Markdown task content.
- [ ] Keep file parsing and state derivation pure of Pi UI code.
- [ ] Keep all task text and checkbox state in the Markdown file.
- [ ] Do not copy future batch bodies into session custom entries.

## 4. Implement canonical Markdown parsing and naming

- [ ] Parse plan files with `remark` and `remark-gfm`.
- [ ] Require exactly one level-one heading.
- [ ] Derive the canonical filename from the level-one heading by:
  - [ ] Trimming the heading text.
  - [ ] Replacing each whitespace run with `_`.
  - [ ] Removing characters other than letters, numbers, `_`, and `-`.
  - [ ] Collapsing repeated `_` characters.
  - [ ] Appending `.md`.
  - [ ] Placing the file in the current project directory.
- [ ] Reject a title that becomes empty after sanitization.
- [ ] Move a newly detected valid plan to its canonical filename when its current name differs.
- [ ] Stop and report a filename collision instead of overwriting another file.
- [ ] Treat each level-two heading and its content as one ordered batch.
- [ ] Require at least one GFM checkbox in every batch.
- [ ] Keep level-three and deeper headings inside their parent level-two batch.
- [ ] Treat `[x]` and `[X]` as checked.
- [ ] Mark a batch complete only when all checkboxes in that batch are checked.
- [ ] Keep a partially checked batch incomplete.
- [ ] Normalize a batch heading by trimming it, collapsing whitespace to one space, and lowercasing it.
- [ ] Set `batchId` to `<one-based-ordinal>:<first-12-hex-of-SHA-256(normalized-heading)>`.
- [ ] Reject duplicate normalized batch headings.
- [ ] Keep the Markdown before the first level-two heading as the shared preamble.
- [ ] Build the structure-digest source from the title, preamble, ordered normalized headings, and task text with every checkbox marker normalized to `[ ]`.
- [ ] Set the structure digest to the lowercase hexadecimal SHA-256 of that UTF-8 source.
- [ ] Exclude status-only checkbox changes from the structure digest.
- [ ] Use AST source positions to patch only checkbox marks.
- [ ] Write checkbox changes with `write-file-atomic`.
- [ ] Reload and validate the file after every write.
- [ ] Do not reformat the complete file for a checkbox-only change.

## 5. Implement automatic plan detection, binding, and user display

- [ ] Listen for successful agent `write` and `edit` tool results that target Markdown files in the current project directory.
- [ ] Parse a changed Markdown file only after the write or edit succeeds.
- [ ] Bind a valid incomplete plan automatically.
- [ ] Watch the current project directory with `node:fs.watch` after session start.
- [ ] Reload the bound plan after a completed external file change.
- [ ] On session start, scan only top-level project Markdown files whose basenames match their sanitized level-one headings.
- [ ] Bind the one valid incomplete canonical plan automatically.
- [ ] Exclude fully complete plans from automatic binding.
- [ ] Return a failed plan result when there is no incomplete canonical plan.
- [ ] Return a failed plan result when there is more than one incomplete canonical plan.
- [ ] Keep the current valid bound plan when an unrelated Markdown file changes.
- [ ] Update the todo overlay from the bound file and queue state.
- [ ] Show batch titles and states only in user UI.
- [ ] Do not include the plan path or future batch text in an agent message.
- [ ] Keep foreground and child-session overlay state isolated.
- [ ] Dispose the file watcher and foreground UI binding during session shutdown.

## 6. Implement the todo event provider and emergency dump

- [ ] Register one handler for `rpiv-todo:plan:v1:request`.
- [ ] Validate each request before reading or changing plan state.
- [ ] Implement a `snapshot` request that returns:
  - [ ] Plan title.
  - [ ] Structure digest.
  - [ ] Total, complete, and incomplete batch counts.
  - [ ] Current incomplete batch ID and ordinal.
  - [ ] No future batch body.
- [ ] Implement a `current_batch` request that returns only the requested current batch body and shared preamble when the expected digest matches.
- [ ] Implement a `complete_batch` request that checks every checkbox in the matching batch atomically.
- [ ] Implement a `reopen_batch` request that restores the matching batch checkboxes to incomplete after pipeline undo.
- [ ] Make `complete_batch` and `reopen_batch` idempotent by operation ID.
- [ ] Reject a batch mutation when the structure digest changed.
- [ ] Emit every response on `rpiv-todo:plan:v1:result`.
- [ ] Add `/todos dump` with no path argument.
- [ ] Make `/todos dump` emit a stop request through the existing plan result channel.
- [ ] Make `/todos dump` flush current checkbox state to the bound canonical file.
- [ ] Make `/todos dump` show the canonical file path in user UI.
- [ ] Make `/todos dump` send no plan content to the agent.
- [ ] Keep existing standalone `/todos` display behavior unchanged.

## 7. Extract the shared context-tree compression service

- [ ] Refactor `packages/extension/src/range-compress.ts` so one substantive service owns:
  - [ ] Idle wait.
  - [ ] Source-leaf validation.
  - [ ] Range-plan validation.
  - [ ] Summary drafting.
  - [ ] Summary review.
  - [ ] Post-review source validation.
  - [ ] Append-only navigation and apply.
  - [ ] Marker creation.
  - [ ] Ambient UI refresh.
  - [ ] Structured operation result.
- [ ] Keep range planning and request-specific input outside the shared apply service.
- [ ] Make the existing `/compress` handler call this service through its command context.
- [ ] Keep the normal interactive range selector for `/compress`.
- [ ] Keep `/compress` cancellation, review, apply, and `/undo` behavior compatible.
- [ ] Do not add a second compression implementation for pipeline events.
- [ ] Do not add a pass-through registration wrapper.

## 8. Add exact pipeline range planning

- [ ] Add a pure core planner that accepts:
  - [ ] Source leaf ID.
  - [ ] Entry ID before the queued task message.
  - [ ] Last settled entry ID.
- [ ] Require the pre-task anchor and settled end entry to be on the active path.
- [ ] Locate the queued user task message immediately after the pre-task anchor in active context.
- [ ] Keep the queued user task message outside the selected compression range.
- [ ] Start the selected range at the first assistant group after that task message.
- [ ] Include later user steering messages inside the continuous execution range.
- [ ] End the range at the complete atomic group that contains the settled end entry.
- [ ] Reject an incomplete assistant tool-call group.
- [ ] Reject a range that contains a protected decision or structural entry.
- [ ] Reuse `rangeCandidates()` and `planRange()` for grouping, ordering, serialization, source hash, and token totals.
- [ ] Preserve the preload context before the queued task message.
- [ ] Preserve the exact queued task message.
- [ ] Return one immutable range plan to the shared compression service.

## 9. Add event-driven pipeline compression and undo results

- [ ] Register one handler for `pi-context-tree:compress:v1:request`.
- [ ] Validate the request with TypeBox before accessing session state.
- [ ] Require `runId`, `batchId`, `operationId`, pre-task anchor ID, settled end ID, and expected queue phase.
- [ ] Reject a request whose expected phase is not `compressing`.
- [ ] Run the event path through the public Pi session-action API.
- [ ] Build the exact pipeline range plan inside the fresh session action.
- [ ] Show the selected entry count and token estimate before summary drafting.
- [ ] Draft the execution summary with the current model.
- [ ] Require the summary to preserve:
  - [ ] Files changed.
  - [ ] Important implementation decisions.
  - [ ] Exact commands and test results.
  - [ ] Failures and unresolved work.
  - [ ] Commit hashes.
- [ ] Open the summary editor and require a non-empty saved value.
- [ ] Return `cancelled` without writes when the user cancels or saves an empty value.
- [ ] Revalidate source leaf, selected IDs, source hash, run ID, and batch ID after review.
- [ ] Apply through `navigateTree(..., { summarize: false })`.
- [ ] Add run ID, batch ID, operation ID, and source hash to `ctree/range-tail` and `ctree/range-compact` v1 data.
- [ ] Emit `accepted` on `pi-context-tree:compress:v1:result` before draft and review work starts.
- [ ] Emit one matching terminal `applied`, `cancelled`, or `failed` result after the accepted request finishes.
- [ ] Derive prior applied operation results from workflow metadata on active or off-path context-tree markers.
- [ ] Return the prior result for a duplicate operation ID without another mutation.
- [ ] Extend `/undo` so a pipeline-owned range returns `undone` with the same run, batch, and operation identity.
- [ ] Keep original session entries byte-for-byte unchanged and recoverable.

## 10. Add the queue plan-run coordinator

- [ ] Add Pi `0.84.2`, TypeScript, and the required Pi peer packages as `pi-true-queue` development dependencies.
- [ ] Add a `tsconfig.json` that type-checks `index.ts` without emitting files.
- [ ] Add an npm `check` script that runs the TypeScript check.
- [ ] Use the Pi `0.84.2` `agent_settled` event in `pi-true-queue`.
- [ ] Add `/queue run` with no arguments as the only pipeline command.
- [ ] Keep existing standalone queue commands and `+task` behavior unchanged outside plan mode.
- [ ] Add plan-run phases:
  - [ ] `idle`
  - [ ] `running`
  - [ ] `compressing`
  - [ ] `paused`
  - [ ] `complete`
- [ ] Persist one versioned plan-run custom entry with:
  - [ ] Run ID.
  - [ ] Canonical plan path.
  - [ ] Structure digest.
  - [ ] Current batch ID and ordinal.
  - [ ] Pre-task anchor entry ID.
  - [ ] Last settled entry ID.
  - [ ] Current phase.
  - [ ] Last compression operation ID.
  - [ ] Pause reason.
- [ ] Do not persist future batch bodies.
- [ ] On `/queue run`, request a plan snapshot and capture its current structure digest.
- [ ] Request only the current incomplete batch body.
- [ ] Send the shared preamble and current batch as one queued user task.
- [ ] Do not send the plan path, future headings, future text, manifest, or remaining-task count to the agent.
- [ ] Record the current leaf as the pre-task anchor before `sendUserMessage()`.
- [ ] Set the phase to `running` before dispatch.
- [ ] Reject `enqueue_task` while a plan run is active.
- [ ] Keep agent enqueue behavior unchanged outside plan mode.

## 11. Implement the automatic batch completion loop

- [ ] On `agent_settled`, read the last settled entry ID for the active current batch.
- [ ] Change the phase from `running` to `compressing` before the compression request.
- [ ] Persist the frozen pre-task anchor and settled end entry.
- [ ] Emit one compression request with a new operation ID.
- [ ] Start the fixed result timeout.
- [ ] Block all next-batch dispatch while compression is active.
- [ ] On `cancelled`, keep the Markdown batch incomplete and return the queue to `running`.
- [ ] Let user steering continue the same batch after cancellation.
- [ ] Emit a new compression request on the next `agent_settled`.
- [ ] Make `/queue run` retry compression for the frozen range when no new steering turn is needed.
- [ ] On `failed`, set `paused`, persist the reason, and send no next batch.
- [ ] On `applied`, request `complete_batch` with the matching run, batch, digest, and operation identity.
- [ ] Do not repeat compression when `complete_batch` fails after an applied result.
- [ ] Make `/queue run` retry only the pending idempotent checkbox write after this failure.
- [ ] After checkbox success, request only the next incomplete batch.
- [ ] Set `complete` and clear the active task when no incomplete batch remains.
- [ ] Dispatch the next batch only after the prior compression and checkbox write both succeed.
- [ ] Handle `/todos dump` stop results by setting `paused` and sending no next batch.

## 12. Implement automatic restart and undo reconciliation

- [ ] On queue session start, replay the latest plan-run custom entry.
- [ ] Finish recovery immediately when the replayed phase is `complete`.
- [ ] Ask `rpiv-todo` to bind the canonical incomplete plan automatically for every non-complete phase.
- [ ] Recompute and compare the structure digest.
- [ ] Scan the active path for pipeline-owned `ctree/range-compact` markers.
- [ ] Match markers by run ID, batch ID, operation ID, and source hash.
- [ ] Continue the next safe internal transition automatically when file, queue, and context state agree.
- [ ] Pause with one user-safe reason when the three states do not agree.
- [ ] Do not add a manual recovery command.
- [ ] On an `undone` compression result, request `reopen_batch` for the matching batch.
- [ ] Clear next-batch state that moved off the active path.
- [ ] Make the reopened batch current in `running` state.
- [ ] Restart compression on its next `agent_settled`.
- [ ] When plan text or order changes during a run, pause before another dispatch.
- [ ] On the next `/queue run`, capture the new structure digest and resume from the first incomplete batch.
- [ ] Keep status-only checkbox changes valid across restart.

## 13. Update existing tests and validation paths

- [ ] Update existing `rpiv-todo` tests for removal of the agent tool and prompt guidance.
- [ ] Update existing `rpiv-todo` tests for canonical H1 filenames, empty sanitized names, collisions, and automatic rename.
- [ ] Update existing `rpiv-todo` tests for zero, one, and multiple incomplete project plans.
- [ ] Update existing `rpiv-todo` tests for automatic file reload, structure digest stability, targeted checkbox writes, and `/todos dump`.
- [ ] Update existing `rpiv-todo` tests for plan request/result validation, operation idempotency, and session isolation.
- [ ] Update existing `pi-context-tree` core tests for queue-anchor range planning, opening task retention, steering inclusion, and tool-call grouping.
- [ ] Update existing `pi-context-tree` extension tests for event requests, public session actions, review cancellation, stale source rejection, and exact marker metadata.
- [ ] Update existing `pi-context-tree` undo tests for `undone` pipeline results and source restoration.
- [ ] Update existing context-tree golden tests for byte-preserved source entries and tail-before-marker order.
- [ ] Update existing context-tree TUI tests for the event-started summary review.
- [ ] Type-check `pi-true-queue` against Pi `0.84.2`.
- [ ] Do not add test files to `pi-true-queue`.
- [ ] Run `npm test` and `npm run check` in `rpiv-mono`.
- [ ] Run `npm run check` and `npm test` in `pi-context-tree`.
- [ ] Run `npm run check` in `pi-true-queue`.
- [ ] Run a real Pi smoke session with all three fork sources loaded.

## 14. Update package and user documentation

- [ ] Update `rpiv-todo` README and configuration docs for the user-only file-backed plan.
- [ ] Remove the todo agent tool reference and tool schema claims.
- [ ] Document the H1 filename rule and one-incomplete-plan project rule.
- [ ] Document automatic detection, reload, binding, and checkbox updates.
- [ ] Document `/todos dump` as an emergency stop-and-inspect action with no arguments.
- [ ] Update `pi-context-tree` README, usage, architecture, and changelog for the shared compression service and event request path.
- [ ] Keep direct `/compress` user documentation unchanged except for shared-service internals.
- [ ] Document pipeline marker metadata and undo behavior.
- [ ] Update `pi-true-queue` README and command help for `/queue run`.
- [ ] Document that normal pipeline execution needs no plan path, status, pause, resume, abort, or recovery command.
- [ ] Update the sequential-isolation skill so the current pipeline batch is the agent's only task.
- [ ] Document `ctrl+shift+q` for queue UI and `ctrl+q` for context-tree UI.
- [ ] Keep standalone queue behavior documentation accurate.

## 15. Run the end-to-end pipeline acceptance flow

- [ ] Create a clean temporary project directory with no other Markdown task plans.
- [ ] Load all three fork source extensions in one Pi `0.84.2` session in that directory.
- [ ] Have the agent create a three-batch plan with one nested checklist directly in the project directory.
- [ ] Verify automatic canonical naming, binding, validation, and overlay display.
- [ ] Have the agent edit the same file and verify automatic reload.
- [ ] Start a clean execution session and complete one full source preload pass.
- [ ] Run `/queue run` with no arguments.
- [ ] Inspect the first provider request and verify that batch 2, batch 3, the plan path, and remaining-task data are absent.
- [ ] Execute batch 1 with assistant text, one tool call, and one user steering turn.
- [ ] Verify that `agent_settled` freezes the exact range and starts compression before next-batch dispatch.
- [ ] Cancel the first summary review and verify that batch 1 stays current and incomplete.
- [ ] Add one steering turn and verify that the next `agent_settled` starts compression again.
- [ ] Approve the summary and verify that:
  - [ ] The preload context stays active.
  - [ ] The exact batch 1 user task stays active.
  - [ ] Raw batch 1 assistant and tool entries move off the active path.
  - [ ] The reviewed summary enters active context.
  - [ ] Batch 1 checkboxes become checked in the same Markdown file.
  - [ ] Only batch 2 is sent next.
- [ ] Force a Markdown structure conflict and verify that the queue pauses before dispatch.
- [ ] Review the file, run `/queue run`, and verify safe resume from the first incomplete batch.
- [ ] Run `/todos dump` and verify that execution stops, the same canonical file is flushed, and no next batch is sent.
- [ ] Run `/queue run` and complete batch 2.
- [ ] Run `/undo` and verify automatic Markdown reopen and queue rollback for batch 2.
- [ ] Restart Pi during batch 3 and verify automatic file, queue, and marker reconciliation.
- [ ] Complete the final batch and verify that the plan is fully checked and the queue is empty.
- [ ] Verify that all original execution transcripts remain recoverable.
- [ ] Verify that direct `/compress`, standalone queue use, and the `/todos` display still work.
