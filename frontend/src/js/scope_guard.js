/** Render an explicit scope gate for views unsupported by whole-building BDG2. */
(() => {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  const messages = {
    'diagnostics.html': {
      title: 'Equipment diagnostics are unavailable',
      body: 'The live API provides whole-building electricity readings, forecasts, and unusual consumption patterns. It does not provide equipment, subsystem, floor, room, HVAC, or confirmed-cause data.',
    },
    'energy.html': {
      title: 'Microgrid simulation is unavailable',
      body: 'No measured solar, battery, feeder, import/export, tariff, or live-control data is available. Peak-shaving results require an explicitly labelled user-assumption simulation and are not provided by the backend.',
    },
    'digital-twin.html': {
      title: 'Spatial digital twin is unavailable',
      body: 'BDG2 does not provide verified township coordinates, building geometry, floor plans, room mappings, or equipment telemetry. The dashboard therefore does not present the illustrative scene as measured data.',
    },
    'settings.html': {
      title: 'Read-only demo configuration',
      body: 'The application remains read-only. Scenario assumptions are edited in the Energy Scenario Lab and are not saved to the database. No live controls, setpoints, browser credentials, database administration, or operational tariff configuration are available.',
    },
  };
  const message = messages[page];
  if (!message) return;

  document.documentElement.style.overflowX = 'hidden';
  document.body.style.overflowX = 'hidden';
  Array.from(document.body.children).forEach((child) => {
    child.inert = true;
    child.setAttribute('aria-hidden', 'true');
  });

  const overlay = document.createElement('div');
  overlay.id = 'scope-gate';
  overlay.setAttribute('role', 'region');
  overlay.setAttribute('aria-label', 'Current data scope');
  overlay.className = 'fixed inset-0 z-[9999] overflow-auto bg-[#FAF8F5] text-[#1E2022] p-5 sm:p-8';
  overlay.innerHTML = `
    <div class="mx-auto flex min-h-full max-w-3xl items-center justify-center">
      <section class="w-full rounded-[28px] border border-[#EBE7DF] bg-white p-7 shadow-xl sm:p-10" role="status">
        <span class="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-900">Current data scope</span>
        <h1 class="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">${message.title}</h1>
        <p class="mt-4 text-sm leading-7 text-[#5F6469]">${message.body}</p>
        <div class="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">
          <strong>Public benchmark data — Building Data Genome Project 2 v1.0.</strong><br>
          This is not Sime Darby or Elmina Lakeside Mall data. No unsupported value has been substituted.
        </div>
        <div class="mt-7 flex flex-wrap gap-3">
          <a href="index.html" class="rounded-full bg-[#1E2022] px-5 py-2.5 text-sm font-semibold text-white">Open live dashboard</a>
          <a href="index.html#forecast" class="rounded-full border border-[#D9D5CE] px-5 py-2.5 text-sm font-semibold">View supported forecast</a>
        </div>
      </section>
    </div>
  `;
  document.body.appendChild(overlay);
})();
