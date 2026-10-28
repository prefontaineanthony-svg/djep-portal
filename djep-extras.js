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
      getDoc("timeline.asp?eventid=" + id + "&action=view")
    ]).then(function (docs) {
      holder.innerHTML = progressHtml(eventId, {
        form: planningFormCount(docs[0]) || 0,
        requests: requestCount(docs[1]) || 0,
        timeline: timelineCount(docs[2]) || 0
      });
      holder.classList.remove("tp-progress-holder--loading");
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
      { days: 180, title: "Creative meeting", detail: "We talk through the vibe, your must-plays and the flow of the night." },
      { days: 60, title: "Planning form", detail: "Fill in names, key moments and music for each part of the night." },
      { lock: true, title: "Planning forms lock", detail: "Last day to make changes in the portal." },
      { days: 3, title: "Final check-in", detail: "I review every detail with you so you can relax." },
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
      meeting: "https://calendly.com/thetonypre/meetme"
    }
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
        nextDue: null
      };
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
  function roadmapHtml(eventDate, lock) {
    var today = new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var steps = TP.roadmap.map(function (s) {
      var d = s.lock ? (lock || addDays(eventDate, -TP.lockDaysFallback)) : addDays(eventDate, -s.days);
      return { title: s.title, detail: s.detail, date: d };
    }).sort(function (a, b) { return a.date - b.date; });
    var nextIdx = -1;
    steps.some(function (s, i) { if (s.date >= today) { nextIdx = i; return true; } return false; });
    return '<section class="tp-card tp-road" aria-label="What\'s next">' +
      '<p class="tp-kicker">What\'s next</p>' +
      '<ol class="tp-road__list">' + steps.map(function (s, i) {
        var state = s.date < today ? "done" : i === nextIdx ? "next" : "later";
        var n = daysUntil(s.date);
        var when = state === "done" ? "Done" : n === 0 ? "Today" : n === 1 ? "Tomorrow" : "In " + n.toLocaleString("en-US") + " days";
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
        jobs.push(lockDate(id, info.date).then(function (lock) { opts.roadmap.innerHTML = roadmapHtml(info.date, lock); }));
      } else if (opts.roadmap) opts.roadmap.remove();
      return Promise.all(jobs);
    }).catch(function () {});
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
        if (date && details) {
          var html = countdownHtml(date, false);
          if (html) details.insertAdjacentHTML("beforeend", html);
        }
        if (date && daysUntil(date) >= 0) {
          var actions = qs(".djep-home-event-actions", card);
          if (actions) calendarButton(id, actions, "beforeend");
        }
        // full dashboard for the first upcoming event only (keeps Home fast)
        if (i === 0 && date && daysUntil(date) >= 0) {
          var panel = card.closest(".djep-home-events-panel") || card;
          var grid = document.createElement("div");
          grid.className = "tp-home-grid";
          grid.innerHTML = '<div class="tp-slot tp-slot--progress"></div><div class="tp-slot tp-slot--pay"></div><div class="tp-slot tp-slot--road"></div><div class="tp-slot tp-slot--meet">' + meetHtml() + '</div>';
          panel.insertAdjacentElement("afterend", grid);
          loadProgress(id, qs(".tp-slot--progress", grid), "afterbegin");
          loadEventCards(id, { payment: qs(".tp-slot--pay", grid), roadmap: qs(".tp-slot--road", grid) });
        }
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
      var totalsCard = qs(".djep-card-totals") || qs(".djep-eventdetails-card-totals");
      if (totalsCard && !qs(".tp-slot--pay")) {
        var slot = document.createElement("div");
        slot.className = "tp-slot tp-slot--pay tp-slot--details";
        (totalsCard.closest(".djep-card-pricing, .djep-eventdetails-card-pricing") || totalsCard).insertAdjacentElement("beforebegin", slot);
        loadEventCards(id, { payment: slot });
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
  }

  if (blockSpecialSongs()) return;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
