<script lang="ts">
	import { listLinkedAccounts } from '$lib/remote/accounts.remote';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';

	const accounts = listLinkedAccounts();
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">Overview</h1>
		<p class="text-xs text-muted-foreground sm:text-sm">
			Consolidated dashboard across Dhan master and follower accounts
		</p>
	</div>

	<Card>
		<CardHeader class="border-b border-border py-3 px-4 sm:px-6">
			<CardTitle class="text-base font-semibold">Linked Follower Accounts</CardTitle>
		</CardHeader>
		<CardContent class="p-4 sm:p-6">
			{#await accounts}
				<p class="text-sm text-muted-foreground">Loading…</p>
			{:then rows}
				{#if rows.length === 0}
					<p class="text-sm text-muted-foreground">No accounts linked yet.</p>
				{:else}
					<ul class="divide-y divide-border text-sm">
						{#each rows as row (row.id)}
							<li class="flex items-center justify-between py-3">
								<div class="flex items-center gap-2">
									<span class="font-medium">{row.label}</span>
									<Badge variant="outline" class="uppercase text-[10px]">{row.broker}</Badge>
								</div>
								<div class="flex items-center gap-2">
									<span class="font-mono text-xs text-muted-foreground">{row.multiplier}x</span>
									<Badge variant={row.enabled ? 'success' : 'secondary'} class="text-[10px]">
										{row.enabled ? 'Enabled' : 'Disabled'}
									</Badge>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			{/await}
		</CardContent>
	</Card>
</div>
