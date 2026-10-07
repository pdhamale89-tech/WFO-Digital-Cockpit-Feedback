import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const dir = new URL('../', import.meta.url)
const db = new PGlite()

await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth; create schema storage;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
grant usage on schema public, auth, storage to anon, authenticated;
grant select, insert, delete on storage.objects to authenticated;
`)
for (const f of ['001_schema.sql', '002_rls.sql', '003_storage.sql']) await db.exec(readFileSync(new URL('migrations/' + f, dir), 'utf8'))
// default Supabase privileges for public schema
await db.exec(`grant usage on schema public to anon, authenticated; grant usage on sequence public.feedback_number_seq to authenticated;
grant all on all tables in schema public to authenticated;`)
// re-apply the RLS migration's narrower grants on top of the blanket grant (as Supabase default privileges would precede it)
await db.exec(readFileSync(new URL('migrations/002_rls.sql', dir), 'utf8'))

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${cond ? '' : extra}`) }
const as = async (uid, sql, params) => {
  await db.exec(`reset role; select set_config('request.jwt.sub', '${uid ?? ''}', false); set role authenticated;`)
  try { return { r: await db.query(sql, params) } } catch (e) { return { e: e.message } } finally { await db.exec('reset role') }
}

await db.exec(`insert into public.admin_emails values ('boss@x.com')`)
const mk = async (email) => (await db.query(`insert into auth.users (email) values ($1) returning id`, [email])).rows[0].id
const boss = await mk('boss@x.com'), alice = await mk('alice@x.com'), bob = await mk('bob@x.com')
const roles = (await db.query(`select email, role from public.profiles order by email`)).rows
ok('admin email gets admin role, others user', roles.find(r => r.email === 'boss@x.com').role === 'admin' && roles.filter(r => r.role === 'user').length === 2, JSON.stringify(roles))

const ins = (uid, extra = {}) => as(uid, `insert into public.feedback (business, component_category, card_graph_name, feedback_type, changes_required, screenshot_path, reported_by, status, owner, priority)
  values ('Remote','KPI Card','Contact Volume','Data Issue','Count differs', $1, $2, $3, $4, 'High') returning feedback_number, status, owner, reported_by_email`,
  [extra.path ?? `${uid}/a.png`, extra.by ?? uid, extra.status ?? 'Completed', extra.owner ?? 'Hacker'])
const a1 = await ins(alice)
ok('user can insert own feedback; triggers force status=New, owner=null, email from profile', a1.r?.rows[0]?.status === 'New' && a1.r.rows[0].owner === null && a1.r.rows[0].reported_by_email === 'alice@x.com', a1.e)
ok('feedback_number generated WF-0001', a1.r?.rows[0]?.feedback_number === 'WF-0001')
const imp = await ins(alice, { by: bob })
ok('user cannot impersonate another reporter (forced to own id, no error leak)', imp.r?.rows[0]?.reported_by_email === 'alice@x.com' || !!imp.e, JSON.stringify(imp))
const bad = await ins(alice, { path: `${bob}/x.png` })
ok("user cannot reference another user's screenshot path", !!bad.e, JSON.stringify(bad.r?.rows))
const nos = await as(alice, `insert into public.feedback (business, component_category, card_graph_name, feedback_type, changes_required) values ('Care','Other','x','Other','y')`)
ok('screenshot required by default', /screenshot/i.test(nos.e ?? ''), nos.e)
await ins(bob)

const sa = await as(alice, `select feedback_number from public.feedback`)
ok('user sees only own rows', sa.r.rows.length === 2 /* alice has 2 (a1 + impersonation attempt) */ && sa.r.rows.every(Boolean), JSON.stringify(sa))
const sb = await as(bob, `select reported_by from public.feedback`)
ok("bob sees none of alice's rows", sb.r.rows.every(r => r.reported_by === bob) && sb.r.rows.length === 1, JSON.stringify(sb))
const sAdmin = await as(boss, `select 1 from public.feedback`)
ok('admin sees all rows', sAdmin.r.rows.length === 3, String(sAdmin.r?.rows.length))

const u1 = await as(alice, `update public.feedback set status='Completed' where feedback_number='WF-0001' returning status`)
ok('user cannot change status of own row', !!u1.e, JSON.stringify(u1))
const u2 = await as(alice, `update public.feedback set user_comments='please check' where feedback_number='WF-0001' returning user_comments`)
ok('user can add own follow-up comment', u2.r?.rows[0]?.user_comments === 'please check', u2.e)
const u3 = await as(bob, `update public.feedback set user_comments='hax' where feedback_number='WF-0001' returning 1`)
ok("user cannot update another user's row", u3.r?.rows.length === 0, JSON.stringify(u3))
const d1 = await as(alice, `delete from public.feedback where feedback_number='WF-0001' returning 1`)
ok('user cannot delete feedback', (d1.r?.rows.length ?? 0) === 0, JSON.stringify(d1))

