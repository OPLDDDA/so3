'use strict';

/*
 * Aimbot + triggerbot. Drives the local transform through IL2CPP calls.
 * If your build exposes a different rotation API, change applyAim() only.
 */

var Aimbot = (function () {
  var lastFire = 0;
  var aimCache = null;

  function angleTo(cx, cy, screenW, screenH, target) {
    var dx = target.x - screenW / 2;
    var dy = target.y - screenH / 2;
    var dist = Math.sqrt(dx * dx + dy * dy);
    return Math.atan2(dy, dx) * 180 / Math.PI;
  }

  function pickTarget(cfg, targets, screenW, screenH) {
    var best = null;
    var bestScore = Infinity;
    var fov = cfg.aimbot.fov;
    var maxDist = cfg.aimbot.maxDistance;

    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      if (t.team || t.dist > maxDist) continue;
      var dx = t.x - screenW / 2;
      var dy = t.y - screenH / 2;
      var px = Math.abs(dx) / (screenW / 2);
      var py = Math.abs(dy) / (screenH / 2);
      var offset = Math.sqrt(px * px + py * py) * fov;
      if (offset > fov) continue;
      var score = offset + t.dist * 0.05;
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }

  function setVecField(vec, axis, value) {
    if (!vec) return;
    try {
      var f = vec.field(axis);
      if (f) f.value = value;
    } catch (e) { /* value type exposed as plain object */ }
    try {
      if (vec[axis] !== undefined) vec[axis] = value;
    } catch (e) { /* ignore */ }
  }

  function applyAim(cfg, target, localTransform) {
    if (!target || !localTransform) return;
    var s = cfg.symbols;
    var smooth = Lib.clamp(cfg.aimbot.smooth, 1, 60);
    var factor = 1 / smooth;
    var bone = cfg.aimbot.bone === 'head' ? cfg.aimbot.headOffset : 0.9;

    var desired = Lib.parseVector(target.pos);
    desired.y += bone;

    if (!aimCache) aimCache = { x: Game.localPos.x, y: Game.localPos.y, z: Game.localPos.z };

    aimCache.x += (desired.x - aimCache.x) * factor;
    aimCache.y += (desired.y - aimCache.y) * factor;
    aimCache.z += (desired.z - aimCache.z) * factor;

    var point = Lib.invoke(localTransform, s.positionMethod, []);
    if (!point) return;

    setVecField(point, 'x', aimCache.x);
    setVecField(point, 'y', aimCache.y);
    setVecField(point, 'z', aimCache.z);

    var lookAt = Lib.method(localTransform, 'LookAt', 1) ||
                 Lib.method(localTransform, 'LookAt', 3);
    if (lookAt) {
      try {
        if (lookAt.parameterCount === 1) lookAt.invoke(localTransform, point);
        else lookAt.invoke(localTransform, aimCache.x, aimCache.y, aimCache.z);
      } catch (e) { /* rotation API mismatch */ }
      return;
    }

    var setRot = Lib.method(localTransform, 'set_rotation', 1);
    var quatClass = Lib.klass('UnityEngine.CoreModule', 'UnityEngine.Quaternion');
    var lookRotation = quatClass ? Lib.method(quatClass, 'LookRotation', 1) : null;
    if (setRot && lookRotation) {
      try {
        var direction = Lib.invoke(localTransform, s.positionMethod, []);
        setVecField(direction, 'x', aimCache.x - Game.localPos.x);
        setVecField(direction, 'y', aimCache.y - Game.localPos.y);
        setVecField(direction, 'z', aimCache.z - Game.localPos.z);
        var quat = lookRotation.invoke(null, direction);
        setRot.invoke(localTransform, quat);
      } catch (e) { /* rotation API mismatch */ }
    }
  }

  function run(cfg, targets, screenW, screenH) {
    var s = cfg.symbols;
    var localTransform = Game.local ? Lib.invoke(Game.local, s.transformMethod, []) : null;

    if (cfg.aimbot && cfg.aimbot.enabled) {
      var target = pickTarget(cfg, targets, screenW, screenH);
      if (target) applyAim(cfg, target, localTransform);
    }

    if (cfg.triggerbot && cfg.triggerbot.enabled && Game.local) {
      var now = Date.now();
      if (now - lastFire >= cfg.triggerbot.delayMs) {
        var hot = false;
        for (var i = 0; i < targets.length; i++) {
          var t = targets[i];
          if (t.team || t.dist > cfg.aimbot.maxDistance) continue;
          if (Math.abs(t.x - screenW / 2) < t.w * 0.55 &&
              Math.abs(t.y - t.h / 2 - screenH / 2) < t.h * 0.55) {
            hot = true;
            break;
          }
        }
        if (hot) {
          var fire = Lib.method(Game.local, s.fireMethod, 0) ||
                     Lib.method(Game.local, s.fireMethod, 1);
          if (fire) {
            try {
              if (fire.parameterCount === 0) fire.invoke(Game.local);
              else fire.invoke(Game.local, true);
              lastFire = now;
            } catch (e) { /* fire signature mismatch */ }
          }
        }
      }
    }
  }

  function reset() {
    aimCache = null;
    lastFire = 0;
  }

  return { run: run, reset: reset };
})();
