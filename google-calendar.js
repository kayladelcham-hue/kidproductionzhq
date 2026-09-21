// KP HQ ↔ Google Calendar wiring.
(function(){
  const baseCalendar=window.calendar;
  const baseSave=window.save;
  const baseDeleteRecord=window.deleteRecord;
  const baseModal=window.modal;
  let calStatus={connected:false,calendar_connected:false,email:null};
  let syncing=false;

  const timezone=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'America/New_York'}catch{return 'America/New_York'}};

  async function invokeCalendar(body){
    const {data,error}=await sb.functions.invoke('google-calendar-sync',{body:{timezone:timezone(),...body}});
    if(!error&&!data?.error)return data||{};
    let detail=data?.error||error?.message||'Google Calendar sync failed.';
    try{
      if(error?.context?.json){const j=await error.context.json();detail=j?.error||j?.message||detail}
    }catch{}
    throw new Error(detail);
  }

  async function refreshCalendarStatus(render=true){
    try{calStatus=await invokeCalendar({action:'status'})}
    catch(e){calStatus={connected:false,calendar_connected:false,email:null,error:e?.message||String(e)}}
    if(render&&current==='Calendar')paintCalendarIntegration();
    return calStatus;
  }
  window.refreshCalendarStatus=refreshCalendarStatus;

  function integrationHTML(){
    if(calStatus.calendar_connected){
      return `<div><strong>Google Calendar</strong><p>Connected as ${esc(calStatus.email||'Google account')}. New KP HQ events automatically sync to Google Calendar.</p></div><div class="rowactions"><span class="tag">Connected</span><button class="secondary mini" onclick="syncGoogleToHQ(this)">Pull from Google</button><button class="btn mini" onclick="syncCalendarNow(this)">Sync now</button></div>`;
    }
    if(calStatus.connected){
      return `<div><strong>Google Calendar</strong><p>Google is connected, but Calendar permission is missing. Reconnect Google Workspace in Resources.</p></div><span class="tag">Reconnect required</span>`;
    }
    return `<div><strong>Google Calendar</strong><p>Connect Google Workspace in Resources to sync events.</p></div><span class="tag">Not connected</span>`;
  }

  function paintCalendarIntegration(){
    const card=document.querySelector('#view .integration');
    if(card)card.innerHTML=integrationHTML();
    document.querySelectorAll('#view .list .row').forEach(row=>{
      const title=row.querySelector('strong')?.textContent?.trim();
      if(!title)return;
      const ev=D.events.find(x=>x.title===title);
      if(!ev)return;
      if(ev.google_event_id&&!row.querySelector('.googlecalbadge')){
        const actions=row.querySelector('.rowactions')||row.lastElementChild;
        if(actions){
          const badge=document.createElement('span');badge.className='tag googlecalbadge';badge.textContent='Google ✓';actions.prepend(badge);
          if(ev.google_event_url){const a=document.createElement('a');a.className='secondary mini';a.target='_blank';a.rel='noopener';a.href=ev.google_event_url;a.textContent='Open Google';actions.prepend(a)}
        }
      }
    });
  }

  async function pushEvent(ev,quiet=false){
    if(!calStatus.calendar_connected)await refreshCalendarStatus(false);
    if(!calStatus.calendar_connected){if(!quiet)alert('Google Calendar is not connected yet. Reconnect Google Workspace in Resources.');return false}
    try{
      await invokeCalendar({action:'push',event:ev});
      return true;
    }catch(e){if(!quiet)alert(`Event saved in KP HQ, but Google Calendar sync failed: ${e?.message||e}`);return false}
  }

  async function syncUnsyncedHQEvents(quiet=true){
    if(!calStatus.calendar_connected)await refreshCalendarStatus(false);
    if(!calStatus.calendar_connected)return 0;
    let count=0;
    for(const ev of D.events.filter(e=>e.event_date&&!e.google_event_id)){
      if(await pushEvent(ev,quiet))count++;
    }
    if(count){await loadAll();if(current==='Calendar'){baseCalendar($('view'));paintCalendarIntegration()}}
    return count;
  }

  window.syncCalendarNow=async function(button){
    if(syncing)return;syncing=true;
    const old=button?.textContent;if(button){button.disabled=true;button.textContent='Syncing…'}
    try{
      const out=await invokeCalendar({action:'full_sync'});
      await loadAll();
      if(current==='Calendar'){baseCalendar($('view'));paintCalendarIntegration()}
      alert(`Google Calendar synced. ${out.pushed||0} KP HQ event${out.pushed===1?'':'s'} pushed, ${out.imported||0} Google event${out.imported===1?'':'s'} imported, ${out.updated||0} updated.`);
    }catch(e){alert(`Calendar sync failed: ${e?.message||e}`)}
    finally{syncing=false;if(button){button.disabled=false;button.textContent=old||'Sync now'}}
  };

  window.syncGoogleToHQ=async function(button){
    if(syncing)return;syncing=true;
    const old=button?.textContent;if(button){button.disabled=true;button.textContent='Pulling…'}
    try{
      const out=await invokeCalendar({action:'pull'});
      await loadAll();
      if(current==='Calendar'){baseCalendar($('view'));paintCalendarIntegration()}
      alert(`Google Calendar pulled into KP HQ. ${out.imported||0} imported and ${out.updated||0} updated.`);
    }catch(e){alert(`Could not pull Google Calendar: ${e?.message||e}`)}
    finally{syncing=false;if(button){button.disabled=false;button.textContent=old||'Pull from Google'}}
  };

  // Keep the existing Calendar UI, but replace the old "Setup required" state with the live integration.
  window.calendar=function(v){
    baseCalendar(v);
    paintCalendarIntegration();
    refreshCalendarStatus(true).then(()=>syncUnsyncedHQEvents(true));
  };

  // New KP HQ calendar events are saved locally first, then pushed to Google automatically.
  window.save=async function(table,row){
    if(table!=='calendar_events')return baseSave(table,row);
    row.owner_id=OWNER;
    const {data:ev,error}=await sb.from('calendar_events').insert(row).select().single();
    if(error)return alert(error.message);
    closeM();
    await loadAll();
    const ok=await pushEvent(ev,false);
    if(ok)await loadAll();
    page();
  };

  // Deleting a synced KP event also removes the matching Google Calendar event.
  window.deleteRecord=async function(table,id,label){
    if(table!=='calendar_events')return baseDeleteRecord(table,id,label);
    const ev=D.events.find(x=>x.id===id);
    if(!confirm(`Delete ${label}?\n\nThis will also remove the synced Google Calendar event when one exists.`))return;
    if(ev?.google_event_id){
      try{await invokeCalendar({action:'delete',google_event_id:ev.google_event_id})}
      catch(e){return alert(`Could not remove the Google Calendar event, so KP HQ left this event in place: ${e?.message||e}`)}
    }
    const {error}=await sb.from('calendar_events').delete().eq('id',id);
    if(error)return alert(`Could not delete ${label}: ${error.message}`);
    await loadAll();page();
  };

  // Make the event action clear without rewriting the core modal.
  window.modal=function(type,arg){
    baseModal(type,arg);
    if(type==='event'){
      const btn=document.querySelector('#modalbg .modal > .btn');
      if(btn)btn.textContent='Add & Sync Event';
      const modal=document.querySelector('#modalbg .modal');
      if(modal&&!modal.querySelector('.kpgcalnote')){
        const p=document.createElement('p');p.className='muted small kpgcalnote';p.textContent='This event will be added to KP HQ and synced to your connected Google Calendar.';
        btn?.before(p);
      }
    }
  };
})();