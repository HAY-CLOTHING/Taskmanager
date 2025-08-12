// ========== HAY Task Manager — script.js (v2.6 + separate login) ==========

// 0) Require login before loading the app
(function(){
  const STORAGE_KEY = 'hay-v2-6-login'; // MUST match login.html
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    const cur = raw ? JSON.parse(raw).currentUserId : '';
    if (!cur) { window.location.replace('login.html'); }
  }catch{
    window.location.replace('login.html');
  }
})();

// 1) App store
const STORAGE_KEY = 'hay-v2-6-login';

// Seeds
const seedUsers = [
  { id: 'u1', name: 'Sribalaji', email: 'hayanalyst1@gmail.com', role: 'Admin' },
  { id: 'u2', name: 'Sangeeth',   email: 'Sangeeth@hayclothing.in', role: 'MD'  },
  { id: 'u3', name: 'Brindha',    email: 'haybrindha@gmail.com',    role: 'Employee' },
  { id: 'u4', name: 'Gokul',      email: 'haygokul@gmail.com',      role: 'Employee' },
  { id: 'u5', name: 'Neha Gupta', email: 'neha@hay.clo',            role: 'Employee' },
];
function isoTodayPlus(days=0){ const d=new Date(); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
const seedTasks = [
  { id:'t1', title:'Prepare Q3 sales deck', description:'Collect metrics and build a 10-slide deck for Monday meeting.', assignedBy:'u2', assignedTo:'u3', assignedDate:isoTodayPlus(-3), dueDate:isoTodayPlus(2), completedDate:'', actionTaken:'', status:'In Progress', comments:[{ by:'u3', at:new Date().toISOString(), text:'Gathering numbers from finance.' }] },
  { id:'t2', title:'Migrate website images', description:'Lossless compress & upload to CDN.', assignedBy:'u1', assignedTo:'u4', assignedDate:isoTodayPlus(-7), dueDate:isoTodayPlus(1), completedDate:'', actionTaken:'Tried Squoosh, testing pipeline.', status:'Open', comments:[] },
  { id:'t3', title:'Close supplier audit', description:'Send final NCR report to vendor.', assignedBy:'u2', assignedTo:'u5', assignedDate:isoTodayPlus(-10), dueDate:isoTodayPlus(-1), completedDate:'', actionTaken:'', status:'Open', comments:[{ by:'u5', at:new Date().toISOString(), text:'Waiting on legal clearance.' }] },
];

const storage = {
  load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return { users:seedUsers.slice(), tasks:seedTasks.slice(), currentUserId:'', viewMode:'table' };
      const p = JSON.parse(raw) || {};
      let users = (Array.isArray(p.users) && p.users.length) ? p.users : seedUsers.slice();
      let tasks = (Array.isArray(p.tasks) && p.tasks.length) ? p.tasks : seedTasks.slice();
      users.forEach(u => { if (u.role === 'Boss') u.role = 'MD'; });
      let currentUserId = typeof p.currentUserId==='string' ? p.currentUserId : '';
      if (!users.some(u => u.id === currentUserId)) currentUserId = '';
      const viewMode = p.viewMode==='board' ? 'board' : 'table';
      return { users, tasks, currentUserId, viewMode };
    } catch {
      return { users:seedUsers.slice(), tasks:seedTasks.slice(), currentUserId:'', viewMode:'table' };
    }
  },
  save(s){ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
};
const state = storage.load();

// 2) DOM
const $ = (id)=>document.getElementById(id);
const whoami=$('whoami'), whoamiName=$('whoamiName'), whoamiRole=$('whoamiRole'), logoutBtn=$('logoutBtn');
const tabsWrap=$('tabsWrap'); const tabs=$('tabs'); const bottomTabs=$('bottomTabs');
const panelMy=$('panel-my'), panelAssigned=$('panel-assigned'), panelAll=$('panel-all'), panelUsers=$('panel-users');

