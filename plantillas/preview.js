(function (root) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Icono de reloj reutilizable
  function clockIcon(haciaDerecha) {
    return '<svg class="clock-icon" viewBox="0 0 36 36" fill="none">' +
      '<circle cx="18" cy="18" r="16" stroke="#B0B7C0" stroke-width="2" stroke-dasharray="2 2"/>' +
      '<circle cx="18" cy="18" r="14" stroke="#8E99A8" stroke-width="1.5"/>' +
      '<path d="M18 9V18L' + (haciaDerecha ? '23 21' : '13 22') + '" stroke="#667085" stroke-width="2" stroke-linecap="round"/>' +
      '</svg>';
  }

  function avionIcon(espejado) {
    var flip = espejado ? ' style="transform: scaleX(-1);"' : '';
    return '<img src="assets/img/Avion Holy.png" alt="Avión Holy" class="h-12 w-auto"' + flip + '>';
  }

  function flechaEntrada() {
    return '<svg class="w-6 h-6 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>';
  }

  function flechaSalida() {
    return '<svg class="w-6 h-6 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>';
  }

  // ---- Grilla de fotos según layoutFotos (§5) ----
  function gridStyle(layout) {
    switch (Number(layout)) {
      case 1: return 'grid-template-columns: 1fr;';
      case 2: return 'grid-template-columns: 1fr 1fr;';
      case 3: return 'grid-template-columns: 2fr 1fr; grid-template-rows: 1fr 1fr;';
      case 4: return 'grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;';
      default: return 'grid-template-columns: 1fr;';
    }
  }

  function celdaFoto(imgSrc) {
    if (imgSrc) {
      return '<img src="' + esc(imgSrc) + '" alt="Foto posada" class="w-full h-full object-cover">';
    }
    return '<div class="w-full h-full flex items-center justify-center text-slate-900">' +
      '<svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.5-4.5L11 14l4-4 5 5M5 20h14a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v14a1 1 0 001 1z"></path></svg></div>';
  }

  function renderPhotoGrid(images, layout) {
    var n = Number(layout) || 1;
    var list = images || [];
    var html = '<div class="grid gap-4 mt-4" style="' + gridStyle(n) + '">';
    for (var i = 0; i < n; i++) {
      var big = n === 3 && i === 0;
      html += '<div class="rounded-xl overflow-hidden shadow-sm border border-gray-100 relative ' +
        (n === 1 ? 'h-72' : 'h-56') + '"' +
        (big ? ' style="grid-row: span 2;"' : '') + '>' +
        celdaFoto(list[i] || '') + '</div>';
    }
    html += '</div>';
    return html;
  }

  // ---- PÁGINA 1 ----
  function renderPage1(t, q) {
    var v = q.vuelo;
    return '' +
      '<div id="page1" class="page-sheet px-12 pt-12 flex flex-col justify-between">' +
      '<div class="flex-1 flex flex-col justify-between">' +
      // Encabezado
      '<div class="flex justify-between items-start">' +
      '<div class="flex items-start gap-4">' +
      '<div class="w-16 h-16 bg-holyPurple rounded-2xl flex items-center justify-center shrink-0 shadow-md overflow-hidden">' +
      '<img src="assets/img/Logo Holy.png" alt="Logo Holy" class="w-full h-full object-cover"></div>' +
      '<div class="pt-0.5">' +
      '<h1 class="text-holyPurple font-extrabold text-[15px] tracking-wide leading-tight uppercase">COTIZACIÓN PAQUETE TURÍSTICO</h1>' +
      '<p class="text-holyPurple font-bold text-[14px] leading-tight uppercase mt-0.5">TIPO: ' + esc(q.tipoPaquete) + '</p>' +
      '<div class="flex items-center gap-1.5 mt-0.5">' +
      '<span class="text-holyPurple font-bold text-[13px] uppercase">' + esc(q.estado) + '</span>' +
      '<svg class="w-4 h-4 text-holyMintBright stroke-[3.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg></div>' +
      '<p class="text-holyGray font-semibold text-[13px] mt-1">FECHA DE COTIZACIÓN: <span class="text-black font-bold">' +
      esc(q.fechaCotizacion) + '</span></p>' +
      '</div></div>' +
      '<div class="flex items-start pt-1"><img src="assets/img/ViajesHoly logo2.png" alt="Viajes Holy" class="h-20 w-auto"></div>' +
      '</div>' +
      // Aéreo
      '<div>' +
      '<div class="flex items-baseline gap-2 mb-1">' +
      '<span class="text-holyPurple font-extrabold text-[15px] uppercase">AÉREO:</span>' +
      '<span class="text-holyGray font-medium text-[15px] uppercase">' + esc(v.aerolinea) + '</span></div>' +
      '<div class="w-full h-[1.5px] bg-holyLine mb-6"></div>' +
      '<div class="grid grid-cols-12 gap-2 items-center">' +
      '<div class="col-span-8 space-y-7">' +
      '<!-- IDA -->' +
      '<div class="flex items-center text-[13px]">' +
      '<div class="w-10 h-10 shrink-0 mr-4 flex items-center justify-center">' + avionIcon(false) + '</div>' +
      '<div class="w-24 shrink-0"><span class="text-holyPurple font-extrabold text-[14px] tracking-wide">IDA</span></div>' +
      '<div class="w-32 shrink-0"><p class="text-holyPurple font-black leading-snug text-[13px]">' + esc(v.ida.origen) + '</p>' +
      '<p class="text-holyPurple font-black leading-snug text-[13px]">' + esc(v.ida.destino) + '</p></div>' +
      '<div class="w-12 shrink-0 flex justify-center">' + clockIcon(true) + '</div>' +
      '<div class="pl-4"><p class="text-holyPurple font-bold text-[13px]">' + esc(v.ida.fecha) + '</p>' +
      '<p class="text-holyGray font-semibold text-[12px]">SALIDA: ' + esc(v.ida.salida) + '</p>' +
      '<p class="text-holyGray font-semibold text-[12px]">LLEGADA: ' + esc(v.ida.llegada) + '</p></div>' +
      '</div>' +
      '<!-- RETORNO -->' +
      '<div class="flex items-center text-[13px]">' +
      '<div class="w-10 h-10 shrink-0 mr-4 flex items-center justify-center">' + avionIcon(true) + '</div>' +
      '<div class="w-24 shrink-0"><span class="text-holyPurple font-extrabold text-[14px] tracking-wide">RETORNO</span></div>' +
      '<div class="w-32 shrink-0"><p class="text-holyPurple font-black leading-snug text-[13px]">' + esc(v.retorno.origen) + '</p>' +
      '<p class="text-holyPurple font-black leading-snug text-[13px]">' + esc(v.retorno.destino) + '</p></div>' +
      '<div class="w-12 shrink-0 flex justify-center">' + clockIcon(false) + '</div>' +
      '<div class="pl-4"><p class="text-holyPurple font-bold text-[13px]">' + esc(v.retorno.fecha) + '</p>' +
      '<p class="text-holyGray font-semibold text-[12px]">SALIDA: ' + esc(v.retorno.salida) + '</p>' +
      '<p class="text-holyGray font-semibold text-[12px]">LLEGADA: ' + esc(v.retorno.llegada) + '</p></div>' +
      '</div>' +
      '</div>' +
      '<div class="col-span-4 flex justify-end pr-2">' +
      '<div class="w-48 h-44 relative flex items-center justify-center">' +
      '<img src="assets/img/Asientos.png" alt="Asientos Ejecutivos" class="w-full h-full object-cover rounded-xl shadow-md border border-gray-100"></div>' +
      '</div></div></div>' +
      // Posada
      '<div>' +
      '<div class="flex items-baseline gap-2 mb-1">' +
      '<span class="text-holyPurple font-extrabold text-[15px] uppercase">POSADA:</span>' +
      '<span class="text-holyGray font-medium text-[15px] uppercase">' + esc(t.nombrePosada) + '</span></div>' +
      '<div class="w-full h-[1.5px] bg-holyLine mb-6"></div>' +
      '<div class="space-y-5">' +
      '<div class="grid grid-cols-12 items-center text-[13px]">' +
      '<div class="col-span-1"><div class="w-10 h-10 bg-holyMintBright rounded-full flex items-center justify-center text-white shadow">' + flechaEntrada() + '</div></div>' +
      '<div class="col-span-2 pl-2"><span class="text-holyGray font-bold text-[13px]">CHECK <span class="font-extrabold text-black">IN</span></span></div>' +
      '<div class="col-span-3"><p class="text-holyPurple font-black text-[13px]">FECHA DE ENTRADA</p></div>' +
      '<div class="col-span-3"><p class="text-holyGray font-semibold text-[13px]">' + esc(q.hospedaje.checkIn) + '</p></div>' +
      '<div class="col-span-3 flex justify-start pl-4 flex items-center gap-2">' + clockIcon(true) + '<span class="text-holyGray font-bold text-[13px]">' + esc(q.hospedaje.checkInHora) + '</span></div></div>' +
      '<div class="grid grid-cols-12 items-center text-[13px]">' +
      '<div class="col-span-1"><div class="w-10 h-10 bg-holyMintBright rounded-full flex items-center justify-center text-white shadow">' + flechaSalida() + '</div></div>' +
      '<div class="col-span-2 pl-2"><span class="text-holyGray font-bold text-[13px]">CHECK <span class="font-extrabold text-black">OUT</span></span></div>' +
      '<div class="col-span-3"><p class="text-holyPurple font-black text-[13px]">FECHA DE SALIDA</p></div>' +
      '<div class="col-span-3"><p class="text-holyGray font-semibold text-[13px]">' + esc(q.hospedaje.checkOut) + '</p></div>' +
      '<div class="col-span-3 flex justify-start pl-4 flex items-center gap-2">' + clockIcon(true) + '<span class="text-holyGray font-bold text-[13px]">' + esc(q.hospedaje.checkOutHora) + '</span></div></div>' +
      '</div></div>' +
      '<div class="w-full h-[1.5px] bg-holyLine mt-6 mb-6"></div>' +
      '<div class="grid grid-cols-12 items-start mb-6">' +
      '<div class="col-span-6 text-[14px]">' +
      '<span class="text-holyPurple font-extrabold">ADULTOS</span> <span class="text-holyPurple font-bold ml-1">' + q.pasajeros.adultos + '</span>' +
      '<span class="text-holyPurple font-black mx-2">-</span>' +
      '<span class="text-holyPurple font-extrabold">NIÑOS</span> <span class="text-holyPurple font-bold ml-1">' + q.pasajeros.ninos + '</span>' +
      '<span class="text-holyPurple font-black mx-2">-</span>' +
      '<span class="text-holyPurple font-extrabold">INFANTES</span> <span class="text-holyPurple font-bold ml-1">' + q.pasajeros.infantes + '</span>' +
      '</div>' +
      '<div class="col-span-6 text-[13px]">' +
      '<p class="text-holyPurple font-extrabold uppercase inline">SERVICIO </p>' +
      '<p class="text-holyGray font-semibold uppercase inline">' + esc(t.tipoServicioDefault) + '</p>' +
      '</div></div>' +
      '<div class="mt-auto">' +
      '<div class="flex flex-col items-end text-right pr-2 space-y-3 mb-10">' +
      '<div class="flex items-center gap-6 text-[13px]">' +
      '<span class="text-holyGray font-bold uppercase tracking-wider">TARIFA POR ADULTO</span>' +
      '<span class="text-holyGray font-semibold">' + esc(root.Monext.formatMoney(q.tarifas.tarifaPorAdulto, q.tarifas.moneda)) + '</span></div>' +
      '<div class="flex items-center gap-6 text-[13px]">' +
      '<span class="text-holyGray font-bold uppercase tracking-wider">TARIFA POR NIÑO</span>' +
      '<span class="text-holyGray font-semibold">' + esc(root.Monext.formatMoney(q.tarifas.tarifaPorNino, q.tarifas.moneda)) + '</span></div>' +
      '<div class="flex items-center gap-4">' +
      '<div class="flex flex-row items-center justify-end gap-1.5">' +
      '<span class="text-holyPurple font-extrabold text-[12px] uppercase tracking-wide">TOTAL ' + q.pasajeros.adultos + ' ADT</span>' +
      '<span class="text-holyPurple font-extrabold text-[12px] uppercase tracking-wide">- ' + q.pasajeros.ninos + ' CHD</span>' +
      '<span class="text-holyPurple font-extrabold text-[12px] uppercase tracking-wide">- ' + q.pasajeros.infantes + ' INF</span>' +
      '</div>' +
      '<div class="bg-holyPurple text-white px-7 py-3 rounded-xl shadow-md">' +
      '<span class="font-extrabold text-2xl font-poppins">' + esc(root.Monext.formatMoney(q.tarifas.montoTotal, q.tarifas.moneda)) + '</span></div>' +
      '</div></div>' +
      '</div>' +
      '</div>' +
      banderaNoIncluye() +
      '</div>';
  }

  // ---- PÁGINA 2 ----
  function renderPage2(t, q) {
    var incs = (q && q.inclusiones && q.inclusiones.length > 0) ? q.inclusiones : t.inclusiones;
    var items = incs.map(function (inc) {
      return '<li class="flex items-start gap-2.5"><span class="text-holyPurple text-base leading-none font-bold">•</span>' +
        '<span>' + esc(inc) + '</span></li>';
    }).join('');

    return '' +
      '<div id="page2" class="page-sheet p-12 flex flex-col justify-between">' +
      '<div>' +
      '<div class="flex items-start gap-3 mb-8">' +
      '<div class="w-1.5 h-12 bg-holyPurple rounded-full shrink-0 mt-0.5"></div>' +
      '<div>' +
      '<div class="flex items-baseline gap-2 flex-wrap">' +
      '<h2 class="text-holyPurple font-black text-lg tracking-wide uppercase">PAQUETE ' + esc(t.tipoServicioDefault) + '</h2>' +
      '<span class="text-holyGray font-semibold text-sm">' + q.hospedaje.dias + ' DÍAS / ' + q.hospedaje.noches + ' NOCHES</span>' +
      '</div>' +
      '<p class="text-holyGray font-bold text-base uppercase">' + esc(t.destino) + ' - <span class="text-holyPurple font-black">' + esc(t.nombrePosada) + '</span></p>' +
      '</div></div>' +
      '<div class="pl-3 mb-8">' +
      '<ul class="space-y-2 text-[13px] text-holyGray font-semibold">' + items + '</ul>' +
      '</div>' +
      renderPhotoGrid(t.imagenesBase64, t.layoutFotos) +
      '</div>' +
      '<div class="text-center pt-4 border-t border-gray-100">' +
      '<span class="text-[11px] text-slate-800 font-semibold tracking-wider uppercase">' + esc(t.nombrePosada) + ' - ' + esc(t.destino) + '</span></div>' +
      '</div>';
  }

  // Foto de portada de la plantilla (o la primera de la galería)
  function fotoPortadaDe(t) {
    return (t && t.fotoPortada) || (t && t.imagenesBase64 && t.imagenesBase64[0]) || '';
  }

  function banderaNoIncluye() {
    return '<div class="w-full bg-holyPurple text-white text-center py-4 rounded-b-2xl shadow-sm" style="width: calc(100% + 6rem); margin-left: -3rem; margin-right: -3rem;">' +
      '<p class="font-bold text-[14px] tracking-wider uppercase">NO INCLUYE IMPUESTO DE ENTRADA AL PARQUE</p></div>';
  }

  // ---- PRESENTACIÓN DE PLANTILLA (sin datos de boletos ni precios) ----
  function buildTemplate(t) {
    t = (t && typeof t === 'object') ? t : {};
    var items = (t.inclusiones || []).map(function (inc) {
      return '<li class="flex items-start gap-2.5"><span class="text-holyPurple text-base leading-none font-bold">•</span>' +
        '<span>' + esc(inc) + '</span></li>';
    }).join('');

    var page1 = '' +
      '<div id="page1" class="page-sheet px-12 pt-12 flex flex-col justify-between">' +
      '<div class="flex-1 flex flex-col justify-between">' +
      '<div>' +
      '<div class="flex items-start gap-3 mb-6">' +
      '<div class="w-1.5 h-12 bg-holyPurple rounded-full shrink-0 mt-0.5"></div>' +
      '<div>' +
      '<h2 class="text-holyPurple font-black text-lg tracking-wide uppercase">PAQUETE ' + esc(t.tipoServicioDefault) + '</h2>' +
      '<p class="text-holyGray font-bold text-base uppercase">' + esc(t.destino) + ' - <span class="text-holyPurple font-black">' + esc(t.nombrePosada) + '</span></p>' +
      '</div></div>' +
      '<div class="rounded-2xl overflow-hidden shadow-md border border-gray-100 mb-6 flex-1 relative">' + celdaFoto(fotoPortadaDe(t)) + '</div>' +
      '</div>' +
      '<div class="border-t border-gray-100 pt-5 mb-8">' +
      '<p class="text-holyPurple font-extrabold text-sm uppercase tracking-wide mb-3">INCLUYE</p>' +
      '<ul class="space-y-2 text-[13px] text-holyGray font-semibold">' + items + '</ul>' +
      '</div>' +
      '</div>' +
      banderaNoIncluye() +
      '</div>';

    var page2 = '' +
      '<div id="page2" class="page-sheet p-12 flex flex-col justify-between">' +
      '<div>' +
      '<div class="flex items-start gap-3 mb-8">' +
      '<div class="w-1.5 h-12 bg-holyPurple rounded-full shrink-0 mt-0.5"></div>' +
      '<div>' +
      '<h2 class="text-holyPurple font-black text-lg tracking-wide uppercase">GALERÍA</h2>' +
      '<p class="text-holyGray font-bold text-base uppercase">' + esc(t.destino) + ' - <span class="text-holyPurple font-black">' + esc(t.nombrePosada) + '</span></p>' +
      '</div></div>' +
      renderPhotoGrid(t.imagenesBase64 || [], t.layoutFotos) +
      '</div>' +
      '<div class="text-center pt-4 border-t border-gray-100">' +
      '<span class="text-[11px] text-slate-800 font-semibold tracking-wider uppercase">' + esc(t.nombrePosada) + ' - ' + esc(t.destino) + '</span></div>' +
      '</div>';

    return { page1: page1, page2: page2 };
  }

  function renderSoloHospedajePDF(t, q) {
    // PÁGINA 1
    var page1 = `
      <div id="page1" class="page-sheet page-a4 bg-white flex flex-col relative" style="padding: 0; min-height: 1123px;">
        <div class="px-14 pt-16 flex-1 flex flex-col">
          <!-- Header -->
          <div class="flex justify-between items-start mb-14">
            <div class="flex items-center gap-6">
              <div class="w-[72px] h-[72px] bg-[#560B5B] rounded-full flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="currentColor" class="w-[38px] h-[38px] text-white"><path d="M20 9.557V3h-2v2H6V3H4v6.557C2.81 10.25 2 11.525 2 13v4h2v2h2v-2h12v2h2v-2h2v-4c0-1.475-.81-2.75-2-3.443zM18 7v2h-5V7h5zM6 7h5v2H6V7zm14 8H4v-2c0-1.103.897-2 2-2h12c1.103 0 2 .897 2 2v2z"/></svg>
              </div>
              <div class="flex flex-col justify-center">
                <span class="text-[#64748b] text-[13px] font-bold tracking-widest mb-1">TIPO DE COTIZACIÓN: <span class="font-normal text-[#94a3b8]">HOSPEDAJE</span></span>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-[#64748b] text-[15px] tracking-widest font-normal">CONFIRMADO</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#76D8B1" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" class="w-9 h-9"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <span class="text-[#64748b] text-[13px] tracking-widest font-bold mt-1 uppercase">FECHA DE COTIZACIÓN: <span class="text-black font-extrabold">${esc(q.fechaCotizacion)}</span></span>
              </div>
            </div>
            <div class="pt-2">
              <img src="assets/img/ViajesHoly logo2.png" alt="Viajes Holy" class="h-16 w-auto object-contain" onerror="this.src='assets/img/Logo Holy.png'; this.className='h-12 w-auto'">
            </div>
          </div>

          <!-- Row 1 -->
          <div class="flex justify-between items-end mb-4 px-2 text-center">
            <div class="flex flex-col items-center flex-1">
              <span class="text-[#560B5B] font-black text-[15px] uppercase tracking-wide">HOSPEDAJE:</span>
              <span class="text-[#64748b] text-[13px] uppercase mt-1 tracking-wider">${esc(t.nombrePosada)}</span>
            </div>
            <div class="flex flex-col items-center flex-1">
              <span class="text-[#560B5B] font-black text-[15px] uppercase tracking-wide">CIUDAD:</span>
              <span class="text-[#64748b] text-[13px] uppercase mt-1 tracking-wider">${esc(t.destino)}</span>
            </div>
          </div>

          <div class="w-full h-[1.5px] bg-[#560B5B] mb-10"></div>

          <!-- Row 2 Check In -->
          <div class="flex items-center justify-between mb-8 px-2">
            <div class="flex items-center gap-4 w-1/4">
              <svg viewBox="0 0 24 24" class="w-[50px] h-[50px]"><circle cx="12" cy="12" r="12" fill="#a5f3d5"/><path d="M9 7l6 5-6 5" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span class="text-[#64748b] text-[15px] uppercase tracking-wider">CHECK <span class="font-black text-[#475569]">IN</span></span>
            </div>
            <div class="w-1/4 text-center">
              <span class="text-[#560B5B] font-black text-[15px] uppercase tracking-wide">FECHA DE ENTRADA</span>
            </div>
            <div class="w-1/4 text-center pl-4">
              <span class="text-[#64748b] text-[15px] uppercase tracking-widest">${esc(q.hospedaje.checkIn)}</span>
            </div>
            <div class="w-1/4 flex items-center justify-end gap-4">
              ${clockIcon(true)}
              <span class="text-[#64748b] text-[15px] uppercase tracking-wider">${esc(q.hospedaje.checkInHora)}</span>
            </div>
          </div>

          <!-- Row 3 Check Out -->
          <div class="flex items-center justify-between mb-10 px-2">
            <div class="flex items-center gap-4 w-1/4">
              <svg viewBox="0 0 24 24" class="w-[50px] h-[50px]"><circle cx="12" cy="12" r="12" fill="#a5f3d5"/><path d="M15 7l-6 5 6 5" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span class="text-[#64748b] text-[15px] uppercase tracking-wider">CHECK <span class="font-black text-[#475569]">OUT</span></span>
            </div>
            <div class="w-1/4 text-center">
              <span class="text-[#560B5B] font-black text-[15px] uppercase tracking-wide">FECHA DE SALIDA</span>
            </div>
            <div class="w-1/4 text-center pl-4">
              <span class="text-[#64748b] text-[15px] uppercase tracking-widest">${esc(q.hospedaje.checkOut)}</span>
            </div>
            <div class="w-1/4 flex items-center justify-end gap-4">
              ${clockIcon(false)}
              <span class="text-[#64748b] text-[15px] uppercase tracking-wider">${esc(q.hospedaje.checkOutHora)}</span>
            </div>
          </div>

          <div class="w-full h-[1px] bg-[#560B5B] mb-6"></div>

          <!-- Pasajeros (Estilo Paquete Completo) moved up -->
          <div class="px-6 mb-4">
            <div class="grid grid-cols-12 items-start">
              <div class="col-span-8 text-[14px]">
                <span class="text-holyPurple font-extrabold">ADULTOS</span> <span class="text-holyPurple font-bold ml-1">${q.pasajeros.adultos}</span>
                <span class="text-holyPurple font-black mx-2">-</span>
                <span class="text-holyPurple font-extrabold">NIÑOS</span> <span class="text-holyPurple font-bold ml-1">${q.pasajeros.ninos}</span>
                <span class="text-holyPurple font-black mx-2">-</span>
                <span class="text-holyPurple font-extrabold">INFANTES</span> <span class="text-holyPurple font-bold ml-1">${q.pasajeros.infantes}</span>
              </div>
              <div class="col-span-4 text-[13px]">
                <p class="text-holyPurple font-extrabold uppercase inline">SERVICIO </p>
                <p class="text-holyGray font-semibold uppercase inline">${t.tipoServicioDefault ? esc(t.tipoServicioDefault) : ''}</p>
              </div>
            </div>
          </div>

          <div class="mb-auto"></div>

          <!-- Footer Tarifas (Restaurando el estilo original) -->
          <div class="flex justify-between items-end pb-[70px] px-8">
            <div class="opacity-70 mb-4">
              <img src="assets/img/ViajesHoly logo2.png" alt="Viajes Holy" class="h-16 w-auto object-contain" onerror="this.src='assets/img/Logo Holy.png'; this.className='h-12 w-auto'">
            </div>
            <div class="flex flex-col items-end text-right space-y-3">
              <div class="flex justify-between w-[300px] items-center pr-6">
                <span class="text-holyGray font-bold uppercase tracking-wider">TARIFA POR ADULTO</span>
                <span class="text-[#475569] text-[15px] font-bold">${esc(root.Monext.formatMoney(q.tarifas.tarifaPorAdulto, q.tarifas.moneda))}</span>
              </div>
              <div class="flex justify-between w-[300px] items-center pr-6">
                <span class="text-holyGray font-bold uppercase tracking-wider">TARIFA POR NIÑO</span>
                <span class="text-[#475569] text-[15px] font-bold">${esc(root.Monext.formatMoney(q.tarifas.tarifaPorNino, q.tarifas.moneda))}</span>
              </div>
              <div class="flex justify-between w-[320px] items-center mt-2">
                <span class="text-[#64748b] text-[12px] uppercase tracking-wider pr-4 font-bold">TOTAL ${q.pasajeros.adultos} ADT - ${q.pasajeros.ninos} CHD - ${q.pasajeros.infantes} INF</span>
                <div class="bg-holyPurple text-white px-7 py-3 rounded-xl shadow-md border-b-[4px] border-[#560B5B] min-w-[120px] text-center">
                  <span class="font-extrabold text-2xl font-poppins">${esc(root.Monext.formatMoney(q.tarifas.montoTotal, q.tarifas.moneda))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Big purple rounded box at bottom -->
        <div class="w-full bg-[#800080] rounded-t-[2.5rem] h-[30px] relative z-10"></div>
      </div>
    `;

    // PÁGINA 2
    var incs = (q && q.inclusiones && q.inclusiones.length > 0) ? q.inclusiones : t.inclusiones;
    var listaInclusionesHtml = (incs || []).map(function (inc) {
      return '<li class="flex items-start gap-4 text-[15px] text-[#475569] leading-relaxed mb-1.5">' +
        '<span class="mt-2.5 w-2 h-[1px] bg-[#64748b] shrink-0 block"></span>' +
        '<span class="tracking-wide">' + esc(inc) + '</span>' +
        '</li>';
    }).join('');

    var page2 = `
      <div id="page2" class="page-sheet page-a4 bg-white flex flex-col justify-between" style="padding: 0;">
        <div class="px-14 py-16 flex-1 flex flex-col">
          <!-- Encabezado de Inclusiones -->
          <div class="mb-10 pl-2">
            <h2 class="text-[20px] tracking-wide uppercase leading-tight">
              <span class="font-black text-[#560B5B]">PAQUETE ${esc(q.hospedaje.servicio || t.tipoServicioDefault)}</span>
              <span class="block text-[18px] text-[#64748b] font-medium mt-1">${q.hospedaje.dias} DÍAS / ${q.hospedaje.noches} NOCHES</span>
            </h2>
            <p class="text-[17px] uppercase mt-1 text-[#64748b] tracking-wide font-medium">${esc(t.destino)} - <span class="font-black text-[#560B5B]">${esc(t.nombrePosada)}</span></p>
          </div>

          <!-- Lista detallada de inclusiones -->
          <div class="mb-12 pl-2">
            <ul class="list-none space-y-2">
              ${listaInclusionesHtml}
            </ul>
          </div>
          
          <div class="mt-auto px-2 pb-6">
            ${renderPhotoGrid(t.imagenesBase64 || [], t.layoutFotos)}
          </div>
        </div>
      </div>
    `;

    return { page1: page1, page2: page2 };
  }

  function renderSoloVueloPDF(t, q) {
    var vuelos = (q.vuelo.dinamicos || []);

    var vuelosHtml = vuelos.map(function (v) {
      return `
        <div class="flex items-start gap-8 mb-6" style="page-break-inside: avoid; break-inside: avoid;">
          <div class="w-16 pt-1">
            <h3 class="text-[#20B2AA] font-black text-[17px] tracking-wide">${esc(v.tipo)}</h3>
            <div class="w-12 h-12 bg-[#800080] rounded-full flex items-center justify-center text-white mt-1">
              <svg class="w-7 h-7 transform -rotate-45" fill="currentColor" viewBox="0 0 24 24"><path d="M21,16V14L13,9V3.5C13,2.67 12.33,2 11.5,2C10.67,2 10,2.67 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z"/></svg>
            </div>
          </div>
          <div class="flex-1">
            <div class="flex justify-end mb-1">
              <span class="text-[#800080] font-black text-[14px] tracking-wider uppercase">FECHA: ${esc(v.fecha)}</span>
            </div>
            <div class="grid grid-cols-12 items-center gap-4">
              <div class="col-span-3">
                <span class="text-[#64748b] font-black text-[12px] tracking-widest block uppercase">SALIDA</span>
              </div>
              <div class="col-span-4">
                <span class="text-[#94a3b8] font-bold text-[13px] tracking-wide uppercase">${esc(v.origen)}</span>
              </div>
              <div class="col-span-2 text-center">
                <span class="text-[#64748b] font-medium text-[15px]">${esc(v.salida)}</span>
              </div>
              <div class="col-span-3 text-right">
                <span class="text-[#20B2AA] font-black text-[12px] tracking-widest block uppercase">DURACIÓN ESTIMADA</span>
              </div>
            </div>
            
            <div class="grid grid-cols-12 items-center gap-4 my-1">
              <div class="col-span-3"></div>
              <div class="col-span-4"></div>
              <div class="col-span-2 flex justify-center">
                <svg class="w-6 h-6 text-[#cbd5e1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <div class="col-span-3 text-right">
                <span class="text-[#94a3b8] font-medium text-[13px] uppercase">${esc(v.duracion)}</span>
              </div>
            </div>
            
            <div class="grid grid-cols-12 items-center gap-4">
              <div class="col-span-3">
                <span class="text-[#64748b] font-black text-[12px] tracking-widest block uppercase">LLEGADA</span>
              </div>
              <div class="col-span-4">
                <span class="text-[#94a3b8] font-bold text-[13px] tracking-wide uppercase">${esc(v.destino)}</span>
              </div>
              <div class="col-span-2 text-center">
                <span class="text-[#64748b] font-medium text-[15px]">${esc(v.llegada)}</span>
              </div>
              <div class="col-span-3"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    var equipajeItems = (q.vuelo.equipaje || '').split('\n').filter(Boolean).map(function (e) {
      return '<div class="text-[13px] font-bold text-[#334155] uppercase mb-0.5">' + esc(e) + '</div>';
    }).join('');

    var restriccionesDefault = "NO REEMBOLSABLE\nNO TRANSFERIBLE\nPERMITE CAMBIO CON PENALIDAD + DIFERENCIA TARIFARIA (EN CASO DE QUE APLIQUE)";
    var restriccionesItems = restriccionesDefault.split('\n').filter(Boolean).map(function (r) {
      return '<div class="text-[13px] font-bold text-[#334155] uppercase mb-0.5">• ' + esc(r) + '</div>';
    }).join('');

    var page1 = `
      <div id="page1" class="page-sheet page-a4 dynamic-height bg-white flex flex-col pt-10" style="padding-bottom: 0;">
        <div class="px-14 flex-1 flex flex-col">
          <!-- Encabezado Logo H y Viajes Holy -->
          <div class="flex justify-between items-start mb-8 shrink-0">
            <div class="flex gap-4">
              <div class="w-[88px] h-[88px] bg-[#800080] rounded-[2rem] flex items-center justify-center text-white shrink-0 shadow-sm overflow-hidden p-2">
                <img src="assets/img/Logo Holy.png" alt="Logo Holy" class="w-full h-full object-contain">
              </div>
              <div class="pt-1">
                <div class="text-[17px] tracking-wide mb-0.5 uppercase"><span class="text-[#800080]">COTIZACIÓN AÉREA/ </span><span class="font-black text-[#560B5B]">${esc(q.vuelo.pnr)}</span></div>
                <div class="text-[13px] text-[#64748b] font-black tracking-widest mb-1.5">AEROLÍNEA: <span class="font-medium uppercase">${esc(q.vuelo.aerolinea)}</span></div>
                <div class="flex items-center gap-1.5 text-[14px] text-[#475569] font-black tracking-widest mb-1.5">
                  CONFIRMADO <svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                </div>
                <div class="text-[13px] font-black text-[#800080] tracking-wide uppercase">FECHA DE COTIZACIÓN: <span class="font-medium text-[#64748b]">${esc(q.fechaCotizacion)}</span></div>
              </div>
            </div>
            <div class="pt-2">
              <img src="assets/img/ViajesHoly logo2.png" alt="Viajes Holy" class="h-12 w-auto object-contain">
            </div>
          </div>





          <!-- Lista de vuelos dinámicos -->
          <div class="mb-4">
            ${vuelosHtml}
          </div>
          
          <!-- Restricciones y Totales -->
          <div class="mt-4 mb-8 shrink-0" style="page-break-inside: avoid;">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-12 h-12 shrink-0 rounded-full border-2 border-[#800080] flex items-center justify-center bg-[#fdf5ff] overflow-hidden">
                <img src="assets/img/Boletos.png" alt="Boletos" class="w-8 h-8 object-contain">
              </div>
              <h3 class="text-[#800080] font-black text-[14px] tracking-wide uppercase">RESTRICCIONES / ${esc(q.vuelo.pnr)}</h3>
            </div>
            
            <div class="pl-4 mb-6">
              <div class="text-[#64748b] font-medium text-[13px] uppercase mb-3">TARIFA INCLUYE TODOS LOS IMPUESTOS Y TASAS</div>
              <div class="mb-3">
                <div class="text-[#64748b] font-black text-[13px] uppercase mb-1">FRANQUICIA DE EQUIPAJE</div>
                ${equipajeItems}
              </div>
              <div>
                <div class="text-[#64748b] font-black text-[13px] uppercase mb-1">RESTRICCIONES:</div>
                ${restriccionesItems}
              </div>
            </div>
          </div>
            
          <!-- Pasajeros Breakdown y Footer -->
          <div class="mt-auto mb-8 shrink-0" style="page-break-inside: avoid;">
            <div class="pl-4 mb-2 text-[13px]">
              <span class="text-[#800080] font-extrabold uppercase">ADULTOS</span> <span class="text-[#800080] font-bold ml-1">${q.pasajeros.adultos}</span>
              <span class="text-[#800080] font-black mx-2">-</span>
              <span class="text-[#800080] font-extrabold uppercase">NIÑOS</span> <span class="text-[#800080] font-bold ml-1">${q.pasajeros.ninos}</span>
              <span class="text-[#800080] font-black mx-2">-</span>
              <span class="text-[#800080] font-extrabold uppercase">INFANTES</span> <span class="text-[#800080] font-bold ml-1">${q.pasajeros.infantes}</span>
            </div>
            
            <div class="flex justify-between items-end mt-10 mb-2 px-4">
              <div class="w-40">
                <!-- Segundo Logo H -->
                <img src="assets/img/ViajesHoly logo2.png" alt="Viajes Holy" class="h-8 w-auto opacity-80 object-contain">
              </div>
              <div class="flex flex-col items-end gap-2 text-right">
                <div class="flex justify-between w-[300px] items-center pr-6">
                  <span class="text-[#94a3b8] font-bold text-[12px] uppercase tracking-wide">TARIFA POR ADULTO</span>
                  <span class="text-[#64748b] font-semibold text-[14px]">${esc(root.Monext.formatMoney(q.tarifas.tarifaPorAdulto, q.tarifas.moneda))}</span>
                </div>
                <div class="flex justify-between w-[300px] items-center mt-3 mb-2 pr-6">
                  <span class="text-[#94a3b8] font-bold text-[12px] uppercase tracking-wide">TARIFA POR NIÑO</span>
                  <span class="text-[#64748b] font-semibold text-[14px]">${esc(root.Monext.formatMoney(q.tarifas.tarifaPorNino, q.tarifas.moneda))}</span>
                </div>
                <div class="flex justify-between w-[330px] items-center mt-2">
                  <span class="text-[#94a3b8] font-bold text-[12px] uppercase tracking-wide pr-4">TOTAL ${q.pasajeros.adultos} ADT - ${q.pasajeros.ninos} CHD - ${q.pasajeros.infantes} INF</span>
                  <div class="bg-[#800080] text-white px-7 py-3 rounded-xl shadow-md border-b-[4px] border-[#560B5B] min-w-[120px] text-center">
                    <span class="font-extrabold text-xl font-poppins">${esc(root.Monext.formatMoney(q.tarifas.montoTotal, q.tarifas.moneda))}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Base morada gorda -->
        <div class="w-full bg-[#800080] rounded-t-[2.5rem] h-[30px] shrink-0"></div>
      </div>
    `;

    return { page1: page1, page2: '' };
  }

  function buildPreview(t, q) {
    if (q && q.tipoPaquete === 'SOLO VUELO') {
      return renderSoloVueloPDF(t, q);
    }
    if (q && q.tipoPaquete === 'SOLO HOSPEDAJE') {
      return renderSoloHospedajePDF(t, q);
    }
    return {
      page1: renderPage1(t, q),
      page2: renderPage2(t, q),
    };
  }

  root.Preview = {
    buildPreview: buildPreview,
    buildTemplate: buildTemplate,
    renderPhotoGrid: renderPhotoGrid,
  };
})(typeof self !== 'undefined' ? self : this);