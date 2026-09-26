// Display saved client notes directly on the client profile.
(function(){
  const previousOpenClient=window.openClient;
  if(typeof previousOpenClient!=='function') return;

  window.openClient=function(id){
    previousOpenClient(id);
    const c=D.clients.find(x=>x.id===id);
    if(!c?.notes) return;
    if(document.querySelector('#view .client-notes-section')) return;

    const notes=esc(c.notes).replace(/\n/g,'<br>');
    const metrics=document.querySelector('#view .profilemetrics');
    if(!metrics) return;

    metrics.insertAdjacentHTML('afterend',`
      <div class="sectionhead profileheading client-notes-section">
        <div><h2>Notes</h2><p>Client context & consultation notes.</p></div>
      </div>
      <div class="card client-notes-card" style="line-height:1.65;white-space:normal;padding:18px 20px">${notes}</div>
    `);
  };
})();
