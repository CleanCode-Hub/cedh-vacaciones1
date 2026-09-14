// Vista por persona para administradores y saldo del periodo vigente.
let selectedEmployeeId = null;
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
      return `<article class="approved-days-item"><strong>${esc(person?.name || 'Colaborador')}</strong><span>${dates(request.days)}</span></article>`;
    }).join('')}</div>`
    : '<p class="empty">Aún no hay días aprobados en esta área.</p>';
}

adminView = function () {
  const me=user(), people=data.users.filter(person=>person.role==='employee'&&person.areaId===me.areaId); $('#admin-area-label').textContent=`Área asignada: ${area(me.areaId)?.name||'Sin área'}.`;
  if (!people.length) { $('#admin-tabs').innerHTML=''; $('#admin-list').innerHTML='<p class="empty">No hay colaboradores en tu área.</p>'; $('#admin-calendar').innerHTML=''; return; }
  if (!people.some(person=>person.id===selectedEmployeeId)) selectedEmployeeId=people[0].id;
  $('#admin-tabs').innerHTML=people.map(person=>`<button type="button" data-employee="${person.id}" class="${person.id===selectedEmployeeId?'active':''}">${esc(person.name)}</button>`).join('');
  const allRequests=data.requests.filter(request=>people.some(person=>person.id===request.userId)), requests=allRequests.filter(request=>request.userId===selectedEmployeeId).sort((a,b)=>b.id-a.id);
  $('#admin-list').innerHTML=requests.length?requests.map(request=>{const [label,kind]=status(request),days=request.days.map(day=>new Date(day+'T12:00:00').getDate()).join(', '),log=request.log?.[0];return `<article class="request"><div class="request-head"><strong>Días: ${days}</strong><span class="status ${kind}">${label}</span></div><p class="admin-list-days">${dates(request.days)}</p>${request.note?`<p>${esc(request.note)}</p>`:''}${request.decisions[me.id]==='pending'?`<div class="actions"><button class="primary" data-vote="yes" data-request="${request.id}">Sí, aprobar</button><button class="secondary danger" data-vote="no" data-request="${request.id}">Rechazar</button></div>`:log?`<p class="history"><strong>${esc(log.adminName)}</strong> ${log.decision==='yes'?'aprobó':'rechazó'} el ${log.date}.${request.rejectReason?` Motivo: ${esc(request.rejectReason)}`:''}</p>`:''}</article>`;}).join(''):'<p class="empty">Esta persona no tiene solicitudes.</p>';
  renderAdminCalendar(allRequests);
};

$('#admin-tabs').addEventListener('click', event => { const button=event.target.closest('[data-employee]'); if(!button)return; selectedEmployeeId=Number(button.dataset.employee); adminView(); });
const priorRender = render;
render = function () { priorRender(); document.querySelector('.side').classList.toggle('hidden', user()?.role !== 'employee'); };
