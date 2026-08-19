<script lang="ts">
	import {
		listLedgerEntries,
		syncLedger,
		updateLedgerEntryClassification,
		managerPerformance
	} from '$lib/remote/capital.remote';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import {
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell
	} from '$lib/components/ui/table';
	import {
		Select,
		SelectTrigger,
		SelectContent,
		SelectItem
	} from '$lib/components/ui/select';
	import { Checkbox } from '$lib/components/ui/checkbox';

	const entries = listLedgerEntries();

	let feePercent = $state(15);
	let fdRate = $state(7);
	let perf = $derived(managerPerformance({ feePercent, fdRate }));

	// today, and 3 years back, as sensible sync defaults
	const today = new Date().toISOString().slice(0, 10);
	const threeYearsAgo = new Date(Date.now() - 3 * 365 * 86_400_000).toISOString().slice(0, 10);
	let syncFrom = $state(threeYearsAgo);
	let syncTo = $state(today);
	let syncing = $state(false);
	let syncError = $state<string | null>(null);
	let syncResult = $state<{ synced: number; skipped: number } | null>(null);

	async function handleSync() {
		syncing = true;
		syncError = null;
		syncResult = null;
		try {
			syncResult = await syncLedger({ fromDate: syncFrom, toDate: syncTo });
		} catch (err) {
			syncError = err instanceof Error ? err.message : 'Sync failed';
		} finally {
			syncing = false;
		}
	}

	async function updateEntry(
		voucherNumber: string,
		cashFlowType: 'deposit' | 'withdrawal' | 'other',
		includeInCapitalFlow: boolean
	) {
		await updateLedgerEntryClassification({ voucherNumber, cashFlowType, includeInCapitalFlow });
	}

	function fmt(n: number) {
		return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
	}

	function pnlColor(n: number) {
		if (n > 0) return 'text-emerald-600 dark:text-emerald-400';
		if (n < 0) return 'text-rose-600 dark:text-rose-400';
		return 'text-muted-foreground';
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-xl font-semibold">Manager performance</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Compares your actual portfolio (net of performance fee & liquidation charges) against what the same
			deposits/withdrawals would be worth in a Fixed Deposit (FD) instead.
		</p>
	</div>

	<!-- Sync ledger card -->
	<Card>
		<CardHeader>
			<CardTitle>Sync ledger from Dhan</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
				<div class="space-y-1">
					<Label for="syncFrom">From</Label>
					<Input id="syncFrom" type="date" bind:value={syncFrom} class="w-full sm:w-auto" />
				</div>
				<div class="space-y-1">
					<Label for="syncTo">To</Label>
					<Input id="syncTo" type="date" bind:value={syncTo} class="w-full sm:w-auto" />
				</div>
				<Button onclick={handleSync} disabled={syncing} class="w-full sm:w-auto">
					{syncing ? 'Syncing…' : 'Sync'}
				</Button>
			</div>
			{#if syncError}
				<p class="mt-2 text-sm text-destructive">{syncError}</p>
			{/if}
			{#if syncResult}
				<p class="mt-2 text-sm text-muted-foreground">
					Synced {syncResult.synced} entries{syncResult.skipped > 0
						? ` (${syncResult.skipped} skipped — unparseable date)`
						: ''}.
				</p>
			{/if}
		</CardContent>
	</Card>

	<!-- Assumptions card -->
	<Card>
		<CardHeader>
			<CardTitle>Assumptions</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
				<div class="space-y-1 flex-1">
					<Label for="feePercent">Manager fee (%, above high-water mark)</Label>
					<Input id="feePercent" type="number" step="0.5" bind:value={feePercent} class="w-full font-mono" />
				</div>
				<div class="space-y-1 flex-1">
					<Label for="fdRate">FD rate (% p.a.)</Label>
					<Input id="fdRate" type="number" step="0.5" bind:value={fdRate} class="w-full font-mono" />
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Performance metrics -->
	{#await perf}
		<p class="text-sm text-muted-foreground">Calculating…</p>
	{:then p}
		{#if p.warnings.length > 0}
			<div
				class="space-y-1 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
			>
				{#each p.warnings as w}
					<p>⚠️ {w}</p>
				{/each}
			</div>
		{/if}

		<div class="space-y-4">
			<!-- Top Hero Highlights -->
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<!-- Real Net Position Card -->
				<Card class="border-primary/40 bg-primary/5 shadow-xs">
					<CardContent class="p-4">
						<div class="flex items-center justify-between">
							<p class="text-xs font-semibold uppercase tracking-wider text-primary">Real Net Position</p>
							<span class="text-[10px] font-medium text-primary/90 bg-primary/10 px-1.5 py-0.5 rounded">To Bank</span>
						</div>
						<p class="mt-2 text-2xl font-bold font-mono text-primary tracking-tight">₹{fmt(p.realizableNetValue)}</p>
						<p class="mt-1 text-xs text-muted-foreground">Net withdrawable after fee & liquidation charges</p>
					</CardContent>
				</Card>

				<!-- FD Benchmark Card -->
				<Card class="shadow-xs">
					<CardContent class="p-4">
						<div class="flex items-center justify-between">
							<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">FD Benchmark ({p.fdRate}%)</p>
							<span class="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Simulated</span>
						</div>
						<p class="mt-2 text-2xl font-bold font-mono tracking-tight">₹{fmt(p.fdBenchmarkValue)}</p>
						<p class="mt-1 text-xs text-muted-foreground">Compounded FD rate on capital timeline</p>
					</CardContent>
				</Card>

				<!-- Real Benefit Card -->
				<Card class="shadow-xs {p.realizableBenefit >= 0 ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10'}">
					<CardContent class="p-4">
						<div class="flex items-center justify-between">
							<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Real Benefit vs FD</p>
							<span class="text-[10px] font-medium px-1.5 py-0.5 rounded {p.realizableBenefit >= 0 ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'}">
								{p.realizableBenefit >= 0 ? 'Outperformed' : 'Underperformed'}
							</span>
						</div>
						<p class="mt-2 text-2xl font-bold font-mono tracking-tight {pnlColor(p.realizableBenefit)}">
							{p.realizableBenefit >= 0 ? '+' : ''}₹{fmt(p.realizableBenefit)}
						</p>
						<p class="mt-1 text-xs text-muted-foreground">Net withdrawable position minus FD benchmark</p>
					</CardContent>
				</Card>
			</div>

			<!-- Detailed Breakdown Cards -->
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
				<Card>
					<CardContent class="p-3.5">
						<p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Deposited / Withdrawn</p>
						<p class="mt-1 text-sm font-semibold font-mono">₹{fmt(p.totalDeposited)} / ₹{fmt(p.totalWithdrawn)}</p>
						<p class="mt-0.5 text-[10px] text-muted-foreground">Net capital: ₹{fmt(p.netCapitalContributed)}</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent class="p-3.5">
						<p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Realized P&L</p>
						<p class="mt-1 text-sm font-semibold font-mono {pnlColor(p.cumulativeRealizedProfit)}">
							{p.cumulativeRealizedProfit >= 0 ? '+' : ''}₹{fmt(p.cumulativeRealizedProfit)}
						</p>
						<p class="mt-0.5 text-[10px] text-muted-foreground">Historical trades FIFO</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent class="p-3.5">
						<p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Est. Fee ({p.feePercent}%)</p>
						<p class="mt-1 text-sm font-semibold font-mono text-muted-foreground">₹{fmt(p.estimatedFeeOwed)}</p>
						<p class="mt-0.5 text-[10px] text-muted-foreground">HWM high-water mark</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent class="p-3.5">
						<p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Value After Fee</p>
						<p class="mt-1 text-sm font-semibold font-mono">₹{fmt(p.yourValueAfterEstimatedFee)}</p>
						<p class="mt-0.5 text-[10px] text-muted-foreground">Live gross value - fee</p>
					</CardContent>
				</Card>
				<Card class="col-span-2 sm:col-span-1">
					<CardContent class="p-3.5">
						<p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Est. Liq. Charges</p>
						<p class="mt-1 text-sm font-semibold font-mono text-amber-600 dark:text-amber-400">₹{fmt(p.estimatedLiquidationCharges)}</p>
						<p class="mt-0.5 text-[10px] text-muted-foreground truncate" title="STT: ₹{fmt(p.liquidationChargesBreakdown.stt)} | DP: ₹{fmt(p.liquidationChargesBreakdown.dpCharges)}">
							STT: ₹{fmt(p.liquidationChargesBreakdown.stt)} | DP: ₹{fmt(p.liquidationChargesBreakdown.dpCharges)}
						</p>
					</CardContent>
				</Card>
			</div>
		</div>
	{:catch error}
		<p class="text-sm text-destructive">
			{error?.body?.message ?? error?.message ?? 'Failed to calculate'}
		</p>
	{/await}

	<!-- Ledger entries table -->
	<Card>
		<CardHeader>
			<CardTitle>Ledger entries — review classification</CardTitle>
		</CardHeader>
		<CardContent class="p-0">
			{#await entries}
				<p class="p-4 text-sm text-muted-foreground">Loading…</p>
			{:then rows}
				{#if rows.length === 0}
					<p class="p-4 text-sm text-muted-foreground">No ledger entries synced yet.</p>
				{:else}
					<!-- Desktop table -->
					<div class="hidden sm:block overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Date</TableHead>
									<TableHead>Narration</TableHead>
									<TableHead class="text-right">Debit</TableHead>
									<TableHead class="text-right">Credit</TableHead>
									<TableHead>Type</TableHead>
									<TableHead class="text-center">Counts</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#each rows as row (row.voucherNumber)}
									<TableRow>
										<TableCell class="whitespace-nowrap font-mono text-xs"
											>{row.voucherDate}</TableCell
										>
										<TableCell class="max-w-[200px] text-sm">{row.narration}</TableCell>
										<TableCell class="text-right font-mono text-sm">
											{row.debit > 0 ? `₹${fmt(row.debit)}` : ''}
										</TableCell>
										<TableCell class="text-right font-mono text-sm">
											{row.credit > 0 ? `₹${fmt(row.credit)}` : ''}
										</TableCell>
										<TableCell>
											<Select
												type="single"
												value={row.cashFlowType}
												onValueChange={(v: string) =>
													updateEntry(
														row.voucherNumber,
														v as 'deposit' | 'withdrawal' | 'other',
														row.includeInCapitalFlow
													)}
											>
												<SelectTrigger class="h-8 w-32 text-xs">
													{row.cashFlowType}
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="deposit">Deposit</SelectItem>
													<SelectItem value="withdrawal">Withdrawal</SelectItem>
													<SelectItem value="other">Other</SelectItem>
												</SelectContent>
											</Select>
										</TableCell>
										<TableCell class="text-center">
											<Checkbox
												checked={row.includeInCapitalFlow}
												onCheckedChange={(v) =>
													updateEntry(row.voucherNumber, row.cashFlowType, v as boolean)}
											/>
										</TableCell>
									</TableRow>
								{/each}
							</TableBody>
						</Table>
					</div>

					<!-- Mobile card view -->
					<div class="divide-y divide-border sm:hidden">
						{#each rows as row (row.voucherNumber)}
							<div class="space-y-3 p-4">
								<div class="flex items-start justify-between gap-2">
									<div>
										<p class="text-xs font-mono text-muted-foreground">{row.voucherDate}</p>
										<p class="mt-0.5 text-sm">{row.narration}</p>
									</div>
									<div class="text-right text-sm font-mono shrink-0">
										{#if row.debit > 0}
											<span class="text-destructive">-₹{fmt(row.debit)}</span>
										{/if}
										{#if row.credit > 0}
											<span class="text-emerald-600 dark:text-emerald-400">+₹{fmt(row.credit)}</span>
										{/if}
									</div>
								</div>
								<div class="flex items-center justify-between gap-3">
									<Select
										type="single"
										value={row.cashFlowType}
										onValueChange={(v: string) =>
											updateEntry(
												row.voucherNumber,
												v as 'deposit' | 'withdrawal' | 'other',
												row.includeInCapitalFlow
											)}
									>
										<SelectTrigger class="h-8 flex-1 text-xs">
											{row.cashFlowType}
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="deposit">Deposit</SelectItem>
											<SelectItem value="withdrawal">Withdrawal</SelectItem>
											<SelectItem value="other">Other</SelectItem>
										</SelectContent>
									</Select>
									<label class="flex items-center gap-2 text-xs text-muted-foreground">
										<Checkbox
											checked={row.includeInCapitalFlow}
											onCheckedChange={(v) =>
												updateEntry(row.voucherNumber, row.cashFlowType, v as boolean)}
										/>
										Include
									</label>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/await}
		</CardContent>
	</Card>
</div>
