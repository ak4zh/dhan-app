<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import { me } from '$lib/remote/session.remote';
	import { Button } from '$lib/components/ui/button';
	import { buttonVariants } from '$lib/components/ui/button/button.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Sheet,
		SheetContent,
		SheetHeader,
		SheetTitle,
		SheetTrigger
	} from '$lib/components/ui/sheet';
	import MenuIcon from '@lucide/svelte/icons/menu';

	let { children } = $props();
	const session = me();
	let mobileMenuOpen = $state(false);

	async function handleSignOut() {
		await authClient.signOut();
		await goto('/login');
	}

	const navItems = [
		{ href: '/admin', label: 'Overview' },
		{ href: '/admin/members', label: 'Members' },
		{ href: '/admin/accounts', label: 'Linked Accounts' },
		{ href: '/admin/performance', label: 'Manager Performance' }
	];
</script>

<div class="min-h-screen bg-muted/20 antialiased">
	<header class="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
		<div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
			<!-- Logo -->
			<div class="flex items-center gap-2">
				<div
					class="flex size-8 items-center justify-center rounded-lg bg-primary/10 font-bold text-base text-primary"
				>
					D
				</div>
				<span class="text-base font-semibold tracking-tight text-card-foreground">
					Admin Console
				</span>
			</div>

			<!-- Desktop Nav (hidden on mobile) -->
			<nav class="hidden items-center gap-1 md:flex">
				{#each navItems as item (item.href)}
					<a
						href={item.href}
						class="rounded-md px-2.5 py-1 text-sm font-medium transition-colors
							{page.url.pathname === item.href
							? 'bg-primary/10 text-primary font-semibold'
							: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
					>
						{item.label}
					</a>
				{/each}
			</nav>

			<!-- Right side: user + actions -->
			<div class="flex items-center gap-2">
				{#await session then user}
					{#if user}
						<span class="hidden text-xs text-muted-foreground lg:inline-block">
							{user.email}
						</span>
					{/if}
				{/await}
				<a href="/">
					<Badge variant="outline" class="hover:bg-muted text-xs transition-colors">
						Member View
					</Badge>
				</a>
				<Button
					variant="ghost"
					size="sm"
					onclick={handleSignOut}
					class="hidden text-xs md:inline-flex"
				>
					Sign out
				</Button>

				<!-- Mobile hamburger -->
				<Sheet bind:open={mobileMenuOpen}>
					<SheetTrigger
						class="{buttonVariants({ variant: 'ghost', size: 'icon' })} md:hidden"
					>
						<MenuIcon class="size-5" />
						<span class="sr-only">Open menu</span>
					</SheetTrigger>
					<SheetContent side="right" class="w-72 p-6">
						<SheetHeader class="mb-6">
							<SheetTitle class="flex items-center gap-2 text-left">
								<div
									class="flex size-7 items-center justify-center rounded-lg bg-primary/10 font-bold text-sm text-primary"
								>
									D
								</div>
								Admin Console
							</SheetTitle>
						</SheetHeader>

						<nav class="flex flex-col gap-1">
							{#each navItems as item (item.href)}
								<a
									href={item.href}
									onclick={() => (mobileMenuOpen = false)}
									class="flex w-full items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors
										{page.url.pathname === item.href
										? 'bg-primary/10 text-primary font-semibold'
										: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
								>
									{item.label}
								</a>
							{/each}
						</nav>

						<div class="mt-6 border-t border-border pt-4">
							{#await session then user}
								{#if user}
									<p class="mb-3 truncate text-xs text-muted-foreground">{user.email}</p>
								{/if}
							{/await}
							<Button variant="outline" size="sm" onclick={handleSignOut} class="w-full">
								Sign out
							</Button>
						</div>
					</SheetContent>
				</Sheet>
			</div>
		</div>
	</header>
	<main class="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
		{@render children()}
	</main>
</div>
