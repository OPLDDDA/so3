'use strict';

/*
 * IL2CPP helpers. Frida 16.2+ required.
 * All lookups are name-based so a game update only breaks the config,
 * not the whole script.
 */

var Lib = (function () {
  function domain() {
    return Il2Cpp.domain();
  }

  function image(assemblyName) {
    return domain().assembly(assemblyName).image();
  }

  function klass(assemblyName, className) {
    try {
      return image(assemblyName).class(className);
    } catch (e) {
      return null;
    }
  }

  function searchClass(fragment, assemblyName) {
    var needle = fragment.toLowerCase();
    var assemblies = domain().assemblies;
    for (var i = 0; i < assemblies.length; i++) {
      var asm = assemblies[i];
      if (assemblyName && asm.name !== assemblyName) continue;
      var classes = [];
      try { classes = asm.image().classes; } catch (e) { continue; }
      for (var j = 0; j < classes.length; j++) {
        var name = classes[j].name || '';
        if (name.toLowerCase().indexOf(needle) !== -1) return classes[j];
      }
    }
    return null;
  }

  function method(target, name, argCount) {
    if (!target) return null;
    var methods = target.methods || [];
    for (var i = 0; i < methods.length; i++) {
      var m = methods[i];
      if (m.name !== name) continue;
      if (argCount !== undefined && m.parameterCount !== argCount) continue;
      return m;
    }
    return null;
  }

  function field(instance, name) {
    if (!instance) return null;
    try { return instance.field(name); } catch (e) { return null; }
  }

  function value(instance, name, fallback) {
    var f = field(instance, name);
    if (!f) return fallback;
    try { return f.value; } catch (e) { return fallback; }
  }

  function invoke(instance, name, args) {
    var m = method(instance, name, args ? args.length : 0);
    if (!m) return null;
    try {
      return args && args.length ? m.invoke(instance, args) : m.invoke(instance);
    } catch (e) {
      console.error('[lib] invoke ' + name + ': ' + e);
      return null;
    }
  }

  function staticInvoke(target, name, args) {
    var m = method(target, name, args ? args.length : 0);
    if (!m) return null;
    try {
      return args && args.length ? m.invoke(null, args) : m.invoke(null);
    } catch (e) {
      console.error('[lib] staticInvoke ' + name + ': ' + e);
      return null;
    }
  }

  function hook(target, name, argCount, onEnter, onLeave) {
    var m = method(target, name, argCount);
    if (!m) {
      console.warn('[lib] hook: method not found ' + name);
      return null;
    }
    var original = m.implementation;
    m.implementation = function () {
      var args = Array.prototype.slice.call(arguments);
      var state = onEnter ? onEnter.apply(this, args) : null;
      var result = original.apply(this, arguments);
      if (onLeave) onLeave.call(this, result, state, args);
      return result;
    };
    return m;
  }

  function pointerOf(obj) {
    if (!obj) return '0';
    try { return obj.handle ? obj.handle.toString() : String(obj); } catch (e) { return '0'; }
  }

  function toNumber(v, fallback) {
    var n = Number(v);
    return isNaN(n) ? (fallback || 0) : n;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function hexToRGBA(hex, alpha) {
    var h = String(hex || '#ffffff').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return {
      r: parseInt(h.slice(0, 2), 16) / 255,
      g: parseInt(h.slice(2, 4), 16) / 255,
      b: parseInt(h.slice(4, 6), 16) / 255,
      a: alpha === undefined ? 1 : alpha
    };
  }

  function parseVector(v) {
    if (!v) return { x: 0, y: 0, z: 0 };
    return {
      x: toNumber(v.x !== undefined ? v.x : value(v, 'x', 0)),
      y: toNumber(v.y !== undefined ? v.y : value(v, 'y', 0)),
      z: toNumber(v.z !== undefined ? v.z : value(v, 'z', 0))
    };
  }

  return {
    domain: domain,
    image: image,
    klass: klass,
    searchClass: searchClass,
    method: method,
    field: field,
    value: value,
    invoke: invoke,
    staticInvoke: staticInvoke,
    hook: hook,
    pointerOf: pointerOf,
    toNumber: toNumber,
    clamp: clamp,
    hexToRGBA: hexToRGBA,
    parseVector: parseVector
  };
})();
