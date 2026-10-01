(() => {
  'use strict';

  const STORAGE_KEY = 'lubricentro-ptj-demo-v1';
  const ACCESS_KEY = 'lubricentro-ptj-demo-access';
  const OIL_TYPES = {
    mineral: { label: 'Mineral', interval: 5000 },
    semisintetico: { label: 'Semisintético', interval: 7500 },
    sintetico: { label: 'Sintético', interval: 10000 }
  };
  const SEED = {
    vehicles: [
      { id: 'vehicle-ptj123', plate: 'PTJ123', brand: 'Toyota', model: 'Corolla', year: 2021, customerName: 'Cliente de ejemplo', phone: '' },
      { id: 'vehicle-abc789', plate: 'ABC789', brand: 'Honda', model: 'Civic', year: 2020, customerName: 'Otro cliente de ejemplo', phone: '' }
    ],
    serviceRecords: [
      { id: 'service-demo-1', vehicleId: 'vehicle-ptj123', date: '2026-06-15', currentKm: 42000, oilType: 'sintetico', filterOil: true, filterAir: true, nextServiceKm: 52000, nextServiceDate: '2026-12-15' },
      { id: 'service-demo-2', vehicleId: 'vehicle-abc789', date: '2026-05-22', currentKm: 68500, oilType: 'semisintetico', filterOil: true, filterAir: false, nextServiceKm: 76000, nextServiceDate: '2026-11-22' }
    ]
  };

  const $ = (selector) => document.querySelector(selector);
  const cloneSeed = () => JSON.parse(JSON.stringify(SEED));
  const normalizePlate = (value) => String(value || '').toUpperCase().replace(/[\s-]/g, '');
  const formatKm = (value) => `${new Intl.NumberFormat('es-VE').format(value)} km`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const validIsoDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const formatDate = (value) => validIsoDate(value)
    ? new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
    : '—';
  const todayIso = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const addSixMonths = (isoDate) => {
    const [year, month, day] = isoDate.split('-').map(Number);
    const firstOfTarget = new Date(Date.UTC(year, month - 1 + 6, 1));
    const targetYear = firstOfTarget.getUTCFullYear();
    const targetMonth = firstOfTarget.getUTCMonth();
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
  };
  const id = () => globalThis.crypto?.randomUUID?.() || `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        const seed = cloneSeed();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        return seed;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.vehicles) && Array.isArray(parsed.serviceRecords)) return parsed;
    } catch (error) {
      console.warn('No se pudieron leer los datos de la demo.', error);
    }
    return cloneSeed();
  }

  let data = loadData();

  function saveData(nextData) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
      data = nextData;
      return true;
    } catch (error) {
      console.warn('No se pudieron guardar los datos de la demo.', error);
      return false;
    }
  }

  function latestService(vehicleId) {
    return data.serviceRecords
      .filter((record) => record.vehicleId === vehicleId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0] || null;
  }

  function initPublic() {
    const form = $('#search-form');
    const input = $('#plate-search');
    const button = $('#search-button');
    const status = $('#search-status');
    const result = $('#search-result');
    const sample = $('#sample-plate');
    let searchTimer;

    function showStatus(message, isError = false) {
      status.textContent = message;
      status.classList.remove('hidden', 'text-white/65', 'text-[#ffab91]');
      status.classList.add(isError ? 'text-[#ffab91]' : 'text-white/65');
    }

    function renderResult(vehicle, record) {
      const filterLabels = [record.filterOil && 'Aceite', record.filterAir && 'Aire'].filter(Boolean).join(' · ') || 'No registrados';
      result.innerHTML = `
        <article class="overflow-hidden rounded-3xl border border-lime/40 bg-[#121812] shadow-2xl shadow-black/40">
          <div class="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-5 sm:px-9"><div><p class="text-xs font-bold uppercase tracking-[.2em] text-lime">Ficha del vehículo</p><h2 class="mt-1 font-display text-2xl font-bold">${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)} <span class="text-white/45">· ${escapeHtml(vehicle.year)}</span></h2></div><span class="rounded-xl border border-white/20 px-4 py-2 font-display text-lg font-bold tracking-widest">${escapeHtml(vehicle.plate)}</span></div>
          <div class="grid lg:grid-cols-[1.15fr_1fr]"><div class="bg-lime p-7 text-ink sm:p-9"><p class="text-xs font-bold uppercase tracking-[.2em] text-ink/65">Próximo cambio de aceite</p><p class="mt-4 font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl">${escapeHtml(formatKm(record.nextServiceKm))}</p><p class="mt-3 font-display text-xl font-semibold">o el ${escapeHtml(formatDate(record.nextServiceDate))}</p><p class="mt-5 max-w-md text-sm text-ink/70">Realiza el próximo servicio cuando se cumpla primero el kilometraje o la fecha recomendada.</p></div><div class="grid grid-cols-2 gap-6 p-7 sm:p-9"><div><p class="text-xs uppercase tracking-wider text-white/45">Último servicio</p><p class="mt-2 font-semibold">${escapeHtml(formatDate(record.date))}</p></div><div><p class="text-xs uppercase tracking-wider text-white/45">Kilometraje</p><p class="mt-2 font-semibold">${escapeHtml(formatKm(record.currentKm))}</p></div><div><p class="text-xs uppercase tracking-wider text-white/45">Aceite</p><p class="mt-2 font-semibold">${escapeHtml(OIL_TYPES[record.oilType]?.label || 'No registrado')}</p></div><div><p class="text-xs uppercase tracking-wider text-white/45">Filtros cambiados</p><p class="mt-2 font-semibold">${escapeHtml(filterLabels)}</p></div></div></div>
        </article>`;
      result.classList.remove('hidden');
      result.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      clearTimeout(searchTimer);
      result.classList.add('hidden');
      result.innerHTML = '';
      const plate = normalizePlate(input.value);
      if (!/^[A-Z0-9]{3,10}$/.test(plate)) {
        showStatus('Ingresa una patente válida de 3 a 10 letras o números.', true);
        input.focus();
        return;
      }
      input.value = plate;
      button.disabled = true;
      button.querySelector('span').textContent = 'Buscando...';
      showStatus('Buscando patente...');
      searchTimer = setTimeout(() => {
        data = loadData();
        const vehicle = data.vehicles.find((item) => normalizePlate(item.plate) === plate);
        const record = vehicle ? latestService(vehicle.id) : null;
        button.disabled = false;
        button.querySelector('span').textContent = 'Consultar';
        if (!vehicle) showStatus('No encontramos esa patente. Verifica los caracteres e inténtalo de nuevo.', true);
        else if (!record) showStatus('Encontramos el vehículo, pero todavía no tiene servicios registrados.', true);
        else { showStatus('Patente encontrada. Aquí está el último servicio.'); renderResult(vehicle, record); }
      }, 350);
    });

    sample.addEventListener('click', () => { input.value = 'PTJ123'; input.focus(); });
  }

  function initAdmin() {
    const loginScreen = $('#login-screen');
    const adminApp = $('#admin-app');
    const notice = $('#admin-notice');
    const vehicleForm = $('#vehicle-form');
    const serviceForm = $('#service-form');
    const vehicleSelect = $('#service-vehicle');
    const serviceDate = $('#service-date');
    const serviceKm = $('#service-km');
    const serviceOil = $('#service-oil');

    function showApp(open) {
      loginScreen.classList.toggle('hidden', open);
      adminApp.classList.toggle('hidden', !open);
      if (open) renderAdmin();
    }

    function showNotice(message, kind = 'success') {
      notice.textContent = message;
      notice.className = `mt-7 rounded-xl border px-5 py-4 text-sm font-semibold ${kind === 'success' ? 'border-lime/40 bg-lime/10 text-lime' : 'border-[#ffab91]/40 bg-[#ffab91]/10 text-[#ffab91]'}`;
      notice.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function renderStats() {
      $('#stat-vehicles').textContent = String(data.vehicles.length);
      $('#stat-services').textContent = String(data.serviceRecords.length);
      const mostRecent = [...data.serviceRecords].sort((a, b) => b.date.localeCompare(a.date))[0];
      $('#stat-latest').textContent = mostRecent ? formatDate(mostRecent.date) : '—';
    }

    function renderVehicleOptions() {
      const selected = vehicleSelect.value;
      vehicleSelect.innerHTML = '<option value="">Selecciona una patente</option>' + [...data.vehicles]
        .sort((a, b) => a.plate.localeCompare(b.plate))
        .map((vehicle) => `<option value="${escapeHtml(vehicle.id)}">${escapeHtml(vehicle.plate)} · ${escapeHtml(vehicle.brand)} ${escapeHtml(vehicle.model)}</option>`).join('');
      if (data.vehicles.some((vehicle) => vehicle.id === selected)) vehicleSelect.value = selected;
    }

    function renderHistory() {
      const records = [...data.serviceRecords].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
      $('#history-empty').classList.toggle('hidden', records.length > 0);
      $('#history-desktop').innerHTML = records.map((record) => {
        const vehicle = data.vehicles.find((item) => item.id === record.vehicleId);
        const filters = [record.filterOil && 'Aceite', record.filterAir && 'Aire'].filter(Boolean).join(' + ') || 'Ninguno';
        return `<tr><td class="whitespace-nowrap px-6 py-5 text-white/70">${escapeHtml(formatDate(record.date))}</td><td class="px-6 py-5"><span class="block font-display font-bold">${escapeHtml(vehicle?.plate || 'Vehículo eliminado')}</span><span class="text-white/45">${escapeHtml(vehicle ? `${vehicle.brand} ${vehicle.model}` : '')}</span></td><td class="whitespace-nowrap px-6 py-5">${escapeHtml(formatKm(record.currentKm))}</td><td class="px-6 py-5"><span class="block">${escapeHtml(OIL_TYPES[record.oilType]?.label || '—')}</span><span class="text-white/45">Filtros: ${escapeHtml(filters)}</span></td><td class="px-6 py-5"><span class="block font-bold text-lime">${escapeHtml(formatKm(record.nextServiceKm))}</span><span class="text-white/45">${escapeHtml(formatDate(record.nextServiceDate))}</span></td></tr>`;
      }).join('');
      $('#history-mobile').innerHTML = records.map((record) => {
        const vehicle = data.vehicles.find((item) => item.id === record.vehicleId);
        const filters = [record.filterOil && 'Aceite', record.filterAir && 'Aire'].filter(Boolean).join(' + ') || 'Ninguno';
        return `<article class="p-5"><div class="flex items-start justify-between gap-3"><div><p class="font-display text-lg font-bold">${escapeHtml(vehicle?.plate || 'Vehículo eliminado')}</p><p class="text-sm text-white/45">${escapeHtml(vehicle ? `${vehicle.brand} ${vehicle.model}` : '')}</p></div><span class="text-right text-xs text-white/45">${escapeHtml(formatDate(record.date))}</span></div><div class="mt-5 grid grid-cols-2 gap-4 text-sm"><div><p class="text-white/45">Km actual</p><p class="mt-1 font-semibold">${escapeHtml(formatKm(record.currentKm))}</p></div><div><p class="text-white/45">Aceite / filtros</p><p class="mt-1 font-semibold">${escapeHtml(OIL_TYPES[record.oilType]?.label || '—')} · ${escapeHtml(filters)}</p></div></div><div class="mt-5 rounded-xl bg-lime/10 p-4"><p class="text-xs uppercase tracking-wider text-lime">Próximo cambio</p><p class="mt-1 font-display text-lg font-bold text-lime">${escapeHtml(formatKm(record.nextServiceKm))}</p><p class="text-sm text-white/55">${escapeHtml(formatDate(record.nextServiceDate))}</p></div></article>`;
      }).join('');
    }

    function updatePreview() {
      const km = Number(serviceKm.value);
      const oil = OIL_TYPES[serviceOil.value];
      $('#preview-km').textContent = serviceKm.value !== '' && Number.isSafeInteger(km) && km >= 0 && oil ? formatKm(km + oil.interval) : '—';
      $('#preview-date').textContent = validIsoDate(serviceDate.value) ? formatDate(addSixMonths(serviceDate.value)) : '—';
    }

    function renderAdmin() { renderStats(); renderVehicleOptions(); renderHistory(); updatePreview(); }

    $('#demo-login').addEventListener('click', () => {
      try { sessionStorage.setItem(ACCESS_KEY, '1'); } catch (error) { console.warn('La sesión demo no pudo persistir.', error); }
      showApp(true);
    });
    $('#demo-logout').addEventListener('click', () => {
      try { sessionStorage.removeItem(ACCESS_KEY); } catch (error) { console.warn('La sesión demo no pudo cerrarse en el almacenamiento.', error); }
      showApp(false);
      $('#demo-login').focus();
    });

    vehicleForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!vehicleForm.reportValidity()) return;
      const form = new FormData(vehicleForm);
      const plate = normalizePlate(form.get('plate'));
      const year = Number(form.get('year'));
      if (!/^[A-Z0-9]{3,10}$/.test(plate)) { showNotice('La patente debe tener entre 3 y 10 letras o números.', 'error'); $('#vehicle-plate').focus(); return; }
      if (data.vehicles.some((vehicle) => normalizePlate(vehicle.plate) === plate)) { showNotice('Esa patente ya está registrada.', 'error'); $('#vehicle-plate').focus(); return; }
      if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) { showNotice('Revisa el año del vehículo.', 'error'); $('#vehicle-year').focus(); return; }
      const vehicle = { id: id(), plate, brand: String(form.get('brand')).trim(), model: String(form.get('model')).trim(), year, customerName: String(form.get('customer')).trim(), phone: String(form.get('phone')).trim() };
      if (!vehicle.brand || !vehicle.model || !vehicle.customerName) { showNotice('Completa la marca, el modelo y el nombre del cliente.', 'error'); return; }
      if (!saveData({ ...data, vehicles: [...data.vehicles, vehicle] })) { showNotice('No se pudo guardar. Revisa que el almacenamiento del navegador esté disponible.', 'error'); return; }
      vehicleForm.reset();
      renderAdmin();
      vehicleSelect.value = vehicle.id;
      showNotice(`Vehículo ${plate} guardado. Ya puedes registrar su servicio.`);
    });

    serviceForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!serviceForm.reportValidity()) return;
      const vehicleId = vehicleSelect.value;
      const vehicle = data.vehicles.find((item) => item.id === vehicleId);
      const date = serviceDate.value;
      const km = Number(serviceKm.value);
      const oilType = serviceOil.value;
      if (!vehicle || !validIsoDate(date) || !Number.isSafeInteger(km) || km < 0 || !OIL_TYPES[oilType]) { showNotice('Revisa el vehículo, la fecha, el kilometraje y el tipo de aceite.', 'error'); return; }
      const previous = latestService(vehicleId);
      if (previous && (date < previous.date || km < previous.currentKm)) { showNotice(`El nuevo servicio debe tener una fecha y un kilometraje iguales o posteriores al último registro de ${vehicle.plate}.`, 'error'); return; }
      const record = { id: id(), vehicleId, date, currentKm: km, oilType, filterOil: $('#filter-oil').checked, filterAir: $('#filter-air').checked, nextServiceKm: km + OIL_TYPES[oilType].interval, nextServiceDate: addSixMonths(date) };
      if (!saveData({ ...data, serviceRecords: [...data.serviceRecords, record] })) { showNotice('No se pudo guardar. Revisa que el almacenamiento del navegador esté disponible.', 'error'); return; }
      serviceForm.reset();
      serviceDate.value = todayIso();
      renderAdmin();
      showNotice(`Servicio de ${vehicle.plate} guardado. Próximo cambio: ${formatKm(record.nextServiceKm)} o ${formatDate(record.nextServiceDate)}.`);
    });

    [serviceDate, serviceKm, serviceOil].forEach((element) => element.addEventListener('input', updatePreview));
    vehicleSelect.addEventListener('change', () => {
      const previous = latestService(vehicleSelect.value);
      serviceKm.placeholder = previous ? `Último: ${formatKm(previous.currentKm)}` : 'Ej. 42000';
    });
    serviceDate.value = todayIso();
    let hasSession = false;
    try { hasSession = sessionStorage.getItem(ACCESS_KEY) === '1'; } catch (error) { console.warn('La sesión demo no está disponible.', error); }
    showApp(hasSession);
  }

  if (document.body.dataset.page === 'public') initPublic();
  if (document.body.dataset.page === 'admin') initAdmin();
})();
