(()=>{
  const DEFAULT_TRACKS=[
    {id:'radio-v1',src:'https://github.com/FitoGirolami/SoyTungurahua.com/releases/download/radio-v1/radio-soy-tungurahua.mp3',duration:3851.8},
    {id:'radio-v2',src:'https://github.com/FitoGirolami/SoyTungurahua.com/releases/download/radio-v1/radio-soy-tungurahua-2.mp3',duration:3502.56}
  ];
  const EPOCH=Date.UTC(2026,7,27,0,0,0)/1000;
  const CHANNEL='soy-tungurahua-radio';
  const IS_IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

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
    const tracks=(options.tracks||DEFAULT_TRACKS).map(t=>({...t}));

    audio.setAttribute('playsinline','');
    audio.setAttribute('webkit-playsinline','');

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
        if(statusText)statusText.textContent=IS_IOS?'Señal compatible activada para iPhone.':'Estás escuchando el punto actual de la programación continua.';
      }
    }

    // iPhone/iPad: restore the exact playback model that was working before
    // the multi-block engine was introduced. Safari receives block 1 directly
    // in the <audio> element, preloads it and only then the user gesture plays it.
    // This intentionally favors reliable playback over multi-file switching.
    if(IS_IOS){
      audio.preload='auto';
      audio.loop=true;
      if(!audio.getAttribute('src')&&!audio.querySelector('source')){
        audio.src=tracks[0].src;
      }
      try{audio.load()}catch(e){}

      function iosLiveOffset(){
        const duration=Number(audio.duration);
        if(!Number.isFinite(duration)||duration<=0)return 0;
        return (((Date.now()/1000)-EPOCH)%duration+duration)%duration;
      }

      function iosSyncLive(){
        if(audio.readyState<1)return;
        const target=iosLiveOffset();
        if(!Number.isFinite(target))return;
        try{
          if(Math.abs((audio.currentTime||0)-target)>2)audio.currentTime=target;
        }catch(e){}
      }

      function iosPlay(){
        if(channel)channel.postMessage({type:'play'});
        if(audio.readyState>=1)iosSyncLive();
        if(statusTitle)statusTitle.textContent='Cargando Radio Soy Tungurahua…';
        if(statusText)statusText.textContent='Entrando a la señal compatible para iPhone.';
        let p;
        try{p=audio.play()}catch(e){
          if(statusTitle)statusTitle.textContent='No se pudo iniciar el audio';
          if(statusText)statusText.textContent='Toca nuevamente “Escuchar radio”.';
          return;
        }
        if(p&&typeof p.catch==='function')p.catch(()=>{
          if(statusTitle)statusTitle.textContent='No se pudo iniciar el audio';
          if(statusText)statusText.textContent='Toca nuevamente “Escuchar radio”.';
          paint();
        });
      }

      function iosToggle(){
        if(audio.paused)iosPlay();
        else{
          audio.pause();
          if(statusTitle)statusTitle.textContent='Radio pausada';
          if(statusText)statusText.textContent='Toca “Escuchar radio” para volver a la señal.';
        }
        paint();
      }

      button.addEventListener('click',iosToggle);
      if(volume){
        volume.disabled=true;
        volume.setAttribute('aria-label','En iPhone usa los botones de volumen del dispositivo');
      }
      audio.addEventListener('loadedmetadata',()=>{
        iosSyncLive();
        if(statusTitle)statusTitle.textContent='▶ Señal lista';
        if(statusText)statusText.textContent='Toca “Escuchar radio”.';
      });
      audio.addEventListener('play',paint);
      audio.addEventListener('playing',paint);
      audio.addEventListener('pause',paint);
      audio.addEventListener('error',()=>{
        if(statusTitle)statusTitle.textContent='⚠️ No se pudo conectar';
        if(statusText)statusText.textContent='Safari no pudo abrir el archivo de la transmisión.';
      });
      if(channel){
        channel.addEventListener('message',e=>{
          if(e.data&&e.data.type==='play'&&!audio.paused){audio.pause();paint()}
        });
      }
      setInterval(()=>{if(!audio.paused)iosSyncLive()},30000);

      if('mediaSession' in navigator){
        try{
          navigator.mediaSession.metadata=new MediaMetadata({
            title:'Radio Soy Tungurahua',
            artist:'Soy Tungurahua',
            album:'Música, historias y voces del territorio',
            artwork:[{src:'https://soytungurahua.com/assets/og-soy-tungurahua-v2.jpg',sizes:'1200x630',type:'image/jpeg'}]
          });
          navigator.mediaSession.setActionHandler('play',iosPlay);
          navigator.mediaSession.setActionHandler('pause',()=>audio.pause());
        }catch(e){}
      }

      if(statusTitle)statusTitle.textContent='▶ Señal lista';
      if(statusText)statusText.textContent='Toca “Escuchar radio”.';
      paint();
      return {syncLive:iosSyncLive,toggle:iosToggle,mode:'ios-compatible'};
    }

    // Desktop/other browsers keep the two-block synchronized cycle.
    let activeIndex=-1;
    let switching=false;

    function position(){
      const total=tracks.reduce((sum,t)=>sum+(Number(t.duration)||0),0);
      if(!total)return null;
      let offset=(((Date.now()/1000)-EPOCH)%total+total)%total;
      for(let i=0;i<tracks.length;i++){
        if(offset<tracks[i].duration)return {index:i,offset,total};
        offset-=tracks[i].duration;
      }
      return {index:0,offset:0,total};
    }

    function updateActiveDuration(){
      if(activeIndex<0)return;
      const d=Number(audio.duration);
      if(Number.isFinite(d)&&d>0)tracks[activeIndex].duration=d;
    }

    function seekToLive(){
      if(activeIndex<0||audio.readyState<1)return;
      updateActiveDuration();
      const pos=position();
      if(!pos||pos.index!==activeIndex)return;
      const max=Math.max(0,(Number(audio.duration)||tracks[activeIndex].duration)-0.25);
      const target=Math.min(pos.offset,max);
      try{if(Math.abs((audio.currentTime||0)-target)>2)audio.currentTime=target}catch(e){}
    }

    function setTrack(index){
      if(index<0||index>=tracks.length)return;
      if(activeIndex===index&&audio.getAttribute('src'))return;
      switching=true;
      activeIndex=index;
      audio.preload='metadata';
      audio.loop=false;
      audio.src=tracks[index].src;
      try{audio.load()}catch(e){}
    }

    function syncLive(autoplay=false){
      const pos=position();
      if(!pos)return;
      if(activeIndex!==pos.index){
        setTrack(pos.index);
        const place=()=>{
          seekToLive();
          switching=false;
          if(autoplay){
            const p=audio.play();
            if(p&&typeof p.catch==='function')p.catch(()=>{});
          }
        };
        if(audio.readyState>=1)place();
        else audio.addEventListener('loadedmetadata',place,{once:true});
      }else{
        seekToLive();
        if(autoplay&&audio.paused){
          const p=audio.play();
          if(p&&typeof p.catch==='function')p.catch(()=>{});
        }
      }
    }

    function toggle(){
      if(audio.paused){
        if(statusTitle)statusTitle.textContent='Cargando Radio Soy Tungurahua…';
        if(statusText)statusText.textContent='Entrando al punto actual de la programación.';
        if(channel)channel.postMessage({type:'play'});
        const pos=position();
        if(pos&&activeIndex!==pos.index)setTrack(pos.index);
        let p;try{p=audio.play()}catch(e){p=null}
        if(p&&typeof p.catch==='function')p.catch(()=>{
          if(statusTitle)statusTitle.textContent='No se pudo iniciar el audio';
          if(statusText)statusText.textContent='Toca nuevamente para escuchar.';
        });
        if(audio.readyState>=1)seekToLive();
      }else{
        audio.pause();
        if(statusTitle)statusTitle.textContent='Radio pausada';
        if(statusText)statusText.textContent='Al volver a reproducir entrarás nuevamente a la programación.';
      }
      paint();
    }

    button.addEventListener('click',toggle);
    if(volume){
      try{audio.volume=Number(volume.value)}catch(e){}
      volume.addEventListener('input',()=>{try{audio.volume=Number(volume.value)}catch(e){}});
    }
    audio.addEventListener('loadedmetadata',()=>{updateActiveDuration();switching=false;if(!audio.paused)seekToLive()});
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
    setInterval(()=>{if(!audio.paused)syncLive(false)},15000);

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

    syncLive(false);
    if(statusTitle)statusTitle.textContent='▶ Señal lista';
    if(statusText)statusText.textContent='Toca “Escuchar radio” para entrar al punto actual de la transmisión.';
    paint();
    return {syncLive,toggle,mode:'multi-block'};
  }

  window.SoyTungurahuaRadio={mount,tracks:DEFAULT_TRACKS};
})();