<script lang="ts">
	import { listLinkedAccounts } from '$lib/remote/accounts.remote';
	import { sendTestAlert, getWsStatus } from '$lib/remote/telegram.remote';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';

	const accounts = listLinkedAccounts();
	const wsStatus = getWsStatus();

	let sendingTest = $state(false);
	let testFeedback = $state<string | null>(null);

	async function handleTestTelegram() {
		sendingTest = true;
		testFeedback = null;
		try {
			const res = await sendTestAlert();
			testFeedback = '✅ ' + res.message;
		} catch (err: any) {
			testFeedback = '❌ ' + (err?.message || 'Failed to send test alert');
		} finally {
			sendingTest = false;
		}
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">Overview</h1>
		<p class="text-xs text-muted-foreground sm:text-sm">
			Consolidated dashboard across Dhan master and follower accounts
		</p>
	</div>

	<!-- Live Order WebSocket & Telegram Status -->
	<Card>
		<CardHeader class="border-b border-border py-3 px-4 sm:px-6">
			<div class="flex items-center justify-between">
				<CardTitle class="text-base font-semibold">Real-Time Dhan WebSocket & Telegram</CardTitle>
				{#await wsStatus}
					<Badge variant="secondary">Checking...</Badge>
				{:then status}
					<Badge variant={status.isConnected ? 'success' : 'secondary'}>
						{status.isConnected ? 'WebSocket Active' : 'Connecting / Ready'}
					</Badge>
				{/await}
			</div>
		</CardHeader>
		<CardContent class="p-4 sm:p-6 space-y-4">
			<p class="text-xs sm:text-sm text-muted-foreground">
				Order updates are listened to live on <code class="font-mono text-xs">wss://api-order-update.dhan.co</code>.
				Traded fills, order rejections, and status changes are automatically dispatched to your Telegram bot.
			</p>

			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
				<Button onclick={handleTestTelegram} disabled={sendingTest} variant="outline" size="sm">
					{sendingTest ? 'Sending Test…' : '🧪 Send Test Telegram Alert'}
				</Button>
				{#if testFeedback}
					<span class="text-xs font-medium">{testFeedback}</span>
				{/if}
			</div>
		</CardContent>
	</Card>

	<!-- Linked Accounts Summary -->
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
