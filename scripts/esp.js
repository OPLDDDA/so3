'use strict';

/*
 * Game state reader + ESP projection.
 * Everything is name-driven from config.json "symbols".
 */

var Game = {
  camera: null,
  local: null,
  localPos: { x: 0, y: 0, z: 0 },
  players: [],
  screen: { w: 0, h: 0 }
};

var ESP = (function () {
  function toArray(list) {
    if (!list) return [];
    if (Array.isArray(list)) return list;
    var out = [];
    var countM = Lib.method(list, 'get_Count', 0) || Lib.method(list, 'get_count', 0);
    var itemM = Lib.method(list, 'get_Item', 1);
    if (countM && itemM) {
      var count = Lib.clamp(Lib.toNumber(countM.invoke(list), 0), 0, 2048);
      for (var i = 0; i < count; i++) {
        try { out.push(itemM.invoke(list, i)); } catch (e) { /* skip hole */ }
      }
      return out;
    }
    try {
      if (typeof list.length === 'number') {
        for (var j = 0; j < Math.min(list.length, 2048); j++) out.push(list[j]);
      }
    } catch (e) { /* not indexable */ }
    return out;
  }

  function stringify(v, fallback) {
    if (v === null || v === undefined) return fallback;
    try {
      if (v.content !== undefined) return String(v.content);
      return String(v);
    } catch (e) { return fallback; }
  }

  function refresh(cfg) {
    var s = cfg.symbols;
    var playerClass = Lib.klass(s.assembly, s.playerClass) || Lib.searchClass(s.playerClass, s.assembly);
    var cameraClass = Lib.klass(s.frameAssembly, 'UnityEngine.Camera');
    var camera = null;
    if (cameraClass) camera = Lib.staticInvoke(cameraClass, 'get_main', []);

    Game.camera = camera;

    if (playerClass) {
      var local = Lib.staticInvoke(playerClass, s.localPlayerMethod, []) ||
                  Lib.invoke(playerClass, s.localPlayerMethod, []);
      Game.local = local;

      var list = Lib.staticInvoke(playerClass, s.playersListMethod, []) ||
                 Lib.invoke(playerClass, s.playersListMethod, []);
      Game.players = toArray(list);

      if (local) {
        var lt = Lib.invoke(local, s.transformMethod, []);
        var lp = lt ? Lib.invoke(lt, s.positionMethod, []) : null;
        Game.localPos = Lib.parseVector(lp);
      }
    } else {
      Game.players = [];
    }
  }

  function project(worldObj) {
    if (!Game.camera || !worldObj) return null;
    var screen = Lib.invoke(Game.camera, 'WorldToScreenPoint', [worldObj]);
    if (!screen) return null;
    var v = Lib.parseVector(screen);
    if (v.z <= 0) return null;
    return v;
  }

  function collect(cfg, screenW, screenH) {
    var s = cfg.symbols;
    var targets = [];
    var radar = [];
    var esp = cfg.esp;
    var maxDist = esp.maxDistance;

    Game.screen.w = screenW;
    Game.screen.h = screenH;

    for (var i = 0; i < Game.players.length; i++) {
      var p = Game.players[i];
      if (!p) continue;
      if (Game.local && Lib.pointerOf(p) === Lib.pointerOf(Game.local)) continue;

      var transform = Lib.invoke(p, s.transformMethod, []);
      var worldObj = transform ? Lib.invoke(transform, s.positionMethod, []) : null;
      var pos = Lib.parseVector(worldObj);
      var dx = pos.x - Game.localPos.x;
      var dy = pos.y - Game.localPos.y;
      var dz = pos.z - Game.localPos.z;
      var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > maxDist) continue;

      var team = Lib.toNumber(Lib.value(p, s.teamField, -1), -1);
      var localTeam = Game.local ? Lib.toNumber(Lib.value(Game.local, s.teamField, -2), -2) : -2;
      var isTeam = team !== -1 && team === localTeam;
      var health = Lib.clamp(Lib.toNumber(Lib.value(p, s.healthField, 100), 100), 0, 100);
      var name = stringify(Lib.value(p, s.nameField, null), 'player');

      if (cfg.radar && cfg.radar.enabled) {
        radar.push({
          id: Lib.pointerOf(p),
          dx: dx,
          dz: dz,
          team: isTeam
        });
      }

      var sp = project(worldObj);
      if (!sp) continue;

      var height = Lib.clamp(14000 / Math.max(1, dist), 26, screenH * 0.9);
      var width = height * 0.42;
      var cx = sp.x;
      var cy = screenH - sp.y;

      if (cx < -200 || cx > screenW + 200 || cy < -200 || cy > screenH + 200) continue;

      targets.push({
        id: Lib.pointerOf(p),
        player: p,
        transform: transform,
        world: worldObj,
        pos: pos,
        x: cx,
        y: cy,
        w: width,
        h: height,
        dist: dist,
        team: isTeam,
        health: health,
        name: name
      });
    }

    return { targets: targets, radar: radar };
  }

  return { refresh: refresh, collect: collect, toArray: toArray, stringify: stringify };
})();
