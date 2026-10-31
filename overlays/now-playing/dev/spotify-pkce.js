/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* The parts of Spotify's "authorization code with PKCE" sign-in that are plain calculation, kept apart from the
   page so the tests can check them. Used by spotify-token.html in the browser, and by the tests in Node. */
(function (root) {
  "use strict";

  var UNRESERVED = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

  function webcrypto() {
    if (typeof crypto !== "undefined" && crypto.subtle) return crypto;
    return require("crypto").webcrypto;
  }
  function base64url(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    var b = typeof btoa === "function" ? btoa(s) : Buffer.from(s, "binary").toString("base64");
    return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  // A random string of the characters PKCE allows. Bytes that would favour some characters over others are skipped.
  function randomString(length) {
    var out = "", limit = 256 - (256 % UNRESERVED.length);
    while (out.length < length) {
      var bytes = webcrypto().getRandomValues(new Uint8Array(length * 2));
      for (var i = 0; i < bytes.length && out.length < length; i++) if (bytes[i] < limit) out += UNRESERVED.charAt(bytes[i] % UNRESERVED.length);
    }
    return out;
  }
  function challenge(verifier) {
    return webcrypto().subtle.digest("SHA-256", new TextEncoder().encode(verifier)).then(function (d) { return base64url(new Uint8Array(d)); });
  }
  function query(o) {
    return Object.keys(o).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(o[k]); }).join("&");
  }
  // Only the right to see what is playing is asked for, and nothing else.
  var SCOPE = "user-read-currently-playing";
  function authorizeUrl(o) {
    return "https://accounts.spotify.com/authorize?" + query({
      response_type: "code", client_id: o.clientId, scope: SCOPE, redirect_uri: o.redirectUri,
      state: o.state, code_challenge_method: "S256", code_challenge: o.challenge
    });
  }
  function tokenBody(o) {
    return query({ grant_type: "authorization_code", code: o.code, redirect_uri: o.redirectUri, client_id: o.clientId, code_verifier: o.verifier });
  }

  var api = { SCOPE: SCOPE, randomString: randomString, challenge: challenge, base64url: base64url, authorizeUrl: authorizeUrl, tokenBody: tokenBody };
  root.SpotifyPkce = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : this);
