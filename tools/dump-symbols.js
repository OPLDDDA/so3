'use strict';

/* Load this script alone to discover real class/method names in your build. */

function dump(keywords) {
  var out = [];
  Il2Cpp.perform(function () {
    var needles = (keywords || []).map(function (k) { return String(k).toLowerCase(); });
    var assemblies = Il2Cpp.domain().assemblies;
    for (var i = 0; i < assemblies.length; i++) {
      var asm = assemblies[i];
      var classes = [];
      try { classes = asm.image().classes; } catch (e) { continue; }
      for (var j = 0; j < classes.length; j++) {
        var c = classes[j];
        var cname = c.name || '';
        var lower = cname.toLowerCase();
        var hit = needles.length === 0;
        for (var k = 0; k < needles.length; k++) {
          if (lower.indexOf(needles[k]) !== -1) { hit = true; break; }
        }
        if (!hit) continue;

        var methods = c.methods.map(function (m) {
          return m.name + '(' + m.parameterCount + ')';
        }).slice(0, 80).join(', ');

        out.push('[' + asm.name + '] ' + cname + ' :: ' + methods);
      }
    }
  });
  return out.join('\n');
}

rpc.exports = { dump: dump };
console.log('[dump] ready. call: script.exports.dump(["player","camera","weapon"])');
