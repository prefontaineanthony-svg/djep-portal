/* ============================================================================
   Tony Pre client portal extras (loaded from GitHub Pages)
   - Event countdown (Home, Plan My Event, Event Details)
   - Planning progress checklist (Home, Plan My Event)
   - Payment tracker, What's next roadmap, Add to calendar, Meet your DJ,
     confetti when paid in full / every planning step started
   - Special Songs page closed (special songs live in the planning form)
   - Related Files (quotes, gear rentals) shown in the Documents card
   Runs after the main portal script has rebuilt the page. Safe to load on
   every DJEP page: it only acts on /clients/ pages it recognizes.
   Styles live in djep-live.css (search "TP EXTRAS").
   ============================================================================ */
(function () {
  "use strict";
  if (window.__tpExtrasLoaded) return;
  window.__tpExtrasLoaded = true;

  var path = location.pathname.toLowerCase();
  if (path.indexOf("/clients/") !== 0) return;

  var DAY = 86400000;

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function txt(el) { return el ? (el.textContent || "").replace(/\s+/g, " ").trim() : ""; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function param(name) { var m = location.search.match(new RegExp("[?&]" + name + "=([^&]+)", "i")); return m ? decodeURIComponent(m[1]) : ""; }

  // Wait until the main portal script has built what we need.
  function when(test, fn, tries) {
    tries = tries == null ? 80 : tries;
    var hit = test();
    if (hit) return fn(hit);
    if (tries <= 0) return;
    setTimeout(function () { when(test, fn, tries - 1); }, 125);
  }

  function parseDate(s) {
    if (!s) return null;
    var m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
    var d = new Date(s.replace(/^[A-Za-z]+,\s*/, ""));
    return isNaN(d) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function daysUntil(date) {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((date - today) / DAY);
  }

  // ---------------------------------------------------------------- countdown
  function countdownHtml(date, compact) {
    var n = daysUntil(date);
    if (n < 0) return "";
    var big, small;
    if (n === 0) { big = "Today"; small = "is the big day"; }
    else if (n === 1) { big = "1"; small = "day to go"; }
    else { big = n.toLocaleString("en-US"); small = "days to go"; }
    var weeks = n >= 14 ? Math.floor(n / 7) + " weeks out" : "";
    return '<div class="tp-countdown' + (compact ? " tp-countdown--compact" : "") + '" role="status">' +
      '<span class="tp-countdown__num">' + esc(big) + '</span>' +
      '<span class="tp-countdown__copy"><span class="tp-countdown__label">' + esc(small) + '</span>' +
      (weeks ? '<span class="tp-countdown__sub">' + esc(weeks) + '</span>' : "") + '</span></div>';
  }

  // ----------------------------------------------------------- progress data
  function getDoc(url) {
    return fetch(url, { credentials: "include" })
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (t) { return new DOMParser().parseFromString(t || "", "text/html"); })
      .catch(function () { return null; });
  }

  function planningFormCount(doc) {
    if (!doc) return null;
    var answered = 0;
    qsa('tr[id^="question_row_id_"]', doc).forEach(function (row) {
      var cells = row.children;
      if (cells.length >= 2) {
        var v = txt(cells[cells.length - 1]);
        if (v && !/^click to choose$/i.test(v)) answered++;
      } else {
        // grid question: any filled cell outside the header row/column
        var inner = qs("table", row);
        if (!inner) return;
        var filled = qsa("tr", inner).slice(1).some(function (tr) {
          return qsa("td", tr).slice(1).some(function (td) { return txt(td).replace(/ /g, "").length > 0; });
        });
        if (filled) answered++;
      }
    });
    return answered;
  }

  function requestCount(doc) {
    if (!doc) return null;
    var n = 0;
    ["#MPL_table", "#PIP_table"].forEach(function (id) {
      var t = qs(id, doc);
      if (t) n += qsa("tr", t).filter(function (tr) { return txt(tr); }).length;
    });
    return n;
  }

  function timelineCount(doc) {
    if (!doc) return null;
    var box = qs(".djep-viewtimelinebox", doc) || doc;
    var t = qs("table", box);
    if (!t || /no events found/i.test(txt(t))) return 0;
    return qsa("tr", t).filter(function (tr) {
      var tds = qsa("td", tr);
      return tds.length >= 2 && tds.some(function (td) { return txt(td); });
    }).length;
  }

  function progressHtml(eventId, d) {
    var base = "?eventid=" + encodeURIComponent(eventId);
    var items = [
      {
        title: "Planning Form",
        n: d.form,
        status: d.form ? "In progress" : "Not started",
        detail: d.form ? d.form + (d.form === 1 ? " answer saved" : " answers saved") : "Start with the basics",
        href: "planningforms.asp?action=edit_primary_planning_form&eventid=" + encodeURIComponent(eventId),
        state: d.form ? "go" : "todo"
      },
      {
        title: "Song Requests",
        n: d.requests,
        status: d.requests ? "In progress" : "Not started",
        detail: d.requests ? d.requests + (d.requests === 1 ? " song added" : " songs added") : "Must plays and favorites",
        href: "music.asp" + base,
        state: d.requests ? "go" : "todo"
      },
      {
        title: "Timeline",
        n: d.timeline,
        status: d.timeline ? "In progress" : "Not started",
        detail: d.timeline ? d.timeline + (d.timeline === 1 ? " moment planned" : " moments planned") : "Map out the night",
        href: "timeline.asp?action=edit&eventid=" + encodeURIComponent(eventId),
        state: d.timeline ? "go" : "todo"
      }
    ];
    if (d.pay && d.pay.total) {
      var pBal = d.pay.balance != null ? Math.max(0, d.pay.balance) : Math.max(0, d.pay.total - d.pay.paid);
      var pPaid = Math.max(0, d.pay.total - pBal);
      var pFull = pBal <= 0.004;
      items.push({
        title: "Payments",
        status: pFull ? "Paid in full" : pPaid > 0 ? "In progress" : "Not started",
        detail: pFull ? money(d.pay.total) + " paid. Thank you!" : money(pPaid) + " of " + money(d.pay.total) + " paid" +
          (d.pay.nextDue ? ", next due " + fmtDate(d.pay.nextDue.date) : ""),
        href: "makeapayment.asp?action=choose_payment_gateway&eventid=" + encodeURIComponent(eventId),
        state: pFull ? "done" : pPaid > 0 ? "go" : "todo"
      });
    }
    var started = items.filter(function (i) { return i.state !== "todo"; }).length;
    var pct = Math.round((started / items.length) * 100);
    var head = started === 0 ? "Let's get planning" : started === items.length ? "Everything is underway" : "Nice progress";
    return '<section class="tp-progress" aria-label="Planning progress">' +
      '<div class="tp-progress__head"><div><p class="tp-progress__kicker">Planning progress</p>' +
      '<h3 class="tp-progress__title">' + esc(head) + '</h3></div>' +
      '<span class="tp-progress__count">' + started + ' of ' + items.length + ' started</span></div>' +
      '<div class="tp-progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div>' +
      '<div class="tp-progress__grid">' + items.map(function (i) {
        return '<a class="tp-progress__item tp-progress__item--' + i.state + '" href="' + esc(i.href) + '">' +
          '<span class="tp-progress__dot" aria-hidden="true">' + (i.state === "done" ? "&#10003;" : i.state === "go" ? "&#9679;" : "") + '</span>' +
          '<span class="tp-progress__copy"><span class="tp-progress__name">' + esc(i.title) + '</span>' +
          '<span class="tp-progress__detail">' + esc(i.detail) + '</span></span>' +
          '<span class="tp-progress__status">' + esc(i.status) + '</span></a>';
      }).join("") + '</div></section>';
  }

  function loadProgress(eventId, mount, position) {
    if (!eventId || !mount || mount.getAttribute("data-tp-progress")) return;
    mount.setAttribute("data-tp-progress", "1");
    var holder = document.createElement("div");
    holder.className = "tp-progress-holder tp-progress-holder--loading";
    holder.innerHTML = '<section class="tp-progress tp-progress--loading"><p class="tp-progress__kicker">Planning progress</p><div class="tp-progress__bar"><span style="width:12%"></span></div></section>';
    mount.insertAdjacentElement(position || "afterend", holder);
    var id = encodeURIComponent(eventId);
    Promise.all([
      getDoc("planningforms.asp?action=view_primary_planning_form&eventid=" + id),
      getDoc("songrequests.asp?action=view_requests&eventid=" + id),
      getDoc("timeline.asp?eventid=" + id + "&action=view"),
      eventInfo(eventId).catch(function () { return null; })
    ]).then(function (docs) {
      holder.innerHTML = progressHtml(eventId, {
        form: planningFormCount(docs[0]) || 0,
        requests: requestCount(docs[1]) || 0,
        timeline: timelineCount(docs[2]) || 0,
        pay: docs[3]
      });
      holder.classList.remove("tp-progress-holder--loading");
      var pi = docs[3];
      if (pi && pi.total > 0 && pi.balance != null && pi.balance <= 0.004 && !seen("tp-paid-" + eventId)) {
        setTimeout(function () { confetti("Paid in full. Thank you!"); }, 300);
      }
      var all = qsa(".tp-progress__item", holder);
      if (all.length && all.every(function (a) { return !/--todo/.test(a.className); }) && !seen("tp-allgo-" + eventId)) {
        setTimeout(function () { confetti("Every planning step is underway. Love it!"); }, 500);
      }
    }).catch(function () { holder.remove(); });
  }

  // ======================================================================
  // SETTINGS YOU CAN EDIT
  // ======================================================================
  var TP = {
    // "What's next" roadmap. days = how many days BEFORE the event.
    // PLACEHOLDER TIMING: Tony will send the real schedule.
    roadmap: [
      // Matches Tony's scheduled email series (DJEP email templates 6-17).
      { days: 274, title: "Start your soundtrack", detail: "Build a few shared Spotify playlists for cocktail hour, dinner, special moments and the dance floor." },
      { days: 183, title: "Dream up the vibe", detail: "Think about the energy you want, the throwbacks, traditions and moments that feel like you." },
      { days: 122, title: "Creative meeting", detail: "We map out your music, reception flow, special moments and formalities together." },
      { days: 90, title: "Fill in your planner", detail: "Start adding music, names, pronunciations, formalities and timeline details." },
      { days: 60, title: "Final payment due", detail: "Your remaining balance is due. You can pay anytime right here in the portal." },
      { days: 45, title: "Lock in the music", detail: "Must-plays, do-not-plays and special songs, plus we schedule your Final Planning Meeting." },
      { days: 30, title: "Services deadline", detail: "Last day to add enhancements. Your planner should be close to complete." },
      { days: 14, title: "Final details", detail: "One more look at names, speeches, dances and timeline so everything is current." },
      { lock: true, title: "Planning forms lock", detail: "Last day to make changes in the portal. I'll call you this week for a final check-in." },
      { days: 0, title: "Event day", detail: "Time to celebrate. I've got the rest." }
    ],
    lockDaysFallback: 7, // matches DJEP Client Lockout (days before event)
    dj: {
      photo: "https://thetonypre.com/_a/36fb638e62910d1e.webp",
      intro: "Open-format DJ and MC for weddings, private events and nightlife. 13 years and more than 1,000 events, and I can't wait for yours.",
      links: [
        ["Instagram", "https://instagram.com/thetonypre"],
        ["Spotify", "https://open.spotify.com/artist/6Kxt2kD4GSbCWcUjyHw2aI"],
        ["Apple Music", "https://music.apple.com/us/artist/tony-pre/1723848289"],
        ["SoundCloud", "https://soundcloud.com/thetonypre"],
        ["Mixcloud", "https://www.mixcloud.com/TheTonyPre/"]
      ],
      website: "https://thetonypre.com/",
      meeting: "https://calendly.com/thetonypre/meetme",
      logo: "https://thetonypre.com/links/img/logo.png",
      role: "DJ & Event Host",
      tagline: "Your go-to for music, timeline and every big moment of the night.",
      phone: "631 388 0143",
      phoneLink: "+16313880143",
      email: "anthony@thetonypre.com",
      instagram: "thetonypre"
    },
    // Home "Add to your night" menu. Prices from DJEP > Add Ons (2026-10-28).
    // price: null shows "Ask me". featured: shown before "Show all".
    addons: [
      { name: "Dancing on a Cloud", price: 500, note: "A low cloud rolls across the floor for your first dance", featured: true },
      { name: "Cold Sparkler Fountains", price: 500, note: "Indoor-safe sparks for entrances and the last dance", featured: true },
      { name: "CO2 Stationary Jets", price: 500, note: "Big cryo blasts right on the drop", featured: true },
      { name: "CO2 Handheld Cannon", match: "CO2 Handheld Canon", price: 400, note: "I fire it into the crowd at peak moments", featured: true },
      { name: "Motion Graphic Monogram", price: 350, note: "Your initials, animated in light", featured: true },
      { name: "Wireless Color Uplighting", match: "Wireless Color Uplighting (20 Fixtures)", price: 900, from: true, note: "Wash the whole room in your colors", featured: true },
      { name: "Premium Open Air Photobooth", price: 1250, note: "Studio-quality photos, unlimited sessions", featured: true },
      { name: "Audio Guest Book", price: null, note: "Voice messages from your guests to keep forever", featured: true },
      { name: "Intelligent Moving Heads", match: "Intelligent Moving Head (2 Fixtures)", price: 750, from: true, note: "Club-style moving lights over the dance floor" },
      { name: "LED Dance Floor 360 Tubes", match: "LED Dance Floor 360 Tubes (4 Fixtures)", price: 300, from: true, note: "Glowing light tubes framing the floor" },
      { name: "Dance Floor Wash", price: 250, note: "A color wash over the whole dance floor" },
      { name: "Deluxe Social Booth", price: 750, note: "Instant shareable photos and boomerangs" },
      { name: "A.I. Generation Photobooth", price: 1500, note: "AI-styled portraits your guests will talk about" },
      { name: "Ceremony & Prelude Music", price: null, note: "Sound, mics and music for your ceremony" },
      { name: "Satellite Speaker for Cocktail", price: 150, note: "Music for a separate cocktail space" },
      { name: "Wireless Zone Speaker", price: 250, note: "Extra sound wherever guests gather" }
    ],
    addonDeadlineDays: 30, // matches the 30-day services deadline email
    finalPaymentDays: 60   // final balance due this many days before the event
  };

  function fmtDate(d, long) {
    return d.toLocaleDateString("en-US", long ? { weekday: "short", month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
  }
  function money(n) { return "$" + (Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function num(s) { var m = String(s || "").replace(/[,\s]/g, "").match(/-?\$?-?(\d+(\.\d+)?)/); return m ? parseFloat(m[1]) : null; }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function seen(key) { try { if (localStorage.getItem(key)) return true; localStorage.setItem(key, "1"); } catch (e) { return false; } return false; }

  // ----------------------------------------------------- event data (source)
  function rowValue(doc, box, label) {
    var b = qs(box, doc);
    if (!b) return "";
    var hit = "";
    qsa("tr", b).some(function (tr) {
      var cells = qsa("td", tr);
      if (cells.length >= 2 && txt(cells[0]).toLowerCase().indexOf(label) === 0) { hit = txt(cells[cells.length - 1]); return true; }
      return false;
    });
    return hit;
  }

  function eventInfo(id) {
    return getDoc("eventdetails.asp?eventid=" + encodeURIComponent(id)).then(function (doc) {
      if (!doc) return null;
      var info = {
        date: parseDate(rowValue(doc, ".djep-eventdatetimesbox", "event date")),
        start: rowValue(doc, ".djep-eventdatetimesbox", "start time"),
        end: rowValue(doc, ".djep-eventdatetimesbox", "end time"),
        name: rowValue(doc, ".djep-eventdescriptionbox", "event name") || rowValue(doc, ".djep-eventdescriptionbox", "event type"),
        venue: txt(qs("#djep-venue_1_name", doc)),
        address: txt(qs("#djep-venue_1_address", doc)),
        total: num(rowValue(doc, ".djep-totalfeebox", "total fee")),
        paid: Math.abs(num(rowValue(doc, ".djep-totalfeebox", "payments")) || 0),
        balance: num(rowValue(doc, ".djep-totalfeebox", "balance due")),
        nextDue: null,
        type: rowValue(doc, ".djep-eventdescriptionbox", "event type"),
        status: rowValue(doc, ".djep-eventdescriptionbox", "booking status"),
        pkg: null,
        items: [],
        bookedOn: null
      };
      // package + add-ons from Fee Details
      var section = "";
      qsa(".djep-feedetailsbox tr", doc).forEach(function (tr) {
        var c = qsa("td", tr);
        if (c.length < 2) return;
        var name = txt(c[0]), priceTxt = txt(c[c.length - 1]);
        if (!name || /^description$/i.test(name)) return;
        if (/^packages?$/i.test(name) && num(priceTxt) == null) { section = "pkg"; return; }
        if (/^add.?ons?$/i.test(name) && num(priceTxt) == null) { section = "add"; return; }
        var p = num(priceTxt);
        if (p != null && /-\s*\$/.test(priceTxt)) p = -p;
        if (section === "pkg" && !info.pkg) info.pkg = { name: name, price: p };
        else if (section === "add") info.items.push({ name: name, price: p });
      });
      // payment history; first payment = the day the date was secured
      info.history = [];
      info.retainer = num(rowValue(doc, ".djep-totalfeebox", "retainer"));
      info.subtotal = num(rowValue(doc, ".djep-totalfeebox", "package and addons"));
      qsa(".djep-paymenthistorybox tr", doc).forEach(function (tr) {
        var t = txt(tr);
        var m = t.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
        var d = m && parseDate(m[1]);
        if (d && (!info.bookedOn || d < info.bookedOn)) info.bookedOn = d;
        var am = t.match(/\$\s?[\d,]+(\.\d{2})?/);
        if (d && am) {
          var method = t.replace(m[1], "").replace(am[0], "").replace(/[-–:\s]+$/, "").replace(/^[-–:\s]+/, "").trim();
          info.history.push({ date: d, amount: num(am[0]), method: method || "Payment", refund: /refund/i.test(t) });
        }
      });
      info.history.sort(function (a, b) { return b.date - a.date; });
      // next scheduled payment, if DJEP lists one with a due date
      var today = new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      qsa(".djep-paymentsfinancesbox tr, .djep-paymenthistorybox tr", doc).forEach(function (tr) {
        var t = txt(tr);
        if (!/due/i.test(t)) return;
        var dm = t.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
        var am = t.match(/\$\s?[\d,]+(\.\d{2})?/);
        var d = dm && parseDate(dm[1]);
        if (d && d >= today && (!info.nextDue || d < info.nextDue.date)) info.nextDue = { date: d, amount: am ? num(am[0]) : null };
      });
      if (!info.nextDue && info.date && info.balance > 0.004) {
        var due60 = addDays(info.date, -60);
        if (due60 >= today) info.nextDue = { date: due60, amount: info.balance };
      }
      return info;
    });
  }

  function lockDate(id, eventDate) {
    return getDoc("planmyevent.asp?eventid=" + encodeURIComponent(id)).then(function (doc) {
      var m = doc && txt(doc.body).match(/locked at[^0-9]*on\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
      return m ? parseDate(m[1]) : (eventDate ? addDays(eventDate, -TP.lockDaysFallback) : null);
    });
  }

  // ---------------------------------------------------------- confetti
  function confetti(message) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { if (message) toast(message); return; }
    var c = document.createElement("canvas");
    c.className = "tp-confetti";
    document.body.appendChild(c);
    var ctx = c.getContext("2d"), W = c.width = innerWidth, H = c.height = innerHeight;
    var colors = ["#d90898", "#ff4fbf", "#7a2cff", "#e8d3b0", "#ffffff"];
    var bits = [];
    for (var i = 0; i < 140; i++) bits.push({ x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35, vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 14 - 4, s: Math.random() * 6 + 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: colors[i % colors.length] });
    var t0 = performance.now();
    (function frame(t) {
      var k = (t - t0) / 2600;
      ctx.clearRect(0, 0, W, H);
      bits.forEach(function (b) { b.vy += 0.35; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); ctx.restore(); });
      if (k < 1) requestAnimationFrame(frame); else c.remove();
    })(t0);
    if (message) toast(message);
  }

  function toast(message) {
    var el = document.createElement("div");
    el.className = "tp-toast";
    el.setAttribute("role", "status");
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add("tp-toast--out"); }, 3600);
    setTimeout(function () { el.remove(); }, 4200);
  }

  // ---------------------------------------------------------- add to calendar
  function icsTime(d, t) {
    var m = String(t || "").match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
    var h = m ? (+m[1] % 12) + (/p/i.test(m[3]) ? 12 : 0) : 0, mi = m ? +m[2] : 0;
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "T" + p(h) + p(mi) + "00";
  }
  function icsDay(d) { function p(n) { return (n < 10 ? "0" : "") + n; } return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()); }
  function icsEsc(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n"); }

  function buildIcs(info, lock, id) {
    var now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tony Pre Events//Client Portal//EN", "CALSCALE:GREGORIAN"];
    var endDay = info.date;
    if (info.start && info.end && icsTime(info.date, info.end) <= icsTime(info.date, info.start)) endDay = addDays(info.date, 1);
    lines.push("BEGIN:VEVENT", "UID:tp-event-" + id + "@thetonypre.com", "DTSTAMP:" + now,
      info.start ? "DTSTART:" + icsTime(info.date, info.start) : "DTSTART;VALUE=DATE:" + icsDay(info.date),
      info.start ? "DTEND:" + icsTime(endDay, info.end || info.start) : "DTEND;VALUE=DATE:" + icsDay(addDays(info.date, 1)),
      "SUMMARY:" + icsEsc((info.name || "Our event") + " with Tony Pre"),
      "LOCATION:" + icsEsc([info.venue, info.address].filter(Boolean).join(", ")),
      "DESCRIPTION:" + icsEsc("Your DJ and event host: Tony Pre\nClient portal: https://thedjforms.com/clientlogon.asp?djidnumber=28795"),
      "END:VEVENT");
    if (lock) lines.push("BEGIN:VEVENT", "UID:tp-lock-" + id + "@thetonypre.com", "DTSTAMP:" + now,
      "DTSTART;VALUE=DATE:" + icsDay(lock), "DTEND;VALUE=DATE:" + icsDay(addDays(lock, 1)),
      "SUMMARY:" + icsEsc("Last day to update planning forms (Tony Pre)"),
      "DESCRIPTION:" + icsEsc("Planning forms lock at 11:59 PM tonight. https://thedjforms.com/clientlogon.asp?djidnumber=28795"),
      "BEGIN:VALARM", "TRIGGER:-P2D", "ACTION:DISPLAY", "DESCRIPTION:Planning forms lock in 2 days", "END:VALARM",
      "END:VEVENT");
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  function calendarButton(id, mount, position) {
    if (!mount || qs(".tp-cal-btn", mount.parentElement || document)) return;
    if (mount.classList && mount.classList.contains("tp-countdown")) {
      var row = document.createElement("div");
      row.className = "tp-count-row";
      mount.parentNode.insertBefore(row, mount);
      row.appendChild(mount);
      mount = row; position = "beforeend";
    }
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tp-cal-btn";
    btn.innerHTML = '<span aria-hidden="true">&#128197;</span> Add to calendar';
    mount.insertAdjacentElement(position || "afterend", btn);
    btn.addEventListener("click", function () {
      btn.disabled = true;
      eventInfo(id).then(function (info) {
        if (!info || !info.date) throw new Error("no date");
        return lockDate(id, info.date).then(function (lock) {
          var ics = buildIcs(info, lock, id);
          var ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
          if (ios) { location.href = "data:text/calendar;charset=utf8," + encodeURIComponent(ics); return; }
          var a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
          a.download = "tony-pre-event.ics";
          document.body.appendChild(a); a.click(); a.remove();
        });
      }).catch(function () { toast("Sorry, the calendar file could not be created. Please try again."); })
        .then(function () { btn.disabled = false; });
    });
  }

  // ---------------------------------------------------------- payment tracker
  function paymentHtml(id, info) {
    var total = info.total || 0;
    var balance = info.balance != null ? Math.max(0, info.balance) : Math.max(0, total - info.paid);
    var paid = total ? Math.max(0, total - balance) : info.paid;
    var pct = total ? Math.min(100, Math.round((paid / total) * 100)) : 0;
    var r = 52, circ = 2 * Math.PI * r, dash = (circ * pct) / 100;
    var full = total > 0 && balance <= 0.004;
    return '<section class="tp-card tp-pay' + (full ? " tp-pay--full" : "") + '" aria-label="Payments">' +
      '<p class="tp-kicker">Payments</p>' +
      '<div class="tp-pay__body">' +
      '<div class="tp-pay__ring"><svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="tpPayGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d90898"/><stop offset="1" stop-color="#7a2cff"/></linearGradient></defs>' +
      '<circle cx="60" cy="60" r="' + r + '" class="tp-pay__track"/><circle cx="60" cy="60" r="' + r + '" class="tp-pay__fill" stroke-dasharray="' + dash.toFixed(1) + ' ' + circ.toFixed(1) + '"/></svg>' +
      '<span class="tp-pay__pct">' + pct + '<small>%</small></span></div>' +
      '<div class="tp-pay__copy">' +
      (full ? '<span class="tp-pay__badge">&#10003; Paid in full</span>' : '<span class="tp-pay__balance">' + money(balance) + '<small>balance</small></span>') +
      '<span class="tp-pay__line">' + money(paid) + ' of ' + money(total) + ' paid</span>' +
      (!full && info.nextDue ? '<span class="tp-pay__line tp-pay__due">Next payment' + (info.nextDue.amount ? " " + money(info.nextDue.amount) : "") + ' due ' + esc(fmtDate(info.nextDue.date)) + '</span>' : "") +
      (!full ? '<a class="tp-btn" href="makeapayment.asp?action=choose_payment_gateway&eventid=' + encodeURIComponent(id) + '">Make a payment</a>' : '<span class="tp-pay__line">Thank you! Your night is all set on my end.</span>') +
      '</div></div></section>';
  }

  // ---------------------------------------------------------- what's next
  function roadmapHtml(eventDate, lock, paidInFull) {
    var today = new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var steps = TP.roadmap.map(function (s) {
      var d = s.lock ? (lock || addDays(eventDate, -TP.lockDaysFallback)) : addDays(eventDate, -s.days);
      return { title: s.title, detail: s.detail, date: d };
    }).sort(function (a, b) { return a.date - b.date; });
    var nextIdx = -1;
    steps.some(function (s, i) { if (s.date >= today && !(paidInFull && /payment/i.test(s.title))) { nextIdx = i; return true; } return false; });
    // keep it short: the last finished step plus the next four
    var from = nextIdx === -1 ? Math.max(0, steps.length - 1) : Math.max(0, nextIdx - 1);
    steps = steps.slice(from, from + 5);
    nextIdx = nextIdx === -1 ? -1 : nextIdx - from;
    return '<section class="tp-card tp-road" aria-label="What\'s next">' +
      '<p class="tp-kicker">What\'s next</p>' +
      '<ol class="tp-road__list">' + steps.map(function (s, i) {
        var paidStep = paidInFull && /payment/i.test(s.title);
        var state = (s.date < today || paidStep) ? "done" : i === nextIdx ? "next" : "later";
        var n = daysUntil(s.date);
        var when = paidStep ? "Paid" : state === "done" ? "Done" : n === 0 ? "Today" : n === 1 ? "Tomorrow" : "In " + n.toLocaleString("en-US") + " days";
        return '<li class="tp-road__step tp-road__step--' + state + '">' +
          '<span class="tp-road__dot" aria-hidden="true"></span>' +
          '<div class="tp-road__text"><span class="tp-road__title">' + esc(s.title) + '</span>' +
          '<span class="tp-road__detail">' + esc(s.detail) + '</span></div>' +
          '<div class="tp-road__when"><span>' + esc(when) + '</span><small>' + esc(fmtDate(s.date)) + '</small></div></li>';
      }).join("") + '</ol></section>';
  }

  // ---------------------------------------------------------- meet your DJ
  function meetHtml() {
    var d = TP.dj;
    return '<section class="tp-card tp-meet" aria-label="Meet your DJ">' +
      '<div class="tp-meet__photo"><img src="' + esc(d.photo) + '" alt="Tony Pre" loading="lazy"></div>' +
      '<div class="tp-meet__text"><p class="tp-kicker">Meet your DJ</p>' +
      '<h3 class="tp-meet__name">Tony Pre</h3>' +
      '<p class="tp-meet__intro">' + esc(d.intro) + '</p>' +
      '<p class="tp-meet__listen">Hear my sound while you plan</p>' +
      '<div class="tp-meet__links">' + d.links.map(function (l) { return '<a href="' + esc(l[1]) + '" target="_blank" rel="noopener">' + esc(l[0]) + '</a>'; }).join("") + '</div>' +
      '<div class="tp-meet__actions"><a class="tp-btn" href="' + esc(d.meeting) + '" target="_blank" rel="noopener">Book a call with me</a>' +
      '<a class="tp-link" href="' + esc(d.website) + '" target="_blank" rel="noopener">Visit my website</a></div>' +
      '</div></section>';
  }

  // Load payment + roadmap into a mount (shared by Home and Plan My Event)
  function loadEventCards(id, opts) {
    eventInfo(id).then(function (info) {
      if (!info) return;
      var jobs = [];
      if (opts.payment && info.total) {
        opts.payment.innerHTML = paymentHtml(id, info);
        if (info.total > 0 && info.balance != null && info.balance <= 0.004 && !seen("tp-paid-" + id)) {
          setTimeout(function () { confetti("Paid in full. Thank you!"); }, 600);
        }
      } else if (opts.payment) opts.payment.remove();
      if (opts.roadmap && info.date) {
        jobs.push(lockDate(id, info.date).then(function (lock) { opts.roadmap.innerHTML = roadmapHtml(info.date, lock, info.total > 0 && info.balance != null && info.balance <= 0.004); }));
      } else if (opts.roadmap) opts.roadmap.remove();
      return Promise.all(jobs);
    }).catch(function () {});
  }

  // ======================================================================
  // HOME DASHBOARD (2026-10-28): Your DJ hero + live countdown, the
  // build-up waveform, key dates, enhancements. Inspired by the Marquee
  // dashboard Tony liked, in the Tony Pre night look.
  // ======================================================================
  function todayStart() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function isPaidFull(info) { return !!(info && info.total > 0 && info.balance != null && info.balance <= 0.004); }
  function eventStart(info) {
    var d = new Date(info.date.getTime());
    var m = String(info.start || "").match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
    if (m) d.setHours((+m[1] % 12) + (/p/i.test(m[3]) ? 12 : 0), +m[2], 0, 0);
    else d.setHours(17, 0, 0, 0);
    return d;
  }
  function inDays(d) {
    var n = daysUntil(d);
    return n < 0 ? "Done" : n === 0 ? "Today" : n === 1 ? "Tomorrow" : "In " + n.toLocaleString("en-US") + " days";
  }
  function icon(name) {
    var p = {
      phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
      text: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
      ig: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>',
      card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
      check: '<path d="M20 6 9 17l-5-5"/>'
    }[name] || "";
    return '<svg class="tp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  // ---------------------------------------------------------- hero
  function heroHtml(id, info) {
    var d = info.date, dj = TP.dj, full = isPaidFull(info);
    var eid = encodeURIComponent(id);
    var payHref = "makeapayment.asp?action=choose_payment_gateway&eventid=" + eid;
    var planHref = "planmyevent.asp?eventid=" + eid;
    var detHref = "eventdetails.asp?eventid=" + eid;
    var owe = !full && info.total > 0;
    var next = owe && info.nextDue ? "Next: " + (info.nextDue.amount ? money(info.nextDue.amount) + " " : "") + "due " + fmtDate(info.nextDue.date) : owe ? money(Math.max(0, info.balance || 0)) + " balance" : "";
    var actions = owe
      ? '<a class="tp-hero__primary" href="' + payHref + '">' + icon("card") + '<span>Make a payment' + (next ? '<small>' + esc(next) + '</small>' : "") + '</span></a>' +
        '<a class="tp-hero__ghost" href="' + planHref + '">Plan my event</a><a class="tp-hero__ghost" href="' + detHref + '">Event details</a>'
      : '<a class="tp-hero__primary" href="' + planHref + '"><span>Plan my event<small>' + (full ? "Paid in full. Thank you!" : "Forms, music and timeline") + '</small></span></a>' +
        '<a class="tp-hero__ghost" href="' + detHref + '">Event details</a><a class="tp-hero__ghost" href="' + payHref + '">Payments</a>';
    var sub = [info.type, info.venue].filter(Boolean).join(" · ");
    var status = info.status || "Booked";
    return '<section class="tp-hero" aria-label="Your upcoming event">' +
      '<div class="tp-hero__photo"><img src="' + esc(dj.photo) + '" alt="Tony Pre, your DJ"><span class="tp-hero__tag"><i></i>Your DJ</span></div>' +
      '<div class="tp-hero__main">' +
        '<div class="tp-hero__event">' +
          '<div class="tp-datetile"><span class="tp-datetile__m">' + esc(d.toLocaleDateString("en-US", { month: "short" })) + '</span>' +
          '<span class="tp-datetile__d">' + d.getDate() + '</span><span class="tp-datetile__y">' + d.getFullYear() + '</span>' +
          '<span class="tp-datetile__w">' + esc(d.toLocaleDateString("en-US", { weekday: "long" })) + '</span></div>' +
          '<div class="tp-hero__copy"><p class="tp-hero__kicker">Your upcoming event <span class="tp-chip tp-chip--ok"><i></i>' + esc(status) + '</span></p>' +
          '<h2 class="tp-hero__title">' + esc(info.name || "Your event") + '</h2>' +
          (sub ? '<p class="tp-hero__sub">' + esc(sub) + '</p>' : "") +
          (info.pkg ? '<p class="tp-hero__pkg">Package: <b>' + esc(info.pkg.name) + '</b></p>' : "") + '</div>' +
        '</div>' +
        '<div class="tp-hero__actions">' + actions + '</div>' +
        '<div class="tp-hero__dj">' +
          '<p class="tp-hero__kicker">Your DJ</p>' +
          '<img class="tp-hero__logo" src="' + esc(dj.logo) + '" alt="Tony Pre">' +
          '<p class="tp-hero__role"><b>' + esc(dj.role) + '</b> · ' + esc(dj.tagline) + '</p>' +
          '<div class="tp-hero__contacts">' +
            '<a href="tel:' + esc(dj.phoneLink) + '">' + icon("phone") + '<span>' + esc(dj.phone) + '</span></a>' +
            '<a href="sms:' + esc(dj.phoneLink) + '">' + icon("text") + '<span>Send a text</span></a>' +
            '<a href="mailto:' + esc(dj.email) + '">' + icon("mail") + '<span>' + esc(dj.email) + '</span></a>' +
            '<a href="https://instagram.com/' + esc(dj.instagram) + '" target="_blank" rel="noopener">' + icon("ig") + '<span>@' + esc(dj.instagram) + '</span></a>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="tp-hero__count">' +
        '<p class="tp-hero__countlabel"><i></i>The countdown is on</p>' +
        '<div class="tp-clock" role="timer" aria-label="Time until your event">' +
          ['days', 'hrs', 'min', 'sec'].map(function (u, i) {
            return (i ? '<span class="tp-clock__sep" aria-hidden="true">:</span>' : "") +
              '<span class="tp-clock__box"><b data-u="' + u + '">--</b><small>' + u + '</small></span>';
          }).join("") +
        '</div>' +
        '<span class="tp-hero__cal"></span>' +
      '</div>' +
    '</section>';
  }

  function startClock(root, target) {
    var els = {};
    qsa("[data-u]", root).forEach(function (b) { els[b.getAttribute("data-u")] = b; });
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function tick() {
      if (!document.body.contains(root)) { clearInterval(t); return; }
      var ms = Math.max(0, target - new Date());
      var s = Math.floor(ms / 1000);
      els.days.textContent = Math.floor(s / 86400).toLocaleString("en-US");
      els.hrs.textContent = pad(Math.floor(s / 3600) % 24);
      els.min.textContent = pad(Math.floor(s / 60) % 60);
      els.sec.textContent = pad(s % 60);
    }
    var t = setInterval(tick, 1000);
    tick();
  }

  // ---------------------------------------------------------- the build-up (waveform)
  function journeySteps(info, lock, full) {
    var ev = info.date, today = todayStart();
    var start = info.bookedOn || (addDays(ev, -365) < today ? addDays(ev, -365) : today);
    if (start > ev) start = addDays(ev, -1);
    var steps = [
      { title: "Date secured", date: start, sub: info.bookedOn ? "Booked " + fmtDate(info.bookedOn) : "You're on my calendar", forceDone: true },
      { title: "Your soundtrack", date: addDays(ev, -274), sub: "Start your playlists" },
      { title: "Creative meeting", date: addDays(ev, -122), sub: "About 4 months out" },
      { title: "Final payment", date: addDays(ev, -60), sub: full ? "Paid in full" : "Due " + fmtDate(addDays(ev, -60)), paid: full },
      { title: "Final planning", date: addDays(ev, -45), sub: "About 6 weeks out" },
      { title: "Let's dance", date: ev, sub: fmtDate(ev) }
    ].filter(function (s, i) { return i === 0 || s.date > start; });
    var next = -1;
    steps.forEach(function (s, i) {
      s.state = (s.forceDone || s.paid || s.date < today) ? "done" : "later";
      if (s.state !== "done" && next === -1) { next = i; s.state = "next"; }
      s.pos = Math.max(0, Math.min(1, (s.date - start) / (ev - start || 1)));
    });
    var pct = Math.max(0, Math.min(1, (today - start) / (ev - start || 1)));
    return { steps: steps, pct: pct };
  }

  function waveSvg(pct) {
    var N = 120, W = 1000, H = 120, bw = W / N, out = [];
    for (var i = 0; i < N; i++) {
      var x = i / (N - 1);
      var noise = (Math.sin(i * 12.9898) * 43758.5453) % 1; noise = Math.abs(noise);
      var build = 0.12 + 0.62 * Math.pow(x, 1.7);              // the track builds toward the drop
      var dip = x > 0.84 && x < 0.9 ? 0.45 : 1;                  // little breakdown before the drop
      var amp = Math.min(1, (build + noise * 0.32) * dip);
      if (x > 0.9) amp = Math.min(1, 0.78 + noise * 0.22);       // the drop
      var h = Math.max(6, amp * (H - 8));
      out.push('<rect x="' + (i * bw + 1).toFixed(1) + '" y="' + ((H - h) / 2).toFixed(1) + '" width="' + (bw - 3).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2" class="' + (x <= pct ? "on" : "off") + '"/>');
    }
    return '<svg class="tp-wave__svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="tpWaveGrad" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#7a2cff"/><stop offset="0.6" stop-color="#d90898"/><stop offset="1" stop-color="#ff4fbf"/></linearGradient></defs>' +
      out.join("") + '</svg>';
  }

  function journeyHtml(info, lock, full) {
    var j = journeySteps(info, lock, full);
    var pctTxt = Math.round(j.pct * 100);
    var label = { done: "Done", next: "Up next", later: "Coming up" };
    return '<section class="tp-card tp-wave" aria-label="Your journey">' +
      '<div class="tp-wave__head"><div><p class="tp-kicker">Your journey</p>' +
      '<h3 class="tp-wave__title">The build-up <em>to the drop.</em></h3></div>' +
      '<p class="tp-wave__pct">You\'re <b>' + pctTxt + '%</b> of the way to the drop.</p></div>' +
      '<div class="tp-wave__track">' +
        j.steps.map(function (s, i) {
          return '<span class="tp-wave__flag tp-wave__flag--' + s.state + (i === j.steps.length - 1 ? " tp-wave__flag--last" : i === 0 ? " tp-wave__flag--first" : "") + '" style="left:' + (s.pos * 100).toFixed(2) + '%">' + (i < 9 ? "0" : "") + (i + 1) + '</span>';
        }).join("") +
        waveSvg(j.pct) +
        '<span class="tp-wave__head-line" style="left:' + (j.pct * 100).toFixed(2) + '%"></span>' +
      '</div>' +
      '<ol class="tp-wave__steps" style="--n:' + j.steps.length + '">' + j.steps.map(function (s, i) {
        return '<li class="tp-wave__step tp-wave__step--' + s.state + '"><div class="tp-wave__steptop"><span class="tp-wave__num">' + (i < 9 ? "0" : "") + (i + 1) + '</span>' +
          '<span class="tp-wave__chip">' + esc(s.paid ? "Paid" : label[s.state]) + '</span></div>' +
          '<span class="tp-wave__name">' + esc(s.title) + '</span><span class="tp-wave__sub">' + esc(s.sub) + '</span></li>';
      }).join("") + '</ol></section>';
  }

  // ---------------------------------------------------------- key dates
  function keyDatesHtml(info, lock, full) {
    var ev = info.date, rows = [];
    var finalDue = addDays(ev, -60);
    if (!full && info.nextDue && Math.abs(info.nextDue.date - finalDue) > DAY) {
      rows.push({ title: "Next payment", sub: (info.nextDue.amount ? money(info.nextDue.amount) + " " : "") + "due", date: info.nextDue.date });
    }
    rows.push({ title: "Creative meeting", sub: "Music, flow and special moments, about 4 months out", date: addDays(ev, -122) });
    rows.push({ title: "Final payment due", sub: full ? "Paid in full. Thank you!" : "Remaining balance, 60 days out", date: finalDue, paid: full });
    rows.push({ title: "Final planning meeting", sub: "We lock in every detail, about 6 weeks out", date: addDays(ev, -45) });
    rows.push({ title: "Add-on deadline", sub: "Last day to add enhancements", date: addDays(ev, -TP.addonDeadlineDays) });
    if (lock) rows.push({ title: "Planning forms lock", sub: "Last day to make changes in the portal", date: lock });
    rows.push({ title: /wedding/i.test(info.type || "") ? "Wedding day" : "Event day", sub: "Let's dance.", date: ev, hot: true });
    rows.sort(function (a, b) { return a.date - b.date; });
    return '<section class="tp-card tp-keys" aria-label="Key dates">' +
      '<h3 class="tp-keys__title">Key dates</h3><ul class="tp-keys__list">' + rows.map(function (r) {
        var n = daysUntil(r.date);
        var right = r.paid ? "Paid" : n < 0 ? "Done" : inDays(r.date);
        var cls = r.paid || n < 0 ? "done" : r.hot ? "hot" : "";
        return '<li class="tp-keys__row' + (cls ? " tp-keys__row--" + cls : "") + '">' +
          '<span class="tp-keys__tile' + (r.hot ? " tp-keys__tile--hot" : "") + '"><small>' + esc(r.date.toLocaleDateString("en-US", { month: "short" })) + '</small><b>' + r.date.getDate() + '</b></span>' +
          '<span class="tp-keys__copy"><b>' + esc(r.title) + '</b><small>' + esc(r.sub) + '</small></span>' +
          '<span class="tp-keys__when">' + esc(right) + '</span></li>';
      }).join("") + '</ul></section>';
  }

  // ---------------------------------------------------------- enhancements
  function family(name) { return String(name || "").toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
  function isTravelOrDiscount(name) { return /discount|travel|toll|hotel|accommodation|rental vehicle|air travel|gear rental/i.test(name); }

  function enhanceHtml(id, info) {
    var booked = [];
    if (info.pkg) booked.push({ name: info.pkg.name, price: info.pkg.price, sub: "Your package" });
    info.items.forEach(function (it) { if (!isTravelOrDiscount(it.name)) booked.push({ name: it.name.replace(/\s*\(\d+\)\s*$/, ""), price: it.price, sub: "Enhancement" }); });
    var have = {};
    info.items.forEach(function (it) { have[family(it.name)] = 1; });
    var avail = TP.addons.filter(function (a) { return !have[family(a.match || a.name)] && !have[family(a.name)]; });
    var deadline = addDays(info.date, -TP.addonDeadlineDays);
    var closed = todayStart() > deadline;
    var priceTxt = function (a) { return a.price == null ? "Ask me" : (a.from ? "From " : "") + money(a.price); };
    return '<section class="tp-enh" aria-label="Your enhancements" data-event="' + esc(info.name || "") + '">' +
      '<div class="tp-enh__head"><div><p class="tp-kicker">Your enhancements</p><h3 class="tp-enh__title">Turn the night <em>up.</em></h3></div>' +
      '<p class="tp-enh__note">' + (closed ? "The add-on deadline has passed, but message me and I'll see what I can do." :
        "Tap anything that catches your eye and send it to me. I'll confirm pricing and availability before anything is added. Last day to add: " + esc(fmtDate(deadline)) + ".") + '</p></div>' +
      '<div class="tp-enh__grid">' +
        '<div class="tp-card tp-enh__booked"><h4>Booked for your night</h4><ul>' + (booked.length ? booked.map(function (b) {
          return '<li><span class="tp-enh__check">' + icon("check") + '</span><span class="tp-enh__copy"><b>' + esc(b.name) + '</b><small>' + esc(b.sub) + '</small></span>' +
            (b.price ? '<span class="tp-enh__price">' + money(b.price) + '</span>' : "") + '</li>';
        }).join("") : '<li class="tp-enh__empty">Your package details will show here.</li>') + '</ul></div>' +
        '<div class="tp-card tp-enh__add"><h4>Add to your night</h4>' +
          '<ul class="tp-enh__menu">' + avail.map(function (a) {
            return '<li class="' + (a.featured ? "" : "tp-enh__more") + '"><span class="tp-enh__copy"><b>' + esc(a.name) + '</b><small>' + esc(a.note) + '</small></span>' +
              '<span class="tp-enh__price">' + esc(priceTxt(a)) + '</span>' +
              '<button type="button" class="tp-enh__btn" aria-pressed="false" data-name="' + esc(a.name) + '"' + (closed ? " disabled" : "") + '>+ Add</button></li>';
          }).join("") + '</ul>' +
          (avail.some(function (a) { return !a.featured; }) ? '<button type="button" class="tp-enh__toggle">Show all enhancements</button>' : "") +
          '<div class="tp-enh__bar" hidden><span class="tp-enh__count"></span><a class="tp-btn tp-enh__send" href="#">Send to Tony</a></div>' +
        '</div>' +
      '</div></section>';
  }

  function wireEnhance(root, id) {
    var picked = [];
    var bar = qs(".tp-enh__bar", root), count = qs(".tp-enh__count", root), send = qs(".tp-enh__send", root);
    var evName = root.getAttribute("data-event") || "";
    function update() {
      bar.hidden = !picked.length;
      count.textContent = picked.length + (picked.length === 1 ? " enhancement" : " enhancements") + " selected";
      send.href = "contact.asp?tpadd=" + encodeURIComponent(picked.join("|")) + (evName ? "&tpevent=" + encodeURIComponent(evName) : "");
    }
    qsa(".tp-enh__btn", root).forEach(function (b) {
      b.addEventListener("click", function () {
        var name = b.getAttribute("data-name"), on = b.getAttribute("aria-pressed") !== "true";
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.textContent = on ? "✓ Added" : "+ Add";
        picked = picked.filter(function (p) { return p !== name; });
        if (on) picked.push(name);
        update();
      });
    });
    var tg = qs(".tp-enh__toggle", root);
    if (tg) tg.addEventListener("click", function () {
      var open = root.classList.toggle("tp-enh--all");
      tg.textContent = open ? "Show fewer" : "Show all enhancements";
    });
  }

  // ---------------------------------------------------------- hear my sound
  function soundHtml() {
    var d = TP.dj;
    return '<section class="tp-card tp-sound" aria-label="Hear my sound">' +
      '<p class="tp-kicker">Hear my sound</p><h3 class="tp-sound__title">Get a feel for the vibe while you plan.</h3>' +
      '<p class="tp-sound__intro">' + esc(d.intro) + '</p>' +
      '<ul class="tp-sound__links">' + d.links.map(function (l) {
        return '<li><a href="' + esc(l[1]) + '" target="_blank" rel="noopener"><span>' + esc(l[0]) + '</span><small>' +
          esc(/instagram/i.test(l[0]) ? "Clips from recent nights" : /spotify|apple/i.test(l[0]) ? "My original music" : "Full DJ mixes") +
          '</small><i aria-hidden="true">&rarr;</i></a></li>';
      }).join("") + '</ul>' +
      '<div class="tp-meet__actions"><a class="tp-btn" href="' + esc(d.meeting) + '" target="_blank" rel="noopener">Book a call with me</a>' +
      '<a class="tp-link" href="' + esc(d.website) + '" target="_blank" rel="noopener">Visit my website</a></div></section>';
  }

  function buildDashboard(id, card) {
    var panel = card.closest(".djep-home-events-panel") || card;
    if (qs(".tp-dash")) return;
    var dash = document.createElement("div");
    dash.className = "tp-dash";
    dash.innerHTML = '<div class="tp-slot tp-slot--hero"></div><div class="tp-slot tp-slot--wave"></div><div class="tp-slot tp-slot--progress"></div>' +
      '<div class="tp-slot tp-slot--enh"></div><div class="tp-dash__pair"><div class="tp-slot tp-slot--keys"></div><div class="tp-slot tp-slot--sound">' + soundHtml() + '</div></div>';
    panel.insertAdjacentElement("beforebegin", dash);
    loadProgress(id, qs(".tp-slot--progress", dash), "afterbegin");
    eventInfo(id).then(function (info) {
      if (!info || !info.date) throw new Error("no info");
      var full = isPaidFull(info);
      qs(".tp-slot--hero", dash).innerHTML = heroHtml(id, info);
      // the hero replaces DJEP's own card for this event
      card.classList.add("tp-card-replaced");
      if (!qsa(".djep-home-event-card", panel).some(function (c) { return !c.classList.contains("tp-card-replaced"); })) panel.classList.add("tp-card-replaced");
      startClock(qs(".tp-hero", dash), eventStart(info));
      calendarButton(id, qs(".tp-hero__cal", dash), "afterbegin");
      qs(".tp-slot--enh", dash).innerHTML = enhanceHtml(id, info);
      wireEnhance(qs(".tp-enh", dash), id);
      return lockDate(id, info.date).then(function (lock) {
        qs(".tp-slot--wave", dash).innerHTML = journeyHtml(info, lock, full);
        qs(".tp-slot--keys", dash).innerHTML = keyDatesHtml(info, lock, full);
      });
    }).catch(function () {
      // fall back to the earlier layout if the event page could not be read
      dash.remove();
      card.classList.remove("tp-card-replaced");
      panel.classList.remove("tp-card-replaced");
      var grid = document.createElement("div");
      grid.className = "tp-home-grid";
      grid.innerHTML = '<div class="tp-slot tp-slot--progress"></div><div class="tp-slot tp-slot--road"></div><div class="tp-slot tp-slot--meet">' + meetHtml() + '</div>';
      panel.insertAdjacentElement("afterend", grid);
      loadProgress(id, qs(".tp-slot--progress", grid), "afterbegin");
      loadEventCards(id, { roadmap: qs(".tp-slot--road", grid) });
    });
  }

  // ======================================================================
  // MAKE A PAYMENT (2026-10-28): investment summary, payment plan,
  // history and fee breakdown around DJEP's own pay button.
  // ======================================================================
  function paymentPageHtml(id, info, payHref) {
    var total = info.total || 0;
    var balance = info.balance != null ? Math.max(0, info.balance) : Math.max(0, total - info.paid);
    var paid = Math.max(0, total - balance);
    var full = total > 0 && balance <= 0.004;
    var pct = total ? Math.min(100, Math.round((paid / total) * 100)) : 0;
    var today = todayStart();
    var finalDue = addDays(info.date, -TP.finalPaymentDays);
    var retainer = info.retainer && info.retainer < total ? info.retainer : null;
    var retPct = retainer ? Math.round((retainer / total) * 100) : null;

    // the plan: retainer at booking, balance before the event (DJEP due dates win when listed)
    var plan = [];
    if (retainer) plan.push({ title: "Retainer (" + retPct + "%)", sub: "Secures your date", amount: retainer, date: info.bookedOn, paid: paid + 0.004 >= retainer, when: paid + 0.004 >= retainer ? (info.bookedOn ? "Paid " + fmtDate(info.bookedOn) : "Paid") : "Due now to hold your date" });
    var restAmt = retainer ? total - retainer : total;
    plan.push({ title: retainer ? "Final balance (" + (100 - retPct) + "%)" : "Balance", sub: TP.finalPaymentDays + " days before your event", amount: restAmt, date: finalDue, paid: full, when: full ? "Paid in full" : "Due " + fmtDate(finalDue) + (daysUntil(finalDue) >= 0 ? " · " + inDays(finalDue).toLowerCase() : "") });
    var nextIdx = -1;
    plan.forEach(function (p, i) { if (!p.paid && nextIdx === -1) nextIdx = i; });

    var nextAmt = 0;
    if (!full) {
      if (info.nextDue && info.nextDue.amount) nextAmt = Math.min(info.nextDue.amount, balance);
      else if (retainer && paid + 0.004 < retainer) nextAmt = retainer - paid;
      else nextAmt = balance;
    }
    var nextDate = !full ? (info.nextDue ? info.nextDue.date : nextIdx > -1 ? plan[nextIdx].date : finalDue) : null;
    var overdue = nextDate && nextDate < today;

    var fee = [];
    if (info.pkg) fee.push({ name: info.pkg.name, price: info.pkg.price, kind: "Package" });
    info.items.forEach(function (it) { fee.push({ name: it.name.replace(/\s*\(\d+\)\s*$/, ""), price: it.price, kind: isTravelOrDiscount(it.name) ? (/discount/i.test(it.name) ? "Discount" : "Travel") : "Enhancement" }); });

    return '<div class="tp-paypage">' +
      '<div class="tp-paypage__intro"><p class="tp-kicker">Payments</p><h2 class="tp-paypage__title">Your investment</h2>' +
      '<p class="tp-paypage__lead">' + esc(info.name || "Your event") + (info.date ? " · " + esc(fmtDate(info.date, true)) : "") + '</p></div>' +
      '<div class="tp-paypage__top">' +
        // summary
        '<section class="tp-card tp-paysum">' +
          '<div class="tp-paysum__label">Total for your night</div>' +
          '<div class="tp-paysum__total">' + money(total) + '</div>' +
          '<div class="tp-paysum__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><span style="width:' + pct + '%"></span></div>' +
          '<div class="tp-paysum__split"><span><b>' + money(paid) + '</b> paid</span><span><b>' + money(balance) + '</b> remaining</span></div>' +
          (full
            ? '<div class="tp-paysum__done">' + icon("check") + '<span><b>Paid in full</b><small>Thank you! Your night is all set on my end.</small></span></div>'
            : '<div class="tp-paysum__next' + (overdue ? " tp-paysum__next--late" : "") + '"><small>' + (overdue ? "Past due" : "Next payment") + '</small><b>' + money(nextAmt) + '</b>' +
              '<span>' + (nextDate ? (overdue ? "Was due " : "Due ") + esc(fmtDate(nextDate)) + (overdue ? "" : " · " + esc(inDays(nextDate).toLowerCase())) : "Anytime") + '</span></div>' +
              (payHref ? '<a class="tp-paysum__pay" href="' + esc(payHref) + '">' + icon("card") + 'Pay with Venmo</a>' : "") +
              '<p class="tp-paysum__fine">Pay the next amount, a little extra, or the full ' + money(balance) + ' anytime. Your tracker updates once I receive it.</p>') +
        '</section>' +
        // plan
        '<section class="tp-card tp-plan">' +
          '<h3 class="tp-plan__title">Payment plan</h3>' +
          '<ol class="tp-plan__list">' + plan.map(function (p, i) {
            var st = p.paid ? "paid" : i === nextIdx ? (p.date && p.date < today ? "late" : "next") : "later";
            var lbl = { paid: "Paid", next: "Next", late: "Past due", later: "Upcoming" }[st];
            return '<li class="tp-plan__row tp-plan__row--' + st + '"><span class="tp-plan__dot">' + (p.paid ? icon("check") : (i + 1)) + '</span>' +
              '<span class="tp-plan__copy"><b>' + esc(p.title) + '</b><small>' + esc(p.when) + '</small></span>' +
              '<span class="tp-plan__amt"><b>' + money(p.amount) + '</b><small>' + lbl + '</small></span></li>';
          }).join("") + '</ol>' +
          '<p class="tp-plan__note">' + (retainer ? "The " + retPct + "% retainer secures your date. " : "") + "The remaining balance is due " + TP.finalPaymentDays + " days before your event. Questions about your plan? <a href=\"contact.asp\">Message me</a>.</p>" +
        '</section>' +
      '</div>' +
      '<div class="tp-paypage__bottom">' +
        '<section class="tp-card tp-hist"><h3 class="tp-plan__title">Payment history</h3>' +
          (info.history.length ? '<ul class="tp-hist__list">' + info.history.map(function (h) {
            return '<li><span class="tp-keys__tile"><small>' + esc(h.date.toLocaleDateString("en-US", { month: "short" })) + '</small><b>' + h.date.getDate() + '</b></span>' +
              '<span class="tp-keys__copy"><b>' + esc(h.method) + '</b><small>' + esc(fmtDate(h.date)) + '</small></span>' +
              '<span class="tp-hist__amt' + (h.refund ? " tp-hist__amt--refund" : "") + '">' + (h.refund ? "-" : "") + money(h.amount) + '</span></li>';
          }).join("") + '</ul>' : '<p class="tp-hist__empty">No payments yet. Your first one will show up here.</p>') +
        '</section>' +
        '<section class="tp-card tp-feebox"><h3 class="tp-plan__title">What\'s included</h3><ul class="tp-feebox__list">' +
          fee.map(function (f) {
            return '<li><span class="tp-keys__copy"><b>' + esc(f.name) + '</b><small>' + esc(f.kind) + '</small></span><span class="tp-feebox__price' + (f.price < 0 ? " tp-feebox__price--neg" : "") + '">' + (f.price == null ? "" : (f.price < 0 ? "-" : "") + money(Math.abs(f.price))) + '</span></li>';
          }).join("") +
          '<li class="tp-feebox__total"><span>Total</span><span>' + money(total) + '</span></li>' +
        '</ul><a class="tp-link" href="eventdetails.asp?eventid=' + encodeURIComponent(id) + '">See event details</a></section>' +
      '</div>' +
    '</div>';
  }

  function paymentPage() {
    var id = param("eventid");
    if (!id || (location.search && !/action=choose_payment_gateway/i.test(location.search) && /action=/i.test(location.search))) return;
    when(function () { return qs("#page_paypal .djep-makepaymentbox") || qs("#page_paypal"); }, function () {
      var page = qs("#page_paypal");
      if (!page || qs(".tp-paypage")) return;
      var gw = qsa(".djep-makepaymentbox a[href]", page);
      var payHref = gw.length ? gw[0].getAttribute("href") : "";
      eventInfo(id).then(function (info) {
        if (!info || !info.total) return;
        var wrap = document.createElement("div");
        wrap.innerHTML = paymentPageHtml(id, info, gw.length === 1 ? payHref : "");
        page.insertBefore(wrap.firstChild, page.firstChild);
        page.classList.add("tp-paypage-ready");
        // more than one gateway: keep DJEP's choices visible under a heading
        if (gw.length > 1) qs(".tp-paysum__fine", page) && qs(".tp-paysum__fine", page).insertAdjacentHTML("beforebegin", '<p class="tp-paysum__fine">Choose how to pay below.</p>');
        else page.classList.add("tp-paypage-onegw");
      }).catch(function () {});
    });
  }

  // Contact page: pre-fill the message when enhancements were picked on Home
  function contactPage() {
    var add = param("tpadd");
    if (!add) return;
    when(function () { return qs('[name="contact_form_message"]'); }, function (ta) {
      var subj = qs('[name="contact_form_subject"]');
      var ev = param("tpevent");
      var list = add.split("|").filter(Boolean);
      if (subj && !subj.value) subj.value = "Enhancement request" + (ev ? ": " + ev : "");
      if (!ta.value) ta.value = "Hi Tony! I'd love to add " + (list.length === 1 ? "this" : "these") + " to " + (ev || "my event") + ":\n\n" +
        list.map(function (x) { return "- " + x; }).join("\n") + "\n\nCan you confirm pricing and availability?";
      ta.focus();
    });
  }

  // --------------------------------------------------------------- pages
  function homePage() {
    when(function () { return qsa(".djep-home-event-card").length ? qsa(".djep-home-event-card") : null; }, function (cards) {
      cards.forEach(function (card, i) {
        if (card.getAttribute("data-tp-extras")) return;
        card.setAttribute("data-tp-extras", "1");
        var id = card.getAttribute("data-eventid");
        var date = parseDate(txt(qs(".event_date_" + id, card)));
        var details = qs(".djep-home-event-details", card);
        var first = i === 0 && date && daysUntil(date) >= 0;
        if (date && details && !first) {
          var html = countdownHtml(date, false);
          if (html) details.insertAdjacentHTML("beforeend", html);
          var cdEl = qs(".tp-countdown", details);
          if (daysUntil(date) >= 0 && cdEl) calendarButton(id, cdEl, "afterend");
        }
        // full dashboard for the first upcoming event only (keeps Home fast)
        if (first) buildDashboard(id, card);
      });
    });
  }

  function planPage() {
    var id = param("eventid");
    when(function () { return qs(".djep-plan-panel") || qs(".djep-plan-flow"); }, function () {
      var metaVal = qsa(".djep-plan-meta .djep-home-event-meta-value")[0];
      var date = parseDate(txt(metaVal));
      var meta = qs(".djep-plan-meta");
      if (date && meta && !qs(".tp-countdown", meta.parentElement)) {
        var html = countdownHtml(date, true);
        if (html) meta.insertAdjacentHTML("afterend", html);
      }
      // planning-lock reminder from the access notice
      var msg = qs(".djep-plan-access-message");
      var lock = msg && txt(msg).match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (lock && !qs(".tp-lockline")) {
        var ld = parseDate(lock[1]);
        var n = ld ? daysUntil(ld) : -1;
        if (n >= 0) {
          msg.insertAdjacentHTML("afterend", '<p class="tp-lockline">' +
            (n === 0 ? "Forms lock tonight." : esc(n.toLocaleString("en-US")) + (n === 1 ? " day" : " days") + " left to make changes.") + '</p>');
        }
      }
      var anchor = qs(".djep-plan-access-note") || qs(".djep-plan-subtitle");
      if (anchor && !qs(".tp-plan-grid")) {
        var grid = document.createElement("div");
        grid.className = "tp-plan-grid";
        grid.innerHTML = '<div class="tp-slot tp-slot--progress"></div><div class="tp-slot tp-slot--road"></div>';
        anchor.insertAdjacentElement("afterend", grid);
        loadProgress(id, qs(".tp-slot--progress", grid), "afterbegin");
        loadEventCards(id, { roadmap: qs(".tp-slot--road", grid) });
      }
      var cd = qs(".tp-countdown");
      if (cd && date && daysUntil(date) >= 0) calendarButton(id, cd, "afterend");
    });
  }

  function detailsPage() {
    var id = param("eventid");
    when(function () { return qs(".djep-eventdetails-meta") || qs(".djep-card-documents"); }, function () {
      // countdown next to the heading meta
      var meta = qs(".djep-eventdetails-meta");
      if (meta && !qs(".tp-countdown", meta.parentElement)) {
        var dateItem = qsa(".djep-eventdetails-meta-item", meta).filter(function (it) { return /date/i.test(txt(qs(".djep-eventdetails-meta-label", it))); })[0];
        var date = parseDate(txt(qs(".djep-eventdetails-meta-value", dateItem)));
        if (date) {
          var html = countdownHtml(date, true);
          if (html) meta.insertAdjacentHTML("afterend", html);
          if (daysUntil(date) >= 0) calendarButton(id, qs(".tp-countdown", meta.parentElement) || meta, "afterend");
        }
      }
      // Tidy layout: Payments card on top of the right column, Documents under
      // the event info in the left column so both columns line up.
      var side = qs(".djep-eventdetails-column-side");
      var mainCol = qs(".djep-eventdetails-column-main");
      if (side && !qs(".tp-slot--pay")) {
        var slot = document.createElement("div");
        slot.className = "tp-slot tp-slot--pay tp-slot--details";
        side.insertBefore(slot, side.firstChild);
        loadEventCards(id, { payment: slot });
      }
      var docsCard = qs(".djep-card-documents");
      if (mainCol && docsCard && docsCard.parentElement !== mainCol) {
        docsCard.classList.add("tp-docs-moved");
        mainCol.appendChild(docsCard);
      }
      rescueRelatedFiles(id);
    });
  }

  // Related Files: the main script removes this box, so read it from the page source.
  function rescueRelatedFiles(id) {
    when(function () { return qs(".djep-card-documents table"); }, function (table) {
      if (table.getAttribute("data-tp-related")) return;
      table.setAttribute("data-tp-related", "1");
      getDoc("eventdetails.asp?eventid=" + encodeURIComponent(id)).then(function (doc) {
        var box = doc && qs(".djep-relatedfilesbox", doc);
        if (!box) return;
        var body = table.tBodies[0] || table;
        var have = txt(table).toLowerCase();
        qsa("tr", box).forEach(function (row) {
          var name = txt(row.children[0]);
          var link = qs("a[href]", row);
          if (!name || !link || have.indexOf(name.toLowerCase()) !== -1) return;
          var tr = document.createElement("tr");
          tr.className = "tp-related-row";
          tr.innerHTML = '<td align="left">' + esc(name) + '</td><td align="right"><a class="djep-readviewbutton" target="_blank" rel="noopener" href="' + esc(link.getAttribute("href")) + '">View</a></td>';
          body.appendChild(tr);
        });
      });
    }, 40);
  }

  // Special songs are collected in the planning form, so the separate
  // Special Songs page is closed: anyone landing there goes to Music.
  function blockSpecialSongs() {
    if (/\/clients\/(music|print)\.asp/.test(path) && /action=(special_songs|print_special)/i.test(location.search)) {
      var id = param("eventid");
      location.replace("music.asp" + (id ? "?eventid=" + encodeURIComponent(id) : ""));
      return true;
    }
    return false;
  }

  function start() {
    if (/\/clients\/home\.asp/.test(path)) homePage();
    else if (/\/clients\/planmyevent\.asp/.test(path)) planPage();
    else if (/\/clients\/eventdetails\.asp/.test(path)) detailsPage();
    else if (/\/clients\/contact\.asp/.test(path)) contactPage();
    else if (/\/clients\/makeapayment\.asp/.test(path)) paymentPage();
  }

  if (blockSpecialSongs()) return;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
