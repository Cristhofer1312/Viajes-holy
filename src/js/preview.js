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

  // ---- Grilla de fotos según layoutFotos ----
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

  function fotoPortadaDe(t) {
    return (t && t.fotoPortada) || (t && t.imagenesBase64 && t.imagenesBase64[0]) || '';
  }

  function banderaNoIncluye() {
    return '<div class="w-full bg-holyPurple text-white text-center py-4 rounded-b-2xl shadow-sm" style="width: calc(100% + 6rem); margin-left: -3rem; margin-right: -3rem;">' +
      '<p class="font-montserrat font-black text-[14px] tracking-wider uppercase">NO INCLUYE IMPUESTO DE ENTRADA AL PARQUE</p></div>';
  }

  // ---- PÁGINA 1 ----
  function renderPage1(t, q) {
    var v = q.vuelo || { ida: {}, retorno: {} };
    return '' +
      '<div id="page1" class="page-sheet px-12 pt-12 flex flex-col justify-between">' +
      '<div class="flex-1 flex flex-col justify-between">' +
      '<div class="flex justify-between items-start">' +
      '<div class="flex items-start gap-4">' +
      '<div class="w-16 h-16 bg-holyPurple rounded-2xl flex items-center justify-center shrink-0 shadow-md overflow-hidden">' +
      '<img src="assets/img/Logo Holy.png" alt="Logo Holy" class="w-full h-full object-cover"></div>' +
      '<div class="pt-0.5">' +
      '<h1 class="text-holyPurple font-montserrat font-black text-[15px] tracking-wide leading-tight uppercase">COTIZACIÓN PAQUETE TURÍSTICO</h1>' +
      '<p class="text-holyPurple font-montserrat font-black text-[14px] leading-tight uppercase mt-0.5">TIPO: ' + esc(q.tipoPaquete) + '</p>' +
      '<div class="flex items-center gap-1.5 mt-0.5">' +
      '<span class="text-holyPurple font-montserrat font-black text-[13px] uppercase">' + esc(q.estado || 'COTIZACIÓN') + '</span>' +
      '<svg class="w-4 h-4 text-holyMintBright stroke-[3.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg></div>' +
      '<p class="text-holyGray font-montserrat font-black text-[13px] mt-1">FECHA DE COTIZACIÓN: <span class="text-black font-montserrat font-black">' +
      esc(q.fechaCotizacion) + '</span></p>' +
      '</div></div>' +
      '<div class="flex items-start pt-1"><img src="assets/img/ViajesHoly logo2.png" alt="Viajes Holy" class="h-20 w-auto"></div>' +
      '</div>' +
      '<div>' +
      '<div class="flex items-baseline gap-2 mb-1">' +
      '<span class="text-holyPurple font-montserrat font-black text-[15px] uppercase">AÉREO:</span>' +
      '<span class="text-holyGray font-montserrat font-black text-[15px] uppercase">' + esc(v.aerolinea) + '</span></div>' +
      '<div class="w-full h-[1.5px] bg-holyLine mb-6"></div>' +
      '<div class="grid grid-cols-12 gap-2 items-center">' +
      '<div class="col-span-8 space-y-7">' +
      '<div class="flex items-center text-[13px]">' +
      '<div class="w-10 h-10 shrink-0 mr-4 flex items-center justify-center">' + avionIcon(false) + '</div>' +
      '<div class="w-24 shrink-0"><span class="text-holyPurple font-montserrat font-black text-[14px] tracking-wide">IDA</span></div>' +
      '<div class="w-32 shrink-0"><p class="text-holyPurple font-montserrat font-black leading-snug text-[13px]">' + esc(v.ida.origen) + '</p>' +
      '<p class="text-holyPurple font-montserrat font-black leading-snug text-[13px]">' + esc(v.ida.destino) + '</p></div>' +
      '<div class="w-12 shrink-0 flex justify-center">' + clockIcon(true) + '</div>' +
      '<div class="pl-4"><p class="text-holyPurple font-montserrat font-black text-[13px]">' + esc(v.ida.fecha) + '</p>' +
      '<p class="text-holyGray font-montserrat font-black text-[12px]">SALIDA: ' + esc(v.ida.salida) + '</p>' +
      '<p class="text-holyGray font-montserrat font-black text-[12px]">LLEGADA: ' + esc(v.ida.llegada) + '</p></div>' +
      '</div>' +
      '<div class="flex items-center text-[13px]">' +
      '<div class="w-10 h-10 shrink-0 mr-4 flex items-center justify-center">' + avionIcon(true) + '</div>' +
      '<div class="w-24 shrink-0"><span class="text-holyPurple font-montserrat font-black text-[14px] tracking-wide">RETORNO</span></div>' +
      '<div class="w-32 shrink-0"><p class="text-holyPurple font-montserrat font-black leading-snug text-[13px]">' + esc(v.retorno.origen) + '</p>' +
      '<p class="text-holyPurple font-montserrat font-black leading-snug text-[13px]">' + esc(v.retorno.destino) + '</p></div>' +
      '<div class="w-12 shrink-0 flex justify-center">' + clockIcon(false) + '</div>' +
      '<div class="pl-4"><p class="text-holyPurple font-montserrat font-black text-[13px]">' + esc(v.retorno.fecha) + '</p>' +
      '<p class="text-holyGray font-montserrat font-black text-[12px]">SALIDA: ' + esc(v.retorno.salida) + '</p>' +
      '<p class="text-holyGray font-montserrat font-black text-[12px]">LLEGADA: ' + esc(v.retorno.llegada) + '</p></div>' +
      '</div>' +
      '</div>' +
      '<div class="col-span-4 flex justify-end pr-2">' +
      '<div class="w-48 h-44 relative flex items-center justify-center">' +
      '<img src="assets/img/Asientos.png" alt="Asientos Ejecutivos" class="w-full h-full object-cover"></div>' +
      '</div></div></div>' +
      '<div>' +
      '<div class="flex items-baseline gap-2 mb-1">' +
      '<span class="text-holyPurple font-montserrat font-black text-[15px] uppercase">POSADA:</span>' +
      '<span class="text-holyGray font-montserrat font-black text-[15px] uppercase">' + esc(t.nombrePosada) + '</span></div>' +
      '<div class="w-full h-[1.5px] bg-holyLine mb-6"></div>' +
      '<div class="space-y-5">' +
      '<div class="grid grid-cols-12 items-center text-[13px]">' +
      '<div class="col-span-1"><div class="w-10 h-10 bg-holyMintBright rounded-full flex items-center justify-center text-white shadow">' + flechaEntrada() + '</div></div>' +
      '<div class="col-span-2 pl-2"><span class="text-holyGray font-montserrat font-black text-[13px]">CHECK <span class="font-montserrat font-black text-black">IN</span></span></div>' +
      '<div class="col-span-3"><p class="text-holyPurple font-montserrat font-black text-[13px]">FECHA DE ENTRADA</p></div>' +
      '<div class="col-span-3"><p class="text-holyGray font-montserrat font-black text-[13px]">' + esc(q.hospedaje.checkIn) + '</p></div>' +
      '<div class="col-span-3 flex justify-start pl-4 flex items-center gap-2">' + clockIcon(true) + '<span class="text-holyGray font-montserrat font-black text-[13px]">' + esc(q.hospedaje.checkInHora) + '</span></div></div>' +
      '<div class="grid grid-cols-12 items-center text-[13px]">' +
      '<div class="col-span-1"><div class="w-10 h-10 bg-holyMintBright rounded-full flex items-center justify-center text-white shadow">' + flechaSalida() + '</div></div>' +
      '<div class="col-span-2 pl-2"><span class="text-holyGray font-montserrat font-black text-[13px]">CHECK <span class="font-montserrat font-black text-black">OUT</span></span></div>' +
      '<div class="col-span-3"><p class="text-holyPurple font-montserrat font-black text-[13px]">FECHA DE SALIDA</p></div>' +
      '<div class="col-span-3"><p class="text-holyGray font-montserrat font-black text-[13px]">' + esc(q.hospedaje.checkOut) + '</p></div>' +
      '<div class="col-span-3 flex justify-start pl-4 flex items-center gap-2">' + clockIcon(true) + '<span class="text-holyGray font-montserrat font-black text-[13px]">' + esc(q.hospedaje.checkOutHora) + '</span></div></div>' +
      '</div></div>' +
      '<div class="w-full h-[1.5px] bg-holyLine mt-6 mb-6"></div>' +
      '<div class="grid grid-cols-12 items-start mb-6">' +
      '<div class="col-span-6 text-[14px]">' +
      '<span class="text-holyPurple font-montserrat font-black">ADULTOS</span> <span class="text-holyPurple font-montserrat font-black ml-1">' + q.pasajeros.adultos + '</span>' +
      '<span class="text-holyPurple font-montserrat font-black mx-2">-</span>' +
      '<span class="text-holyPurple font-montserrat font-black">NIÑOS</span> <span class="text-holyPurple font-montserrat font-black ml-1">' + q.pasajeros.ninos + '</span>' +
      '<span class="text-holyPurple font-montserrat font-black mx-2">-</span>' +
      '<span class="text-holyPurple font-montserrat font-black">INFANTES</span> <span class="text-holyPurple font-montserrat font-black ml-1">' + q.pasajeros.infantes + '</span>' +
      '</div>' +
      '<div class="col-span-6 text-[13px]">' +
      '<p class="text-holyPurple font-montserrat font-black uppercase inline">SERVICIO </p>' +
      '<p class="text-holyGray font-montserrat font-black uppercase inline">' + esc(t.tipoServicioDefault) + '</p>' +
      '</div></div>' +
      '<div class="mt-auto">' +
      '<div class="flex flex-col items-end text-right pr-2 space-y-3 mb-10">' +
      '<div class="flex items-center gap-6 text-[13px]">' +
      '<span class="text-holyGray font-montserrat font-black uppercase tracking-wider">TARIFA POR ADULTO</span>' +
      '<span class="text-holyGray font-montserrat font-black">' + esc(root.Monext ? root.Monext.formatMoney(q.tarifas.tarifaPorAdulto, q.tarifas.moneda) : q.tarifas.tarifaPorAdulto) + '</span></div>' +
      '<div class="flex items-center gap-6 text-[13px]">' +
      '<span class="text-holyGray font-montserrat font-black uppercase tracking-wider">TARIFA POR NIÑO</span>' +
      '<span class="text-holyGray font-montserrat font-black">' + esc(root.Monext ? root.Monext.formatMoney(q.tarifas.tarifaPorNino, q.tarifas.moneda) : q.tarifas.tarifaPorNino) + '</span></div>' +
      '<div class="flex items-center gap-4">' +
      '<div class="flex flex-row items-center justify-end gap-1.5">' +
      '<span class="text-holyPurple font-montserrat font-black text-[12px] uppercase tracking-wide">TOTAL ' + q.pasajeros.adultos + ' ADT</span>' +
      '<span class="text-holyPurple font-montserrat font-black text-[12px] uppercase tracking-wide">- ' + q.pasajeros.ninos + ' CHD</span>' +
      '<span class="text-holyPurple font-montserrat font-black text-[12px] uppercase tracking-wide">- ' + q.pasajeros.infantes + ' INF</span>' +
      '</div>' +
      '<div class="bg-holyPurple text-white px-7 py-3 rounded-xl shadow-md">' +
      '<span class="font-montserrat font-black text-2xl">' + esc(root.Monext ? root.Monext.formatMoney(q.tarifas.montoTotal, q.tarifas.moneda) : q.tarifas.montoTotal) + '</span></div>' +
      '</div></div>' +
      '</div>' +
      '</div>' +
      banderaNoIncluye() +
      '</div>';
  }

  // ---- PÁGINA 2 ----
  function renderPage2(t, q) {
    var incs = (q && q.inclusiones && q.inclusiones.length > 0) ? q.inclusiones : t.inclusiones;
    var items = (incs || []).map(function (inc) {
      return '<li class="flex items-start gap-2.5"><span class="text-holyPurple text-base leading-none font-montserrat font-black">•</span>' +
        '<span>' + esc(inc) + '</span></li>';
    }).join('');

    return '' +
      '<div id="page2" class="page-sheet p-12 flex flex-col justify-between">' +
      '<div>' +
      '<div class="flex items-start gap-3 mb-8">' +
      '<div class="w-1.5 h-12 bg-holyPurple rounded-full shrink-0 mt-0.5"></div>' +
      '<div>' +
      '<div class="flex items-baseline gap-2 flex-wrap">' +
      '<h2 class="text-holyPurple font-montserrat font-black text-lg tracking-wide uppercase">PAQUETE ' + esc(t.tipoServicioDefault) + '</h2>' +
      '<span class="text-holyGray font-montserrat font-black text-sm">' + (q && q.hospedaje ? q.hospedaje.dias : '—') + ' DÍAS / ' + (q && q.hospedaje ? q.hospedaje.noches : '—') + ' NOCHES</span>' +
      '</div>' +
      '<p class="text-holyGray font-montserrat font-black text-base uppercase">' + esc(t.destino) + ' - <span class="text-holyPurple font-montserrat font-black">' + esc(t.nombrePosada) + '</span></p>' +
      '</div></div>' +
      '<div class="pl-3 mb-8">' +
      '<ul class="space-y-2 text-[13px] text-holyGray font-montserrat font-black">' + items + '</ul>' +
      '</div>' +
      renderPhotoGrid(t.imagenesBase64, t.layoutFotos) +
      '</div>' +
      '<div class="text-center pt-4 border-t border-gray-100">' +
      '<span class="text-[11px] text-slate-800 font-montserrat font-black tracking-wider uppercase">' + esc(t.nombrePosada) + ' - ' + esc(t.destino) + '</span></div>' +
      '</div>';
  }

  // ---- PRESENTACIÓN DE PLANTILLA ----
  function buildTemplate(t) {
    t = (t && typeof t === 'object') ? t : {};
    var items = (t.inclusiones || []).map(function (inc) {
      return '<li class="flex items-start gap-2.5"><span class="text-holyPurple text-base leading-none font-montserrat font-black">•</span>' +
        '<span>' + esc(inc) + '</span></li>';
    }).join('');

    var page1 = '' +
      '<div id="page1" class="page-sheet px-12 pt-12 flex flex-col justify-between">' +
      '<div class="flex-1 flex flex-col justify-between">' +
      '<div>' +
      '<div class="flex items-start gap-3 mb-6">' +
      '<div class="w-1.5 h-12 bg-holyPurple rounded-full shrink-0 mt-0.5"></div>' +
      '<div>' +
      '<h2 class="text-holyPurple font-montserrat font-black text-lg tracking-wide uppercase">PAQUETE ' + esc(t.tipoServicioDefault) + '</h2>' +
      '<p class="text-holyGray font-montserrat font-black text-base uppercase">' + esc(t.destino) + ' - <span class="text-holyPurple font-montserrat font-black">' + esc(t.nombrePosada) + '</span></p>' +
      '</div></div>' +
      '<div class="rounded-2xl overflow-hidden shadow-md border border-gray-100 mb-6 flex-1 relative">' + celdaFoto(fotoPortadaDe(t)) + '</div>' +
      '</div>' +
      '<div class="border-t border-gray-100 pt-5 mb-8">' +
      '<p class="text-holyPurple font-montserrat font-black text-sm uppercase tracking-wide mb-3">INCLUYE</p>' +
      '<ul class="space-y-2 text-[13px] text-holyGray font-montserrat font-black">' + items + '</ul>' +
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
      '<h2 class="text-holyPurple font-montserrat font-black text-lg tracking-wide uppercase">GALERÍA</h2>' +
      '<p class="text-holyGray font-montserrat font-black text-base uppercase">' + esc(t.destino) + ' - <span class="text-holyPurple font-montserrat font-black">' + esc(t.nombrePosada) + '</span></p>' +
      '</div></div>' +
      renderPhotoGrid(t.imagenesBase64 || [], t.layoutFotos) +
      '</div>' +
      '<div class="text-center pt-4 border-t border-gray-100">' +
      '<span class="text-[11px] text-slate-800 font-montserrat font-black tracking-wider uppercase">' + esc(t.nombrePosada) + ' - ' + esc(t.destino) + '</span></div>' +
      '</div>';

    return { page1: page1, page2: page2 };
  }

  function buildPreview(t, q) {
    return {
      page1: renderPage1(t, q),
      page2: renderPage2(t, q),
    };
  }

  root.Preview = {
    buildPreview: buildPreview,
    buildTemplate: buildTemplate,
    renderPage1: renderPage1,
    renderPage2: renderPage2,
  };
})(typeof self !== 'undefined' ? self : this);