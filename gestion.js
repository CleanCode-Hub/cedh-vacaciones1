
// Operaciones administrativas validadas también en la base de datos.
let managementBusy=false;
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-admin-cancel], [data-remove-area]');
 if(!button)return;
 event.preventDefault();event.stopImmediatePropagation();
 if(managementBusy || button.disabled)return;
 let rpc,args,message;
 if(button.dataset.adminCancel){
  const request=data.requests.find(r=>String(r.id)===button.dataset.adminCancel);
  if(!request || !adminCancellationAction(request))return alert('Solo puedes cancelar vacaciones futuras de tu área.');
  const authorizing=status(request)[1]==='cancellation_pending';
  // El motivo original se conserva en el servidor; aquí se registra la autorización.
  const reason=authorizing ? 'Cancelación solicitada por el colaborador autorizada.' : prompt('Motivo de cancelación (obligatorio):','');
  if(reason===null)return;
  if(!reason.trim() || reason.trim().length>1000)return alert('Escribe un motivo de entre 1 y 1000 caracteres.');
  if(!confirm(authorizing ? '¿Autorizar la cancelación solicitada por el colaborador? Se conservará su motivo y se liberarán los días aprobados.' : '¿Cancelar estas vacaciones? Se conservará el historial y se liberarán los días aprobados.'))return;
  rpc='admin_cancel_vacation_request';args={p_request_id:request.id,p_reason:reason.trim(),p_expected_status:status(request)[1]};message='Vacaciones canceladas. Se conservó el historial y se actualizó el saldo.';
 }else{
  if(user()?.role!=='super')return;
  const target=data.areas.find(a=>String(a.id)===button.dataset.removeArea);if(!target)return;
  if(data.users.some(p=>p.areaId===target.id))return alert('No se puede quitar el área porque tiene usuarios asignados.');
  if(!confirm('¿Quitar el área '+target.name+'? El servidor comprobará que no tenga usuarios, personal ni historial asociado.'))return;
  rpc='remove_empty_area';args={p_area_id:target.id};message='Área eliminada.';
 }
 managementBusy=true;button.disabled=true;let saved=false;
 try{const {error}=await cloud.rpc(rpc,args);if(error)throw error;saved=true;await showCloudSession();alert(message);}
 catch(error){alert(saved?'El cambio se guardó, pero no se pudo actualizar la pantalla. Recarga el portal.':error.message||'No se pudo confirmar el cambio. Recarga para revisar su estado.');}
 finally{managementBusy=false;button.disabled=false;}
},true);
