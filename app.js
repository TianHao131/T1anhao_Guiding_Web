
const sites=[];
const categories=["校园与课程","AI 与搜索","学习与开发","工具与网络","娱乐与其他"];
const $ = id => document.getElementById(id);
const search=$('search'),sections=$('sections'),dialog=$('add-dialog'),form=$('add-form'),urlInput=$('new-url'),categoryInput=$('new-category'),message=$('add-message'),notice=$('notice'),undo=$('undo');
const moveDialog=$('move-dialog'),moveForm=$('move-form'),moveCategory=$('move-category'),moveMessage=$('move-message');
const renameDialog=$('rename-dialog'),renameForm=$('rename-form'),renameInput=$('rename-name'),renameMessage=$('rename-message');
const transferDialog=$('transfer-dialog'),transferMessage=$('transfer-message'),importFile=$('import-file'),confirmImport=$('confirm-import');
let pendingImport=null;
let renamingId=null;
const storageKey='tianhao-nav-state-v3';
let category='全部',movingId=null;
function parseAddress(value){let raw=value.trim();if(!raw||/\s/.test(raw))throw Error('请输入有效的网址。');if(!/^[a-z][a-z0-9+.-]*:/i.test(raw))raw='https://'+raw;const url=new URL(raw);if(!['https:','http:'].includes(url.protocol)||!url.hostname||url.username||url.password)throw Error('请使用 http 或 https 网站地址，不要填写账号密码。');return url;}
function valid(entries){return Array.isArray(entries)&&entries.length<=5000&&entries.every(s=>{try{return s&&['string','number'].includes(typeof s.id)&&String(s.id).length>0&&String(s.id).length<=128&&typeof s.name==='string'&&s.name.trim().length>0&&s.name.length<=80&&typeof s.url==='string'&&s.url.length<=4096&&categories.includes(s.category)&&!!parseAddress(s.url);}catch{return false;}})&&new Set(entries.map(s=>String(s.id))).size===entries.length;}
let state={entries:[],previous:null};
function save(next,errorNode=notice){
 if(!syncEngine || !syncEngine.ready){errorNode.textContent='请先登录并连接云端。';return false;}
 if(!syncEngine.commit(next.entries,next.previous)){errorNode.textContent=syncEngine.conflict?'请先处理两台电脑的修改冲突。':'保存未成功，请保留备份后重试。';return false;}
 return true;
}
function commit(entries,text,errorNode=notice){if(!save({entries,previous:state.entries},errorNode))return false;notice.textContent=text;draw();return true;}
function iconCandidates(site){
 const url=parseAddress(site.url);
 const list=[];
 if(typeof site.icon==='string'&&site.icon)list.push(site.icon);
 list.push('https://www.google.com/s2/favicons?sz=64&domain='+encodeURIComponent(url.hostname));
 list.push(url.origin+'/favicon.ico');
 return [...new Set(list)];
}
function letterColor(name){
 let hash=0;
 for(const ch of String(name||'?'))hash=(hash*31+ch.codePointAt(0))>>>0;
 return 'hsl('+(hash%360)+',48%,42%)';
}
function makeIcon(site){
 const slot=document.createElement('span');slot.className='icon-slot';
 const name=String(site.name||'').trim();
 const letter=document.createElement('span');letter.className='site-letter';letter.setAttribute('aria-hidden','true');
 letter.textContent=(Array.from(name)[0]||'?').toUpperCase();
 letter.style.backgroundColor=letterColor(name||site.url);
 const img=document.createElement('img');img.className='site-icon';img.alt='';img.width=24;img.height=24;
 slot.append(letter,img);
 const chain=iconCandidates(site);
 let index=0,timer=0,settled=false;
 const giveUp=()=>{settled=true;img.remove();};
 const advance=()=>{
  clearTimeout(timer);
  if(settled)return;
  if(index>=chain.length){giveUp();return;}
  const token=String(Number(img.dataset.try||0)+1);
  img.dataset.try=token;
  img.onload=()=>{if(img.dataset.try!==token||settled)return;settled=true;clearTimeout(timer);slot.classList.add('has-icon');};
  img.onerror=()=>{if(img.dataset.try===token&&!settled)advance();};
  timer=setTimeout(()=>{if(img.dataset.try===token&&!settled)advance();},5000);
  img.src=chain[index++];
 };
 advance();
 return slot;
}
function makeCard(site){
 const card=document.createElement('article');card.className='card';card.dataset.id=String(site.id);
 const a=document.createElement('a');a.href=site.url;a.target='_blank';a.rel='noopener';
 const icon=makeIcon(site);
 const copy=document.createElement('span');copy.className='copy';const name=document.createElement('strong');name.textContent=site.name;const desc=document.createElement('small');desc.textContent=site.description||'自定义网站';copy.append(name,desc);a.append(icon,copy);card.append(a);
 const menu=document.createElement('details');menu.className='site-menu';const summary=document.createElement('summary');summary.textContent='⋯';summary.setAttribute('aria-label','管理 '+site.name);summary.title='管理 '+site.name;const actions=document.createElement('div');actions.className='site-actions';
 const move=document.createElement('button');move.type='button';move.textContent='移动到其他分区';move.onclick=()=>{menu.open=false;movingId=String(site.id);$('move-site').textContent=site.name;moveCategory.value=site.category;moveMessage.textContent='';moveDialog.showModal();moveCategory.focus();};
 const del=document.createElement('button');del.type='button';del.className='delete-action';del.textContent='删除';del.onclick=()=>{if(commit(state.entries.filter(s=>String(s.id)!==String(site.id)),'已删除「'+site.name+'」，可以撤销。'))undo.focus();};
 const rename=document.createElement('button');rename.type='button';rename.className='rename-action';rename.textContent='重命名';rename.onclick=()=>{menu.open=false;renamingId=String(site.id);renameInput.value=site.name;renameMessage.textContent='';renameDialog.showModal();renameInput.focus();renameInput.select();};
 actions.append(rename,move,del);menu.append(summary,actions);card.append(menu);menu.addEventListener('toggle',()=>{if(menu.open)document.querySelectorAll('.site-menu[open]').forEach(other=>{if(other!==menu)other.open=false;});});return card;
}
function draw(){for(const section of sections.querySelectorAll('[data-section]'))section.querySelector('.grid').replaceChildren(...state.entries.filter(s=>s.category===section.dataset.section).map(makeCard));undo.hidden=!state.previous;undo.textContent='撤销上一步';render();}
function render(){const q=search.value.trim().toLocaleLowerCase();$('clear').hidden=!search.value;const cards=new Map([...sections.querySelectorAll('.card')].map(c=>[c.dataset.id,c]));let count=0;for(const site of state.entries){const match=(category==='全部'||category===site.category)&&(!q||[site.name,site.url,site.description,site.keywords,site.category].join(' ').toLocaleLowerCase().includes(q));cards.get(String(site.id)).hidden=!match;if(match)count++;}for(const section of sections.querySelectorAll('[data-section]')){const n=[...section.querySelectorAll('.card')].filter(c=>!c.hidden).length;section.hidden=!n;section.querySelector('.count').textContent=n;}document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===category)));$('empty').hidden=count>0;$('status').textContent='找到 '+count+' 个网站';$('total').textContent='田豪的导航网 · '+state.entries.length+' 个入口';}
document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;render();});search.addEventListener('input',render);$('clear').onclick=()=>{search.value='';render();search.focus();};$('reset').onclick=()=>{search.value='';category='全部';render();search.focus();};
function backupStamp(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function exportBackup(){
 const payload={app:'tianhao-nav',version:1,exportedAt:new Date().toISOString(),entries:state.entries};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const link=document.createElement('a');
 const objectUrl=URL.createObjectURL(blob);
 link.href=objectUrl;link.download='田豪导航备份-'+backupStamp()+'.json';
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(objectUrl),2000);
 transferMessage.textContent='已导出 '+state.entries.length+' 个网站。';
}
function parseBackup(text){
 let data;
 try{data=JSON.parse(text);}catch{throw Error('这个文件不是有效的 JSON。');}
 const entries=Array.isArray(data)?data:(data&&data.entries);
 if(!Array.isArray(entries)||!entries.length)throw Error('备份里没有任何网站。');
 if(!valid(entries))throw Error('备份内容校验失败：字段、分类或 id 不符合要求。');
 return entries;
}
function entryKey(site){return new URL(site.url).href+'|'+site.category;}
function mergeEntries(base,incoming){
 const seen=new Set(base.map(entryKey));
 const ids=new Set(base.map(site=>String(site.id)));
 const out=base.slice();
 for(const entry of incoming){
  const key=entryKey(entry);
  if(seen.has(key))continue;
  let id=String(entry.id);
  if(ids.has(id))id='custom-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
  ids.add(id);seen.add(key);out.push({...entry,id});
 }
 return out;
}
function importMode(){const picked=document.querySelector('input[name="import-mode"]:checked');return picked?picked.value:'replace';}
function importPreview(){if(!pendingImport)return null;return importMode()==='merge'?mergeEntries(state.entries,pendingImport):pendingImport;}
function refreshImportPreview(){
 const next=importPreview();
 if(!next){confirmImport.hidden=true;return;}
 transferMessage.textContent='备份包含 '+pendingImport.length+' 条，导入后共 '+next.length+' 条。确认后点击「确认导入」。';
 confirmImport.hidden=false;
}
function resetTransfer(){pendingImport=null;confirmImport.hidden=true;transferMessage.textContent='';importFile.value='';}
$('open-transfer').onclick=()=>{resetTransfer();transferDialog.showModal();};
$('close-transfer').onclick=()=>transferDialog.close();
$('do-export').onclick=exportBackup;
$('pick-import').onclick=()=>importFile.click();
importFile.addEventListener('change',async()=>{
 transferMessage.textContent='';confirmImport.hidden=true;pendingImport=null;
 const file=importFile.files&&importFile.files[0];
 if(!file)return;
 try{pendingImport=parseBackup(await file.text());refreshImportPreview();}
 catch(err){transferMessage.textContent=err.message||'无法读取这个备份文件。';}
 importFile.value='';
});
document.querySelectorAll('input[name="import-mode"]').forEach(radio=>radio.addEventListener('change',refreshImportPreview));
confirmImport.onclick=()=>{
 if(!pendingImport)return;
 const next=importMode()==='merge'?mergeEntries(state.entries,pendingImport):pendingImport;
 if(commit(next,'已导入 '+next.length+' 个网站，可以撤销。',transferMessage)){
  category='全部';search.value='';render();transferDialog.close();resetTransfer();
 }
};
$('open-add').onclick=()=>{form.reset();message.textContent='';categoryInput.value=category==='全部'?categories[0]:category;dialog.showModal();urlInput.focus();};$('cancel-add').onclick=()=>dialog.close();
form.addEventListener('submit',e=>{e.preventDefault();message.textContent='';let url;try{url=parseAddress(urlInput.value);}catch(err){message.textContent=err.message||'请输入有效的网址。';return;}if(!categories.includes(categoryInput.value)){message.textContent='请选择分区。';return;}if(state.entries.some(s=>s.category===categoryInput.value&&new URL(s.url).href===url.href)){message.textContent='该分区已经有这个网址了。';return;}const site={id:'custom-'+Date.now()+'-'+Math.random().toString(36).slice(2),url:url.href,category:categoryInput.value,name:$('new-name').value.trim()||url.hostname.replace(/^www\./,''),description:'自定义网站',keywords:url.href,icon:url.origin+'/favicon.ico'};if(commit([...state.entries,site],'已添加「'+site.name+'」至「'+site.category+'」。',message)){category=site.category;search.value='';render();dialog.close();}});
$('cancel-move').onclick=()=>moveDialog.close();
moveForm.addEventListener('submit',e=>{e.preventDefault();moveMessage.textContent='';const site=state.entries.find(s=>String(s.id)===movingId);if(!site||!categories.includes(moveCategory.value))return;if(site.category===moveCategory.value){moveMessage.textContent='请选择不同的分区。';return;}if(state.entries.some(s=>String(s.id)!==movingId&&s.category===moveCategory.value&&new URL(s.url).href===new URL(site.url).href)){moveMessage.textContent='目标分区已经有这个网址了。';return;}const destination=moveCategory.value;if(commit(state.entries.map(s=>String(s.id)===movingId?{...s,category:destination}:s),'已将「'+site.name+'」移动至「'+destination+'」。',moveMessage)){category=destination;search.value='';render();moveDialog.close();sections.querySelector('[data-id="'+CSS.escape(movingId)+'"] summary')?.focus();}});
$('cancel-rename').onclick=()=>renameDialog.close();
renameForm.addEventListener('submit',e=>{e.preventDefault();renameMessage.textContent='';const name=renameInput.value.trim();if(!name){renameMessage.textContent='请输入网站名称，不能只填空格。';renameInput.focus();return;}if(name.length>80){renameMessage.textContent='网站名称最多 80 个字符。';return;}const site=state.entries.find(s=>String(s.id)===renamingId);if(!site)return;if(name===site.name){renameDialog.close();return;}if(commit(state.entries.map(s=>String(s.id)===renamingId?{...s,name}:s),'已将「'+site.name+'」重命名为「'+name+'」。',renameMessage)){search.value='';render();renameDialog.close();sections.querySelector('[data-id="'+CSS.escape(renamingId)+'"] summary')?.focus();}});
undo.onclick=()=>{if(!state.previous)return;if(save({entries:state.previous,previous:null})){notice.textContent='已撤销上一步操作。';category='全部';search.value='';draw();$('open-add').focus();}};
document.addEventListener('click',e=>{if(!e.target.closest('.site-menu'))document.querySelectorAll('.site-menu[open]').forEach(m=>m.open=false);});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!dialog.open&&!moveDialog.open&&!renameDialog.open&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();search.focus();}if(e.key==='Escape'){document.querySelectorAll('.site-menu[open]').forEach(m=>{m.open=false;m.querySelector('summary').focus();});if(document.activeElement===search){search.value='';render();}}});
if(state.previous)notice.textContent='上一步修改可撤销。';draw();



