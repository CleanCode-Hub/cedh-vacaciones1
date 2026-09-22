// Complemento: dos periodos de vacaciones independientes.
if (!data.periods) data.periods = [
  { id: 1, name: 'Periodo 1', days: data.policy.days, start: data.policy.start, end: data.policy.end },
  { id: 2, name: 'Periodo 2', days: data.policy.days, start: '2026-07-01', end: '2026-12-31' }
];
let selectedPeriod = 1;
const period = () => data.periods.find(item => item.id === selectedPeriod);
const usePeriod = () => { data.policy = period(); };
function periodDays(userId, periodId) { return data.requests.filter(request => request.userId === userId && (request.periodId || 1) === periodId && status(request)[1] === 'approved').flatMap(request => request.days); }

calendar = function () {
  usePeriod(); const p = period(), year = month.getFullYear(), number = month.getMonth(), first = new Date(year, number, 1), offset = (first.getDay() + 6) % 7, total = new Date(year, number + 1, 0).getDate(), approved = periodDays(currentUserId, selectedPeriod);
  $('#period-select').innerHTML = data.periods.map(item => `<option value="${item.id}">${item.name} · ${item.start} a ${item.end}</option>`).join(''); $('#period-select').value = selectedPeriod;
  $('#month-label').textContent = new Intl.DateTimeFormat('es-MX', { month:'long', year:'numeric' }).format(first);
  let html = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(day => `<div class="weekday">${day}</div>`).join('') + '<div class="day empty"></div>'.repeat(offset);
  for (let day = 1; day <= total; day++) { const date = new Date(year, number, day), iso = date.toISOString().slice(0,10), blocked = date.getDay() === 0 || date.getDay() === 6 || iso < p.start || iso > p.end || approved.includes(iso); html += `<button type="button" data-day="${iso}" class="day ${approved.includes(iso) ? 'approved' : ''} ${chosen.includes(iso) ? 'selected' : ''}" ${blocked ? 'disabled' : ''}>${day}</button>`; }
  $('#calendar').innerHTML = html; $('#policy-message').textContent = `${p.name}: tienes ${Math.max(p.days-approved.length,0)} de ${p.days} días disponibles. Periodo: ${p.start} al ${p.end}.`; $('#selection-info').textContent = chosen.length ? `${chosen.length} día(s) hábil(es) seleccionado(s).` : 'No has elegido días todavía.';
};
summary = function () {
  const mine = data.requests.filter(request => request.userId === currentUserId), allApproved = approvedDays(currentUserId);
  $('#pending-count').textContent = data.requests.filter(request => status(request)[1] === 'pending').length; $('#approved-count').textContent = data.requests.filter(request => status(request)[1] === 'approved').length; $('#days-count').textContent = allApproved.length;
  $('#my-balance').innerHTML = data.periods.map(item => { const spent = periodDays(currentUserId,item.id).length; return `<div><span>${item.name}</span><strong>${Math.max(item.days-spent,0)}</strong><small>restantes · ${spent} gastados</small></div>`; }).join('');
  $('#my-requests').innerHTML = mine.length ? mine.sort((a,b)=>b.id-a.id).map(request => { const [label,kind] = status(request), p = data.periods.find(item => item.id === (request.periodId || 1)); return `<article class="request"><div class="request-head"><strong>${dates(request.days)}</strong><span class="status ${kind}">${label}</span></div><small>${p?.name || 'Periodo 1'}${request.note ? ` · ${esc(request.note)}` : ''}</small></article>`; }).join('') : '<p class="empty">No hay solicitudes.</p>';
};
superView = function () {
  $('#p1-days').value=data.periods[0].days; $('#p1-start').value=data.periods[0].start; $('#p1-end').value=data.periods[0].end; $('#p2-days').value=data.periods[1].days; $('#p2-start').value=data.periods[1].start; $('#p2-end').value=data.periods[1].end;
  $('#policy-summary').textContent=`Periodo 1: ${data.periods[0].days} días. Periodo 2: ${data.periods[1].days} días.`;
  const opts=data.areas.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join(''); $('#new-user-area').innerHTML=`<option value="">Sin área</option>${opts}`; $('#areas-list').innerHTML=data.areas.map(a=>`<span class="area-chip">${esc(a.name)} · ${adminFor(a.id)?.name||'sin administrador'}</span>`).join('')||'<p class="empty">Aún no hay áreas.</p>'; $('#users-list').innerHTML=data.users.map(person=>`<tr><td>${esc(person.name)}</td><td>${esc(person.email)}</td><td>${role(person.role)}</td><td>${esc(area(person.areaId)?.name||'Sin área')}</td><td>${person.id!==currentUserId&&person.role!=='super'&&person.role!=='superuser'?`<button class="secondary danger" data-delete="${person.id}">Desactivar</button>`:''}</td></tr>`).join('');
};
render = function () { const me=user(); if(!me)return; $('#welcome').textContent=`${me.name} · ${role(me.role)}`; $('#employee-view').classList.toggle('hidden',me.role!=='employee'); $('#admin-view').classList.toggle('hidden',me.role!=='admin'); $('#super-view').classList.toggle('hidden',me.role!=='super'); summary(); if(me.role==='employee')calendar(); if(me.role==='admin')adminView(); if(me.role==='super')superView(); };
$('#period-select').addEventListener('change',event=>{selectedPeriod=Number(event.target.value);chosen=[];render()});
$('#send-request').addEventListener('click',event=>{event.stopImmediatePropagation(); const p=period(),rest=p.days-periodDays(currentUserId,p.id).length,responsible=adminFor(user().areaId); if(!chosen.length)return alert('Elige por lo menos un día hábil.'); if(chosen.length>rest)return alert(`Solo tienes ${Math.max(rest,0)} días restantes en este periodo.`); if(!responsible)return alert('El superusuario debe asignar un administrador a tu área.'); data.requests.push({id:Date.now(),userId:currentUserId,periodId:p.id,days:chosen,note:$('#request-note').value.trim(),decisions:{[responsible.id]:'pending'},log:[]});chosen=[];$('#request-note').value='';save();render()},{capture:true});
$('#policy-form').addEventListener('submit',event=>{event.stopImmediatePropagation();event.preventDefault();const f=new FormData(event.target),periods=[{id:1,name:'Periodo 1',days:Number(f.get('p1days')),start:f.get('p1start'),end:f.get('p1end')},{id:2,name:'Periodo 2',days:Number(f.get('p2days')),start:f.get('p2start'),end:f.get('p2end')}];if(periods.some(item=>item.end<item.start))return alert('Cada fecha final debe ser posterior a la inicial.');data.periods=periods;usePeriod();save();render()},{capture:true});
