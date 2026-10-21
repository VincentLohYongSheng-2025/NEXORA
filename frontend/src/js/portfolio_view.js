import { classificationBadge, createPersistentDisclosure } from './data_classification.js';

const IMAGE_BY_SOURCE_ID = Object.freeze({
  Hog_assembly_Dona: 'assets/buildings/Hog_assembly_Dona.jpg',
  Hog_education_Donnie: 'assets/buildings/Hog_education_Donnie.jpg',
  Hog_lodging_Francisco: 'assets/buildings/Hog_lodging_Francisco.jpg',
  Hog_office_Bill: 'assets/buildings/Hog_office_Bill.jpg',
});

class PortfolioView {
  constructor() {
    this.assets = [];
    this.selectedId = null;
  }

  async init() {
    this.mount();
    try {
      const response = await window.apiClient.getAssets();
      this.assets = response.items || [];
      if (!this.assets.length) throw new Error('The live API returned no BDG2 benchmark assets.');
      this.renderCards();
      await this.selectAsset(this.assets[0].id);
    } catch (error) {
      this.renderError(error.message);
    }
  }

  mount() {
    Array.from(document.body.children).forEach((child) => {
      child.hidden = true;
      child.style.display = 'none';
      child.setAttribute('aria-hidden', 'true');
    });
    document.body.className = 'module-surface';
    const root = document.createElement('main');
    root.id = 'portfolio-view-app';
    root.className = 'module-shell';
    root.innerHTML = `
      <header class="flex flex-col gap-5 border-b border-[#E5E0D7] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <a href="index.html" class="text-xs font-extrabold uppercase tracking-[0.18em] text-[#FF7A00]">← EnergiOS dashboard</a>
          <div class="mt-3 flex flex-wrap items-center gap-3"><h1 class="text-3xl font-black tracking-tight md:text-5xl">Benchmark portfolio view</h1>${classificationBadge('illustrative')}</div>
          <p class="mt-3 max-w-3xl text-sm leading-6 text-[#5F6469]">Navigate the four approved BDG2 benchmark assets and inspect their live whole-building reading, calculated forecast, and unusual-pattern status.</p>
        </div>
        <a href="methodology.html" class="module-button">Data sources & methodology</a>
      </header>

      <section class="mt-6 rounded-2xl border border-slate-300 bg-slate-50 p-4 text-sm text-slate-800">
        <strong>Illustrative portfolio view — not a measured digital twin.</strong> Card placement, imagery, and visual relationships are illustrative. They do not represent Sime Darby assets, township coordinates, building geometry, rooms, floors, or equipment.
      </section>

      <div id="portfolio-error" class="mt-6 hidden rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900" role="alert"></div>
      <section id="portfolio-cards" class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="BDG2 benchmark assets"></section>

      <section class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <article class="module-card overflow-hidden">
          <div class="grid md:grid-cols-[minmax(260px,0.85fr)_1.15fr]">
            <div class="relative min-h-[300px] bg-[#EDE9E2]">
              <img id="portfolio-image" alt="Illustrative building image; not measured geometry" class="absolute inset-0 h-full w-full object-cover">
              <div class="absolute inset-x-3 bottom-3">${classificationBadge('illustrative', 'Illustrative visual — not measured spatial data')}</div>
            </div>
            <div class="p-6 md:p-8">
              <p class="text-xs font-black uppercase tracking-[0.16em] text-[#FF7A00]">Selected public benchmark asset</p>
              <h2 id="portfolio-name" class="mt-2 text-3xl font-black">Loading…</h2>
              <p id="portfolio-meta" class="mt-2 text-sm text-[#71767B]"></p>
              <div id="portfolio-status" class="mt-7 grid gap-3 sm:grid-cols-3" aria-live="polite"></div>
              <div class="mt-6 rounded-xl border border-violet-200 bg-violet-50 p-4">
                <div class="flex flex-wrap items-center gap-2">${classificationBadge('derived')}<span class="text-xs font-bold text-violet-900">Selected-asset status only</span></div>
                <p class="mt-3 text-xs leading-5 text-violet-900">Values are compared by classification and unit; this view does not imply the buildings share a campus, network, tariff, climate, or operating schedule.</p>
              </div>
            </div>
          </div>
        </article>

        <aside class="module-card p-6">
          <h2 class="text-lg font-black">What this view can say</h2>
          <ul class="mt-4 space-y-3 text-sm leading-6 text-[#5F6469]">
            <li><strong class="text-[#1E2022]">Observed:</strong> latest imported whole-building interval-kWh reading.</li>
            <li><strong class="text-[#1E2022]">Calculated:</strong> next hourly forecast derived from BDG2 history.</li>
            <li><strong class="text-[#1E2022]">Detected:</strong> statistical unusual-consumption-pattern count with no confirmed cause.</li>
          </ul>
          <div class="mt-6 rounded-xl bg-[#F8F6F2] p-4 text-xs leading-5 text-[#5F6469]">No measured township layout, geometry, floor, room, equipment, solar, battery, tariff, carbon, or live-control data is shown.</div>
        </aside>
      </section>
    `;
    document.body.appendChild(root);
    createPersistentDisclosure();
  }

