<script lang="ts">
    import { onMount } from "svelte";
    import { supabase } from "$lib/supabase";
    import { user } from "$lib/stores/user";
    import { get } from "svelte/store";
    import { browser } from "$app/environment";

    type List = {
        id: string;
        owner: string;
        name: string;
        created_at: string;
    };

    let lists: List[] = [];
    let loading = true;
    let error = "";
    let initialized = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadLists() {
        const currentUser = get(user);
        if (!currentUser) {
            lists = [];
            loading = false;
            initialized = true;
            return;
        }
        loading = true;
        error = "";
        const { data, error: err } = await supabase
            .from("lists")
            .select("*")
            .order("created_at", { ascending: false });
        if (err) {
            error = err.message;
        } else {
            lists = (data as List[]) || [];
        }
        loading = false;
        initialized = true;
    }

    async function setupRealtime() {
        if (!browser) return;
        const currentUser = get(user);
        if (!currentUser) return;
        if (channel) {
            console.debug("[lists] removing previous channel");
            supabase.removeChannel(channel);
            channel = null;
        }
        console.debug("[lists] creating channel");
        // Narrow filter to this user's owned lists; if you also want shared lists via membership, add another subscription later
        channel = supabase
            .channel("lists-realtime")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "lists" },
                async (payload) => {
                    console.debug(
                        "[lists realtime event]",
                        payload.eventType,
                        payload,
                    );
                    try {
                        if (payload.eventType === "INSERT") {
                            const newList = payload.new as List;
                            if (!lists.find((l) => l.id === newList.id))
                                lists = [newList, ...lists];
                            if (lists.length === 0) await loadLists();
                        } else if (payload.eventType === "UPDATE") {
                            const updated = payload.new as List;
                            let found = false;
                            lists = lists.map((l) =>
                                l.id === updated.id
                                    ? ((found = true), updated)
                                    : l,
                            );
                            if (!found) await loadLists();
                        } else if (payload.eventType === "DELETE") {
                            const deleted = payload.old as List;
                            lists = lists.filter((l) => l.id !== deleted.id);
                        }
                    } catch (e) {
                        console.error("[lists realtime handler error]", e);
                    }
                },
            );

        // Subscribe and await status transition using a small promise helper
        const subscribed = await new Promise<boolean>((resolve) => {
            channel!.subscribe((status) => {
                console.debug("[lists channel status]", status);
                if (status === "SUBSCRIBED") resolve(true);
                else if (status === "CHANNEL_ERROR" || status === "CLOSED")
                    resolve(false);
            });
        });
        if (!subscribed) {
            console.error("[lists] failed to subscribe realtime channel");
            return;
        }
        // After successful subscribe ensure data is fresh
        await loadLists();
    }

    const unsubscribe = user.subscribe((u) => {
        loadLists();
        if (u) void setupRealtime();
        else if (channel) {
            supabase.removeChannel(channel);
            channel = null;
        }
    });

    onMount(() => {
        loadLists();

        if (get(user)) void setupRealtime();
        // Expose for quick manual retry in console
        if (browser) (window as any).debugListsResub = setupRealtime;
        return () => {
            unsubscribe();
            if (channel) supabase.removeChannel(channel);
        };
    });
</script>

<div class="user-lists">
    <h2>Your Lists</h2>
    {#if !$user}
        <p>Sign in to view your lists.</p>
    {:else if loading && !initialized}
        <p>Loading...</p>
    {:else if error}
        <p class="error">{error}</p>
    {:else if lists.length === 0}
        <p>No lists yet.</p>
    {:else}
        <ul class="lists" aria-live="polite">
            {#each lists as list (list.id)}
                <li>
                    <span class="name">{list.name}</span>
                    <time datetime={list.created_at}
                        >{new Date(list.created_at).toLocaleString()}</time
                    >
                </li>
            {/each}
        </ul>
    {/if}
</div>

<style>
    .user-lists {
        width: 100%;
        margin-top: 2rem;
    }
    .lists {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .lists li {
        padding: 0.6rem 0.75rem;
        border: 1px solid #ccc;
        border-radius: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .name {
        font-weight: 500;
    }
    .error {
        color: #d00;
    }
</style>
