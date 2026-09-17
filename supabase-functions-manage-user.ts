// Supabase Edge Function: manage-user
// Deploy this file as `manage-user`. It runs only on Supabase, never in GitHub Pages.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return reply({ error: 'Método no permitido.' }, 405);

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return reply({ error: 'Sesión no válida.' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sessionClient = createClient(url, publicKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const adminClient = createClient(url, serviceKey);
  const { data: { user: requester }, error: authError } = await sessionClient.auth.getUser();
  if (authError || !requester) return reply({ error: 'Sesión no válida.' }, 401);

  const { data: requesterProfile } = await adminClient.from('profiles').select('role,active').eq('id', requester.id).single();
  if (requesterProfile?.role !== 'superuser' || requesterProfile.active === false) return reply({ error: 'Solo el superusuario puede administrar personas.' }, 403);

  const input = await request.json().catch(() => ({}));
  const action = input.action;
  const roleMap: Record<string, string> = { super: 'superuser', superuser: 'superuser', admin: 'admin', employee: 'employee', udi: 'udi' };
  const role = roleMap[input.role];
  const areaId = input.areaId || null;
  const validRole = (value: string | undefined) => value === 'superuser' || value === 'admin' || value === 'employee' || value === 'udi';

  if (action === 'create') {
    const fullName = String(input.fullName || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');
    if (!fullName || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || !validRole(role)) return reply({ error: 'Revisa nombre, correo, contraseña (mínimo 8 caracteres) y rol.' }, 400);
    if (role === 'admin' && !areaId) return reply({ error: 'Un administrador debe tener un área asignada.' }, 400);
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
    if (createError || !created.user) return reply({ error: createError?.message || 'No fue posible crear el acceso.' }, 400);
    const { error: profileError } = await adminClient.from('profiles').insert({ id: created.user.id, full_name: fullName, email, role, area_id: areaId, active: true });
    if (profileError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      return reply({ error: profileError.message }, 400);
    }
    return reply({ ok: true, id: created.user.id });
  }

  const userId = String(input.userId || '');
  if (!userId || userId === requester.id) return reply({ error: 'No puedes eliminar tu propio acceso desde aquí.' }, 400);
  if (action === 'deactivate') {
    const { data: target, error: targetError } = await adminClient.from('profiles').select('role').eq('id', userId).single();
    if (targetError || !target) return reply({ error: 'No se encontró a la persona.' }, 404);
    if (target.role === 'superuser') return reply({ error: 'No se puede desactivar a un superusuario desde esta pantalla.' }, 400);
    const { error: profileError } = await adminClient.from('profiles').update({ active: false }).eq('id', userId);
    if (profileError) return reply({ error: profileError.message }, 400);
    const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
    return authUpdateError ? reply({ error: authUpdateError.message }, 400) : reply({ ok: true });
  }
  return reply({ error: 'Acción no válida.' }, 400);
});