const p1 = await as(alice, `update public.profiles set role='admin' where id='${alice}'`)
ok('user cannot self-promote to admin', !!p1.e, JSON.stringify(p1))
const p2 = await as(alice, `insert into public.admin_emails values ('alice@x.com')`)
ok('user cannot add themselves to admin_emails', !!p2.e, JSON.stringify(p2))
const h0 = await as(alice, `select * from public.feedback_history`)
ok('user cannot read audit history', h0.r.rows.length === 0 || !!h0.e)
const st1 = await as(alice, `select public.admin_feedback_stats()`)
ok('stats RPC forbidden for users', !!st1.e)

// Admin workflow
const ad1 = await as(boss, `update public.feedback set status='In Progress', owner='QA', priority='Critical' where feedback_number='WF-0001' returning date_completed, owner`)
ok('admin can set status/owner/priority', ad1.r?.rows[0]?.owner === 'QA' && ad1.r.rows[0].date_completed === null, ad1.e)
const ad2 = await as(boss, `update public.feedback set status='Completed', resolution='Fixed' where feedback_number='WF-0001' returning date_completed`)
ok('Date Completed auto-populated on Completed', !!ad2.r?.rows[0]?.date_completed, ad2.e)
const dc = ad2.r?.rows[0]?.date_completed
const ad3 = await as(boss, `update public.feedback set status='In Progress' where feedback_number='WF-0001' returning date_completed`)
ok('reopening preserves historical Date Completed', String(ad3.r?.rows[0]?.date_completed) === String(dc), ad3.e)
const imm = await as(boss, `update public.feedback set reported_by_email='x@y.z', date_reported=now()-interval '9 days' where feedback_number='WF-0001' returning reported_by_email`)
ok('reporter/date immutable even for admin', imm.r?.rows[0]?.reported_by_email === 'alice@x.com', JSON.stringify(imm))
const hist = await as(boss, `select field_changed, old_value, new_value, changed_by from public.feedback_history order by changed_at`)
const fields = hist.r.rows.map(r => r.field_changed)
ok('audit history records status/owner/priority/resolution with actor', ['status', 'owner', 'priority', 'resolution'].every(f => fields.includes(f)) && hist.r.rows.filter(r => r.field_changed !== 'user_comments').every(r => r.changed_by === boss) && hist.r.rows.find(r => r.field_changed === 'user_comments').changed_by === alice, fields.join(','))
const st2 = await as(boss, `select public.admin_feedback_stats() s`)
ok('admin stats RPC works', st2.r?.rows[0]?.s?.total === 3, JSON.stringify(st2))
const del = await as(boss, `delete from public.feedback where feedback_number='WF-0002' returning 1`)
ok('admin can delete', (del.r?.rows.length ?? 0) === 1, JSON.stringify(del))

// Config / owners / storage
const o1 = await as(alice, `select * from public.owners`)
ok('user cannot read owners list (RLS)', o1.r.rows.length === 0)
const c1 = await as(alice, `update public.app_config set value='false'`)
ok('user cannot change app_config', (c1.r?.affectedRows ?? 0) === 0, JSON.stringify(c1))
const c2 = await as(alice, `select value from public.app_config where key='screenshot_required'`)
ok('user can read screenshot_required config', c2.r?.rows.length === 1)
await db.exec(`insert into storage.objects (bucket_id, name) values ('feedback-screenshots', '${alice}/a.png'), ('feedback-screenshots', '${bob}/b.png')`)
const s1 = await as(alice, `select name from storage.objects`)
ok("storage: user sees only own folder", s1.r.rows.length === 1 && s1.r.rows[0].name.startsWith(alice), JSON.stringify(s1))
const s2 = await as(boss, `select name from storage.objects`)
ok('storage: admin sees all', s2.r.rows.length === 2)
const s3 = await as(alice, `insert into storage.objects (bucket_id, name) values ('feedback-screenshots', '${bob}/evil.png')`)
ok("storage: user cannot upload into another user's folder", !!s3.e, JSON.stringify(s3))
const s4 = await as(alice, `delete from storage.objects where name='${alice}/a.png' returning 1`)
ok('storage: user cannot delete a screenshot attached to feedback', (s4.r?.rows.length ?? 0) === 0, JSON.stringify(s4))
const bk = (await db.query(`select public from storage.buckets where id='feedback-screenshots'`)).rows[0]
ok('bucket is private', bk.public === false)
const anon = await (async () => { await db.exec(`reset role; set role anon`); try { return await db.query(`select * from public.feedback`) } catch (e) { return { e: e.message } } finally { await db.exec('reset role') } })()
ok('anon cannot read feedback', !!anon.e, JSON.stringify(anon))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