// Cloud wiring: private entries are fetched only after the server verifies login.
let client = null, syncEngine = null, authEpoch = 0;
const authMessage = $('auth-message');
const loginForm = $('login-form');
function setSyncStatus(text, kind = '') {
  $('sync-status').textContent = text;
  $('sync-status').dataset.kind = kind;
}
function lockPage() {
  authEpoch++;
  if (syncEngine) syncEngine.stop();
  syncEngine = null; state = {entries: [], previous: null}; draw();
  document.querySelectorAll('dialog[open]').forEach(d => d.close());
  $('app-shell').hidden = true; $('auth-panel').hidden = false;
  $('account-name').textContent = '';
}
function remoteAdapter(userId) {
  const table = () => client.from('navigation_bookmark_state');
  return {
    async read() {
      const {data, error} = await table().select('entries,revision').eq('user_id', userId).maybeSingle();
      if (error) throw Error(error.code === 'PGRST205' ? '数据库尚未初始化，请先执行 setup.sql。' : '无法读取云端，请检查网络和登录状态。');
      return data || {entries: [], revision: null};
    },
    async write(entries, revision) {
      const query = revision === null
        ? table().insert({user_id: userId, entries})
        : table().update({entries}).eq('user_id', userId).eq('revision', revision);
      const {data, error} = await query.select('entries,revision').maybeSingle();
      if (error && error.code === '23505') return null;
      if (error) throw Error('云端保存失败，请保留本机备份并检查连接。');
      return data;
    }
  };
}
async function resumeSession() {
  const epoch = ++authEpoch;
  authMessage.textContent = '正在验证登录状态…';
  const {data, error} = await client.auth.getUser();
  if (epoch !== authEpoch) return;
  if (error || !data.user) {
    if (syncEngine) lockPage();
    authMessage.textContent = '请使用同一个同步账号，在两台电脑登录。'; return;
  }
  const user = data.user;
  if (syncEngine && syncEngine.userId === user.id) { syncEngine.sync(); return; }
  if (syncEngine) syncEngine.stop();
  state = {entries: [], previous: null}; draw();
  const engine = new NavigationSync.Engine({
    userId: user.id, remote: remoteAdapter(user.id), storage: localStorage, validate: valid,
    onChange(snapshot) {
      if (syncEngine !== engine) return;
      state = {entries: snapshot.entries, previous: snapshot.previous};
      if (engine.ready) {
        $('app-shell').hidden = false; $('auth-panel').hidden = true;
        $('account-name').textContent = user.email || '已登录';
      }
      draw();
    },
    onStatus(text, kind) {
      if (syncEngine !== engine) return;
      setSyncStatus(text, kind);
      if (!engine.ready) authMessage.textContent = text;
    },
    onConflict(conflicts) {
      if (syncEngine !== engine) return;
      $('conflict-summary').textContent = conflicts.length + ' 处内容同时修改：' +
        [...new Set(conflicts.map(c => c.name))].join('、');
      if (!$('conflict-dialog').open) $('conflict-dialog').showModal();
    }
  });
  syncEngine = engine;
  await engine.sync();
}
async function authenticate(mode) {
  if (!client || !loginForm.reportValidity()) return;
  const buttons = [...loginForm.querySelectorAll('button')]; buttons.forEach(b => b.disabled = true);
  authMessage.textContent = mode === 'signup' ? '正在创建同步账号…' : '正在登录…';
  try {
    const email = $('login-email').value.trim(), password = $('login-password').value;
    const result = mode === 'signup'
      ? await client.auth.signUp({email, password, options: {emailRedirectTo: location.origin + location.pathname}})
      : await client.auth.signInWithPassword({email, password});
    $('login-password').value = '';
    if (result.error) throw Error(mode === 'signup' ? '注册未成功，请检查邮箱、密码或稍后重试。' : '登录未成功，请检查账号、密码及邮箱验证状态。');
    if (mode === 'signup' && !result.data.session) {
      authMessage.textContent = '请查看邮箱中的确认邮件，完成验证后回到这里登录。'; return;
    }
    await resumeSession();
  } catch (error) { authMessage.textContent = error.message || '操作未完成，请检查网络后重试。'; }
  finally { buttons.forEach(b => b.disabled = false); }
}
loginForm.addEventListener('submit', e => { e.preventDefault(); authenticate('login'); });
$('signup-button').onclick = () => authenticate('signup');
$('retry-login').onclick = () => client ? resumeSession() : location.reload();
$('sync-now').onclick = () => syncEngine && syncEngine.sync();
$('sign-out').onclick = async () => {
  if (syncEngine?.state.dirty && !confirm('这台电脑还有未同步的修改，已保存在本机。退出后需要用原账号登录才能继续同步。确定退出？')) return;
  lockPage();
  const {error} = await client.auth.signOut({scope: 'local'});
  authMessage.textContent = error ? '退出未完成，请检查网络后重试。当前页面已锁定。' : '已退出登录。';
};
for (const preference of ['local', 'remote']) {
  $('resolve-' + preference).onclick = () => {
    if (syncEngine?.resolve(preference)) $('conflict-dialog').close();
  };
}
$('conflict-dialog').addEventListener('cancel', e => e.preventDefault());
$('conflict-export').onclick = () => exportBackup();
window.addEventListener('online', () => syncEngine?.sync());
window.addEventListener('offline', () => setSyncStatus('网络已断开，修改将暂存本机。', 'pending'));
window.addEventListener('focus', () => syncEngine?.sync());
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncEngine?.sync(); });
setInterval(() => { if (!document.hidden) syncEngine?.sync(); }, 20000);
window.addEventListener('beforeunload', e => {
  if (syncEngine?.state.dirty) { e.preventDefault(); e.returnValue = ''; }
});
if (!window.__ACCOUNT_REDIRECT__) {
try {
  const config = window.NAV_CLOUD_CONFIG;
  if (!config?.url || !config?.publishableKey || !window.supabase) throw Error('同步组件未加载，请检查网络后点击“重试”。');
  client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}
  });
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') { lockPage(); authMessage.textContent = '登录已退出，请重新登录。'; }
    // Auth callbacks must not await other auth methods while holding the SDK lock.
    else if (event === 'SIGNED_IN' && session) setTimeout(() => resumeSession(), 0);
  });
  resumeSession();
} catch (error) { authMessage.textContent = error.message; }
}
