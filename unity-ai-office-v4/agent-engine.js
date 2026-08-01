(() => {
  const agentConfigs = [
    {room:'sales', agentId:'sales', x:'16.4%', y:'25.0%', w:'7.0%', motion:'walker', gender:'m', hair:'#111820', suit:'#26333d', accent:'#d4a85f', tool:'tablet'},
    {room:'product', agentId:'product', x:'42.0%', y:'24.5%', w:'7.0%', motion:'walker', gender:'m', hair:'#111820', suit:'#293641', accent:'#4db3c9', tool:'clipboard'},
    {room:'design', agentId:'design', x:'69.8%', y:'25.0%', w:'7.4%', motion:'worker', gender:'f', hair:'#7c4429', suit:'#c26f75', accent:'#e1a04b', tool:'stylus'},
    {room:'marketing', agentId:'marketing', x:'14.7%', y:'47.0%', w:'7.4%', motion:'worker', gender:'f', hair:'#6d3d28', suit:'#2d3943', accent:'#d76c88', tool:'laptop'},
    {room:'dev', agentId:'dev', x:'79.4%', y:'47.0%', w:'7.2%', motion:'worker', gender:'m', hair:'#111820', suit:'#1f6382', accent:'#47b7d6', tool:'keyboard', glasses:true},
    {room:'finance', agentId:'finance', x:'12.8%', y:'68.0%', w:'7.0%', motion:'worker', gender:'m', hair:'#111820', suit:'#313940', accent:'#79b55b', tool:'calculator'},
    {room:'pmo', agentId:'pmo', x:'50.7%', y:'56.5%', w:'8.0%', motion:'pmo', gender:'m', hair:'#121820', suit:'#25303a', accent:'#d4a85f', tool:'command'},
    {room:'research', agentId:'research', x:'79.9%', y:'68.0%', w:'7.2%', motion:'worker', gender:'m', hair:'#111820', suit:'#e7e4dc', accent:'#55a8d5', tool:'laptop', glasses:true, darkText:true},
    {room:'admin', agentId:'admin', x:'14.6%', y:'85.0%', w:'7.0%', motion:'worker', gender:'f', hair:'#17202a', suit:'#e7e4dc', accent:'#66a46d', tool:'document', darkText:true},
    {room:'system', agentId:'dev', x:'43.8%', y:'85.0%', w:'7.2%', motion:'worker', gender:'m', hair:'#111820', suit:'#24536a', accent:'#55c7a9', tool:'tablet'},
    {room:'pmo_support', agentId:'admin', x:'79.0%', y:'85.0%', w:'7.0%', motion:'walker', gender:'f', hair:'#8b4b2b', suit:'#27323c', accent:'#d4a85f', tool:'clipboard'}
  ];

  const layer = document.getElementById('agentLayer');
  if (!layer) return;
  const nodes = new Map();

  const cssStatus = (status = 'IDLE') => {
    const value = String(status).toLowerCase();
    return ['running','working','approved','queued','waiting_approval','blocked','failed','completed'].includes(value) ? value : 'idle';
  };

  function toolMarkup(tool, accent) {
    const common = `fill="${accent}" stroke="#111820" stroke-width="2"`;
    if (tool === 'tablet') return `<rect x="42" y="49" width="15" height="21" rx="2" ${common}/><rect x="45" y="53" width="9" height="11" fill="#122b36"/>`;
    if (tool === 'clipboard') return `<rect x="40" y="47" width="16" height="23" rx="2" fill="#d8c8a8" stroke="#111820" stroke-width="2"/><rect x="44" y="51" width="8" height="3" fill="${accent}"/><path d="M44 58h8M44 63h8" stroke="#57616a" stroke-width="2"/>`;
    if (tool === 'stylus') return `<rect x="38" y="51" width="21" height="16" rx="2" fill="#1c3542" stroke="#111820" stroke-width="2"/><path d="M46 62l9-9" stroke="${accent}" stroke-width="3"/>`;
    if (tool === 'laptop') return `<path d="M36 52h23v16H36z" fill="#243b46" stroke="#111820" stroke-width="2"/><path d="M32 69h31l-4 5H36z" fill="#5b6670" stroke="#111820" stroke-width="2"/><rect x="41" y="56" width="12" height="7" fill="${accent}" opacity=".7"/>`;
    if (tool === 'keyboard') return `<rect x="35" y="60" width="27" height="10" rx="2" fill="#4b5963" stroke="#111820" stroke-width="2"/><path d="M39 64h19" stroke="${accent}" stroke-width="2"/>`;
    if (tool === 'calculator') return `<rect x="42" y="49" width="15" height="21" rx="2" fill="#26343c" stroke="#111820" stroke-width="2"/><rect x="45" y="52" width="9" height="5" fill="${accent}"/><path d="M45 61h2m3 0h2m3 0h2M45 65h2m3 0h2m3 0h2" stroke="#d5dde0" stroke-width="2"/>`;
    if (tool === 'document') return `<path d="M42 47h16v23H42z" fill="#efe8d8" stroke="#111820" stroke-width="2"/><path d="M45 53h10M45 58h10M45 63h7" stroke="${accent}" stroke-width="2"/>`;
    if (tool === 'command') return `<rect x="39" y="50" width="20" height="18" rx="2" fill="#1a3340" stroke="#111820" stroke-width="2"/><circle cx="49" cy="59" r="4" fill="${accent}"/><path d="M49 50v-5" stroke="${accent}" stroke-width="2"/>`;
    return `<rect x="41" y="49" width="17" height="21" rx="2" ${common}/>`;
  }

  function characterSvg(config) {
    const skin = '#f0bd91';
    const shirt = config.darkText ? '#27313a' : '#f1eee4';
    const tie = config.accent;
    const femaleHair = config.gender === 'f' ? `<path d="M20 18q3-13 16-13t17 13v21l-9 7-4-19H27l-3 19-7-7z" fill="${config.hair}" stroke="#10151a" stroke-width="2"/>` : '';
    const maleHair = config.gender !== 'f' ? `<path d="M19 20q2-15 17-15 13 0 18 12l-5-3-3 7-6-5-5 5-6-5-5 7z" fill="${config.hair}" stroke="#10151a" stroke-width="2"/>` : '';
    const glasses = config.glasses ? `<path d="M25 27h9v7h-9zm13 0h9v7h-9zm-4 3h4" fill="none" stroke="#172029" stroke-width="2"/>` : '';
    return `<svg viewBox="0 0 72 100" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <ellipse cx="36" cy="94" rx="19" ry="5" fill="#020407" opacity=".45"/>
      <g class="agent-body">
        <rect x="23" y="70" width="10" height="21" rx="2" fill="#202a32" stroke="#10151a" stroke-width="2"/><rect x="39" y="70" width="10" height="21" rx="2" fill="#202a32" stroke="#10151a" stroke-width="2"/>
        <rect x="19" y="88" width="16" height="6" rx="2" fill="#111820"/><rect x="37" y="88" width="16" height="6" rx="2" fill="#111820"/>
        <path d="M18 47q18-8 36 0l3 30H15z" fill="${config.suit}" stroke="#10151a" stroke-width="2"/>
        <path d="M29 47h14l-2 18H31z" fill="${shirt}"/><path d="M34 48h4l3 14-5 6-5-6z" fill="${tie}"/>
        <g class="agent-arm left"><rect x="11" y="49" width="11" height="26" rx="5" fill="${config.suit}" stroke="#10151a" stroke-width="2"/><circle cx="16" cy="73" r="5" fill="${skin}" stroke="#10151a" stroke-width="2"/></g>
        <g class="agent-arm right"><rect x="50" y="49" width="11" height="26" rx="5" fill="${config.suit}" stroke="#10151a" stroke-width="2"/><circle cx="56" cy="73" r="5" fill="${skin}" stroke="#10151a" stroke-width="2"/></g>
        <circle cx="36" cy="28" r="17" fill="${skin}" stroke="#10151a" stroke-width="2"/>
        ${femaleHair}${maleHair}
        <rect x="28" y="28" width="3" height="4" fill="#172029"/><rect x="41" y="28" width="3" height="4" fill="#172029"/><path d="M32 38h8" stroke="#9b5f4f" stroke-width="2"/>
        ${glasses}
        <g class="agent-tool">${toolMarkup(config.tool, config.accent)}</g>
      </g>
    </svg>`;
  }

  function buildAgents() {
    layer.innerHTML = '';
    for (const config of agentConfigs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `agent-object ${config.motion}`;
      button.style.setProperty('--x', config.x);
      button.style.setProperty('--y', config.y);
      button.style.setProperty('--w', config.w);
      button.dataset.room = config.room;
      button.dataset.agentId = config.agentId;
      button.dataset.label = config.room.replace('_', ' ').toUpperCase();
      button.setAttribute('aria-label', `${button.dataset.label} agent`);
      button.innerHTML = characterSvg(config);
      button.addEventListener('click', () => {
        try {
          const agent = (state.agents || []).find(item => item.id === config.agentId);
          const job = typeof currentJobFor === 'function' ? currentJobFor(config.agentId) : null;
          document.querySelectorAll('.agent-object').forEach(node => node.classList.remove('is-selected'));
          button.classList.add('is-selected');
          if (typeof openAgentDialog === 'function') openAgentDialog(config.room, agent, job);
        } catch (error) { console.error('agent dialog error', error); }
      });
      layer.appendChild(button);
      nodes.set(config.room, {button, config});
    }
  }

  function updateAgents() {
    try {
      for (const {button, config} of nodes.values()) {
        const agent = (state.agents || []).find(item => item.id === config.agentId);
        const job = typeof currentJobFor === 'function' ? currentJobFor(config.agentId) : null;
        const status = cssStatus(job?.status || agent?.status || 'IDLE');
        button.className = `agent-object ${config.motion} ${status}`;
        const title = job?.title || agent?.current_task || 'IDLE';
        button.dataset.label = `${config.room.replace('_',' ').toUpperCase()} · ${status.toUpperCase()}`;
        button.title = `${button.dataset.label} · ${title}`;
      }
    } catch (error) { console.error('agent update error', error); }
  }

  buildAgents();
  updateAgents();
  try {
    const originalRenderAll = renderAll;
    renderAll = function patchedRenderAll(){ originalRenderAll(); updateAgents(); };
  } catch (error) { console.warn('render hook unavailable', error); }
  setInterval(updateAgents, 750);
})();
