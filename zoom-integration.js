// KP HQ Zoom integration: Server-to-Server OAuth setup + automatic consultation meetings.
(function(){
  const zoomState={configured:false,hostEmail:null,loading:false};
  window.KPZoom=zoomState;

  async function zoomInvoke(body){
    const {data,error}=await sb.functions.invoke('zoom-meetings',{body});
    if(!error&&!data?.error)return data||{};
    let detail=data?.error||error?.message||'Zoom request failed.';
    try{
      const ctx=error?.context;
      if(ctx&&typeof ctx.clone==='function'){
        const j=await ctx.clone().json();
        detail=j?.error||j?.message||detail;
      }
    }catch(_e){}
    throw new Error(detail);
  }

  window.refreshZoomIntegration=async function(render=true){
    zoomState.loading=true;
    try{
      const out=await zoomInvoke({action:'status'});
      zoomState.configured=!!out.configured;
      zoomState.hostEmail=out.host_email||null;
    }catch(e){
      console.warn('Zoom integration status failed',e);
      zoomState.configured=false;zoomState.hostEmail=null;
    }
    zoomState.loading=false;
    if(render&&current==='Resources')renderZoomIntegration();
    return zoomState;
  };

  function zoomSetupHtml(){
    if(zoomState.configured){
      return `<div class="card zoom-setup-card">
        <div class="sectionhead zoom-head"><div><div class="eyebrow">ZOOM</div><h2>Consultation meetings</h2><p>KP HQ can automatically create a Zoom meeting whenever you schedule a consultation.</p></div><span class="tag">Connected</span></div>
        <div class="integration"><div><strong>${esc(zoomState.hostEmail||'Zoom host')}</strong><p>New consultation meetings will be created on this Zoom account and the join link will flow into KP HQ, Google Calendar, and the client confirmation email.</p></div><div class="rowactions"><button class="secondary mini" onclick="testZoomIntegration(this)">Test connection</button><button class="secondary mini" onclick="disconnectZoomIntegration()">Disconnect</button></div></div>
      </div>`;
    }
    return `<div class="card zoom-setup-card">
      <div class="sectionhead zoom-head"><div><div class="eyebrow">ZOOM</div><h2>Connect Zoom</h2><p>Use a Zoom Server-to-Server OAuth app so KP HQ can create meetings on your own Zoom account without making you reconnect every time.</p></div><span class="tag">Setup required</span></div>
      <div class="zoom-steps">
        <div><b>1</b><span>Open the Zoom App Marketplace and create a <strong>Server-to-Server OAuth</strong> app.</span></div>
        <div><b>2</b><span>Add the meeting write permission: <strong>meeting:write:meeting:admin</strong> (Zoom may label this “View and manage all user meetings”), then activate the app.</span></div>
        <div><b>3</b><span>Paste the app credentials below. Your Client Secret stays server-side and is never returned to the browser.</span></div>
      </div>
      <div class="zoom-form">
        <label>Zoom host email<input id="zoomHostEmail" type="email" placeholder="you@example.com"></label>
        <label>Account ID<input id="zoomAccountId" type="text" placeholder="Zoom Server-to-Server Account ID"></label>
        <label>Client ID<input id="zoomClientId" type="text" placeholder="Zoom Client ID"></label>
        <label>Client Secret<input id="zoomClientSecret" type="password" placeholder="Zoom Client Secret"></label>
        <div class="actions"><a class="secondary linkbtn" target="_blank" rel="noopener" href="https://marketplace.zoom.us/">Open Zoom Marketplace ↗</a><button id="saveZoomBtn" class="btn" onclick="saveZoomIntegration(this)">Connect Zoom</button></div>
      </div>
    </div>`;
  }

  window.renderZoomIntegration=function(){
    const host=document.getElementById('zoomIntegrationHost');if(!host)return;
    host.innerHTML=zoomSetupHtml();
  };

  window.saveZoomIntegration=async function(button){
    const hostEmail=document.getElementById('zoomHostEmail')?.value?.trim();
    const accountId=document.getElementById('zoomAccountId')?.value?.trim();
    const clientId=document.getElementById('zoomClientId')?.value?.trim();
    const clientSecret=document.getElementById('zoomClientSecret')?.value?.trim();
    if(!hostEmail||!accountId||!clientId||!clientSecret)return alert('Add the Zoom host email, Account ID, Client ID, and Client Secret first.');
    const old=button?.textContent;if(button){button.disabled=true;button.textContent='Connecting…'}
    try{
      const out=await zoomInvoke({action:'save',host_email:hostEmail,account_id:accountId,client_id:clientId,client_secret:clientSecret});
      zoomState.configured=true;zoomState.hostEmail=out.host_email||hostEmail;renderZoomIntegration();
      alert('Zoom is connected. New consultations can now create Zoom meetings automatically.');
    }catch(e){alert(`Zoom could not connect: ${e?.message||e}`);if(button){button.disabled=false;button.textContent=old||'Connect Zoom'}}
  };

  window.testZoomIntegration=async function(button){
    const old=button?.textContent;if(button){button.disabled=true;button.textContent='Testing…'}
    try{const out=await zoomInvoke({action:'test'});alert(`Zoom connection works for ${out.host_email||zoomState.hostEmail}.`)}
    catch(e){alert(`Zoom test failed: ${e?.message||e}`)}
    finally{if(button){button.disabled=false;button.textContent=old||'Test connection'}}
  };

  window.disconnectZoomIntegration=async function(){
    if(!confirm('Disconnect Zoom from KP HQ? Existing consultation links will stay saved.'))return;
    try{await zoomInvoke({action:'disconnect'});zoomState.configured=false;zoomState.hostEmail=null;renderZoomIntegration()}
    catch(e){alert(`Could not disconnect Zoom: ${e?.message||e}`)}
  };

  const baseResources=window.resources;
  if(typeof baseResources==='function')window.resources=function(v){
    baseResources(v);
    if(!document.getElementById('zoomIntegrationHost'))v.insertAdjacentHTML('beforeend','<div id="zoomIntegrationHost"></div>');
    renderZoomIntegration();refreshZoomIntegration(true);
  };

  function enhanceConsultationModal(){
    const input=document.getElementById('consultLink');if(!input)return;
    const label=input.closest('label');if(!label||document.getElementById('zoomConsultOption'))return;
    const wrap=document.createElement('div');wrap.id='zoomConsultOption';wrap.className='zoom-consult-option';
    if(zoomState.configured){
      wrap.innerHTML=`<label class="checkline zoom-check"><input id="consultUseZoom" type="checkbox" checked> <span><strong>Create Zoom meeting automatically</strong><small>KP HQ will create the meeting, save the join link, add it to Google Calendar, and include it in the confirmation email.</small></span></label>`;
      label.before(wrap);
      const box=document.getElementById('consultUseZoom');
      const toggle=()=>{const use=!!box?.checked;input.disabled=use;input.placeholder=use?'Zoom link will be generated automatically':'Paste Zoom, Google Meet, or another meeting link';if(use)input.value=''};
      box.onchange=toggle;toggle();
    }else{
      wrap.innerHTML=`<div class="zoom-not-connected"><div><strong>Want KP HQ to create the Zoom link?</strong><span>Connect Zoom once in Resources, then future consultations can generate meetings automatically.</span></div><button class="secondary mini" type="button" onclick="closeM();go('Resources')">Connect Zoom</button></div>`;
      label.before(wrap);
      input.disabled=false;input.placeholder='Paste Zoom, Google Meet, or another meeting link';
    }
  }

  const baseOpenConsultation=window.openConsultationModal;
  if(typeof baseOpenConsultation==='function')window.openConsultationModal=function(clientId=''){
    baseOpenConsultation(clientId);
    enhanceConsultationModal();
    refreshZoomIntegration(false).then(()=>{
      const old=document.getElementById('zoomConsultOption');if(old)old.remove();
      enhanceConsultationModal();
    });
  };

  const localTZ=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'America/New_York'}catch{return 'America/New_York'}};
  const clientFor=id=>D.clients.find(c=>c.id===id);
  const prettyDate=s=>{if(!s)return 'Date TBD';const d=new Date(`${s}T12:00:00`);return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})};
  const prettyTime=s=>{if(!s)return 'Time TBD';const [h,m]=String(s).split(':');const d=new Date();d.setHours(+h||0,+m||0,0,0);return d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})};

  async function syncCalendarEvent(ev){
    try{
      const {data,error}=await sb.functions.invoke('google-calendar-sync',{body:{action:'push',timezone:localTZ(),event:ev}});
      if(error||data?.error)throw new Error(data?.error||error?.message||'Calendar sync failed.');
      return true;
    }catch(e){console.warn('Google Calendar sync failed',e);return false}
  }

  function consultationMail(c,client){
    const when=`${prettyDate(c.consultation_date)} at ${prettyTime(c.consultation_time)}`;
    const join=c.meeting_url?`\n\nJoin meeting: ${c.meeting_url}`:'\n\nMeeting link: To be provided.';
    const text=`Hi ${client?.name||''},\n\nYour KidProductionz consultation is scheduled for ${when}.\nDuration: ${c.duration_minutes||30} minutes.${join}${c.notes?`\n\nNotes: ${c.notes}`:''}\n\nLooking forward to speaking with you.\n\nKidProductionz`;
    const safe=esc(text).replace(/\n/g,'<br>');
    const html=`<!doctype html><html><body style="margin:0;background:#f3f4f5;font-family:Arial,Helvetica,sans-serif;color:#111318"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f5;padding:28px 12px"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #e3e5e8;border-radius:14px;overflow:hidden"><tr><td style="background:#111318;color:#fff;padding:26px 30px"><div style="font-size:21px;font-weight:800;letter-spacing:4px">KIDPRODUCTIONZ</div><div style="font-size:9px;letter-spacing:2px;color:#b9bdc3;margin-top:7px">CREATIVE • MARKETING • SALES</div></td></tr><tr><td style="padding:32px 30px"><h1 style="font-size:24px;margin:0 0 18px">Your consultation is scheduled</h1><div style="font-size:14px;line-height:1.75;color:#444b53">${safe}</div>${c.meeting_url?`<a href="${esc(c.meeting_url)}" style="display:block;background:#111318;color:#fff;text-decoration:none;text-align:center;padding:15px 18px;border-radius:9px;font-weight:700;margin:24px 0 0">Join Meeting</a>`:''}</td></tr></table></td></tr></table></body></html>`;
    return {subject:'Consultation confirmed — KidProductionz',text,html};
  }

  async function sendConsultationMail(c,client){
    if(window.refreshGoogleIntegration)await refreshGoogleIntegration(false);
    if(!window.KPGoogle?.connected)throw new Error('Gmail is not connected.');
    const mail=consultationMail(c,client);
    const {data,error}=await sb.functions.invoke('google-gmail',{body:{action:'send',to:client.email,...mail}});
    if(error||data?.error)throw new Error(data?.error||error?.message||'Gmail could not send the consultation email.');
    return data||{};
  }

  // Replace the base consultation creator so Zoom metadata is saved with the consultation.
  window.createConsultation=async function(button){
    const clientId=val('consultClient'),projectId=val('consultProject')||null,title=val('consultTitle').trim(),date=val('consultDate'),time=val('consultTime')||null,duration=+val('consultDuration')||30,notes=val('consultNotes').trim(),sendEmail=!!document.getElementById('consultSendEmail')?.checked;
    if(!clientId||!title||!date||!time)return alert('Choose a client and add a title, date, and time.');
    const client=clientFor(clientId);if(!client)return alert('Choose a valid client.');
    const useZoom=!!document.getElementById('consultUseZoom')?.checked&&zoomState.configured;
    let meeting=val('consultLink').trim(),zoom=null,event=null,consult=null,calendarSynced=false,emailSent=false,emailError='';
    const old=button?.textContent;if(button){button.disabled=true;button.textContent=useZoom?'Creating Zoom meeting…':'Creating…'}
    try{
      if(useZoom){
        zoom=await zoomInvoke({action:'create',topic:title,date,time,duration,timezone:localTZ(),agenda:notes});
        if(!zoom.join_url)throw new Error('Zoom created the meeting but did not return a join link.');
        meeting=zoom.join_url;
      }
      const eventNotes=[notes,meeting?`Meeting link: ${meeting}`:'',zoom?.meeting_id?`Zoom Meeting ID: ${zoom.meeting_id}`:''].filter(Boolean).join('\n');
      const {data:ev,error:eventError}=await sb.from('calendar_events').insert({owner_id:OWNER,project_id:projectId,title,event_date:date,event_time:time,type:'Consultation',notes:eventNotes||null,duration_minutes:duration,meeting_url:meeting||null}).select().single();
      if(eventError)throw eventError;event=ev;
      const {data:co,error:consultError}=await sb.from('consultations').insert({owner_id:OWNER,client_id:clientId,project_id:projectId,calendar_event_id:event.id,title,consultation_date:date,consultation_time:time,duration_minutes:duration,meeting_url:meeting||null,notes:notes||null,status:'Scheduled',email_sent:false,zoom_meeting_id:zoom?.meeting_id||null,zoom_start_url:zoom?.start_url||null,zoom_password:zoom?.password||null}).select().single();
      if(consultError){await sb.from('calendar_events').delete().eq('id',event.id);throw consultError}consult=co;
      calendarSynced=await syncCalendarEvent(event);
      if(sendEmail&&client.email){
        try{await sendConsultationMail(consult,client);emailSent=true;await sb.from('consultations').update({email_sent:true,updated_at:new Date().toISOString()}).eq('id',consult.id)}catch(e){emailError=e?.message||String(e)}
      }
      closeM();await loadAll();page();
      let msg=`Consultation scheduled for ${prettyDate(date)} at ${prettyTime(time)}.`;
      if(useZoom)msg+=' Zoom meeting created.';
      msg+=calendarSynced?' Added to Google Calendar.':' Saved in KP HQ; Google Calendar did not sync.';
      if(sendEmail&&client.email)msg+=emailSent?' Confirmation email sent.':` Email was not sent: ${emailError}`;
      else if(sendEmail&&!client.email)msg+=' Client has no email on file, so no confirmation was sent.';
      alert(msg);
    }catch(e){
      if(event?.id)await sb.from('calendar_events').delete().eq('id',event.id).catch(()=>{});
      if(zoom?.meeting_id&&!consult){try{await zoomInvoke({action:'delete',meeting_id:zoom.meeting_id})}catch(_e){}}
      alert(`Could not create consultation: ${e?.message||e}`);
      if(button){button.disabled=false;button.textContent=old||'Create Consultation'}
    }
  };

  setTimeout(()=>refreshZoomIntegration(false),900);
})();