  renderCards() {
    const container = document.getElementById('portfolio-cards');
    container.innerHTML = this.assets.map((asset) => `
      <button type="button" data-asset-id="${asset.id}" class="portfolio-card module-card overflow-hidden text-left transition hover:-translate-y-1 hover:border-[#FF7A00] focus:outline-none focus:ring-4 focus:ring-orange-200">
        <img src="${IMAGE_BY_SOURCE_ID[asset.source_asset_id] || 'assets/idea_crops/exact_building_perfect.jpeg'}" alt="Illustrative image for ${asset.name}; not source geometry" class="h-28 w-full object-cover">
        <span class="block p-4"><span class="block text-sm font-black">${asset.name.replaceAll('_', ' ')}</span><span class="mt-1 block text-xs text-[#71767B]">${asset.asset_type} · whole-building meter</span></span>
      </button>
    `).join('');
    container.querySelectorAll('[data-asset-id]').forEach((button) => button.addEventListener('click', () => this.selectAsset(button.dataset.assetId)));
  }

  async selectAsset(assetId) {
    const asset = this.assets.find((item) => item.id === assetId);
    if (!asset) return this.renderError('The selected asset is unavailable from the live API.');
    this.selectedId = assetId;
    document.querySelectorAll('[data-asset-id]').forEach((button) => button.classList.toggle('ring-4', button.dataset.assetId === assetId));
    document.getElementById('portfolio-name').textContent = asset.name.replaceAll('_', ' ');
    document.getElementById('portfolio-meta').textContent = `${asset.asset_type} · ${asset.timezone} · ${asset.meter.unit} ${asset.meter.reading_semantics}`;
    document.getElementById('portfolio-image').src = IMAGE_BY_SOURCE_ID[asset.source_asset_id] || 'assets/idea_crops/exact_building_perfect.jpeg';
    document.getElementById('portfolio-status').innerHTML = '<p class="text-sm text-[#71767B] sm:col-span-3">Loading live classified status…</p>';
    try {
      const [readings, forecast, anomalies] = await Promise.all([
        window.apiClient.getReadings(assetId, { limit: 24 }),
        window.apiClient.getForecast(assetId),
        window.apiClient.getAnomalies(assetId, { limit: 100 }),
      ]);
      if (assetId !== this.selectedId) return;
      const latest = readings.items?.at(-1);
      const next = forecast.items?.[0];
      document.getElementById('portfolio-status').innerHTML = [
        this.statusCard(classificationBadge('observed'), latest ? `${latest.consumption_kwh.toFixed(1)} kWh` : 'Unavailable', latest ? new Date(latest.timestamp).toLocaleString() : 'No reading returned'),
        this.statusCard(classificationBadge('calculated'), next ? `${next.forecast_kwh.toFixed(1)} kWh` : 'Unavailable', next ? new Date(next.timestamp).toLocaleString() : 'No forecast returned'),
        this.statusCard(classificationBadge('detected'), `${anomalies.count ?? 0} patterns`, (anomalies.count ?? 0) === 0 ? 'No pattern detected; not proof of efficiency' : 'No confirmed cause'),
      ].join('');
    } catch (error) {
      if (assetId === this.selectedId) this.renderError(error.message);
    }
  }

  statusCard(badge, value, detail) {
    return `<div class="rounded-xl border border-[#EBE7DF] p-4">${badge}<p class="mt-4 text-xl font-black">${value}</p><p class="mt-1 text-[11px] leading-4 text-[#71767B]">${detail}</p></div>`;
  }

  renderError(message) {
    const error = document.getElementById('portfolio-error');
    if (error) { error.textContent = message || 'The live EnergiOS API is temporarily unavailable.'; error.classList.remove('hidden'); }
  }
}

window.portfolioView = new PortfolioView();
document.addEventListener('DOMContentLoaded', () => window.portfolioView.init());
