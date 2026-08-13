<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";
	import { tv, type VariantProps } from "tailwind-variants";

	export const badgeVariants = tv({
		base: "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
		variants: {
			variant: {
				default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
				secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
				destructive: "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
				outline: "text-foreground",
				success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
				danger: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400"
			}
		},
		defaultVariants: {
			variant: "default"
		}
	});

	export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

	let {
		ref = $bindable(null),
		class: className,
		variant = "default",
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & { variant?: BadgeVariant } = $props();
</script>

<div
	bind:this={ref}
	data-slot="badge"
	class={cn(badgeVariants({ variant }), className)}
	{...restProps}
>
	{@render children?.()}
</div>
