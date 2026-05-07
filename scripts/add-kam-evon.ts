/**
 * Add Evon Lew as a second KAM.
 *
 * Run:  npm run add:evon
 *
 * Idempotent: re-running it just resets the password and ensures the profile is correct.
 * Does NOT touch existing clients, jobs, or submissions.
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const NEW_USER = {
  email: 'evon@rncare.demo',
  full_name: 'Evon Lew',
  role: 'kam' as const,
  password: 'demo1234',
};

async function main() {
  console.log(`Adding KAM: ${NEW_USER.full_name} <${NEW_USER.email}>`);

  // Find or create auth user
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  let userId = list?.users.find((u) => u.email === NEW_USER.email)?.id;

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: NEW_USER.email,
      password: NEW_USER.password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user!.id;
    console.log('  + auth user created');
  } else {
    await supabase.auth.admin.updateUserById(userId, { password: NEW_USER.password });
    console.log('  ~ auth user already exists; password reset');
  }

  const { error: pErr } = await supabase.from('profiles').upsert({
    id: userId,
    full_name: NEW_USER.full_name,
    role: NEW_USER.role,
    email: NEW_USER.email,
  });
  if (pErr) throw pErr;
  console.log('  + profile upserted');

  console.log('\nDone. Login with:');
  console.log(`  Email:    ${NEW_USER.email}`);
  console.log(`  Password: ${NEW_USER.password}`);
  console.log('  Role:     KAM');
  console.log('\nEvon will see her own (empty) Desk. To give her clients, edit any client and');
  console.log('change the Key Account Manager dropdown — or run this SQL in Supabase:');
  console.log(`
  update clients
  set kam_id = (select id from profiles where email = 'evon@rncare.demo')
  where name in ('Camden Medical Centre');
  `);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
