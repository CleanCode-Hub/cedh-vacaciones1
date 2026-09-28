
// Control explícito, independiente del ojo que algunos navegadores muestran.
(() => {
 function hidePasswords(){document.querySelectorAll('input[data-password-control]').forEach(input=>{input.type='password';const b=input.parentElement.querySelector('[data-password-toggle]');if(b){b.textContent='Mostrar';b.setAttribute('aria-pressed','false');b.setAttribute('aria-label','Mostrar contraseña');}});}
 function enhancePasswords(){
  document.querySelectorAll('input[type="password"]:not([data-password-control])').forEach(input=>{
   input.dataset.passwordControl='true';
   const wrapper=document.createElement('span');wrapper.className='password-control';input.before(wrapper);wrapper.append(input);
   const button=document.createElement('button');button.type='button';button.className='password-toggle';button.dataset.passwordToggle='true';button.textContent='Mostrar';button.setAttribute('aria-label','Mostrar contraseña');button.setAttribute('aria-pressed','false');
   button.addEventListener('click',()=>{const show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Ocultar':'Mostrar';button.setAttribute('aria-pressed',String(show));button.setAttribute('aria-label',show?'Ocultar contraseña':'Mostrar contraseña');});
   wrapper.append(button);
  });
 }
 enhancePasswords();new MutationObserver(enhancePasswords).observe(document.body,{childList:true,subtree:true});
 document.addEventListener('submit',hidePasswords,true);document.addEventListener('reset',hidePasswords,true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)hidePasswords();});
 document.addEventListener('click',event=>{if(event.target.closest('#logout'))hidePasswords();},true);
})();
