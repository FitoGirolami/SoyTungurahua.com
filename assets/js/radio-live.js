(()=>{
  const DEFAULT_TRACKS=[
    {id:'radio-v1',src:'https://github.com/FitoGirolami/SoyTungurahua.com/releases/download/radio-v1/radio-soy-tungurahua.mp3'},
    {id:'radio-v2',src:'https://soytungurahua.com/assets/audio/radio-soy-tungurahua-2.mp3'}
  ];
  const EPOCH=Date.UTC(2026,7,27,0,0,0)/1000;
  const CHANNEL='soy-tungurahua-radio';

  function probe(track){
    return new Promise(resolve=>{
      const probeAudio=new Audio();
      let done=false;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);probeAudio.removeAttribute('src');resolve(value)};
      const timer=setTimeout(()=>finish(null),12000);
      probeAudio.preload='metadata';
      probeAudio.addEventListener('loadedmetadata',()=>{
        const duration=Number(probeAudio.duration);
        finish(Number.isFinite(duration)&&duration>0?{...track,duration}:null);
      },{once:true});
      probeAudio.addEventListener('error',()=>finish(null),{once:true});
      probeAudio.src=track.src;
    });
  }

  function mount(options){
    const audio=options.audio;
    const button=options.button;
    if(!audio||!button)return null;
    const statusTitle=options.statusTitle||null;
    const statusText=options.statusText||null;
    const onAirLabel=options.onAirLabel||null;
    const volume=options.volume||null;
    const compact=!!options.compact;
    const channel='BroadcastChannel' in window?new BroadcastChannel(CHANNEL):null;
    let tracks=[];
    let activeIndex=-1;
    let switching=false;

    const ready=Promise.all((options.tracks||DEFAULT_TRACKS).map(probe)).then(items=>{
      tracks=items.filter(Boolean);
      if(!tracks.length)throw new Error('No hay bloques de radio disponibles');
      if(statusTitle)statusTitle.textContent='▶ Señal lista';
      if(statusText)statusText.textContent='Toca “Escuchar radio” para entrar al punto actual de la transmisión.';
      return tracks;
    }).catch(err=>{
      if(statusTitle)statusTitle.textContent='⚠️ No se pudo conectar';
      if(statusText)statusText.textContent='La transmisión no está disponible en este momento.';
      throw err;
    });

    function position(){
      if(!tracks.length)return null;
      const total=tracks.reduce((sum,t)=>sum+t.duration,0);
      if(!total)return null;
      let offset=(((Date.now()/1000)-EPOCH)%total+total)%total;
      for(let i=0;i<tracks.length;i++){
        if(offset<tracks[i].duration)return {index:i,offset,total};
        offset-=tracks[i].duration;
      }
      return {index:0,offset:0,total};
    }

    function protectNavigation(playing){
      document.querySelectorAll('a[href]').forEach(a=>{
        const href=a.getAttribute('href')||'';
        if(!href||href.startsWith('#')||href.startsWith('mailto:')||href.startsWith('tel:'))return;
        let url;try{url=new URL(href,location.href)}catch(e){return}
        if(url.origin!==location.origin)return;
        if(playing){
          if(!a.dataset.radioTargetStored){
            a.dataset.radioTargetStored='1';
            a.dataset.radioOriginalTarget=a.getAttribute('target')||'';
            a.dataset.radioOriginalRel=a.getAttribute('rel')||'';
          }
          a.setAttribute('target','_blank');
          a.setAttribute('rel','noopener');
        }else if(a.dataset.radioTargetStored){
          const target=a.dataset.radioOriginalTarget||'';
          const rel=a.dataset.radioOriginalRel||'';
          target?a.setAttribute('target',target):a.removeAttribute('target');
          rel?a.setAttribute('rel',rel):a.removeAttribute('rel');
          delete a.dataset.radioTargetStored;
          delete a.dataset.radioOriginalTarget;
          delete a.dataset.radioOriginalRel;
        }
      });
    }

    function paint(){
      const playing=!audio.paused;
      button.textContent=compact?(playing?'❚❚ Radio':'▶ Radio'):(playing?'❚❚ Pausar radio':'▶ Escuchar radio');
      button.classList.toggle('playing',playing);
      button.setAttribute('aria-label',playing?'Pausar Radio Soy Tungurahua':'Escuchar Radio Soy Tungurahua');
      if(onAirLabel)onAirLabel.textContent=playing?'EN VIVO':'TRANSMISIÓN ONLINE';
      protectNavigation(playing);
      if(playing&&statusTitle){
        statusTitle.textContent='🔴 Radio Soy Tungurahua · sonando';
        if(statusText)statusText.textContent='Estás escuchando el punto actual de la programación continua.';
      }
    }

    function seekCurrent(pos){
      if(!pos||activeIndex!==pos.index||audio.readyState<1)return;
      const max=Math.max(0,(Number(audio.duration)||tracks[pos.index].duration)-0.25);
      const target=Math.min(pos.offset,max);
      if(Math.abs((audio.currentTime||0)-target)>2)audio.currentTime=target;
    }

    async function syncLive(autoplay=false){
      await ready;
      const pos=position();
      if(!pos)return;
      if(activeIndex!==pos.index){
        switching=true;
        activeIndex=pos.index;
        audio.src=tracks[pos.index].src;
        audio.load();
        const place=()=>{
          seekCurrent(pos);
          switching=false;
          if(autoplay)audio.play().catch(()=>{});
        };
        if(audio.readyState>=1)place();
        else audio.addEventListener('loadedmetadata',place,{once:true});
        if(autoplay)audio.play().catch(()=>{});
      }else{
        seekCurrent(pos);
        if(autoplay)await audio.play();
      }
    }

    async function toggle(){
      if(audio.paused){
        if(statusTitle)statusTitle.textContent='Cargando Radio Soy Tungurahua…';
        if(statusText)statusText.textContent='Entrando al punto actual de la programación.';
        try{
          await ready;
          if(channel)channel.postMessage({type:'play'});
          await syncLive(true);
        }catch(e){
          if(statusTitle)statusTitle.textContent='No se pudo iniciar el audio';
          if(statusText)statusText.textContent='Toca nuevamente para escuchar.';
        }
      }else{
        audio.pause();
        if(statusTitle)statusTitle.textContent='Radio pausada';
        if(statusText)statusText.textContent='Al volver a reproducir entrarás al punto actual de la programación.';
      }
      paint();
    }

    button.addEventListener('click',toggle);
    if(volume){
      audio.volume=Number(volume.value);
      volume.addEventListener('input',()=>audio.volume=Number(volume.value));
    }
    audio.addEventListener('play',paint);
    audio.addEventListener('pause',paint);
    audio.addEventListener('ended',()=>syncLive(true));
    audio.addEventListener('error',()=>{
      if(switching)return;
      if(statusTitle)statusTitle.textContent='⚠️ No se pudo conectar';
      if(statusText)statusText.textContent='Este bloque de la transmisión no está disponible.';
    });
    if(channel){
      channel.addEventListener('message',e=>{
        if(e.data&&e.data.type==='play'&&!audio.paused){audio.pause();paint()}
      });
    }
    setInterval(()=>{if(!audio.paused)syncLive(false).catch(()=>{})},15000);
    ready.then(()=>syncLive(false)).catch(()=>{});

    if('mediaSession' in navigator){
      try{
        navigator.mediaSession.metadata=new MediaMetadata({
          title:'Radio Soy Tungurahua',
          artist:'Soy Tungurahua',
          album:'Música, historias y voces del territorio',
          artwork:[{src:'https://soytungurahua.com/assets/og-soy-tungurahua-v2.jpg',sizes:'1200x630',type:'image/jpeg'}]
        });
        navigator.mediaSession.setActionHandler('play',()=>syncLive(true));
        navigator.mediaSession.setActionHandler('pause',()=>audio.pause());
      }catch(e){}
    }
    paint();
    return {ready,syncLive,toggle};
  }

  window.SoyTungurahuaRadio={mount,tracks:DEFAULT_TRACKS};
})();