<script lang="ts">
	import "../app.css";
	import { page } from "$app/stores";
	import { webVitals } from "$lib/vitals";

	let { data, children } = $props();

	$effect(() => {
		const id = (data as any)?.analyticsId;
		if (id) {
			webVitals({
				path: $page.url.pathname,
				params: $page.params,
				analyticsId: id as string,
			});
		}
	});
</script>

<main class="container">
	{@render children()}
</main>
