(() => {
  'use strict';

  const config = globalThis.PTJ_CONFIG || {};
  const configured = Boolean(config.supabaseUrl && config.supabasePublishableKey && globalThis.supabase?.createClient);
  const db = configured ? globalThis.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey) : null;
  const OIL_TYPES = {
    mineral: { label: 'Mineral', interval: 5000 },
    semisintetico: { label: 'Semisintético', interval: 7500 },
    sintetico: { label: 'Sintético', interval: 10000 }
  };
  const $ = (selector) => document.querySelector(selector);
  const normalizePlate = (value) => String(value || '').toUpperCase().replace(/[\s-]/g, '');
  // Automóviles argentinos: formato anterior ABC123 y formato Mercosur AA123AA.
  const validCarPlate = (value) => /^(?:[A-Z]{3}[0-9]{3}|[A-Z]{2}[0-9]{3}[A-Z]{2})$/.test(value);
  const validCustomerName = (value) => /^[\p{L}\p{M}]+(?:[ '\-][\p{L}\p{M}]+)*$/u.test(value) && value.length >= 2 && value.length <= 80;
  const validPhone = (value) => value === '' || (/^\+?[0-9][0-9 ()-]*$/.test(value) && (value.match(/[0-9]/g) || []).length >= 8 && (value.match(/[0-9]/g) || []).length <= 15);
  const formatKm = (value) => `${new Intl.NumberFormat('es-AR').format(value)} km`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const validIsoDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const formatDate = (value) => validIsoDate(value)
    ? new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
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
  let data = { vehicles: [], serviceRecords: [] };
  const mapVehicle = (row) => ({ id: row.id, plate: row.plate, brand: row.brand, model: row.model, year: row.year, customerName: row.customer_name, phone: row.phone });
  const mapService = (row) => ({ id: row.id, vehicleId: row.vehicle_id, date: row.service_date, currentKm: row.current_km, oilType: row.oil_type, filterOil: row.filter_oil, filterAir: row.filter_air, nextServiceKm: row.next_service_km, nextServiceDate: row.next_service_date });

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

    if (!db) {
      button.disabled = true;
      showStatus('La consulta aún no está configurada. Contacta al taller.', true);
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!db) return;
      result.classList.add('hidden');
      result.innerHTML = '';
      const plate = normalizePlate(input.value);
      if (!validCarPlate(plate)) {
        showStatus('Ingresa una patente de auto argentina: ABC123 o AA123AA.', true);
        input.focus();
        return;
      }
      input.value = plate;
      button.disabled = true;
      button.querySelector('span').textContent = 'Buscando...';
      showStatus('Buscando patente...');
      try {
        const { data: found, error } = await db.rpc('lookup_vehicle', { lookup_plate: plate });
        if (error) throw error;
        const vehicle = found?.vehicle;
        const record = found?.service;
        if (!vehicle) showStatus('No encontramos esa patente. Verifica los caracteres e inténtalo de nuevo.', true);
        else if (!record) showStatus('Encontramos el vehículo, pero todavía no tiene servicios registrados.', true);
        else { showStatus('Patente encontrada. Aquí está el último servicio.'); renderResult(vehicle, record); }
      } catch (error) {
        console.error('Error al consultar la patente.', error);
        showStatus('No se pudo completar la consulta. Inténtalo de nuevo.', true);
      } finally {
        button.disabled = false;
        button.querySelector('span').textContent = 'Consultar';
      }
    });
    input.addEventListener('input', () => { input.value = normalizePlate(input.value); });
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
    const loginForm = $('#login-form');
    const loginStatus = $('#login-status');
    const loginButton = $('#login-button');
    const plateInput = $('#vehicle-plate');
    const nameInput = $('#customer-name');
    const phoneInput = $('#customer-phone');

    plateInput.addEventListener('input', () => {
      plateInput.value = normalizePlate(plateInput.value);
      plateInput.setCustomValidity(plateInput.value && !validCarPlate(plateInput.value) ? 'Usa una patente de auto argentina: ABC123 o AA123AA.' : '');
    });
    nameInput.addEventListener('input', () => {
      nameInput.value = nameInput.value.replace(/[^\p{L}\p{M} '\-]/gu, '');
      nameInput.setCustomValidity(nameInput.value && !validCustomerName(nameInput.value.trim()) ? 'Escribe un nombre de al menos 2 letras, sin números.' : '');
    });
    phoneInput.addEventListener('input', () => {
      phoneInput.value = phoneInput.value.replace(/[^0-9+ ()-]/g, '');
      phoneInput.setCustomValidity(validPhone(phoneInput.value.trim()) ? '' : 'Escribe un teléfono de 8 a 15 dígitos, sin letras.');
    });

    function showLoginStatus(message) {
      loginStatus.textContent = message;
      loginStatus.classList.toggle('hidden', !message);
    }

    async function loadAdminData() {
      const [vehicles, services] = await Promise.all([
        db.from('vehicles').select('*').order('plate'),
        db.from('service_records').select('*').order('service_date', { ascending: false })
      ]);
      if (vehicles.error || services.error) throw vehicles.error || services.error;
      data = { vehicles: vehicles.data.map(mapVehicle), serviceRecords: services.data.map(mapService) };
    }

    async function openForAdmin(user) {
      if (!user) return false;
      const { data: admin, error } = await db.from('admin_users').select('id').eq('id', user.id).maybeSingle();
      if (error) throw error;
      if (!admin) return false;
      await loadAdminData();
      showApp(true);
      return true;
    }

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

    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!db || !loginForm.reportValidity()) return;
      loginButton.disabled = true;
      loginButton.textContent = 'Ingresando...';
      showLoginStatus('');
      try {
        const { data: signedIn, error } = await db.auth.signInWithPassword({ email: $('#login-email').value.trim(), password: $('#login-password').value });
        if (error) throw error;
        if (!await openForAdmin(signedIn.user)) {
          await db.auth.signOut();
          showLoginStatus('Esta cuenta no tiene acceso al panel administrativo.');
        } else {
          $('#login-password').value = '';
        }
      } catch (error) {
        console.error('Error al iniciar sesión.', error);
        showLoginStatus('No se pudo iniciar sesión. Revisa los datos o inténtalo de nuevo.');
      } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'Iniciar sesión';
      }
    });
    $('#admin-logout').addEventListener('click', async () => {
      const { error } = await db.auth.signOut();
      if (error) { showNotice('No se pudo cerrar la sesión. Inténtalo de nuevo.', 'error'); return; }
      data = { vehicles: [], serviceRecords: [] };
      showApp(false);
      $('#login-email').focus();
    });

    vehicleForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!vehicleForm.reportValidity()) return;
      const form = new FormData(vehicleForm);
      const plate = normalizePlate(form.get('plate'));
      const year = Number(form.get('year'));
      if (!validCarPlate(plate)) { showNotice('La patente debe tener formato argentino ABC123 o AA123AA.', 'error'); plateInput.focus(); return; }
      if (data.vehicles.some((vehicle) => normalizePlate(vehicle.plate) === plate)) { showNotice('Esa patente ya está registrada.', 'error'); $('#vehicle-plate').focus(); return; }
      if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1) { showNotice('Revisa el año del vehículo.', 'error'); $('#vehicle-year').focus(); return; }
      const vehicle = { plate, brand: String(form.get('brand')).trim(), model: String(form.get('model')).trim(), year, customer_name: String(form.get('customer')).trim().normalize('NFC'), phone: String(form.get('phone')).trim() };
      if (!vehicle.brand || !vehicle.model || !validCustomerName(vehicle.customer_name)) { showNotice('Revisa la marca, el modelo y el nombre del cliente. El nombre solo puede contener letras.', 'error'); return; }
      if (!validPhone(vehicle.phone)) { showNotice('El teléfono debe tener entre 8 y 15 dígitos y no contener letras.', 'error'); phoneInput.focus(); return; }
      const submit = vehicleForm.querySelector('[type="submit"]');
      submit.disabled = true;
      let saved;
      try {
        const response = await db.from('vehicles').insert(vehicle).select().single();
        if (response.error) throw response.error;
        saved = response.data;
      } catch (error) {
        console.error('Error al guardar el vehículo.', error);
        showNotice(error.code === '23505' ? 'Esa patente ya está registrada.' : 'No se pudo guardar el vehículo. Inténtalo de nuevo.', 'error');
        return;
      } finally {
        submit.disabled = false;
      }
      data.vehicles.push(mapVehicle(saved));
      vehicleForm.reset();
      [plateInput, nameInput, phoneInput].forEach((input) => input.setCustomValidity(''));
      renderAdmin();
      vehicleSelect.value = saved.id;
      showNotice(`Vehículo ${plate} guardado. Ya puedes registrar su servicio.`);
    });

    serviceForm.addEventListener('submit', async (event) => {
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
      const record = { vehicle_id: vehicleId, service_date: date, current_km: km, oil_type: oilType, filter_oil: $('#filter-oil').checked, filter_air: $('#filter-air').checked, next_service_km: km + OIL_TYPES[oilType].interval, next_service_date: addSixMonths(date) };
      const submit = serviceForm.querySelector('[type="submit"]');
      submit.disabled = true;
      let saved;
      try {
        const response = await db.from('service_records').insert(record).select().single();
        if (response.error) throw response.error;
        saved = response.data;
      } catch (error) {
        console.error('Error al guardar el servicio.', error);
        showNotice('No se pudo guardar el servicio. Inténtalo de nuevo.', 'error');
        return;
      } finally {
        submit.disabled = false;
      }
      data.serviceRecords.push(mapService(saved));
      serviceForm.reset();
      serviceDate.value = todayIso();
      renderAdmin();
      showNotice(`Servicio de ${vehicle.plate} guardado. Próximo cambio: ${formatKm(record.next_service_km)} o ${formatDate(record.next_service_date)}.`);
    });

    [serviceDate, serviceKm, serviceOil].forEach((element) => element.addEventListener('input', updatePreview));
    vehicleSelect.addEventListener('change', () => {
      const previous = latestService(vehicleSelect.value);
      serviceKm.placeholder = previous ? `Último: ${formatKm(previous.currentKm)}` : 'Ej. 42000';
    });
    serviceDate.value = todayIso();
    $('#vehicle-year').max = String(new Date().getFullYear() + 1);
    showApp(false);
    if (!db) {
      loginButton.disabled = true;
      showLoginStatus('El panel aún no está configurado. Falta conectar Supabase.');
      return;
    }
    db.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') showApp(false);
    });
    db.auth.getUser().then(async ({ data: session, error }) => {
      if (error || !session.user) return;
      try {
        if (!await openForAdmin(session.user)) await db.auth.signOut();
      } catch (loadError) {
        console.error('Error al cargar el panel.', loadError);
        showLoginStatus('No se pudo cargar el panel. Inténtalo de nuevo.');
      }
    });
  }

  if (document.body.dataset.page === 'public') initPublic();
  if (document.body.dataset.page === 'admin') initAdmin();
})();
