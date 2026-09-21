// Client Google Drive folder creation + sharing.
(function(){
  async function callDriveFunction(clientId){
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.access_token) throw new Error('You are not signed in. Sign in again and retry.');
    const res=await fetch(`${U}/functions/v1/google-drive-client`,{
      method:'POST',
      headers:{
        'Authorization':`Bearer ${session.access_token}`,
        'apikey':K,
        'Content-Type':'application/json'
      },
      body:JSON.stringify({client_id:clientId})
    });
    const data=await res.json().catch(()=>({error:`Drive request failed with HTTP ${res.status}.`}));
    return {ok:res.ok,data};
  }

  window.createClientDriveFolder=async function(id){
    const c=D.clients.find(x=>x.id===id);if(!c)return;
    if(!c.email) return alert('Add the client email first, then create the Drive folder.');
    const btn=document.querySelector(`[data-drive-client="${id}"]`);
    if(btn){btn.disabled=true;btn.textContent='Creating…'}
    try{
      const result=await callDriveFunction(id);
      const data=result.data||{};
      if(!result.ok||data.error){
        if(data.needs_reconnect){
          if(confirm('KP HQ needs Google Drive permission. Reconnect Google Workspace now?')){
            const r=await sb.functions.invoke('google-oauth-start',{body:{}});
            if(r.error||r.data?.error) return alert(r.data?.error||r.error?.message||'Could not start Google reconnection.');
            window.location.href=r.data.auth_url;
          }
          return;
        }
        return alert(data.error||'Could not create the Drive folder.');
      }
      await loadAll();openClient(id);
      alert(data.already_exists?'This client already has a Drive folder.':`Drive folder created and shared with ${data.shared_with||c.email}. Google sent the client a sharing invitation.`);
    }catch(e){
      alert(e?.message||'Could not create the Drive folder.');
    }finally{
      if(btn&&document.body.contains(btn)){btn.disabled=false;btn.textContent='Create Drive folder'}
    }
  };

  const priorOpen=window.openClient;
  window.openClient=function(id){
    priorOpen(id);
    const c=D.clients.find(x=>x.id===id);if(!c)return;
    const host=document.querySelector('.profileactions');
    if(host&&!host.querySelector('[data-drive-client]')&&!host.querySelector('.drive-open-btn')){
      if(c.drive_folder_url){
        const a=document.createElement('a');a.className='secondary linkbtn drive-open-btn';a.target='_blank';a.rel='noopener';a.href=c.drive_folder_url;a.textContent='Open Drive folder ↗';host.prepend(a);
      }else{
        const b=document.createElement('button');b.className='secondary';b.type='button';b.dataset.driveClient=id;b.textContent='Create Drive folder';b.onclick=()=>createClientDriveFolder(id);host.prepend(b);
      }
    }

    if(c.drive_folder_url){
      const hero=document.querySelector('.clienthero');
      const info=hero?.querySelector('.clientcontact');
      if(info&&!info.querySelector('.drivefolderlink')){
        const a=document.createElement('a');a.className='drivefolderlink';a.target='_blank';a.rel='noopener';a.href=c.drive_folder_url;a.textContent='Google Drive client folder ↗';info.appendChild(a);
      }

      if(hero&&!document.querySelector('.clientdrivecard')){
        const card=document.createElement('div');
        card.className='card clientdrivecard';
        card.style.marginTop='16px';
        card.innerHTML=`<div class="sectionhead" style="margin:0"><div><span class="eyebrow">GOOGLE DRIVE</span><h2 style="margin:4px 0 6px">Client Folder</h2><p style="margin:0">Contracts, invoices, project files, and deliverables for ${esc(c.name)}.</p></div><a class="secondary linkbtn" target="_blank" rel="noopener" href="${esc(c.drive_folder_url)}">Open folder ↗</a></div>`;
        hero.insertAdjacentElement('afterend',card);
      }
    }
  };
})();