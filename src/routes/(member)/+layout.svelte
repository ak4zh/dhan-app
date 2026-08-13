<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { me } from '$lib/remote/session.remote';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';

	let { children } = $props();
	const session = me();

	async function handleSignOut() {
		await authClient.signOut();
		await goto('/login');
	}
</script>

<div class="min-h-screen bg-muted/20 antialiased">
	<header class="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
		<div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
			<div class="flex items-center gap-3">
				<div class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-base">
					D
				</div>
				<span class="text-base font-semibold tracking-tight text-card-foreground">
					Dhan Trading
				</span>
			</div>
			<div class="flex items-center gap-2 sm:gap-4">
				{#await session then user}
					{#if user}
						<span class="hidden text-xs text-muted-foreground sm:inline-block max-w-[180px] truncate">
							{user.email}
						</span>
						{#if user.role === 'admin'}
							<a href="/admin">
								<Badge variant="outline" class="hover:bg-muted text-xs transition-colors">
									Admin
								</Badge>
							</a>
						{/if}
					{/if}
				{/await}
				<Button variant="ghost" size="sm" onclick={handleSignOut} class="text-xs sm:text-sm">
					Sign out
				</Button>
			</div>
		</div>
	</header>
	<main class="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
		{@render children()}
	</main>
</div>
