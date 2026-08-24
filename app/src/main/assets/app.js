// ═══════════ HELPERS ═══════════
const $ = id => document.getElementById(id);
function normalizeApiUrl(url) {
  if (!url) return url;
  url = url.trim();
  if (url.startsWith('http://') && !url.startsWith('http://localhost') && !url.startsWith('http://127.')) url = 'https://' + url.slice(7);
  return url.replace(/\/+$/, '');
}
const DEFAULT_API = 'https://activity-twentyfour.onrender.com/api';
const LIME_EXTERNAL_ASSET_APP_ID = '962990036020756480';

// ═══════════ THEME ═══════════
const THEMES = ['kawaii','dark','light','sanrio','cyberpunk','minimal'];
  function applyTheme(theme) {
    const safe = THEMES.includes(theme) ? theme : 'kawaii';
    document.documentElement.className = safe === 'dark' ? '' : safe;
    localStorage.setItem('ds_theme', safe);
    document.querySelectorAll('.theme-choice').forEach(s => s.classList.toggle('active', s.dataset.theme === safe));
  }
  function initTheme() { const s = localStorage.getItem('ds_theme') || 'kawaii'; applyTheme(s); }
  initTheme();
  $('theme-orb-btn').addEventListener('click', e => { e.stopPropagation(); $('theme-orb').classList.toggle('open'); });
  document.querySelectorAll('.theme-choice').forEach(btn => btn.addEventListener('click', () => { applyTheme(btn.dataset.theme); $('theme-orb').classList.remove('open'); }));
  document.addEventListener('click', e => { if ($('theme-orb') && !$('theme-orb').contains(e.target)) $('theme-orb').classList.remove('open'); });

// ═══════════ SERVER TEST ═══════════
async function testServerConnection(apiBase) {
  apiBase = normalizeApiUrl(apiBase);
  if (!apiBase) return;
  const r=$('test-result'), btn=$('test-server-btn');
  btn.disabled=true; btn.textContent='…';
  r.className=''; r.textContent=''; r.classList.remove('hidden');
  try {
    const ctrl=new AbortController(), t=setTimeout(()=>ctrl.abort(),7000);
    const res=await fetch(apiBase+'/health',{signal:ctrl.signal});
    clearTimeout(t);
    if (res.ok) { r.className='test-result test-ok'; r.textContent='✓ Server reachable'; }
    else { r.className='test-result test-fail'; r.textContent=`✗ HTTP ${res.status}`; }
  } catch(e) { r.className='test-result test-fail'; r.textContent='✗ '+(e.name==='AbortError'?'Timed out':String(e.message||e).slice(0,50)); }
  finally { btn.disabled=false; btn.textContent='⚡ Test Connection'; }
}
$('test-server-btn').addEventListener('click',()=>testServerConnection($('server-url-input').value.trim()));

