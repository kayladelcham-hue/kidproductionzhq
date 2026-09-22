// KP HQ sales workflow: projected revenue, Gmail composer, and consultation scheduling.
(function(){
  D.consultations=D.consultations||[];
  let consultationsLoaded=false;

  const closedDealStatuses=new Set(['Booked','Active','Complete','Cancelled']);
  const openDeals=()=>D.projects.filter(p=>!closedDealStatuses.has(String(p.status||''))&&(+p.value||0)>0);
  const clientFor=id=>D.clients.find(c=>c.id===id);
  const consultationEvent=c=>D.events.find(e=>e.id===c.calendar_event_id);
  const localTZ=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'America/New_York'}catch{return 'America/New_York'}};
  const todayISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const prettyDate=s=>{if(!s)return 'Date TBD';const d=new Date(`${s}T12:00:00`);return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})};
  const prettyTime=s=>{if(!s)return 'Time TBD';const [h,m]=String(s).split(':');const d=new Date();d.setHours(+h||0,+m||0,0,0);return d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})};

  async function loadConsultations(){
    if(role!=='owner')return [];
    const {data,error}=await sb.from('consultations').select('*').order('consultation_date',{ascending:true}).order('consultation_time',{ascending:true});
    if(error){console.warn('Could not load consultations',error);return D.consultations||[]}
    D.consultations=data||[];consultationsLoaded=true;return D.consultations;
  }

  const baseLoadAll=window.loadAll;
  window.loadAll=async function(){
    await baseLoadAll();
    if(role==='owner')await loadConsultations();
  };

  function pipelineHTML(){
    const deals=openDeals();
    const total=deals.reduce((sum,p)=>sum+(+p.value||0),0);
    const top=[...deals].sort((a,b)=>(+b.value||0)-(+a.value||0)).slice(0,5);
    return `<div class="pipeline-card card">
      <div class="pipeline-head"><div><div class="eyebrow">OPEN PIPELINE</div><h2>Projected Revenue</h2><p>Potential revenue from deals that are still open — not booked, active, complete, or cancelled.</p></div><span class="tag">${deals.length} open deal${deals.length===1?'':'s'}</span></div>
      <div class="pipeline-total">${money(total)}</div>
      <div class="pipeline-deals">${top.length?top.map(p=>{const c=clientFor(p.client_id);return `<div class="pipeline-deal"><div><strong>${esc(p.name)}</strong><span>${esc(c?.name||'Client')} • ${esc(p.status||'Open')}${p.next_action?' • '+esc(p.next_action):''}</span></div><strong>${money(p.value)}</strong></div>`}).join(''):'<div class="empty compact">No open deals with a value yet.</div>'}</div>
    </div>`;
  }

  function consultationRowsHTML(){
    const upcoming=(D.consultations||[]).filter(c=>c.status!=='Cancelled'&&c.consultation_date>=todayISO()).sort((a,b)=>`${a.consultation_date} ${a.consultation_time||''}`.localeCompare(`${b.consultation_date} ${b.consultation_time||''}`)).slice(0,4);
    return upcoming.length?upcoming.map(c=>{const cl=clientFor(c.client_id),ev=consultationEvent(c);return `<div class="consult-row"><div><strong>${esc(c.title)}</strong><span>${esc(cl?.name||'Client')} • ${prettyDate(c.consultation_date)} at ${prettyTime(c.consultation_time)} • ${c.duration_minutes||30} min</span>${c.meeting_url?`<span class="consult-link">${esc(c.meeting_url)}</span>`:''}</div><div class="rowactions">${ev?.google_event_url?`<a class="secondary mini" target="_blank" rel="noopener" href="${esc(ev.google_event_url)}">Calendar</a>`:''}<button class="secondary mini" onclick="resendConsultationEmail('${c.id}',this)">Send invite</button></div></div>`}).join(''):`<div class="empty compact">No upcoming consultations yet.</div>`;
  }

  function dashboardExtras(v){
    const metrics=v.querySelector('.metrics');
    if(metrics&&!v.querySelector('.pipeline-card'))metrics.insertAdjacentHTML('afterend',`<div class="hq-sales-grid">${pipelineHTML()}<div class="card quick-card"><div class="eyebrow">QUICK ACTIONS</div><h2>Client Communications</h2><p>Send an email or schedule a consultation without leaving KP HQ.</p><div class="quick-actions"><button class="btn" onclick="openEmailComposer()">Send Email</button><button class="secondary" onclick="openConsultationModal()">+ Consultation</button></div></div></div>`);
    const taskHead=[...v.querySelectorAll('.sectionhead h2')].find(h=>h.textContent==='CEO Action Queue')?.closest('.sectionhead');
    if(taskHead&&!v.querySelector('#upcomingConsultations'))taskHead.insertAdjacentHTML('beforebegin',`<div id="upcomingConsultations"><div class="sectionhead"><div><h2>Upcoming Consultations</h2><p>Scheduled calls and discovery sessions.</p></div><button class="secondary" onclick="openConsultationModal()">+ Consultation</button></div><div class="consult-list">${consultationRowsHTML()}</div></div>`);
  }

  const baseDashboard=window.dashboard;
  window.dashboard=function(v){
    baseDashboard(v);dashboardExtras(v);
    if(!consultationsLoaded)loadConsultations().then(()=>{if(current==='Dashboard'){const host=document.getElementById('upcomingConsultations');if(host){const list=host.querySelector('.consult-list');if(list)list.innerHTML=consultationRowsHTML()}}});
  };

  window.openEmailComposer=function(clientId=''){
    const c=clientFor(clientId)||null;
    const clients=D.clients.filter(x=>x.email);
    const options=[['','Choose a client (optional)'],...clients.map(x=>[x.id,`${x.name}${x.business_name?' — '+x.business_name:''}`])];
    const h=`<div class="modalhead"><div><div class="eyebrow">GMAIL</div><h2>Send Email</h2></div><button class="x" onclick="closeM()">×</button></div>
      ${select('emailClient','Client',options,clientId)}
      ${input('emailTo','To','email',c?.email||'')}
      ${input('emailSubject','Subject','text','')}
      <label>Message<textarea id="emailBody" placeholder="Write your message..."></textarea></label>
      <div class="send-note">Emails send from your connected KidProductionz Gmail account.</div>
      <button id="sendHQEmailBtn" class="btn" onclick="sendHQEmail(this)">Send Email</button>`;
    document.body.insertAdjacentHTML('beforeend',`<div id="modalbg" class="modalbg"><div class="modal">${h}</div></div>`);
    const sel=document.getElementById('emailClient');if(sel)sel.onchange=()=>{const cl=clientFor(sel.value);if(cl)document.getElementById('emailTo').value=cl.email||''};
  };

  function brandedEmailHTML(subject,body){
    const safeBody=esc(body).replace(/\n/g,'<br>');
    return `<!doctype html><html><body style="margin:0;background:#f3f4f5;font-family:Arial,Helvetica,sans-serif;color:#111318"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f3f4f5;padding:28px 12px"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#fff;border:1px solid #e3e5e8;border-radius:14px;overflow:hidden"><tr><td style="background:#111318;color:#fff;padding:26px 30px"><div style="font-size:21px;font-weight:800;letter-spacing:4px">KIDPRODUCTIONZ</div><div style="font-size:9px;letter-spacing:2px;color:#b9bdc3;margin-top:7px">CREATIVE • MARKETING • SALES</div></td></tr><tr><td style="padding:32px 30px"><h1 style="font-size:24px;line-height:1.2;margin:0 0 18px">${esc(subject)}</h1><div style="font-size:14px;line-height:1.75;color:#444b53">${safeBody}</div></td></tr><tr><td style="border-top:1px solid #e6e8eb;padding:18px 30px;font-size:10px;color:#858a90">Sent from KidProductionz Headquarters.</td></tr></table></td></tr></table></body></html>`;
  }

  async function gmailSend({to,subject,text,html}){
    if(window.refreshGoogleIntegration)await refreshGoogleIntegration(false);
    if(!window.KPGoogle?.connected)throw new Error('Gmail is not connected. Go to Resources → Google Workspace and connect it first.');
    const {data,error}=await sb.functions.invoke('google-gmail',{body:{action:'send',to,subject,html,text}});
    if(error||data?.error)throw new Error(data?.error||error?.message||'Gmail could not send the message.');
    return data||{};
  }

  window.sendHQEmail=async function(button){
    const to=val('emailTo').trim(),subject=val('emailSubject').trim(),text=val('emailBody').trim();
    if(!to||!subject||!text)return alert('Add a recipient, subject, and message first.');
    const old=button?.textContent;if(button){button.disabled=true;button.textContent='Sending…'}
    try{
      const out=await gmailSend({to,subject,text,html:brandedEmailHTML(subject,text)});
      closeM();alert(`Email sent to ${to}${out.from?' from '+out.from:''}.`);
    }catch(e){alert(e?.message||String(e));if(button){button.disabled=false;button.textContent=old||'Send Email'}}
  };

  window.openConsultationModal=function(clientId=''){
    const c=clientFor(clientId)||null;
    const clients=D.clients.map(x=>[x.id,`${x.name}${x.business_name?' — '+x.business_name:''}`]);
    const initialProjects=D.projects.filter(p=>!clientId||p.client_id===clientId).map(p=>[p.id,p.name]);
    const h=`<div class="modalhead"><div><div class="eyebrow">CONSULTATION</div><h2>Schedule Consultation</h2></div><button class="x" onclick="closeM()">×</button></div>
      ${select('consultClient','Client',[['','Choose a client'],...clients],clientId)}
      ${select('consultProject','Project / Deal',[['','No project'],...initialProjects],'')}
      ${input('consultTitle','Title','text',c?`${c.name} Consultation`:'Consultation')}
      <div class="form-two">${input('consultDate','Date','date','')}${input('consultTime','Time','time','')}</div>
      ${select('consultDuration','Duration',[[15,'15 minutes'],[30,'30 minutes'],[45,'45 minutes'],[60,'60 minutes']],30)}
      ${input('consultLink','Meeting link (Zoom, Google Meet, etc.)','url','')}
      <label>Notes<textarea id="consultNotes" placeholder="Goals, discovery topics, prep notes..."></textarea></label>
      <label class="checkline"><input id="consultSendEmail" type="checkbox" ${c?.email?'checked':''}> <span>Send confirmation email to the client after scheduling</span></label>
      <div id="consultEmailHint" class="send-note">${c?.email?`Invite will go to ${esc(c.email)}.`:'Add an email to the client profile to send the invite automatically.'}</div>
      <button id="createConsultBtn" class="btn" onclick="createConsultation(this)">Create Consultation</button>`;
    document.body.insertAdjacentHTML('beforeend',`<div id="modalbg" class="modalbg"><div class="modal">${h}</div></div>`);
    const sel=document.getElementById('consultClient');if(sel)sel.onchange=()=>refreshConsultationClient(sel.value);
  };

  window.refreshConsultationClient=function(clientId){
    const cl=clientFor(clientId),project=document.getElementById('consultProject'),hint=document.getElementById('consultEmailHint'),title=document.getElementById('consultTitle'),check=document.getElementById('consultSendEmail');
    if(project){project.innerHTML=`<option value="">No project</option>`+D.projects.filter(p=>p.client_id===clientId).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}
    if(cl&&title&&(!title.value||title.value==='Consultation'))title.value=`${cl.name} Consultation`;
    if(hint)hint.textContent=cl?.email?`Invite will go to ${cl.email}.`:'Add an email to the client profile to send the invite automatically.';
    if(check)check.checked=!!cl?.email;
  };

  function consultationEmail(c,client){
    const when=`${prettyDate(c.consultation_date)} at ${prettyTime(c.consultation_time)}`;
    const link=c.meeting_url?`\n\nMeeting link: ${c.meeting_url}`:'\n\nMeeting link: To be provided.';
    const text=`Hi ${client?.name||''},\n\nYour KidProductionz consultation is scheduled for ${when}.\nDuration: ${c.duration_minutes||30} minutes.${link}${c.notes?`\n\nNotes: ${c.notes}`:''}\n\nLooking forward to speaking with you.\n\nKidProductionz`;
    const html=brandedEmailHTML('Your KidProductionz consultation is scheduled',text);
    return {subject:`Consultation confirmed — KidProductionz`,text,html};
  }

  async function syncCalendarEvent(ev){
    try{
      const {data,error}=await sb.functions.invoke('google-calendar-sync',{body:{action:'push',timezone:localTZ(),event:ev}});
      if(error||data?.error)throw new Error(data?.error||error?.message||'Calendar sync failed.');
      return true;
    }catch(e){console.warn(e);return false}
  }

  window.createConsultation=async function(button){
    const clientId=val('consultClient'),projectId=val('consultProject')||null,title=val('consultTitle').trim(),date=val('consultDate'),time=val('consultTime')||null,duration=+val('consultDuration')||30,meeting=val('consultLink').trim(),notes=val('consultNotes').trim(),sendEmail=!!document.getElementById('consultSendEmail')?.checked;
    if(!clientId||!title||!date||!time)return alert('Choose a client and add a title, date, and time.');
    const client=clientFor(clientId);if(!client)return alert('Choose a valid client.');
    const old=button?.textContent;if(button){button.disabled=true;button.textContent='Creating…'}
    let event=null,consult=null,calendarSynced=false,emailSent=false,emailError='';
    try{
      const eventNotes=[notes,meeting?`Meeting link: ${meeting}`:''].filter(Boolean).join('\n');
      const {data:ev,error:eventError}=await sb.from('calendar_events').insert({owner_id:OWNER,project_id:projectId,title,event_date:date,event_time:time,type:'Consultation',notes:eventNotes||null,duration_minutes:duration,meeting_url:meeting||null}).select().single();
      if(eventError)throw eventError;event=ev;
      const {data:co,error:consultError}=await sb.from('consultations').insert({owner_id:OWNER,client_id:clientId,project_id:projectId,calendar_event_id:event.id,title,consultation_date:date,consultation_time:time,duration_minutes:duration,meeting_url:meeting||null,notes:notes||null,status:'Scheduled',email_sent:false}).select().single();
      if(consultError){await sb.from('calendar_events').delete().eq('id',event.id);throw consultError}consult=co;
      calendarSynced=await syncCalendarEvent(event);
      if(sendEmail&&client.email){
        try{const mail=consultationEmail(consult,client);await gmailSend({to:client.email,...mail});emailSent=true;await sb.from('consultations').update({email_sent:true,updated_at:new Date().toISOString()}).eq('id',consult.id)}catch(e){emailError=e?.message||String(e)}
      }
      closeM();await loadAll();page();
      let msg=`Consultation scheduled for ${prettyDate(date)} at ${prettyTime(time)}.`;
      msg+=calendarSynced?' Added to Google Calendar.':' Saved in KP HQ; Google Calendar did not sync.';
      if(sendEmail&&client.email)msg+=emailSent?' Confirmation email sent.':` Email was not sent: ${emailError}`;
      else if(sendEmail&&!client.email)msg+=' Client has no email on file, so no confirmation was sent.';
      alert(msg);
    }catch(e){alert(`Could not create consultation: ${e?.message||e}`);if(button){button.disabled=false;button.textContent=old||'Create Consultation'}}
  };

  window.resendConsultationEmail=async function(id,button){
    const c=(D.consultations||[]).find(x=>x.id===id),client=c&&clientFor(c.client_id);if(!c)return;
    if(!client?.email)return alert('This client does not have an email address saved yet.');
    const old=button?.textContent;if(button){button.disabled=true;button.textContent='Sending…'}
    try{const mail=consultationEmail(c,client);await gmailSend({to:client.email,...mail});await sb.from('consultations').update({email_sent:true,updated_at:new Date().toISOString()}).eq('id',id);c.email_sent=true;alert(`Consultation invite sent to ${client.email}.`)}catch(e){alert(e?.message||String(e))}finally{if(button){button.disabled=false;button.textContent=old||'Send invite'}}
  };

  const baseOpenClient=window.openClient;
  if(typeof baseOpenClient==='function')window.openClient=function(id){
    baseOpenClient(id);
    const actions=document.querySelector('.profiletop .profileactions');
    if(actions&&!actions.querySelector('.hq-email-client')){
      const email=document.createElement('button');email.className='secondary hq-email-client';email.textContent='Email client';email.onclick=()=>openEmailComposer(id);
      const consult=document.createElement('button');consult.className='secondary hq-consult-client';consult.textContent='+ Consultation';consult.onclick=()=>openConsultationModal(id);
      actions.prepend(consult);actions.prepend(email);
    }
  };
})();