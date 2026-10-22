/* Outils communs : connexion Supabase, famille, enfants */
const CFG=window.ATELIER_CONFIG||{};
const CONFIGURED=!!(CFG.supabaseUrl&&CFG.supabaseAnonKey&&!/VOTRE|xxxx/i.test(CFG.supabaseUrl));
const SB=(CONFIGURED&&window.supabase)?window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey):null;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const APP_KEYS={jade:'jade-atelier-v2',mael:'mael-quete-v1',lanahee:'lanahee-royaume-v1',lila:'lila-club-v1'};
// Les ateliers existants : une page par enfant
const ATELIERS={
  jade:{first_name:'Jade',grade:'CM2',page:'jade.html',btn:'Mon atelier',cls:'fr'},
  mael:{first_name:'Mael',grade:'CE1',page:'mael.html',btn:'Ma quête',cls:''},
  lila:{first_name:'Lila',grade:'CM1',page:'lila.html',btn:'Mon club',cls:'fr'},
  lanahee:{first_name:'Lanahée',grade:'CP',page:'lanahee.html',btn:'Mon royaume',cls:''}
};
async function currentUser(){if(!SB)return null;const {data:{session}}=await SB.auth.getSession();return session?session.user:null}
async function myFamily(){
  if(!SB)return null;
  try{await SB.rpc('accept_invites')}catch(e){}
  // Un parent peut suivre plusieurs familles : on prend d'abord celle qu'il a créée
  const {data,error}=await SB.from('family_members').select('family_id,role,created_at,families(name)').order('created_at');
  if(data)data.sort((a,b)=>(b.role==='owner')-(a.role==='owner'));
  if(error||!data||!data.length)return null;
  return {id:data[0].family_id,role:data[0].role,name:data[0].families?data[0].families.name:'Famille'};
}
async function myChildren(){
  const {data}=await SB.from('children').select('id,slug,first_name,grade,family_id').order('slug');
  return data||[];
}
function needConfig(el){
  el.innerHTML=`<div class="card"><h2>Presque prêt !</h2><p>Le site n'est pas encore relié à votre base Supabase. Ouvrez le fichier <b>config.js</b> et collez-y l'adresse et la clé de votre projet (voir le guide, étape 2).</p>
  <p class="sub">En attendant, les ateliers marchent déjà sur cet appareil.</p></div>`;
}
function download(name,text,type){
  const blob=new Blob([text],{type:type||'application/json'});const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
