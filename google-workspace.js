// KP HQ Google Workspace / Gmail integration.
(function(){
  const oldResources=window.resources;
  const state={configured:false,clientId:null,connected:false,email:null,loading:false};
  window.KPGoogle=state;

  function escAttr(s){return esc(s||'')}
  function statusText(){
    if(state.connected) return `<span class="tag">Connected • ${esc(state.email||'Google')}</span>`;
    if(state.configured) return `<span class="tag">OAuth ready • Gmail not connected</span>`;
    return `<span class="tag">Setup required</span>`;
  }

  window.refreshGoogleIntegration=async function(render=true){
    state.loading=true;
    try{
      const [cfg,gmail]=await Promise.all([
        sb.functions.invoke('google-config',{body:{action:'status'}}),
        sb.functions.invoke('google-gmail',{body:{action:'status'}})
      ]);
      if(!cfg.error&&!cfg.data?.error){state.configured=!!cfg.data?.configured;state.clientId=cfg.data?.client_id||null}
      if(!gmail.error&&!gmail.data?.error){state.connected=!!gmail.data?.connected;state.email=gmail.data?.email||null}
    }catch(e){console.warn('Google integration status failed',e)}
    state.loading=false;
    if(render&&current==='Resources') renderGoogleWorkspace();
    return state;
  };

  window.saveGoogleConfig=async function(){
    const clientId=document.getElementById('googleClientId')?.value?.trim();
    const clientSecret=document.getElementById('googleClientSecret')?.value?.trim();
    if(!clientId||!clientSecret) return alert('Paste both the Google Client ID and Client Secret first.');
    const btn=document.getElementById('saveGoogleConfig');if(btn){btn.disabled=true;btn.textContent='Saving…'}
    const {data,error}=await sb.functions.invoke('google-config',{body:{action:'save',client_id:clientId,client_secret:clientSecret}});
    if(btn){btn.disabled=false;btn.textContent='Save Google credentials'}
    if(error||data?.error) return alert(data?.error||error?.message||'Could not save Google credentials.');
    state.configured=true;state.clientId=data.client_id||clientId;
    renderGoogleWorkspace();
    alert('Google OAuth credentials saved. Now click Connect Gmail.');
  };

  window.connectGoogleWorkspace=async function(){
    const btn=document.getElementById('connectGoogleBtn');if(btn){btn.disabled=true;btn.textContent='Opening Google…'}
    const {data,error}=await sb.functions.invoke('google-oauth-start',{body:{}});
    if(error||data?.error){if(btn){btn.disabled=false;btn.textContent='Connect Gmail'}return alert(data?.error||error?.message||'Could not start Google connection.');}
    window.location.href=data.auth_url;
  };

  window.disconnectGoogleWorkspace=async function(){
    if(!confirm('Disconnect Gmail from KP HQ? Existing invoices will stay in KP HQ.')) return;
    const {data,error}=await sb.functions.invoke('google-gmail',{body:{action:'disconnect'}});
    if(error||data?.error) return alert(data?.error||error?.message||'Could not disconnect Gmail.');
    state.connected=false;state.email=null;renderGoogleWorkspace();
  };

  function googleSetupHtml(){
    const callback='https://zgiikpkvwjeescdjhnsf.supabase.co/functions/v1/google-oauth-callback';
    const origin='https://kayladelcham-hue.github.io';
    return `<div class="card" style="margin-top:22px;padding:24px">
      <div class="sectionhead" style="margin:0 0 18px"><div><div class="eyebrow">GOOGLE WORKSPACE</div><h2 style="margin-top:5px">Gmail integration</h2><p>Send KP HQ invoices directly from your KidProductionz Gmail after reviewing them.</p></div>${statusText()}</div>
      ${state.connected?`
        <div class="integration"><div><strong>${esc(state.email)}</strong><p>Gmail is connected. Invoice emails will be sent from this account, while Stripe hosts the secure payment page.</p></div><button class="secondary" onclick="disconnectGoogleWorkspace()">Disconnect</button></div>
      `:`
        <div style="display:grid;gap:18px">
          <div class="integration"><div><strong>1. Create a Google OAuth web app</strong><p>In Google Cloud Console, enable the Gmail API and create OAuth 2.0 credentials for a <b>Web application</b>. Add the origin and redirect URI below exactly.</p></div><a class="secondary linkbtn" target="_blank" href="https://console.cloud.google.com/apis/credentials">Google Cloud ↗</a></div>
          <div style="display:grid;grid-template-columns:1fr;gap:10px;background:#f7f7f5;border:1px solid #e3e3df;border-radius:12px;padding:16px">
            <div><span class="muted small">Authorized JavaScript origin</span><div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;margin-top:4px;word-break:break-all">${origin}</div></div>
            <div><span class="muted small">Authorized redirect URI</span><div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;margin-top:4px;word-break:break-all">${callback}</div></div>
          </div>
          <div>
            <label>Google Client ID<input id="googleClientId" type="text" value="${escAttr(state.clientId||'')}" placeholder="...apps.googleusercontent.com"></label>
            <label>Google Client Secret<input id="googleClientSecret" type="password" placeholder="Paste the client secret"></label>
            <div class="actions"><button id="saveGoogleConfig" class="secondary" onclick="saveGoogleConfig()">${state.configured?'Update Google credentials':'Save Google credentials'}</button><button id="connectGoogleBtn" class="btn" onclick="connectGoogleWorkspace()" ${state.configured?'':'disabled'}>Connect Gmail</button></div>
          </div>
          <p class="muted small" style="margin:0">The client secret is stored server-side in KP HQ and is not returned to the browser after saving.</p>
        </div>
      `}
    </div>`;
  }

  window.renderGoogleWorkspace=function(){
    const host=document.getElementById('googleWorkspaceHost');if(!host)return;
    host.innerHTML=googleSetupHtml();
  };

  window.resources=function(v){
    if(typeof oldResources==='function') oldResources(v);
    v.insertAdjacentHTML('afterbegin','<div id="googleWorkspaceHost"></div>');
    renderGoogleWorkspace();
    refreshGoogleIntegration(true);
  };

  const params=new URLSearchParams(location.search);
  if(params.get('google')){
    const result=params.get('google'),reason=params.get('reason');
    history.replaceState({},'',location.pathname+location.hash);
    setTimeout(async()=>{
      await refreshGoogleIntegration(false);
      if(result==='connected') alert(`Google Workspace connected${state.email?' as '+state.email:''}.`);
      else if(result==='error') alert(`Google connection failed${reason?': '+reason:''}.`);
    },800);
  }else{
    setTimeout(()=>refreshGoogleIntegration(false),700);
  }
})();