const filterStatus=$('filterStatus'), filterUser=$('filterUser'), filterFrom=$('filterFrom'), filterTo=$('filterTo'), sortBy=$('sortBy'), applyFilters=$('applyFilters'), resetFilters=$('resetFilters'), viewTable=$('viewTable'), viewBoard=$('viewBoard');

const taskAssignTo=$('taskAssignTo'), taskTitle=$('taskTitle'), taskDesc=$('taskDesc'), taskDue=$('taskDue'), createForm=$('createForm');
const notifications=$('notifications'), clearNoti=$('clearNoti');

const commentModal=$('commentModal'), commentThread=$('commentThread'), newComment=$('newComment'), sendComment=$('sendComment');

// 3) Utils
const currentUser=()=>state.users.find(u=>u.id===state.currentUserId)||null;
const userById=(id)=>state.users.find(u=>u.id===id)||{name:'[deleted]',email:'n/a',role:'Employee'};
const fmtDate = (iso) => { // dd/mm/yyyy
  if (!iso) return '';
  const parts = String(iso).split('-');
  if (parts.length === 3) { const [y,m,d] = parts; return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`; }
  const dt = new Date(iso); if (!isNaN(dt)) { const dd=String(dt.getDate()).padStart(2,'0'), mm=String(dt.getMonth()+1).padStart(2,'0'), yy=dt.getFullYear(); return `${dd}/${mm}/${yy}`; }
  return iso;
};
const daysBetween=(a,b)=>{ const A=new Date(a), B=new Date(b); return Math.ceil((B-A)/(1000*60*60*24)); };
const uid=(p)=>p+Math.random().toString(36).slice(2,8);
const escapeHtml=(s)=> String(s).replace(/[&<>\"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function pushNoti(t){ const div=document.createElement('div'); div.style.background='#f7e9ec'; div.style.color='#7d2130'; div.style.border='1px solid rgba(125,33,48,.25)'; div.style.borderLeft='4px solid #7d2130'; div.style.borderRadius='12px'; div.style.padding='8px 12px'; div.style.fontSize='14px'; div.textContent=t; notifications.prepend(div); }
function emailSim(to,sub){ const u=userById(to); console.log(`email sent to ${u.email}: ${sub}`); }

// 4) Roles
const isManager = (role) => role === 'MD' || role === 'Admin';
function canDelete(task){ const me=currentUser(); if(!me) return false; if(task.assignedTo===me.id) return false; return (isManager(me.role) || task.assignedBy===me.id); }

// 5) Style helpers
function styleStatusSelect(sel){
  if(!sel) return;
  sel.classList.add('btn-pill','status-select');
  const v = sel.value || sel.options[sel.selectedIndex]?.value;
  // readable dark text on colored light backgrounds
  sel.style.color = '#0f172a';
  if(v==='Open'){              sel.style.background='#fff7ed'; sel.style.borderColor='#fdba74'; }
  else if(v==='In Progress'){  sel.style.background='#e0f2fe'; sel.style.borderColor='#7dd3fc'; }
  else if(v==='Completed'){    sel.style.background='#dcfce7'; sel.style.borderColor='#86efac'; }
}

function styleBtn(el, variant){
  if(!el) return;
  el.classList.add('btn','btn-pill');
  // Add classes (for your CSS) + inline fallbacks
  const set = (bg, bc, color) => {
    el.style.background = bg; el.style.borderColor = bc; el.style.color = color;
    el.style.fontWeight = '700';
  };
  if(variant==='comment'){ el.classList.add('btn-comment'); set('#e6f0ff','#c7d2fe','#1e3a8a'); }
  if(variant==='action'){  el.classList.add('btn-action');  set('#fff7ed','#fed7aa','#92400e'); }
  if(variant==='delete'){  el.classList.add('btn-delete');  set('#fee2e2','#fecaca','#991b1b'); }
}

function applyChipStyles(root){
  // inline fallback so chips look right even if CSS is missing
  root.querySelectorAll('.chip').forEach(ch => {
    ch.style.display='inline-flex';
    ch.style.alignItems='center';
    ch.style.gap='.4rem';
    ch.style.padding='.18rem .55rem';
    ch.style.fontSize='.85rem';
    ch.style.fontWeight='600';
    ch.style.borderRadius='999px';
    ch.style.background='#f1f5f9';
    ch.style.color='#0f172a';
    ch.style.border='1px solid #e2e8f0';
  });
  root.querySelectorAll('.chip.brand').forEach(ch => {
    ch.style.background='#f7e9ec';
    ch.style.color='#7d2130';
    ch.style.borderColor='rgba(125,33,48,.25)';
  });
  root.querySelectorAll('.chip .dot').forEach(d => {
    d.style.width='6px'; d.style.height='6px'; d.style.borderRadius='999px'; d.style.background='#94a3b8';
  });
}

// 6) Init
init();
function init(){
  const d=new Date(); d.setDate(d.getDate()+3); if(taskDue) taskDue.value=d.toISOString().slice(0,10);

  // Logout → back to login
  logoutBtn?.addEventListener('click', ()=>{
    state.currentUserId='';
    storage.save(state);
    window.location.replace('login.html');
  });

  tabsWrap?.addEventListener('click', (e)=>{ const btn=e.target.closest('.tab-pill'); if(!btn) return; setActiveTab(btn.dataset.tab); render(); });
  bottomTabs?.addEventListener('click', (e)=>{ const btn=e.target.closest('button[data-tab]'); if(!btn) return; setActiveTab(btn.dataset.tab); render(); });

  applyFilters?.addEventListener('click', ()=>render());
  resetFilters?.addEventListener('click', ()=>{ filterStatus.value=''; filterUser.value=''; filterFrom.value=''; filterTo.value=''; sortBy.value='assignedDate-desc'; render(); });

  viewTable?.addEventListener('click', ()=>{ state.viewMode='table'; toggleViewButtons(); render(); });
  viewBoard?.addEventListener('click', ()=>{ state.viewMode='board'; toggleViewButtons(); render(); });

  clearNoti?.addEventListener('click', ()=> notifications.innerHTML='');

  document.querySelectorAll('[data-close-modal]').forEach(b=> b.addEventListener('click', ()=> commentModal.classList.add('hidden')));
  sendComment?.addEventListener('click', addComment);
  newComment?.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); addComment(); } });

  // Topbar shadow on scroll
  (() => {
    const tb = document.querySelector('.hay-topbar');
    if (!tb) return;
    const onScroll = () => tb.classList.toggle('scrolled', window.scrollY > 6);
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  })();

  render();
}
function toggleViewButtons(){ viewTable?.classList.toggle('active', state.viewMode==='table'); viewBoard?.classList.toggle('active', state.viewMode!=='table'); }

// 7) Lists & rendering helpers
function refreshFilterUsers(){
  if (!filterUser) return;
  const curr=filterUser.value;
  filterUser.innerHTML='<option value="">Any</option>';
  (state.users.length?state.users:seedUsers).forEach(u=>{
    const o=document.createElement('option'); o.value=u.id; o.textContent=u.name; filterUser.appendChild(o);
  });
  filterUser.value=curr||'';
}
function refreshAssignTo(){
  const me=currentUser(); if (!taskAssignTo) return; taskAssignTo.innerHTML=''; if(!me) return;
  let pool=state.users.filter(u=>u.id!==me.id);
  if(me.role==='Employee'){ pool=pool.filter(u=>u.role==='Employee'); }
  pool.forEach(u=>{ const o=document.createElement('option'); o.value=u.id; o.textContent=`${u.name} (${u.role})`; taskAssignTo.appendChild(o); });
}

// 8) Render
function render(){
  const me=currentUser(); if(!me){ window.location.replace('login.html'); return; }

  whoami?.classList.remove('hidden');
  if (whoamiName) whoamiName.textContent = me.name;
  if (whoamiRole) whoamiRole.textContent = me.role;

  refreshFilterUsers(); refreshAssignTo();

  // Only managers see All/Users
  const btnAll   = document.querySelector('button[data-tab="all"]');
  const btnUsers = document.querySelector('button[data-tab="users"]');
  const mBtnAll   = bottomTabs?.querySelector('button[data-tab="all"]');
  const mBtnUsers = bottomTabs?.querySelector('button[data-tab="users"]');
  const can = isManager(me.role);
  btnAll?.classList.toggle('hidden', !can);
  btnUsers?.classList.toggle('hidden', !can);
  mBtnAll?.classList.toggle('hidden', !can);
  mBtnUsers?.classList.toggle('hidden', !can);

  // Default tab
  const anyActive = document.querySelector('.tab-pill.active') || document.querySelector('.bottom-tab.active');
  if(!anyActive){ setActiveTab('my'); }

  toggleViewButtons();

  const active = document.querySelector('.tab-pill.active')?.dataset.tab || document.querySelector('.bottom-tab.active')?.dataset.tab;
  if(active){ renderPanel(active); }

  // default slate Create button (flash handled on submit)
  const createBtn = createForm?.querySelector('button');
  if (createBtn){ createBtn.classList.add('btn-success'); }

  storage.save(state);
}
function setActiveTab(id){
  document.querySelectorAll('.tab-pill').forEach(b=> b.classList.toggle('active', b.dataset.tab===id));
  document.querySelectorAll('.bottom-tab').forEach(b=> b.classList.toggle('active', b.dataset.tab===id));
  document.querySelectorAll('[id^="panel-"]').forEach(p=> p.classList.add('hidden'));
  document.getElementById(`panel-${id}`)?.classList.remove('hidden');
}

// 9) Filters & panels
function applyGlobalFilters(list){
  const s=filterStatus?.value, u=filterUser?.value, from=filterFrom?.value, to=filterTo?.value;
  let out=list.filter(t => (!s||t.status===s) && (!u||t.assignedTo===u||t.assignedBy===u));
  if(from){ out=out.filter(t=>t.assignedDate>=from); }
  if(to){ out=out.filter(t=>t.assignedDate<=to); }
  const [key,dir]=(sortBy?.value||'assignedDate-desc').split('-');
  out.sort((a,b)=>{ let A=a[key]||'', B=b[key]||''; if(A<B) return dir==='asc'?-1:1; if(A>B) return dir==='asc'?1:-1; return 0; });
  return out;
}
function renderPanel(which){
  const me=currentUser(); if(!me) return;

  const myTasks      = state.tasks.filter(t => t.assignedTo===me.id);
  const assignedByMe = state.tasks.filter(t => t.assignedBy===me.id);
  const all          = state.tasks.slice();

  const map = {
    my:       { title:'📥 My Tasks',        subtitle:'Assigned to me',                   list: myTasks,      el: panelMy,      badge:'brand' },
    assigned: { title:'📤 Assigned by Me',  subtitle:'Tasks I created for teammates',   list: assignedByMe, el: panelAssigned, badge:'' },
    all:      { title:'🌐 All Tasks',       subtitle:'Everything in HAY Clothing',      list: all,          el: panelAll,     badge:'' },
  };

  if(which==='users'){ renderUsersPanel(); return; }

  const { title, subtitle, list, el, badge } = map[which];
  const filtered = applyGlobalFilters(list);

  if (el) {
    el.innerHTML = '';
    if(state.viewMode==='table'){ el.appendChild(renderTableBlock(title, subtitle, filtered, badge)); }
    else { el.appendChild(renderBoardBlock(title, subtitle, filtered, badge)); }
  }
}
function headerBlock(title, subtitle, count, badgeClass=''){
  const head=document.createElement('div'); head.className='card-head';
  head.innerHTML = `<div>
    <div class="font-semibold">${escapeHtml(title)} <span class="badge ${badgeClass}">${count} shown</span></div>
    <div class="text-xs text-slate-500">${escapeHtml(subtitle)}</div>
  </div>`;
  return head;
}
function renderTableBlock(title, subtitle, tasks, badgeClass){
  const wrap=document.createElement('div'); wrap.className='card overflow-hidden';
  wrap.appendChild(headerBlock(title, subtitle, tasks.length, badgeClass));
  const holder=document.createElement('div'); holder.className='overflow-auto scroll-thin';
  holder.innerHTML=`
    <table class="min-w-full text-sm">
      <thead class="bg-slate-50 text-slate-600"><tr>
        <th class="text-left px-4 py-2">Title</th>
        <th class="text-left px-4 py-2">Assigned By</th>
        <th class="text-left px-4 py-2">Assigned To</th>
        <th class="text-left px-4 py-2">Status</th>
        <th class="text-left px-4 py-2">Due</th>
        <th class="text-left px-4 py-2">Actions</th>
      </tr></thead>
      <tbody class="divide-y divide-slate-100" id="tbody"></tbody>
    </table>`;
  const body=holder.querySelector('#tbody'); tasks.forEach(t=> body.appendChild(renderTaskRow(t)));
  wrap.appendChild(holder); return wrap;
}
function renderTaskRow(task){
  const deleteAllowed = canDelete(task);
  const tr=document.createElement('tr'); tr.className='hover:bg-slate-50';
  tr.innerHTML=`
    <td class="px-4 py-2 align-top">
      <div class="font-medium">${escapeHtml(task.title)}</div>
      <div class="text-xs text-slate-500">Assigned ${fmtDate(task.assignedDate)} • Due ${fmtDate(task.dueDate)}</div>
      <div class="mt-1 text-sm text-slate-600">${escapeHtml(task.description)}</div>
      <div class="mt-2 text-xs text-slate-500">Action Taken: ${escapeHtml(task.actionTaken||'-')}</div>
      <div class="mt-1 text-xs">
        ${task.completedDate? `<span class='px-2 py-0.5 rounded-full bg-green-100 text-green-700'>Completed ${fmtDate(task.completedDate)} (${daysBetween(task.assignedDate, task.completedDate)} days)</span>`: ''}
      </div>
    </td>

    <!-- Assigned By (chip) -->
    <td class="px-4 py-2 align-top">
      <span class="chip"><span class="dot"></span>${escapeHtml(userById(task.assignedBy).name)}</span>
    </td>

    <!-- Assigned To (brand chip) -->
    <td class="px-4 py-2 align-top">
      <span class="chip brand"><span class="dot"></span>${escapeHtml(userById(task.assignedTo).name)}</span>
    </td>

    <!-- Status -->
    <td class="px-4 py-2 align-top">
      <select data-status class="input text-sm status-select"></select>
    </td>

    <!-- Due -->
    <td class="px-4 py-2 align-top">${fmtDate(task.dueDate)}</td>

    <!-- Actions -->
    <td class="px-4 py-2 align-top">
      <div class="flex items-center gap-2">
        <button class="btn btn-pill btn-comment text-xs" data-action="comment">Comments (${task.comments.length})</button>
        <button class="btn btn-pill btn-action  text-xs" data-action="edit-action">Update Action</button>
        ${deleteAllowed ? `<button class="btn btn-pill btn-delete text-xs" data-action="delete">🗑️ Delete</button>` : `<span class="text-xs text-slate-400 italic">No delete</span>`}
      </div>
    </td>`;

  // style chips inline (fallback) + populate status
  applyChipStyles(tr);

  const statusSel = tr.querySelector('[data-status]');
  ['Open','In Progress','Completed'].forEach(s=>{
    const o=document.createElement('option'); o.value=s; o.textContent=s;
    if (task.status===s) o.selected=true;
    statusSel.appendChild(o);
  });
  styleStatusSelect(statusSel);
  statusSel.addEventListener('change', (e)=>{ styleStatusSelect(e.target); updateTaskStatus(task.id, e.target.value); });

  // wire actions
  tr.querySelector('[data-action="comment"]').addEventListener('click', ()=> openComments(task.id));
  tr.querySelector('[data-action="edit-action"]').addEventListener('click', ()=> updateActionTaken(task.id));
  if(deleteAllowed){ tr.querySelector('[data-action="delete"]').addEventListener('click', ()=> deleteTask(task.id)); }
  return tr;
}
function renderBoardBlock(title, subtitle, tasks, badge){
  const wrap=document.createElement('div'); wrap.className='space-y-3';
  wrap.appendChild(headerBlock(title, subtitle, tasks.length, badge));
  const grid=document.createElement('div'); grid.className='grid grid-cols-1 md:grid-cols-3 gap-3';
  ['Open','In Progress','Completed'].forEach(col=>{
    const sec=document.createElement('div'); sec.className='col';
    sec.innerHTML=`
      <div class="card overflow-hidden">
        <div class="card-head"><div class="font-semibold">${col}</div></div>
        <div class="p-3 space-y-3 min-h-[220px]" data-col-body></div>
      </div>`;
    const body=sec.querySelector('[data-col-body]');
    body.addEventListener('dragover', e=>{ e.preventDefault(); body.classList.add('bg-slate-50'); body.style.outline='2px dashed rgba(125,33,48,.35)'; body.style.outlineOffset='-6px'; });
    body.addEventListener('dragleave', ()=>{ body.classList.remove('bg-slate-50'); body.style.outline='none'; });
    body.addEventListener('drop', e=>{ e.preventDefault(); body.classList.remove('bg-slate-50'); body.style.outline='none'; const id=e.dataTransfer.getData('text/plain'); if(!id) return; updateTaskStatus(id, col); });
    tasks.filter(t=>t.status===col).forEach(t=> body.appendChild(renderCard(t)));
    grid.appendChild(sec);
  });
  wrap.appendChild(grid); return wrap;
}
function renderCard(task){
  const delAllowed=canDelete(task);
  const card=document.createElement('div');
  card.className='rounded-xl border border-slate-200 bg-white shadow-sm p-3 text-sm'; card.draggable=true;
  card.addEventListener('dragstart', e=>{ card.classList.add('dragging'); e.dataTransfer.setData('text/plain', task.id); });
  card.addEventListener('dragend', ()=> card.classList.remove('dragging'));
  card.innerHTML=`
    <div class="flex items-start justify-between gap-2">
      <div class="font-medium">${escapeHtml(task.title)}</div>
      <select class="input text-xs py-1 px-2 status-select" data-status></select>
    </div>
    <div class="text-slate-500 mt-1">Due ${fmtDate(task.dueDate)}</div>
    <div class="mt-2">${escapeHtml(task.description)}</div>

    <!-- Assigned chips -->
    <div class="mt-2 text-xs flex items-center gap-2">
      <span class="chip"><span class="dot"></span>${escapeHtml(userById(task.assignedBy).name)}</span>
      <span>→</span>
      <span class="chip brand"><span class="dot"></span>${escapeHtml(userById(task.assignedTo).name)}</span>
    </div>

    <div class="mt-2 flex items-center gap-2">
      <button class="btn btn-pill btn-comment text-xs" data-action="comment">💬 ${task.comments.length}</button>
      <button class="btn btn-pill btn-action  text-xs" data-action="edit-action">✏️ Update</button>
      ${delAllowed ? `<button class="btn btn-pill btn-delete text-xs" data-action="delete">🗑️</button>` : ``}
    </div>`;

  // chips & status
  applyChipStyles(card);

  const statusSel = card.querySelector('[data-status]');
  ['Open','In Progress','Completed'].forEach(s=>{
    const o=document.createElement('option'); o.value=s; o.textContent=s;
    if (task.status===s) o.selected=true;
    statusSel.appendChild(o);
  });
  styleStatusSelect(statusSel);
  statusSel.addEventListener('change', (e)=>{ styleStatusSelect(e.target); updateTaskStatus(task.id, e.target.value); });

  // actions
  card.querySelector('[data-action="comment"]').addEventListener('click', ()=> openComments(task.id));
  card.querySelector('[data-action="edit-action"]').addEventListener('click', ()=> updateActionTaken(task.id));
  if(delAllowed){ card.querySelector('[data-action="delete"]').addEventListener('click', ()=> deleteTask(task.id)); }
  return card;
}

// 10) Users panel
function renderUsersPanel(){
  const me=currentUser(); panelUsers.innerHTML='';
  const wrap=document.createElement('div'); wrap.className='card overflow-hidden';
  wrap.innerHTML=`<div class="card-head"><h3 class="font-semibold">Manage Users</h3><button id="addUserBtn" class="btn-primary">Add User</button></div>
    <div class="overflow-auto scroll-thin"><table class="min-w-full text-sm">
      <thead class="bg-slate-50 text-slate-600"><tr><th class="text-left px-4 py-2">Name</th><th class="text-left px-4 py-2">Email</th><th class="text-left px-4 py-2">Role</th><th class="text-left px-4 py-2">Actions</th></tr></thead>
      <tbody id="userBody" class="divide-y divide-slate-100"></tbody></table></div>`;
  const body=wrap.querySelector('#userBody');
  state.users.forEach(u=>{
    const tr=document.createElement('tr'); tr.className='hover:bg-slate-50';
    tr.innerHTML=`<td class="px-4 py-2">${escapeHtml(u.name)}</td><td class="px-4 py-2">${escapeHtml(u.email)}</td>
      <td class="px-4 py-2">
        <select data-role class="input text-sm">
          <option ${u.role==='Employee'?'selected':''}>Employee</option>
          <option ${u.role==='Admin'?'selected':''}>Admin</option>
          <option ${u.role==='MD'?'selected':''}>MD</option>
        </select>
      </td>
      <td class="px-4 py-2"><div class="flex items-center gap-2">
        <button class="btn text-xs" data-action="save">Save</button>
        <button class="btn text-xs" data-action="delete">🗑️ Delete</button>
      </div></td>`;
    styleBtn(tr.querySelector('[data-action="save"]'), 'action');
    styleBtn(tr.querySelector('[data-action="delete"]'), 'delete');

    tr.querySelector('[data-action="save"]').addEventListener('click', ()=>{
      const role=tr.querySelector('[data-role]').value;
      u.role=role; pushNoti(`Updated role for ${u.name} → ${role}`); storage.save(state); render();
    });
    tr.querySelector('[data-action="delete"]').addEventListener('click', ()=>{
      if(u.id===me.id){ alert('You cannot delete yourself.'); return; }
      if(!confirm(`Delete user ${u.name}?`)) return;
      state.tasks.forEach(t=>{ if(t.assignedBy===u.id) t.assignedBy=me.id; if(t.assignedTo===u.id) t.assignedTo=me.id; });
      state.users.splice(state.users.findIndex(x=>x.id===u.id),1);
      pushNoti(`Deleted user ${u.name}`); storage.save(state); render();
    });
    body.appendChild(tr);
  });
  wrap.querySelector('#addUserBtn').addEventListener('click', ()=>{
    const name=prompt('Name?'); if(!name) return;
    const email=prompt('Email?'); if(!email) return;
    const role=prompt('Role? (Employee/Admin/MD)','Employee')||'Employee';
    const nu={id:uid('u'),name,email,role};
    state.users.push(nu);
    pushNoti(`Added user ${name} as ${role}`); storage.save(state); render();
  });
  panelUsers.appendChild(wrap);
}

// 11) Mutations
function updateTaskStatus(id,status){
  const t=state.tasks.find(x=>x.id===id||x.id===String(id)); if(!t) return;
  const before=t.status; t.status=status;
  if(status==='Completed'&&!t.completedDate){ t.completedDate=new Date().toISOString().slice(0,10); }
  if(before!=='Completed'&&status!=='Completed'){ t.completedDate=''; }
  pushNoti(`Status changed: “${t.title}” → ${status}`); emailSim(t.assignedBy, `[Status] ${t.title} is now ${status}`); emailSim(t.assignedTo, `[Status] ${t.title} is now ${status}`);
  render();
}
function openComments(id){ const t=state.tasks.find(x=>x.id===id); if(!t) return; commentModal.classList.remove('hidden'); commentModal.dataset.taskId=id; newComment.value=''; renderComments(t); }
function renderComments(task){
  commentThread.innerHTML='';
  task.comments.forEach(c=>{
    const who=userById(c.by).name;
    const item=document.createElement('div');
    item.className='bg-slate-50 border border-slate-200 rounded-xl px-3 py-2';
    item.innerHTML=`<div class='text-xs text-slate-500'>${escapeHtml(who)} • ${new Date(c.at).toLocaleString()}</div><div>${escapeHtml(c.text)}</div>`;
    commentThread.appendChild(item);
  });
  if(task.comments.length===0){
    const empty=document.createElement('div'); empty.className='text-sm text-slate-500'; empty.textContent='No comments yet.'; commentThread.appendChild(empty);
  }
}
function addComment(){
  const id=commentModal.dataset.taskId; const t=state.tasks.find(x=>x.id===id); const me=currentUser(); if(!me) return;
  const text=newComment.value.trim(); if(!text) return;
  t.comments.push({by:me.id,at:new Date().toISOString(),text});
  pushNoti(`Comment added on “${t.title}” by ${me.name}`);
  emailSim(t.assignedBy, `[Comment] ${me.name} commented on ${t.title}`);
  emailSim(t.assignedTo, `[Comment] ${me.name} commented on ${t.title}`);
  newComment.value=''; renderComments(t); render();
}
function updateActionTaken(id){
  const t=state.tasks.find(x=>x.id===id); if(!t) return;
  const v=prompt('Action taken / progress note:', t.actionTaken||''); if(v===null) return;
  t.actionTaken=v; pushNoti(`Updated action for “${t.title}”.`); storage.save(state); render();
}
function deleteTask(id){
  const t=state.tasks.find(x=>x.id===id); if(!t) return;
  if(!canDelete(t)){ alert('You cannot delete a task that is assigned to you.'); return; }
  if(!confirm('Delete this task?')) return;
  state.tasks.splice(state.tasks.findIndex(x=>x.id===id),1);
  pushNoti(`Deleted task “${t.title}”.`); storage.save(state); render();
}

// 12) Create Task
createForm?.addEventListener('submit',(e)=>{
  e.preventDefault();
  const me=currentUser(); if(!me){ window.location.replace('login.html'); return; }
  const assignedTo=taskAssignTo?.value, title=taskTitle?.value.trim(), description=taskDesc?.value.trim(), dueDate=taskDue?.value;
  if(!title||!description||!dueDate){ alert('Please fill all fields.'); return; }
  const t={ id:uid('t'), title, description, assignedBy:me.id, assignedTo, assignedDate:new Date().toISOString().slice(0,10), dueDate, completedDate:'', actionTaken:'', status:'Open', comments:[] };
  state.tasks.unshift(t);
  pushNoti(`New task assigned to ${userById(assignedTo).name}: “${title}”.`);
  emailSim(assignedTo, `[New Task] ${title}`);
  createForm.reset(); refreshAssignTo(); render();

  // Flash green briefly
  const createBtn = createForm.querySelector('button');
  if (createBtn){
    const prev = { bg:createBtn.style.backgroundColor, b:createBtn.style.borderColor, sh:createBtn.style.boxShadow };
    createBtn.style.transition='background .18s ease, border-color .18s ease, box-shadow .18s ease';
    createBtn.style.backgroundColor='#16a34a'; createBtn.style.borderColor='#15803d'; createBtn.style.boxShadow='0 10px 28px -14px rgba(22,163,74,.45)';
    setTimeout(()=>{ createBtn.style.backgroundColor=prev.bg||''; createBtn.style.borderColor=prev.b||''; createBtn.style.boxShadow=prev.sh||''; }, 700);
  }
});
