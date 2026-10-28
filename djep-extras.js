/* ============================================================================
   Tony Pre client portal extras (loaded from GitHub Pages)
   - Event countdown (Home, Plan My Event, Event Details)
   - Planning progress checklist (Home, Plan My Event)
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

  function specialSongCount(doc) {
    if (!doc) return null;
    var types = qsa(".djep-special_song_header", doc);
    var picked = types.filter(function (h) {
      var key = h.id.replace("special_song_header_div_", "");
      return txt(qs("#song_div_" + key, doc)) || txt(qs("#artist_div_" + key, doc));
    }).length;
    return { picked: picked, total: types.length };
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
        title: "Special Songs",
        n: d.special ? d.special.picked : 0,
        status: !d.special || !d.special.picked ? "Not started" : d.special.picked >= d.special.total ? "Done" : "In progress",
        detail: d.special ? d.special.picked + " of " + d.special.total + " picked" : "First dance and more",
        href: "music.asp?action=special_songs&eventid=" + encodeURIComponent(eventId),
        state: !d.special || !d.special.picked ? "todo" : d.special.picked >= d.special.total ? "done" : "go"
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
      getDoc("music.asp?action=special_songs&eventid=" + id),
      getDoc("songrequests.asp?action=view_requests&eventid=" + id),
      getDoc("timeline.asp?eventid=" + id + "&action=view")
    ]).then(function (docs) {
      holder.innerHTML = progressHtml(eventId, {
        form: planningFormCount(docs[0]) || 0,
        special: specialSongCount(docs[1]),
        requests: requestCount(docs[2]) || 0,
        timeline: timelineCount(docs[3]) || 0
      });
      holder.classList.remove("tp-progress-holder--loading");
    }).catch(function () { holder.remove(); });
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
        // progress for the first upcoming event only (keeps Home fast)
        if (i === 0 && date && daysUntil(date) >= 0) {
          var shell = qs(".djep-home-event-shell", card) || card;
          loadProgress(id, shell, "beforeend");
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
      if (anchor) loadProgress(id, anchor, "afterend");
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
        }
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

  function start() {
    if (/\/clients\/home\.asp/.test(path)) homePage();
    else if (/\/clients\/planmyevent\.asp/.test(path)) planPage();
    else if (/\/clients\/eventdetails\.asp/.test(path)) detailsPage();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
