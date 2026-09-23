// Prototipo local: los datos y accesos se guardan solo en este navegador.
const store='cedh-vacaciones-v4';
// Datos vacíos de respaldo: los accesos y la información real viven en Supabase.
const sample={policy:{days:15,start:'2026-01-01',end:'2026-12-31'},areas:[],users:[],requests:[]};
let data=structuredClone(sample);let currentUserId=null,month=new Date(),chosen=[];
const $=s=>document.querySelector(s),save=()=>localStorage.setItem(store,JSON.stringify(data)),user=()=>data.users.find(x=>x.id===currentUserId),esc=s=>String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const role=r=>({super:'Superusuario',admin:'Administrador',employee:'Colaborador',udi:'UDI · Recursos Humanos'})[r],area=id=>data.areas.find(x=>x.id===id),adminFor=id=>data.users.find(x=>x.role==='admin'&&x.areaId===id);
function status(r){const v=Object.values(r.decisions);if(v.includes('no'))return['Rechazada','rejected'];if(v.length&&v.every(x=>x==='yes'))return['Aprobada','approved'];return['En espera','pending']}
function approvedDays(id){return data.requests.filter(r=>r.userId===id&&status(r)[1]==='approved').flatMap(r=>r.days)}function validDay(d){return d>=data.policy.start&&d<=data.policy.end}function dates(days){const f=new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric'});return days.length===1?f.format(new Date(days[0]+'T12:00:00')):`${f.format(new Date(days[0]+'T12:00:00'))} · ${days.length} días hábiles`}

// Complemento: dos periodos de vacaciones independientes.
if (!data.periods) data.periods = [
  { id: 1, name: 'Periodo 1', days: data.policy.days, start: data.policy.start, end: data.policy.end },
  { id: 2, name: 'Periodo 2', days: data.policy.days, start: '2026-07-01', end: '2026-12-31' }
];
let selectedPeriod = 1;
const period = () => data.periods.find(item => item.id === selectedPeriod);
const usePeriod = () => { data.policy = period(); };
function periodDays(userId, periodId) { return data.requests.filter(request => request.userId === userId && (request.periodId || 1) === periodId && status(request)[1] === 'approved').flatMap(request => request.days); }


// Mejoras de control de días y registro de decisiones.
if (!data.holidays) data.holidays = [];
let holidayMonth = new Date();
function isoDate(date) { return date.toISOString().slice(0,10); }
function pendingDays(userId, periodId) { return data.requests.filter(r => r.userId === userId && (r.periodId || 1) === periodId && status(r)[1] === 'pending').flatMap(r => r.days); }


function renderVacationCalendar () {
  usePeriod(); const p=period(),y=month.getFullYear(),m=month.getMonth(),first=new Date(y,m,1),offset=(first.getDay()+6)%7,total=new Date(y,m+1,0).getDate(),approved=periodDays(currentUserId,selectedPeriod),pending=pendingDays(currentUserId,selectedPeriod),today=isoDate(new Date());
  $('#period-select').innerHTML=data.periods.map(x=>`<option value="${x.id}">${x.name} · ${x.start} a ${x.end}</option>`).join('');$('#period-select').value=selectedPeriod;$('#month-label').textContent=new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric'}).format(first);let html=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(x=>`<div class="weekday">${x}</div>`).join('')+'<div class="day empty"></div>'.repeat(offset);
  for(let n=1;n<=total;n++){const date=new Date(y,m,n),d=isoDate(date),weekend=date.getDay()===0||date.getDay()===6,past=d<today,holiday=data.holidays.includes(d),isApproved=approved.includes(d),isPending=pending.includes(d),locked=weekend||past||holiday||isApproved||isPending||d<p.start||d>p.end;const cls=isApproved?'approved':isPending?'pendingday':holiday?'holiday':past?'pastday':'';html+=`<button type="button" data-day="${d}" class="day ${cls} ${chosen.includes(d)?'selected':''}" ${locked?'disabled':''}>${n}</button>`}$('#calendar').innerHTML=html;const spent=approved.length,left=p.days-spent;$('#policy-message').textContent=`${p.name}: tienes ${Math.max(left,0)} de ${p.days} días disponibles. Periodo: ${p.start} al ${p.end}.`;$('#selection-info').textContent=chosen.length?`${chosen.length} día(s) hábil(es) seleccionado(s).`:'No has elegido días todavía.';
};

function renderPeopleAndPeriods () {
  $('#p1-days').value=data.periods[0].days; $('#p1-start').value=data.periods[0].start; $('#p1-end').value=data.periods[0].end; $('#p2-days').value=data.periods[1].days; $('#p2-start').value=data.periods[1].start; $('#p2-end').value=data.periods[1].end;
  $('#policy-summary').textContent=`Periodo 1: ${data.periods[0].days} días. Periodo 2: ${data.periods[1].days} días.`;
  const opts=data.areas.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join(''); $('#new-user-area').innerHTML=`<option value="">Sin área</option>${opts}`; $('#areas-list').innerHTML=data.areas.map(a=>`<span class="area-chip">${esc(a.name)} · ${adminFor(a.id)?.name||'sin administrador'}</span>`).join('')||'<p class="empty">Aún no hay áreas.</p>'; $('#users-list').innerHTML=data.users.map(person=>`<tr><td>${esc(person.name)}</td><td>${esc(person.email)}</td><td>${role(person.role)}</td><td>${esc(area(person.areaId)?.name||'Sin área')}</td><td>${person.id!==currentUserId&&person.role!=='super'&&person.role!=='superuser'?`<button class="secondary danger" data-delete="${person.id}">Desactivar</button>`:''}</td></tr>`).join('');
};

function holidayCalendar(){const y=holidayMonth.getFullYear(),m=holidayMonth.getMonth(),first=new Date(y,m,1),offset=(first.getDay()+6)%7,total=new Date(y,m+1,0).getDate();$('#holiday-month-label').textContent=new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric'}).format(first);let html=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(x=>`<div class="weekday">${x}</div>`).join('')+'<div class="day empty"></div>'.repeat(offset);for(let n=1;n<=total;n++){const date=new Date(y,m,n),d=isoDate(date),weekend=date.getDay()===0||date.getDay()===6,marked=data.holidays.includes(d);html+=`<button type="button" data-holiday="${d}" class="day ${marked?'holiday holiday-selected':''}" ${weekend?'disabled':''}>${n}</button>`}$('#holiday-calendar').innerHTML=html}

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

function calendar() { const current = currentPeriod(); if (current) selectedPeriod = current.id; renderVacationCalendar(); const picker = $('#period-select'); picker.disabled = true; if (!current) { $('#policy-message').textContent = 'No hay un periodo de vacaciones vigente; el calendario está bloqueado.'; document.querySelectorAll('#calendar button.day').forEach(button => button.disabled = true); } };

function summary() {
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
    : '<p class="empty">Esta persona aún no tiene días aprobados.</p>';
}

function adminView() {
  const me=user(), people=data.users.filter(person=>person.role==='employee'&&person.areaId===me.areaId); $('#admin-area-label').textContent=`Área asignada: ${area(me.areaId)?.name||'Sin área'}.`;
  if (!people.length) { $('#admin-tabs').innerHTML=''; $('#admin-list').innerHTML='<p class="empty">No hay colaboradores en tu área.</p>'; $('#admin-calendar').innerHTML=''; return; }
  if (!people.some(person=>person.id===selectedEmployeeId)) selectedEmployeeId=people[0].id;
  $('#admin-tabs').innerHTML=people.map(person=>`<button type="button" data-employee="${person.id}" class="${person.id===selectedEmployeeId?'active':''}">${esc(readableName(person.name))}</button>`).join('');
  const allRequests=data.requests.filter(request=>people.some(person=>person.id===request.userId)), requests=allRequests.filter(request=>request.userId===selectedEmployeeId).sort((a,b)=>b.id-a.id);
  $('#admin-list').innerHTML=requests.length?requests.map(request=>{const [label,kind]=status(request);const pending=kind==='pending';const rejection=request.rejectReason ? `<p class="history"><strong>Motivo del rechazo:</strong> ${esc(request.rejectReason)}</p>` : '';return `<article class="request"><div class="request-head"><strong>Días solicitados: ${dates(request.days)}</strong><span class="status ${kind}">${label}</span></div>${request.note?`<p>${esc(request.note)}</p>`:''}${pending?`<div class="actions"><button class="primary" data-vote="yes" data-request="${request.id}">Sí, aprobar</button><button class="secondary danger" data-vote="no" data-request="${request.id}">Rechazar</button></div>`:rejection}</article>`;}).join(''):'<p class="empty">Esta persona no tiene solicitudes.</p>';
  renderAdminCalendar(requests);
};

$('#admin-tabs').addEventListener('click', event => { const button=event.target.closest('[data-employee]'); if(!button)return; selectedEmployeeId=button.dataset.employee; adminView(); });


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



document.addEventListener('click', event => {
  const button = event.target.closest('[data-super-area]');
  if (!button) return;
  selectedSuperAreaId = button.dataset.superArea;
  renderSuperApprovedReport();
});

function superView() { renderPeopleAndPeriods(); holidayCalendar(); renderSuperApprovedReport(); }
function render() {
 const me=user(); if(!me)return;
 $('#welcome').textContent=me.name+' · '+role(me.role);
 $('#employee-view').classList.toggle('hidden',me.role!=='employee');
 $('#admin-view').classList.toggle('hidden',me.role!=='admin');
 $('#super-view').classList.toggle('hidden',me.role!=='super');
 document.querySelector('.side').classList.toggle('hidden',me.role!=='employee');
 summary();
 if(me.role==='employee')calendar();
 if(me.role==='admin')adminView();
 if(me.role==='super')superView();
}
// Navegación local. Las escrituras de cuentas y vacaciones viven en acceso.js.
$('#previous').onclick=()=>{month.setMonth(month.getMonth()-1);calendar()};
$('#next').onclick=()=>{month.setMonth(month.getMonth()+1);calendar()};
$('#calendar').addEventListener('click',e=>{const b=e.target.closest('[data-day]');if(!b)return;const d=b.dataset.day;chosen=chosen.includes(d)?chosen.filter(x=>x!==d):[...chosen,d].sort();calendar()});
$('#clear-days').onclick=()=>{chosen=[];calendar()};
$('#period-select').addEventListener('change',e=>{selectedPeriod=e.target.value;chosen=[];render()});
$('#login-form').addEventListener('submit',e=>{e.preventDefault();$('#login-error').textContent='No se pudo conectar con el servicio de acceso. Recarga la página.';$('#login-error').classList.remove('hidden')});

$('#holiday-previous').onclick=()=>{holidayMonth.setMonth(holidayMonth.getMonth()-1);holidayCalendar()};$('#holiday-next').onclick=()=>{holidayMonth.setMonth(holidayMonth.getMonth()+1);holidayCalendar()};$('#holiday-calendar').addEventListener('click',e=>{const b=e.target.closest('[data-holiday]');if(!b)return;const d=b.dataset.holiday;data.holidays=data.holidays.includes(d)?data.holidays.filter(x=>x!==d):[...data.holidays,d];save();holidayCalendar()});
