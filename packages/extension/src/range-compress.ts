import {
	CHARS_PER_TOKEN,
	CTREE_RANGE_COMPACT,
	CTREE_RANGE_TAIL,
	type CtreeRangeCompactData,
	type RangePlan,
	fmtTokens,
	planRange,
	renderRangeTail,
} from "@pi-context-tree/core";
import { type CmdCtxLike, type Deps, type PiLike, leafIdOf, modelKey } from "./adapter.ts";
import { refreshAmbient } from "./ambient.ts";
import { draftRangeSummary } from "./draft.ts";
import { openPanel } from "./panel-cmd.ts";
import { deriveState } from "./state.ts";

/** Apply a reviewed panel plan. The session is revalidated before every write. */
export async function applyRangeCompressionPlan(
	pi: PiLike,
	ctx: CmdCtxLike,
	initialPlan: RangePlan,
	instructions: string | undefined,
	deps: Deps,
): Promise<void> {
	if (leafIdOf(ctx) !== initialPlan.sourceLeafId) {
		ctx.ui.notify("session changed while the range panel was open — re-run /compress (nothing written)", "warning");
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
	const summaryEstTokens = Math.ceil(approvedSummary.length / CHARS_PER_TOKEN);
	const reclaimedEstTokens = plan.selectedEstTokens - summaryEstTokens;
	const details: CtreeRangeCompactData = {
		v: 1,
		sourceLeafId: plan.sourceLeafId,
		anchorId: plan.anchorId,
		startEntryId: plan.startEntryId,
		endEntryId: plan.endEntryId,
		selectedEntryIds: [...plan.selectedEntryIds],
		selectedEstTokens: plan.selectedEstTokens,
		summaryEstTokens,
		reclaimedEstTokens,
		summaryModel,
		sourceSha8: plan.sourceSha8,
	};
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
		`compressed range: selected ~${fmtTokens(plan.selectedEstTokens)} · summary ~${fmtTokens(summaryEstTokens)} · reclaimed ~${fmtTokens(reclaimedEstTokens)} tokens · originals kept at ${plan.sourceLeafId}`,
		"info",
	);
}

export async function rangeCompressHandler(pi: PiLike, ctx: CmdCtxLike, args: string, deps: Deps): Promise<void> {
	const instructions = args.trim() || undefined;
	await ctx.waitForIdle();
	const state = deriveState(ctx);
	if (!state.leafId) {
		ctx.ui.notify("empty session — nothing to compress", "warning");
		return;
	}
	const sourceLeafId = state.leafId;
	const action = await openPanel(pi, ctx, {
		initialView: "range",
		compressInstructions: instructions,
	});
	if (!action || action.type === "close") return;
	if (action.type !== "range-apply") {
		ctx.ui.notify("range compression cancelled — no range selected, nothing written", "info");
		return;
	}
	if (action.plan.sourceLeafId !== sourceLeafId) {
		ctx.ui.notify("session changed while the range panel was open — re-run /compress (nothing written)", "warning");
		return;
	}
	await applyRangeCompressionPlan(pi, ctx, action.plan, instructions, deps);
}

export function registerRangeCompress(pi: PiLike, deps: Deps): void {
	pi.registerCommand("compress", {
		description: "pi-context-tree: select, summarize, review, and replace one active-context range",
		handler: (args, ctx) => rangeCompressHandler(pi, ctx, args, deps),
	});
}
