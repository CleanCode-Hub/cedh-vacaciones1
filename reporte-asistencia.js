// El servidor valida los permisos y calcula todo el informe antes de entregar el PDF.
let attendanceReportBusy=false;
document.addEventListener('click',event=>{
 if(!event.target.closest('[data-udi-report]')||!['udi','super'].includes(user()?.role))return;
 const dialog=document.getElementById('udi-dialog');
 dialog.innerHTML=`<form id="attendance-report-form"><h2 id="udi-dialog-title">Reporte de retardos y faltas</h2><p>Genera un PDF con los colaboradores que tienen retardos o faltas en el periodo seleccionado.</p><div class="admin-tabs" role="tablist" aria-label="Tipo de periodo del reporte"><button type="button" class="active" role="tab" aria-selected="true" aria-controls="report-range-panel" id="report-range-tab">Rango de fechas</button><button type="button" role="tab" aria-selected="false" aria-disabled="true" disabled aria-describedby="report-catorcenas-note">Catorcenas</button></div><p class="notice" id="report-catorcenas-note">Catorcenas: pendiente de confirmar las fechas con Recursos Humanos.</p><div id="report-range-panel" role="tabpanel" aria-labelledby="report-range-tab"><label>Área<select name="area"><option value="all">Todas las áreas</option><option value="none">Sin área</option>${data.areas.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select></label><div class="udi-dates"><label>Desde<input type="date" name="from" required value="${esc(udi.from)}" max="${udiToday()}"></label><label>Hasta<input type="date" name="to" required value="${esc(udi.to)}" max="${udiToday()}"></label></div></div><p class="notice">Elige las fechas de inicio y fin. Puedes consultar hasta 366 días por reporte. El día actual no se cuenta porque sigue en curso.</p><p class="notice">Cada 4 retardos del mismo mes equivalen a 1 falta. El cálculo considera los retardos anteriores de ese mes y registra la falta en la fecha en que se completa cada grupo de cuatro.</p><p class="notice">Si faltan horarios, vínculos de BioTime o checadas de salida, el PDF los señalará para revisión. Una falla de conexión cancela el reporte.</p><p id="attendance-report-state" role="status" aria-live="polite"></p><div class="actions"><button class="primary" type="submit">Generar y descargar PDF</button><button class="secondary" type="button" data-udi-close>Cerrar</button></div></form>`;
 dialog.querySelector('[name="area"]').value=udi.area;dialog.showModal();
});
document.addEventListener('submit',async event=>{
 if(event.target.id!=='attendance-report-form')return;
 event.preventDefault();if(attendanceReportBusy)return;
 const form=event.target,owner=currentUserId,fields=new FormData(form),from=fields.get('from'),to=fields.get('to'),area=fields.get('area');
 const status=form.querySelector('#attendance-report-state'),button=form.querySelector('[type="submit"]');
 if(!from||!to||from>to||to>udiToday()||(Date.parse(to)-Date.parse(from))/86400000>365){status.textContent='Selecciona un rango válido de hasta 366 días, sin fechas futuras.';return;}
 attendanceReportBusy=true;button.disabled=true;
 status.textContent='Consultando checadas y preparando el PDF. Puede tardar varios minutos según las personas y las fechas seleccionadas…';
 try{
  const {data:session,error}=await cloud.auth.getSession();if(error||!session.session)throw Error('Tu sesión terminó. Ingresa nuevamente.');
  const response=await fetch('/api/attendance-report?'+new URLSearchParams({from,to,area}),{headers:{Authorization:'Bearer '+session.session.access_token},cache:'no-store',signal:AbortSignal.timeout(600000)});
  if(!response.ok){const body=await response.json().catch(()=>null);throw Error(body?.error||'No se pudo generar el reporte.');}
  if(!response.headers.get('Content-Type')?.includes('application/pdf'))throw Error('El servidor no entregó un PDF válido.');
  const blob=await response.blob();
  if(owner!==currentUserId||!['udi','super'].includes(user()?.role)||!form.isConnected)return;
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`reporte-asistencia-${from}-al-${to}.pdf`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  status.textContent='PDF generado. Revisa la descarga y los pendientes de revisión antes de aplicar descuentos.';
 }catch(error){if(owner===currentUserId&&form.isConnected)status.textContent=error.name==='TimeoutError'?'La consulta tardó demasiado. Prueba con un rango menor o una sola área.':error.message;}
 finally{attendanceReportBusy=false;if(form.isConnected)button.disabled=false;}
});
