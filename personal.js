// Registro de personal UDI; BioTime se conectará en una etapa posterior.
const UDI_SCHEDULES = {'08-16':'08:00–16:00','09-17':'09:00–17:00','10-18':'10:00–18:00',flex:'Flexible · 8 horas',exempt:'Sin horario · excepción'};
const udi = {people:[],requests:[],error:'',area:'all',search:'',schedule:'all',page:1,tab:'dashboard',busy:false};
const udiToday = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
udi.from = udiToday().slice(0,7)+'-01'; udi.to = udiToday();
async function udiReadAll(table,columns) {
  const rows=[];
  for(let start=0;;start+=500){
    const result=await cloud.from(table).select(columns).order('id').range(start,start+499);
    if(result.error) throw result.error;
    rows.push(...result.data);
    if(result.data.length<500) return rows;
  }
}
window.loadUDIData = async function() {
  udi.people=[];udi.requests=[];udi.error='';
  if(!['udi','super'].includes(user()?.role)) return;
  try {
    const [people,requests]=await Promise.all([
      udiReadAll('udi_people','*'),
      udiReadAll('vacation_requests','id,employee_id,status,request_days(vacation_date)')
    ]);
    udi.people=people.filter(p=>p.active);
    udi.requests=requests;
  } catch(error){udi.error='No se pudo cargar UDI. Verifica que su configuración esté instalada en Supabase. '+(error.message||'');}
};
function udiAreaName(id){return data.areas.find(a=>a.id===id)?.name||'Sin área';}
function udiScopedPeople(){return udi.people.filter(p=>udi.area==='all'||(udi.area==='none'?!p.area_id:p.area_id===udi.area));}
function udiMetrics(people){
  const ids=new Set(people.map(p=>p.profile_id).filter(Boolean));
  const requests=udi.requests.filter(r=>ids.has(r.employee_id)&&r.request_days.some(d=>d.vacation_date>=udi.from&&d.vacation_date<=udi.to));
  const approved=new Set(requests.filter(r=>r.status==='approved').flatMap(r=>r.request_days.filter(d=>d.vacation_date>=udi.from&&d.vacation_date<=udi.to).map(d=>r.employee_id+':'+d.vacation_date)));
  return {total:people.length,unassigned:people.filter(p=>!p.schedule).length,flex:people.filter(p=>p.schedule==='flex').length,exempt:people.filter(p=>p.schedule==='exempt').length,days:approved.size,pending:requests.filter(r=>r.status==='pending').length};
}
function udiBars(items,total){return items.map(([label,count])=>`<div class="udi-bar-row"><div><span>${esc(label)}</span><strong>${count}</strong></div><div class="udi-track"><i style="width:${total?Math.round(count/total*100):0}%"></i></div></div>`).join('');}
function udiOptions(selected){return `<option value="">Por asignar</option>`+Object.entries(UDI_SCHEDULES).map(([id,label])=>`<option value="${id}" ${selected===id?'selected':''}>${label}</option>`).join('');}
function udiAreaOptions(selected){return `<option value="">Sin área</option>`+data.areas.map(a=>`<option value="${esc(a.id)}" ${selected===a.id?'selected':''}>${esc(a.name)}</option>`).join('');}
function renderUDI(){
  let root=document.getElementById('udi-view');
  if(!root){root=document.createElement('section');root.id='udi-view';document.getElementById('super-view').after(root);}
  const allowed=['udi','super'].includes(user()?.role);
  root.classList.toggle('hidden',!allowed);
  document.querySelector('.app-grid').classList.toggle('udi-wide',allowed);
  if(!allowed){root.innerHTML='';return;}
  if(udi.error){root.innerHTML=`<section class="card"><h2>UDI · Recursos Humanos</h2><p role="alert">${esc(udi.error)}</p><button type="button" class="secondary" data-udi-retry>Volver a intentar</button></section>`;return;}
  const people=udiScopedPeople(),m=udiMetrics(people);
  root.innerHTML=`<div class="udi-hero"><div><p class="udi-eyebrow">GESTIÓN DE PERSONAL</p><h2>UDI · Recursos Humanos</h2><p>Personas, áreas y horarios en un mismo lugar.</p></div><div><span class="udi-status">BioTime pendiente de conexión</span><button type="button" class="secondary" disabled title="Disponible en una próxima etapa">Generar reporte · Próximamente</button></div></div>
  <nav class="udi-nav" aria-label="Secciones UDI"><button type="button" data-udi-tab="dashboard" aria-pressed="${udi.tab==='dashboard'}">Dashboard</button><button type="button" data-udi-tab="people" aria-pressed="${udi.tab==='people'}">Personas por área</button></nav>
  <div class="udi-area-tabs" aria-label="Filtrar por área">${[['all','Todas las áreas'],['none','Sin área'],...data.areas.map(a=>[a.id,a.name])].map(([id,name])=>`<button type="button" data-udi-area="${esc(id)}" aria-pressed="${udi.area===id}">${esc(name)} <b>${udi.people.filter(p=>id==='all'||(id==='none'?!p.area_id:p.area_id===id)).length}</b></button>`).join('')}</div>
  ${udi.tab==='dashboard'?`<div class="udi-metrics">${[['Personas activas',m.total],['Horario por asignar',m.unassigned],['Horario flexible',m.flex],['Excepciones',m.exempt]].map(([label,n])=>`<article class="card"><span>${label}</span><strong>${n}</strong></article>`).join('')}</div>
  <div class="udi-two"><section class="card"><h3>Distribución de horarios</h3>${udiBars([...Object.entries(UDI_SCHEDULES).map(([id,label])=>[label,people.filter(p=>p.schedule===id).length]),['Por asignar',m.unassigned]],m.total)}</section><section class="card"><h3>Personal por área</h3>${udiBars([...data.areas.map(a=>[a.name,people.filter(p=>p.area_id===a.id).length]),['Sin área',people.filter(p=>!p.area_id).length]].filter(([,n])=>n),m.total)||'<p class="empty">Aún no hay personas registradas.</p>'}</section></div>
  <section class="card udi-vacations"><div class="udi-heading"><div><h3>Vacaciones registradas</h3><p>Personas del área seleccionada vinculadas al portal.</p></div><div class="udi-dates"><label>Desde<input type="date" id="udi-from" value="${udi.from}" max="${udi.to}"></label><label>Hasta<input type="date" id="udi-to" value="${udi.to}" min="${udi.from}"></label></div></div><div class="udi-metrics"><article><span>Días-persona aprobados en el rango</span><strong>${m.days}</strong></article><article><span>Solicitudes pendientes en el rango</span><strong>${m.pending}</strong></article></div><p class="notice">El rango filtra los días solicitados, no la fecha de aprobación. Personal y horarios muestran la asignación actual.</p></section><section class="udi-wait"><strong>Asistencia · Aún sin datos de BioTime</strong><p>Cumplimiento, retardos, faltas y salidas anticipadas estarán disponibles al conectar las checadas. Las excepciones no tendrán evaluación de horario.</p></section>`:
  `<section class="card"><div class="udi-heading"><div><h3>${esc(udi.area==='all'?'Directorio de personal':udi.area==='none'?'Personas sin área':udiAreaName(udi.area))}</h3><p>Asigna un área y horario a cada persona.</p></div><div class="actions"><button type="button" class="secondary" data-udi-new-area>Nueva área</button><button type="button" class="primary" data-udi-add>Agregar persona</button></div></div><div class="udi-filters"><label>Buscar persona o ID BioTime<input type="search" id="udi-search" value="${esc(udi.search)}" placeholder="Escribe un nombre o identificador"></label><label>Horario<select id="udi-schedule-filter"><option value="all">Todos los horarios</option>${udiOptions(udi.schedule)}</select></label></div><div id="udi-directory"></div></section>`}
  <p class="udi-footnote">Los registros manuales no crean cuentas de acceso. El ID BioTime se vinculará cuando esté disponible la integración.</p>
  <dialog id="udi-dialog" aria-labelledby="udi-dialog-title"></dialog>`;
  if(udi.tab==='people'){document.getElementById('udi-schedule-filter').value=udi.schedule;renderUDIDirectory();}
}
function renderUDIDirectory(){
  const q=udi.search.trim().toLocaleLowerCase('es-MX');
  const people=udiScopedPeople().filter(p=>(udi.schedule==='all'||(p.schedule||'')===udi.schedule)&&(!q||`${p.full_name} ${p.biotime_id||''}`.toLocaleLowerCase('es-MX').includes(q))).sort((a,b)=>a.full_name.localeCompare(b.full_name,'es'));
  const pages=Math.max(1,Math.ceil(people.length/20));udi.page=Math.min(udi.page,pages);
  document.getElementById('udi-directory').innerHTML=`<div class="udi-table-wrap"><table class="users-table"><thead><tr><th>Persona</th><th>Área</th><th>Horario</th><th>Origen</th><th>Acción</th></tr></thead><tbody>${people.slice((udi.page-1)*20,udi.page*20).map(p=>`<tr><td><strong>${esc(p.full_name)}</strong><small>${p.biotime_id?'ID BioTime: '+esc(p.biotime_id):'Sin ID BioTime'}</small></td><td>${esc(udiAreaName(p.area_id))}</td><td><span class="udi-badge ${p.schedule==='exempt'?'udi-exempt':''}">${esc(UDI_SCHEDULES[p.schedule]||'Por asignar')}</span></td><td>${{portal:'Portal',manual:'Manual',biotime:'BioTime'}[p.source]||'—'}</td><td><button type="button" class="secondary" data-udi-edit="${esc(p.id)}" aria-label="Editar a ${esc(p.full_name)}">Editar</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">No hay personas con estos filtros.</td></tr>'}</tbody></table></div><div class="udi-pagination"><span>${people.length} personas · Página ${udi.page} de ${pages}</span><div><button type="button" class="secondary" data-udi-page="-1" ${udi.page===1?'disabled':''}>Anterior</button> <button type="button" class="secondary" data-udi-page="1" ${udi.page===pages?'disabled':''}>Siguiente</button></div></div>`;
}
function openUDIPerson(id){
  const p=udi.people.find(p=>p.id===id),dialog=document.getElementById('udi-dialog');
  dialog.innerHTML=`<form id="udi-person-form"><h2 id="udi-dialog-title">${p?'Editar persona':'Agregar persona'}</h2><input type="hidden" name="person_id" value="${esc(p?.id||'')}"><label>Nombre completo<input name="name" maxlength="160" required value="${esc(p?.full_name||'')}" ${p?.profile_id?'readonly':''}></label>${p?.profile_id?'<p class="notice">Nombre vinculado a la cuenta del portal.</p>':''}<label>Área<select name="area">${udiAreaOptions(p?p.area_id:!['all','none'].includes(udi.area)?udi.area:'')}</select></label><label>Horario<select name="schedule">${udiOptions(p?.schedule)}</select></label><p class="notice">Flexible: completar 8 horas. Excepción: no requiere horario. Por asignar: pendiente de definir.</p><label>ID BioTime (opcional)<input name="biotime" maxlength="80" value="${esc(p?.biotime_id||'')}"></label><p id="udi-form-error" role="alert"></p><div class="actions"><button class="primary" type="submit">Guardar persona</button><button class="secondary" type="button" data-udi-close>Cancelar</button></div></form>`;
  dialog.showModal();
}
document.addEventListener('click',async event=>{
  const b=event.target.closest('#udi-view button');if(!b)return;
  if(b.hasAttribute('data-udi-close')){document.getElementById('udi-dialog').close();return;}
  if(b.dataset.udiTab){udi.tab=b.dataset.udiTab;renderUDI();}
  if(b.dataset.udiArea){udi.area=b.dataset.udiArea;udi.page=1;renderUDI();}
  if(b.dataset.udiPage){udi.page+=Number(b.dataset.udiPage);renderUDIDirectory();}
  if(b.hasAttribute('data-udi-add'))openUDIPerson();
  if(b.dataset.udiEdit)openUDIPerson(b.dataset.udiEdit);
  if(b.hasAttribute('data-udi-retry')){b.disabled=true;await window.loadUDIData();renderUDI();}
  if(b.hasAttribute('data-udi-new-area')){
    const d=document.getElementById('udi-dialog');d.innerHTML='<form id="udi-area-form"><h2 id="udi-dialog-title">Nueva área</h2><label>Nombre del área<input name="name" required maxlength="100"></label><p id="udi-form-error" role="alert"></p><div class="actions"><button class="primary">Crear área</button><button type="button" class="secondary" data-udi-close>Cancelar</button></div></form>';d.showModal();
  }
});
document.addEventListener('input',event=>{if(event.target.id==='udi-search'){udi.search=event.target.value;udi.page=1;renderUDIDirectory();}});
document.addEventListener('change',event=>{
  if(event.target.id==='udi-schedule-filter'){udi.schedule=event.target.value;udi.page=1;renderUDIDirectory();}
  if(['udi-from','udi-to'].includes(event.target.id)){
    const from=document.getElementById('udi-from').value,to=document.getElementById('udi-to').value;
    if(!from||!to||from>to){event.target.reportValidity();return;}
    udi.from=from;udi.to=to;renderUDI();
  }
});
document.addEventListener('submit',async event=>{
  if(!['udi-person-form','udi-area-form'].includes(event.target.id))return;
  event.preventDefault();if(udi.busy)return;udi.busy=true;
  const form=event.target,f=new FormData(form),buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  try {
    const result=form.id==='udi-person-form'?await cloud.rpc('udi_save_person',{p_id:f.get('person_id')||null,p_name:f.get('name').trim(),p_area:f.get('area')||null,p_schedule:f.get('schedule')||null,p_biotime_id:f.get('biotime').trim()||null}):await cloud.rpc('udi_create_area',{p_name:f.get('name').trim()});
    if(result.error)throw result.error;
    document.getElementById('udi-dialog').close();
    await showCloudSession();
  }catch(error){const msg=document.getElementById('udi-form-error');if(msg)msg.textContent=error.code==='23505'?'Ya existe ese ID BioTime, área o administrador para el área elegida.':error.message;}
  finally{udi.busy=false;buttons.forEach(b=>b.disabled=false);}
});
const renderBeforeUDI=render;
render=function(){renderBeforeUDI();renderUDI();};
document.addEventListener('click',event=>{if(!event.target.closest('#logout'))return;udi.people=[];udi.requests=[];udi.area='all';udi.search='';udi.schedule='all';udi.page=1;document.getElementById('udi-view')?.classList.add('hidden');},true);
const prepareUDI=document.createElement('button');
prepareUDI.type='button';prepareUDI.className='secondary';prepareUDI.textContent='Preparar cuenta UDI';
document.getElementById('add-user').before(prepareUDI);
prepareUDI.addEventListener('click',()=>{
  const form=document.getElementById('add-user');
  form.elements.name.value='UDI';form.elements.email.value='claudia.quiroga@cedhnl.org.mx';
  form.elements.role.value='udi';form.elements.area.value='';
  form.elements.password.focus();
});

