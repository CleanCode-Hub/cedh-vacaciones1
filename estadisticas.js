// Estadísticas de solo lectura. Las consultas conservan las políticas RLS de Supabase.
const vacationStatistics = (() => {
 const labels={pending:'Pendientes',approved:'Aprobadas',rejected:'Rechazadas',cancellation_pending:'Cancelación pendiente',cancelled:'Canceladas'};
 const localDate=value=>{if(!value)return null;const d=new Date(value);return Number.isNaN(d.valueOf())?null:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Monterrey',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);};
 const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(new Date(s+'T12:00:00Z').valueOf())&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
 const shift=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
 const monday=s=>shift(s,-((new Date(s+'T12:00:00Z').getUTCDay()+6)%7));
 function preset(kind,today=localDate(new Date())){
  const start=today.slice(0,7)+'-01';
  if(kind==='week')return {from:monday(today),to:shift(monday(today),6)};
  if(kind==='lastweek')return {from:shift(monday(today),-7),to:shift(monday(today),-1)};
  if(kind==='lastmonth'){const last=shift(start,-1);return {from:last.slice(0,7)+'-01',to:last};}
  if(kind==='year')return {from:today.slice(0,4)+'-01-01',to:today.slice(0,4)+'-12-31'};
  const d=new Date(start+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);
  return {from:start,to:shift(d.toISOString().slice(0,10),-1)};
 }
 function aggregate(requests,filters){
  const {from,to,area='all',state='all',basis='vacation',group='month'}=filters;
  if(!validDate(from)||!validDate(to)||from>to)throw new Error('Revisa las fechas: Desde debe ser anterior o igual a Hasta.');
  if((new Date(to)-new Date(from))/86400000>3660)throw new Error('Elige un rango de hasta 10 años para la comparación.');
  const counts=Object.fromEntries(Object.keys(labels).map(s=>[s,0]));
  const selected=[],areas=new Map(),buckets=new Map(),people=new Set(),occupied=new Set();
  let days=0,cancelledDays=0,missing=0;
  const bucketKey=date=>group==='week'?monday(date):date.slice(0,7);
  for(let date=from;date<=to;date=shift(date,1)){const key=bucketKey(date);if(!buckets.has(key))buckets.set(key,{key,ids:new Set(),days:0});}
  const inRange=date=>date&&date>=from&&date<=to;
  for(const r of requests){
   if(area!=='all'&&r.area_id!==area||state!=='all'&&r.status!==state)continue;
   const allDays=[...new Set((r.request_days||[]).map(d=>d.vacation_date).filter(validDate))].sort();
   let dates;
   if(basis==='vacation')dates=allDays.filter(inRange);
   else if(basis==='created') {const date=localDate(r.created_at);if(!date)missing++;dates=inRange(date)?[date]:[];}
   else {if(r.status!=='cancelled')continue;const date=localDate(r.cancellation_resolved_at||r.cancellation_requested_at);if(!date)missing++;dates=inRange(date)?[date]:[];}
   if(!dates.length)continue;
   const scopedDays=basis==='vacation'?dates:allDays;
   counts[r.status]=(counts[r.status]||0)+1;selected.push(r);people.add(r.employee_id);days+=scopedDays.length;
   if(r.status==='cancelled')cancelledDays+=scopedDays.length;
   if(['approved','cancellation_pending'].includes(r.status))scopedDays.forEach(d=>occupied.add(r.employee_id+':'+d));
   const areaKey=r.area_id||'none';
   if(!areas.has(areaKey))areas.set(areaKey,{id:areaKey,total:0,pending:0,approved:0,cancellation_pending:0,cancelled:0,rejected:0,days:0});
   const a=areas.get(areaKey);a.total++;a[r.status]=(a[r.status]||0)+1;a.days+=scopedDays.length;
   const perRequest=new Set();
   for(const date of dates){const b=buckets.get(bucketKey(date));if(!b)continue;b.ids.add(r.id);if(basis==='vacation')b.days++;else if(!perRequest.has(b.key)){b.days+=scopedDays.length;perRequest.add(b.key);}}
  }
  return {total:selected.length,counts,people:people.size,days,occupiedDays:occupied.size,cancelledDays,missing,cancellationRate:selected.length?Math.round(counts.cancelled/selected.length*1000)/10:null,areas:[...areas.values()],trend:[...buckets.values()].map(b=>({key:b.key,total:b.ids.size,days:b.days}))};
 }
 return {labels,localDate,validDate,shift,monday,preset,aggregate};
})();

const statsFilters={...vacationStatistics.preset('month'),area:'all',state:'all',basis:'vacation',group:'week',preset:'month'};
let statisticsOwner=null;
function statisticsRoot(){let root=document.getElementById('statistics-view');if(!root){root=document.createElement('section');root.id='statistics-view';root.hidden=true;(document.getElementById('udi-view')||document.getElementById('super-view')).after(root);}return root;}
function renderVacationStatistics(){
 const root=statisticsRoot();
 if(!['udi','super'].includes(user()?.role)){root.hidden=true;root.innerHTML='';return;}
 if(statisticsOwner!==currentUserId){statisticsOwner=currentUserId;Object.assign(statsFilters,{...vacationStatistics.preset('month'),area:'all',state:'all',basis:'vacation',group:'week',preset:'month'});}
 if(udi.error||!udi.loadedAt){root.innerHTML='<section class="card"><h2>Estadísticas</h2><p role="alert">No se pudieron cargar los datos completos. No se muestran totales parciales.</p><button type="button" class="secondary" data-statistics-refresh>Volver a intentar</button></section>';return;}
 const options=(values,current)=>values.map(([id,text])=>`<option value="${esc(id)}" ${id===current?'selected':''}>${esc(text)}</option>`).join('');
 let result,error;
 try{result=vacationStatistics.aggregate(udi.requests,statsFilters);}catch(e){error=e.message;}
 const f=statsFilters;
 const header=`<div class="statistics-heading"><div><p class="eyebrow">VACACIONES Y SOLICITUDES</p><h2>Estadísticas</h2><p>Consulta la actividad y planea la cobertura por área.</p></div><button type="button" class="secondary" data-statistics-refresh>Actualizar datos</button></div>
 <section class="card statistics-filters" aria-label="Filtros de estadísticas">
 <label>Área<select data-stat-filter="area">${options([['all','Todas las áreas'],...data.areas.map(a=>[a.id,a.name])],f.area)}</select></label>
 <label>Consultar por<select data-stat-filter="basis">${options([['vacation','Fechas de vacaciones'],['created','Fecha de solicitud'],['cancelled','Fecha de cancelación efectiva']],f.basis)}</select></label>
 <label>Rango rápido<select data-stat-filter="preset">${options([['week','Esta semana'],['lastweek','Semana anterior'],['month','Este mes'],['lastmonth','Mes anterior'],['year','Este año'],['custom','Personalizado']],f.preset)}</select></label>
 <label>Desde<input type="date" data-stat-filter="from" value="${esc(f.from)}" required></label><label>Hasta<input type="date" data-stat-filter="to" value="${esc(f.to)}" required></label>
 <label>Estado<select data-stat-filter="state" ${f.basis==='cancelled'?'disabled':''}>${options([['all','Todos los estados'],...Object.entries(vacationStatistics.labels)],f.state)}</select></label>
 <label>Agrupar tendencia<select data-stat-filter="group">${options([['week','Por semana'],['month','Por mes']],f.group)}</select></label></section>`;
 if(error){root.innerHTML=header+`<p role="alert" class="notice">${esc(error)}</p>`;return;}
 const n=value=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:1}).format(value);
 const basisText=f.basis==='vacation'?'Se incluyen solicitudes con al menos un día de vacaciones en el rango. Solo se suman sus días dentro del rango.':f.basis==='created'?'Se incluyen solicitudes creadas en el rango. Los días corresponden a la solicitud completa, aunque se disfruten fuera del rango.':'Se incluyen cancelaciones efectivas realizadas en el rango, con todos los días de cada solicitud cancelada.';
 const metrics=[['Solicitudes',result.total],['Personas con solicitudes',result.people],['Pendientes',result.counts.pending],['Aprobadas',result.counts.approved],['Cancelación pendiente',result.counts.cancellation_pending],['Canceladas',result.counts.cancelled],['Rechazadas',result.counts.rejected],['Días en solicitudes',result.days],['Días-persona vigentes',result.occupiedDays],['Días en cancelaciones',result.cancelledDays]];
 const max=Math.max(1,...result.trend.map(b=>b.total));
 const areaName=id=>data.areas.find(a=>a.id===id)?.name||'Área no disponible';
 root.innerHTML=header+`<p class="notice">${basisText} Los estados son los actuales; esta vista no reconstruye el estado que tenían en una fecha pasada.</p>
 <div class="statistics-metrics">${metrics.map(([label,value])=>`<article class="card"><span>${label}</span><strong>${n(value)}</strong></article>`).join('')}</div>
 <p class="statistics-caption" role="status">${result.total?n(result.total)+' solicitudes coinciden con los filtros.':'No hay solicitudes que coincidan con los filtros.'} Canceladas del total filtrado: <strong>${result.cancellationRate===null?'—':n(result.cancellationRate)+' %'}</strong>.</p>
 ${result.missing?`<p role="status">${n(result.missing)} registros sin fecha disponible no pudieron incluirse en este criterio.</p>`:''}
 <section class="card"><h3>Solicitudes ${f.group==='week'?'por semana':'por mes'}</h3><p>${f.group==='week'?'Semanas de lunes a domingo; la etiqueta indica el lunes.':'Meses calendario.'} ${f.basis==='vacation'?'Una solicitud puede aparecer en varios grupos si sus días abarcan semanas o meses distintos.':''}</p>
 <div class="statistics-trend">${result.trend.map(b=>`<div class="statistics-bar-row"><span>${esc(b.key)}</span><div class="statistics-track" aria-hidden="true"><i style="width:${b.total/max*100}%"></i></div><strong>${n(b.total)}</strong></div>`).join('')}</div></section>
 <section class="card"><h3>Comparación por área</h3><div class="statistics-table"><table><caption>Solicitudes según los filtros seleccionados</caption><thead><tr><th scope="col">Área</th><th scope="col">Total</th><th scope="col">Pendientes</th><th scope="col">Aprobadas</th><th scope="col">Cancelación pendiente</th><th scope="col">Canceladas</th><th scope="col">Rechazadas</th><th scope="col">Días en solicitudes</th></tr></thead><tbody>${result.areas.sort((a,b)=>b.total-a.total||areaName(a.id).localeCompare(areaName(b.id),'es')).map(a=>`<tr><th scope="row">${esc(areaName(a.id))}</th>${[a.total,a.pending,a.approved,a.cancellation_pending,a.cancelled,a.rejected,a.days].map(v=>`<td>${n(v)}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="8">Sin solicitudes en este rango.</td></tr>'}</tbody></table></div></section>
 <details class="card statistics-notes"><summary>Cómo se calculan estas estadísticas</summary><p>El área es la registrada en la solicitud, aunque la persona cambie de área. Se conserva el historial de personas desactivadas.</p><p>Días en solicitudes suma los días de cada solicitud una vez. Puede incluir fechas repetidas entre solicitudes distintas. Días-persona vigentes cuenta cada persona y fecha una sola vez entre aprobadas y cancelaciones pendientes. Estos días siguen ocupados hasta autorizar la cancelación. Días en cancelaciones no equivale necesariamente a días devueltos al saldo: también incluye solicitudes que nunca fueron aprobadas.</p><p>Fecha de cancelación efectiva usa la resolución del administrador o la cancelación directa del colaborador. Los filtros muestran estados actuales, no una fotografía histórica. No se calculan asistencias ni faltas porque BioTime aún no está conectado.</p></details>
 <p class="statistics-caption">Última carga: ${esc(new Intl.DateTimeFormat('es-MX',{dateStyle:'short',timeStyle:'short',timeZone:'America/Monterrey'}).format(new Date(udi.loadedAt)))} · Zona horaria: Monterrey.</p>`;
}
document.addEventListener('change',event=>{
 const key=event.target.dataset.statFilter;if(!key||!['udi','super'].includes(user()?.role))return;
 statsFilters[key]=event.target.value;
 if(key==='preset'&&statsFilters.preset!=='custom')Object.assign(statsFilters,vacationStatistics.preset(statsFilters.preset));
 if(key==='from'||key==='to')statsFilters.preset='custom';
 if(key==='basis'&&statsFilters.basis==='cancelled')statsFilters.state='all';
 renderVacationStatistics();document.querySelector(`[data-stat-filter="${key}"]`)?.focus();
});
document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-statistics-refresh]');if(!b||b.disabled||!['udi','super'].includes(user()?.role))return;
 b.disabled=true;b.textContent='Actualizando…';
 try{await window.loadUDIData();renderVacationStatistics();}finally{b.disabled=false;}
});
document.addEventListener('click',event=>{if(event.target.closest('#logout')){statisticsOwner=null;const root=document.getElementById('statistics-view');if(root){root.hidden=true;root.innerHTML='';}}},true);
