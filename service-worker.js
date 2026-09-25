const CACHE_VERSION='kp-hq-push-v1';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

self.addEventListener('push',event=>{
  let payload={title:'KP HQ',body:'You have a new HQ alert.',url:'./',tag:'kp-hq'};
  try{
    if(event.data){
      const incoming=event.data.json();
      payload={...payload,...incoming};
    }
  }catch(_e){
    if(event.data) payload.body=event.data.text();
  }

  event.waitUntil(self.registration.showNotification(payload.title||'KP HQ',{
    body:payload.body||'',
    icon:'kp-hq-icon.svg',
    badge:'kp-hq-icon.svg',
    tag:payload.tag||'kp-hq',
    renotify:true,
    data:{url:payload.url||'./',timestamp:payload.timestamp||Date.now()}
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification?.data?.url||'./',self.registration.scope).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      if('focus' in client){
        await client.focus();
        if('navigate' in client) await client.navigate(target);
        return;
      }
    }
    if(self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
