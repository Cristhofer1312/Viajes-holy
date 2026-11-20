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
    return '<img src="assets/img/Avion Holy.png" alt="Avión Holy"' + flip + '>';
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
    // Sin width:calc() frágil: la franja se estira con márgenes negativos
    // simétricos al px-12 del page-sheet. Así no desborda si Tailwind
    // tarda o si el box-sizing difiere entre equipos.
    return '<div class="w-full bg-holyPurple text-white text-center py-4 rounded-b-2xl shadow-sm" style="display:block; width:auto; margin-left:-3rem; margin-right:-3rem;">' +
      '<p class="font-montserrat font-normal text-[14px] tracking-wider uppercase">NO INCLUYE IMPUESTO DE ENTRADA AL PARQUE</p></div>';
  }

  // ---- PÁGINA 1 ----
  function renderPage1(t, q) {
    var v = q.vuelo || { ida: {}, retorno: {} };
    var tipo = (q.tipoPaquete || '').toUpperCase();
    var esSoloHospedaje = tipo === 'SOLO HOSPEDAJE';
    var esSoloVuelo = tipo === 'SOLO VUELO';

    // Sección AÉREO (oculta en SOLO HOSPEDAJE)
    var seccionAereo = '';
    if (!esSoloHospedaje) {
      var vuelosDin = v.dinamicos && v.dinamicos.length > 0;
      var filasDinamicas = '';
      if (vuelosDin) {
        filasDinamicas = v.dinamicos.map(function (vd) {
          var esRetorno = vd.tipo === 'RETORNO';
          return '<div class="vuelo-line text-[13px]">' +
            '<div class="v-avion">' + avionIcon(esRetorno) + '</div>' +
            '<div class="v-tipo"><span class="text-holyPurple font-montserrat font-bold text-[14px] tracking-wide">' + esc(vd.tipo) + '</span></div>' +
            '<div class="v-ciudad"><p class="text-holyPurple font-montserrat font-extrabold leading-snug text-[13px]">' + esc(vd.origen) + '</p>' +
            '<p class="text-holyPurple font-montserrat font-extrabold leading-snug text-[13px]">' + esc(vd.destino) + '</p></div>' +
            '<div class="v-clock">' + clockIcon(!esRetorno) + '</div>' +
            '<div class="v-horas"><p class="text-holyPurple font-montserrat font-bold text-[13px]">' + esc(vd.fecha) + '</p>' +
            '<p class="text-holyGray font-montserrat font-normal text-[12px]">SALIDA: ' + esc(vd.salida) + '</p>' +
            '<p class="text-holyGray font-montserrat font-normal text-[12px]">LLEGADA: ' + esc(vd.llegada) + '</p></div>' +
            '</div>';
        }).join('');
      } else {
        filasDinamicas =
          '<div class="vuelo-line text-[13px]">' +
          '<div class="v-avion">' + avionIcon(false) + '</div>' +
          '<div class="v-tipo"><span class="text-holyPurple font-montserrat font-bold text-[14px] tracking-wide">IDA</span></div>' +
          '<div class="v-ciudad"><p class="text-holyPurple font-montserrat font-extrabold leading-snug text-[13px]">' + esc(v.ida.origen) + '</p>' +
          '<p class="text-holyPurple font-montserrat font-extrabold leading-snug text-[13px]">' + esc(v.ida.destino) + '</p></div>' +
          '<div class="v-clock">' + clockIcon(true) + '</div>' +
          '<div class="v-horas"><p class="text-holyPurple font-montserrat font-bold text-[13px]">' + esc(v.ida.fecha) + '</p>' +
          '<p class="text-holyGray font-montserrat font-normal text-[12px]">SALIDA: ' + esc(v.ida.salida) + '</p>' +
          '<p class="text-holyGray font-montserrat font-normal text-[12px]">LLEGADA: ' + esc(v.ida.llegada) + '</p></div>' +
          '</div>' +
          '<div class="vuelo-line text-[13px]">' +
          '<div class="v-avion">' + avionIcon(true) + '</div>' +
          '<div class="v-tipo"><span class="text-holyPurple font-montserrat font-bold text-[14px] tracking-wide">RETORNO</span></div>' +
          '<div class="v-ciudad"><p class="text-holyPurple font-montserrat font-extrabold leading-snug text-[13px]">' + esc(v.retorno.origen) + '</p>' +
          '<p class="text-holyPurple font-montserrat font-extrabold leading-snug text-[13px]">' + esc(v.retorno.destino) + '</p></div>' +
          '<div class="v-clock">' + clockIcon(false) + '</div>' +
          '<div class="v-horas"><p class="text-holyPurple font-montserrat font-bold text-[13px]">' + esc(v.retorno.fecha) + '</p>' +
          '<p class="text-holyGray font-montserrat font-normal text-[12px]">SALIDA: ' + esc(v.retorno.salida) + '</p>' +
          '<p class="text-holyGray font-montserrat font-normal text-[12px]">LLEGADA: ' + esc(v.retorno.llegada) + '</p></div>' +
          '</div>';
      }

      seccionAereo =
        '<div>' +
        '<div class="flex items-baseline gap-2 mb-1">' +
        '<span class="text-holyPurple font-montserrat font-extrabold text-[15px] uppercase">AÉREO:</span>' +
        '<span class="text-holyGray font-montserrat font-normal text-[15px] uppercase">' + esc(v.aerolinea) + '</span></div>' +
        '<div class="w-full h-[1.5px] bg-holyLine mb-6"></div>' +
        '<div class="vuelo-wrap">' +
        '<div class="vuelo-info">' + filasDinamicas + '</div>' +
        '<div class="vuelo-img"><img src="assets/img/Asientos.png" alt="Asientos Ejecutivos"></div>' +
        '</div></div>';
    }

    // Sección POSADA (oculta en SOLO VUELO)
    var seccionPosada = '';
    if (!esSoloVuelo) {
      seccionPosada =
        '<div>' +
        '<div class="flex items-baseline gap-2 mb-1">' +
        '<span class="text-holyPurple font-montserrat font-extrabold text-[15px] uppercase">POSADA:</span>' +
        '<span class="text-holyGray font-montserrat font-normal text-[15px] uppercase">' + esc(t.nombrePosada) + '</span></div>' +
        '<div class="w-full h-[1.5px] bg-holyLine mb-6"></div>' +
        '<div class="space-y-5">' +
        '<div class="grid grid-cols-12 items-center text-[13px]">' +
        '<div class="col-span-1"><div class="w-10 h-10 bg-holyMintBright rounded-full flex items-center justify-center text-white shadow">' + flechaEntrada() + '</div></div>' +
        '<div class="col-span-2 pl-2"><span class="text-holyGray font-montserrat font-normal text-[13px]">CHECK <span class="font-montserrat font-bold text-black">IN</span></span></div>' +
        '<div class="col-span-3"><p class="text-holyPurple font-montserrat font-bold text-[13px]">FECHA DE ENTRADA</p></div>' +
        '<div class="col-span-3"><p class="text-holyGray font-montserrat font-normal text-[13px]">' + esc(q.hospedaje.checkIn) + '</p></div>' +
        '<div class="col-span-3 flex justify-start pl-4 flex items-center gap-2">' + clockIcon(true) + '<span class="text-holyGray font-montserrat font-normal text-[13px]">' + esc(q.hospedaje.checkInHora) + '</span></div></div>' +
        '<div class="grid grid-cols-12 items-center text-[13px]">' +
        '<div class="col-span-1"><div class="w-10 h-10 bg-holyMintBright rounded-full flex items-center justify-center text-white shadow">' + flechaSalida() + '</div></div>' +
        '<div class="col-span-2 pl-2"><span class="text-holyGray font-montserrat font-normal text-[13px]">CHECK <span class="font-montserrat font-bold text-black">OUT</span></span></div>' +
        '<div class="col-span-3"><p class="text-holyPurple font-montserrat font-bold text-[13px]">FECHA DE SALIDA</p></div>' +
        '<div class="col-span-3"><p class="text-holyGray font-montserrat font-normal text-[13px]">' + esc(q.hospedaje.checkOut) + '</p></div>' +
        '<div class="col-span-3 flex justify-start pl-4 flex items-center gap-2">' + clockIcon(true) + '<span class="text-holyGray font-montserrat font-normal text-[13px]">' + esc(q.hospedaje.checkOutHora) + '</span></div></div>' +
        '</div></div>';
    }

    return '' +
      '<div id="page1" class="page-sheet px-12 pt-12 flex flex-col justify-between">' +
      '<div class="flex-1 flex flex-col justify-between">' +
      '<div class="flex justify-between items-start">' +
      '<div class="flex items-start gap-4">' +
      '<div class="w-16 h-16 bg-holyPurple rounded-2xl flex items-center justify-center shrink-0 shadow-md overflow-hidden">' +
      '<img src="assets/img/Logo Holy.png" alt="Logo Holy" class="w-full h-full object-cover"></div>' +
      '<div class="pt-0.5">' +
      '<h1 class="text-holyPurple font-montserrat font-extrabold text-[15px] tracking-wide leading-tight uppercase">COTIZACIÓN PAQUETE TURÍSTICO</h1>' +
      '<p class="text-holyPurple font-montserrat font-extrabold text-[14px] leading-tight uppercase mt-0.5">TIPO: ' + esc(q.tipoPaquete) + '</p>' +
      '<div class="flex items-center gap-1.5 mt-0.5">' +
      '<span class="text-holyPurple font-montserrat font-normal text-[13px] uppercase">' + esc(q.estado || 'COTIZACIÓN') + '</span>' +
      '<svg class="w-4 h-4 text-holyMintBright stroke-[3.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
      '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg></div>' +
      '<p class="text-holyGray font-montserrat font-normal text-[13px] mt-1">FECHA DE COTIZACIÓN: <span class="text-black font-montserrat font-bold">' +
      esc(q.fechaCotizacion) + '</span></p>' +
      '</div></div>' +
      '<div class="flex items-start pt-1"><img src="assets/img/ViajesHoly logo2.png" alt="Viajes Holy" class="h-20 w-auto"></div>' +
      '</div>' +
      seccionAereo +
      seccionPosada +
      '<div class="w-full h-[1.5px] bg-holyLine mt-6 mb-6"></div>' +
      '<div class="grid grid-cols-12 items-start mb-6">' +
      '<div class="col-span-6 text-[14px]">' +
      '<span class="text-holyPurple font-montserrat font-extrabold">ADULTOS</span> <span class="text-holyPurple font-montserrat font-normal ml-1">' + q.pasajeros.adultos + '</span>' +
      '<span class="text-holyPurple font-montserrat font-normal mx-2">-</span>' +
      '<span class="text-holyPurple font-montserrat font-extrabold">NIÑOS</span> <span class="text-holyPurple font-montserrat font-normal ml-1">' + q.pasajeros.ninos + '</span>' +
      '<span class="text-holyPurple font-montserrat font-normal mx-2">-</span>' +
      '<span class="text-holyPurple font-montserrat font-extrabold">INFANTES</span> <span class="text-holyPurple font-montserrat font-normal ml-1">' + q.pasajeros.infantes + '</span>' +
      '</div>' +
      '<div class="col-span-6 text-[13px]">' +
      '<p class="text-holyPurple font-montserrat font-extrabold uppercase inline">SERVICIO </p>' +
      '<p class="text-holyGray font-montserrat font-normal uppercase inline">' + esc(t.tipoServicioDefault) + '</p>' +
      '</div></div>' +
      '<div class="mt-auto">' +
      '<div class="flex flex-col items-end text-right pr-2 space-y-3 mb-10">' +
      '<div class="flex items-center gap-6 text-[13px]">' +
      '<span class="text-holyGray font-montserrat font-normal uppercase tracking-wider">TARIFA POR ADULTO</span>' +
      '<span class="text-holyGray font-montserrat font-normal">' + esc(root.Monext ? root.Monext.formatMoney(q.tarifas.tarifaPorAdulto, q.tarifas.moneda) : q.tarifas.tarifaPorAdulto) + '</span></div>' +
      '<div class="flex items-center gap-6 text-[13px]">' +
      '<span class="text-holyGray font-montserrat font-normal uppercase tracking-wider">TARIFA POR NIÑO</span>' +
      '<span class="text-holyGray font-montserrat font-normal">' + esc(root.Monext ? root.Monext.formatMoney(q.tarifas.tarifaPorNino, q.tarifas.moneda) : q.tarifas.tarifaPorNino) + '</span></div>' +
      '<div class="flex items-center gap-4">' +
      '<div class="flex flex-row items-center justify-end gap-1.5">' +
      '<span class="text-holyPurple font-montserrat font-normal text-[12px] uppercase tracking-wide">TOTAL ' + q.pasajeros.adultos + ' ADT</span>' +
      '<span class="text-holyPurple font-montserrat font-normal text-[12px] uppercase tracking-wide">- ' + q.pasajeros.ninos + ' CHD</span>' +
      '<span class="text-holyPurple font-montserrat font-normal text-[12px] uppercase tracking-wide">- ' + q.pasajeros.infantes + ' INF</span>' +
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
  // Nota: SOLO VUELO no llega aquí (buildPreview lo deriva a
  // renderSoloVueloPDF de hoja única). Esta rama queda para
  // COMPLETO / SOLO HOSPEDAJE.
  function renderPage2(t, q) {
    var incs = (q && q.inclusiones && q.inclusiones.length > 0) ? q.inclusiones : t.inclusiones;
    var items = (incs || []).map(function (inc) {
      return '<li class="flex items-start gap-2.5"><span class="text-holyPurple text-base leading-none font-montserrat font-bold">•</span>' +
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
      '<span class="text-holyGray font-montserrat font-normal text-sm">' + (q && q.hospedaje ? q.hospedaje.dias : '—') + ' DÍAS / ' + (q && q.hospedaje ? q.hospedaje.noches : '—') + ' NOCHES</span>' +
      '</div>' +
      '<p class="text-holyGray font-montserrat font-normal text-base uppercase">' + esc(t.destino) + ' - <span class="text-holyPurple font-montserrat font-black">' + esc(t.nombrePosada) + '</span></p>' +
      '</div></div>' +
      '<div class="pl-3 mb-8">' +
      '<ul class="space-y-2 text-[13px] text-holyGray font-montserrat font-normal">' + items + '</ul>' +
      '</div>' +
      renderPhotoGrid(t.imagenesBase64, t.layoutFotos) +
      '</div>' +
      '<div class="text-center pt-4 border-t border-gray-100">' +
      '<span class="text-[11px] text-slate-800 font-montserrat font-medium tracking-wider uppercase">' + esc(t.nombrePosada) + ' - ' + esc(t.destino) + '</span></div>' +
      '</div>';
  }

  // ---- SOLO VUELO ----
  // Hojas A4 FIJAS (1123px) paginadas aquí, no por el navegador al imprimir:
  // así la vista previa muestra exactamente las páginas que saldrán en el PDF.
  //  · Página 1: encabezado completo + los vuelos que quepan.
  //  · Continuación: encabezado compacto (PNR + "PÁGINA x DE n") + vuelos.
  //  · Última página: el cierre (restricciones, equipaje, pasajeros, tarifas)
  //    anclado al pie; nunca se parte y nunca queda solo en una página.
  //  · Franja morada al borde inferior de cada hoja.
  // Las alturas (px a 794px de ancho) se midieron sobre el render real y se
  // verifican con test/solovuelo-paginacion.e2e.cjs.
  var SV = {
    util: 1123 - 40 - 30,      // alto de hoja - padding superior - franja
    cabecera: 128,             // encabezado completo (incluye margen)
    cabeceraCompacta: 73,      // encabezado de continuación
    vuelo: 133,                // un tramo: 117px + margen de 16px
    cierreBase: 492,           // restricciones + tarifas con 2 líneas de equipaje
    lineaEquipaje: 23,         // cada línea extra de equipaje
    charsPorLinea: 60,         // conservador: una línea real admite ~70
    holgura: 16,               // margen de seguridad (fuentes / redondeos)
  };

  function svLineasEquipaje(equipaje) {
    return String(equipaje || '').split('\n').filter(Boolean).reduce(function (n, l) {
      return n + Math.max(1, Math.ceil(l.length / SV.charsPorLinea));
    }, 0);
  }

  /** Reparte N vuelos en páginas. Devuelve [{ vuelos: [...], cierre: bool }]. */
  function paginarSoloVuelo(vuelos, equipaje) {
    var cierre = SV.cierreBase + (svLineasEquipaje(equipaje) - 2) * SV.lineaEquipaje;
    var paginas = [];
    var i = 0;
    while (true) {
      var disponible = SV.util - SV.holgura - (paginas.length ? SV.cabeceraCompacta : SV.cabecera);
      var restantes = vuelos.length - i;
      if (restantes * SV.vuelo + cierre <= disponible) {
        paginas.push({ vuelos: vuelos.slice(i), cierre: true });
        return paginas;
      }
      var caben = Math.max(1, Math.floor(disponible / SV.vuelo));
      // Si todos los vuelos restantes caben pero el cierre no, se baja el
      // último vuelo a la página siguiente para que el cierre no quede solo.
      if (caben >= restantes) caben = Math.max(1, restantes - 1);
      if (restantes === 0) { paginas.push({ vuelos: [], cierre: true }); return paginas; }
      paginas.push({ vuelos: vuelos.slice(i, i + caben), cierre: false });
      i += caben;
    }
  }

  function svCabecera(v, q) {
    return '' +
      '<div class="flex justify-between items-start mb-6 shrink-0">' +
      '<div class="flex gap-4">' +
      '<div class="w-[88px] h-[88px] bg-[#800080] rounded-[2rem] flex items-center justify-center text-white shrink-0 shadow-sm overflow-hidden p-2">' +
      '<img src="assets/img/Logo Holy.png" alt="Logo Holy" class="w-full h-full object-contain"></div>' +
      '<div class="pt-1">' +
      '<div class="text-[17px] tracking-wide mb-0.5 uppercase"><span class="text-[#800080] font-montserrat font-extrabold">COTIZACIÓN AÉREA/ </span><span class="font-montserrat font-extrabold text-[#560B5B]">' + esc(v.pnr) + '</span></div>' +
      '<div class="text-[13px] text-[#64748b] font-montserrat font-extrabold tracking-widest mb-1.5">AEROLÍNEA: <span class="font-normal uppercase">' + esc(v.aerolinea) + '</span></div>' +
      '<div class="flex items-center gap-1.5 text-[14px] text-[#475569] font-montserrat font-normal tracking-widest mb-1.5">' +
      'CONFIRMADO <svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg></div>' +
      '<div class="text-[13px] font-montserrat font-extrabold text-[#800080] tracking-wide uppercase">FECHA DE COTIZACIÓN: <span class="font-bold text-[#64748b]">' + esc(q.fechaCotizacion) + '</span></div>' +
      '</div></div>' +
      '<div class="pt-2"><img src="assets/img/ViajesHoly logo2.png" alt="Viajes Holy" class="h-12 w-auto object-contain"></div>' +
      '</div>';
  }

  function svCabeceraCompacta(v, pagina, total) {
    return '' +
      '<div class="flex justify-between items-center pb-3 mb-5 border-b border-[#800080]/20 shrink-0">' +
      '<div class="flex items-center gap-3">' +
      '<div class="w-10 h-10 bg-[#800080] rounded-xl flex items-center justify-center shrink-0 overflow-hidden p-1">' +
      '<img src="assets/img/Logo Holy.png" alt="Logo Holy" class="w-full h-full object-contain"></div>' +
      '<div class="text-[14px] tracking-wide uppercase"><span class="text-[#800080] font-montserrat font-extrabold">COTIZACIÓN AÉREA/ </span><span class="font-montserrat font-extrabold text-[#560B5B]">' + esc(v.pnr) + '</span>' +
      '<span class="text-[#64748b] font-montserrat font-normal"> · CONTINUACIÓN</span></div>' +
      '</div>' +
      '<div class="text-[12px] text-[#64748b] font-montserrat font-bold tracking-widest uppercase">PÁGINA ' + pagina + ' DE ' + total + '</div>' +
      '</div>';
  }

  function svVuelo(vd) {
    return '' +
      '<div class="flex items-start gap-8 mb-4">' +
      '<div class="w-16 pt-1">' +
      '<h3 class="text-[#20B2AA] font-montserrat font-bold text-[17px] tracking-wide">' + esc(vd.tipo) + '</h3>' +
      '<div class="w-12 h-12 bg-[#800080] rounded-full flex items-center justify-center text-white mt-1">' +
      '<svg class="w-7 h-7 transform -rotate-45" fill="currentColor" viewBox="0 0 24 24"><path d="M21,16V14L13,9V3.5C13,2.67 12.33,2 11.5,2C10.67,2 10,2.67 10,3.5V9L2,14V16L10,13.5V19L8,20.5V22L11.5,21L15,22V20.5L13,19V13.5L21,16Z"/></svg>' +
      '</div></div>' +
      '<div class="flex-1">' +
      '<div class="flex justify-end mb-1">' +
      '<span class="text-[#800080] font-montserrat font-bold text-[14px] tracking-wider uppercase">FECHA: ' + esc(vd.fecha) + '</span>' +
      '</div>' +
      '<div class="grid grid-cols-12 items-center gap-4">' +
      '<div class="col-span-3"><span class="text-[#64748b] font-montserrat font-bold text-[12px] tracking-widest block uppercase">SALIDA</span></div>' +
      '<div class="col-span-4"><span class="text-[#94a3b8] font-montserrat font-bold text-[13px] tracking-wide uppercase">' + esc(vd.origen) + '</span></div>' +
      '<div class="col-span-2 text-center"><span class="text-[#64748b] font-montserrat font-normal text-[15px]">' + esc(vd.salida) + '</span></div>' +
      '<div class="col-span-3 text-right"><span class="text-[#20B2AA] font-montserrat font-bold text-[12px] tracking-widest block uppercase">DURACIÓN ESTIMADA</span></div>' +
      '</div>' +
      '<div class="grid grid-cols-12 items-center gap-4 my-1">' +
      '<div class="col-span-3"></div><div class="col-span-4"></div>' +
      '<div class="col-span-2 flex justify-center">' +
      '<svg class="w-6 h-6 text-[#cbd5e1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>' +
      '</div>' +
      '<div class="col-span-3 text-right"><span class="text-[#94a3b8] font-montserrat font-normal text-[13px] uppercase">' + esc(vd.duracion) + '</span></div>' +
      '</div>' +
      '<div class="grid grid-cols-12 items-center gap-4">' +
      '<div class="col-span-3"><span class="text-[#64748b] font-montserrat font-bold text-[12px] tracking-widest block uppercase">LLEGADA</span></div>' +
      '<div class="col-span-4"><span class="text-[#94a3b8] font-montserrat font-bold text-[13px] tracking-wide uppercase">' + esc(vd.destino) + '</span></div>' +
      '<div class="col-span-2 text-center"><span class="text-[#64748b] font-montserrat font-normal text-[15px]">' + esc(vd.llegada) + '</span></div>' +
      '<div class="col-span-3"></div>' +
      '</div></div></div>';
  }

  function svCierre(v, pax, tar, money) {
    var equipajeItems = String(v.equipaje || '').split('\n').filter(Boolean).map(function (e) {
      return '<div class="text-[13px] font-montserrat font-normal text-[#334155] uppercase mb-0.5">' + esc(e) + '</div>';
    }).join('');
    var restriccionesDefault = 'NO REEMBOLSABLE\nNO TRANSFERIBLE\nPERMITE CAMBIO CON PENALIDAD + DIFERENCIA TARIFARIA (EN CASO DE QUE APLIQUE)';
    var restriccionesItems = restriccionesDefault.split('\n').filter(Boolean).map(function (r) {
      return '<div class="text-[13px] font-montserrat font-normal text-[#334155] uppercase mb-0.5">• ' + esc(r) + '</div>';
    }).join('');

    return '' +
      // mt-auto: el cierre se ancla al pie de la última hoja
      '<div class="sv-cierre mt-auto shrink-0">' +
      '<div class="mt-2 mb-5">' +
      '<div class="flex items-center gap-3 mb-4">' +
      '<div class="w-12 h-12 shrink-0 rounded-full border-2 border-[#800080] flex items-center justify-center bg-[#fdf5ff] overflow-hidden">' +
      '<img src="assets/img/Boletos.png" alt="Boletos" class="w-8 h-8 object-contain"></div>' +
      '<h3 class="text-[#800080] font-montserrat font-extrabold text-[14px] tracking-wide uppercase">RESTRICCIONES / ' + esc(v.pnr) + '</h3>' +
      '</div>' +
      '<div class="pl-4">' +
      '<div class="text-[#64748b] font-montserrat font-bold text-[13px] uppercase mb-3">TARIFA INCLUYE TODOS LOS IMPUESTOS Y TASAS</div>' +
      '<div class="mb-3"><div class="text-[#64748b] font-montserrat font-bold text-[13px] uppercase mb-1">FRANQUICIA DE EQUIPAJE</div>' + equipajeItems + '</div>' +
      '<div><div class="text-[#64748b] font-montserrat font-bold text-[13px] uppercase mb-1">RESTRICCIONES:</div>' + restriccionesItems + '</div>' +
      '</div></div>' +
      '<div class="mb-5">' +
      '<div class="pl-4 mb-2 text-[13px]">' +
      '<span class="text-[#800080] font-montserrat font-extrabold uppercase">ADULTOS</span> <span class="text-[#800080] font-montserrat font-normal ml-1">' + pax.adultos + '</span>' +
      '<span class="text-[#800080] font-montserrat font-normal mx-2">-</span>' +
      '<span class="text-[#800080] font-montserrat font-extrabold uppercase">NIÑOS</span> <span class="text-[#800080] font-montserrat font-normal ml-1">' + pax.ninos + '</span>' +
      '<span class="text-[#800080] font-montserrat font-normal mx-2">-</span>' +
      '<span class="text-[#800080] font-montserrat font-extrabold uppercase">INFANTES</span> <span class="text-[#800080] font-montserrat font-normal ml-1">' + pax.infantes + '</span>' +
      '</div>' +
      '<div class="flex justify-between items-end mt-6 mb-2 px-4">' +
      '<div class="w-40"><img src="assets/img/ViajesHoly logo2.png" alt="Viajes Holy" class="h-8 w-auto opacity-80 object-contain"></div>' +
      '<div class="flex flex-col items-end gap-2 text-right">' +
      '<div class="flex justify-between w-[300px] items-center pr-6">' +
      '<span class="text-[#94a3b8] font-montserrat font-normal text-[12px] uppercase tracking-wide">TARIFA POR ADULTO</span>' +
      '<span class="text-[#64748b] font-montserrat font-normal text-[14px]">' + money(tar.tarifaPorAdulto) + '</span></div>' +
      '<div class="flex justify-between w-[300px] items-center mt-3 mb-2 pr-6">' +
      '<span class="text-[#94a3b8] font-montserrat font-normal text-[12px] uppercase tracking-wide">TARIFA POR NIÑO</span>' +
      '<span class="text-[#64748b] font-montserrat font-normal text-[14px]">' + money(tar.tarifaPorNino) + '</span></div>' +
      '<div class="flex justify-between w-[330px] items-center mt-2">' +
      '<span class="text-[#94a3b8] font-montserrat font-normal text-[12px] uppercase tracking-wide pr-4">TOTAL ' + pax.adultos + ' ADT - ' + pax.ninos + ' CHD - ' + pax.infantes + ' INF</span>' +
      '<div class="bg-[#800080] text-white px-7 py-3 rounded-xl shadow-md border-b-[4px] border-[#560B5B] min-w-[120px] text-center">' +
      '<span class="font-montserrat font-black text-xl">' + money(tar.montoTotal) + '</span>' +
      '</div></div></div></div></div>' +
      '</div>';
  }

  function svBarra(pagina, total) {
    var num = total > 1
      ? '<span class="text-white/90 font-montserrat font-bold text-[10px] tracking-widest">' + pagina + ' / ' + total + '</span>'
      : '';
    return '<div class="w-full bg-[#800080] rounded-t-[2.5rem] shrink-0 flex items-center justify-center" style="height:30px">' + num + '</div>';
  }

  function renderSoloVueloPDF(t, q) {
    q = q || {};
    var v = q.vuelo || {};
    var pax = q.pasajeros || { adultos: 0, ninos: 0, infantes: 0 };
    var tar = q.tarifas || {};
    var moneda = tar.moneda || 'USD';
    var money = function (n) {
      return esc(root.Monext ? root.Monext.formatMoney(n, moneda) : n);
    };

    var paginas = paginarSoloVuelo(v.dinamicos || [], v.equipaje);
    var total = paginas.length;
    var hojas = paginas.map(function (pg, idx) {
      var n = idx + 1;
      return '' +
        '<div id="page' + n + '" class="page-sheet sv-hoja bg-white flex flex-col" style="padding-top:40px; padding-bottom:0;">' +
        '<div class="px-14 flex-1 min-h-0 flex flex-col">' +
        (idx === 0 ? svCabecera(v, q) : svCabeceraCompacta(v, n, total)) +
        '<div class="sv-vuelos shrink-0">' + pg.vuelos.map(svVuelo).join('') + '</div>' +
        (pg.cierre ? svCierre(v, pax, tar, money) : '') +
        '</div>' +
        svBarra(n, total) +
        '</div>';
    });

    // page1 = primera hoja; page2 = todas las continuaciones (0..n hojas)
    return { page1: hojas[0], page2: hojas.slice(1).join(''), paginas: total };
  }

  // ---- PRESENTACIÓN DE PLANTILLA ----
  function buildTemplate(t) {
    t = (t && typeof t === 'object') ? t : {};
    var items = (t.inclusiones || []).map(function (inc) {
      return '<li class="flex items-start gap-2.5"><span class="text-holyPurple text-base leading-none font-montserrat font-bold">•</span>' +
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
      '<p class="text-holyGray font-montserrat font-normal text-base uppercase">' + esc(t.destino) + ' - <span class="text-holyPurple font-montserrat font-black">' + esc(t.nombrePosada) + '</span></p>' +
      '</div></div>' +
      '<div class="rounded-2xl overflow-hidden shadow-md border border-gray-100 mb-6 flex-1 relative">' + celdaFoto(fotoPortadaDe(t)) + '</div>' +
      '</div>' +
      '<div class="border-t border-gray-100 pt-5 mb-8">' +
      '<p class="text-holyPurple font-montserrat font-black text-sm uppercase tracking-wide mb-3">INCLUYE</p>' +
      '<ul class="space-y-2 text-[13px] text-holyGray font-montserrat font-normal">' + items + '</ul>' +
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
      '<p class="text-holyGray font-montserrat font-normal text-base uppercase">' + esc(t.destino) + ' - <span class="text-holyPurple font-montserrat font-black">' + esc(t.nombrePosada) + '</span></p>' +
      '</div></div>' +
      renderPhotoGrid(t.imagenesBase64 || [], t.layoutFotos) +
      '</div>' +
      '<div class="text-center pt-4 border-t border-gray-100">' +
      '<span class="text-[11px] text-slate-800 font-montserrat font-medium tracking-wider uppercase">' + esc(t.nombrePosada) + ' - ' + esc(t.destino) + '</span></div>' +
      '</div>';

    return { page1: page1, page2: page2 };
  }

  function buildPreview(t, q) {
    if (q && (q.tipoPaquete || '').toUpperCase() === 'SOLO VUELO') {
      return renderSoloVueloPDF(t, q);
    }
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
    renderSoloVueloPDF: renderSoloVueloPDF,
    paginarSoloVuelo: paginarSoloVuelo,
  };
})(typeof self !== 'undefined' ? self : this);
