<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
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

	const navItems = [
		{ href: '/admin', label: 'Overview' },
		{ href: '/admin/accounts', label: 'Linked Accounts' }
	];
</script>

<div class="min-h-screen bg-muted/20 antialiased">
	<header class="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
		<div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
			<div class="flex items-center gap-4">
				<div class="flex items-center gap-2">
					<div class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-base">
						D
					</div>
					<span class="text-base font-semibold tracking-tight text-card-foreground">
						Admin Console
					</span>
				</div>
				<nav class="flex items-center gap-1 sm:gap-2">
					{#each navItems as item (item.href)}
						<a
							href={item.href}
							class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:text-sm
								{page.url.pathname === item.href
									? 'bg-primary/10 text-primary font-semibold'
									: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
						>
							{item.label}
						</a>
					{/each}
				</nav>
			</div>
			<div class="flex items-center gap-2 sm:gap-3">
				{#await session then user}
					{#if user}
						<span class="hidden text-xs text-muted-foreground md:inline-block">
							{user.email}
						</span>
					{/if}
				{/await}
				<a href="/">
					<Badge variant="outline" class="hover:bg-muted text-xs transition-colors">
						Member View
					</Badge>
				</a>
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
