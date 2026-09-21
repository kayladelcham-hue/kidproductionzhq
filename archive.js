// Deal Closed workflow + client/project archive for KP HQ.
(function(){
  const CLOSED='Deal Closed';
  const activeClients=()=>D.clients.filter(c=>c.status!==CLOSED);
  const activeProjects=()=>D.projects.filter(p=>p.status!==CLOSED);

  if(typeof pages!=='undefined'&&!pages.includes('Archive')){
    const i=pages.indexOf('Resources');
    pages.splice(i>=0?i:pages.length,0,'Archive');
  }

  function editShell(title,body,saveCall){
    document.body.insertAdjacentHTML('beforeend',`<div id="modalbg" class="modalbg"><div class="modal"><div class="modalhead"><h2>${esc(title)}</h2><button class="x" onclick="closeM()">×</button></div>${body}<button class="btn" onclick="${saveCall}">Save changes</button></div></div>`);
  }

  window.saveClientDealEdit=async function(id){
    const row={name:val('e1'),status:val('e2'),base_value:+val('e3')||0,next_action:val('e4')};
    const {error}=await sb.from('clients').update(row).eq('id',id);
    if(error)return alert(error.message);
    closeM();await loadAll();
    if(row.status===CLOSED){current='Archive';shell();}else openClient(id);
  };

  window.saveProjectDealEdit=async function(id,clientId){
    const row={client_id:val('e0'),name:val('e1'),value:+val('e2')||0,status:val('e3'),next_action:val('e4'),start_date:val('e5')||null,end_date:val('e6')||null};
    const {error}=await sb.from('projects').update(row).eq('id',id);
    if(error)return alert(error.message);
    closeM();await loadAll();
    if(row.status===CLOSED){current='Archive';shell();}else if(clientId)openClient(clientId);else page();
  };

  window.editClient=function(id){
    const x=D.clients.find(x=>x.id===id);if(!x)return;
    editShell('Edit client',
      input('e1','Client name','text',x.name)+
      select('e2','Status',[['Lead','Lead'],['Consultation','Consultation'],['Proposal','Proposal'],['Booked','Booked'],['Active','Active'],['Complete','Complete'],[CLOSED,CLOSED]],x.status)+
      input('e3','Base value','number',x.base_value||0)+
      input('e4','Next action','text',x.next_action||''),
      `saveClientDealEdit('${id}')`
    );
  };

  window.editProject=function(id,clientId){
    const x=D.projects.find(x=>x.id===id);if(!x)return;
    editShell('Edit project',
      select('e0','Client',D.clients.map(c=>[c.id,c.name]),x.client_id)+
      input('e1','Project name','text',x.name)+
      input('e2','Value','number',x.value||0)+
      select('e3','Status',[['Planning','Planning'],['Proposal','Proposal'],['Booked','Booked'],['Active','Active'],['Complete','Complete'],['Cancelled','Cancelled'],[CLOSED,CLOSED]],x.status)+
      input('e4','Next action','text',x.next_action||'')+
      input('e5','Start date','date',x.start_date||'')+
      input('e6','End date','date',x.end_date||''),
      `saveProjectDealEdit('${id}','${clientId||''}')`
    );
  };

  window.clients=function(v){
    const a=activeClients();
    v.innerHTML=`<div class="sectionhead"><div><h2>Client roster</h2><p>Open a client to see their complete KP history.</p></div><div class="actions"><button class="secondary" onclick="go('Archive')">Archive</button><button class="btn" onclick="modal('client')">+ Client</button></div></div>${rows(a,c=>`<button class="clientopen" onclick="openClient('${c.id}')"><div><strong>${esc(c.name)}</strong><span>${activeProjects().filter(p=>p.client_id===c.id).length} active project${activeProjects().filter(p=>p.client_id===c.id).length===1?'':'s'} • ${esc(c.status)}</span></div><span class="profilearrow">View profile →</span></button>`)}`;
  };

  window.projects=function(v){
    const a=activeProjects();
    v.innerHTML=`<div class="sectionhead"><div><h2>Projects</h2><p>Every active engagement.</p></div><div class="actions"><button class="secondary" onclick="go('Archive')">Archive</button><button class="btn" onclick="modal('project')">+ Project</button></div></div>${rows(a,p=>`<div class="clickrow" onclick="if(!event.target.closest('button,a'))editProject('${p.id}','${p.client_id||''}')"><div><span>${esc(D.clients.find(c=>c.id===p.client_id)?.name||'Client')}</span><strong>${esc(p.name)}</strong><span>${esc(p.status)} • ${esc(p.next_action||'No next action')}</span></div><div class="rowactions"><strong>${money(p.value)}</strong><button class="danger mini" onclick="event.stopPropagation();deleteRecord('projects','${p.id}','${esc(p.name).replace(/'/g,'&#39;')}')">Delete</button></div></div>`)}`;
  };

  window.restoreArchivedClient=async function(id){
    const {error}=await sb.from('clients').update({status:'Active'}).eq('id',id);if(error)return alert(error.message);await loadAll();page();
  };
  window.restoreArchivedProject=async function(id){
    const {error}=await sb.from('projects').update({status:'Active'}).eq('id',id);if(error)return alert(error.message);await loadAll();page();
  };

  window.archivePage=function(v){
    const cs=D.clients.filter(c=>c.status===CLOSED);
    const ps=D.projects.filter(p=>p.status===CLOSED);
    const closedValue=ps.reduce((a,p)=>a+(+p.value||0),0);
    v.innerHTML=`<div class="metrics"><div class="card metric"><span>Archived clients</span><strong>${cs.length}</strong></div><div class="card metric"><span>Closed projects</span><strong>${ps.length}</strong></div><div class="card metric"><span>Closed deal value</span><strong>${money(closedValue)}</strong></div></div>
      <div class="sectionhead"><div><h2>Client archive</h2><p>Clients moved here when their status is Deal Closed.</p></div></div>
      ${rows(cs,c=>`<div><strong>${esc(c.name)}</strong><span>${D.projects.filter(p=>p.client_id===c.id).length} total project${D.projects.filter(p=>p.client_id===c.id).length===1?'':'s'} • Deal Closed</span></div><div class="rowactions"><button class="secondary mini" onclick="openClient('${c.id}')">View</button><button class="secondary mini" onclick="editClient('${c.id}')">Edit</button><button class="secondary mini" onclick="restoreArchivedClient('${c.id}')">Restore</button></div>`)}
      <div class="sectionhead"><div><h2>Project archive</h2><p>Projects moved here when their status is Deal Closed.</p></div></div>
      ${rows(ps,p=>`<div><span>${esc(D.clients.find(c=>c.id===p.client_id)?.name||'Client')}</span><strong>${esc(p.name)}</strong><span>Deal Closed${p.end_date?' • '+esc(p.end_date):''}</span></div><div class="rowactions"><strong>${money(p.value)}</strong><button class="secondary mini" onclick="editProject('${p.id}','${p.client_id||''}')">Edit</button><button class="secondary mini" onclick="restoreArchivedProject('${p.id}')">Restore</button></div>`)}`;
  };

  const basePage=window.page;
  window.page=function(){
    if(current==='Archive')return archivePage($('view'));
    return basePage();
  };

  const baseDashboard=window.dashboard;
  window.dashboard=function(v){
    baseDashboard(v);
    const cards=v.querySelectorAll('.metric');
    if(cards[1]){const s=cards[1].querySelector('strong');if(s)s.textContent=activeProjects().filter(x=>!['Complete','Cancelled'].includes(x.status)).length;}
  };
})();