(() => {
  const ACTIVE_STATUSES = new Set(['QUEUED', 'RUNNING', 'WORKING', 'APPROVED']);
  const BLOCKED_STATUSES = new Set(['BLOCKED', 'FAILED']);
  const STATUS_PRIORITY = {
    WAITING_APPROVAL: 50,
    RUNNING: 40,
    WORKING: 39,
    QUEUED: 38,
    APPROVED: 37,
    BLOCKED: 30,
    FAILED: 29,
    COMPLETED: 10,
    CANCELLED: 9
  };
  const routes = {
    sales: [[16.4, 25.0], [19.0, 28.0], [22.0, 23.5]],
    product: [[42.0, 24.5], [45.0, 28.0], [39.0, 22.5]],
    design: [[69.8, 25.0], [73.0, 27.5], [67.0, 22.5]],
    marketing: [[14.7, 47.0], [18.0, 49.0], [12.0, 44.0]],
    dev: [[79.4, 47.0], [82.0, 49.5], [76.5, 44.5]],
    finance: [[12.8, 68.0], [16.0, 70.5], [10.5, 65.5]],
    pmo: [[50.7, 56.5], [48.0, 58.5], [53.0, 58.0]],
    research: [[79.9, 68.0], [82.5, 70.0], [77.0, 65.5]],
    admin: [[14.6, 85.0], [18.0, 86.0], [12.0, 82.5]],
    system: [[43.8, 85.0], [47.0, 86.0], [41.0, 82.5]],
    pmo_support: [[79.0, 85.0], [82.0, 86.0], [76.5, 82.5]]
  };
  const approvalSlots = [[45.5, 62.5], [49.0, 64.0], [53.0, 63.0], [56.0, 61.8]];
  const intervalMs = 5200;
  let cycle = 0;
  let intervalId = null;

  const nodes = () => [...document.querySelectorAll('.agent-object')];
  const runtimeState = () => {
    try {
      return typeof state === 'object' && state ? state : { jobs: [], settings: {} };
    } catch {
      return { jobs: [], settings: {} };
    }
  };
  const timestamp = value => {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const relevantJobFor = id => {
    const jobs = (runtimeState().jobs || []).filter(job => job.owner_agent_id === id);
    return jobs.sort((a, b) => {
      const priority = (STATUS_PRIORITY[b.status] || 0) - (STATUS_PRIORITY[a.status] || 0);
      return priority || timestamp(b.updated_at || b.created_at) - timestamp(a.updated_at || a.created_at);
    })[0] || null;
  };
  const currentPosition = node => [
    parseFloat(node.style.left || node.style.getPropertyValue('--x') || '0'),
    parseFloat(node.style.top || node.style.getPropertyValue('--y') || '0')
  ];
  const move = (node, x, y, destination = 'roam') => {
    const [currentX, currentY] = currentPosition(node);
    node.dataset.destination = destination;
    node.style.setProperty('--depth', String(12 + Math.round(y)));
    if (Math.hypot(currentX - x, currentY - y) < 0.35) {
      node.dataset.moving = '0';
      return;
    }
    node.dataset.moving = '1';
    node.dataset.facing = x < currentX ? 'left' : 'right';
    node.style.left = `${x}%`;
    node.style.top = `${y}%`;
    clearTimeout(node._moveTimer);
    node._moveTimer = setTimeout(() => {
      node.dataset.moving = '0';
      if (destination === 'roam') delete node.dataset.destination;
    }, 2250);
  };
  const idlePoint = (route, index) => {
    if (cycle % 4 === 0) return route[0];
    return route[1 + ((cycle + index) % Math.max(1, route.length - 1))] || route[0];
  };
  const systemDecision = node => {
    const workday = Boolean(runtimeState().settings?.workday_enabled);
    const route = routes.system;
    move(node, route[0][0], route[0][1], workday ? 'work' : 'blocked');
  };
  function updateMovement() {
    const agentNodes = nodes();
    if (!agentNodes.length) return false;
    cycle += 1;
    agentNodes.forEach((node, index) => {
      const room = node.dataset.room || 'pmo';
      const id = node.dataset.agentId || room;
      const route = routes[room] || routes.pmo;
      if (id === 'runtime-system' || room === 'system') {
        systemDecision(node);
        return;
      }
      const job = relevantJobFor(id);
      const status = String(job?.status || '').toUpperCase();
      if (status === 'WAITING_APPROVAL') {
        const slot = approvalSlots[index % approvalSlots.length];
        move(node, slot[0], slot[1], 'pmo');
        return;
      }
      if (ACTIVE_STATUSES.has(status)) {
        const home = route[0];
        move(node, home[0] + (index % 2 ? 1.1 : -1.1), home[1] - 0.7, 'work');
        return;
      }
      if (BLOCKED_STATUSES.has(status)) {
        move(node, route[0][0], route[0][1], 'blocked');
        return;
      }
      const point = idlePoint(route, index);
      move(node, point[0], point[1], point === route[0] ? 'home' : 'roam');
    });
    return true;
  }
  function start() {
    if (intervalId) return;
    let boot = null;
    boot = setInterval(() => {
      if (!updateMovement()) return;
      clearInterval(boot);
      intervalId = setInterval(updateMovement, intervalMs);
    }, 250);
    setTimeout(() => clearInterval(boot), 10000);
  }
  function stop() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    nodes().forEach(node => {
      clearTimeout(node._moveTimer);
      node.dataset.moving = '0';
    });
  }
  window.__UG_V4_MOVEMENT = {
    start,
    stop,
    tick: updateMovement,
    snapshot: () => nodes().map(node => ({
      room: node.dataset.room,
      agentId: node.dataset.agentId,
      destination: node.dataset.destination || 'idle',
      moving: node.dataset.moving === '1',
      left: node.style.left || node.style.getPropertyValue('--x'),
      top: node.style.top || node.style.getPropertyValue('--y')
    }))
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateMovement();
  });
  start();
})();
