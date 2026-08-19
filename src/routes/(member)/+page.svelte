<script lang="ts">
	import { portfolio } from '$lib/remote/pnl.remote';
	import { managerPerformance } from '$lib/remote/capital.remote';
	import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '$lib/components/ui/card';
	import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/tabs';

	const snapshot = portfolio();

	let feePercent = $state(15);
	let fdRate = $state(7);
	let perf = $derived(managerPerformance({ feePercent, fdRate }));
	let activeTab = $state('portfolio');

	function fmt(n: number) {
		return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
	}

	function pnlColor(n: number) {
		if (n > 0) return 'text-emerald-600 dark:text-emerald-400';
		if (n < 0) return 'text-rose-600 dark:text-rose-400';
		return 'text-muted-foreground';
	}
</script>

<div class="space-y-3 sm:space-y-6">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
				{activeTab === 'portfolio' ? 'Your Portfolio' : 'Performance Management'}
			</h1>
			<p class="text-[11px] text-muted-foreground sm:text-sm">
				{activeTab === 'portfolio'
					? 'Real-time positions, holdings, and P&L breakdown'
					: 'Net portfolio value after performance fee & estimated liquidation charges vs. FD benchmark'}
			</p>
		</div>
		<Tabs value={activeTab} onValueChange={(v) => (activeTab = v)} class="w-full sm:w-auto">
			<TabsList class="grid grid-cols-2 w-full sm:w-64">
				<TabsTrigger value="portfolio">Portfolio</TabsTrigger>
				<TabsTrigger value="performance">Performance</TabsTrigger>
			</TabsList>
		</Tabs>
	</div>

	{#if activeTab === 'portfolio'}
		{#await snapshot}
			<div class="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
				{#each Array(4) as _}
					<Card class="animate-pulse">
						<CardHeader class="p-3 sm:pb-2">
							<div class="h-3 w-16 rounded bg-muted"></div>
						</CardHeader>
						<CardContent class="px-3 pb-3 sm:pb-4">
							<div class="h-5 w-24 rounded bg-muted"></div>
						</CardContent>
					</Card>
				{/each}
			</div>
		{:then data}
			{#if data.hasIncompleteData}
				<div class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 sm:p-3 text-xs text-amber-700 dark:text-amber-300">
					⚠️ Some positions are missing a live market price, so unrealized P&L may be estimated.
				</div>
			{/if}

			<!-- Metric Summary Cards: 2x2 on mobile for maximum density -->
			<div class="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
				<Card>
					<CardContent class="p-2.5 sm:p-4">
						<p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">Unrealized P&L</p>
						<div class="mt-0.5 text-base font-bold sm:text-2xl {pnlColor(data.totalUnrealized)}">
							{data.totalUnrealized >= 0 ? '+' : ''}₹{fmt(data.totalUnrealized)}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent class="p-2.5 sm:p-4">
						<p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs truncate">
							Realized ({data.realizedPeriod.from.slice(5)} → {data.realizedPeriod.to.slice(5)})
						</p>
						<div class="mt-0.5 text-base font-bold sm:text-2xl {pnlColor(data.totalRealized)}">
							{data.totalRealized >= 0 ? '+' : ''}₹{fmt(data.totalRealized)}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent class="p-2.5 sm:p-4">
						<p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">Taxes & Charges</p>
						<div class="mt-0.5 text-base font-bold text-muted-foreground sm:text-2xl">
							-₹{fmt(data.totalCharges)}
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent class="p-2.5 sm:p-4">
						<p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">Net P&L (After Charges)</p>
						<div class="mt-0.5 text-base font-bold sm:text-2xl {pnlColor(data.netPnlAfterCharges)}">
							{data.netPnlAfterCharges >= 0 ? '+' : ''}₹{fmt(data.netPnlAfterCharges)}
						</div>
						<p class="text-[9px] text-muted-foreground font-mono truncate mt-0.5 hidden sm:block">
							Gross (₹{fmt(data.grossNetPnl)}) - Charges (₹{fmt(data.totalCharges)})
						</p>
					</CardContent>
				</Card>
			</div>

			<!-- Funds Summary: 4-column single row on mobile -->
			{#if data.funds}
				<Card class="bg-card/50">
					<CardContent class="py-2 px-3 sm:py-3 sm:px-6">
						<div class="grid grid-cols-4 gap-1.5 text-center text-xs sm:text-left sm:text-sm">
							<div>
								<span class="text-muted-foreground block text-[10px] sm:text-xs truncate">Available</span>
								<span class="font-semibold text-foreground text-xs sm:text-sm">₹{fmt(data.funds.availableBalance)}</span>
							</div>
							<div>
								<span class="text-muted-foreground block text-[10px] sm:text-xs truncate">Utilized</span>
								<span class="font-semibold text-foreground text-xs sm:text-sm">₹{fmt(data.funds.utilizedAmount)}</span>
							</div>
							<div>
								<span class="text-muted-foreground block text-[10px] sm:text-xs truncate">Collateral</span>
								<span class="font-semibold text-foreground text-xs sm:text-sm">₹{fmt(data.funds.collateralAmount)}</span>
							</div>
							<div>
								<span class="text-muted-foreground block text-[10px] sm:text-xs truncate">SOD Limit</span>
								<span class="font-semibold text-foreground text-xs sm:text-sm">₹{fmt(data.funds.sodLimit)}</span>
							</div>
						</div>
					</CardContent>
				</Card>
			{/if}

			<!-- Open Positions Section -->
			<Card>
				<CardHeader class="border-b border-border py-2.5 px-3 sm:py-3 sm:px-6">
					<div class="flex items-center justify-between">
						<CardTitle class="text-sm font-semibold sm:text-base">Open Positions</CardTitle>
						<Badge variant="outline" class="text-xs">{data.positions.length}</Badge>
					</div>
				</CardHeader>
				<CardContent class="p-0">
					{#if data.positions.length === 0}
						<p class="p-4 text-center text-xs text-muted-foreground sm:p-6 sm:text-sm">No open positions.</p>
					{:else}
						<!-- Desktop Table View -->
						<div class="hidden md:block">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Symbol</TableHead>
										<TableHead>Type</TableHead>
										<TableHead class="text-right">Qty</TableHead>
										<TableHead class="text-right">Avg Price</TableHead>
										<TableHead class="text-right">LTP</TableHead>
										<TableHead class="text-right">Unrealized P&L</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{#each data.positions as p (p.symbol + p.productType)}
										<TableRow>
											<TableCell class="font-medium">
												{p.symbol}
												<span class="ml-1.5 text-xs text-muted-foreground">({p.exchange})</span>
											</TableCell>
											<TableCell>
												<Badge variant="secondary" class="text-[10px]">{p.productType}</Badge>
											</TableCell>
											<TableCell class="text-right font-mono">{p.netQty}</TableCell>
											<TableCell class="text-right font-mono">₹{fmt(p.avgPrice)}</TableCell>
											<TableCell class="text-right font-mono">
												{p.ltpAvailable ? `₹${fmt(p.ltp ?? 0)}` : '—'}
											</TableCell>
											<TableCell class="text-right font-mono font-semibold {pnlColor(p.unrealized)}">
												{p.ltpAvailable ? `${p.unrealized >= 0 ? '+' : ''}₹${fmt(p.unrealized)}` : 'unavailable'}
											</TableCell>
										</TableRow>
									{/each}
								</TableBody>
							</Table>
						</div>

						<!-- Mobile Compact Card/Row View -->
						<div class="divide-y divide-border md:hidden">
							{#each data.positions as p (p.symbol + p.productType)}
								<div class="p-2.5 space-y-1">
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-1.5">
											<span class="font-semibold text-xs">{p.symbol}</span>
											<Badge variant="outline" class="text-[9px] px-1 py-0">{p.exchange}</Badge>
											<Badge variant="secondary" class="text-[9px] px-1 py-0">{p.productType}</Badge>
										</div>
										<span class="text-xs font-mono font-semibold {pnlColor(p.unrealized)}">
											{p.unrealized >= 0 ? '+' : ''}₹{fmt(p.unrealized)}
										</span>
									</div>
									<div class="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-0.5">
										<span>Qty: <strong class="text-foreground font-normal">{p.netQty}</strong></span>
										<span>Avg: <strong class="text-foreground font-normal">₹{fmt(p.avgPrice)}</strong></span>
										<span>LTP: <strong class="text-foreground font-normal">{p.ltpAvailable ? `₹${fmt(p.ltp ?? 0)}` : '—'}</strong></span>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</CardContent>
			</Card>

			<!-- Holdings Section -->
			<Card>
				<CardHeader class="border-b border-border py-2.5 px-3 sm:py-3 sm:px-6">
					<div class="flex items-center justify-between">
						<CardTitle class="text-sm font-semibold sm:text-base">Holdings</CardTitle>
						<Badge variant="outline" class="text-xs">{data.holdings.length}</Badge>
					</div>
				</CardHeader>
				<CardContent class="p-0">
					{#if data.holdings.length === 0}
						<p class="p-4 text-center text-xs text-muted-foreground sm:p-6 sm:text-sm">No holdings.</p>
					{:else}
						<!-- Desktop Table View -->
						<div class="hidden md:block">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Symbol</TableHead>
										<TableHead class="text-right">Qty</TableHead>
										<TableHead class="text-right">Avg Cost</TableHead>
										<TableHead class="text-right">LTP</TableHead>
										<TableHead class="text-right">Unrealized P&L</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{#each data.holdings as h (h.symbol)}
										<TableRow>
											<TableCell class="font-medium">
												{h.symbol}
												<span class="ml-1.5 text-xs text-muted-foreground">({h.exchange})</span>
											</TableCell>
											<TableCell class="text-right font-mono">{h.netQty}</TableCell>
											<TableCell class="text-right font-mono">₹{fmt(h.avgPrice)}</TableCell>
											<TableCell class="text-right font-mono">
												{h.ltpAvailable ? `₹${fmt(h.ltp ?? 0)}` : '—'}
											</TableCell>
											<TableCell class="text-right font-mono font-semibold {pnlColor(h.unrealized)}">
												{h.ltpAvailable ? `${h.unrealized >= 0 ? '+' : ''}₹${fmt(h.unrealized)}` : 'unavailable'}
											</TableCell>
										</TableRow>
									{/each}
								</TableBody>
							</Table>
						</div>

						<!-- Mobile Compact Card/Row View -->
						<div class="divide-y divide-border md:hidden">
							{#each data.holdings as h (h.symbol)}
								<div class="p-2.5 space-y-1">
									<div class="flex items-center justify-between">
										<span class="font-semibold text-xs">{h.symbol} <span class="text-[10px] font-normal text-muted-foreground">({h.exchange})</span></span>
										<span class="text-xs font-mono font-semibold {pnlColor(h.unrealized)}">
											{h.unrealized >= 0 ? '+' : ''}₹{fmt(h.unrealized)}
										</span>
									</div>
									<div class="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-0.5">
										<span>Qty: <strong class="text-foreground font-normal">{h.netQty}</strong></span>
										<span>Avg: <strong class="text-foreground font-normal">₹{fmt(h.avgPrice)}</strong></span>
										<span>LTP: <strong class="text-foreground font-normal">{h.ltpAvailable ? `₹${fmt(h.ltp ?? 0)}` : '—'}</strong></span>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</CardContent>
			</Card>
		{:catch error}
			<Card class="border-destructive/50 bg-destructive/5">
				<CardContent class="p-4 sm:p-6">
					<p class="text-xs text-destructive sm:text-sm">Couldn't load portfolio data: {error.message}</p>
				</CardContent>
			</Card>
		{/await}
	{:else if activeTab === 'performance'}
		<!-- Manager Performance View -->
		<Card>
			<CardHeader class="border-b border-border py-2.5 px-3 sm:py-3 sm:px-6">
				<div class="flex flex-row items-center justify-between gap-2">
					<div>
						<CardTitle class="text-sm font-semibold sm:text-base">Performance Overview</CardTitle>
						<CardDescription class="text-[10px] sm:text-xs hidden sm:block">
							Adjust manager fee and FD rate parameters to evaluate real returns against FD benchmark
						</CardDescription>
					</div>
					<div class="flex items-center gap-2 text-[11px] sm:text-xs shrink-0">
						<div class="flex items-center gap-1">
							<Label for="memberFeePercent" class="text-[10px] sm:text-xs text-muted-foreground">Fee%:</Label>
							<Input id="memberFeePercent" type="number" step="0.5" bind:value={feePercent} class="h-6 w-14 sm:h-7 sm:w-16 text-[11px] sm:text-xs px-1.5 font-mono" />
						</div>
						<div class="flex items-center gap-1">
							<Label for="memberFdRate" class="text-[10px] sm:text-xs text-muted-foreground">FD%:</Label>
							<Input id="memberFdRate" type="number" step="0.5" bind:value={fdRate} class="h-6 w-14 sm:h-7 sm:w-16 text-[11px] sm:text-xs px-1.5 font-mono" />
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent class="p-3 sm:p-5 space-y-4">
				{#await perf}
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
						{#each Array(3) as _}
							<div class="h-20 rounded-lg bg-muted/40 animate-pulse"></div>
						{/each}
					</div>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
						{#each Array(5) as _}
							<div class="h-14 rounded-lg bg-muted/40 animate-pulse"></div>
						{/each}
					</div>
				{:then p}
					{#if p.warnings && p.warnings.length > 0}
						<div class="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300">
							{#each p.warnings as w}
								<p>⚠️ {w}</p>
							{/each}
						</div>
					{/if}

					<!-- Top Hero Highlights -->
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
						<!-- Real Net Position Card -->
						<div class="rounded-xl border border-primary/40 bg-primary/5 p-3 sm:p-4 shadow-xs">
							<div class="flex items-center justify-between">
								<p class="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-primary">Real Net Position</p>
								<span class="text-[10px] font-medium text-primary/90 bg-primary/10 px-1.5 py-0.5 rounded">To Bank</span>
							</div>
							<p class="mt-1.5 text-lg sm:text-2xl font-bold font-mono text-primary tracking-tight">₹{fmt(p.realizableNetValue)}</p>
							<p class="mt-1 text-[10px] text-muted-foreground">Net withdrawable after fee & liquidation charges</p>
						</div>

						<!-- FD Benchmark Card -->
						<div class="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-xs">
							<div class="flex items-center justify-between">
								<p class="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">FD Benchmark ({p.fdRate}%)</p>
								<span class="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Simulated</span>
							</div>
							<p class="mt-1.5 text-lg sm:text-2xl font-bold font-mono tracking-tight">₹{fmt(p.fdBenchmarkValue)}</p>
							<p class="mt-1 text-[10px] text-muted-foreground">Compounded FD rate on capital timeline</p>
						</div>

						<!-- Real Benefit Card -->
						<div class="rounded-xl border p-3 sm:p-4 shadow-xs {p.realizableBenefit >= 0 ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10'}">
							<div class="flex items-center justify-between">
								<p class="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">Real Benefit vs FD</p>
								<span class="text-[10px] font-medium px-1.5 py-0.5 rounded {p.realizableBenefit >= 0 ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'}">
									{p.realizableBenefit >= 0 ? 'Outperformed' : 'Underperformed'}
								</span>
							</div>
							<p class="mt-1.5 text-lg sm:text-2xl font-bold font-mono tracking-tight {pnlColor(p.realizableBenefit)}">
								{p.realizableBenefit >= 0 ? '+' : ''}₹{fmt(p.realizableBenefit)}
							</p>
							<p class="mt-1 text-[10px] text-muted-foreground">Net withdrawable position minus FD benchmark</p>
						</div>
					</div>

					<!-- Detailed Metrics Breakdown -->
					<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 pt-1">
						<div class="rounded-lg border border-border bg-card p-2.5 sm:p-3">
							<p class="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Deposited / Withdrawn</p>
							<p class="mt-1 text-xs sm:text-sm font-semibold font-mono">₹{fmt(p.totalDeposited)} / ₹{fmt(p.totalWithdrawn)}</p>
							<p class="mt-0.5 text-[10px] text-muted-foreground">Net capital: ₹{fmt(p.netCapitalContributed)}</p>
						</div>

						<div class="rounded-lg border border-border bg-card p-2.5 sm:p-3">
							<p class="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Realized P&L</p>
							<p class="mt-1 text-xs sm:text-sm font-semibold font-mono {pnlColor(p.cumulativeRealizedProfit)}">
								{p.cumulativeRealizedProfit >= 0 ? '+' : ''}₹{fmt(p.cumulativeRealizedProfit)}
							</p>
							<p class="mt-0.5 text-[10px] text-muted-foreground">Historical trades FIFO</p>
						</div>

						<div class="rounded-lg border border-border bg-card p-2.5 sm:p-3">
							<p class="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Est. Fee ({p.feePercent}%)</p>
							<p class="mt-1 text-xs sm:text-sm font-semibold font-mono text-muted-foreground">₹{fmt(p.estimatedFeeOwed)}</p>
							<p class="mt-0.5 text-[10px] text-muted-foreground">HWM high-water mark</p>
						</div>

						<div class="rounded-lg border border-border bg-card p-2.5 sm:p-3">
							<p class="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Value After Fee</p>
							<p class="mt-1 text-xs sm:text-sm font-semibold font-mono">₹{fmt(p.yourValueAfterEstimatedFee)}</p>
							<p class="mt-0.5 text-[10px] text-muted-foreground">Live gross value - fee</p>
						</div>

						<div class="rounded-lg border border-border bg-card p-2.5 sm:p-3 col-span-2 sm:col-span-1">
							<p class="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Est. Liq. Charges</p>
							<p class="mt-1 text-xs sm:text-sm font-semibold font-mono text-amber-600 dark:text-amber-400">₹{fmt(p.estimatedLiquidationCharges)}</p>
							<p class="mt-0.5 text-[10px] text-muted-foreground truncate" title="STT: ₹{fmt(p.liquidationChargesBreakdown.stt)} | DP: ₹{fmt(p.liquidationChargesBreakdown.dpCharges)}">
								STT: ₹{fmt(p.liquidationChargesBreakdown.stt)} | DP: ₹{fmt(p.liquidationChargesBreakdown.dpCharges)}
							</p>
						</div>
					</div>
				{:catch error}
					<p class="text-xs text-destructive">Couldn't load performance metrics: {error.message}</p>
				{/await}
			</CardContent>
		</Card>
	{/if}
</div>
