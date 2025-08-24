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
        todo_count?: number;
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
            .select("id,owner,name,created_at")
            .order("created_at", { ascending: false });
        if (err) {
            error = err.message;
        } else {
            lists = ((data as any[]) || []).map((row) => ({
                ...row,
                todo_count: 0,
            }));
            await loadCounts();
        }
        loading = false;
        initialized = true;
    }

    async function loadCounts() {
        if (lists.length === 0) return;
        const ids = lists.map((l) => l.id);
        const { data, error: err } = await supabase
            .from("todos")
            .select("list_id")
            .in("list_id", ids);
        if (err) return;
        const counts: Record<string, number> = {};
        for (const row of data as any[]) {
            counts[row.list_id] = (counts[row.list_id] || 0) + 1;
        }
        lists = lists.map((l) => ({ ...l, todo_count: counts[l.id] || 0 }));
    }

    async function setupRealtime() {
        if (!browser) return;
        const currentUser = get(user);
        if (!currentUser) return;
        if (channel) {
            supabase.removeChannel(channel);
            channel = null;
        }
        // Narrow filter to this user's owned lists
        channel = supabase
            .channel("lists-realtime")
            // List changes
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "lists" },
                async (payload) => {
                    try {
                        if (payload.eventType === "INSERT") {
                            const newList = {
                                ...(payload.new as any),
                                todo_count: 0,
                            } as List;
                            if (!lists.find((l) => l.id === newList.id))
                                lists = [newList, ...lists];
                        } else if (payload.eventType === "UPDATE") {
                            const updatedRaw = payload.new as any;
                            lists = lists.map((l) =>
                                l.id === updatedRaw.id
                                    ? { ...l, ...updatedRaw }
                                    : l,
                            );
                        } else if (payload.eventType === "DELETE") {
                            const deleted = payload.old as any;
                            lists = lists.filter((l) => l.id !== deleted.id);
                        }
                    } catch {}
                },
            )
            // Todo changes for counts
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "todos" },
                (payload) => {
                    try {
                        if (payload.eventType === "INSERT") {
                            const row = payload.new as any;
                            lists = lists.map((l) =>
                                l.id === row.list_id
                                    ? {
                                          ...l,
                                          todo_count: (l.todo_count || 0) + 1,
                                      }
                                    : l,
                            );
                        } else if (payload.eventType === "DELETE") {
                            const row = payload.old as any;
                            lists = lists.map((l) =>
                                l.id === row.list_id
                                    ? {
                                          ...l,
                                          todo_count: Math.max(
                                              0,
                                              (l.todo_count || 0) - 1,
                                          ),
                                      }
                                    : l,
                            );
                        } else if (payload.eventType === "UPDATE") {
                            const oldRow = payload.old as any;
                            const newRow = payload.new as any;
                            if (oldRow.list_id !== newRow.list_id) {
                                // Moved between lists
                                lists = lists.map((l) => {
                                    if (l.id === oldRow.list_id)
                                        return {
                                            ...l,
                                            todo_count: Math.max(
                                                0,
                                                (l.todo_count || 0) - 1,
                                            ),
                                        };
                                    if (l.id === newRow.list_id)
                                        return {
                                            ...l,
                                            todo_count: (l.todo_count || 0) + 1,
                                        };
                                    return l;
                                });
                            }
                        }
                    } catch {}
                },
            );

        // Subscribe and await status transition using a small promise helper
        const subscribed = await new Promise<boolean>((resolve) => {
            channel!.subscribe((status) => {
                if (status === "SUBSCRIBED") resolve(true);
                else if (status === "CHANNEL_ERROR" || status === "CLOSED")
                    resolve(false);
            });
        });
        if (!subscribed) return;
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
        return () => {
            unsubscribe();
            if (channel) supabase.removeChannel(channel);
        };
    });
</script>

<div>
    <h2>Listene dine</h2>
    {#if !$user}
    <p>Logg inn for å se listene dine.</p>
    {:else if loading && !initialized}
    <p>Laster…</p>
    {:else if error}
        <p>{error}</p>
    {:else if lists.length === 0}
    <p>Ingen lister ennå.</p>
    {:else}
        <div role="list" aria-live="polite">
            {#each lists as list (list.id)}
                <div role="listitem">
                    <a href={`/lists/${list.id}`}>
                        <article  class="list-item">
                            {list.name} 
                            <small>{list.todo_count ?? 0}</small>
                        </article>
                    </a>
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .list-item {
        display: flex;
        justify-content: space-between;
        align-items: center;

        /* Style all .list-item text except small */
        font-size: 1.2rem;
        font-weight: 600;

        small {
            color: var(--pico-muted-color);
            font-weight: 400;
        }
    }
</style>
