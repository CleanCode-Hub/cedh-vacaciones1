// El navegador consulta únicamente el servidor del portal con su sesión Supabase.
// No contiene configuración ni credenciales de BioTime.
const attendanceLabels={justified:'JUSTIFICADO',present:'En tolerancia',late:'Retardo',absence:'Falta',vacation:'Vacaciones',non_working:'Inhábil',exempt:'Excepción',unassigned:'Sin horario',review:'Revisión',in_progress:'Día en curso',future:'Fecha futura'};
const attendanceWarnings={duplicados_exactos:'Duplicados exactos',multiples_checadas:'Múltiples checadas',salida_anticipada:'Falta por salida anticipada',entrada_con_retardo:'Entrada con retardo (sin conteo adicional)',falta_por_entrada:'También falta por entrada',sin_salida:'Sin salida',checadas_en_vacaciones:'Checadas en vacaciones'};
function renderBioTimePanel(){
  return `<section class="card"><h3>Asistencia · BioTime</h3><p>Consulta hasta 31 días por persona usando el rango de fechas de arriba.</p><label>Persona<select id="biotime-person"><option value="">Seleccionar persona</option>${udiScopedPeople().map(p=>`<option value="${esc(p.id)}">${esc(p.full_name)}${p.biotime_id?'':' · Sin ID BioTime'}</option>`).join('')}</select></label><button type="button" class="primary" id="biotime-query">Consultar checadas</button><div id="biotime-result" role="status" aria-live="polite"></div></section>`;
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('#biotime-query');if(!button||!['udi','super'].includes(user()?.role))return;
  const target=document.getElementById('biotime-result'),personId=document.getElementById('biotime-person').value;
  if(!personId){target.textContent='Selecciona una persona.';return;}
  const actor=currentUserId;button.disabled=true;target.textContent='Consultando checadas y vacaciones…';
  try{
    const {data:session,error}=await cloud.auth.getSession();if(error||!session.session)throw Error('La sesión terminó. Ingresa nuevamente.');
    const response=await fetch('/api/attendance?'+new URLSearchParams({person_id:personId,from:udi.from,to:udi.to}),{headers:{Authorization:'Bearer '+session.session.access_token},cache:'no-store',signal:AbortSignal.timeout(180000)});
    const body=await response.json().catch(()=>{throw Error('El servicio de asistencia no está disponible en este alojamiento.');});
    if(!response.ok)throw Error(body.error||'No se pudo consultar asistencia.');
    if(actor!==currentUserId||!target.isConnected||!['udi','super'].includes(user()?.role))return;
    target.innerHTML=`<p class="notice">${esc(body.notice)}</p><div class="udi-table-wrap"><table class="users-table"><thead><tr><th>Fecha</th><th>Primera</th><th>Última</th><th>Estado</th><th>Observaciones</th></tr></thead><tbody>${body.records.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.first||'—')}</td><td>${esc(r.last||'—')}</td><td>${esc(attendanceLabels[r.status]||'Revisión')}</td><td>${esc(r.warnings.map(w=>attendanceWarnings[w]||w).join(', ')||'—')}</td></tr>`).join('')}</tbody></table></div>`;
  }catch(error){if(actor===currentUserId&&target.isConnected)target.textContent=error.name==='TimeoutError'?'La consulta tardó demasiado. Reduce el rango e intenta nuevamente.':error.message;}
  finally{button.disabled=false;}
});
