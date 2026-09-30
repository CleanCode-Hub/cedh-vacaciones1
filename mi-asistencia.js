// Consulta del mes propio. La identidad se resuelve en el servidor desde la sesión.
window.loadMyAttendance = async function(month,force=false){
  if(user()?.role!=='employee'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return;
  const owner=currentUserId,model=data;
  model.myAttendanceState ||= {};
  if(model.myAttendanceState[month]?.loading||(!force&&model.myAttendanceState[month]))return;
  model.attendanceByMonth ||= {};
  delete model.attendanceByMonth[month];
  model.myAttendanceState[month]={loading:true};
  const stillCurrent=()=>data===model&&currentUserId===owner&&user()?.role==='employee';
  try{
    const {data:session,error}=await cloud.auth.getSession();
    if(error||!session.session||session.session.user.id!==owner)throw Error('La sesión terminó. Ingresa nuevamente.');
    const response=await fetch('/api/my-attendance?'+new URLSearchParams({month}),{headers:{Authorization:'Bearer '+session.session.access_token},cache:'no-store',signal:AbortSignal.timeout(180000)});
    const body=await response.json().catch(()=>{throw Error('El servicio de asistencia no está disponible en este alojamiento.');});
    if(!response.ok)throw Error(body.error||'No se pudo consultar tu asistencia.');
    const expected=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
    if(!Array.isArray(body.records)||body.records.length!==expected||body.records.some((r,i)=>r.employeeId!==owner||r.date!==month+'-'+String(i+1).padStart(2,'0')))throw Error('La consulta del mes está incompleta. Intenta actualizar.');
    if(!stillCurrent())return;
    const unassigned=body.records.some(r=>r.status==='unassigned');
    if(unassigned)throw Error('UDI debe asignarte un horario para calcular tus incidencias.');
    const review=body.records.filter(r=>r.status==='review').length;
    model.attendanceByMonth[month]=body.records;
    model.myAttendanceState[month]={loading:false,note:'Solo se cuentan días anteriores a hoy; se excluyen vacaciones e inhábiles.'+(review?' Hay '+review+' días de horario flexible pendientes de revisión.':'')};
  }catch(error){
    if(!stillCurrent())return;
    model.myAttendanceState[month]={loading:false,error:error.name==='TimeoutError'?'La consulta tardó demasiado. Intenta actualizar.':error.message};
  }
  if(stillCurrent())renderAttendanceSummary();
};
document.addEventListener('click',event=>{
  if(!event.target.closest('#attendance-refresh'))return;
  window.loadMyAttendance(document.getElementById('attendance-month').value,true);
  renderAttendanceSummary();
});
