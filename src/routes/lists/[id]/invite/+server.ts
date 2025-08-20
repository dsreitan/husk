import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

// Uses service role key for privileged email lookup & membership insert (must NOT be exposed to client)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY; // set in server env (no VITE_)
const anonKey = process.env.VITE_SUPABASE_ANON_KEY; // for owner validation

export const POST: RequestHandler = async ({ params, request, locals }) => {
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.log(supabaseUrl, serviceRoleKey, anonKey);
    return json({ error: 'Server not configured' }, { status: 500 });
  }
  const { id: list_id } = params;
  if (!list_id) {return json({ error: 'Missing list id' }, { status: 400 });}

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }
  const email = (body?.email || '').trim().toLowerCase();
  const role = (body?.role || 'viewer');
  if (!email) {return json({ error: 'Email required' }, { status: 400 });}
  if (!['viewer', 'editor', 'owner'].includes(role)) {return json({ error: 'Bad role' }, { status: 400 });}

  // Identify requester
  let requester = (locals as any).user as { id: string; email: string } | undefined;
  if (!requester) {
    const auth = request.headers.get('authorization');
    if (auth?.startsWith('Bearer ')) {
      try {
        const token = auth.slice(7);
        const anon = createClient(supabaseUrl, anonKey);
        const { data } = await anon.auth.getUser(token);
        if (data?.user) {requester = { id: data.user.id, email: data.user.email! };}
      } catch { /* ignore */ }
    }
  }
  if (!requester) {return json({ error: 'Unauthorized' }, { status: 401 });}

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Email lookup: list users and filter (paginate first page only for simplicity)
  const { data: usersPage, error: usersErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (usersErr) {return json({ error: usersErr.message }, { status: 400 });}
  const invitedUser = usersPage.users.find(u => u.email?.toLowerCase() === email);
  if (!invitedUser) {return json({ error: 'User not found' }, { status: 404 });}

  const invitedId = invitedUser.id;
  if (invitedId === requester.id) {return json({ error: 'Cannot invite yourself' }, { status: 400 });}

  // Existing membership?
  const { data: existing } = await admin.from('list_members').select('id, role').eq('list_id', list_id).eq('user_id', invitedId).maybeSingle();
  if (existing) {return json({ message: 'Already member', membership: existing }, { status: 200 });}

  const { data: inserted, error: insErr } = await admin.from('list_members').insert({ list_id, user_id: invitedId, role }).select('*').single();
  if (insErr) {return json({ error: insErr.message }, { status: 400 });}

  return json({ membership: inserted }, { status: 201 });
};