;
// Navegación visual: conserva los formularios y sus manejadores originales.
(() => {
  const sections = [
    ['people', 'Personas y roles', 'Administra las cuentas y los permisos de acceso.', '#add-user'],
    ['areas', 'Áreas', 'Organiza las áreas de la institución.', '#add-area'],
    ['periods', 'Periodos', 'Define los periodos y días disponibles de vacaciones.', '#policy-form'],
    ['holidays', 'Días inhábiles', 'Administra los días no laborables del calendario.', '#holiday-calendar'],
    ['approved', 'Vacaciones aprobadas', 'Consulta las vacaciones autorizadas por área.', '#super-approved-report'],
    ['rh', 'Recursos Humanos', 'Consulta el dashboard y organiza al personal con UDI.', '#udi-view']
  ];
  let selected = 'people', owner = null, peopleQuery = '';
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX');
  function filterPeople() {
    const terms = normalize(peopleQuery).trim().split(/\s+/).filter(Boolean);
    const rows = [...document.querySelectorAll('#users-list tr[data-person-search]')];
    let matches = 0;
    rows.forEach(row => {
      const match = terms.every(term => row.dataset.personSearch.includes(term));
      row.hidden = !match;
      if (match) matches++;
    });
    const count = document.getElementById('super-people-count');
    if (count) count.textContent = `${matches} de ${rows.length} personas`;
    let empty = document.getElementById('super-people-empty');
    if (!empty) {
      empty = document.createElement('tr'); empty.id = 'super-people-empty';
      empty.innerHTML = '<td colspan="5" class="empty">No hay personas que coincidan con la búsqueda.</td>';
      document.getElementById('users-list').append(empty);
    }
    empty.hidden = matches > 0;
  }
  function setupPeopleSearch(table) {
    let search = document.getElementById('super-people-search');
    if (!search) {
      const controls = document.createElement('div'); controls.className = 'super-people-search';
      controls.innerHTML = '<label for="super-people-search">Buscar personas<input type="search" id="super-people-search" placeholder="Nombre, correo, área o ID" autocomplete="off"></label><button type="button" class="secondary" id="super-people-clear">Limpiar</button><p id="super-people-count" role="status" aria-live="polite"></p>';
      table.parentElement.before(controls);
      search = document.getElementById('super-people-search');
      search.addEventListener('input', () => { peopleQuery = search.value; filterPeople(); });
      document.getElementById('super-people-clear').addEventListener('click', () => {
        search.value = ''; peopleQuery = ''; filterPeople(); search.focus();
      });
    }
    search.value = peopleQuery;
    const rows = [...document.querySelectorAll('#users-list tr:not(#super-people-empty)')];
    rows.forEach((row, index) => {
      const person = data.users[index]; if (!person) return;
      const biotimeId = typeof udi !== 'undefined' ? udi.people.find(p => p.profile_id === person.id)?.biotime_id : '';
      row.dataset.personSearch = normalize([person.name, person.email, area(person.areaId)?.name || 'Sin área', person.id, biotimeId].join(' '));
      let idLabel = row.querySelector('.super-person-id');
      if (!idLabel) { idLabel = document.createElement('small'); idLabel.className = 'super-person-id'; row.cells[0].append(idLabel); }
      idLabel.textContent = `ID: ${person.id}${biotimeId ? ' · BioTime: '+biotimeId : ''}`;
    });
    filterPeople();
  }
  function sync() {
    const isSuper = user()?.role === 'super';
    let shell = document.getElementById('super-navigation');
    const rh = document.getElementById('udi-view');
    if (!isSuper) {
      if (shell) shell.hidden = true;
      if (rh) { rh.hidden = false; rh.removeAttribute('role'); rh.removeAttribute('aria-labelledby'); }
      return;
    }
    if (owner !== currentUserId) { owner = currentUserId; selected = 'people'; peopleQuery = ''; }
    if (!shell) {
      shell = document.createElement('section');
      shell.id = 'super-navigation';
      shell.innerHTML = `<div class="super-intro"><p class="super-eyebrow">ADMINISTRACIÓN</p><h2>Panel de superusuario</h2><p>Selecciona un apartado para trabajar.</p></div><div class="super-tabs" role="tablist" aria-label="Administración del portal">${sections.map(([id,label]) => `<button type="button" role="tab" id="super-tab-${id}" data-super-tab="${id}" aria-controls="${id === 'rh' ? 'udi-view' : 'super-panel-'+id}">${label}</button>`).join('')}</div><p class="super-section-description" id="super-section-description"></p>`;
      document.getElementById('super-view').before(shell);
      shell.addEventListener('click', event => {
        const button = event.target.closest('[data-super-tab]');
        if (!button) return;
        selected = button.dataset.superTab; sync();
      });
      shell.addEventListener('keydown', event => {
        const button = event.target.closest('[data-super-tab]');
        if (!button || !['ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const index = sections.findIndex(([id]) => id === button.dataset.superTab);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length-1 : (index+(event.key==='ArrowRight'?1:-1)+sections.length)%sections.length;
        selected = sections[next][0]; sync();
        document.getElementById('super-tab-'+selected).focus();
      });
    }
    shell.hidden = false;
    document.getElementById('super-view').classList.toggle('hidden', selected === 'rh');
    for (const [id,,description,selector] of sections) {
      const target = document.querySelector(selector);
      const panel = id === 'rh' || id === 'approved' ? target : target?.closest('section');
      const active = selected === id;
      if (panel) {
        if (id !== 'rh') panel.id = 'super-panel-'+id;
        // El reporte conserva su ID porque su renderizador lo utiliza.
        if (id === 'approved') panel.id = 'super-approved-report';
        panel.hidden = !active;
        panel.setAttribute('role','tabpanel');
        panel.setAttribute('aria-labelledby','super-tab-'+id);
        document.getElementById('super-tab-'+id).setAttribute('aria-controls', panel.id);
      }
      const button = document.getElementById('super-tab-'+id);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (active) document.getElementById('super-section-description').textContent = description;
    }
    const table = document.querySelector('#super-panel-people .users-table');
    if (table && !table.parentElement.classList.contains('super-table-scroll')) {
      const wrap = document.createElement('div'); wrap.className = 'super-table-scroll';
      table.before(wrap); wrap.append(table);
    }
    if (table) setupPeopleSearch(table);
  }
  const originalRenderUDI = renderUDI;
  renderUDI = function() { originalRenderUDI(); sync(); };
  document.addEventListener('click', event => {
    if (event.target.closest('#logout')) { owner = null; selected = 'people'; }
  }, true);
})();
