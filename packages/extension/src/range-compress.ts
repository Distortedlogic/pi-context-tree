import { TreeSelectorComponent } from "@earendil-works/pi-coding-agent";
import {
	CTREE_RANGE_COMPACT,
	CTREE_RANGE_TAIL,
	type CtreeRangeCompactData,
	type RangePlan,
	estimateTextTokens,
	fmtTokens,
	planRange,
	rangeCandidates,
	renderRangeTail,
	resolveRangeEndpoint,
	serializeEntry,
} from "@pi-context-tree/core";
import { type CmdCtxLike, type Deps, type PiLike, leafIdOf, modelKey } from "./adapter.ts";
import { refreshAmbient } from "./ambient.ts";
import { draftRangeSummary } from "./draft.ts";
import { deriveState } from "./state.ts";

type RangePhase = "start" | "end";

export async function selectNativeEntry(
	ctx: CmdCtxLike,
	phase: RangePhase,
	initialSelectedId: string,
): Promise<string | undefined> {
	ctx.ui.notify(
		phase === "start" ? "Select the first entry of the range" : "Select the last entry of the range",
		"info",
	);
	if (!ctx.ui.custom) {
		ctx.ui.notify("The native tree selector is not available in this mode.", "warning");
		return undefined;
	}
	return ctx.ui.custom<string | undefined>(
		(
			tui: { terminal: { rows: number } },
			_theme: unknown,
			_keybindings: unknown,
			done: (entryId: string | undefined) => void,
		) =>
			new TreeSelectorComponent(
				ctx.sessionManager.getTree(),
				ctx.sessionManager.getLeafId(),
				tui.terminal.rows,
				(entryId) => done(entryId),
				() => done(undefined),
				undefined,
				initialSelectedId,
				"default",
			),
	);
}

export function buildRangeCompactData(
	plan: RangePlan,
	approvedSummary: string,
	summaryModel: string,
): CtreeRangeCompactData {
	const summaryEstTokens = estimateTextTokens(approvedSummary);
	return {
		v: 1,
		sourceLeafId: plan.sourceLeafId,
		anchorId: plan.anchorId,
		startEntryId: plan.startEntryId,
		endEntryId: plan.endEntryId,
		selectedEntryIds: [...plan.selectedEntryIds],
		selectedEstTokens: plan.selectedEstTokens,
		summaryEstTokens,
		reclaimedEstTokens: plan.selectedEstTokens - summaryEstTokens,
		summaryModel,
		sourceSha8: plan.sourceSha8,
	};
}

/** Apply a reviewed range plan. The session is revalidated before every write. */
export async function applyRangeCompressionPlan(
	pi: PiLike,
	ctx: CmdCtxLike,
	initialPlan: RangePlan,
	instructions: string | undefined,
	deps: Deps,
): Promise<void> {
	if (leafIdOf(ctx) !== initialPlan.sourceLeafId) {
		ctx.ui.notify("session changed while the range selector was open — re-run /compress (nothing written)", "warning");
		return;
	}

	const summaryModel = modelKey(ctx.model);
	if (!summaryModel) {
		ctx.ui.notify("no current model is available for the range summary — nothing written", "error");
		return;
	}
	ctx.ui.notify(`drafting range summary with ${summaryModel}…`, "info");
	let draft: string;
	try {
		draft = await draftRangeSummary(deps.draft, ctx, initialPlan.selectedSerialized, instructions);
	} catch (error) {
		ctx.ui.notify(`range summary failed: ${(error as Error).message} (nothing written)`, "error");
		return;
	}

	const reviewed = await ctx.ui.editor(
		`Range summary — review/edit; closing without saving cancels (${initialPlan.selectedEntryIds.length} entries)`,
		draft,
	);
	if (reviewed === undefined || reviewed.trim() === "") {
		ctx.ui.notify("range compression cancelled — no summary confirmed, nothing written", "info");
		return;
	}

	await ctx.waitForIdle();
	const freshState = deriveState(ctx);
	if (!freshState.leafId || freshState.leafId !== initialPlan.sourceLeafId) {
		ctx.ui.notify("session changed during summary review — re-run /compress (nothing written)", "warning");
		return;
	}

	let plan: RangePlan;
	try {
		plan = planRange(freshState.tree, initialPlan.sourceLeafId, initialPlan.startEntryId, initialPlan.endEntryId);
	} catch (error) {
		ctx.ui.notify(`selected range is no longer valid: ${(error as Error).message} (nothing written)`, "warning");
		return;
	}
	const sameSelectedIds =
		plan.selectedEntryIds.length === initialPlan.selectedEntryIds.length &&
		plan.selectedEntryIds.every((id, index) => id === initialPlan.selectedEntryIds[index]);
	if (!sameSelectedIds || plan.sourceSha8 !== initialPlan.sourceSha8) {
		ctx.ui.notify("selected range changed during summary review — re-run /compress (nothing written)", "warning");
		return;
	}

	const approvedSummary = reviewed.trim();
	const details = buildRangeCompactData(plan, approvedSummary, summaryModel);
	const rebuilt = renderRangeTail(plan, approvedSummary);

	if (leafIdOf(ctx) !== plan.sourceLeafId) {
		ctx.ui.notify("session changed before range compression was applied — nothing written", "warning");
		return;
	}
	const navigation = await ctx.navigateTree(plan.anchorId, { summarize: false });
	if (navigation.cancelled) {
		ctx.ui.notify("range compression cancelled during navigation — nothing written", "warning");
		return;
	}

	pi.sendMessage(
		{
			customType: CTREE_RANGE_TAIL,
			content: rebuilt,
			display: true,
			details,
		},
		{ triggerTurn: false },
	);
	pi.appendEntry(CTREE_RANGE_COMPACT, details);
	refreshAmbient(pi, ctx);
	ctx.ui.notify(
		`compressed range: selected ~${fmtTokens(plan.selectedEstTokens)} · summary ~${fmtTokens(details.summaryEstTokens)} · reclaimed ~${fmtTokens(details.reclaimedEstTokens)} tokens · originals kept at ${plan.sourceLeafId}`,
		"info",
	);
}

