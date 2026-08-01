(() => {
  const activeStatuses = new Set(['QUEUED','RUNNING','WORKING','APPROVED']);
  const routes = {
    sales:[[16.4,25.0],[19.0,28.0],[22.0,23.5]],
    product:[[42.0,24.5],[45.0,28.0],[39.0,22.5]],
    design:[[69.8,25.0],[73.0,27.5],[67.0,22.5]],
    marketing:[[14.7,47.0],[18.0,49.0],[12.0,44.0]],
    dev:[[79.4,47.0],[82.0,49.5],[76.5,44.5]],
    finance:[[12.8,68.0],[16.0,70.5],[10.5,65.5]],
    pmo:[[50.7,56.5],[48.0,58.5],[53.0,58.0]],
    research:[[79.9,68.0],[82.5,70.0],[77.0,65.5]],
    admin:[[14.6,85.0],[18.0,86.0],[12.0,82.5]],
    system:[[43.8,85.0],[47.0,86.0],[41.0,82.5]],
    pmo_support:[[79.0,85.0],[82.0,86.0],[76.5,82.5]]
  };
  const approvalSlots=[[45.5,62.5],[49.0,64.0],[53.0,63.0],[56.0,61.8]];
  const nodes=()=>[...document.querySelectorAll('.agent-object')];
  const jobFor=id=>{
    try{return (state.jobs||[]).find(job=>job.owner_agent_id===id&&(activeStatuses.has(job.status)||job.status==='WAITING_APPROVAL'))||null}catch{return null}
  };
  const move=(node,x,y,destination='roam')=>{
    const currentX=parseFloat(node.style.left||node.style.getPropertyValue('--x')||0);
    const currentY=parseFloat(node.style.top||node.style.getPropertyValue('--y')||0);
    if(Math.hypot(currentX-x,currentY-y)<.35)return;
    node.dataset.moving='1';node.dataset.destination=destination;
    node.style.left=`${x}%`;node.style.top=`${y}%`;
    clearTimeout(node._moveTimer);
    node._moveTimer=setTimeout(()=>{node.dataset.moving='0';if(destination==='roam')delete node.dataset.destination},2250);
  };
  const pick=list=>list[Math.floor(Math.random()*list.length)];
  function updateMovement(){
    nodes().forEach((node,index)=>{
      const room=node.dataset.room||'pmo';
      const id=node.dataset.agentId||room;
      const job=jobFor(id);
      const route=routes[room]||routes.pmo;
      if(job?.status==='WAITING_APPROVAL'){
        const slot=approvalSlots[index%approvalSlots.length];
        move(node,slot[0],slot[1],'pmo');
        return;
      }
      if(job&&activeStatuses.has(job.status)){
        const home=route[0];
        move(node,home[0]+((index%2)?1.1:-1.1),home[1]-.7,'work');
        return;
      }
      if(String(job?.status||'').match(/BLOCKED|FAILED/)){
        const home=route[0];move(node,home[0],home[1],'blocked');return;
      }
      move(node,...pick(route.slice(1)),'roam');
    });
  }
  function returnHome(){nodes().forEach(node=>{const route=routes[node.dataset.room]||routes.pmo;move(node,route[0][0],route[0][1],'home')})}
  setTimeout(updateMovement,1200);
  setInterval(updateMovement,5200);
  setInterval(returnHome,20800);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateMovement()});
})();
