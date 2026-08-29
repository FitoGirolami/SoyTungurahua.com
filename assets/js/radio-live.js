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
    let activeIndex=-1;
    let switching=false;
    let liveSeekPending=true;

    audio.setAttribute('playsinline','');
    audio.setAttribute('webkit-playsinline','');

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
        if(statusText)statusText.textContent=IS_IOS?'Señal activa en iPhone. La sincronización se ajusta cuando Safari habilita el salto en el audio.':'Estás escuchando el punto actual de la programación continua.';
      }
    }

    function updateActiveDuration(){
      if(activeIndex<0)return;
      const d=Number(audio.duration);
      if(Number.isFinite(d)&&d>0)tracks[activeIndex].duration=d;
    }

    function isSeekable(target){
      if(!Number.isFinite(target)||target<0)return false;
      try{
        if(!audio.seekable||!audio.seekable.length)return false;
        for(let i=0;i<audio.seekable.length;i++){
          if(target>=audio.seekable.start(i)&&target<=audio.seekable.end(i))return true;
        }
      }catch(e){}
      return false;
    }

    function seekToLive(force=false){
      if(activeIndex<0||audio.readyState<1)return false;
      updateActiveDuration();
      const pos=position();
      if(!pos||pos.index!==activeIndex)return false;
      const max=Math.max(0,(Number(audio.duration)||tracks[activeIndex].duration)-0.25);
      const target=Math.min(pos.offset,max);

      // iPhone Safari can stall if currentTime is changed before the remote MP3
      // exposes a seekable byte range. Wait until Safari confirms it is safe.
      if(IS_IOS&&!force&&!isSeekable(target)){
        liveSeekPending=true;
        return false;
      }

      if(Math.abs((audio.currentTime||0)-target)>2){
        try{
          audio.currentTime=target;
          liveSeekPending=false;
          return true;
        }catch(e){
          liveSeekPending=true;
          return false;
        }
      }
      liveSeekPending=false;
      return true;
    }

    function setTrack(index){
      if(index<0||index>=tracks.length)return;
      if(activeIndex===index&&audio.getAttribute('src'))return;
      switching=true;
      activeIndex=index;
      liveSeekPending=true;
      audio.preload='metadata';
      audio.src=tracks[index].src;
      try{audio.load()}catch(e){}
    }

    function armCurrentTrack(){
      const pos=position();
      if(!pos)return;
      setTrack(pos.index);
      // No autoplay and no early seek: this only lets Safari know which
      // media resource the next user gesture will play.
    }

    function reportPlayFailure(){
      if(statusTitle)statusTitle.textContent='Toca nuevamente para escuchar';
      if(statusText)statusText.textContent=IS_IOS?'Safari no habilitó el audio en este intento. Toca una vez más el botón de Radio.':'El navegador bloqueó el primer intento de audio. Toca nuevamente.';
      paint();
    }

    function startPlaybackFromGesture(){
      const pos=position();
      if(!pos)return;
      if(activeIndex!==pos.index)setTrack(pos.index);

      // play() is called directly inside the click handler: no await, fetch or
      // metadata probe is allowed before it on mobile browsers.
      let p;
      try{p=audio.play()}catch(e){reportPlayFailure();return}
      if(p&&typeof p.catch==='function')p.catch(reportPlayFailure);

      // Desktop can seek as soon as metadata exists. iOS waits for a seekable
      // range and therefore begins audibly instead of getting stuck seeking.
      if(!IS_IOS&&audio.readyState>=1)seekToLive(true);
    }

    function syncLive(autoplay=false){
      const pos=position();
      if(!pos)return;
      if(activeIndex!==pos.index){
        setTrack(pos.index);
        if(autoplay){
          let p;try{p=audio.play()}catch(e){}
          if(p&&typeof p.catch==='function')p.catch(()=>{});
        }
      }
      if(!IS_IOS||isSeekable(pos.offset))seekToLive(!IS_IOS);
      if(autoplay&&audio.paused){
        let p;try{p=audio.play()}catch(e){}
        if(p&&typeof p.catch==='function')p.catch(()=>{});
      }
    }

    function toggle(){
      if(audio.paused){
        if(statusTitle)statusTitle.textContent='Cargando Radio Soy Tungurahua…';
        if(statusText)statusText.textContent=IS_IOS?'Activando la señal para iPhone…':'Entrando al punto actual de la programación.';
        if(channel)channel.postMessage({type:'play'});
        startPlaybackFromGesture();
      }else{
        audio.pause();
        if(statusTitle)statusTitle.textContent='Radio pausada';
        if(statusText)statusText.textContent='Al volver a reproducir entrarás nuevamente a la programación.';
      }
      paint();
    }

    button.addEventListener('click',toggle,{passive:true});

    if(volume){
      if(IS_IOS){
        // iOS controls media volume with the hardware/system volume.
        volume.disabled=true;
        volume.setAttribute('aria-label','En iPhone usa los botones de volumen del dispositivo');
      }else{
        try{audio.volume=Number(volume.value)}catch(e){}
        volume.addEventListener('input',()=>{try{audio.volume=Number(volume.value)}catch(e){}});
      }
    }

    audio.addEventListener('loadedmetadata',()=>{
      updateActiveDuration();
      switching=false;
      if(!IS_IOS&&!audio.paused)seekToLive(true);
    });
    audio.addEventListener('durationchange',updateActiveDuration);
    audio.addEventListener('canplay',()=>{
      switching=false;
      if(!audio.paused&&liveSeekPending)seekToLive(false);
    });
    audio.addEventListener('progress',()=>{
      if(IS_IOS&&!audio.paused&&liveSeekPending)seekToLive(false);
    });
    audio.addEventListener('playing',()=>{
      paint();
      if(IS_IOS&&liveSeekPending)setTimeout(()=>seekToLive(false),350);
    });
    audio.addEventListener('play',paint);
    audio.addEventListener('pause',paint);
    audio.addEventListener('ended',()=>syncLive(true));
    audio.addEventListener('error',()=>{
      switching=false;
      if(statusTitle)statusTitle.textContent='⚠️ No se pudo conectar';
      if(statusText)statusText.textContent='El archivo de la transmisión no pudo abrirse en este navegador.';
    });

    if(channel){
      channel.addEventListener('message',e=>{
        if(e.data&&e.data.type==='play'&&!audio.paused){audio.pause();paint()}
      });
    }

    setInterval(()=>{if(!audio.paused)syncLive(false)},15000);

    if(statusTitle)statusTitle.textContent='▶ Señal lista';
    if(statusText)statusText.textContent=IS_IOS?'Señal preparada para iPhone. Toca “Escuchar radio”.':'Toca “Escuchar radio” para entrar al punto actual de la transmisión.';

    if('mediaSession' in navigator){
      try{
        navigator.mediaSession.metadata=new MediaMetadata({
          title:'Radio Soy Tungurahua',
          artist:'Soy Tungurahua',
          album:'Música, historias y voces del territorio',
          artwork:[{src:'https://soytungurahua.com/assets/og-soy-tungurahua-v2.jpg',sizes:'1200x630',type:'image/jpeg'}]
        });
        navigator.mediaSession.setActionHandler('play',()=>{if(audio.paused)startPlaybackFromGesture()});
        navigator.mediaSession.setActionHandler('pause',()=>audio.pause());
      }catch(e){}
    }

    // Critical for iPhone: choose and load the current block before the tap.
    armCurrentTrack();
    paint();
    return {syncLive,toggle};
  }

  window.SoyTungurahuaRadio={mount,tracks:DEFAULT_TRACKS};
})();