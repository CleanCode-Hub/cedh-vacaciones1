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
