export const CLASSIFICATIONS = Object.freeze({
  observed: {
    label: 'Observed public benchmark data',
    help: 'Imported BDG2 whole-building hourly interval-kWh readings.',
  },
  calculated: {
    label: 'Calculated forecast',
    help: 'Model output derived from BDG2 history; it is not an observed reading.',
  },
  detected: {
    label: 'Detected unusual consumption pattern',
    help: 'A statistical detection with no confirmed operational cause.',
  },
  derived: {
    label: 'Derived benchmark comparison',
    help: 'A comparison calculated from the selected BDG2 benchmark buildings.',
  },
  simulated: {
    label: 'Simulated assumption',
    help: 'A hypothetical user-entered or default input/output; it is not measured operational data.',
  },
  illustrative: {
    label: 'Illustrative visual',
    help: 'Presentation graphics that are not measured spatial data.',
  },
});

export function classificationBadge(kind, label = CLASSIFICATIONS[kind]?.label) {
  const definition = CLASSIFICATIONS[kind];
  if (!definition) throw new TypeError(`Unknown data classification: ${kind}`);
  return `<span class="data-classification" data-kind="${kind}" title="${definition.help}">${label}</span>`;
}

export function createPersistentDisclosure() {
  const existing = document.querySelector('.persistent-disclosure');
  if (existing) {
    existing.hidden = false;
    existing.style.removeProperty('display');
    existing.removeAttribute('aria-hidden');
    return existing;
  }
  const disclosure = document.createElement('aside');
  disclosure.className = 'persistent-disclosure';
  disclosure.setAttribute('aria-label', 'Dataset disclosure');
  disclosure.innerHTML = `
    <span><strong>Demo uses BDG2 public benchmark data and clearly labelled simulations.</strong> It does not use Sime Darby Property operational data.</span>
    <a href="methodology.html">Data sources</a>
  `;
  document.body.appendChild(disclosure);
  return disclosure;
}

function addBadge(target, kind, label) {
  if (!target || target.querySelector('.data-classification')) return;
  target.insertAdjacentHTML('beforeend', classificationBadge(kind, label));
}

export function annotateDashboard() {
  const metricCard = (id) => document.getElementById(id)?.closest('div')?.parentElement;
  addBadge(metricCard('metric-total-val'), 'derived', 'Derived 24h total');
  addBadge(metricCard('metric-current-val'), 'observed');
  addBadge(metricCard('metric-export-val'), 'calculated');
  addBadge(document.getElementById('alerts-count-tag')?.closest('.velora-card'), 'detected');
  addBadge(document.getElementById('heatmap-row-a')?.closest('.velora-card'), 'calculated');
}

document.addEventListener('DOMContentLoaded', () => {
  createPersistentDisclosure();
  if (document.getElementById('metric-total-val')) annotateDashboard();
});
