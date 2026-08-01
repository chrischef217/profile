(() => {
  const homes = {
    sales:['16.4%','25.0%'], product:['42.0%','24.5%'], design:['69.8%','25.0%'], marketing:['14.7%','47.0%'],
    dev:['79.4%','47.0%'], finance:['12.8%','68.0%'], pmo:['50.7%','56.5%'], research:['79.9%','68.0%'],
    admin:['14.6%','85.0%'], system:['43.8%','85.0%'], pmo_support:['79.0%','85.0%']
  };
  const approvalTargets = {
    sales:['43%','48%'], product:['47%','44%'], design:['55%','44%'], marketing:['42%','54%'], dev:['59%','54%'],
    finance:['43%','61%'], research:['58%','61%'], admin:['45%','68%'], pmo_support:['56%','68%'], pmo:['50.7%','56.5%']
  };
  const systemTarget = ['43.8%','82%'];
  const exitTarget = ['50%','94%'];

  const jobForVisual = room => {
    const node = document.querySelector(`.agent-object[data-room="${room}"]`);
    const agentId = node?.dataset.agentId;
    if (!agentId || agentId === 'runtime-system') return null;
    return typeof currentJobFor === 'function' ? currentJobFor(agentId) : null;
  };

  function targetFor(room) {
    if (room === 'system') return homes.system;
    const job = jobForVisual(room);
    const status = String(job?.status || '').toUpperCase();
    if (status === 'WAITING_APPROVAL') return approvalTargets[room] || approvalTargets.pmo;
    if (status === 'BLOCKED' || status === 'FAILED') return systemTarget;
    if (status === 'COMPLETED') return exitTarget;
    return homes[room];
  }

  function routeFor(room, from, to) {
    const fx=parseFloat(from[0]), fy=parseFloat(from[1]), tx=parseFloat(to[0]), ty=parseFloat(to[1]);
    const corridorX = room === 'sales' || room === 'marketing' || room === 'finance' || room === 'admin' ? 34 : room === 'design' || room === 'dev' || room === 'research' || room === 'pmo_support' ? 66 : 50;
    return [
      {left:`${fx}%`,top:`${fy}%`,offset:0},
      {left:`${corridorX}%`,top:`${Math.min(76,Math.max(35,(fy+ty)/2))}%`,offset:.52},
      {left:`${tx}%`,top:`${ty}%`,offset:1}
    ];
  }

  function moveAgents() {
    try {
      document.querySelectorAll('.agent-object[data-room]').forEach(node => {
        const room=node.dataset.room;
        const home=homes[room];
        if (!home) return;
        const target=targetFor(room);
        const key=target.join('|');
        if (node.dataset.motionTarget===key) return;
        const current=[node.style.left || getComputedStyle(node).left, node.style.top || getComputedStyle(node).top];
        node.dataset.motionTarget=key;
        const animation=node.animate(routeFor(room,current,target),{duration:1700,easing:'ease-in-out',fill:'forwards'});
        animation.onfinish=()=>{node.style.left=target[0];node.style.top=target[1];};
      });
    } catch(error){console.error('agent path movement error',error);}
  }

  moveAgents();
  setInterval(moveAgents,500);
})();
