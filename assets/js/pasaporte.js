(function(){
  const KEY='soyTungurahua.passport.v1';
  const MAX_PROGRESS=12;
  const defaults={audios:[],visits:[]};
  function load(){try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...defaults}}}
  function save(s){localStorage.setItem(KEY,JSON.stringify(s));window.dispatchEvent(new CustomEvent('soyTungurahuaPassportChanged',{detail:s}));return s}
  function add(list,item){
    if(!item||!item.id)return;
    const state=load(); const key=String(item.id);
    const existing=state[list].find(x=>String(x.id)===key);
    if(existing) Object.assign(existing,item,{lastSeen:new Date().toISOString()});
    else state[list].push({...item,firstSeen:new Date().toISOString(),lastSeen:new Date().toISOString()});
    save(state);
  }
  window.SoyTungurahuaPassport={markAudio:item=>add('audios',item),markVisited:item=>add('visits',item),getState:load,clear:()=>save({...defaults}),key:KEY};
  const audioEl=document.getElementById('audioList'),visitEl=document.getElementById('visitList'),countEl=document.getElementById('passportCount'),meterEl=document.getElementById('passportMeter'),summaryEl=document.getElementById('passportSummary'),suggestionTitle=document.getElementById('suggestionTitle'),suggestionText=document.getElementById('suggestionText'),suggestionWhy=document.getElementById('suggestionWhy');
  const suggestions=[
    {tags:['agua','naturaleza'],title:'Sigue el agua.',text:'Busca un recorrido que conecte río, cascada, termalismo y paisaje.',why:'Tus intereses sugieren mirar cómo el agua organiza el territorio.',url:'que-hacer.html'},
    {tags:['historia','memoria'],title:'Ahora busca la memoria.',text:'Después de escuchar, compara el relato con fuentes y lugares.',why:'Tu recorrido ya tiene una pista histórica: ahora conviene contrastarla.',url:'explorar.html?q=historia'},
    {tags:['oficio','artesania','arte'],title:'Conoce a quien lo hace.',text:'El siguiente paso puede ser un taller, un artista o un oficio vivo.',why:'El territorio se entiende mejor cuando aparece la persona detrás del objeto.',url:'artesanos.html'},
    {tags:['patrimonio','fiesta','cultura'],title:'Ve más allá de la foto.',text:'Busca quién sostiene la práctica, cómo se transmite y qué significado tiene.',why:'Una manifestación cultural se entiende por sus relaciones, no sólo por su imagen.',url:'explorar.html?q=patrimonio%20vivo'},
    {tags:['turismo','ruta'],title:'Cambia de escala.',text:'Combina una experiencia popular con un lugar menos visible del mismo cantón.',why:'Tu pasaporte puede ayudarte a salir del circuito repetido.',url:'que-hacer.html'}
  ];
  const safe=s=>String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  function tagsOf(item){return [...(item.tags||[]),item.canton||'',item.categoria||'',item.type||''].join(' ').toLowerCase()}
  function choose(state){const text=state.audios.concat(state.visits).map(tagsOf).join(' ');let best=suggestions[0],score=-1;suggestions.forEach(s=>{const n=s.tags.reduce((a,t)=>a+(text.includes(t)?1:0),0);if(n>score){score=n;best=s}});return best}
  function empty(el,text){el.innerHTML='<div class="empty">'+text+'</div>'}
  function itemHtml(item,icon,removeList){return '<div class="passport-item"><span class="passport-icon">'+icon+'</span><div><b>'+safe(item.title||item.name||item.id)+'</b><small>'+safe(item.canton||item.type||'Territorio')+'</small></div><button type="button" data-remove="'+safe(removeList)+'" data-id="'+safe(item.id)+'">×</button></div>'}
  function render(){const state=load(),total=state.audios.length+state.visits.length;countEl.textContent=total;meterEl.style.width=Math.min(100,(total/MAX_PROGRESS)*100)+'%';summaryEl.textContent=total?state.audios.length+' audio'+(state.audios.length===1?'':'s')+' · '+state.visits.length+' lugar'+(state.visits.length===1?'':'es'):'Todavía no has guardado ninguna.';if(state.audios.length)audioEl.innerHTML=state.audios.slice().reverse().map(x=>itemHtml(x,'🎧','audios')).join('');else empty(audioEl,'Aquí aparecerán los audios que marques como escuchados.');if(state.visits.length)visitEl.innerHTML=state.visits.slice().reverse().map(x=>itemHtml(x,'📍','visits')).join('');else empty(visitEl,'Aquí aparecerán los lugares que marques como visitados.');const s=choose(state);suggestionTitle.textContent=s.title;suggestionText.textContent=s.text;suggestionWhy.textContent=s.why;const box=document.getElementById('suggestion');if(box){box.onclick=()=>{location.href=s.url};box.style.cursor='pointer'}}
  document.addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;const state=load();state[b.dataset.remove]=state[b.dataset.remove].filter(x=>String(x.id)!==String(b.dataset.id));save(state);render()});
  document.getElementById('clearPassport')?.addEventListener('click',()=>{if(confirm('¿Borrar el pasaporte guardado en este dispositivo?')){window.SoyTungurahuaPassport.clear();render()}});
  window.addEventListener('storage',render);window.addEventListener('soyTungurahuaPassportChanged',render);render();
})();
