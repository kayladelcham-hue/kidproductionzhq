// Client Google Drive folder creation + sharing.
(function(){
  async function functionErrorMessage(error,data){
    if(data?.error)return data.error;
    try{
      const ctx=error?.context;
      if(ctx&&typeof ctx.clone==='function'){
        const body=await ctx.clone().json().catch(()=>null);
        if(body?.error)return body.error;
      }
    }catch(_e){}
    return error?.message||'Could not create the Drive folder.';
  }

  window.createClientDriveFolder=async function(id){
    const c=D.clients.find(x=>x.id===id);if(!c)return;
    if(!c.email) return alert('Add the client email first, then create the Drive folder.');
    const btn=document.querySelector(`[data-drive-client="${id}"]`);
    if(btn){btn.disabled=true;btn.textContent='Creating…'}
    const {data,error}=await sb.functions.invoke('google-drive-client',{body:{client_id:id}});
    if(btn){btn.disabled=false;btn.textContent='Create Drive folder'}
    if(error||data?.error){
      let detail=data||null;
      if(!detail&&error?.context&&typeof error.context.clone==='function') detail=await error.context.clone().json().catch(()=>null);
      if(detail?.needs_reconnect){
        if(confirm('KP HQ needs Google Drive permission. Reconnect Google Workspace now?')){
          const r=await sb.functions.invoke('google-oauth-start',{body:{}});
          if(r.error||r.data?.error) return alert(r.data?.error||r.error?.message||'Could not start Google reconnection.');
          window.location.href=r.data.auth_url;
        }
        return;
      }
      return alert(await functionErrorMessage(error,detail));
    }
    await loadAll();openClient(id);
    alert(data?.already_exists?'This client already has a Drive folder.':`Drive folder created and shared with ${data.shared_with||c.email}. Google sent the client a sharing invitation.`);
  };

  const priorOpen=window.openClient;
  window.openClient=function(id){
    priorOpen(id);
    const c=D.clients.find(x=>x.id===id);if(!c)return;
    const host=document.querySelector('.profileactions');
    if(host&&!host.querySelector('[data-drive-client]')){
      if(c.drive_folder_url){
        const a=document.createElement('a');a.className='secondary linkbtn';a.target='_blank';a.rel='noopener';a.href=c.drive_folder_url;a.textContent='Open Drive folder ↗';host.prepend(a);
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
    }
  };
})();