// ═══════════ IMAGE URL FORMATTER ═══════════
  function isHttpUrl(value){return /^https?:\/\//i.test(value||'');}
  function cleanAssetKey(value){return String(value||'').trim().replace(/^asset:\/\//,'').replace(/^app-assets:\/\//,'').replace(/^mp:app-assets\/\d+\//,'');}
  function stripImgExt(key){return String(key||'').replace(/\.(?:png|jpe?g|webp|gif)(?:[?#].*)?$/i,'');}
  function ensureImgExt(key){return /\.(?:png|jpe?g|webp|gif)(?:[?#].*)?$/i.test(key)?key:key+'.png';}
  function discordUrlParts(value){
    try{
      const u=new URL(value);
      const host=u.hostname.toLowerCase();
      if(host!=='cdn.discordapp.com'&&host!=='media.discordapp.net')return null;
      const appAsset=u.pathname.match(/^\/app-assets\/(\d+)\/(.+?)(?:\.(?:png|jpe?g|webp|gif))?$/i);
      if(appAsset)return{kind:'appAsset',appId:appAsset[1],key:stripImgExt(appAsset[2])};
      const attachment=u.pathname.match(/^\/attachments\/(\d+)\/(\d+)\/(.+)$/i);
      if(attachment)return{kind:'attachment',channelId:attachment[1],messageId:attachment[2],file:attachment[3]};
      return null;
    }catch{return null;}
  }
  function formatPresenceImage(raw, appid) {
    const value=String(raw||'').trim();
    if(!value)return '';
    if(value.startsWith('spotify:'))return value;
    const mpAppAsset=value.match(/^mp:app-assets\/(\d+)\/(.+)$/);
    if(mpAppAsset){if(appid&&mpAppAsset[1]===appid)return stripImgExt(mpAppAsset[2]);return'mp:app-assets/'+mpAppAsset[1]+'/'+stripImgExt(mpAppAsset[2]);}
    if(value.startsWith('mp:'))return value;
    if(!isHttpUrl(value)){
      const key=stripImgExt(cleanAssetKey(value));
      return appid&&key?key:'';
    }
    const d=discordUrlParts(value);
    if(d&&d.kind==='appAsset')return'mp:app-assets/'+d.appId+'/'+d.key;
    if(d&&d.kind==='attachment')return'mp:attachments/'+d.channelId+'/'+d.messageId+'/'+d.file;
    return '';
  }
  function previewImageUrl(raw, appid) {
    const value=String(raw||'').trim();
    if(!value)return '';
    if(isHttpUrl(value))return value;
    if(value.startsWith('mp:attachments/'))return 'https://cdn.discordapp.com/attachments/'+value.slice('mp:attachments/'.length);
    const appAsset=value.startsWith('mp:app-assets/')?value.match(/^mp:app-assets\/(\d+)\/(.+)$/):null;
    if(appAsset)return 'https://cdn.discordapp.com/app-assets/'+appAsset[1]+'/'+ensureImgExt(appAsset[2]);
    if(appid)return 'https://cdn.discordapp.com/app-assets/'+appid+'/'+ensureImgExt(stripImgExt(cleanAssetKey(value)));
    return '';
  }
  function imgStatusMessage(raw, appid, label){
    const value=String(raw||'').trim();
    if(!value)return '';
    if(value.startsWith('spotify:'))return label+': Spotify image id will be sent as-is.';
    if(value.startsWith('mp:'))return label+': Discord media-proxy value will be sent as-is.';
    if(!isHttpUrl(value))return appid?label+': uploaded app asset key will be sent as '+stripImgExt(cleanAssetKey(value))+' with Application ID '+appid+'.':label+': missing Application ID, so Discord cannot resolve this uploaded asset key.';
    const d=discordUrlParts(value);
    if(d&&d.kind==='appAsset')return label+': Discord app asset URL detected and converted.';
    if(d&&d.kind==='attachment')return label+': Discord attachment URL detected. The app will try Discord external-assets first, then fall back to the attachment media-proxy path.';
    return label+': external URL will be resolved through Discord external-assets when you apply. If that fails, upload it as a Rich Presence asset or use a Discord attachment URL.';
  }
  function updateAssetStatus(){
    const el=$('asset-preview-note');if(!el)return;
    const appid=$('act-appid').value.trim();
    const smAppid=$('act-sm-appid').value.trim()||appid;
    const msgs=[imgStatusMessage($('act-lg-img').value,appid,'Large image'),imgStatusMessage($('act-sm-img').value,smAppid,'Small image')].filter(Boolean);
    el.textContent=msgs.join(' ');
  }
  function needsExternalAssetResolve(value){
    if(!isHttpUrl(value))return false;
    const d=discordUrlParts(value);
    return !(d&&d.kind==='appAsset');
  }
  let lastAssetResolveError='';
  let lastLargeAssetResolveError='';
  async function resolveExternalAssetUrl(url, appid){
    lastAssetResolveError='';
    const token=savedToken||localStorage.getItem('ds_token');
    if(!token){lastAssetResolveError='Not logged in.';return '';}
    const targetAppId=appid||LIME_EXTERNAL_ASSET_APP_ID;
    const apiBase=normalizeApiUrl((Server&&Server.baseUrl)||savedApiBase||localStorage.getItem('ds_api_base')||DEFAULT_API);
    if(apiBase){
      try{
        const proxy=await fetch(apiBase+'/discord/external-assets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,url,applicationId:targetAppId})});
        if(proxy.ok){
          const data=await proxy.json();
          if(data&&data.image)return data.image;
          if(data&&data.externalAssetPath)return 'mp:'+data.externalAssetPath;
          lastAssetResolveError='Server proxy returned no image path.';
        }else{
          lastAssetResolveError='Server proxy HTTP '+proxy.status;
        }
      }catch(e){lastAssetResolveError='Server proxy error: '+String(e.message||e).slice(0,80);}
    }
    // Fallback: call Discord's external-assets endpoint directly from the client.
    try{
      const res=await fetch('https://discord.com/api/v9/applications/'+targetAppId+'/external-assets',{method:'POST',headers:{'Authorization':token,'Content-Type':'application/json'},body:JSON.stringify({urls:[url]})});
      if(!res.ok){
        let body='';try{body=await res.text();}catch{}
        lastAssetResolveError='Discord API HTTP '+res.status+(body?': '+body.slice(0,120):'');
        return '';
      }
      const data=await res.json();
      const path=Array.isArray(data)&&data[0]&&data[0].external_asset_path;
      if(path)return 'mp:'+path;
      lastAssetResolveError='Discord API returned no asset path (image host may be blocked/unreachable by Discord).';
      return '';
    }catch(e){lastAssetResolveError='Discord API error: '+String(e.message||e).slice(0,80);return '';}
  }
  async function resolvePresenceImages(p){
    const a=p.activities&&p.activities[0];
    if(!a)return p;
    const appid=$('act-appid').value.trim();
    const smAppid=$('act-sm-appid').value.trim()||appid;
    const largeRaw=$('act-lg-img').value.trim();
    const smallRaw=$('act-sm-img').value.trim();
    const largeResolved=needsExternalAssetResolve(largeRaw)?await resolveExternalAssetUrl(largeRaw,appid):'';
    // BUGFIX: capture the large-image error immediately after its own resolve call,
    // before the small-image resolve call (below) overwrites the shared error variable.
    lastLargeAssetResolveError = largeResolved ? '' : lastAssetResolveError;
    const smallResolved=needsExternalAssetResolve(smallRaw)?await resolveExternalAssetUrl(smallRaw,smAppid):'';
    if(largeResolved||smallResolved){
      a.assets=a.assets||{};
      if(largeResolved)a.assets.large_image=largeResolved;
      if(smallResolved)a.assets.small_image=smallResolved;
    }
    return p;
  }

// ═══════════ PRESENCE BUILDER ═══════════
function buildPresence() {
  const p={status:currentStatus,afk:false,since:null,activities:[]};
  if (activityEnabled) {
    const type=parseInt($('act-type').value), name=$('act-name').value.trim()||'Unknown';
    const a={name,type};
    if (type===1){const url=$('act-url').value.trim();if(url)a.url=url;}
    const details=$('act-details').value.trim(), state=$('act-state').value.trim(), appid=$('act-appid').value.trim();
    if(details)a.details=details; if(state)a.state=state; if(appid)a.application_id=appid;
    const platform=$('act-platform').value.trim();if(platform)a.platform=platform;
    const tsStart=$('act-ts-start').value, tsEnd=$('act-ts-end').value;
    if(tsStart||tsEnd){a.timestamps={};if(tsStart)a.timestamps.start=new Date(tsStart).getTime();if(tsEnd)a.timestamps.end=new Date(tsEnd).getTime();}
    const smAppid=$('act-sm-appid').value.trim();
    const smRawVal=$('act-sm-img').value.trim();
    const li=formatPresenceImage($('act-lg-img').value.trim(),appid),lt=$('act-lg-txt').value.trim();
    // If small image has its own app ID that differs from the main one, use the explicit
    // mp:app-assets/APPID/KEY format so Discord resolves it against the correct application.
    let si;
    if(smAppid&&smAppid!==appid&&smRawVal&&!isHttpUrl(smRawVal)&&!smRawVal.startsWith('mp:')&&!smRawVal.startsWith('spotify:')){
      const key=stripImgExt(cleanAssetKey(smRawVal));
      si=key?'mp:app-assets/'+smAppid+'/'+key:'';
    }else{
      si=formatPresenceImage(smRawVal,smAppid||appid);
    }
    const st=$('act-sm-txt').value.trim();
    if(li||lt||si||st){a.assets={};if(li)a.assets.large_image=li;if(lt)a.assets.large_text=lt;if(si)a.assets.small_image=si;if(st)a.assets.small_text=st;if(smAppid)a.assets.small_app_id=smAppid;}
    const buttons=[];
    for(let i=0;i<2;i++){const lEl=$(`btn-label-${i}`),uEl=$(`btn-url-${i}`);if(lEl&&uEl&&lEl.value.trim())buttons.push({label:lEl.value.trim(),url:uEl.value.trim()});}
    if(buttons.length){a.buttons=buttons.map(b=>b.label);a.metadata={button_urls:buttons.map(b=>b.url)};}
    p.activities=[a];
  }
  return p;
}

// ═══════════ DISCORD GATEWAY ═══════════
class DiscordGateway {
  constructor(token){this.token=token;this.ws=null;this.seq=null;this.sessionId=null;this.resumeUrl=null;this.hbInterval=null;this.reconnectTimer=null;this.shouldReconnect=false;this.currentPresence=null;this.pendingPresence=null;this._state='disconnected';this.handlers={};}
  on(ev,fn){(this.handlers[ev]=this.handlers[ev]||[]).push(fn);}
  emit(ev,data){(this.handlers[ev]||[]).forEach(h=>h(data));}
  setState(s){this._state=s;this.emit('stateChange',s);}
  connect(){this.shouldReconnect=true;this._connect();}
  _connect(){
    const url=(this.resumeUrl&&this.sessionId)?this.resumeUrl+'?v=10&encoding=json':'wss://gateway.discord.gg/?v=10&encoding=json';
    this.setState('connecting');this.ws=new WebSocket(url);
    this.ws.onmessage=e=>{try{this._handle(JSON.parse(e.data));}catch{}};
    this.ws.onclose=e=>{
      this._cleanup();const fatal=[4004,4010,4011,4012,4013,4014];
      if(fatal.includes(e.code)){this.setState('error');this.emit('error',`Gateway error ${e.code}: ${e.reason||'Authentication failed — check your token'}`);this.shouldReconnect=false;return;}
      if(this.shouldReconnect){this.reconnectTimer=setTimeout(()=>this._connect(),5000);}else{this.setState('disconnected');}
    };
    this.ws.onerror=()=>{};
  }
  _handle(p){
    if(p.s!=null)this.seq=p.s;
    switch(p.op){
      case 10:{const iv=(p.d&&p.d.heartbeat_interval)||41250;this._startHb(iv);(this.sessionId&&this.resumeUrl)?this._resume():this._identify();break;}
      case 0:this._dispatch(p.t,p.d);break;
      case 9:this.sessionId=null;this.resumeUrl=null;setTimeout(()=>this._identify(),1000);break;
      case 7:this.ws&&this.ws.close();break;
    }
  }
  _dispatch(t,d){
    if(!t)return;
    if(t==='READY'){this.sessionId=d.session_id;this.resumeUrl=d.resume_gateway_url;this.setState('connected');this.emit('ready',d.user);if(this.pendingPresence){this.updatePresence(this.pendingPresence);this.pendingPresence=null;}else if(this.currentPresence){this.updatePresence(this.currentPresence);}}
    if(t==='RESUMED'){this.setState('connected');if(this.currentPresence)this.updatePresence(this.currentPresence);}
  }
  _identify(){this._send({op:2,d:{token:this.token,capabilities:16381,properties:{os:'Windows',browser:'Chrome',device:'',system_locale:'en-US',browser_user_agent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',browser_version:'120.0.0.0',os_version:'10',referrer:'',referring_domain:'',referrer_current:'',referring_domain_current:'',release_channel:'stable',client_build_number:9999,client_event_source:null},presence:{status:'online',since:0,activities:[],afk:false},compress:false,client_state:{guild_versions:{}}}});}
  _resume(){this._send({op:6,d:{token:this.token,session_id:this.sessionId,seq:this.seq}});}
  _startHb(iv){this._cleanup();const j=Math.random()*iv;setTimeout(()=>{this._hb();this.hbInterval=setInterval(()=>this._hb(),iv);},j);}
  _hb(){this._send({op:1,d:this.seq});}
  _send(d){if(this.ws&&this.ws.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify(d));}
  updatePresence(p){this.currentPresence=p;if(this._state!=='connected'){this.pendingPresence=p;return;}this._send({op:3,d:{since:p.since||null,activities:p.activities||[],status:p.status,afk:p.afk||false}});}
  clearPresence(status='online'){this.currentPresence={status,activities:[],afk:false,since:null};this.pendingPresence=null;this._send({op:3,d:{since:null,activities:[],status,afk:false}});}
  disconnect(){this.shouldReconnect=false;this._cleanup();if(this.ws){try{this.ws.close();}catch{}this.ws=null;}this.setState('disconnected');}
  _cleanup(){if(this.hbInterval){clearInterval(this.hbInterval);this.hbInterval=null;}if(this.reconnectTimer){clearTimeout(this.reconnectTimer);this.reconnectTimer=null;}}
}

// ═══════════ SERVER CLIENT ═══════════
const Server={
  baseUrl:null,sessionId:null,expiresAt:null,pollTimer:null,_token:null,
  init(u){this.baseUrl=normalizeApiUrl(u);},
  async startSession(token){
    this._token=token;
    const res=await fetch(this.baseUrl+'/discord/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
    if(!res.ok){let b='';try{b=await res.text();}catch{}throw new Error(`HTTP ${res.status}${b?' — '+b.slice(0,150):''}`);}
    const data=await res.json();this.sessionId=data.sessionId;this.expiresAt=data.expiresAt;this._startPolling();return data;
  },
  async stopSession(){if(!this.sessionId)return;this._stopPolling();try{await fetch(this.baseUrl+'/discord/sessions/'+this.sessionId,{method:'DELETE'});}catch{}this.sessionId=null;this.expiresAt=null;},
  async updatePresence(p){if(!this.sessionId)return false;try{const r=await fetch(this.baseUrl+'/discord/sessions/'+this.sessionId+'/presence',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});return r.ok;}catch{return false;}},
  async getStatus(){if(!this.sessionId)return null;try{const r=await fetch(this.baseUrl+'/discord/sessions/'+this.sessionId);if(r.status===404){this.sessionId=null;return null;}return await r.json();}catch{return null;}},
  _startPolling(){this._stopPolling();this.pollTimer=setInterval(async()=>{const s=await this.getStatus();if(!s){this._stopPolling();setBannerBrowserMode('Server session expired or was stopped');}else{setBannerServerActive(s.expiresAt||this.expiresAt);}},15000);},
  _stopPolling(){if(this.pollTimer){clearInterval(this.pollTimer);this.pollTimer=null;}},
  isActive(){return!!this.sessionId;}
};

  async function stopStoredServerSession(apiBase=savedApiBase||localStorage.getItem('ds_api_base')||DEFAULT_API, sessionId=localStorage.getItem('ds_session_id')){
    apiBase=normalizeApiUrl(apiBase);
    if(!apiBase||!sessionId)return false;
    try{await fetch(apiBase+'/discord/sessions/'+sessionId,{method:'DELETE'});return true;}catch{return false;}
  }
  async function stopEverything(opts={}){
    const keepGateway=opts.disconnectGateway===false;
    const status=currentStatus||'online';
    if(Server.isActive())await Server.stopSession();
    await stopStoredServerSession();
    if(gw&&gw._state==='connected')gw.clearPresence(status);
    if(gw&&!keepGateway){gw.disconnect();gw=null;}
    localStorage.removeItem('ds_session_id');localStorage.removeItem('ds_session_expires');
    if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
    if(rpElapsedTimer){clearInterval(rpElapsedTimer);rpElapsedTimer=null;}
    // BUGFIX: also stop the music-driven activity indicator/state when stopping everything
    if (typeof stopMusicActivityUI === 'function') stopMusicActivityUI();
    isActive=false;setActivityEnabled(false);setBannerNoServer();updateConnBadge(gw?gw._state:'disconnected');updateStatBar();
  }
  function updateProfileActivity(){
    const run=$('profile-running'); if(!run)return;
    if(isActive&&activityEnabled){
      const p=buildPresence(); const a=p.activities&&p.activities[0];
      run.textContent=a?'Running activity: '+a.name+(a.details?' — '+a.details:''):'Running activity: custom status';
    } else run.textContent='Running activity: none';
  }


// ═══════════ APP STATE ═══════════
let gw=null, currentStatus='online', activityEnabled=false, isActive=false;
let buttonIds=[], presets=[], timerInterval=null, savedToken='', savedApiBase='';
try{presets=JSON.parse(localStorage.getItem('ds_presets')||'[]');}catch{}

  const PREBUILT_PRESETS=[
    ['Minecraft','online',0,'Minecraft','Building a cozy base','Survival mode','minecraft'],
    ['Valorant','dnd',0,'VALORANT','Competitive queue','Clutch or kick','valorant'],
    ['CSGO','dnd',0,'Counter-Strike 2','Premier match','Dust II warmup','csgo'],
    ['GitHub','online',0,'GitHub','Reviewing pull requests','Shipping commits','github'],
    ['Python IDE','idle',0,'Python IDE','Debugging scripts','Virtual env active','python'],
    ['C++','idle',0,'C++','Compiling project','Fixing templates','cpp'],
    ['YouTube','online',3,'YouTube','Watching videos','Recommendations rabbit hole','you_tube'],
    ['Netflix','idle',3,'Netflix','Watching a series','One more episode','netflix'],
    ['Instagram','online',3,'Instagram','Scrolling reels','Checking DMs','instagram'],
    ['Chess','online',5,'Chess','Rapid game','Calculating tactics','chess'],
    ['Wikipedia','idle',3,'Wikipedia','Reading articles','Learning random facts','wikipedia'],
    ['NotebookLM','online',0,'NotebookLM','Summarizing sources','Study mode','notebook_lm'],
    ['Reddit','idle',3,'Reddit','Browsing threads','Deep in comments','reddit'],
    ['Obsidian','online',0,'Obsidian','Writing notes','Graph brain active','obsidian'],
    ['Notion','online',0,'Notion','Organizing workspace','Planning the day','notion']
  ].map(([name,status,type,actName,details,state])=>({name,status,activities:[{type,name:actName,details,state}]}));
  function addPrebuiltPresets(force=false){
    const existing = new Set(presets.map(p=>p.name));
    const toAdd = PREBUILT_PRESETS.filter(p=>force || !existing.has(p.name)).map(p=>JSON.parse(JSON.stringify(p)));
    if(force){presets = presets.filter(p=>!PREBUILT_PRESETS.some(bp=>bp.name===p.name));}
    presets.push(...toAdd);savePresets();renderPresets();renderRotationPresets();
  }


function avatarUrl(u){try{if(!u.avatar)return`https://cdn.discordapp.com/embed/avatars/${Number(BigInt(u.id)>>22n)%6}.png`;return`https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`;}catch{return'https://cdn.discordapp.com/embed/avatars/0.png';}}
function toDateLocal(ts){if(!ts)return'';const d=new Date(typeof ts==='number'?ts:Date.parse(ts));if(isNaN(d))return'';const pad=n=>String(n).padStart(2,'0');return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
function fmtDuration(ms){if(ms<=0)return'00:00:00';const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000);return[h,m,s].map(n=>String(n).padStart(2,'0')).join(':');}
function fmtMinsShort(ms){const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000);return h>0?`${h}h ${String(m).padStart(2,'0')}m`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}

// ═══════════ BANNERS ═══════════
function setBannerServerActive(expiresAt){
  $('ka-banner').className='keepalive-banner ka-server';$('ka-icon').className='ka-icon ka-icon-server';
  $('ka-icon').innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
  $('ka-title').textContent='24/7 Server Keep-Alive';$('ka-desc').textContent='Presence is running on the server. You can safely close this tab.';
  $('ka-status-line').innerHTML='<span class="ka-active">● Server running 24/7</span>';
  $('ka-error-box').classList.add('hidden');$('server-retry-row').classList.add('hidden');$('timer-box').classList.remove('hidden');
  $('conn-dot').className='conn-dot server-active';$('conn-text').textContent='24/7 Active';$('conn-text').style.color='var(--green)';
  if(timerInterval)clearInterval(timerInterval);
  if(expiresAt){const tick=()=>{const left=expiresAt-Date.now();$('timer-val').textContent=fmtDuration(Math.max(0,left));if(left<=0){clearInterval(timerInterval);timerInterval=null;}};tick();timerInterval=setInterval(tick,1000);}
  updateStatBar();
}
function setBannerBrowserMode(errorMsg){
  $('ka-banner').className='keepalive-banner ka-browser';$('ka-icon').className='ka-icon ka-icon-browser';
  $('ka-icon').innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  $('ka-title').textContent='Browser Mode — Not 24/7';$('ka-desc').textContent='Presence will stop when you close this tab.';
  $('ka-status-line').innerHTML='<span class="ka-warn">● Server connection failed</span>';
  $('timer-box').classList.add('hidden');if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
  if(errorMsg){$('ka-error-box').textContent=errorMsg;$('ka-error-box').classList.remove('hidden');}else{$('ka-error-box').classList.add('hidden');}
  $('retry-url-input').value=savedApiBase||DEFAULT_API;$('server-retry-row').classList.remove('hidden');
  if(!Server.isActive())updateConnBadge(gw?gw._state:'disconnected');updateStatBar();
}
function setBannerNoServer(){
  $('ka-banner').className='keepalive-banner ka-browser';$('ka-icon').className='ka-icon ka-icon-browser';
  $('ka-icon').innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  $('ka-title').textContent='Browser Mode';$('ka-desc').textContent='No server URL configured. Presence stops when you close this tab.';
  $('ka-status-line').innerHTML='<span class="ka-inactive">● 24/7 mode not configured</span>';
  $('ka-error-box').classList.add('hidden');$('timer-box').classList.add('hidden');if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
  $('retry-url-input').value=DEFAULT_API;$('server-retry-row').classList.remove('hidden');updateStatBar();
}

// ═══════════ UI ═══════════
function updateConnBadge(state){
  if(Server.isActive())return;const dot=$('conn-dot'),text=$('conn-text');
  const map={connected:['connected','Browser (no 24/7)','var(--yellow)'],connecting:['connecting','Connecting…','var(--yellow)'],disconnected:['disconnected','Disconnected','var(--text3)'],error:['error','Error','var(--red)']};
  const[cls,label,color]=map[state]||map.disconnected;dot.className='conn-dot '+cls;text.textContent=label;text.style.color=color;
}
function updateStatBar(){
  const sm={online:[['dot-online'],'Online'],idle:[['dot-idle'],'Idle'],dnd:[['dot-dnd'],'Do Not Disturb'],invisible:[['dot-invisible'],'Invisible']};
  const[cls,label]=sm[currentStatus]||sm.online;
  $('stat-status').innerHTML=`<div class="dot ${cls}"></div> ${label}`;
  const cs=gw?gw._state:'disconnected';
  $('stat-conn').textContent=Server.isActive()?'Server: 24/7':(cs==='connected'?'Browser':cs.charAt(0).toUpperCase()+cs.slice(1));
  const dotEl=$('stat-dot');
  if(Server.isActive()||cs==='connected'){dotEl.style.background='var(--green)';dotEl.classList.add('pulse');}
  else if(cs==='connecting'){dotEl.style.background='var(--yellow)';dotEl.classList.add('pulse');}
  else{dotEl.style.background='var(--text3)';dotEl.classList.remove('pulse');}
  if(isActive&&activityEnabled){$('stat-activity').textContent=$('act-name').value.trim()||'Active';$('stat-activity').style.color='var(--text)';}
  else{$('stat-activity').textContent='None';$('stat-activity').style.color='var(--text3)';}
    updateProfileActivity();
  }
async function applyPresence(){const p=await resolvePresenceImages(buildPresence());if(Server.isActive())await Server.updatePresence(p);if(gw&&gw._state==='connected')gw.updatePresence(p);isActive=!!(p.activities&&p.activities.length);updateStatBar();updateProfileActivity();}
function setActivityEnabled(v){activityEnabled=v;$('activity-toggle').classList.toggle('on',v);$('activity-editor').classList.toggle('hidden',!v);$('activity-placeholder').classList.toggle('hidden',v);updatePreview();}

// ═══════════ PRESENCE PREVIEW ═══════════
const RP_TYPE_LABELS={0:'Playing',1:'Streaming',2:'Listening to',3:'Watching',5:'Competing in'};
const RP_TYPE_ICONS={0:'🎮',1:'📺',2:'🎵',3:'👁️',5:'🏆'};
let rpElapsedTimer=null;
let rpLgFailedSrc='',rpSmFailedSrc='';
function updatePreview(){
  if(!activityEnabled){$('rp-wrap').style.display='none';if(rpElapsedTimer){clearInterval(rpElapsedTimer);rpElapsedTimer=null;}return;}
  $('rp-wrap').style.display='block';
  const type=parseInt($('act-type').value)||0;
  const name=$('act-name').value.trim()||'Activity Name';
  const details=$('act-details').value.trim();
  const state=$('act-state').value.trim();
  const lgRaw=$('act-lg-img').value.trim();
  const smRaw=$('act-sm-img').value.trim();
    const appid=$('act-appid').value.trim();
  const tsStart=$('act-ts-start').value;
  const tsEnd=$('act-ts-end').value;
  $('rp-type-badge').textContent=RP_TYPE_LABELS[type]||'Playing';
  $('rp-aname').textContent=name;
  const dlEl=$('rp-detail-line'),slEl=$('rp-state-line');
  if(details){dlEl.textContent=details;dlEl.style.display='';}else{dlEl.style.display='none';}
  if(state){slEl.textContent=state;slEl.style.display='';}else{slEl.style.display='none';}
  // Large image — use raw URL for preview display (also reconstruct from mp: format)
  function previewSrc(raw, id){ return previewImageUrl(raw, id); }
  const lgEl=$('rp-lg'),lgPh=$('rp-lg-ph');
  const lgSrc=previewSrc(lgRaw, appid);
  if(lgSrc){
    lgEl.onload=()=>{rpLgFailedSrc='';lgEl.style.display='block';lgPh.style.display='none';};
    lgEl.onerror=()=>{rpLgFailedSrc=lgSrc;lgEl.style.display='none';lgPh.style.display='flex';lgPh.textContent=RP_TYPE_ICONS[type]||'🎮';};
    if(lgEl.getAttribute('src')!==lgSrc){lgEl.style.display='none';lgPh.style.display='flex';lgPh.textContent=RP_TYPE_ICONS[type]||'🎮';lgEl.src=lgSrc;}
    else if(lgEl.complete&&lgEl.naturalWidth>0){lgEl.style.display='block';lgPh.style.display='none';}
    else if(rpLgFailedSrc===lgSrc||lgEl.naturalWidth===0){lgEl.style.display='none';lgPh.style.display='flex';lgPh.textContent=RP_TYPE_ICONS[type]||'🎮';}
  }else{lgEl.style.display='none';lgPh.style.display='flex';lgPh.textContent=RP_TYPE_ICONS[type]||'🎮';}
  // Small image
  const smEl=$('rp-sm');
  const smAppidPrev=$('act-sm-appid').value.trim()||appid;
  const smSrc=previewSrc(smRaw, smAppidPrev);
  if(smSrc){smEl.onload=()=>{rpSmFailedSrc='';smEl.style.display='block';};smEl.onerror=()=>{rpSmFailedSrc=smSrc;smEl.style.display='none';};if(smEl.getAttribute('src')!==smSrc){smEl.style.display='none';smEl.src=smSrc;}else if(smEl.complete&&smEl.naturalWidth>0){smEl.style.display='block';}else if(rpSmFailedSrc===smSrc||smEl.naturalWidth===0){smEl.style.display='none';}}
  else{smEl.style.display='none';}
  updateAssetStatus();
  // Timestamps
  if(rpElapsedTimer){clearInterval(rpElapsedTimer);rpElapsedTimer=null;}
  const elEl=$('rp-elapsed');
  if(tsStart){
    const startMs=new Date(tsStart).getTime();
    const endMs=tsEnd?new Date(tsEnd).getTime():null;
    elEl.style.display='';
    const tick=()=>{const now=Date.now();elEl.textContent=endMs?fmtDuration(Math.max(0,endMs-now))+' left':fmtDuration(Math.max(0,now-startMs))+' elapsed';};
    tick();rpElapsedTimer=setInterval(tick,1000);
  }else{elEl.style.display='none';}
  // Buttons
  const btnsEl=$('rp-btns');
  const btns=[];for(let i=0;i<2;i++){const l=$(`btn-label-${i}`);if(l&&l.value.trim())btns.push(l.value.trim());}
  if(btns.length){btnsEl.style.display='';btnsEl.innerHTML=btns.map(b=>`<div class="rp-btn-item">${b.replace(/</g,'&lt;')}</div>`).join('');}
  else{btnsEl.style.display='none';}
}
function setStatus(s){currentStatus=s;document.querySelectorAll('.status-btn').forEach(b=>b.classList.toggle('active',b.dataset.status===s));}
function onTypeChange(){$('stream-url-row').classList.toggle('hidden',parseInt($('act-type').value)!==1);updatePreview();}
function checkImgAppId(){
  const needsAppId=v=>{v=v.trim();return v&&!isHttpUrl(v)&&!v.startsWith('mp:')&&!v.startsWith('spotify:');};
  const hasLgImg=needsAppId($('act-lg-img').value);
  const hasSmImg=needsAppId($('act-sm-img').value);
  const hasAppId=$('act-appid').value.trim();
  const hasSmAppId=$('act-sm-appid').value.trim();
  const warn=$('img-appid-warn');
  warn.style.display=((hasLgImg&&!hasAppId)||(hasSmImg&&!hasSmAppId&&!hasAppId))?'flex':'none';
}
function showLogin(){$('login-page').style.display='flex';$('dashboard-page').style.display='none';}
function showDashboard(){$('login-page').style.display='none';$('dashboard-page').style.display='flex';renderPresets();updateStatBar();}

// ═══════════ MUSIC DETECTOR ═══════════
let musicEnabled=false, musicPollTimer=null, lastMusicTitle='', musicDismissed=false;
let musicActivityActive=false; // BUGFIX: tracks whether a music-driven activity is currently applied
function setMusicEnabled(v){
  musicEnabled=v;$('music-toggle').classList.toggle('on',v);
  if(v){musicPollTimer=setInterval(pollMusic,2000);pollMusic();}
  else{if(musicPollTimer){clearInterval(musicPollTimer);musicPollTimer=null;}$('music-eq').style.display='none';$('music-detected-box').classList.add('hidden');lastMusicTitle='';musicDismissed=false;}
  localStorage.setItem('ds_music_auto',v?'1':'0');
}
function pollMusic(){
  if(!musicEnabled)return;
  try{
    const meta=navigator.mediaSession&&navigator.mediaSession.metadata;
    if(meta&&meta.title){
      const title=meta.title,artist=[meta.artist,meta.album].filter(Boolean).join(' · '),artwork=meta.artwork&&meta.artwork.length?meta.artwork[meta.artwork.length-1].src:null;
      if(title!==lastMusicTitle){lastMusicTitle=title;musicDismissed=false;}
      if(!musicDismissed){
        $('music-eq').style.display='flex';$('music-song').textContent=title;$('music-artist').textContent=artist||'Unknown artist';
        const artEl=$('music-art');
        if(artwork){artEl.innerHTML=`<img src="${artwork}" style="width:38px;height:38px;object-fit:cover" onerror="this.parentNode.textContent='🎵'" />`;}else{artEl.textContent='🎵';}
        $('music-detected-box').classList.remove('hidden');
      }
    } else {if(lastMusicTitle){lastMusicTitle='';$('music-detected-box').classList.add('hidden');$('music-eq').style.display='none';}}
  }catch{}
}
async function fetchArtworkUrl(song, artist) {
  try {
    const term = encodeURIComponent(`${song} ${artist}`.trim());
    const res = await fetch(`https://itunes.apple.com/search?term=${term}&media=music&limit=1`);
    if (!res.ok) return '';
    const data = await res.json();
    if (data.results && data.results.length) {
      // iTunes gives 100x100 by default; bump to 512x512 for a sharper image
      return data.results[0].artworkUrl100.replace('100x100bb', '512x512bb');
    }
  } catch {}
  return '';
}

// BUGFIX #1: clear any existing presence before applying the new music activity.
// Without this, Discord can briefly show the old + new activity together (the
// "two listening entries" bug), especially when songs change back-to-back.
async function applyMusicAsActivity(song, artist) {
  if (gw && gw._state === 'connected') gw.clearPresence(currentStatus);
  if (Server.isActive()) await Server.updatePresence({ status: currentStatus, activities: [], afk: false, since: null });

  $('act-type').value = '2';
  $('act-name').value = song || 'Music';
  $('act-details').value = artist || '';
  $('act-state').value = '';
  const artwork = await fetchArtworkUrl(song, artist);
  if (artwork) {
    $('act-lg-img').value = artwork;
    $('act-lg-txt').value = song || '';
  } else {
    // BUGFIX: if a previous song had artwork but this lookup fails, don't leave
    // the old song's artwork attached to the new song's activity.
    $('act-lg-img').value = '';
    $('act-lg-txt').value = '';
  }
  setActivityEnabled(true);
  onTypeChange();
  updatePreview();
  await applyPresence();

  // Surface why artwork didn't make it to Discord, instead of failing silently.
  // resolvePresenceImages (called inside applyPresence) sets lastAssetResolveError
  // when the external-asset lookup fails.
  const artEl = $('music-art-status');
  if (artEl) {
    if (artwork && !lastLargeAssetResolveError) {
      artEl.textContent = '';
      artEl.classList.add('hidden');
    } else if (artwork && lastLargeAssetResolveError) {
      artEl.textContent = '⚠️ Found album art but Discord rejected it: ' + lastLargeAssetResolveError;
      artEl.classList.remove('hidden');
    } else {
      artEl.textContent = 'ℹ️ No album art found on iTunes for this track — activity applied without an image.';
      artEl.classList.remove('hidden');
    }
  }

  // BUGFIX #2: surface an in-app "stop" control specifically for the
  // music-driven activity, separate from the global Stop Everything panel.
  musicActivityActive = true;
  const stopBtn = $('music-stop-btn');
  if (stopBtn) stopBtn.classList.remove('hidden');
}

// BUGFIX #2 (cont.): dedicated stop control for music-driven presence.
function stopMusicActivityUI() {
  musicActivityActive = false;
  const stopBtn = $('music-stop-btn');
  if (stopBtn) stopBtn.classList.add('hidden');
}
async function stopMusicActivity() {
  if (gw && gw._state === 'connected') gw.clearPresence(currentStatus);
  if (Server.isActive()) await Server.updatePresence({ status: currentStatus, activities: [], afk: false, since: null });
  isActive = false;
  setActivityEnabled(false);
  updateStatBar();
  stopMusicActivityUI();
}

function updateNotifAccessStatus(enabled) {
  const el = $('notif-access-banner');
  if (!el) return;
  if (enabled) {
    el.classList.add('hidden');
  } else {
    el.textContent = '⚠️ Notification access is disabled — auto-detect for Spotify/YouTube Music won\'t work. Enable it in your phone Settings, or use manual entry below.';
    el.classList.remove('hidden');
  }
}
$('music-toggle').addEventListener('click',()=>setMusicEnabled(!musicEnabled));
$('music-apply-btn').addEventListener('click',()=>applyMusicAsActivity($('music-song').textContent,$('music-artist').textContent));
$('music-dismiss-btn').addEventListener('click',()=>{musicDismissed=true;$('music-detected-box').classList.add('hidden');$('music-eq').style.display='none';});
$('music-manual-apply').addEventListener('click',()=>{const s=$('music-manual-song').value.trim(),a=$('music-manual-artist').value.trim();if(!s)return;applyMusicAsActivity(s,a);$('music-manual-song').value='';$('music-manual-artist').value='';});
$('music-manual-song').addEventListener('keydown',e=>{if(e.key==='Enter')$('music-manual-apply').click();});
// BUGFIX #2 (cont.): wire up the new stop button if present in the HTML
if ($('music-stop-btn')) $('music-stop-btn').addEventListener('click', stopMusicActivity);

// ═══════════ AFK AUTO-IDLE ═══════════
let afkEnabled=false, afkTimer=null, afkIsIdle=false, lastActivityTime=Date.now();
function setAfkEnabled(v){
  afkEnabled=v;$('afk-toggle').classList.toggle('on',v);
  if(v){startAfkWatch();}else{stopAfkWatch();$('afk-status').classList.add('hidden');}
  localStorage.setItem('ds_afk_enabled',v?'1':'0');
  localStorage.setItem('ds_afk_minutes',$('afk-minutes').value);
}
function startAfkWatch(){
  stopAfkWatch();
  lastActivityTime=Date.now();afkIsIdle=false;
  afkTimer=setInterval(checkAfk,10000);
  ['mousemove','keydown','click','scroll','touchstart'].forEach(ev=>document.addEventListener(ev,onUserActivity,{passive:true}));
}
function stopAfkWatch(){
  if(afkTimer){clearInterval(afkTimer);afkTimer=null;}
  ['mousemove','keydown','click','scroll','touchstart'].forEach(ev=>document.removeEventListener(ev,onUserActivity));
}
function onUserActivity(){
  lastActivityTime=Date.now();
  if(afkIsIdle){
    afkIsIdle=false;
    setStatus(preAfkStatus||'online');
    applyPresence();
    updateAfkStatus('● Active');
  }
}
let preAfkStatus='online';
function checkAfk(){
  if(!afkEnabled)return;
  const mins=parseInt($('afk-minutes').value)||10;
  const idle=(Date.now()-lastActivityTime)/60000;
  if(!afkIsIdle&&idle>=mins){
    afkIsIdle=true;preAfkStatus=currentStatus;
    setStatus('idle');applyPresence();
    updateAfkStatus(`● Went idle after ${mins} min`);
  } else if(!afkIsIdle){
    const left=Math.max(0,mins-idle);
    updateAfkStatus(`● Active — idle in ${Math.ceil(left)} min`);
  }
}
function updateAfkStatus(msg){
  const el=$('afk-status');el.classList.remove('hidden');
  el.innerHTML=`<span style="color:var(--text3)">${msg}</span>`;
}
$('afk-toggle').addEventListener('click',()=>setAfkEnabled(!afkEnabled));

// ═══════════ COUNTDOWN ACTIVITY ═══════════
let cdTimer=null, cdEndTime=0;
function startCountdown(){
  const label=$('cd-label').value.trim()||'Studying';
  const mins=parseInt($('cd-minutes').value)||25;
  if(cdTimer){clearInterval(cdTimer);cdTimer=null;}
  cdEndTime=Date.now()+mins*60000;
  $('cd-label-display').textContent=label;
  $('cd-display').classList.remove('hidden');
  $('cd-stop-btn').classList.remove('hidden');
  $('cd-start-btn').textContent='Restart';
  tickCountdown(label);
  cdTimer=setInterval(()=>tickCountdown(label),1000);
}
function tickCountdown(label){
  const left=cdEndTime-Date.now();
  if(left<=0){
    $('cd-time-display').textContent='Done!';
    clearInterval(cdTimer);cdTimer=null;
    // Apply "Done" presence for 5 seconds then clear
    $('act-type').value='0';$('act-name').value=label;$('act-details').value='Finished!';$('act-state').value='';
    setActivityEnabled(true);applyPresence();
    setTimeout(()=>{if(gw&&gw._state==='connected')gw.clearPresence(currentStatus);isActive=false;updateStatBar();},5000);
    return;
  }
  $('cd-time-display').textContent=fmtMinsShort(left);
  // Update activity details live
  $('act-type').value='0';$('act-name').value=label;$('act-details').value=fmtMinsShort(left)+' left';$('act-state').value='';
  if(!activityEnabled){setActivityEnabled(true);}
  applyPresence();
}
function stopCountdown(){
  if(cdTimer){clearInterval(cdTimer);cdTimer=null;}
  $('cd-display').classList.add('hidden');
  $('cd-stop-btn').classList.add('hidden');
  $('cd-start-btn').textContent='Start';
}
$('cd-start-btn').addEventListener('click',startCountdown);
$('cd-stop-btn').addEventListener('click',stopCountdown);

// ═══════════ SCHEDULE RULES ═══════════
let scheduleEnabled=false, scheduleRules=[], scheduleTimer=null, lastScheduledMin='';
try{scheduleRules=JSON.parse(localStorage.getItem('ds_schedule_rules')||'[]');}catch{}
const DAY_NAMES=['Su','Mo','Tu','We','Th','Fr','Sa'];

function setScheduleEnabled(v){
  scheduleEnabled=v;$('schedule-toggle').classList.toggle('on',v);
  if(v){scheduleTimer=setInterval(checkSchedule,15000);checkSchedule();}
  else{if(scheduleTimer){clearInterval(scheduleTimer);scheduleTimer=null;}lastScheduledMin='';}
  localStorage.setItem('ds_schedule_enabled',v?'1':'0');
}
function checkSchedule(){
  if(!scheduleEnabled||!scheduleRules.length)return;
  const now=new Date();const day=now.getDay();
  const hh=String(now.getHours()).padStart(2,'0'),mm=String(now.getMinutes()).padStart(2,'0');
  const key=`${day}-${hh}:${mm}`;
  if(key===lastScheduledMin)return;
  for(const rule of scheduleRules){
    if(rule.time===hh+':'+mm&&rule.days.includes(day)){
      lastScheduledMin=key;setStatus(rule.status);applyPresence();break;
    }
  }
}
function saveScheduleRules(){localStorage.setItem('ds_schedule_rules',JSON.stringify(scheduleRules));}
function renderRules(){
  const list=$('rules-list');
  if(!scheduleRules.length){list.innerHTML='<div style="font-size:12px;color:var(--text3);padding:6px 0 10px">No rules yet.</div>';return;}
  list.innerHTML=scheduleRules.map((r,i)=>`
    <div class="rule-item">
      <div class="rule-desc">
        <span class="rule-time">${r.time}</span>
        <span class="rule-status"> → ${r.status}</span>
        <div class="rule-days">${r.days.map(d=>DAY_NAMES[d]).join(', ')}</div>
      </div>
      <button class="btn-icon" style="color:#f47c7e" onclick="deleteRule(${i})"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
    </div>`).join('');
}
window.deleteRule=function(i){scheduleRules.splice(i,1);saveScheduleRules();renderRules();};

// Day chip selection
document.querySelectorAll('.day-chip').forEach(c=>c.addEventListener('click',()=>c.classList.toggle('on')));
$('show-add-rule-btn').addEventListener('click',()=>{$('add-rule-form').classList.remove('hidden');$('show-add-rule-btn').classList.add('hidden');});
$('rule-cancel-btn').addEventListener('click',()=>{$('add-rule-form').classList.add('hidden');$('show-add-rule-btn').classList.remove('hidden');});
$('rule-add-btn').addEventListener('click',()=>{
  const time=$('rule-time').value;if(!time)return;
  const days=[...$('day-chips').querySelectorAll('.day-chip.on')].map(c=>parseInt(c.dataset.d));
  if(!days.length)return;
  const status=$('rule-status').value;
  scheduleRules.push({time,days,status});scheduleRules.sort((a,b)=>a.time.localeCompare(b.time));
  saveScheduleRules();renderRules();$('add-rule-form').classList.add('hidden');$('show-add-rule-btn').classList.remove('hidden');
});
$('schedule-toggle').addEventListener('click',()=>setScheduleEnabled(!scheduleEnabled));

// ═══════════ STATUS ROTATION ═══════════
let rotationEnabled=false, rotationTimer=null, rotationIndex=0, rotationSelected=[];
function setRotationEnabled(v){
  rotationEnabled=v;$('rotation-toggle').classList.toggle('on',v);
  if(v){
    rotationSelected=getSelectedRotationPresets();
    if(!rotationSelected.length){$('rotation-toggle').classList.remove('on');rotationEnabled=false;$('rotation-status').textContent='Select at least one preset below.';return;}
    rotationIndex=0;applyRotationStep();
    const mins=parseInt($('rotation-interval').value)||5;
    rotationTimer=setInterval(()=>{rotationIndex=(rotationIndex+1)%rotationSelected.length;applyRotationStep();},mins*60000);
    localStorage.setItem('ds_rotation_enabled','1');
  } else {
    if(rotationTimer){clearInterval(rotationTimer);rotationTimer=null;}
    $('rotation-status').textContent='';localStorage.setItem('ds_rotation_enabled','0');
  }
}
function applyRotationStep(){
  const p=rotationSelected[rotationIndex];if(!p)return;
  window.loadPreset(presets.indexOf(p));
  const mins=parseInt($('rotation-interval').value)||5;
  $('rotation-status').textContent=`● Now: "${p.name}" — next in ${mins} min`;
}
function getSelectedRotationPresets(){
  return [...$('rotation-presets').querySelectorAll('input[type=checkbox]:checked')].map(cb=>presets[parseInt(cb.value)]).filter(Boolean);
}
function renderRotationPresets(){
  const el=$('rotation-presets');
  if(!presets.length){el.innerHTML='<div style="font-size:12px;color:var(--text3);padding:8px 0">No presets yet — save some first.</div>';return;}
  el.innerHTML=presets.map((p,i)=>`<div class="rotation-preset-row"><input type="checkbox" id="rp-${i}" value="${i}" /><label for="rp-${i}">${escHtml(p.name)} <span style="color:var(--text3);font-size:10px">${p.status}</span></label></div>`).join('');
}
$('rotation-toggle').addEventListener('click',()=>setRotationEnabled(!rotationEnabled));

// ═══════════ EXPORT / IMPORT PRESETS ═══════════
$('export-presets-btn').addEventListener('click',()=>{
  if(!presets.length){alert('No presets to export.');return;}
  const blob=new Blob([JSON.stringify(presets,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='discord-presets.json';a.click();
  URL.revokeObjectURL(url);
});
$('import-presets-input').addEventListener('change',e=>{
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const data=JSON.parse(ev.target.result);
      if(!Array.isArray(data))throw new Error('Invalid format');
      const valid=data.filter(p=>p&&typeof p.name==='string');
      presets.push(...valid);savePresets();renderPresets();renderRotationPresets();
      alert(`Imported ${valid.length} preset(s).`);
    }catch{alert('Could not read file. Make sure it is a valid presets JSON.');}
    e.target.value='';
  };
  reader.readAsText(file);
});

// ═══════════ SERVER RETRY ═══════════
async function tryConnectServer(apiBase){
  apiBase=normalizeApiUrl(apiBase);if(!savedToken||!apiBase)return;
  $('retry-server-btn').disabled=true;$('retry-server-btn').textContent='…';
  $('ka-status-line').innerHTML='<span class="ka-warn">● Connecting…</span>';$('ka-error-box').classList.add('hidden');
  try{
    Server.init(apiBase);const result=await Server.startSession(savedToken);
    savedApiBase=apiBase;localStorage.setItem('ds_api_base',apiBase);localStorage.setItem('ds_session_id',result.sessionId);localStorage.setItem('ds_session_expires',String(result.expiresAt));
    setBannerServerActive(result.expiresAt);await Server.updatePresence(buildPresence());
    $('apply-btn').disabled=false;$('clear-btn').disabled=false;
  }catch(err){Server.sessionId=null;setBannerBrowserMode(String(err));}
  finally{$('retry-server-btn').disabled=false;$('retry-server-btn').textContent='Retry';}
}

// ═══════════ CONNECT ═══════════
async function connectGateway(token,apiBase,forceNew=false){
  apiBase=normalizeApiUrl(apiBase);savedToken=token;savedApiBase=apiBase;
  if(forceNew){await stopStoredServerSession(apiBase);localStorage.removeItem('ds_session_id');localStorage.removeItem('ds_session_expires');Server.sessionId=null;Server.expiresAt=null;}
    if(gw){try{gw.clearPresence(currentStatus);gw.disconnect();}catch{}gw=null;}
  $('connect-btn').disabled=true;$('connect-btn').innerHTML='<span class="spin">↻</span> Connecting…';$('login-error').classList.add('hidden');
  let serverOk=false,serverErr='';
  if(apiBase){
    Server.init(apiBase);
    if(Server.sessionId&&Server.expiresAt&&Server.expiresAt>Date.now()+60000){
      serverOk=true;Server._startPolling();
    }else{
      try{const r=await Server.startSession(token);serverOk=true;localStorage.setItem('ds_api_base',apiBase);localStorage.setItem('ds_session_id',r.sessionId);localStorage.setItem('ds_session_expires',String(r.expiresAt));}catch(err){serverErr=String(err);}
    }
  }
  gw=new DiscordGateway(token);
  gw.on('stateChange',state=>{if(!Server.isActive())updateConnBadge(state);updateStatBar();const ready=Server.isActive()||state==='connected';$('apply-btn').disabled=!ready;$('clear-btn').disabled=!ready;});
  gw.on('ready',user=>{
    localStorage.setItem('ds_token',token);
    const avUrl=avatarUrl(user),display=user.global_name||user.username,tag=user.discriminator&&user.discriminator!=='0'?'#'+user.discriminator:'';
    $('user-avatar').src=avUrl;$('menu-avatar').src=avUrl;$('profile-card-avatar').src=avUrl;$('username-text').textContent=display;$('menu-name').textContent=display;$('menu-tag').textContent=tag;$('profile-card-name').textContent=display+tag;$('profile-card-id').textContent='Discord ID: '+user.id;
    $('connect-btn').disabled=false;$('connect-btn').textContent='Connect to Discord';
    showDashboard();
    if(serverOk&&Server.isActive()){setBannerServerActive(Server.expiresAt);}
    else if(apiBase){setBannerBrowserMode(serverErr||'Could not reach server — check the URL and try Retry below');$('retry-url-input').value=apiBase;}
    else{setBannerNoServer();}
    $('apply-btn').disabled=false;$('clear-btn').disabled=false;updateStatBar();
    // Restore saved preferences
    if(localStorage.getItem('ds_music_auto')==='1')setMusicEnabled(true);
    if(localStorage.getItem('ds_afk_enabled')==='1'){const m=parseInt(localStorage.getItem('ds_afk_minutes')||'10');$('afk-minutes').value=m;setAfkEnabled(true);}
    if(localStorage.getItem('ds_schedule_enabled')==='1'){renderRules();setScheduleEnabled(true);}
    else renderRules();
    renderRotationPresets();
  });
  gw.on('error',msg=>{$('connect-btn').disabled=false;$('connect-btn').textContent='Connect to Discord';$('login-error-text').textContent=msg;$('login-error').classList.remove('hidden');showLogin();});
  gw.connect();
}

// ═══════════ EVENTS ═══════════
$('connect-btn').addEventListener('click',()=>{const t=$('token-input').value.trim();if(!t)return;connectGateway(t,$('server-url-input').value.trim(),true);});
$('token-input').addEventListener('keydown',e=>{if(e.key==='Enter')$('connect-btn').click();});
(()=>{const s=localStorage.getItem('ds_api_base');$('server-url-input').value=s?normalizeApiUrl(s):DEFAULT_API;})();

let showToken=false;
$('eye-btn').addEventListener('click',()=>{showToken=!showToken;$('token-input').type=showToken?'text':'password';$('eye-icon').innerHTML=showToken?'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>':'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';});
$('how-to-toggle').addEventListener('click',function(){const open=!$('how-to-content').classList.contains('hidden');$('how-to-content').classList.toggle('hidden',open);this.classList.toggle('open',!open);});
document.querySelectorAll('.status-btn').forEach(b=>b.addEventListener('click',()=>setStatus(b.dataset.status)));
$('activity-toggle').addEventListener('click',()=>setActivityEnabled(!activityEnabled));
$('act-type').addEventListener('change',onTypeChange);
$('act-platform').addEventListener('change',updatePreview);
// Live preview — update on every keystroke in activity fields
['act-name','act-details','act-state','act-lg-img','act-sm-img','act-appid','act-sm-appid','act-platform','act-ts-start','act-ts-end'].forEach(id=>{const el=$(id);if(el)el.addEventListener('input',updatePreview);});
// App ID warning — show when image fields have content but no app ID
['act-lg-img','act-sm-img','act-appid','act-sm-appid'].forEach(id=>{const el=$(id);if(el)el.addEventListener('input',checkImgAppId);});
// Also update preview whenever a button label changes (delegated via mutation observer on buttons-list)
new MutationObserver(updatePreview).observe($('buttons-list'),{childList:true,subtree:true,characterData:true});
$('buttons-list').addEventListener('input',updatePreview);
$('ts-now-btn').addEventListener('click',()=>{const now=new Date();now.setSeconds(0,0);$('act-ts-start').value=now.toISOString().slice(0,16);updatePreview();});
$('ts-clear-btn').addEventListener('click',()=>{$('act-ts-start').value='';$('act-ts-end').value='';updatePreview();});
$('add-btn-btn').addEventListener('click',()=>addButton());
$('apply-btn').addEventListener('click',()=>applyPresence());
$('clear-btn').addEventListener('click',async()=>{if(Server.isActive())await Server.updatePresence({status:currentStatus,activities:[],afk:false,since:null});if(gw&&gw._state==='connected')gw.clearPresence(currentStatus);isActive=false;setActivityEnabled(false);updateStatBar();stopMusicActivityUI();});
  $('stop-server-btn').addEventListener('click',async()=>{await stopEverything({disconnectGateway:false});});
  $('stop-all-btn').addEventListener('click',async()=>{await stopEverything({disconnectGateway:false});});
$('profile-stop-btn').addEventListener('click',async()=>{await stopEverything({disconnectGateway:false});});
$('retry-server-btn').addEventListener('click',()=>tryConnectServer($('retry-url-input').value.trim()));
$('user-btn').addEventListener('click',()=>{const open=!$('user-menu').classList.contains('hidden');$('user-menu').classList.toggle('hidden',open);$('user-btn').classList.toggle('open',!open);});
document.addEventListener('click',e=>{if(!$('user-btn').contains(e.target)&&!$('user-menu').contains(e.target)){$('user-menu').classList.add('hidden');$('user-btn').classList.remove('open');}});
$('disconnect-btn').addEventListener('click',async()=>{
    await stopEverything();
    if(musicPollTimer){clearInterval(musicPollTimer);musicPollTimer=null;}if(rpElapsedTimer){clearInterval(rpElapsedTimer);rpElapsedTimer=null;}stopAfkWatch();stopCountdown();
    if(rotationTimer){clearInterval(rotationTimer);rotationTimer=null;}if(scheduleTimer){clearInterval(scheduleTimer);scheduleTimer=null;}
    isActive=false;localStorage.removeItem('ds_token');localStorage.removeItem('ds_session_id');localStorage.removeItem('ds_session_expires');showLogin();
  });

// ═══════════ PRESETS ═══════════
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
const ICON_LOAD=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const ICON_EDIT=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const ICON_DEL=`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
function renderPresets(){
  const list=$('preset-list');$('preset-count').textContent=presets.length;
  if(!presets.length){list.innerHTML='<div style="text-align:center;padding:22px 0;color:var(--text3);font-size:12px">No presets yet</div>';return;}
  list.innerHTML=presets.map((p,i)=>`
    <div class="preset-item" id="preset-item-${i}">
      <div class="preset-info" onclick="loadPreset(${i})" style="cursor:pointer" title="Click to load & apply">
        <div class="preset-name">${escHtml(p.name)}</div>
        <div class="preset-meta">${escHtml(p.status)} · ${escHtml(p.activities&&p.activities.length?p.activities[0].name:'No activity')}</div>
      </div>
      <div class="preset-actions">
        <button class="btn-icon" title="Load" onclick="loadPreset(${i})">${ICON_LOAD}</button>
        <button class="btn-icon" title="Edit" onclick="editPreset(${i})">${ICON_EDIT}</button>
        <button class="btn-icon" title="Delete" style="color:#f47c7e" onclick="deletePreset(${i})">${ICON_DEL}</button>
      </div>
    </div>`).join('');
}
function savePresets(){try{localStorage.setItem('ds_presets',JSON.stringify(presets));}catch{}}

window.editPreset=function(i){
  const item=$(`preset-item-${i}`);
  const p=presets[i];
  if(!item||!p)return;
  // If already editing this one, cancel
  if(item.classList.contains('editing')){renderPresets();return;}
  item.classList.add('editing');
  item.innerHTML=`
    <div class="preset-edit-form">
      <input type="text" id="edit-preset-name-${i}" value="${escHtml(p.name)}" placeholder="Preset name" />
      <div class="preset-edit-btns">
        <button class="btn btn-primary" onclick="saveEditPresetName(${i})">Save name</button>
        <button class="btn btn-ghost" onclick="overwritePreset(${i})" title="Replace this preset's data with the current activity settings">Overwrite with current</button>
        <button class="btn btn-ghost" onclick="loadPreset(${i})" title="Load this preset into the editor and apply it">▶ Load &amp; Apply</button>
        <button class="btn btn-ghost btn-cancel" onclick="renderPresets()" style="flex:0 0 auto">✕</button>
      </div>
    </div>`;
  const inp=$(`edit-preset-name-${i}`);
  if(inp){inp.focus();inp.select();inp.addEventListener('keydown',e=>{if(e.key==='Enter')saveEditPresetName(i);if(e.key==='Escape')renderPresets();});}
};

window.saveEditPresetName=function(i){
  const inp=$(`edit-preset-name-${i}`);
  if(!inp)return;
  const name=inp.value.trim();
  if(!name)return;
  presets[i].name=name;
  savePresets();renderPresets();renderRotationPresets();
};

window.overwritePreset=function(i){
  const inp=$(`edit-preset-name-${i}`);
  const name=(inp&&inp.value.trim())||presets[i].name;
  const built=buildPresence();
  presets[i]={name,status:built.status,activities:built.activities};
  savePresets();renderPresets();renderRotationPresets();
};

window.deletePreset=function(i){
  const item=$(`preset-item-${i}`);
  const p=presets[i];if(!p)return;
  // Show inline confirm inside the item
  if(item&&!item.dataset.confirming){
    item.dataset.confirming='1';
    const del=item.querySelector('[title="Delete"]');
    if(del){
      del.textContent='';
      del.innerHTML='Delete?';
      del.style.cssText='color:#f47c7e;font-size:10px;font-weight:700;padding:3px 7px;border:1px solid #f47c7e;border-radius:4px;background:transparent;cursor:pointer;white-space:nowrap';
      // Second click confirms
      del.onclick=()=>{presets.splice(i,1);savePresets();renderPresets();renderRotationPresets();};
      // Click elsewhere cancels
      const cancel=()=>{delete item.dataset.confirming;renderPresets();document.removeEventListener('click',cancel);};
      setTimeout(()=>document.addEventListener('click',cancel),0);
    }
    return;
  }
  presets.splice(i,1);savePresets();renderPresets();renderRotationPresets();
};
window.loadPreset=function(i){
  const p=presets[i];if(!p)return;setStatus(p.status||'online');
  if(p.activities&&p.activities.length){
    const a=p.activities[0];setActivityEnabled(true);
    $('act-type').value=a.type||0;$('act-name').value=a.name||'';$('act-url').value=a.url||'';$('act-details').value=a.details||'';$('act-state').value=a.state||'';$('act-appid').value=a.application_id||'';
    if($('act-platform'))$('act-platform').value=a.platform||'';
    const assets=a.assets||{};$('act-lg-img').value=assets.large_image||'';$('act-lg-txt').value=assets.large_text||'';$('act-sm-img').value=assets.small_image||'';$('act-sm-txt').value=assets.small_text||'';
    if($('act-sm-appid'))$('act-sm-appid').value=assets.small_app_id||'';
    $('act-ts-start').value=toDateLocal(a.timestamps&&a.timestamps.start);$('act-ts-end').value=toDateLocal(a.timestamps&&a.timestamps.end);
    buttonIds=[];$('buttons-list').innerHTML='';
    const btns=a.buttons&&a.metadata?a.buttons.map((lbl,idx)=>({label:lbl,url:(a.metadata.button_urls||[])[idx]||''})):[];
    btns.forEach(b=>addButton(b.label,b.url));onTypeChange();checkImgAppId();
  }else{setActivityEnabled(false);}
  applyPresence();
  // BUGFIX: loading a manual preset should also clear any "music activity active" UI state,
  // since we're no longer showing the song-driven activity.
  stopMusicActivityUI();
};
function addButton(label='',url=''){
  if(buttonIds.length>=2)return;const slot=buttonIds.includes(0)?1:0;buttonIds.push(slot);buttonIds.sort();const i=slot;
  const row=document.createElement('div');row.className='btn-row';row.id=`btn-row-${i}`;
  row.innerHTML=`<input type="text" id="btn-label-${i}" placeholder="Label" value="${escHtml(label)}" /><input type="text" id="btn-url-${i}" placeholder="https://..." value="${escHtml(url)}" /><button class="remove-btn" onclick="removeButton(${i})">×</button>`;
  $('buttons-list').appendChild(row);$('add-btn-btn').disabled=buttonIds.length>=2;
}
window.removeButton=function(i){const row=$(`btn-row-${i}`);if(row)row.remove();buttonIds=buttonIds.filter(id=>id!==i);$('add-btn-btn').disabled=false;};
$('open-save-form').addEventListener('click',()=>{$('save-form').classList.remove('hidden');$('open-save-form').classList.add('hidden');setTimeout(()=>$('preset-name-input').focus(),50);});
$('save-preset-cancel').addEventListener('click',()=>{$('save-form').classList.add('hidden');$('open-save-form').classList.remove('hidden');$('preset-name-input').value='';});
$('save-preset-confirm').addEventListener('click',()=>{const name=$('preset-name-input').value.trim();if(!name)return;const p=buildPresence();presets.push({name,status:p.status,activities:p.activities});savePresets();renderPresets();renderRotationPresets();$('save-form').classList.add('hidden');$('open-save-form').classList.remove('hidden');$('preset-name-input').value='';});
$('preset-name-input').addEventListener('keydown',e=>{if(e.key==='Enter')$('save-preset-confirm').click();});
const restorePrebuiltBtn=$('restore-prebuilt-btn');
  if(restorePrebuiltBtn)restorePrebuiltBtn.addEventListener('click',()=>addPrebuiltPresets(true));

// ═══════════ AUTO-RESTORE ═══════════
(function(){
  if(localStorage.getItem('ds_prebuilt_seeded_v4')!=='1'||!PREBUILT_PRESETS.every(bp=>presets.some(p=>p.name===bp.name))){addPrebuiltPresets(false);localStorage.setItem('ds_prebuilt_seeded_v4','1');}
    const token=localStorage.getItem('ds_token'),sessionId=localStorage.getItem('ds_session_id'),expires=Number(localStorage.getItem('ds_session_expires')||0);
  const rawBase=localStorage.getItem('ds_api_base')||DEFAULT_API,apiBase=normalizeApiUrl(rawBase);
  if(rawBase!==apiBase)localStorage.setItem('ds_api_base',apiBase);
  if(token){
    if(sessionId&&expires>Date.now()+60000&&apiBase){Server.init(apiBase);Server.sessionId=sessionId;Server.expiresAt=expires;Server._startPolling();}
    // Skip the login page — go straight to dashboard with a reconnecting badge
    showDashboard();
    $('conn-dot').className='conn-dot';
    $('conn-text').textContent='Reconnecting…';
    $('conn-text').style.color='var(--text3)';
    $('apply-btn').disabled=true;$('clear-btn').disabled=true;
    // Placeholder avatar while we fetch user info
    $('user-avatar').src='https://cdn.discordapp.com/embed/avatars/0.png';
    $('menu-avatar').src='https://cdn.discordapp.com/embed/avatars/0.png';
    $('username-text').textContent='Reconnecting…';$('profile-card-name').textContent='Reconnecting…';$('profile-card-id').textContent='Fetching Discord profile…';
    connectGateway(token,apiBase,false);
  }
  renderPresets();renderRotationPresets();renderRules();updateProfileActivity();
})();
window.addEventListener('beforeunload',()=>{try{if(gw&&gw._state==='connected'&&!Server.isActive())gw.clearPresence(currentStatus);}catch{}});
