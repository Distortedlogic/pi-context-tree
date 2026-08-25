import { TreeSelectorComponent } from "@earendil-works/pi-coding-agent";
import {
	CHARS_PER_TOKEN,
	CTREE_RANGE_COMPACT,
	CTREE_RANGE_TAIL,
	type CtreeRangeCompactData,
	type RangeCandidate,
	type RangePlan,
	SessionTree,
	fmtTokens,
	planRange,
	rangeCandidates,
	renderRangeTail,
} from "@pi-context-tree/core";
import { type CmdCtxLike, type Deps, type PiLike, leafIdOf, modelKey } from "./adapter.ts";
import { refreshAmbient } from "./ambient.ts";
import { draftRangeSummary } from "./draft.ts";
import { deriveState } from "./state.ts";

type RangePhase = "start" | "end";

type NativeSelectorContext = CmdCtxLike & {
	sessionManager: CmdCtxLike["sessionManager"] & {
		getTree(): ConstructorParameters<typeof TreeSelectorComponent>[0];
		getLeafId(): string | null;
	};
};

export async function selectNativeEntry(
	ctx: NativeSelectorContext,
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

export function resolveRangeEndpoint(
	tree: SessionTree,
	sourceLeafId: string,
	selectedEntryId: string,
	phase: RangePhase,
): RangeCandidate {
	const endpoint = rangeCandidates(tree, sourceLeafId).find((candidate) =>
		candidate.entryIds.includes(selectedEntryId),
	);
	if (!endpoint) throw new Error(`the selected ${phase} entry is off-path or structural`);
	if (!endpoint.selectable) {
		throw new Error(endpoint.protectReason ?? `the selected ${phase} entry is protected`);
	}
	return endpoint;
}

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
	const nativeCtx = ctx as NativeSelectorContext;
	const sourceLeafId = nativeCtx.sessionManager.getLeafId();
	const state = deriveState(ctx);
	if (!sourceLeafId || !state.tree.get(sourceLeafId)) {
		ctx.ui.notify("empty session — nothing to compress", "warning");
		return;
	}

	let firstEndpoint: RangeCandidate | undefined;
	let firstInitialId = sourceLeafId;
	while (!firstEndpoint) {
		const selectedEntryId = await selectNativeEntry(nativeCtx, "start", firstInitialId);
		if (selectedEntryId === undefined) return;
		try {
			firstEndpoint = resolveRangeEndpoint(state.tree, sourceLeafId, selectedEntryId, "start");
		} catch (error) {
			ctx.ui.notify(`Invalid range start: ${(error as Error).message}. Select another entry.`, "warning");
			firstInitialId = selectedEntryId;
		}
	}

	let secondInitialId = firstEndpoint.startEntryId;
	while (true) {
		const selectedEntryId = await selectNativeEntry(nativeCtx, "end", secondInitialId);
		if (selectedEntryId === undefined) return;

		let secondEndpoint: RangeCandidate;
		try {
			secondEndpoint = resolveRangeEndpoint(state.tree, sourceLeafId, selectedEntryId, "end");
		} catch (error) {
			ctx.ui.notify(`Invalid range end: ${(error as Error).message}. Select another entry.`, "warning");
			secondInitialId = selectedEntryId;
			continue;
		}

		const [normalizedStart, normalizedEnd] =
			firstEndpoint.pathIndex <= secondEndpoint.pathIndex
				? [firstEndpoint, secondEndpoint]
				: [secondEndpoint, firstEndpoint];
		let plan: RangePlan;
		try {
			plan = planRange(state.tree, sourceLeafId, normalizedStart.startEntryId, normalizedEnd.endEntryId);
		} catch (error) {
			ctx.ui.notify(`Invalid range: ${(error as Error).message}. Select another last entry.`, "warning");
			secondInitialId = selectedEntryId;
			continue;
		}

		const confirmed = await ctx.ui.confirm(
			"Compress selected range",
			[
				`Start: ${normalizedStart.label}`,
				`End: ${normalizedEnd.label}`,
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
