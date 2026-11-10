/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Packs an overlay into a Mix It Up Custom Overlay Widget: the one JSON object Mix It Up shows for a widget, with its HTML, CSS and
 * JavaScript, and the settings travelling in a custom property. The shape is the one a Custom widget of Mix It Up's own had when it was
 * copied out of the app, so the app can read it back the same way.
 *
 * The widget's JavaScript is the overlay's own, with mixitup.js in front of it to hand the overlay the events it expects. The HTML is the
 * overlay's own inside one box that fills the page, so the overlay fills the widget as it fills a StreamElements widget.
 *
 * The same file runs in the dev pages, which pack an overlay with the settings as they are set up there, and in Node, which packs every
 * overlay with its defaults for the website and the tests. It uses no Node features. */
(function (root) {
  "use strict";

  // The properties Mix It Up replaces in a widget's text with its own values. The overlay's code must not contain one of these in curly
  // brackets, or Mix It Up would replace it, so a test checks that none does.
  var BUILT_IN = ["Layer", "XPosition", "YPosition", "PositionTypeUnit", "XTranslation", "YTranslation", "Width", "Height", "FontSize", "FontColor", "FontFamily", "FontWeight", "TextDecoration", "FontStyle", "TextAlignment", "ShadowColor"];
  var OWN = ["Settings"];

  function textToB64url(t) {
    var bytes = unescape(encodeURIComponent(t));
    return btoa(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // A version-5 style id made from the overlay's name, so packing the same overlay always gives the same id, and bringing it in again
  // is the same widget and not a second one. It is only a stable id, not a secret.
  function idFor(name) {
    var h = [0x811c9dc5, 0x01000193, 0x9e3779b1, 0x85ebca6b], s = "stream-overlays:" + name, out = "";
    for (var i = 0; i < s.length; i++) for (var k = 0; k < 4; k++) h[k] = (Math.imul(h[k] ^ s.charCodeAt(i), 0x01000193 + k * 2) >>> 0);
    for (var j = 0; j < 4; j++) out += ("00000000" + h[j].toString(16)).slice(-8);
    return out.slice(0, 8) + "-" + out.slice(8, 12) + "-4" + out.slice(13, 16) + "-8" + out.slice(17, 20) + "-" + out.slice(20, 32);
  }

  /** The settings of a fields.json as { key: starting value }, without buttons. */
  function defaultsOf(fields) {
    var out = {};
    Object.keys(fields || {}).forEach(function (k) {
      var f = fields[k];
      if (f && f.type !== "button" && f.type !== "section" && "value" in f) out[k] = f.value;
    });
    return out;
  }

  /** The editor buttons of a fields.json, as [{ field, label }], which Mix It Up commands can run by name. */
  function buttonsOf(fields) {
    var out = [];
    Object.keys(fields || {}).forEach(function (k) {
      var f = fields[k];
      if (f && f.type === "button") out.push({ field: k, label: String(f.label || k) });
    });
    return out;
  }

  /** Which of Mix It Up's reserved property names, in curly brackets, a piece of code contains. */
  function clashes(code) {
    return BUILT_IN.concat(OWN).filter(function (n) { return String(code).indexOf("{" + n + "}") !== -1; });
  }

  /**
   * parts: { name, title, html, css, js, adapter, fields (the fields.json object), settings (only the ones that differ) }
   * Returns the widget as an object, ready to be written out as JSON.
   */
  function pack(parts) {
    var defaults = defaultsOf(parts.fields), changed = parts.settings || {};
    var settings = Object.keys(changed).length ? textToB64url(JSON.stringify(changed)) : "";
    var js = "window.__miu = " + JSON.stringify({ name: parts.name, defaults: defaults, buttons: buttonsOf(parts.fields), settings: "{Settings}" }) + ";\n" + parts.adapter + "\n" + parts.js;
    // The overlay's root fills the widget's box. The page's margins and scrollbars are taken off, as a browser source has none.
    var html = '<div id="miu-fill" style="position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden">\n' + parts.html + "\n</div>";
    var css = "html, body { margin: 0; background: transparent; }\n" + parts.css;
    return {
      "$type": "MixItUp.Base.Model.Overlay.Widgets.OverlayWidgetV3Model, MixItUp.Base",
      "Name": parts.title || parts.name,
      "Item": {
        "$type": "MixItUp.Base.Model.Overlay.OverlayCustomV3Model, MixItUp.Base",
        "Properties": {
          "$type": "System.Collections.Generic.Dictionary`2[[System.String, System.Private.CoreLib],[System.String, System.Private.CoreLib]], System.Private.CoreLib",
          "Settings": settings
        },
        "Chatters": false, "ChatMessages": true, "Follows": true, "Raids": true, "TwitchSubscriptions": true, "TwitchBits": true,
        "TwitchPowerUps": false, "YouTubeMemberships": true, "YouTubeSuperChats": true, "YouTubeJewels": false, "KickSubscriptions": true,
        "KickKicks": true, "VeloraSubscriptions": true, "VPZoneSubscriptions": true, "VeloraCheered": true, "VPZoneCheered": true,
        "Donations": true, "ChannelPoints": false, "Streamloots": false, "Patreon": false,
        "Text": null, "FontSize": 24, "FontName": "Arial", "FontColor": "Black", "Bold": false, "Italics": false, "Underline": false,
        "TextAlignment": 0, "ShadowColor": null, "Version": 0, "OverlayEndpointID": "00000000-0000-0000-0000-000000000000", "Type": 999,
        "DisplayOption": 0, "Width": 0, "Height": 0, "PositionType": 0, "XPosition": 50, "YPosition": 50, "XMaximum": 0, "YMaximum": 0, "Layer": 0,
        "OldCustomHTML": null, "ID": idFor(parts.name), "HTML": html, "CSS": css, "Javascript": js
      },
      "IsEnabled": true,
      "RefreshTime": 0
    };
  }

  var api = { pack: pack, idFor: idFor, defaultsOf: defaultsOf, buttonsOf: buttonsOf, clashes: clashes, BUILT_IN: BUILT_IN };
  root.MixItUpPack = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
}(typeof window !== "undefined" ? window : this));
