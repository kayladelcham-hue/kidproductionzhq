// KP HQ consultation meeting integration: Google Meet via Google Calendar.
(function(){
  const localTZ=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'America/New_York'}catch{return 'America/New_York'}};
  const clientFor=id=>D.clients.find(c=>c.id===id);
  const prettyDate=s=>{if(!s)return 'Date TBD';const d=new Date(`${s}T12:00:00`);return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})};
  const prettyTime=s=>{if(!s)return 'Time TBD';const [h,m]=String(s).split(':');const d=new Date();d.setHours(+h||0,+m||0,0,0);return d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})};

  function enhanceConsultationModal(){
    const input=document.getElementById('consultLink');if(!input)return;
    const label=input.closest('label');if(!label||document.getElementById('meetConsultOption'))return;
    const wrap=document.createElement('div');wrap.id='meetConsultOption';wrap.className='zoom-consult-option';
    wrap.innerHTML=`<label class="checkline zoom-check"><input id="consultUseMeet" type="checkbox" checked> <span><strong>Create Google Meet automatically</strong><small>KP HQ will create the Meet link through Google Calendar, save it to the consultation, and include it in the confirmation email.</small></span></label>`;
    label.before(wrap);
    const box=document.getElementById('consultUseMeet');
    const toggle=()=>{const use=!!box?.checked;input.disabled=use;input.placeholder=use?'Google Meet link will be generated automatically':'Paste another meeting link';if(use)input.value=''};
    box.onchange=toggle;toggle();
  }

  const baseOpenConsultation=window.openConsultationModal;
  if(typeof baseOpenConsultation==='function')window.openConsultationModal=function(clientId=''){
    baseOpenConsultation(clientId);
    enhanceConsultationModal();
  };

  async function syncCalendarEvent(ev,createMeet){
    const {data,error}=await sb.functions.invoke('google-calendar-sync',{body:{action:'push',timezone:localTZ(),event:{...ev,create_google_meet:!!createMeet}}});
    if(error||data?.error){
      let detail=data?.error||error?.message||'Google Calendar sync failed.';
      try{const ctx=error?.context;if(ctx&&typeof ctx.clone==='function'){const j=await ctx.clone().json();detail=j?.error||j?.message||detail}}catch(_e){}
      throw new Error(detail);
    }
    return data||{};
  }

  function consultationMail(c,client){
    const when=`${prettyDate(c.consultation_date)} at ${prettyTime(c.consultation_time)}`;
    const join=c.meeting_url?`\n\nJoin Google Meet: ${c.meeting_url}`:'\n\nMeeting link: To be provided.';
    const text=`Hi ${client?.name||''},\n\nYour KidProductionz consultation is scheduled for ${when}.\nDuration: ${c.duration_minutes||30} minutes.${join}${c.notes?`\n\nNotes: ${c.notes}`:''}\n\nLooking forward to speaking with you.\n\nKidProductionz`;
    const safe=esc(text).replace(/\n/g,'<br>');
    const html=`<!doctype html><html><body style="margin:0;background:#f3f4f5;font-family:Arial,Helvetica,sans-serif;color:#111318"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f5;padding:28px 12px"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #e3e5e8;border-radius:14px;overflow:hidden"><tr><td style="background:#111318;color:#fff;padding:26px 30px"><div style="font-size:21px;font-weight:800;letter-spacing:4px">KIDPRODUCTIONZ</div><div style="font-size:9px;letter-spacing:2px;color:#b9bdc3;margin-top:7px">CREATIVE • MARKETING • SALES</div></td></tr><tr><td style="padding:32px 30px"><h1 style="font-size:24px;margin:0 0 18px">Your consultation is scheduled</h1><div style="font-size:14px;line-height:1.75;color:#444b53">${safe}</div>${c.meeting_url?`<a href="${esc(c.meeting_url)}" style="display:block;background:#111318;color:#fff;text-decoration:none;text-align:center;padding:15px 18px;border-radius:9px;font-weight:700;margin:24px 0 0">Join Google Meet</a>`:''}</td></tr></table></td></tr></table></body></html>`;
    return {subject:'Consultation confirmed — KidProductionz',text,html};
  }

  async function sendConsultationMail(c,client){
    if(window.refreshGoogleIntegration)await refreshGoogleIntegration(false);
    if(!window.KPGoogle?.connected)throw new Error('Google Workspace is not connected.');
    const mail=consultationMail(c,client);
    const {data,error}=await sb.functions.invoke('google-gmail',{body:{action:'send',to:client.email,...mail}});
    if(error||data?.error)throw new Error(data?.error||error?.message||'Gmail could not send the consultation email.');
    return data||{};
  }

  window.createConsultation=async function(button){
    const clientId=val('consultClient'),projectId=val('consultProject')||null,title=val('consultTitle').trim(),date=val('consultDate'),time=val('consultTime')||null,duration=+val('consultDuration')||30,notes=val('consultNotes').trim(),sendEmail=!!document.getElementById('consultSendEmail')?.checked;
    if(!clientId||!title||!date||!time)return alert('Choose a client and add a title, date, and time.');
    const client=clientFor(clientId);if(!client)return alert('Choose a valid client.');
    const useMeet=!!document.getElementById('consultUseMeet')?.checked;
    let meeting=val('consultLink').trim(),event=null,consult=null,emailSent=false,emailError='';
    const old=button?.textContent;if(button){button.disabled=true;button.textContent=useMeet?'Creating Google Meet…':'Creating…'}
    try{
      const {data:ev,error:eventError}=await sb.from('calendar_events').insert({owner_id:OWNER,project_id:projectId,title,event_date:date,event_time:time,type:'Consultation',notes:notes||null,duration_minutes:duration,meeting_url:meeting||null}).select().single();
      if(eventError)throw eventError;event=ev;

      const synced=await syncCalendarEvent(event,useMeet);
      if(useMeet){
        meeting=synced.meeting_url||synced.meet_url||'';
        if(!meeting)throw new Error('Google Calendar created the event but did not return a Meet link. Reconnect Google Workspace and approve Calendar access, then try again.');
      }

      const {data:co,error:consultError}=await sb.from('consultations').insert({owner_id:OWNER,client_id:clientId,project_id:projectId,calendar_event_id:event.id,title,consultation_date:date,consultation_time:time,duration_minutes:duration,meeting_url:meeting||null,notes:notes||null,status:'Scheduled',email_sent:false}).select().single();
      if(consultError){await sb.from('calendar_events').delete().eq('id',event.id);throw consultError}consult=co;

      if(sendEmail&&client.email){
        try{await sendConsultationMail(consult,client);emailSent=true;await sb.from('consultations').update({email_sent:true,updated_at:new Date().toISOString()}).eq('id',consult.id)}catch(e){emailError=e?.message||String(e)}
      }
      closeM();await loadAll();page();
      let msg=`Consultation scheduled for ${prettyDate(date)} at ${prettyTime(time)}.`;
      msg+=useMeet?' Google Meet created and added to Google Calendar.':' Added to Google Calendar.';
      if(sendEmail&&client.email)msg+=emailSent?' Confirmation email sent.':` Email was not sent: ${emailError}`;
      else if(sendEmail&&!client.email)msg+=' Client has no email on file, so no confirmation was sent.';
      alert(msg);
    }catch(e){
      if(event?.id)await sb.from('calendar_events').delete().eq('id',event.id).catch(()=>{});
      alert(`Could not create consultation: ${e?.message||e}`);
      if(button){button.disabled=false;button.textContent=old||'Create Consultation'}
    }
  };
})();