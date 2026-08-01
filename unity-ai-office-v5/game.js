(() => {
  'use strict';

  const API = 'https://ckzwmimmwdnmpohgvcka.supabase.co/functions/v1/unity-ai-office-dev-open-v2';
  const ACTIVE = new Set(['QUEUED', 'APPROVED', 'RUNNING', 'WORKING']);
  const RESULTS = new Set(['COMPLETED', 'BLOCKED', 'FAILED', 'CANCELLED']);
  const TILE = 32;
  const COLS = 35;
  const ROWS = 22;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;
  const $ = id => document.getElementById(id);

  const ROLE_CONFIG = {
    pmo:       {name:'GPT PMO',       role:'프로젝트 방향·승인',      color:'#d2a557', desk:[17,10]},
    design:    {name:'CLAUDE DESIGN', role:'설계·UX 시스템',         color:'#9b7bd9', desk:[24,5]},
    dev:       {name:'GPT DEV',       role:'개발·배포',               color:'#50a9c4', desk:[28,9]},
    sales:     {name:'GPT SALES',     role:'영업 운영',               color:'#d67150', desk:[5,5]},
    product:   {name:'GPT PRODUCT',   role:'제품·품질',               color:'#5797cf', desk:[11,5]},
    marketing: {name:'GPT MARKETING', role:'마케팅·콘텐츠',           color:'#c95d82', desk:[5,11]},
    finance:   {name:'GPT FINANCE',   role:'재무 관리',               color:'#c59d45', desk:[5,17]},
    admin:     {name:'GPT ADMIN',     role:'관리·문서',               color:'#7ba64e', desk:[12,17]},
    research:  {name:'GPT RESEARCH',  role:'시장·정보 조사',          color:'#5c82c9', desk:[25,17]},
    audit:     {name:'CLAUDE AUDIT',  role:'감사·검증',               color:'#ba6268', desk:[30,17]}
  };

  const STATIONS = {
    coffee:   {tile:[17,18], label:'COFFEE BAR'},
    meeting1: {tile:[16,5],  label:'STRATEGY ROOM'},
    meeting2: {tile:[19,5],  label:'STRATEGY ROOM'},
    printer:  {tile:[18,16], label:'DOCUMENT HUB'},
    lounge1:  {tile:[29,12], label:'LOUNGE'},
    lounge2:  {tile:[31,12], label:'LOUNGE'},
    board:    {tile:[17,3],  label:'PLANNING BOARD'},
    server:   {tile:[31,5],  label:'SERVER ROOM'},
    lobby:    {tile:[17,20], label:'LOBBY'}
  };

  const state = {
    agents: [], jobs: [], events: [], queue: 0, approvals: 0,
    settings: {}, execution: {}, selectedTab: 'jobs', selectedNpcId: null,
    online: false, lastSync: null
  };

  const ui = {
    day: $('dayCount'), onlineText: $('onlineText'), onlineDot: document.querySelector('.online-dot'),
    clock: $('clockText'), cost: $('costValue'), approvalResource: $('approvalResource'), energy: $('energyValue'),
    language: $('languageButton'), refresh: $('refreshButton'),
    agents: $('agentsCount'), active: $('activeCount'), queue: $('queueCount'), approval: $('approvalCount'),
    queueTotal: $('queueTotal'), approvalTotal: $('approvalTotal'), queueList: $('queueList'), approvalList: $('approvalList'), tabContent: $('tabContent'),
    form: $('commandForm'), template: $('templateSelect'), input: $('commandInput'), execute: $('executeButton'), feedback: $('commandFeedback'),
    dialog: $('sectionDialog'), dialogTitle: $('dialogTitle'), dialogContent: $('dialogContent'),
    card: $('agentCard'), cardClose: $('agentCardClose'), cardStatus: $('agentCardStatus'), cardName: $('agentCardName'), cardRole: $('agentCardRole'), cardTask: $('agentCardTask'),
    toast: $('officeToast'), healthScore: $('healthScore'), healthBar: $('healthBar')
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function shortTime(value) {
    if (!value) return '—';
    try { return new Date(value).toLocaleTimeString('ko-KR', {timeZone:'Asia/Bangkok', hour:'2-digit', minute:'2-digit', hour12:false}); }
    catch { return '—'; }
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body) headers.set('content-type', 'application/json');
    const response = await fetch(API + path, {...options, headers, cache:'no-store'});
    const data = await response.json().catch(() => ({ok:false, error:`HTTP_${response.status}`}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP_${response.status}`);
    return data;
  }

  function currentJob(agentId) {
    return state.jobs.find(job => job.owner_agent_id === agentId && (ACTIVE.has(job.status) || job.status === 'WAITING_APPROVAL')) || null;
  }

  function latestJob(agentId) {
    return state.jobs.find(job => job.owner_agent_id === agentId) || null;
  }

  function jobText(job) {
    return job?.result?.output_text || job?.result?.reason || job?.error_message || job?.payload?.description || '처리 내용이 없습니다.';
  }

  function setOnline(ok) {
    state.online = ok;
    ui.onlineText.textContent = ok ? 'ONLINE' : 'OFFLINE';
    ui.onlineDot.classList.toggle('offline', !ok);
  }

  function showToast(message, type = '') {
    ui.toast.hidden = false;
    ui.toast.textContent = message;
    ui.toast.className = `office-toast ${type}`;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { ui.toast.hidden = true; }, 2600);
  }

  function setFeedback(message, type = '') {
    ui.feedback.textContent = message;
    ui.feedback.className = type;
  }

  function renderHeader() {
    const agents = state.agents.length || Object.keys(ROLE_CONFIG).length;
    const active = state.agents.filter(agent => currentJob(agent.id)).length;
    const queue = Number.isFinite(state.queue) ? state.queue : state.jobs.filter(job => ACTIVE.has(job.status)).length;
    const approvals = Number.isFinite(state.approvals) ? state.approvals : state.jobs.filter(job => job.status === 'WAITING_APPROVAL').length;
    ui.agents.textContent = agents;
    ui.active.textContent = active;
    ui.queue.textContent = queue;
    ui.approval.textContent = approvals;
    ui.queueTotal.textContent = queue;
    ui.approvalTotal.textContent = approvals;
    ui.approvalResource.textContent = approvals;
    const estimatedCost = Number(state.execution?.cost_total || state.execution?.estimated_cost || 0);
    ui.cost.textContent = estimatedCost ? estimatedCost.toFixed(2) : '0';
    const health = state.online ? Math.max(70, 100 - approvals * 4 - state.jobs.filter(job => ['BLOCKED','FAILED'].includes(job.status)).length * 8) : 35;
    ui.healthScore.textContent = `${health}%`;
    ui.healthBar.style.width = `${health}%`;
    ui.energy.textContent = `${Math.max(0, 120 - active * 4)}/120`;
  }

  function compactJob(job) {
    return `<article class="compact-entry" data-job-id="${escapeHtml(job.id)}"><strong>${escapeHtml(job.title || '업무')}</strong><small>${escapeHtml(job.owner_agent_id || 'pmo')} · ${shortTime(job.updated_at || job.created_at)}</small><em>${escapeHtml(job.status)}</em></article>`;
  }

  function bindJobCards(root) {
    root.querySelectorAll('[data-job-id]').forEach(card => card.addEventListener('click', () => openJob(card.dataset.jobId)));
  }

  function renderLists() {
    const queued = state.jobs.filter(job => ACTIVE.has(job.status));
    const approvals = state.jobs.filter(job => job.status === 'WAITING_APPROVAL');
    ui.queueList.innerHTML = queued.slice(0, 4).map(compactJob).join('') || '<div class="compact-empty">대기 중인 업무가 없습니다.</div>';
    ui.approvalList.innerHTML = approvals.slice(0, 4).map(compactJob).join('') || '<div class="compact-empty">승인 대기 업무가 없습니다.</div>';
    bindJobCards(ui.queueList);
    bindJobCards(ui.approvalList);
    renderTab();
  }

  function tabCard(job) {
    return `<article class="tab-card" data-job-id="${escapeHtml(job.id)}"><header><strong>${escapeHtml(job.title || '업무')}</strong><b>${escapeHtml(job.status)}</b></header><p>${escapeHtml(job.owner_agent_id || 'pmo')} · ${escapeHtml(job.capability_key || 'pmo_core')} · ${shortTime(job.updated_at || job.created_at)}</p></article>`;
  }

  function renderTab() {
    let html = '';
    if (state.selectedTab === 'jobs') {
      const jobs = state.jobs.filter(job => ACTIVE.has(job.status));
      html = jobs.map(tabCard).join('') || '<div class="compact-empty">진행 중인 업무가 없습니다.</div>';
    } else if (state.selectedTab === 'results') {
      const jobs = state.jobs.filter(job => RESULTS.has(job.status));
      html = jobs.map(tabCard).join('') || '<div class="compact-empty">완료 결과가 없습니다.</div>';
    } else if (state.selectedTab === 'approval') {
      const jobs = state.jobs.filter(job => job.status === 'WAITING_APPROVAL');
      html = jobs.map(tabCard).join('') || '<div class="compact-empty">승인 대기 업무가 없습니다.</div>';
    } else {
      html = `<div class="system-grid"><div class="system-cell"><small>API</small><strong>${state.online ? 'ONLINE' : 'OFFLINE'}</strong></div><div class="system-cell"><small>SCHEDULER</small><strong>${state.settings?.workday_enabled ? 'ACTIVE' : 'PAUSED'}</strong></div><div class="system-cell"><small>LAST SYNC</small><strong>${state.lastSync ? shortTime(state.lastSync) : '—'}</strong></div><div class="system-cell"><small>RUNTIME</small><strong>CANVAS 2D</strong></div></div>`;
    }
    ui.tabContent.innerHTML = html;
    bindJobCards(ui.tabContent);
  }

  function openJob(id) {
    const job = state.jobs.find(item => String(item.id) === String(id));
    if (!job) return;
    ui.dialogTitle.textContent = job.title || '업무 상세';
    const actions = [];
    if (job.status === 'WAITING_APPROVAL') actions.push(`<button class="approve" data-action="approve">승인</button><button class="reject" data-action="reject">거부</button>`);
    if (['BLOCKED','FAILED','CANCELLED'].includes(job.status)) actions.push(`<button data-action="retry">재시도</button>`);
    ui.dialogContent.innerHTML = `<p><strong>${escapeHtml(job.status)}</strong> · ${escapeHtml(job.owner_agent_id || 'pmo')} · ${escapeHtml(job.capability_key || 'pmo_core')}</p><pre>${escapeHtml(jobText(job))}</pre><div class="dialog-actions">${actions.join('')}</div>`;
    ui.dialogContent.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await api(`/${button.dataset.action}`, {method:'POST', body:JSON.stringify({job_id:job.id})});
        ui.dialog.close();
        await loadState(true);
        showToast(`업무 상태가 ${button.dataset.action.toUpperCase()} 처리되었습니다.`);
      } catch (error) {
        button.disabled = false;
        showToast(`처리 실패: ${error.message}`, 'error');
      }
    }));
    ui.dialog.showModal();
  }

  async function loadState(silent = false) {
    try {
      const data = await api('/state');
      state.agents = Array.isArray(data.agents) ? data.agents : [];
      state.jobs = Array.isArray(data.jobs) ? data.jobs : [];
      state.events = Array.isArray(data.events) ? data.events : [];
      state.queue = Number(data.queue ?? 0);
      state.approvals = Number(data.approvals ?? 0);
      state.settings = data.settings || {};
      state.execution = data.execution || {};
      state.lastSync = new Date().toISOString();
      setOnline(true);
      renderHeader();
      renderLists();
      office.applyOperationalState();
      renderAgentCard();
      if (!silent) setFeedback('실제 업무 시스템과 연결되었습니다.', 'ok');
    } catch (error) {
      setOnline(false);
      renderHeader();
      renderTab();
      if (!silent) setFeedback(`API 연결 실패: ${error.message}`, 'error');
    }
  }

  async function submitCommand(event) {
    event.preventDefault();
    const command = ui.input.value.trim() || ui.template.value.trim();
    if (!command) return setFeedback('지시 내용을 입력하십시오.', 'error');
    ui.execute.disabled = true;
    setFeedback('실제 작업 큐에 등록 중입니다.');
    try {
      const data = await api('/command', {method:'POST', body:JSON.stringify({command})});
      ui.input.value = '';
      ui.template.value = '';
      setFeedback(`등록 완료 · ${data.job?.owner_agent_id || 'PMO'} · ${data.job?.status || 'QUEUED'}`, 'ok');
      await loadState(true);
      if (data.job?.owner_agent_id) office.focusAgent(data.job.owner_agent_id);
    } catch (error) {
      setFeedback(`등록 실패: ${error.message}`, 'error');
    } finally {
      ui.execute.disabled = false;
    }
  }

  class Grid {
    constructor(cols, rows) { this.cols = cols; this.rows = rows; this.blocked = new Set(); }
    key(x, y) { return `${x},${y}`; }
    block(x, y, w = 1, h = 1) {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (xx >= 0 && yy >= 0 && xx < this.cols && yy < this.rows) this.blocked.add(this.key(xx, yy));
    }
    open(x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows && !this.blocked.has(this.key(x, y)); }
    nearest(x, y) {
      if (this.open(x, y)) return [x, y];
      for (let r = 1; r < 8; r++) {
        for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (this.open(xx, yy)) return [xx, yy];
      }
      return [17, 20];
    }
    path(start, goal) {
      start = this.nearest(...start); goal = this.nearest(...goal);
      const open = [{x:start[0], y:start[1], g:0, f:0, parent:null}];
      const best = new Map([[this.key(...start), 0]]);
      const closed = new Set();
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      while (open.length) {
        open.sort((a,b) => a.f - b.f);
        const node = open.shift();
        const key = this.key(node.x, node.y);
        if (closed.has(key)) continue;
        if (node.x === goal[0] && node.y === goal[1]) {
          const result = [];
          let cursor = node;
          while (cursor) { result.push([cursor.x, cursor.y]); cursor = cursor.parent; }
          return result.reverse();
        }
        closed.add(key);
        for (const [dx,dy] of dirs) {
          const nx = node.x + dx, ny = node.y + dy;
          if (!this.open(nx, ny)) continue;
          const g = node.g + 1;
          const nkey = this.key(nx, ny);
          if ((best.get(nkey) ?? Infinity) <= g) continue;
          best.set(nkey, g);
          open.push({x:nx, y:ny, g, f:g + Math.abs(goal[0]-nx) + Math.abs(goal[1]-ny), parent:node});
        }
      }
      return [start, goal];
    }
  }

  class OfficeGame {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.grid = new Grid(COLS, ROWS);
      this.npcs = new Map();
      this.last = performance.now();
      this.time = 0;
      this.scale = 1;
      this.offsetX = 0;
      this.offsetY = 0;
      this.buildCollision();
      this.createNpcs();
      this.bind();
      this.resize();
      requestAnimationFrame(t => this.loop(t));
    }

    buildCollision() {
      this.grid.block(0,0,COLS,1); this.grid.block(0,ROWS-1,COLS,1); this.grid.block(0,0,1,ROWS); this.grid.block(COLS-1,0,1,ROWS);
      [[3,3,5,4],[9,3,5,4],[22,3,5,4],[27,3,6,4],[3,9,5,5],[26,9,7,5],[3,15,6,5],[10,15,6,5],[22,15,5,5],[28,15,5,5]].forEach(r => this.grid.block(...r));
      this.grid.block(14,8,7,5);
    }

    createNpcs() {
      let index = 0;
      for (const [id, config] of Object.entries(ROLE_CONFIG)) {
        const tile = this.grid.nearest(config.desk[0], config.desk[1] + 2);
        this.npcs.set(id, {
          id, config, x:(tile[0]+.5)*TILE, y:(tile[1]+.5)*TILE,
          path:[], pathIndex:0, speed:45 + (index % 3) * 4, direction:'down',
          mode:'IDLE', activity:'업무 대기', location:'DESK', energy:100,
          nextDecision: 1.5 + index * .25, bob:Math.random()*Math.PI*2, selected:false
        });
        index++;
      }
    }

    bind() {
      window.addEventListener('resize', () => this.resize());
      this.canvas.addEventListener('click', event => {
        const rect = this.canvas.getBoundingClientRect();
        const wx = (event.clientX - rect.left - this.offsetX) / this.scale;
        const wy = (event.clientY - rect.top - this.offsetY) / this.scale;
        let picked = null;
        for (const npc of this.npcs.values()) {
          if (Math.hypot(wx - npc.x, wy - npc.y) < 22) { picked = npc; break; }
        }
        if (picked) {
          state.selectedNpcId = picked.id;
          for (const npc of this.npcs.values()) npc.selected = npc.id === picked.id;
          renderAgentCard();
          positionAgentCard(picked);
        }
      });
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
      this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
      this.ctx.setTransform(dpr,0,0,dpr,0,0);
      this.ctx.imageSmoothingEnabled = false;
      this.scale = Math.min(rect.width / WORLD_W, rect.height / WORLD_H);
      this.offsetX = (rect.width - WORLD_W * this.scale) / 2;
      this.offsetY = (rect.height - WORLD_H * this.scale) / 2;
    }

    worldToScreen(x, y) { return [this.offsetX + x * this.scale, this.offsetY + y * this.scale]; }

    route(npc, tile, mode, activity, location) {
      const start = [Math.floor(npc.x / TILE), Math.floor(npc.y / TILE)];
      const path = this.grid.path(start, tile);
      npc.path = path.slice(1).map(([x,y]) => [(x+.5)*TILE, (y+.5)*TILE]);
      npc.pathIndex = 0;
      npc.mode = mode;
      npc.activity = activity;
      npc.location = location;
    }

    idleRoutine(npc) {
      const roll = Math.random();
      if (roll < .52) this.route(npc, [npc.config.desk[0], npc.config.desk[1]+2], 'IDLE', '자율 업무 대기', 'DESK');
      else if (roll < .68) this.route(npc, STATIONS.coffee.tile, 'BREAK', '커피 브레이크', STATIONS.coffee.label);
      else if (roll < .80) this.route(npc, STATIONS.printer.tile, 'DOCUMENT', '문서 확인', STATIONS.printer.label);
      else if (roll < .91) this.route(npc, STATIONS.meeting1.tile, 'MEETING', '팀 협의', STATIONS.meeting1.label);
      else this.route(npc, STATIONS.lounge1.tile, 'BREAK', '잠시 휴식', STATIONS.lounge1.label);
      npc.nextDecision = 7 + Math.random() * 8;
    }

    applyOperationalState() {
      for (const npc of this.npcs.values()) {
        const job = currentJob(npc.id);
        const source = state.agents.find(agent => agent.id === npc.id);
        const status = job?.status || source?.status || 'IDLE';
        if (status === 'WAITING_APPROVAL') {
          this.route(npc, npc.id === 'pmo' ? STATIONS.meeting2.tile : STATIONS.meeting1.tile, status, job?.title || '승인 대기', 'APPROVAL ROOM');
        } else if (ACTIVE.has(status)) {
          this.route(npc, [npc.config.desk[0], npc.config.desk[1]+2], status, job?.title || '업무 진행', 'WORKSTATION');
        } else if (['BLOCKED','FAILED'].includes(status)) {
          this.route(npc, npc.id === 'dev' ? STATIONS.server.tile : STATIONS.printer.tile, status, job?.title || '문제 해결', npc.id === 'dev' ? STATIONS.server.label : 'SUPPORT DESK');
        } else if (status === 'COMPLETED') {
          this.route(npc, STATIONS.lounge2.tile, status, latestJob(npc.id)?.title || '결과 정리', 'RESULT LOUNGE');
        }
      }
    }

    focusAgent(id) {
      const npc = this.npcs.get(id);
      if (!npc) return;
      state.selectedNpcId = id;
      for (const item of this.npcs.values()) item.selected = item.id === id;
      renderAgentCard();
      positionAgentCard(npc);
    }

    update(dt) {
      this.time += dt;
      for (const npc of this.npcs.values()) {
        npc.bob += dt * 6;
        npc.nextDecision -= dt;
        if (!npc.path.length && !currentJob(npc.id) && npc.nextDecision <= 0) this.idleRoutine(npc);
        const target = npc.path[npc.pathIndex];
        if (target) {
          const dx = target[0] - npc.x, dy = target[1] - npc.y;
          const distance = Math.hypot(dx,dy);
          if (distance < 2) {
            npc.x = target[0]; npc.y = target[1]; npc.pathIndex++;
            if (npc.pathIndex >= npc.path.length) { npc.path = []; npc.pathIndex = 0; }
          } else {
            const step = Math.min(distance, npc.speed * dt);
            npc.x += dx / distance * step;
            npc.y += dy / distance * step;
            if (Math.abs(dx) > Math.abs(dy)) npc.direction = dx > 0 ? 'right' : 'left'; else npc.direction = dy > 0 ? 'down' : 'up';
            npc.energy = Math.max(35, npc.energy - dt * .18);
          }
        } else {
          npc.energy = Math.min(100, npc.energy + dt * .06);
        }
      }
      if (state.selectedNpcId) {
        const npc = this.npcs.get(state.selectedNpcId);
        if (npc && !ui.card.hidden) positionAgentCard(npc);
      }
    }

    drawRoom(x,y,w,h,label,color='#21303b') {
      const c = this.ctx;
      c.fillStyle = '#111a22'; c.fillRect(x*TILE,y*TILE,w*TILE,h*TILE);
      c.fillStyle = color; c.fillRect((x+.18)*TILE,(y+.18)*TILE,(w-.36)*TILE,(h-.36)*TILE);
      c.strokeStyle = '#50606b'; c.lineWidth = 2; c.strokeRect((x+.18)*TILE,(y+.18)*TILE,(w-.36)*TILE,(h-.36)*TILE);
      c.fillStyle = '#d3a85f'; c.font = 'bold 10px monospace'; c.textAlign = 'left'; c.fillText(label, (x+.45)*TILE, (y+.72)*TILE);
    }

    drawDesk(tile, color) {
      const c = this.ctx, x = tile[0]*TILE, y = tile[1]*TILE;
      c.fillStyle='#3b2f25'; c.fillRect(x+3,y+8,TILE*1.55,TILE*.55);
      c.fillStyle='#6b4f34'; c.fillRect(x+5,y+6,TILE*1.5,7);
      c.fillStyle='#17242d'; c.fillRect(x+20,y-1,24,16);
      c.strokeStyle=color; c.strokeRect(x+20,y-1,24,16);
      c.fillStyle=color; c.fillRect(x+25,y+4,14,3);
      c.fillStyle='#202a31'; c.fillRect(x+8,y+25,10,10); c.fillRect(x+38,y+25,10,10);
    }

    drawOffice() {
      const c = this.ctx;
      c.fillStyle='#17232b'; c.fillRect(0,0,WORLD_W,WORLD_H);
      for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++) {
        c.fillStyle = (x+y)%2 ? '#1b2831' : '#1d2b34';
        c.fillRect(x*TILE,y*TILE,TILE,TILE);
        c.strokeStyle='rgba(255,255,255,.025)'; c.strokeRect(x*TILE,y*TILE,TILE,TILE);
      }
      c.fillStyle='#26343e'; c.fillRect(TILE, TILE, WORLD_W-2*TILE, 2*TILE);
      c.fillStyle='#0b1116'; c.fillRect(TILE, TILE, WORLD_W-2*TILE, 8);
      this.drawRoom(2,2,7,6,'SALES','#253543');
      this.drawRoom(9,2,7,6,'PRODUCT','#263947');
      this.drawRoom(21,2,6,6,'DESIGN','#302c45');
      this.drawRoom(27,2,7,6,'DEV / SERVER','#213844');
      this.drawRoom(2,8,7,7,'MARKETING','#3d2838');
      this.drawRoom(25,8,9,7,'LOUNGE','#2b3834');
      this.drawRoom(2,14,8,7,'FINANCE','#3b3424');
      this.drawRoom(10,14,8,7,'ADMIN','#2b3c28');
      this.drawRoom(21,14,7,7,'RESEARCH','#28354a');
      this.drawRoom(28,14,6,7,'AUDIT','#3b282c');
      this.drawRoom(14,7,7,7,'PMO COMMAND','#3b3122');

      c.fillStyle='#42515b'; c.fillRect(15*TILE,3*TILE,5*TILE,3*TILE);
      c.fillStyle='#1c252b'; c.fillRect(15.3*TILE,3.3*TILE,4.4*TILE,2.4*TILE);
      c.strokeStyle='#d3a85f'; c.strokeRect(15.3*TILE,3.3*TILE,4.4*TILE,2.4*TILE);
      c.fillStyle='#d3a85f'; c.font='bold 10px monospace'; c.textAlign='center'; c.fillText('STRATEGY ROOM',17.5*TILE,4*TILE);
      c.fillStyle='#5d4933'; c.beginPath(); c.ellipse(17.5*TILE,4.8*TILE,55,18,0,0,Math.PI*2); c.fill();

      for (const [id,cfg] of Object.entries(ROLE_CONFIG)) if (id !== 'pmo') this.drawDesk(cfg.desk,cfg.color);
      this.drawDesk(ROLE_CONFIG.pmo.desk, ROLE_CONFIG.pmo.color);

      c.fillStyle='#584126'; c.fillRect(15.5*TILE,17.2*TILE,4*TILE,2*TILE);
      c.fillStyle='#d3a85f'; c.font='bold 9px monospace'; c.fillText('COFFEE BAR',17.5*TILE,17.85*TILE);
      c.fillStyle='#ece3d0'; c.fillRect(16.2*TILE,18.3*TILE,10,11); c.fillRect(18.2*TILE,18.3*TILE,10,11);
      c.fillStyle='#33444e'; c.fillRect(16.8*TILE,15.5*TILE,2.2*TILE,1.5*TILE); c.strokeStyle='#d3a85f'; c.strokeRect(16.8*TILE,15.5*TILE,2.2*TILE,1.5*TILE);
      c.fillStyle='#d3a85f'; c.fillText('DOCUMENT HUB',17.9*TILE,16.35*TILE);

      c.fillStyle='#12191f'; c.fillRect(30*TILE,3*TILE,3*TILE,2.6*TILE); c.strokeStyle='#d65a50'; c.strokeRect(30*TILE,3*TILE,3*TILE,2.6*TILE);
      c.fillStyle='#d65a50'; c.fillText('SERVER',31.5*TILE,3.7*TILE);
      for(let i=0;i<4;i++){c.fillStyle=i%2?'#79c65e':'#d3a85f';c.fillRect((30.4+i*.55)*TILE,4.3*TILE,5,5)}

      c.fillStyle='#384752'; c.fillRect(25.8*TILE,10.1*TILE,7.3*TILE,3.7*TILE);
      c.fillStyle='#657b68'; c.fillRect(26.3*TILE,10.6*TILE,2.4*TILE,1.1*TILE); c.fillRect(30.1*TILE,10.6*TILE,2.4*TILE,1.1*TILE);
      c.fillStyle='#2a3932'; c.fillRect(27.3*TILE,12.1*TILE,4.2*TILE,.8*TILE);
      c.fillStyle='#d3a85f'; c.fillText('RESULT LOUNGE',29.5*TILE,13.45*TILE);

      c.fillStyle='#293741'; c.fillRect(14*TILE,19.8*TILE,7*TILE,1.1*TILE); c.strokeStyle='#6a7a84'; c.strokeRect(14*TILE,19.8*TILE,7*TILE,1.1*TILE);
      c.fillStyle='#d3a85f'; c.fillText('LOBBY',17.5*TILE,20.55*TILE);
    }

    drawNpc(npc) {
      const c = this.ctx;
      const moving = npc.path.length > 0;
      const phase = moving ? Math.sin(this.time * 10 + npc.bob) : Math.sin(this.time * 2 + npc.bob) * .25;
      const x = Math.round(npc.x), y = Math.round(npc.y + phase);
      c.save();
      c.translate(x,y);
      c.fillStyle='rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0,12,12,5,0,0,Math.PI*2); c.fill();
      if (npc.selected) { c.strokeStyle='#f0c76e'; c.lineWidth=2; c.beginPath(); c.ellipse(0,10,17,8,0,0,Math.PI*2); c.stroke(); }
      c.fillStyle='#202a31';
      if (npc.direction === 'left' || npc.direction === 'right') { c.fillRect(-7,5+phase,5,10); c.fillRect(2,5-phase,5,10); }
      else { c.fillRect(-8+phase,5,5,10); c.fillRect(3-phase,5,5,10); }
      c.fillStyle=npc.config.color; c.fillRect(-10,-11,20,18);
      c.fillStyle='rgba(255,255,255,.2)'; c.fillRect(-8,-9,16,3);
      c.fillStyle='#e4b38a'; c.fillRect(-7,-22,14,12);
      c.fillStyle='#30241d'; c.fillRect(-8,-25,16,6); c.fillRect(-8,-21,3,6); c.fillRect(5,-21,3,6);
      if (npc.direction !== 'up') { c.fillStyle='#25313a'; c.fillRect(-4,-18,2,2); c.fillRect(3,-18,2,2); }
      c.fillStyle='#e4b38a';
      if (npc.direction === 'left' || npc.direction === 'right') { c.fillRect(-13,-8+phase,4,12); c.fillRect(9,-8-phase,4,12); }
      else { c.fillRect(-13+phase,-8,4,12); c.fillRect(9-phase,-8,4,12); }
      c.fillStyle='#10171c'; c.fillRect(-8,7,16,3);
      c.restore();

      const job = currentJob(npc.id);
      const status = job?.status || 'IDLE';
      c.fillStyle='rgba(5,9,12,.88)'; c.fillRect(x-28,y-42,56,12);
      c.fillStyle = status === 'WAITING_APPROVAL' ? '#e1a04b' : (ACTIVE.has(status) ? '#7fb342' : (['BLOCKED','FAILED'].includes(status) ? '#d65a50' : '#a8b2b8'));
      c.font='bold 7px monospace'; c.textAlign='center'; c.fillText(npc.config.name.replace('GPT ','').replace('CLAUDE ',''),x,y-34);
    }

    draw() {
      const rect = this.canvas.getBoundingClientRect();
      const c = this.ctx;
      c.clearRect(0,0,rect.width,rect.height);
      c.save();
      c.translate(this.offsetX,this.offsetY);
      c.scale(this.scale,this.scale);
      this.drawOffice();
      [...this.npcs.values()].sort((a,b)=>a.y-b.y).forEach(npc=>this.drawNpc(npc));
      c.restore();
    }

    loop(now) {
      const dt = Math.min(.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.draw();
      requestAnimationFrame(t => this.loop(t));
    }
  }

  function positionAgentCard(npc) {
    const [sx,sy] = office.worldToScreen(npc.x,npc.y);
    const stage = $('mapStage').getBoundingClientRect();
    const cardWidth = ui.card.offsetWidth || 190;
    const cardHeight = ui.card.offsetHeight || 110;
    ui.card.style.left = `${Math.min(stage.width-cardWidth-8, Math.max(8,sx+18))}px`;
    ui.card.style.top = `${Math.min(stage.height-cardHeight-8, Math.max(8,sy-95))}px`;
  }

  function renderAgentCard() {
    const id = state.selectedNpcId;
    if (!id || !office?.npcs?.has(id)) { ui.card.hidden = true; return; }
    const npc = office.npcs.get(id);
    const agent = state.agents.find(item => item.id === id);
    const job = currentJob(id);
    const status = job?.status || agent?.status || npc.mode || 'IDLE';
    ui.cardStatus.textContent = status;
    ui.cardStatus.className = status === 'WAITING_APPROVAL' ? 'waiting' : (ACTIVE.has(status) ? 'active' : (['BLOCKED','FAILED'].includes(status) ? 'blocked' : ''));
    ui.cardName.textContent = agent?.name || npc.config.name;
    ui.cardRole.textContent = agent?.role || npc.config.role;
    ui.cardTask.textContent = job?.title || npc.activity || '자율 업무 대기';
    ui.card.hidden = false;
  }

  function setupUi() {
    document.querySelectorAll('.work-tab').forEach(button => button.addEventListener('click', () => {
      document.querySelectorAll('.work-tab').forEach(item => item.classList.toggle('active', item === button));
      state.selectedTab = button.dataset.tab;
      renderTab();
    }));
    ui.form.addEventListener('submit', submitCommand);
    ui.template.addEventListener('change', () => { if (ui.template.value) ui.input.value = ui.template.value; });
    ui.refresh.addEventListener('click', () => loadState(false));
    ui.language.addEventListener('click', () => showToast('현재 개발 기준 언어는 한국어입니다.'));
    ui.cardClose.addEventListener('click', () => { ui.card.hidden = true; state.selectedNpcId = null; for (const npc of office.npcs.values()) npc.selected = false; });
    document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item === button));
      if (button.dataset.view === 'dashboard') return;
      showToast(`${button.querySelector('b')?.textContent || '기능'} 화면은 운영 기능 확장 단계에서 연결됩니다.`);
    }));
    setInterval(() => {
      const now = new Date();
      ui.clock.textContent = now.toLocaleTimeString('ko-KR',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hour12:false});
      const start = new Date('2026-07-01T00:00:00+07:00');
      ui.day.textContent = `DAY ${Math.max(1, Math.floor((now-start)/86400000)+1)}`;
    }, 1000);
  }

  const office = new OfficeGame($('officeCanvas'));
  setupUi();
  loadState(false);
  setInterval(() => loadState(true), 5000);
})();
