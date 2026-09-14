// Ajustes de interfaz y de administración de usuarios.
const baseRender = render;
render = function () {
  baseRender();
  document.querySelector('.side').classList.toggle('hidden', user()?.role === 'super');
};

// Estas acciones se atienden primero para que siempre actualicen los datos.
$('#users-list').addEventListener('change', event => {
  const control = event.target.closest('[data-role],[data-area]');
  if (!control) return;
  event.stopImmediatePropagation();
  const person = data.users.find(item => item.id === Number(control.dataset.role || control.dataset.area));
  const nextRole = control.dataset.role ? control.value : person.role;
  const nextArea = control.dataset.area ? (Number(control.value) || null) : person.areaId;
  const anotherAdmin = data.users.some(item => item.id !== person.id && item.role === 'admin' && item.areaId === nextArea);
  if (nextRole === 'admin' && (!nextArea || anotherAdmin)) { alert('Cada área puede tener solo un administrador.'); render(); return; }
  person.role = nextRole; person.areaId = nextArea; save(); render();
}, true);

$('#users-list').addEventListener('click', event => {
  const button = event.target.closest('[data-delete]');
  if (!button) return;
  event.stopImmediatePropagation();
  const person = data.users.find(item => item.id === Number(button.dataset.delete));
  if (!person || !confirm(`¿Quitar a ${person.name}?`)) return;
  data.users = data.users.filter(item => item.id !== person.id);
  save(); render();
}, true);
