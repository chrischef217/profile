(() => {
  const statusClass = value => {
    const status = String(value || 'IDLE').toLowerCase();
    return ['running','working','approved','queued','waiting_approval','blocked','failed','completed'].includes(status) ? status : 'idle';
  };

  function setClass(node, motion, status) {
    if (!node) return;
    const selected = node.classList.contains('is-selected');
    node.className = `agent-object ${motion} ${status}${selected ? ' is-selected' : ''}`;
  }

  function updateSpecialAgents() {
    try {
      const support = document.querySelector('.agent-object[data-room="pmo_support"]');
      const audit = (state.agents || []).find(item => item.id === 'audit');
      const auditJob = typeof currentJobFor === 'function' ? currentJobFor('audit') : null;
      const auditStatus = statusClass(auditJob?.status || audit?.status || 'IDLE');
      setClass(support, 'walker', auditStatus);
      if (support) {
        support.dataset.agentId = 'audit';
        support.dataset.label = `PMO SUPPORT · ${auditStatus.toUpperCase()}`;
        support.title = `${support.dataset.label} · ${auditJob?.title || audit?.current_task || 'IDLE'}`;
      }

      const system = document.querySelector('.agent-object[data-room="system"]');
      const workday = Boolean(state.settings?.workday_enabled);
      const systemStatus = workday ? 'working' : 'blocked';
      setClass(system, 'worker', systemStatus);
      if (system) {
        system.dataset.agentId = 'runtime-system';
        system.dataset.label = `SYSTEM · ${systemStatus.toUpperCase()}`;
        system.title = `${system.dataset.label} · ${state.runtime || state.execution?.disabled_reason || 'RUNTIME'}`;
      }
    } catch (error) {
      console.error('special agent mapping error', error);
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('.agent-object[data-room="pmo_support"],.agent-object[data-room="system"]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      if (button.dataset.room === 'pmo_support') {
        const audit = (state.agents || []).find(item => item.id === 'audit');
        const job = typeof currentJobFor === 'function' ? currentJobFor('audit') : null;
        openAgentDialog('pmo_support', audit, job);
      } else {
        const workday = Boolean(state.settings?.workday_enabled);
        const synthetic = {id:'runtime-system', name:'System Runtime', role:'Scheduler · Runner · Health', status:workday?'WORKING':'BLOCKED', updated_at:new Date().toISOString()};
        openAgentDialog('system', synthetic, null);
      }
    } catch (error) {
      console.error('special agent dialog error', error);
    }
  }, true);

  updateSpecialAgents();
  setInterval(updateSpecialAgents, 760);
})();
