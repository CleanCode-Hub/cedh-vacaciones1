// Conexión pública a Supabase. La seguridad real se aplica con Auth y RLS.
const cloud = window.supabase.createClient(
  'https://rwokuykwqkkseomawzps.supabase.co',
  'sb_publishable_POSuwqj010nJ8Nzdn9YwQQ_sXtiwg9n'
);

async function loadCloudData() {
  const { data: sessionData } = await cloud.auth.getUser();
  if (!sessionData.user) return false;
  const id = sessionData.user.id;
  const [profileResult, areaResult, periodResult, holidayResult, requestResult] = await Promise.all([
    cloud.from('profiles').select('*').eq('id', id).single(),
    cloud.from('areas').select('*').order('name'),
    cloud.from('vacation_periods').select('*').order('starts_on'),
    cloud.from('holidays').select('*').order('holiday_date'),
    cloud.from('vacation_requests').select('*, request_days(vacation_date), approval_audit(*)').order('created_at', { ascending: false })
  ]);
  if (profileResult.error) throw new Error('No se encontró el perfil de acceso.');
  const profile = profileResult.data;
  const profilesResult = await cloud.from('profiles').select('*').order('full_name');
  const periods = periodResult.data || [];
  data = {
    policy: periods[0] ? { days: periods[0].business_days, start: periods[0].starts_on, end: periods[0].ends_on } : { days: 0, start: '2099-01-01', end: '2099-01-01' },
    periods: periods.map((item, index) => ({ id: item.id, name: item.name || `Periodo ${index + 1}`, days: item.business_days, start: item.starts_on, end: item.ends_on })),
    areas: (areaResult.data || []).map(item => ({ id: item.id, name: item.name })),
    holidays: (holidayResult.data || []).map(item => item.holiday_date),
    users: (profilesResult.data || [profile]).map(item => ({ id: item.id, name: item.full_name, email: item.id === profile.id ? sessionData.user.email : '', role: item.role === 'superuser' ? 'super' : item.role, areaId: item.area_id })),
    requests: (requestResult.data || []).map(item => ({ id: item.id, userId: item.employee_id, areaId: item.area_id, periodId: item.period_id, days: (item.request_days || []).map(day => day.vacation_date), note: item.note || '', decisions: { [item.reviewed_by || 'pending']: item.status === 'approved' ? 'yes' : item.status === 'rejected' ? 'no' : 'pending' }, log: (item.approval_audit || []).map(audit => ({ adminName: 'Administrador', decision: audit.action === 'approved' ? 'yes' : 'no', date: audit.created_at.slice(0, 10) })), rejectReason: item.rejection_reason || '' }))
  };
  currentUserId = id;
  selectedPeriod = data.periods[0]?.id || 1;
  return true;
}

async function showCloudSession() {
  await loadCloudData();
  document.getElementById('login-screen').classList.add('hidden');
  render();
}

document.getElementById('login-form').addEventListener('submit', async event => {
  event.preventDefault(); event.stopImmediatePropagation();
  const form = new FormData(event.target);
  const { error } = await cloud.auth.signInWithPassword({ email: form.get('email').trim(), password: form.get('password') });
  if (error) { document.getElementById('login-error').textContent = 'Correo o contraseña incorrectos.'; document.getElementById('login-error').classList.remove('hidden'); return; }
  try { await showCloudSession(); } catch (loadError) { document.getElementById('login-error').textContent = loadError.message; document.getElementById('login-error').classList.remove('hidden'); }
}, true);

document.getElementById('logout').addEventListener('click', async event => {
  event.stopImmediatePropagation(); await cloud.auth.signOut(); currentUserId = null; document.getElementById('login-screen').classList.remove('hidden');
}, true);

cloud.auth.getSession().then(({ data: { session } }) => { if (session) showCloudSession().catch(() => {}); });

