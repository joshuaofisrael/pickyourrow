/* Pick Your Row cookie banner for Google Analytics (Consent Mode v2).
   The Google tag is downloaded only after "Accept". Reject and no choice
   do not load gtag.js and do not send a cookieless hit. The choice is kept
   in localStorage. Any element with data-consent-open reopens the banner. */
(function () {
  var KEY = "mtm-analytics-consent";
  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function save(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }
  function gtagSafe() {
    if (typeof window.gtag === "function") window.gtag.apply(null, arguments);
  }
  function loadGa() {
    if (window.__mtmGaLoaded) return;
    var id = window.__mtmGaId;
    if (!id) return;
    window.__mtmGaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== "function") window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("set", "ads_data_redaction", true);
    window.gtag("set", "url_passthrough", false);
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("js", new Date());
    window.gtag("config", id, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(s);
  }
  function clearGaCookies() {
    var host = location.hostname.replace(/^www\./, "");
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].trim();
      if (name === "_ga" || name.indexOf("_ga_") === 0) {
        ["", "; domain=." + host, "; domain=" + host].forEach(function (d) {
          document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + d;
        });
      }
    });
  }
  var css =
    "#mtm-consent{position:fixed;left:0;right:0;bottom:0;z-index:50;background:#fff;color:#111;border-top:2px solid #0b3d5c;box-shadow:0 -2px 8px rgba(0,0,0,.12);padding:.75rem 1rem;font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}" +
    "#mtm-consent .in{max-width:64rem;margin:0 auto;display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;justify-content:space-between}" +
    "#mtm-consent p{margin:0;flex:1 1 22rem}#mtm-consent a{color:#0b3d5c;text-decoration:underline}" +
    "#mtm-consent .b{display:flex;gap:.5rem}#mtm-consent button{font:inherit;padding:.45rem 1rem;border-radius:4px;border:2px solid #0b3d5c;cursor:pointer;min-height:44px}" +
    "#mtm-consent .acc{background:#0b3d5c;color:#fff}#mtm-consent .rej{background:#fff;color:#0b3d5c}" +
    "#mtm-consent button:focus-visible{outline:3px solid #b45309;outline-offset:2px}" +
    ".consent-link{background:none;border:0;padding:0;font:inherit;color:inherit;text-decoration:underline;cursor:pointer}";
  function ensureStyle() {
    if (document.getElementById("mtm-consent-css")) return;
    var s = document.createElement("style");
    s.id = "mtm-consent-css";
    s.textContent = css;
    document.head.appendChild(s);
  }
  function close() {
    var el = document.getElementById("mtm-consent");
    if (el) el.parentNode.removeChild(el);
  }
  function choose(v) {
    save(v);
    if (v === "granted") loadGa();
    else {
      gtagSafe("consent", "update", { analytics_storage: "denied" });
      clearGaCookies();
    }
    close();
  }
  function show(focus) {
    ensureStyle();
    if (document.getElementById("mtm-consent")) return;
    var box = document.createElement("div");
    box.id = "mtm-consent";
    box.setAttribute("role", "region");
    box.setAttribute("aria-label", "Cookie choices");
    box.innerHTML =
      '<div class="in"><p>We use Google Analytics cookies to count visits, only if you accept. ' +
      'The Google script loads only after Accept. Cloudflare Web Analytics (cookieless) runs either way. ' +
      '<a href="/privacy/#google-analytics">Privacy Policy</a></p>' +
      '<div class="b"><button type="button" class="acc">Accept</button>' +
      '<button type="button" class="rej">Reject</button></div></div>';
    box.querySelector(".acc").addEventListener("click", function () { choose("granted"); });
    box.querySelector(".rej").addEventListener("click", function () { choose("denied"); });
    document.body.appendChild(box);
    if (focus) box.querySelector(".acc").focus();
  }
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-consent-open]") : null;
    if (t) { e.preventDefault(); show(true); }
  });
  function init() {
    ensureStyle();
    var v = read();
    if (v === "granted") loadGa();
    else if (v !== "denied") show(false);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
