// KP HQ task completion controls: completed tasks stay visible and can be reopened.
(function(){
  const originalDashboard = window.dashboard;
  if (typeof originalDashboard !== 'function') return;

  window.toggleTask = async function(id, completed){
    const { error } = await sb.from('tasks').update({ completed }).eq('id', id);
    if (error) return alert(error.message);
    const task = D.tasks.find(t => t.id === id);
    if (task) task.completed = completed;
    page();
  };

  window.dashboard = function(v){
    let inc=D.transactions.filter(x=>x.type==='Income').reduce((a,x)=>a+ +x.amount,0),
        out=D.transactions.filter(x=>x.type==='Expense').reduce((a,x)=>a+ +x.amount,0);
    const tasks=[...D.tasks].sort((a,b)=>Number(a.completed)-Number(b.completed));
    v.innerHTML=`<div class="metrics">${[['Clients',D.clients.length],['Active projects',D.projects.filter(x=>!['Complete','Cancelled'].includes(x.status)).length],['Revenue',money(inc)],['Net',money(inc-out)]].map(x=>`<div class="card metric"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('')}</div><div class="sectionhead"><div><h2>CEO Action Queue</h2><p>What needs your attention next. Completed tasks stay here for reference.</p></div><button class="btn" onclick="modal('task')">+ Task</button></div>${rows(tasks,t=>`<div class="taskcopy ${t.completed?'taskdone':''}"><strong>${esc(t.title)}</strong><span>${esc(t.due_date||'Open')}</span></div><div class="rowactions taskactions"><button class="${t.completed?'secondary':'btn'} mini" onclick="toggleTask('${t.id}',${!t.completed})">${t.completed?'↶ Reopen':'✓ Complete'}</button><span class="tag">${t.completed?'Done':'Open'}</span></div>`)}`;
  };
})();