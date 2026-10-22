/* Synchronisation en ligne des ateliers (Supabase). Si rien n'est configuré, l'atelier marche en local. */
(function(){
  const cfg=window.ATELIER_CONFIG||{};
  const child=window.APP_CHILD;
  const S={enabled:false,client:null,childId:null,status:'local',queue:[],timer:null,busy:false};
  const QK='atelier-sync-queue-'+(child||'x');
  try{S.queue=JSON.parse(localStorage.getItem(QK)||'[]')||[]}catch(e){S.queue=[]}
  const saveQ=()=>{try{localStorage.setItem(QK,JSON.stringify(S.queue.slice(-2000)))}catch(e){}};
  const configured=cfg.supabaseUrl&&cfg.supabaseAnonKey&&!/VOTRE|xxxx/i.test(cfg.supabaseUrl);
  if(configured&&window.supabase&&child){
    try{S.client=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);S.enabled=true}catch(e){S.enabled=false}
  }
  S.push=function(state){
    if(!S.enabled)return;
    clearTimeout(S.timer);
    S.timer=setTimeout(()=>S.flushState(state),2500);
  };
  S.flushState=async function(state){
    if(!S.enabled||!S.childId||!state)return;
    try{
      const {error}=await S.client.from('child_state').upsert({child_id:S.childId,state,updated_at:new Date(state.savedAt||Date.now()).toISOString()});
      S.status=error?'error':'ok';
    }catch(e){S.status='error'}
    S.paint();
  };
  S.attempt=function(row){
    S.queue.push(Object.assign({},row,{created_at:new Date().toISOString()}));saveQ();
    S.flushQueue();
  };
  S.flushQueue=async function(){
    if(!S.enabled||!S.childId||!S.queue.length||S.busy)return;
    S.busy=true;
    const batch=S.queue.slice(0,50).map(r=>Object.assign({},r,{child_id:S.childId}));
    let ok=false;
    try{const {error}=await S.client.from('attempts').insert(batch);ok=!error}catch(e){ok=false}
    if(ok){S.queue=S.queue.slice(batch.length);saveQ()}
    S.busy=false;S.status=ok?'ok':'error';S.paint();
    if(ok&&S.queue.length)S.flushQueue();
  };
  S.init=async function(){
    if(!S.enabled){S.paint();return}
    try{
      const {data:{session}}=await S.client.auth.getSession();
      if(!session){S.status='nologin';S.paint();return}
      const {data,error}=await S.client.from('children').select('id').eq('slug',child).limit(1);
      if(error||!data||!data.length){S.status='nochild';S.paint();return}
      S.childId=data[0].id;
      const {data:st}=await S.client.from('child_state').select('state,updated_at').eq('child_id',S.childId).maybeSingle();
      const local=window.getP?window.getP():null, localAt=(local&&local.savedAt)||0;
      const remoteAt=st?new Date(st.updated_at).getTime():0;
      if(st&&st.state&&remoteAt>localAt+1000&&window.onRemoteState)window.onRemoteState(st.state);
      else if(local)await S.flushState(local);
      S.status='ok';S.paint();S.flushQueue();
    }catch(e){S.status='error';S.paint()}
  };
  S.badge=function(){
    const m={local:['Progrès gardés sur cet appareil.',''],nologin:['Non connecté : progrès gardés sur cet appareil. <a href="index.html">Se connecter</a>','warn'],
      nochild:['Profil introuvable dans la famille. <a href="index.html">Vérifier</a>','warn'],ok:['Sauvegardé en ligne ✓','ok'],
      error:['Pas de connexion : je réessaie plus tard, rien n’est perdu.','warn']}[S.status]||['',''];
    return `<span id="syncbadge" class="syncbadge ${m[1]}">${m[0]}</span>`;
  };
  S.paint=function(){const el=document.getElementById('syncbadge');if(el)el.outerHTML=S.badge()};
  window.SYNC=S;
  window.addEventListener('online',()=>S.flushQueue());
  setInterval(()=>S.flushQueue(),60000);
})();