// Crear y eliminar personas pasa por una función segura del servidor.
async function manageCloudUser(payload) {
  const { data, error } = await cloud.functions.invoke('manage-user', { body: payload });
  if (error) {
    // Las funciones devuelven el detalle en la respuesta incluso cuando el
    // navegador solo muestra un error HTTP genérico.
    let message = error.message || 'No se pudo completar la operación.';
    try {
      const detail = await error.context?.json();
      message = detail?.error || message;
    } catch (_) {}
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

document.getElementById('add-user').addEventListener('submit', async event => {
  event.preventDefault(); event.stopImmediatePropagation();
  const form = new FormData(event.target);
  try {
    await manageCloudUser({ action: 'create', fullName: form.get('name'), email: form.get('email'), password: form.get('password'), role: form.get('role'), areaId: form.get('area') || null });
    event.target.reset(); await showCloudSession(); alert('La persona fue creada correctamente.');
  } catch (error) { alert(error.message); }
}, true);

document.getElementById('users-list').addEventListener('click', async event => {
  const button = event.target.closest('[data-delete]');
  if (!button) return;
  event.stopImmediatePropagation();
  const person = data.users.find(item => String(item.id) === String(button.dataset.delete));
  if (!person || !confirm(`¿Quitar a ${person.name}? Esta acción eliminará su acceso.`)) return;
  try { await manageCloudUser({ action: 'delete', userId: person.id }); await showCloudSession(); }
  catch (error) { alert(error.message); }
}, true);

// Las solicitudes se guardan en Supabase para que el administrador del área
// pueda verlas desde su propia sesión, no solamente en el navegador del colaborador.
document.getElementById('send-request').onclick = async event => {
  event.stopImmediatePropagation();
  const activePeriod = data.periods.find(item => String(item.id) === String(selectedPeriod)) || data.periods[0];
  const available = Math.max((activePeriod?.days || 0) - periodDays(currentUserId, activePeriod?.id).length, 0);
  if (!chosen.length) return alert('Elige por lo menos un día hábil.');
  if (chosen.length > available) return alert(`Solo tienes ${available} días restantes.`);
  const me = user();
  if (!me?.areaId || !activePeriod) return alert('Tu perfil no tiene área o periodo asignado.');
  const { data: request, error } = await cloud.from('vacation_requests').insert({
    employee_id: currentUserId, area_id: me.areaId, period_id: activePeriod.id,
    note: document.getElementById('request-note').value.trim()
  }).select().single();
  if (error) return alert(error.message);
  const { error: daysError } = await cloud.from('request_days').insert(chosen.map(vacation_date => ({ request_id: request.id, vacation_date })));
  if (daysError) return alert(daysError.message);
  chosen = []; document.getElementById('request-note').value = '';
  await showCloudSession();
  alert('Solicitud enviada al administrador de tu área.');
};

// Operaciones del superusuario que ya persisten en la base de datos.
document.getElementById('add-area').addEventListener('submit', async event => {
  event.preventDefault(); event.stopImmediatePropagation();
  const name = new FormData(event.target).get('area').trim();
  const { error } = await cloud.from('areas').insert({ name });
  if (error) return alert(error.message);
  event.target.reset(); await showCloudSession();
}, true);

document.getElementById('policy-form').addEventListener('submit', async event => {
  event.preventDefault(); event.stopImmediatePropagation();
  const form = new FormData(event.target);
  const rows = [
    { id: data.periods[0]?.id, name: 'Periodo 1', business_days: Number(form.get('p1days')), starts_on: form.get('p1start'), ends_on: form.get('p1end'), active: true },
    { id: data.periods[1]?.id, name: 'Periodo 2', business_days: Number(form.get('p2days')), starts_on: form.get('p2start'), ends_on: form.get('p2end'), active: true }
  ];
  if (rows.some(row => row.ends_on < row.starts_on)) return alert('Cada fecha final debe ser posterior a la inicial.');
  const { error } = await cloud.from('vacation_periods').upsert(rows);
  if (error) return alert(error.message);
  await showCloudSession();
}, true);
