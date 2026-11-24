'use strict';

/*
 * Entry point. The loader injects lib.js, overlay.js, esp.js, aimbot.js,
 * then this file. Config arrives through rpc.exports.setConfig().
 */

var CONFIG = null;
var hooked = false;
var frameCount = 0;

function init(config) {
  CONFIG = config;

  if (!OverlaysReady()) {
    setTimeout(function () { init(config); }, 300);
    return;
  }

  Overlay.init(CONFIG);
  installHook();
  console.log('[main] loaded, config applied');
}

function OverlaysReady() {
  return typeof ObjC !== 'undefined' && ObjC.classes.UIApplication &&
         typeof Il2Cpp !== 'undefined';
}

function installHook() {
  if (hooked) return;
  var s = CONFIG.symbols;

  Il2Cpp.perform(function () {
    var target = Lib.klass(s.frameAssembly, s.frameClass) ||
                 Lib.searchClass(s.frameClass, s.frameAssembly);

    var onFrame = function () {
      if (!CONFIG) return;
      frameCount++;

      try {
        var screen = Overlay.size();
        if (!screen.w || !screen.h) {
          screen = { w: 1170, h: 2532 };
        }

        if (frameCount % 2 === 0) {
          ESP.refresh(CONFIG);
        }

        var data = ESP.collect(CONFIG, screen.w, screen.h);
        Overlay.update(data.targets, data.radar);
        Aimbot.run(CONFIG, data.targets, screen.w, screen.h);
      } catch (e) {
        console.error('[main] frame: ' + e);
      }
    };

    var installed = Lib.hook(target, s.frameMethod, 0, onFrame, null);
    if (!installed) {
      console.warn('[main] frame hook failed, falling back to setInterval');
      setInterval(onFrame, 25);
    }
    hooked = true;
  });
}

rpc.exports = {
  setConfig: function (config) {
    init(config);
  },
  getStatus: function () {
    return {
      hooked: hooked,
      frames: frameCount,
      players: Game.players ? Game.players.length : 0,
      targets: 0
    };
  }
};
