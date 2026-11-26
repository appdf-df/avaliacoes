// Simulador mínimo dos serviços do Google Apps Script, para testes locais.
// Usado apenas por ferramentas/testar.sh (não vai para o Apps Script).
/* eslint-disable */
var __formulas = [];          // valores gravados que a planilha leria como fórmula
var __saida = [];
if (typeof console === 'undefined' || !console.error) {
  var console = { log: function () {}, error: function () {} };
}
function __fmtData(d) {
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
}
function __encadear(alvo) {
  var px = new Proxy(alvo, {
    get: function (t, k) {
      if (k in t) return t[k];
      return function () { return px; };
    },
  });
  return px;
}

function __Range(sh, r, c, nr, nc) {
  this.sh = sh; this.r = r; this.c = c; this.nr = nr || 1; this.nc = nc || 1;
  this._proxy = __encadear(this);
  return this._proxy;
}
__Range.prototype.getValues = function () {
  var out = [];
  for (var i = 0; i < this.nr; i++) {
    var row = [];
    for (var j = 0; j < this.nc; j++) {
      var ln = this.sh.dados[this.r - 1 + i] || [];
      var v = ln[this.c - 1 + j];
      row.push(v === undefined ? '' : v);
    }
    out.push(row);
  }
  return out;
};
__Range.prototype.getDisplayValues = function () {
  return this.getValues().map(function (r) {
    return r.map(function (v) { return v instanceof Date ? __fmtData(v) : String(v); });
  });
};
__Range.prototype.getValue = function () { return this.getValues()[0][0]; };
__Range.prototype.setValues = function (vals) {
  if (vals.length !== this.nr || vals[0].length !== this.nc) throw new Error('setValues: dimensões não conferem');
  for (var i = 0; i < this.nr; i++) {
    var idx = this.r - 1 + i;
    while (this.sh.dados.length <= idx) this.sh.dados.push([]);
    for (var j = 0; j < this.nc; j++) {
      var v = vals[i][j];
      if (typeof v === 'string' && v.charAt(0) === "'") v = v.slice(1);          // prefixo de texto puro
      else if (typeof v === 'string' && /^[=+\-@]/.test(v)) __formulas.push(v);  // seria fórmula
      this.sh.dados[idx][this.c - 1 + j] = v;
    }
  }
  return this._proxy;
};
__Range.prototype.setValue = function (v) { return this.setValues([[v]]); };
__Range.prototype.clearContent = function () {
  var v = []; for (var i = 0; i < this.nr; i++) { var r = []; for (var j = 0; j < this.nc; j++) r.push(''); v.push(r); }
  return this.setValues(v);
};
__Range.prototype.getRow = function () { return this.r; };
__Range.prototype.sort = function (specs) {
  var vals = this.getValues();
  vals.sort(function (a, b) {
    for (var i = 0; i < specs.length; i++) {
      var c = specs[i].column - 1, x = String(a[c]), y = String(b[c]);
      if (x !== y) return (x < y ? -1 : 1) * (specs[i].ascending === false ? -1 : 1);
    }
    return 0;
  });
  for (var i = 0; i < vals.length; i++) for (var j = 0; j < vals[i].length; j++) this.sh.dados[this.r - 1 + i][this.c - 1 + j] = vals[i][j];
  return this._proxy;
};

function __Sheet(nome) { this.nome = nome; this.dados = []; this._proxy = __encadear(this); return this._proxy; }
__Sheet.prototype.getName = function () { return this.nome; };
__Sheet.prototype.getRange = function (r, c, nr, nc) { return new __Range(this, r, c, nr, nc); };
__Sheet.prototype.getLastRow = function () {
  for (var i = this.dados.length - 1; i >= 0; i--) {
    if ((this.dados[i] || []).some(function (v) { return v !== '' && v !== undefined && v !== null; })) return i + 1;
  }
  return 0;
};
__Sheet.prototype.getLastColumn = function () {
  var m = 0;
  this.dados.forEach(function (ln) {
    for (var j = (ln || []).length - 1; j >= 0; j--) {
      if (ln[j] !== '' && ln[j] !== undefined && ln[j] !== null) { m = Math.max(m, j + 1); break; }
    }
  });
  return m;
};
__Sheet.prototype.clear = function () { this.dados = []; return this._proxy; };
__Sheet.prototype.getMaxRows = function () { return Math.max(1000, this.dados.length); };
__Sheet.prototype.getRangeList = function () { return __encadear({}); };

function __Planilha(nome) {
  this.nome = nome; this.abas = []; this.id = 'PLANILHA_TESTE'; this._proxy = __encadear(this); return this._proxy;
}
__Planilha.prototype.getSheetByName = function (n) { return this.abas.filter(function (a) { return a.getName() === n; })[0] || null; };
__Planilha.prototype.insertSheet = function (n) { var s = new __Sheet(n); this.abas.push(s); return s; };
__Planilha.prototype.getSheets = function () { return this.abas.slice(); };
__Planilha.prototype.deleteSheet = function (s) { this.abas = this.abas.filter(function (a) { return a !== s; }); };
__Planilha.prototype.getId = function () { return this.id; };
__Planilha.prototype.getUrl = function () { return 'https://docs.google.com/spreadsheets/d/PLANILHA_TESTE'; };
__Planilha.prototype.getName = function () { return this.nome; };
__Planilha.prototype.rename = function (n) { this.nome = n; };

var __ss = new __Planilha('Planilha sem título');
__ss.insertSheet('Página1');

var SpreadsheetApp = {
  getActiveSpreadsheet: function () { return __ss; },
  openById: function () { return __ss; },
  create: function () { return __ss; },
  newDataValidation: function () { return __encadear({}); },
  getUi: function () { throw new Error('Sem interface no teste'); },
  BorderStyle: { SOLID: 'SOLID', SOLID_MEDIUM: 'SOLID_MEDIUM' },
  BandingTheme: { LIGHT_GREY: 'LIGHT_GREY' },
  WrapStrategy: { WRAP: 'WRAP', CLIP: 'CLIP' },
  newConditionalFormatRule: function () { return __encadear({}); },
};
var __props = {};
var PropertiesService = { getScriptProperties: function () {
  return { getProperty: function (k) { return __props[k] || null; }, setProperty: function (k, v) { __props[k] = v; }, deleteProperty: function (k) { delete __props[k]; } };
} };
var LockService = { getScriptLock: function () { return { tryLock: function () { return true; }, releaseLock: function () {} }; } };
var __cache = {};
var CacheService = { getScriptCache: function () {
  return { get: function (k) { return __cache[k] || null; }, put: function (k, v) { __cache[k] = v; }, remove: function (k) { delete __cache[k]; } };
} };
var Utilities = {
  getUuid: function () { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function () { return (Math.random() * 16 | 0).toString(16); }); },
  formatDate: function (d, tz, f) {
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    if (f === 'yyyy') return String(d.getFullYear());
    if (f === 'dd/MM/yyyy') return __fmtData(d);
    if (f === 'yyyy-MM-dd') return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    return __fmtData(d) + ' 10:00';
  },
};
var ScriptApp = { getService: function () { return { getUrl: function () { return 'https://script.google.com/macros/s/TESTE/exec'; } }; } };
var Logger = { log: function (m) { __saida.push(String(m)); } };

var ContentService = {
  MimeType: { JSON: 'json' },
  createTextOutput: function (t) { var o = { __texto: t, setMimeType: function () { return o; } }; return o; },
};
var HtmlService = { createHtmlOutput: function (h) { var o = { __texto: h, setTitle: function () { return o; } }; return o; } };