export async function rangeCompressHandler(pi: PiLike, ctx: CmdCtxLike, args: string, deps: Deps): Promise<void> {
	const instructions = args.trim() || undefined;
	await ctx.waitForIdle();
	const sourceLeafId = ctx.sessionManager.getLeafId();
	const state = deriveState(ctx);
	if (!sourceLeafId || !state.tree.get(sourceLeafId)) {
		ctx.ui.notify("empty session — nothing to compress", "warning");
		return;
	}

	const candidates = rangeCandidates(state.tree, sourceLeafId);
	let firstEntryId = "";
	let firstInitialId = sourceLeafId;
	while (!firstEntryId) {
		const selectedEntryId = await selectNativeEntry(ctx, "start", firstInitialId);
		if (selectedEntryId === undefined) return;
		const endpoint = resolveRangeEndpoint(candidates, selectedEntryId, "start");
		if (!endpoint.ok) {
			ctx.ui.notify(`Invalid range start: ${endpoint.reason}. Select another entry.`, "warning");
			firstInitialId = selectedEntryId;
			continue;
		}
		firstEntryId = endpoint.entryId;
	}

	let secondInitialId = firstEntryId;
	while (true) {
		const selectedEntryId = await selectNativeEntry(ctx, "end", secondInitialId);
		if (selectedEntryId === undefined) return;
		const endpoint = resolveRangeEndpoint(candidates, selectedEntryId, "end");
		if (!endpoint.ok) {
			ctx.ui.notify(`Invalid range end: ${endpoint.reason}. Select another entry.`, "warning");
			secondInitialId = selectedEntryId;
			continue;
		}

		let plan: RangePlan;
		try {
			plan = planRange(state.tree, sourceLeafId, firstEntryId, endpoint.entryId);
		} catch (error) {
			ctx.ui.notify(`Invalid range: ${(error as Error).message}. Select another last entry.`, "warning");
			secondInitialId = selectedEntryId;
			continue;
		}

		const startEntry = state.tree.get(plan.startEntryId);
		const endEntry = state.tree.get(plan.endEntryId);
		const startLabel = startEntry
			? (serializeEntry(startEntry)?.split("\n", 1)[0] ?? startEntry.type)
			: plan.startEntryId;
		const endLabel = endEntry ? (serializeEntry(endEntry)?.split("\n", 1)[0] ?? endEntry.type) : plan.endEntryId;
		const confirmed = await ctx.ui.confirm(
			"Compress selected range",
			[
				`Start: ${startLabel}`,
				`End: ${endLabel}`,
				`${plan.selectedEntryIds.length} entries · ~${fmtTokens(plan.selectedEstTokens)} tokens`,
			].join("\n"),
		);
		if (!confirmed) return;

		await applyRangeCompressionPlan(pi, ctx, plan, instructions, deps);
		return;
	}
}

export function registerRangeCompress(pi: PiLike, deps: Deps): void {
	pi.registerCommand("compress", {
		description: "pi-context-tree: select, summarize, review, and replace one active-context range",
		handler: (args, ctx) => rangeCompressHandler(pi, ctx, args, deps),
	});
}
