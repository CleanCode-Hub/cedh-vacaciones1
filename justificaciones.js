// Solicitudes privadas: la identidad y las autorizaciones se validan en el servidor.
(() => {
 const labels={pending:'En revisión',approved:'JUSTIFICADO',rejected:'Rechazada'};
 const presidency={owner:null,status:'pending',page:1,loading:false,serial:0};
 const fmt=date=>date?.slice(0,10).split('-').reverse().join('/')||'—';
 const authorized=owner=>owner===currentUserId&&!!user();
 async function api(path,options={}){
  const owner=currentUserId;
  const {data:session,error}=await cloud.auth.getSession();
  if(error||!session.session||session.session.user.id!==owner)throw Error('Tu sesión terminó. Ingresa nuevamente.');
  const response=await fetch('/api/justifications'+path,{...options,cache:'no-store',headers:{Authorization:'Bearer '+session.session.access_token,...options.headers},signal:AbortSignal.timeout(180000)});
  if(!authorized(owner))throw Error('La sesión cambió.');
  if(!response.ok){const body=await response.json().catch(()=>null);throw Error(body?.error||'No se pudo completar la solicitud. Intenta nuevamente.');}
  return response;
 }
 const post=(path,body)=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(r=>r.json());
 function dialog(){
  let d=document.getElementById('justification-dialog');
  if(!d){d=document.createElement('dialog');d.id='justification-dialog';d.setAttribute('aria-labelledby','justification-dialog-title');document.body.append(d);}
  return d;
 }
 function notice(request){
  return `<p><span class="justification-state ${esc(request.status)}">${labels[request.status]}</span> · ${fmt(request.absence_date)}</p><h3>Descripción del colaborador</h3><p class="justification-description">${esc(request.description)}</p><button type="button" class="secondary" data-justification-file="${esc(request.id)}">Descargar comprobante</button><p class="notice">Archivo: ${esc(request.file_name)}</p>${request.status==='pending'?'<p class="notice">La falta continúa contando hasta que Presidencia apruebe la justificación.</p>':`<h3>Resolución de Presidencia</h3><p class="justification-description">${esc(request.decision_reason)}</p><p class="notice">${esc(request.reviewer_name)} · ${fmt(request.reviewed_at)}</p>`}`;
 }
 async function showRequest(id){
  const owner=currentUserId,d=dialog();d.innerHTML='<h2 id="justification-dialog-title">Justificación de falta</h2><p role="status">Cargando solicitud…</p><button type="button" class="secondary" data-justification-close>Cerrar</button>';d.showModal();
  try{
   const {request}=await (await api('/'+id)).json();if(!authorized(owner)||!d.open)return;
   d.innerHTML=`<h2 id="justification-dialog-title">Justificación de falta</h2>${notice(request)}<p id="justification-message" role="status"></p><div class="actions"><button type="button" class="secondary" data-justification-close>Cerrar</button></div>`;
  }catch(error){if(authorized(owner)&&d.open)d.querySelector('[role="status"]').textContent=error.message;}
 }
 function showNew(date){
  const record=data.attendanceByMonth?.[date.slice(0,7)]?.find(r=>r.date===date&&r.employeeId===currentUserId);
  if(user()?.role!=='employee'||record?.status!=='absence'||record.justification)return;
  const d=dialog();d.innerHTML=`<form id="justification-create"><h2 id="justification-dialog-title">Solicitar justificación</h2><p>Falta del <strong>${fmt(date)}</strong></p><input type="hidden" name="date" value="${date}"><label>Describe el motivo<textarea name="description" required minlength="10" maxlength="2000" placeholder="Explica por qué solicitas justificar esta falta."></textarea></label><label>Comprobante<input type="file" name="evidence" required accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"></label><p class="notice">PDF, JPG o PNG · Hasta 5 MB. Solo tú y Presidencia pueden consultar el comprobante. Se permite una solicitud por fecha.</p><p class="notice">Mientras esté en revisión, el día seguirá contando como falta.</p><p id="justification-message" role="status" aria-live="polite"></p><div class="actions"><button type="submit" class="primary">Enviar a Presidencia</button><button type="button" class="secondary" data-justification-close>Cancelar</button></div></form>`;d.showModal();
 }
 window.renderJustificationActions=record=>{
  const target=document.getElementById('attendance-justification-actions');if(!target)return;
  target.innerHTML='';
  if(!record||user()?.role!=='employee'||record.employeeId!==currentUserId)return;
  if(record.justification){target.innerHTML=`<span class="justification-state ${esc(record.justification.status)}">${labels[record.justification.status]}</span><button type="button" class="secondary" data-justification-view="${esc(record.justification.id)}">Ver solicitud y resolución</button>`;}
  else if(record.status==='absence')target.innerHTML=`<button type="button" class="primary" data-justification-new="${record.date}">Solicitar justificación</button>`;
 };
 function presidencyMarkup(){
  return `<div class="udi-heading"><div><p class="udi-eyebrow">PRESIDENCIA</p><h2>Justificación de faltas</h2><p>Revisa los motivos y comprobantes antes de resolver cada solicitud.</p></div><button type="button" class="secondary" data-presidency-refresh>Actualizar</button></div><div class="justification-filters"><label>Estado<select id="presidency-status">${[['pending','Pendientes'],['approved','Justificadas'],['rejected','Rechazadas'],['all','Todas']].map(([v,l])=>`<option value="${v}" ${presidency.status===v?'selected':''}>${l}</option>`).join('')}</select></label></div><p id="presidency-message" role="status" aria-live="polite"></p><div id="presidency-list"></div><div id="presidency-pages" class="udi-pagination"></div>`;
 }
 window.renderPresidencia=async(force=false)=>{
  const root=document.getElementById('presidency-view');if(!root||user()?.role!=='super')return;
  if(presidency.owner!==currentUserId){presidency.owner=currentUserId;presidency.status='pending';presidency.page=1;force=true;}
  if(!force&&root.querySelector('#presidency-list'))return;
  const owner=currentUserId,serial=++presidency.serial;
  root.innerHTML=presidencyMarkup();const msg=root.querySelector('#presidency-message');msg.textContent='Consultando solicitudes…';
  try{
   const result=await (await api('?'+new URLSearchParams({status:presidency.status,page:presidency.page}))).json();
   if(!authorized(owner)||user()?.role!=='super'||serial!==presidency.serial)return;
   msg.textContent=result.total+' solicitud(es) · Página '+result.page+' de '+result.pages;
   root.querySelector('#presidency-list').innerHTML=result.items.map(r=>`<article class="justification-card"><div class="udi-heading"><div><h3>${esc(r.employee_name)}</h3><p>Fecha de la falta: <strong>${fmt(r.absence_date)}</strong></p><p class="notice">Solicitud enviada el ${fmt(r.created_at)}</p></div><span class="justification-state ${esc(r.status)}">${labels[r.status]}</span></div><p class="justification-description">${esc(r.description)}</p><div class="actions"><button type="button" class="secondary" data-presidency-review="${esc(r.id)}">${r.status==='pending'?'Revisar solicitud':'Ver resolución'}</button></div></article>`).join('')||'<p class="empty">No hay solicitudes con este estado.</p>';
   root.querySelector('#presidency-pages').innerHTML=`<button type="button" class="secondary" data-presidency-page="-1" ${result.page<=1?'disabled':''}>Anterior</button><button type="button" class="secondary" data-presidency-page="1" ${result.page>=result.pages?'disabled':''}>Siguiente</button>`;
  }catch(error){if(authorized(owner)&&serial===presidency.serial)msg.textContent=error.message;}
 };
 async function review(id){
  const owner=currentUserId,d=dialog();d.innerHTML='<h2 id="justification-dialog-title">Revisión de Presidencia</h2><p role="status">Cargando…</p><button type="button" class="secondary" data-justification-close>Cerrar</button>';d.showModal();
  try{
   const {request:r}=await (await api('/'+id)).json();if(!authorized(owner)||user()?.role!=='super'||!d.open)return;
   const original=r.original_record;
   d.innerHTML=`<h2 id="justification-dialog-title">${esc(r.employee_name)}</h2>${notice(r)}<p class="notice">Checadas al solicitar: ${esc(original.first||'Sin entrada')} / ${esc(original.last||'Sin salida')}. ${esc((original.warnings||[]).map(w=>attendanceWarnings[w]||w).join(' · '))}</p>${r.status==='pending'?`<form id="justification-decision"><input type="hidden" name="id" value="${esc(r.id)}"><label>Decisión<select name="decision" required><option value="">Seleccionar decisión</option><option value="approved">Aprobar justificación</option><option value="rejected">Rechazar justificación</option></select></label><label>Motivo de la resolución<textarea name="reason" minlength="5" maxlength="2000" required placeholder="Este motivo podrá verlo el colaborador."></textarea></label><p class="notice">Al aprobar, la falta dejará de contarse en los nuevos reportes. Al rechazar, la falta se conserva. La decisión quedará registrada.</p><button type="submit" class="primary">Guardar resolución</button></form>`:''}<p id="justification-message" role="status" aria-live="polite"></p><div class="actions"><button type="button" class="secondary" data-justification-close>Cerrar</button></div>`;
  }catch(error){if(authorized(owner)&&d.open)d.querySelector('[role="status"]').textContent=error.message;}
 }
 document.addEventListener('change',e=>{if(e.target.id==='presidency-status'){presidency.status=e.target.value;presidency.page=1;window.renderPresidencia(true);}});
 document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-justification-close')){dialog().close();return;}
  if(button.dataset.justificationNew)showNew(button.dataset.justificationNew);
  if(button.dataset.justificationView)showRequest(button.dataset.justificationView);
  if(button.dataset.presidencyReview&&user()?.role==='super')review(button.dataset.presidencyReview);
  if(button.hasAttribute('data-presidency-refresh'))window.renderPresidencia(true);
  if(button.dataset.presidencyPage){presidency.page+=Number(button.dataset.presidencyPage);window.renderPresidencia(true);}
  if(button.dataset.justificationFile){
   const owner=currentUserId;button.disabled=true;
   try{
    const response=await api('/'+button.dataset.justificationFile+'/file'),blob=await response.blob();if(!authorized(owner))return;
    const name=/filename="([^"]+)"/.exec(response.headers.get('Content-Disposition')||'')?.[1]||'comprobante';
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
   }catch(error){if(authorized(owner)){const message=document.getElementById('justification-message');if(message)message.textContent=error.message;}}
   finally{button.disabled=false;}
  }
 });
 document.addEventListener('submit',async event=>{
  if(!['justification-create','justification-decision'].includes(event.target.id))return;
  event.preventDefault();const form=event.target;if(form.dataset.busy)return;form.dataset.busy='true';
  const owner=currentUserId,d=dialog(),f=new FormData(form),message=d.querySelector('#justification-message'),submit=form.querySelector('[type="submit"]');submit.disabled=true;message.textContent='Guardando…';
  try{
   if(form.id==='justification-create'){
    const file=f.get('evidence');if(!file||!file.size||file.size>5*1024*1024||! /\.(pdf|jpe?g|png)$/i.test(file.name))throw Error('Adjunta un PDF, JPG o PNG de hasta 5 MB.');
    const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('No se pudo leer el archivo.'));reader.readAsDataURL(file);});
    if(!authorized(owner))return;
    await post('',{date:f.get('date'),description:f.get('description'),file:{name:file.name,base64}});
    if(!authorized(owner))return;
    await window.loadMyAttendance(f.get('date').slice(0,7),true);
    if(authorized(owner)){d.innerHTML='<h2 id="justification-dialog-title">Solicitud enviada</h2><p>Presidencia revisará tu descripción y comprobante. Puedes consultar el estado seleccionando la fecha en tu calendario.</p><button type="button" class="secondary" data-justification-close>Cerrar</button>';}
   }else{
    await post('/'+f.get('id')+'/decision',{decision:f.get('decision'),reason:f.get('reason')});
    if(!authorized(owner))return;
    d.innerHTML='<h2 id="justification-dialog-title">Resolución guardada</h2><p>La decisión quedó registrada. Las próximas consultas de asistencia y los nuevos reportes usarán esta resolución.</p><button type="button" class="secondary" data-justification-close>Cerrar</button>';
    window.renderPresidencia(true);
   }
  }catch(error){if(authorized(owner)&&message.isConnected)message.textContent=error.message;}
  finally{delete form.dataset.busy;submit.disabled=false;}
 });
 document.addEventListener('click',event=>{if(event.target.closest('#logout')){
  presidency.serial++;presidency.owner=null;const root=document.getElementById('presidency-view');if(root){root.innerHTML='';root.hidden=true;}
  const d=document.getElementById('justification-dialog');if(d){d.close();d.innerHTML='';}
 }},true);
 function refreshVisible(){if(document.visibilityState==='visible'&&user()?.role==='employee'&&!document.getElementById('attendance-summary')?.classList.contains('hidden'))window.loadMyAttendance(document.getElementById('attendance-month').value,true);}
 setInterval(refreshVisible,30000);window.addEventListener('focus',refreshVisible);
})();
