// Vista por persona para administradores y saldo del periodo vigente.
let selectedEmployeeId = null;
function readableName(value) {
  return String(value || 'Colaborador')
    .trim()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\p{L}/gu, letter => letter.toLocaleUpperCase('es-MX'));
}
function selectedDates(days) {
  const ordered = [...days].sort();
  if (!ordered.length) return 'Sin días seleccionados';
  const numbers = ordered.map(day => Number(day.slice(8, 10)));
  const month = new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(new Date(ordered[0] + 'T12:00:00'));
  const list = numbers.length === 1 ? String(numbers[0]) : `${numbers.slice(0, -1).join(', ')} y ${numbers.at(-1)}`;
  return `${list} de ${month}`;
}
dates = selectedDates;
function currentPeriod() { const today = new Date().toISOString().slice(0,10); return data.periods.find(item => today >= item.start && today <= item.end) || null; }
const previousCalendar = calendar;
calendar = function () { const current = currentPeriod(); if (current) selectedPeriod = current.id; previousCalendar(); const picker = $('#period-select'); picker.disabled = true; if (!current) { $('#policy-message').textContent = 'No hay un periodo de vacaciones vigente; el calendario está bloqueado.'; document.querySelectorAll('#calendar button.day').forEach(button => button.disabled = true); } };

summary = function () {
  const me = user(); if (me.role !== 'employee') return;
  const active = currentPeriod() || period();
  const pending = pendingDays(currentUserId, active.id).length, approved = periodDays(currentUserId, active.id).length, remaining = Math.max(active.days - approved, 0);
  $('#pending-count').textContent = pending; $('#approved-count').textContent = approved; $('#days-count').textContent = remaining;
  $('#my-balance').innerHTML = `<div><span>${active.name}</span><strong>${remaining}</strong><small>días hábiles restantes · ${approved} aprobados</small></div>`;
  const mine = data.requests.filter(request => request.userId === currentUserId && (request.periodId || 1) === active.id);
  $('#my-requests').innerHTML = mine.length ? mine.sort((a,b)=>b.id-a.id).map(request => { const [label,kind]=status(request); return `<article class="request"><div class="request-head"><strong>${dates(request.days)}</strong><span class="status ${kind}">${label}</span></div><small>${request.note ? esc(request.note) : ''}${request.rejectReason ? ` · Motivo: ${esc(request.rejectReason)}` : ''}</small></article>`; }).join('') : '<p class="empty">No hay solicitudes en este periodo.</p>';
};

function renderAdminCalendar(requests) {
  const approved = requests.filter(request => status(request)[1] === 'approved');
  $('#admin-calendar').innerHTML = approved.length
    ? `<div class="approved-days-list">${approved.map(request => {
      const person = data.users.find(item => item.id === request.userId);
      return `<article class="approved-days-item"><strong>${esc(readableName(person?.name))}</strong><span>${dates(request.days)}</span></article>`;
    }).join('')}</div>`
    : '<p class="empty">Aún no hay días aprobados en esta área.</p>';
}

adminView = function () {
  const me=user(), people=data.users.filter(person=>person.role==='employee'&&person.areaId===me.areaId); $('#admin-area-label').textContent=`Área asignada: ${area(me.areaId)?.name||'Sin área'}.`;
  if (!people.length) { $('#admin-tabs').innerHTML=''; $('#admin-list').innerHTML='<p class="empty">No hay colaboradores en tu área.</p>'; $('#admin-calendar').innerHTML=''; return; }
  if (!people.some(person=>person.id===selectedEmployeeId)) selectedEmployeeId=people[0].id;
  $('#admin-tabs').innerHTML=people.map(person=>`<button type="button" data-employee="${person.id}" class="${person.id===selectedEmployeeId?'active':''}">${esc(readableName(person.name))}</button>`).join('');
  const allRequests=data.requests.filter(request=>people.some(person=>person.id===request.userId)), requests=allRequests.filter(request=>request.userId===selectedEmployeeId).sort((a,b)=>b.id-a.id);
  $('#admin-list').innerHTML=requests.length?requests.map(request=>{const [label,kind]=status(request);const pending=kind==='pending';const rejection=request.rejectReason ? `<p class="history"><strong>Motivo del rechazo:</strong> ${esc(request.rejectReason)}</p>` : '';return `<article class="request"><div class="request-head"><strong>Días solicitados: ${dates(request.days)}</strong><span class="status ${kind}">${label}</span></div>${request.note?`<p>${esc(request.note)}</p>`:''}${pending?`<div class="actions"><button class="primary" data-vote="yes" data-request="${request.id}">Sí, aprobar</button><button class="secondary danger" data-vote="no" data-request="${request.id}">Rechazar</button></div>`:rejection}</article>`;}).join(''):'<p class="empty">Esta persona no tiene solicitudes.</p>';
  renderAdminCalendar(allRequests);
};

$('#admin-tabs').addEventListener('click', event => { const button=event.target.closest('[data-employee]'); if(!button)return; selectedEmployeeId=button.dataset.employee; adminView(); });
const priorRender = render;
render = function () { priorRender(); document.querySelector('.side').classList.toggle('hidden', user()?.role !== 'employee'); };

let selectedSuperAreaId = null;
function renderSuperApprovedReport() {
  let report = $('#super-approved-report');
  if (!report) {
    report = document.createElement('section');
    report.id = 'super-approved-report';
    report.className = 'card super-users';
    report.innerHTML = '<h2>Vacaciones aprobadas</h2><p>Consulta informativa por área y persona. Este registro no modifica solicitudes.</p>';
    $('#super-view').append(report);
  }
  const areas = data.areas;
  if (!areas.length) { report.innerHTML = '<h2>Vacaciones aprobadas</h2><p class="empty">Aún no hay áreas registradas.</p>'; return; }
  if (!areas.some(item => item.id === selectedSuperAreaId)) selectedSuperAreaId = areas[0].id;
  const approved = data.requests.filter(request => status(request)[1] === 'approved' && request.areaId === selectedSuperAreaId);
  const items = approved.length ? approved.map(request => {
    const person = data.users.find(item => item.id === request.userId);
    return `<article class="super-approved-item"><strong>${esc(readableName(person?.name))}</strong><span>${dates(request.days)}</span></article>`;
  }).join('') : '<p class="empty">No hay días aprobados en esta área.</p>';
  report.innerHTML = `<h2>Vacaciones aprobadas</h2><p>Consulta informativa por área y persona. Este registro no modifica solicitudes.</p><div class="admin-tabs super-area-tabs">${areas.map(item => `<button type="button" data-super-area="${item.id}" class="${item.id === selectedSuperAreaId ? 'active' : ''}">${esc(item.name)}</button>`).join('')}</div><div class="super-approved-list">${items}</div>`;
}

const previousSuperView = superView;
superView = function () { previousSuperView(); renderSuperApprovedReport(); };

document.addEventListener('click', event => {
  const button = event.target.closest('[data-super-area]');
  if (!button) return;
  selectedSuperAreaId = button.dataset.superArea;
  renderSuperApprovedReport();
});
