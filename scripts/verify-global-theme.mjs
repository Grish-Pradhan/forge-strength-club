/**
 * Integration check against a RUNNING LOCAL app and its Supabase project.
 * Creates two disposable accounts, briefly cycles the global theme, restores
 * the original selection, and deletes only these test accounts/audit rows.
 * Run with --browser to pause for a manual/browser UI pass before cleanup.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

nextEnv.loadEnvConfig(process.cwd());
const base = process.env.THEME_TEST_URL || 'http://localhost:3000';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local app server.');
assert(process.env.RUN_THEME_INTEGRATION === '1', 'Set RUN_THEME_INTEGRATION=1 to allow disposable fixtures and temporary theme changes.');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(url && key && secret, 'Supabase environment variables are required.');
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const publicClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const created = [];
let subscription;
let original;
let currentVersion;

async function fixture(role) {
  const email = `theme-${role}-${randomUUID()}@example.com`;
  const password = `${randomUUID()}Aa!7`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: `Theme Verification ${role}` },
  });
  assert.ifError(error);
  created.push(data.user.id);
  const updated = await admin.from('profiles').update({ role, membership_status: 'active' }).eq('id', data.user.id);
  assert.ifError(updated.error);
  const jar = new Map();
  const client = createServerClient(url, key, { cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
  } });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signedIn.error);
  return { email, password, client, cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; ') };
}

async function put(cookie, body, extra = {}) {
  return fetch(`${base}/api/admin/theme`, {
    method: 'PUT', headers: { Cookie: cookie || '', Origin: base, 'Content-Type': 'application/json', ...extra },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

try {
  const response = await fetch(`${base}/api/theme`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  original = await response.json();
  currentVersion = original.version;
  assert.deepEqual(Object.keys(original).sort(), ['theme', 'updatedAt', 'version']);
  assert.equal((await put('', { theme: 'tihar' })).status, 401);
  assert.equal((await put('', { theme: 'tihar' }, { Origin: 'https://attacker.invalid' })).status, 403);
  assert.ok((await publicClient.from('global_theme').update({ theme_key: 'tihar' }).eq('id', 1)).error);
  console.log('PASS: public no-cache read, anonymous write denial and cross-origin denial.');

  const member = await fixture('member');
  const owner = await fixture('admin');
  assert.equal((await put(member.cookie, { theme: 'tihar' })).status, 403);
  assert.ok((await member.client.from('global_theme').update({ theme_key: 'tihar' }).eq('id', 1)).error);
  assert.ok((await owner.client.from('global_theme').update({ theme_key: 'tihar' }).eq('id', 1)).error);
  assert.equal((await put(owner.cookie, { theme: 'invalid-theme' })).status, 400);
  assert.equal((await put(owner.cookie, '{broken')).status, 400);
  assert.equal((await put(owner.cookie, { theme: 'default', padding: 'x'.repeat(1100) })).status, 413);
  assert.equal((await put(owner.cookie, { theme: 'default' }, { 'Content-Type': 'text/plain' })).status, 415);
  console.log('PASS: member denial, browser DB write denial, admin input validation.');

  const events = [];
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Realtime subscription timed out')), 15_000);
    subscription = publicClient.channel(`theme-check-${randomUUID()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'global_theme', filter: 'id=eq.1' },
        ({ new: row }) => events.push(row))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') { clearTimeout(timeout); resolve(); }
        if (status === 'CHANNEL_ERROR') { clearTimeout(timeout); reject(new Error('Realtime channel error')); }
      });
  });
  for (const theme of ['dashain', 'tihar', 'christmas', 'new-year', 'default']) {
    const changed = await put(owner.cookie, { theme });
    assert.equal(changed.status, 200, await changed.clone().text());
    const snapshot = await changed.json();
    assert.ok(snapshot.version > currentVersion);
    currentVersion = snapshot.version;
    const read = await (await fetch(`${base}/api/theme`)).json();
    assert.equal(read.theme, theme);
    assert.equal(read.version, snapshot.version);
    const html = await (await fetch(base)).text();
    assert.match(html, new RegExp(`data-theme="${theme}"`));
    console.log(`PASS: ${theme} persisted, fresh API read and server-rendered HTML.`);
  }
  const deadline = Date.now() + 10_000;
  while (!events.some((event) => event.version === currentVersion) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(events.some((event) => event.version === currentVersion), 'Anonymous subscriber received the final committed revision.');
  console.log('PASS: anonymous Realtime propagation.');
  const logs = await admin.from('audit_events').select('event_type').eq('actor_id', created[1]).eq('event_type', 'global_theme_changed');
  assert.ifError(logs.error);
  assert.equal(logs.data.length, 5);
  console.log('PASS: every successful theme change is recorded in admin audit logs.');

  if (process.argv.includes('--browser')) {
    console.log('Disposable browser fixtures (removed when verification ends):');
    console.log(JSON.stringify({ admin: { email: owner.email, password: owner.password }, member: { email: member.email, password: member.password } }));
    const input = createInterface({ input: process.stdin, output: process.stdout });
    await input.question('Press Enter when browser checks are complete to restore theme and remove fixtures.');
    input.close();
  }
} finally {
  if (original) {
    const restored = await admin.from('global_theme').update({ theme_key: original.theme }).eq('id', 1);
    assert.ifError(restored.error);
  }
  if (subscription) await publicClient.removeChannel(subscription);
  if (created.length) {
    // Exact fixture IDs only; preserve all real users and historical logs.
    const deletedLogs = await admin.from('audit_events').delete().in('actor_id', created);
    assert.ifError(deletedLogs.error);
    for (const id of created) {
      const removed = await admin.auth.admin.deleteUser(id);
      assert.ifError(removed.error);
    }
  }
  console.log('Cleanup complete: original theme restored; disposable accounts and their audit records removed.');
}
