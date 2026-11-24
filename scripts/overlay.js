'use strict';

/*
 * Native iOS overlay. Uses UIKit through Frida's ObjC bridge, so it does
 * not depend on Unity's GUI and survives scene changes.
 */

var Overlay = (function () {
  var UIView, UILabel, UIFont, UIColor, window, root;
  var boxPool = {};
  var labelPool = {};
  var barPool = {};
  var radarRoot = null;
  var radarBlips = {};
  var cfg = null;
  var ready = false;

  function uiColor(rgba) {
    return UIColor.colorWithRed_green_blue_alpha_(rgba.r, rgba.g, rgba.b, rgba.a);
  }

  function rect(x, y, w, h) {
    return { x: x, y: y, width: w, height: h };
  }

  function init(config) {
    if (ready) return true;
    cfg = config;

    UIView = ObjC.classes.UIView;
    UILabel = ObjC.classes.UILabel;
    UIFont = ObjC.classes.UIFont;
    UIColor = ObjC.classes.UIColor;

    var app = ObjC.classes.UIApplication.sharedApplication();
    window = app.keyWindow();
    if (!window) {
      var windows = app.windows();
      if (windows && windows.count() > 0) window = windows.objectAtIndex_(0);
    }
    if (!window) {
      console.warn('[overlay] no window yet');
      return false;
    }

    var bounds = window.bounds();
    var w = bounds.width !== undefined ? bounds.width : bounds.size.width;
    var h = bounds.height !== undefined ? bounds.height : bounds.size.height;

    root = UIView.alloc().initWithFrame_(rect(0, 0, w, h));
    root.setUserInteractionEnabled_(false);
    root.setTag_(991337);
    window.addSubview_(root);

    if (cfg.radar && cfg.radar.enabled) buildRadar(w, h);

    ready = true;
    console.log('[overlay] ready ' + w + 'x' + h);
    return true;
  }

  function buildRadar(screenW, screenH) {
    var size = cfg.radar.size;
    var margin = 16;
    var x = screenW - size - margin;
    var y = screenH - size - margin - 90;

    radarRoot = UIView.alloc().initWithFrame_(rect(x, y, size, size));
    radarRoot.layer().setCornerRadius_(size / 2);
    radarRoot.layer().setBorderWidth_(1);
    radarRoot.layer().setBorderColor_(UIColor.whiteColor().CGColor());
    radarRoot.setBackgroundColor_(UIColor.colorWithRed_green_blue_alpha_(0.02, 0.03, 0.06, cfg.radar.opacity));
    radarRoot.setClipsToBounds_(true);

    var crossV = UIView.alloc().initWithFrame_(rect(size / 2, 0, 1, size));
    crossV.setBackgroundColor_(UIColor.colorWithWhite_alpha_(1, 0.18));
    radarRoot.addSubview_(crossV);

    var crossH = UIView.alloc().initWithFrame_(rect(0, size / 2, size, 1));
    crossH.setBackgroundColor_(UIColor.colorWithWhite_alpha_(1, 0.18));
    radarRoot.addSubview_(crossH);

    var circle = UIView.alloc().initWithFrame_(rect(4, 4, size - 8, size - 8));
    circle.layer().setCornerRadius_((size - 8) / 2);
    circle.layer().setBorderWidth_(1);
    circle.layer().setBorderColor_(UIColor.colorWithWhite_alpha_(1, 0.2).CGColor());
    radarRoot.addSubview_(circle);

    root.addSubview_(radarRoot);
  }

  function ensureBox(id) {
    if (boxPool[id]) return boxPool[id];
    var v = UIView.alloc().initWithFrame_(rect(0, 0, 0, 0));
    v.layer().setBorderWidth_(1.4);
    v.setUserInteractionEnabled_(false);
    root.addSubview_(v);
    boxPool[id] = v;
    return v;
  }

  function ensureLabel(id) {
    if (labelPool[id]) return labelPool[id];
    var l = UILabel.alloc().initWithFrame_(rect(0, 0, 120, 16));
    l.setFont_(UIFont.boldSystemFontOfSize_(11));
    l.setTextColor_(UIColor.whiteColor());
    l.setTextAlignment_(1);
    l.setNumberOfLines_(1);
    l.setShadowColor_(UIColor.blackColor());
    l.setShadowOffset_({ width: 0, height: 1 });
    root.addSubview_(l);
    labelPool[id] = l;
    return l;
  }

  function ensureBar(id) {
    if (barPool[id]) return barPool[id];
    var bg = UIView.alloc().initWithFrame_(rect(0, 0, 0, 4));
    bg.setBackgroundColor_(UIColor.colorWithWhite_alpha_(0, 0.55));
    var fg = UIView.alloc().initWithFrame_(rect(0, 0, 0, 4));
    fg.setTag_(1);
    bg.addSubview_(fg);
    root.addSubview_(bg);
    barPool[id] = { bg: bg, fg: fg };
    return barPool[id];
  }

  function ensureBlip(id) {
    if (radarBlips[id]) return radarBlips[id];
    var b = UIView.alloc().initWithFrame_(rect(0, 0, 6, 6));
    b.layer().setCornerRadius_(3);
    radarRoot.addSubview_(b);
    radarBlips[id] = b;
    return b;
  }

  function update(targets, radarTargets) {
    if (!ready) {
      if (!init(cfg)) return;
    }

    var seen = {};
    var esp = cfg.esp;

    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      var id = t.id;
      seen[id] = true;
      var col = Lib.hexToRGBA(t.team ? esp.teamColor : esp.enemyColor, 1);

      if (esp.boxes && t.w > 0 && t.h > 0) {
        var box = ensureBox(id);
        box.setFrame_(rect(t.x - t.w / 2, t.y - t.h, t.w, t.h));
        box.layer().setBorderColor_(uiColor(col).CGColor());
        box.setBackgroundColor_(uiColor(Lib.hexToRGBA(t.team ? esp.teamColor : esp.enemyColor, esp.fillAlpha)));
        box.setHidden_(false);
      }

      if (esp.health) {
        var bar = ensureBar(id);
        var bw = Math.max(20, t.w);
        bar.bg.setFrame_(rect(t.x - bw / 2, t.y - t.h - 7, bw, 4));
        var hp = Lib.clamp(t.health / 100, 0, 1);
        bar.fg.setFrame_(rect(0, 0, bw * hp, 4));
        bar.fg.setBackgroundColor_(uiColor(col));
        bar.bg.setHidden_(false);
      }

      if (esp.names || esp.distance) {
        var label = ensureLabel(id);
        var text = '';
        if (esp.names) text += t.name || 'player';
        if (esp.distance) text += (text ? '  ' : '') + Math.round(t.dist) + 'm';
        label.setText_(text);
        label.setTextColor_(uiColor(col));
        label.setFrame_(rect(t.x - 90, t.y - t.h - 24, 180, 16));
        label.setHidden_(false);
      }
    }

    for (var key in boxPool) if (!seen[key]) boxPool[key].setHidden_(true);
    for (var key2 in labelPool) if (!seen[key2]) labelPool[key2].setHidden_(true);
    for (var key3 in barPool) if (!seen[key3]) barPool[key3].bg.setHidden_(true);

    var radarSeen = {};
    if (radarRoot && radarTargets) {
      var size = cfg.radar.size;
      var range = cfg.radar.range;
      for (var j = 0; j < radarTargets.length; j++) {
        var r = radarTargets[j];
        radarSeen[r.id] = true;
        var blip = ensureBlip(r.id);
        var bx = size / 2 + Lib.clamp(r.dx / range, -1, 1) * (size / 2 - 8) - 3;
        var by = size / 2 + Lib.clamp(r.dz / range, -1, 1) * (size / 2 - 8) - 3;
        blip.setFrame_(rect(bx, by, 6, 6));
        var rc = Lib.hexToRGBA(r.team ? cfg.esp.teamColor : cfg.esp.enemyColor, 1);
        blip.setBackgroundColor_(uiColor(rc));
        blip.setHidden_(false);
      }
      for (var k in radarBlips) if (!radarSeen[k]) radarBlips[k].setHidden_(true);
    }
  }

  function size() {
    if (!ready || !root) return { w: 0, h: 0 };
    var b = root.bounds();
    return {
      w: b.width !== undefined ? b.width : b.size.width,
      h: b.height !== undefined ? b.height : b.size.height
    };
  }

  function destroy() {
    if (!ready) return;
    root.removeFromSuperview();
    boxPool = {};
    labelPool = {};
    barPool = {};
    radarBlips = {};
    radarRoot = null;
    ready = false;
  }

  return { init: init, update: update, size: size, destroy: destroy };
})();
