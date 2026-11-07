/* Before Landfall: accounts and the Community page.
 *
 * The project may only use HTML, CSS and JavaScript, so there is no server and no
 * database. Everything here lives in this browser's localStorage:
 *   - accounts (passwords are stored only as a salted SHA-256 hash, never as text),
 *   - who is logged in (localStorage when "keep me logged in" is ticked, otherwise
 *     sessionStorage, which the browser forgets when the tab closes),
 *   - meet-ups on the calendar, and posts and replies on the knowledge board.
 * It works like a real community site, but only on one device: other visitors cannot
 * see what you post. A real site would keep the same data on a server instead.
 *
 * Contents
 *   1. Storage and cleaning saved data
 *   2. Password hashing (SHA-256, written out in plain JavaScript)
 *   3. Accounts and the logged-in person
 *   4. Sample meet-ups, posts and members
 *   5. Small helpers for building the page
 *   6. Header: the account link on every page
 *   7. Account page: log in and register
 *   8. Community page: calendar, meet-ups, knowledge board, admin tools
 *   9. Start
 */
(function () {
  "use strict";

  // ==========================================================================
  // 1. Storage and cleaning saved data
  // ==========================================================================

  const KEYS = {
    users: "beforeLandfall.users.v1",
    session: "beforeLandfall.session.v1",
    events: "beforeLandfall.events.v1",
    posts: "beforeLandfall.posts.v1",
  };

  // The project group are the admins. Their accounts are waiting from the start, but have
  // no password until each person registers with their school email. Anyone can read this
  // file, so it holds only a SHA-256 fingerprint of each email, never the email itself
  // and never a password.
  const GROUP_ADMINS = [
    { id: "u-lin", name: "Lin Thuriya Pho Hlaing", username: "lin_thuriya", emailHash: "d750bccdfb807f8fc3d2d968d5918e1b519203c8e433fcc5b6e5134407b80c2f" },
    { id: "u-zayar", name: "Zayar Win Htay", username: "zayar_win_htay", emailHash: "d300fabfbb599651b9ac0b194d6fe095b4ea811ac3a2d56e13519efead26352f" },
    { id: "u-pyay", name: "Pyay Lin Thant", username: "pyay_lin_thant", emailHash: "327e7d156b76bfe5f7360d5bf55840b80bd6d99e0a5b9c55caf7cbaedb1019dd" },
  ];

  const TOPICS = ["Notice", "Science", "Safety tips", "History", "Question"];
  const LIMITS = { name: 40, username: 20, email: 80, title: 100, place: 80, details: 600, body: 2000, reply: 1000 };

  // localStorage can be switched off, full or blocked. Every read and write goes through
  // these, so a storage problem shows a message instead of breaking the page.
  function storageArea(kind) {
    try {
      const area = kind === "session" ? window.sessionStorage : window.localStorage;
      const probe = "beforeLandfall.probe";
      area.setItem(probe, "1");
      area.removeItem(probe);
      return area;
    } catch (error) {
      return null;
    }
  }
  const local = storageArea("local");
  const session = storageArea("session");

  function readJSON(area, key) {
    if (!area) return undefined;
    try {
      const text = area.getItem(key);
      return text === null ? undefined : JSON.parse(text);
    } catch (error) {
      return null; // damaged save: treated as missing data, then replaced on the next write
    }
  }

  function writeJSON(area, key, value) {
    if (!area) return false;
    try {
      area.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function remove(area, key) {
    if (!area) return;
    try { area.removeItem(key); } catch (error) {}
  }

  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const cleanText = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
  const isId = (value) => typeof value === "string" && /^[a-z]-[\w-]{1,40}$/i.test(value);
  const isTime = (value) => typeof value === "number" && Number.isFinite(value) && value > 0 && value < 8.64e15;
  const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function isDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }

  // Each cleaner keeps only well-formed records and copies only known fields, so a
  // damaged or edited save can never put unexpected values (or HTML) on the page.
  function cleanUser(raw) {
    if (!isObject(raw) || !isId(raw.id)) return null;
    const username = cleanText(raw.username, LIMITS.username).toLowerCase();
    const name = cleanText(raw.name, LIMITS.name);
    if (!USERNAME_PATTERN.test(username) || !name) return null;
    return {
      id: raw.id,
      name,
      username,
      email: cleanText(raw.email, LIMITS.email).toLowerCase(),
      salt: typeof raw.salt === "string" && /^[0-9a-f]{8,64}$/.test(raw.salt) ? raw.salt : "",
      hash: typeof raw.hash === "string" && /^[0-9a-f]{64}$/.test(raw.hash) ? raw.hash : "",
      role: raw.role === "admin" ? "admin" : "member",
      joined: isTime(raw.joined) ? raw.joined : Date.now(),
      avatar: cleanAvatar(raw.avatar), // null until they choose one
    };
  }

  function cleanEvent(raw) {
    if (!isObject(raw) || !isId(raw.id) || !isDate(raw.date)) return null;
    const title = cleanText(raw.title, LIMITS.title);
    if (!title) return null;
    return {
      id: raw.id,
      title,
      date: raw.date,
      time: typeof raw.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.time) ? raw.time : "",
      place: cleanText(raw.place, LIMITS.place),
      details: cleanText(raw.details, LIMITS.details),
      authorId: isId(raw.authorId) ? raw.authorId : "",
      status: raw.status === "pending" ? "pending" : "approved",
      going: Array.isArray(raw.going) ? Array.from(new Set(raw.going.filter(isId))).slice(0, 500) : [],
    };
  }

  function cleanReply(raw) {
    if (!isObject(raw) || !isId(raw.id)) return null;
    const body = cleanText(raw.body, LIMITS.reply);
    if (!body) return null;
    return { id: raw.id, body, authorId: isId(raw.authorId) ? raw.authorId : "", created: isTime(raw.created) ? raw.created : Date.now() };
  }

  function cleanPost(raw) {
    if (!isObject(raw) || !isId(raw.id)) return null;
    const title = cleanText(raw.title, LIMITS.title);
    const body = cleanText(raw.body, LIMITS.body);
    if (!title || !body) return null;
    return {
      id: raw.id,
      title,
      body,
      topic: TOPICS.includes(raw.topic) ? raw.topic : "Question",
      authorId: isId(raw.authorId) ? raw.authorId : "",
      created: isTime(raw.created) ? raw.created : Date.now(),
      pinned: raw.pinned === true,
      replies: Array.isArray(raw.replies) ? raw.replies.map(cleanReply).filter(Boolean).slice(0, 200) : [],
    };
  }

  function cleanList(value, cleaner) {
    if (!Array.isArray(value)) return null;
    const seen = new Set();
    return value.map(cleaner).filter((item) => item && !seen.has(item.id) && seen.add(item.id));
  }

  function newId(prefix) {
    let random = "";
    try {
      const bytes = new Uint8Array(6);
      window.crypto.getRandomValues(bytes);
      random = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    } catch (error) {
      random = Math.random().toString(16).slice(2, 14);
    }
    return prefix + "-" + Date.now().toString(36) + random;
  }

  // ==========================================================================
  // 2. Password hashing
  // ==========================================================================

  // SHA-256 in plain JavaScript. The browser's own crypto.subtle only works on https or
  // localhost, and this site should also work when opened straight from a folder.
  // The round constants are the first 32 bits of the fractional parts of the cube roots
  // of the first 64 primes, and the starting hash uses the square roots of the first 8.
  const SHA_K = [];
  const SHA_H = [];
  (function buildConstants() {
    for (let n = 2; SHA_K.length < 64; n += 1) {
      let prime = true;
      for (let d = 2; d * d <= n; d += 1) if (n % d === 0) { prime = false; break; }
      if (!prime) continue;
      if (SHA_H.length < 8) SHA_H.push((Math.pow(n, 1 / 2) % 1) * 4294967296 | 0);
      SHA_K.push((Math.pow(n, 1 / 3) % 1) * 4294967296 | 0);
    }
  })();

  function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    const wordCount = (((bytes.length + 8) >> 6) + 1) * 16;
    const words = new Array(wordCount).fill(0);
    bytes.forEach((byte, i) => { words[i >> 2] |= byte << ((3 - (i % 4)) * 8); });
    words[bytes.length >> 2] |= 0x80 << ((3 - (bytes.length % 4)) * 8);
    words[wordCount - 1] = (bytes.length * 8) | 0;
    words[wordCount - 2] = Math.floor((bytes.length * 8) / 4294967296) | 0;

    const ror = (x, n) => (x >>> n) | (x << (32 - n));
    const hash = SHA_H.slice();
    const w = new Array(64);
    for (let block = 0; block < wordCount; block += 16) {
      let [a, b, c, d, e, f, g, h] = hash;
      for (let i = 0; i < 64; i += 1) {
        if (i < 16) {
          w[i] = words[block + i];
        } else {
          const s0 = ror(w[i - 15], 7) ^ ror(w[i - 15], 18) ^ (w[i - 15] >>> 3);
          const s1 = ror(w[i - 2], 17) ^ ror(w[i - 2], 19) ^ (w[i - 2] >>> 10);
          w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + SHA_K[i] + w[i]) | 0;
        const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g, h].forEach((value, i) => { hash[i] = (hash[i] + value) | 0; });
    }
    return hash.map((value) => (value >>> 0).toString(16).padStart(8, "0")).join("");
  }

  // The salt makes two people with the same password get different hashes, and hashing
  // many times over makes guessing passwords from a copied hash slower.
  const HASH_ROUNDS = 500;
  function hashPassword(password, salt) {
    let result = salt + ":" + password;
    for (let i = 0; i < HASH_ROUNDS; i += 1) result = sha256(result + ":" + salt);
    return result;
  }

  // ==========================================================================
  // 3. Accounts and the logged-in person
  // ==========================================================================

  const groupAdminFor = (user) => GROUP_ADMINS.find((admin) => admin.id === user.id);
  // An account that exists but has no password yet: a group admin who has not registered.
  const isUnclaimed = (user) => !user.hash;

  function loadUsers() {
    const saved = cleanList(readJSON(local, KEYS.users), cleanUser);
    const users = saved && saved.length ? saved : SAMPLE_USERS.map((user) => Object.assign({}, user));
    // The group admins are always there, so the admin tools can never be locked away.
    // One who has not registered yet is always an admin; once registered, other admins
    // may change their role like anyone else's.
    GROUP_ADMINS.slice().reverse().forEach((admin) => {
      const existing = users.find((user) => user.id === admin.id);
      if (!existing) {
        users.unshift({ id: admin.id, name: admin.name, username: admin.username, email: "", salt: "", hash: "", role: "admin", joined: new Date(2026, 0, 12).getTime() });
      } else if (isUnclaimed(existing)) {
        existing.role = "admin";
      }
    });
    return users;
  }

  const saveUsers = (users) => writeJSON(local, KEYS.users, users);

  function currentUser(users) {
    const list = users || loadUsers();
    for (const area of [session, local]) {
      const saved = readJSON(area, KEYS.session);
      if (isObject(saved) && isId(saved.userId)) {
        const user = list.find((item) => item.id === saved.userId);
        if (user) return user;
      }
    }
    return null;
  }

  function logIn(user, remember) {
    logOut();
    return writeJSON(remember ? local : session, KEYS.session, { userId: user.id, at: Date.now() });
  }

  function logOut() {
    remove(local, KEYS.session);
    remove(session, KEYS.session);
  }

  const isAdmin = (user) => !!user && user.role === "admin";

  // ==========================================================================
  // 4. Sample meet-ups, posts and members
  // ==========================================================================

  // Made-up people and events, so the calendar and board are not empty on a first visit.
  // Dates are counted from today, so the samples always sit around the current month.
  const SAMPLE_USERS = [
    { id: "u-aye", name: "Aye Chan", username: "aye_chan", email: "", salt: "", hash: "", role: "member", joined: new Date(2026, 1, 3).getTime() },
    { id: "u-min", name: "Ko Min", username: "ko_min", email: "", salt: "", hash: "", role: "member", joined: new Date(2026, 2, 19).getTime() },
    { id: "u-thiri", name: "Thiri", username: "thiri", email: "", salt: "", hash: "", role: "member", joined: new Date(2026, 4, 7).getTime() },
  ];

  const DAY = 24 * 60 * 60 * 1000;
  const toISO = (date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  const fromISO = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
  function today() { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
  const daysFromToday = (n) => { const date = today(); date.setDate(date.getDate() + n); return toISO(date); };
  const nowTime = () => { const now = new Date(); return String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0"); };

  // A meet-up has started once its day has passed, or on its day once its start time
  // has come. After that nobody can say they are going, or approve it.
  function hasStarted(event) {
    const todayISO = toISO(today());
    return event.date < todayISO || (event.date === todayISO && !!event.time && event.time <= nowTime());
  }

  function sampleEvents() {
    return [
      { id: "e-sample-satellite", title: "Satellite image night", date: daysFromToday(-6), time: "18:00", place: "ICT lab", details: "We looked at satellite pictures of past Bay of Bengal storms and spotted the eye, the spiral bands and the cloud tops.", authorId: "u-pyay", status: "approved", going: ["u-aye", "u-thiri"] },
      { id: "e-sample-fanmeet", title: "Storm Watchers’ fan meet", date: daysFromToday(4), time: "16:00", place: "School library", details: "A relaxed meet-up for anyone who loves weather. Bring a favourite cyclone fact, a satellite image or a question. Tea and snacks provided.", authorId: "u-lin", status: "approved", going: ["u-aye", "u-min"] },
      { id: "e-sample-surge", title: "Talk: why storm surge is the biggest danger", date: daysFromToday(11), time: "15:30", place: "Room 9B", details: "A short talk on how wind and low pressure push the sea onto land, and why the flat Delta floods so far inland. Questions welcome.", authorId: "u-zayar", status: "approved", going: ["u-thiri"] },
      { id: "e-sample-gobag", title: "Go-bag packing workshop", date: daysFromToday(18), time: "10:00", place: "Community hall", details: "Bring a bag and we will pack it together using the list on the Prepare page. We will also check torches and radios.", authorId: "u-thiri", status: "approved", going: [] },
      { id: "e-sample-map", title: "Draw your evacuation route", date: daysFromToday(25), time: "14:00", place: "Art room", details: "Draw a simple map from home to the nearest shelter, with a second route in case the first floods.", authorId: "u-min", status: "pending", going: [] },
    ];
  }

  function samplePosts() {
    const ago = (days, hours) => Date.now() - days * DAY - (hours || 0) * 60 * 60 * 1000;
    return [
      { id: "p-sample-welcome", title: "Welcome to the knowledge board", topic: "Notice", authorId: "u-lin", created: ago(20), pinned: true,
        body: "This board is for sharing what you learn about cyclones: facts, questions, safety tips and stories.\n\nBe kind, say where your facts come from, and remember that in a real storm, official warnings always come first.",
        replies: [] },
      { id: "p-sample-surge", title: "Why is the storm surge more dangerous than the wind?", topic: "Science", authorId: "u-aye", created: ago(6, 3), pinned: false,
        body: "In class we read that most deaths in Cyclone Nargis were linked to the storm surge, not the wind.\n\nThe surge is seawater pushed onto land by the storm’s winds and low pressure. The Ayeyarwady Delta is very low and flat, so the water can travel a long way inland.",
        replies: [
          { id: "r-sample-1", body: "And it can arrive quickly, so there is very little time to move once you can see the water. That is why you leave before it comes.", authorId: "u-min", created: ago(5, 20) },
        ] },
      { id: "p-sample-gobag", title: "What’s in our family go-bag", topic: "Safety tips", authorId: "u-thiri", created: ago(3, 6), pinned: false,
        body: "Water, dry food, a torch with spare batteries, a radio, medicine, copies of ID papers in a plastic bag, phone chargers and some cash.\n\nWe check it at the start of April and October, before each cyclone season.",
        replies: [] },
      { id: "p-sample-season", title: "Why do our cyclones come in April–May and October–November?", topic: "Question", authorId: "u-min", created: ago(1, 4), pinned: false,
        body: "Why not in the middle of the monsoon, when there is the most rain?",
        replies: [
          { id: "r-sample-2", body: "Good question! Storms need a warm sea and calm winds high up. In the middle of the monsoon the winds high up are strong and tear young storms apart, so the main seasons are just before and just after it.", authorId: "u-zayar", created: ago(0, 20) },
        ] },
    ];
  }

  function loadEvents() {
    const saved = cleanList(readJSON(local, KEYS.events), cleanEvent);
    return saved || sampleEvents();
  }
  function loadPosts() {
    const saved = cleanList(readJSON(local, KEYS.posts), cleanPost);
    return saved || samplePosts();
  }
  const saveEvents = (events) => writeJSON(local, KEYS.events, events);
  const savePosts = (posts) => writeJSON(local, KEYS.posts, posts);

  // ==========================================================================
  // 5. Small helpers for building the page
  // ==========================================================================

  // Interface sounds from sound.js, with the same meanings as on the other pages. Anything
  // that loads another page (logging in, registering) stays silent, as links do.
  const sound = (name, arg) => { if (window.Sound) window.Sound.play(name, arg); };

  // Builds an element. Text always goes in as text (never as HTML), so nothing a
  // visitor types can add links, scripts or styles to the page.
  function el(tag, props, children) {
    const element = document.createElement(tag);
    Object.entries(props || {}).forEach(([name, value]) => {
      if (value === undefined || value === null || value === false) return;
      if (name === "className") element.className = value;
      else if (name === "text") element.textContent = value;
      else if (name.startsWith("data-") || name.startsWith("aria-") || ["type", "for", "href", "id", "role", "tabindex", "title"].includes(name)) element.setAttribute(name, value === true ? "" : value);
      else element[name] = value;
    });
    (children || []).forEach((child) => { if (child) element.append(child); });
    return element;
  }

  // --- Avatars ----------------------------------------------------------------
  // Each member's round picture is one storm or preparedness glyph on a coloured circle.
  // The colours are the site's own, fixed so a picture looks the same in either theme.
  // The evacuate red is left out on purpose: on this site red means "leave now", and a
  // person's picture should never read as a warning.
  const AVATAR_COLOURS = {
    sea: { label: "sea blue", bg: "#17697a", fg: "#fbe8c0" },
    teal: { label: "teal", bg: "#2596a8", fg: "#f3f7f6" },
    amber: { label: "amber", bg: "#e8a317", fg: "#10303f" },
    midnight: { label: "midnight", bg: "#10303f", fg: "#e8a317" },
    shallows: { label: "pale blue", bg: "#d9eeee", fg: "#17697a" },
    sand: { label: "sand", bg: "#fbe8c0", fg: "#17697a" },
    coral: { label: "pale coral", bg: "#fbdcd8", fg: "#10303f" },
    navy: { label: "navy", bg: "#10303f", fg: "#d9eeee" },
  };

  // Two drawing styles. "pixels" is a 7 by 7 grid of chunky squares; "lines" is a list of
  // SVG shapes drawn with a thick round stroke, and shapes marked solid are filled instead.
  const AVATAR_GLYPHS = {
    shelter: { label: "Shelter", pixels: ["...#...", "..###..", ".#####.", "#######", ".##.##.", ".##.##.", ".##.##."] },
    lightning: { label: "Lightning", pixels: ["....##.", "...##..", "..##...", ".#####.", "...##..", "..##...", ".##...."] },
    firstaid: { label: "First aid", pixels: ["..###..", "..###..", "#######", "#######", "#######", "..###..", "..###.."] },
    eye: { label: "Storm eye", pixels: ["..###..", ".#####.", "##...##", "##...##", "##...##", ".#####.", "..###.."] },
    flag: { label: "Warning flag", pixels: ["######.", "##..##.", "##..##.", "######.", "#......", "#......", "#......"] },
    // The tropical cyclone symbol as drawn for the northern hemisphere, this site's region.
    cyclone: { label: "Cyclone", lines: [["circle", { cx: 50, cy: 50, r: 9 }], ["path", { d: "M50 41Q50 25 70 24M50 59Q50 75 30 76" }]] },
    wind: { label: "Wind", lines: [["path", { d: "M26 40H58a8 8 0 1 0-8-8M26 52H70M26 64H54a8 8 0 1 1-8 8" }]] },
    waves: { label: "Waves", lines: [["path", { d: "M26 43q6-8 12 0t12 0t12 0t12 0M26 59q6-8 12 0t12 0t12 0t12 0" }]] },
    track: { label: "Storm track", lines: [["path", { d: "M30 70L39 57L50 49L61 42L71 32" }],
      ["circle", { cx: 30, cy: 70, r: 5, solid: true }], ["circle", { cx: 39, cy: 57, r: 5, solid: true }], ["circle", { cx: 50, cy: 49, r: 5, solid: true }],
      ["circle", { cx: 61, cy: 42, r: 5, solid: true }], ["circle", { cx: 71, cy: 32, r: 8, solid: true }]] },
    rain: { label: "Rain", lines: [["path", { d: "M34 28l-5 10M52 28l-5 10M70 28l-5 10M43 46l-5 10M61 46l-5 10M34 64l-5 10M52 64l-5 10M70 64l-5 10" }]] },
    raindrop: { label: "Raindrop", lines: [["path", { d: "M50 23C44 34 32 46 32 58a18 18 0 0 0 36 0C68 46 56 34 50 23z", solid: true }]] },
    allclear: { label: "All clear", lines: [["circle", { cx: 50, cy: 50, r: 10 }], ["path", { d: "M50 26v6M50 68v6M26 50h6M68 50h6M33 33l4 4M63 63l4 4M33 67l4-4M63 37l4-4" }]] },
  };
  const GLYPH_NAMES = Object.keys(AVATAR_GLYPHS);
  const COLOUR_NAMES = Object.keys(AVATAR_COLOURS);
  const ALL_AVATARS = GLYPH_NAMES.flatMap((glyph) => COLOUR_NAMES.map((colour) => ({ glyph, colour })));

  const cleanAvatar = (raw) =>
    isObject(raw) && Object.hasOwn(AVATAR_GLYPHS, raw.glyph) && Object.hasOwn(AVATAR_COLOURS, raw.colour) ? { glyph: raw.glyph, colour: raw.colour } : null;
  const sameAvatar = (a, b) => a.glyph === b.glyph && a.colour === b.colour;
  const avatarLabel = (avatar) => AVATAR_GLYPHS[avatar.glyph].label + " on " + AVATAR_COLOURS[avatar.colour].label;

  // Someone who has not chosen a picture still gets one, worked out from their id, so it
  // stays the same on every page and every visit.
  function avatarFor(user) {
    const chosen = user && cleanAvatar(user.avatar);
    if (chosen) return chosen;
    let hash = 2166136261; // FNV-1a
    for (const ch of String(user ? user.id : "")) hash = Math.imul(hash ^ ch.codePointAt(0), 16777619);
    return ALL_AVATARS[(hash >>> 0) % ALL_AVATARS.length];
  }

  // Draws the picture as SVG. Built with createElementNS from the fixed lists above, so
  // nothing a visitor typed or saved ever becomes markup.
  function avatarSvg(avatar) {
    const { bg, fg } = AVATAR_COLOURS[avatar.colour];
    const glyph = AVATAR_GLYPHS[avatar.glyph];
    const make = (tag, attrs) => {
      const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
      Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
      return node;
    };
    const svg = make("svg", { viewBox: "0 0 100 100", "aria-hidden": "true", focusable: "false" });
    svg.append(make("circle", { cx: 50, cy: 50, r: 50, fill: bg }));
    if (glyph.pixels) {
      // One path of 7-unit squares, each a hair larger so no seam shows between them.
      let d = "";
      glyph.pixels.forEach((row, y) => Array.from(row).forEach((cell, x) => {
        if (cell === "#") d += "M" + (25.45 + x * 7) + " " + (25.45 + y * 7) + "h7.1v7.1h-7.1z";
      }));
      svg.append(make("path", { d, fill: fg }));
    } else {
      glyph.lines.forEach(([tag, { solid, ...attrs }]) => {
        svg.append(make(tag, Object.assign(attrs, solid
          ? { fill: fg }
          : { fill: "none", stroke: fg, "stroke-width": 6.5, "stroke-linecap": "round", "stroke-linejoin": "round" })));
      });
    }
    return svg;
  }

  // Splits typed text into paragraphs at blank lines.
  function paragraphs(text) {
    return text.split(/\n\s*\n/).map((part) => el("p", { text: part.trim() })).filter((p) => p.textContent);
  }

  const DATE_LONG = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const DATE_SHORT = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

  function timeAgo(time) {
    const minutes = Math.round((Date.now() - time) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return minutes + (minutes === 1 ? " minute ago" : " minutes ago");
    const hours = Math.round(minutes / 60);
    if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
    const days = Math.round(hours / 24);
    if (days < 30) return days + (days === 1 ? " day ago" : " days ago");
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(time));
  }

  function authorName(users, id) {
    const user = users.find((item) => item.id === id);
    return user ? user.name : "Former member";
  }

  // The author's picture beside their name. A former member's posts show none.
  function authorAvatar(users, id) {
    const user = users.find((item) => item.id === id);
    return user ? el("span", { className: "author-avatar", "aria-hidden": "true" }, [avatarSvg(avatarFor(user))]) : null;
  }

  function roleBadge(users, id) {
    const user = users.find((item) => item.id === id);
    return user && user.role === "admin" ? el("span", { className: "role-badge", text: "Admin" }) : null;
  }

  // Shows or clears a field's error message and marks the field for screen readers.
  function setFieldError(input, message) {
    const error = document.getElementById(input.id + "-error");
    if (error) {
      error.textContent = message || "";
      error.hidden = !message;
    }
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function showFormError(box, message) {
    if (!box) return;
    box.textContent = message || "";
    box.hidden = !message;
  }

  // ==========================================================================
  // 6. Header: the account link on every page
  // ==========================================================================

  function updateAccountLink() {
    const link = document.getElementById("account-link");
    if (!link) return;
    const user = currentUser();
    const label = link.querySelector(".account-label");
    const avatar = link.querySelector(".account-avatar");
    link.classList.toggle("is-signed-in", !!user);
    if (label) label.textContent = user ? user.name : "Log in";
    if (avatar) avatar.replaceChildren(...(user ? [avatarSvg(avatarFor(user))] : []));
    // On some widths only the avatar shows, so the tooltip names who is logged in.
    if (user) link.setAttribute("title", "Logged in as " + user.name + " (" + (isAdmin(user) ? "admin" : "member") + ")");
    else link.removeAttribute("title");
  }

  // ==========================================================================
  // 7. Account page: log in and register
  // ==========================================================================

  function setUpAccountPage() {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    if (!loginForm || !registerForm) return;

    const formsArea = document.getElementById("account-forms");
    const signedInCard = document.getElementById("signed-in-card");
    const storageNote = document.getElementById("account-storage-note");
    const loginError = document.getElementById("login-error");
    const registerError = document.getElementById("register-error");

    setUpPasswordToggles();

    if (!local) {
      storageNote.hidden = false;
      document.querySelectorAll("#account-forms button[type='submit']").forEach((button) => { button.disabled = true; });
    }

    function showState() {
      const user = currentUser();
      formsArea.hidden = !!user;
      signedInCard.hidden = !user;
      if (user) {
        document.getElementById("signed-in-name").textContent = user.name;
        document.getElementById("signed-in-role").textContent = isAdmin(user) ? "an admin" : "a member";
        document.getElementById("signed-in-username").textContent = "@" + user.username;
        document.getElementById("signed-in-avatar").replaceChildren(avatarSvg(avatarFor(user)));
      }
      updateAccountLink();
    }

    setUpAvatarPicker(showState);

    // Logging in or out in another tab, or coming back to this page from the browser's
    // back/forward cache, can change who is logged in.
    window.addEventListener("storage", (event) => {
      if (!event.key || event.key === KEYS.session || event.key === KEYS.users) showState();
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) showState();
    });

    document.getElementById("log-out-button").addEventListener("click", () => {
      logOut();
      document.getElementById("avatar-status").textContent = "";
      showState();
      sound("pop");
      document.getElementById("login-id").focus();
    });

    // --- Log in --------------------------------------------------------------
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const idInput = document.getElementById("login-id");
      const passwordInput = document.getElementById("login-password");
      const id = idInput.value.trim().toLowerCase();
      const password = passwordInput.value;
      setFieldError(idInput, "");
      setFieldError(passwordInput, "");
      if (!id || !password) {
        const empty = !id ? idInput : passwordInput;
        setFieldError(empty, !id ? "Enter your username or email." : "Enter your password.");
        showFormError(loginError, "");
        empty.focus();
        sound("nudge");
        return;
      }
      const users = loadUsers();
      const user = users.find((item) => item.username === id || (item.email && item.email === id));
      // A group admin's account waits with no password until they register. Their names
      // are already on this page, so saying so gives nothing away.
      if (user && isUnclaimed(user) && groupAdminFor(user)) {
        showFormError(loginError, "This admin account has no password yet. Register with your school email to set one up.");
        passwordInput.value = "";
        sound("nudge");
        return;
      }
      // The same message for a wrong name or a wrong password, so the form does not
      // tell a stranger which usernames exist.
      if (!user || !user.hash || hashPassword(password, user.salt) !== user.hash) {
        showFormError(loginError, "That username and password do not match. Check them and try again.");
        passwordInput.value = "";
        passwordInput.focus();
        sound("nudge");
        return;
      }
      if (!logIn(user, document.getElementById("login-remember").checked)) {
        showFormError(loginError, "Your browser is blocking storage, so you cannot stay logged in on this site.");
        sound("nudge");
        return;
      }
      showFormError(loginError, "");
      loginForm.reset();
      goToCommunity();
    });

    // --- Register ------------------------------------------------------------
    const fields = {
      name: document.getElementById("register-name"),
      username: document.getElementById("register-username"),
      email: document.getElementById("register-email"),
      password: document.getElementById("register-password"),
      confirm: document.getElementById("register-confirm"),
      agree: document.getElementById("register-agree"),
    };
    const strength = document.getElementById("password-strength");

    // A group member registering with their school email takes over their waiting
    // admin account (and keeps its posts) instead of making a new member account.
    function claimFor(users) {
      const email = fields.email.value.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(email)) return null;
      const fingerprint = sha256(email);
      const admin = GROUP_ADMINS.find((item) => item.emailHash === fingerprint);
      const user = admin && users.find((item) => item.id === admin.id);
      return user && isUnclaimed(user) ? user : null;
    }

    // Returns the message for one field, or "" when it is fine.
    function problemWith(name, users) {
      const value = fields[name].type === "checkbox" ? fields[name].checked : fields[name].value.trim();
      switch (name) {
        case "name":
          if (!value) return "Enter the name other members will see.";
          if (value.length > LIMITS.name) return "Use " + LIMITS.name + " characters or fewer.";
          return "";
        case "username":
          if (!value) return "Choose a username.";
          if (!USERNAME_PATTERN.test(value.toLowerCase())) return "Use 3 to 20 letters, numbers or underscores, with no spaces.";
          if (users.some((user) => user.username === value.toLowerCase() && user !== claimFor(users))) return "That username is taken. Try another.";
          return "";
        case "email":
          if (!value) return "Enter your email address.";
          if (!EMAIL_PATTERN.test(value) || value.length > LIMITS.email) return "Enter an email address like name@example.com.";
          if (users.some((user) => user.email && user.email === value.toLowerCase())) return "An account already uses that email. Try logging in.";
          return "";
        case "password":
          if (!fields.password.value) return "Choose a password.";
          if (fields.password.value.length < 8) return "Use at least 8 characters.";
          if (!/[a-z]/i.test(fields.password.value) || !/\d/.test(fields.password.value)) return "Use at least one letter and one number.";
          return "";
        case "confirm":
          if (!fields.confirm.value) return "Type your password again.";
          if (fields.confirm.value !== fields.password.value) return "The passwords do not match.";
          return "";
        case "agree":
          return value ? "" : "Tick the box to agree to the community rules.";
        default:
          return "";
      }
    }

    // Like the calculator: a field is only checked once the visitor has left it, so
    // nobody sees an error while still typing.
    const touched = new Set();
    Object.entries(fields).forEach(([name, input]) => {
      input.addEventListener(input.type === "checkbox" ? "change" : "blur", () => {
        if (input.type !== "checkbox" && !input.value) return;
        touched.add(name);
        setFieldError(input, problemWith(name, loadUsers()));
      });
      input.addEventListener("input", () => {
        if (touched.has(name)) setFieldError(input, problemWith(name, loadUsers()));
        if (name === "password" && touched.has("confirm")) setFieldError(fields.confirm, problemWith("confirm", loadUsers()));
        // A group email frees up the group admin's username, so check it again.
        if (name === "email" && touched.has("username")) setFieldError(fields.username, problemWith("username", loadUsers()));
      });
    });

    fields.password.addEventListener("input", () => {
      const value = fields.password.value;
      let score = 0;
      if (value.length >= 8) score += 1;
      if (value.length >= 12) score += 1;
      if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
      if (/\d/.test(value)) score += 1;
      if (/[^a-z0-9]/i.test(value)) score += 1;
      const level = !value ? "" : score <= 2 ? "weak" : score <= 3 ? "okay" : "strong";
      strength.dataset.level = level;
      strength.querySelector(".strength-word").textContent = level ? { weak: "Weak", okay: "Okay", strong: "Strong" }[level] : "";
      strength.hidden = !value;
    });

    registerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const users = loadUsers();
      let first = null;
      Object.keys(fields).forEach((name) => {
        touched.add(name);
        const message = problemWith(name, users);
        setFieldError(fields[name], message);
        if (message && !first) first = fields[name];
      });
      if (first) {
        showFormError(registerError, "Please fix the boxes marked above.");
        first.focus();
        sound("nudge");
        return;
      }
      const salt = newId("s").replace(/[^0-9a-f]/g, "").slice(-16).padStart(16, "0");
      const details = {
        name: fields.name.value.trim(),
        username: fields.username.value.trim().toLowerCase(),
        email: fields.email.value.trim().toLowerCase(),
        salt,
        hash: hashPassword(fields.password.value, salt),
        joined: Date.now(),
      };
      const claimed = claimFor(users);
      const user = claimed ? Object.assign(claimed, details, { role: "admin" }) : Object.assign({ id: newId("u"), role: "member" }, details);
      if (!claimed) users.push(user);
      if (!saveUsers(users)) {
        showFormError(registerError, "Your browser is blocking storage, so the account could not be saved.");
        sound("nudge");
        return;
      }
      if (!logIn(user, document.getElementById("register-remember").checked)) {
        showFormError(registerError, "Your account is saved, but your browser is blocking storage, so you could not be logged in. Try the Log in form.");
        sound("nudge");
        return;
      }
      showFormError(registerError, "");
      registerForm.reset();
      goToCommunity();
    });

    showState();
  }

  // "Change avatar": a honeycomb of pictures in a dialog, the current one in the middle.
  // It is a group of radio buttons, so arrow keys move between pictures and screen readers
  // hear each one's name ("Cyclone on amber").
  function setUpAvatarPicker(showState) {
    const dialog = document.getElementById("avatar-dialog");
    const field = document.getElementById("avatar-field");
    const form = document.getElementById("avatar-form");
    const openButton = document.getElementById("change-avatar-button");
    const status = document.getElementById("avatar-status");
    // Very old browsers have no <dialog>; they keep the default picture.
    if (typeof dialog.showModal !== "function") {
      openButton.hidden = true;
      return;
    }

    // Nine across at most; a phone gets a smaller honeycomb so each picture stays big
    // enough to tap.
    const WIDE = [5, 8, 9, 8, 5];
    const NARROW = [3, 4, 5, 4, 3];

    function shuffled(list) {
      const copy = list.slice();
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    }

    function chosen() {
      const input = field.querySelector("input:checked");
      const [glyph, colour] = input ? input.value.split(":") : [];
      return cleanAvatar({ glyph, colour });
    }

    // Lays out a fresh random mix around `keep`, which sits checked in the centre.
    function fill(keep) {
      goalX = null;
      const rows = field.clientWidth < 420 ? NARROW : WIDE;
      const middle = Math.floor(rows.length / 2);
      const others = shuffled(ALL_AVATARS.filter((avatar) => !sameAvatar(avatar, keep)));
      field.querySelectorAll(".avatar-row").forEach((row) => row.remove());
      field.style.setProperty("--per-row", Math.max(...rows));
      rows.forEach((count, r) => {
        const row = el("div", { className: "avatar-row" });
        for (let i = 0; i < count; i += 1) {
          const centre = r === middle && i === (count - 1) / 2;
          const avatar = centre ? keep : others.pop();
          // Biggest in the middle, smaller and fainter towards the edges.
          const distance = Math.hypot(i - (count - 1) / 2, (r - middle) * 1.3);
          const option = el("label", { className: "avatar-option" + (distance > 2.6 ? " is-far" : ""), title: avatarLabel(avatar) }, [
            el("input", { type: "radio", name: "avatar", className: "visually-hidden", value: avatar.glyph + ":" + avatar.colour, checked: centre }),
            avatarSvg(avatar),
            el("span", { className: "visually-hidden", text: avatarLabel(avatar) }),
          ]);
          option.style.setProperty("--scale", Math.max(0.55, 1 - distance * 0.1).toFixed(2));
          row.append(option);
        }
        field.append(row);
      });
    }

    openButton.addEventListener("click", () => {
      const user = currentUser();
      if (!user) return;
      status.textContent = "";
      dialog.showModal(); // first, so the honeycomb can measure the space it has
      fill(avatarFor(user));
      field.querySelector("input:checked").focus();
      sound("push");
    });

    field.addEventListener("change", () => sound("select"));

    // Radio buttons only know page order, so on their own Up and Down step sideways
    // along a row like Left and Right. In the honeycomb they go to the nearest picture in
    // the row above or below instead, and stop at the top and bottom rows. Rows sit half a
    // picture apart, so a run of Up and Down presses aims at the column it started from,
    // the way a text cursor does; otherwise down-then-up would drift sideways.
    let goalX = null;
    field.addEventListener("pointerdown", () => { goalX = null; });
    field.addEventListener("keydown", (event) => {
      if ((event.key !== "ArrowUp" && event.key !== "ArrowDown") || event.altKey || event.ctrlKey || event.metaKey) {
        goalX = null;
        return;
      }
      const current = event.target.closest(".avatar-option");
      if (!current) return;
      event.preventDefault();
      const row = current.parentElement;
      const next = event.key === "ArrowUp" ? row.previousElementSibling : row.nextElementSibling;
      if (!next || !next.classList.contains("avatar-row")) return;
      const middle = (box) => box.left + box.width / 2;
      if (goalX === null) goalX = middle(current.getBoundingClientRect());
      const x = goalX;
      let nearest = null;
      let best = Infinity;
      next.querySelectorAll(".avatar-option").forEach((option) => {
        const gap = Math.abs(middle(option.getBoundingClientRect()) - x);
        if (gap < best) { best = gap; nearest = option; }
      });
      const input = nearest.querySelector("input");
      input.focus();
      input.click(); // checks it and fires "change", as the arrow keys do
    });

    document.getElementById("avatar-shuffle").addEventListener("click", () => {
      fill(chosen());
      sound("push");
    });

    document.getElementById("avatar-cancel").addEventListener("click", () => {
      dialog.close();
      sound("pop");
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const users = loadUsers();
      const user = currentUser(users);
      const avatar = chosen();
      dialog.close();
      if (!user || !avatar) {
        showState();
        return;
      }
      user.avatar = avatar;
      if (!saveUsers(users)) {
        status.textContent = "Your browser is blocking storage, so your avatar could not be saved.";
        sound("nudge");
        return;
      }
      showState();
      status.textContent = "Avatar saved: " + avatarLabel(avatar) + ".";
      sound("success");
    });
  }

  function setUpPasswordToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach((button) => {
      const input = document.getElementById(button.getAttribute("aria-controls"));
      button.hidden = false;
      button.addEventListener("click", () => {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.querySelector(".toggle-word").textContent = show ? "Hide" : "Show";
        sound("toggle", show ? "up" : "down");
      });
    });
  }

  function goToCommunity() {
    window.location.href = "community.html?welcome";
  }

  // ==========================================================================
  // 8. Community page
  // ==========================================================================

  function setUpCommunityPage() {
    const app = document.getElementById("calendar-app");
    const board = document.getElementById("board-app");
    if (!app || !board) return;

    document.querySelectorAll(".community-nojs").forEach((note) => { note.hidden = true; });
    app.hidden = false;
    board.hidden = false;

    const state = {
      users: loadUsers(),
      events: loadEvents(),
      posts: loadPosts(),
      user: null,
      month: null,       // first day of the month shown
      selected: null,    // ISO date of the chosen day
      topic: "all",
    };
    state.user = currentUser(state.users);
    const start = today();
    state.month = new Date(start.getFullYear(), start.getMonth(), 1);
    state.selected = toISO(start);

    const status = document.getElementById("community-status");
    const announce = (message) => { status.textContent = ""; window.setTimeout(() => { status.textContent = message; }, 30); };
    const storageFailed = () => announce("Your browser is blocking storage, so this change will be lost when you leave the page.");

    // Who can see a meet-up: approved ones are for everyone; one waiting for an admin
    // shows only to the person who suggested it and to admins.
    const canSee = (event) => event.status === "approved" || isAdmin(state.user) || (state.user && event.authorId === state.user.id);
    const canDelete = (item) => !!state.user && (isAdmin(state.user) || item.authorId === state.user.id);

    function persist(kind) {
      const ok = kind === "events" ? saveEvents(state.events) : kind === "posts" ? savePosts(state.posts) : saveUsers(state.users);
      if (!ok) storageFailed();
    }

    // --- Keeping keyboard focus ---------------------------------------------------
    // Drawing a list again replaces its buttons, which would drop keyboard focus onto the
    // page itself and leave keyboard and screen-reader users lost. So before drawing,
    // note the focused control (its data-focus name), the list it sits in and its card;
    // afterwards focus the same control again or, if it has gone, the first button of the
    // same card, or of the card that took its place, or else the list's heading.
    const FOCUS_LISTS = {
      "community-session": "#community-session a",
      "calendar-body": null,
      "day-events": "#day-title",
      "upcoming-events": "#upcoming-title",
      "pending-events": "#pending-title",
      "member-rows": null,
      "post-list": "#board-title",
    };
    Object.keys(FOCUS_LISTS).forEach((id) => { document.getElementById(id).dataset.focusScope = ""; });

    const ownItems = (scope) => Array.from(scope.querySelectorAll("[data-focus-item]")).filter((item) => item.parentElement.closest("[data-focus-scope]") === scope);
    const withAttr = (scope, name, value) => (value ? Array.from(scope.querySelectorAll("[" + name + "]")).find((item) => item.getAttribute(name) === value) : null);
    const firstControl = (item) => item.querySelector(".event-actions button, .post-actions button") || item.querySelector("button, a[href], summary, textarea");

    function noteFocus() {
      const active = document.activeElement;
      const scope = active && active !== document.body ? active.closest("[data-focus-scope]") : null;
      if (!scope || !scope.id) return null;
      const item = active.closest("[data-focus-item]");
      const own = item && item.parentElement.closest("[data-focus-scope]") === scope ? item : null;
      return {
        scope: scope.id,
        name: active.dataset.focus || "",
        item: own ? own.dataset.focusItem : "",
        index: own ? ownItems(scope).indexOf(own) : -1,
        selection: typeof active.selectionStart === "number" ? [active.selectionStart, active.selectionEnd] : null,
      };
    }

    function putFocusBack(note, fallback) {
      if (!note || (document.activeElement && document.activeElement !== document.body)) return;
      const scope = document.getElementById(note.scope);
      let target = scope && withAttr(scope, "data-focus", note.name);
      if (target) {
        target.focus();
        if (note.selection && typeof target.setSelectionRange === "function") target.setSelectionRange(note.selection[0], note.selection[1]);
        return;
      }
      if (scope) {
        const items = ownItems(scope);
        const item = withAttr(scope, "data-focus-item", note.item) || items[Math.min(note.index, items.length - 1)];
        target = item && firstControl(item);
      }
      target = target || (fallback && fallback()) || (FOCUS_LISTS[note.scope] && document.querySelector(FOCUS_LISTS[note.scope]));
      if (target) target.focus();
    }

    function redraw(draw, fallback) {
      const note = noteFocus();
      draw();
      putFocusBack(note, fallback);
    }

    // --- Who is here ----------------------------------------------------------
    function renderSession() {
      const box = document.getElementById("community-session");
      box.replaceChildren();
      if (state.user) {
        box.append(
          el("span", { className: "account-avatar", "aria-hidden": "true" }, [avatarSvg(avatarFor(state.user))]),
          el("span", {}, [
            document.createTextNode("Logged in as "),
            el("strong", { text: state.user.name }),
            isAdmin(state.user) ? el("span", { className: "role-badge", text: "Admin" }) : null,
          ]),
          el("button", { type: "button", className: "text-button", id: "community-log-out", "data-focus": "log-out", text: "Log out", onclick: () => {
            logOut();
            reload(false);
            renderAll(); // focus moves to the new "Log in" link
            sound("pop");
            announce("You have logged out.");
          } })
        );
      } else {
        box.append(
          el("span", {}, [
            document.createTextNode("You are reading as a guest. "),
            el("a", { href: "account.html#log-in", text: "Log in" }),
            document.createTextNode(" or "),
            el("a", { href: "account.html#register", text: "register" }),
            document.createTextNode(" to post, reply and suggest meet-ups."),
          ]),
        );
      }
    }

    // Reads who is logged in (and, with everything, the meet-ups and posts) from storage
    // again. Half-written replies belong to the person who wrote them, so they are
    // dropped when someone else logs in.
    function reload(everything) {
      const before = state.user ? state.user.id : null;
      state.users = loadUsers();
      if (everything) {
        state.events = loadEvents();
        state.posts = loadPosts();
      }
      state.user = currentUser(state.users);
      if ((state.user ? state.user.id : null) !== before) replyDrafts.clear();
      updateAccountLink();
    }

    // --- Calendar -------------------------------------------------------------
    const calendarBody = document.getElementById("calendar-body");
    const monthTitle = document.getElementById("calendar-month");

    function eventsOn(iso) {
      return state.events.filter((event) => event.date === iso && canSee(event)).sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
    }

    function renderCalendar(focusSelected) {
      const month = state.month;
      // The heading is a live region: only change it when the month changes, or screen
      // readers would say the same month again after every click.
      const monthLabel = MONTH_YEAR.format(month);
      if (monthTitle.textContent !== monthLabel) monthTitle.textContent = monthLabel;
      // Weeks start on Monday. getDay() counts from Sunday, so shift it by one.
      const offset = (month.getDay() + 6) % 7;
      const first = new Date(month.getFullYear(), month.getMonth(), 1 - offset);
      const todayISO = toISO(today());
      // Keep the chosen day inside the month on screen.
      if (fromISO(state.selected).getMonth() !== month.getMonth() || fromISO(state.selected).getFullYear() !== month.getFullYear()) {
        state.selected = toISO(month.getFullYear() === today().getFullYear() && month.getMonth() === today().getMonth() ? today() : month);
      }

      const rows = [];
      for (let week = 0; week < 6; week += 1) {
        const cells = [];
        for (let day = 0; day < 7; day += 1) {
          const date = new Date(first.getFullYear(), first.getMonth(), first.getDate() + week * 7 + day);
          const iso = toISO(date);
          const inMonth = date.getMonth() === month.getMonth();
          if (!inMonth) {
            cells.push(el("td", { className: "calendar-cell is-outside" }, [el("span", { className: "calendar-outside-date", "aria-hidden": "true", text: String(date.getDate()) })]));
            continue;
          }
          const dayEvents = eventsOn(iso);
          const label = DATE_LONG.format(date) + (dayEvents.length ? ", " + dayEvents.length + (dayEvents.length === 1 ? " meet-up" : " meet-ups") : "") + (iso === todayISO ? ", today" : "");
          const dots = dayEvents.slice(0, 3).map((event) => el("span", { className: "calendar-dot" + (event.status === "pending" ? " is-pending" : "") }));
          const button = el("button", {
            type: "button",
            className: "calendar-day" + (iso === todayISO ? " is-today" : "") + (dayEvents.length ? " has-events" : "") + (iso < todayISO ? " is-past" : ""),
            "data-date": iso,
            "data-focus": "day:" + iso,
            "aria-label": label,
            "aria-pressed": String(iso === state.selected),
            tabindex: iso === state.selected ? "0" : "-1",
          }, [
            el("span", { className: "calendar-number", text: String(date.getDate()), "aria-hidden": "true" }),
            dots.length ? el("span", { className: "calendar-dots", "aria-hidden": "true" }, dots) : null,
            dayEvents.length ? el("span", { className: "calendar-chip", "aria-hidden": "true", text: dayEvents[0].title }) : null,
          ]);
          cells.push(el("td", { className: "calendar-cell" }, [button]));
        }
        // Stop at a row that lies wholly in the next month. Most months need five or six
        // rows, but a 28-day February that starts on a Monday fills exactly four.
        if (cells.every((cell) => cell.classList.contains("is-outside"))) break;
        rows.push(el("tr", {}, cells));
      }
      calendarBody.replaceChildren(...rows);
      if (focusSelected) {
        const target = calendarBody.querySelector('[data-date="' + state.selected + '"]');
        if (target) target.focus();
      }
    }

    function selectDay(iso, focus) {
      if (iso !== state.selected) sound("select");
      state.selected = iso;
      const date = fromISO(iso);
      if (date.getMonth() !== state.month.getMonth() || date.getFullYear() !== state.month.getFullYear()) {
        state.month = new Date(date.getFullYear(), date.getMonth(), 1);
      }
      renderCalendar(focus);
      renderDay();
    }

    function moveMonth(step) {
      sound(step > 0 ? "push" : "pop");
      state.month = new Date(state.month.getFullYear(), state.month.getMonth() + step, 1);
      const sameMonthAsToday = state.month.getFullYear() === today().getFullYear() && state.month.getMonth() === today().getMonth();
      state.selected = toISO(sameMonthAsToday ? today() : state.month);
      renderCalendar(false);
      renderDay();
    }

    document.getElementById("calendar-prev").addEventListener("click", () => moveMonth(-1));
    document.getElementById("calendar-next").addEventListener("click", () => moveMonth(1));
    document.getElementById("calendar-today").addEventListener("click", () => selectDay(toISO(today()), true));

    // Drawing the month replaces the buttons, so the chosen day takes focus again: without
    // that, Enter or Space on a day (which also clicks it) would drop keyboard focus.
    calendarBody.addEventListener("click", (event) => {
      const button = event.target.closest(".calendar-day");
      if (button) selectDay(button.dataset.date, true);
    });

    // Arrow keys move a day or a week, Home and End go to the start or end of the week,
    // and Page Up / Page Down change the month, as in most date pickers.
    calendarBody.addEventListener("keydown", (event) => {
      const button = event.target.closest(".calendar-day");
      if (!button) return;
      const date = fromISO(button.dataset.date);
      const weekday = (date.getDay() + 6) % 7;
      const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday };
      if (event.key in moves) date.setDate(date.getDate() + moves[event.key]);
      else if (event.key === "PageUp" || event.key === "PageDown") {
        const day = date.getDate();
        date.setDate(1);
        date.setMonth(date.getMonth() + (event.key === "PageUp" ? -1 : 1));
        date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
      } else return;
      event.preventDefault();
      selectDay(toISO(date), true);
    });

    // --- The chosen day ---------------------------------------------------------
    const dayTitle = document.getElementById("day-title");
    const dayEvents = document.getElementById("day-events");
    const dayEmpty = document.getElementById("day-empty");
    const eventForm = document.getElementById("event-form");
    const eventPrompt = document.getElementById("event-prompt");
    const eventError = document.getElementById("event-error");

    function eventCard(event, options) {
      const going = state.user && event.going.includes(state.user.id);
      const started = hasStarted(event);
      const pending = event.status === "pending";
      const actions = [];
      if (!pending && state.user && !started) {
        actions.push(el("button", {
          type: "button",
          className: "chip-button" + (going ? " is-on" : ""),
          "data-focus": "going:" + event.id,
          "aria-pressed": String(!!going),
          text: going ? "You’re going" : "I’m going",
          onclick: () => toggleGoing(event.id),
        }));
      }
      if (pending && isAdmin(state.user) && !started) {
        actions.push(el("button", { type: "button", className: "chip-button is-on", "data-focus": "approve:" + event.id, text: "Approve", onclick: () => approveEvent(event.id) }));
      }
      if (canDelete(event)) {
        // An admin declines someone else's suggestion, or removes one whose time has
        // passed before anyone approved it.
        const verb = pending && event.authorId !== state.user.id ? (started ? "Remove" : "Decline") : "Delete";
        actions.push(el("button", { type: "button", className: "text-button text-button--muted", "data-focus": "delete:" + event.id, text: verb, "aria-label": verb + " the meet-up “" + event.title + "”", onclick: () => deleteEvent(event.id, verb) }));
      }
      let note = "";
      if (pending && started) note = "Not approved before it was due to start, so it will not go on the calendar.";
      else if (pending) note = state.user && event.authorId === state.user.id
        ? "Waiting for an admin to approve it. Only you and the admins can see it."
        : "Waiting for approval. Only admins and the person who suggested it can see it.";
      const when = [options && options.withDate ? DATE_SHORT.format(fromISO(event.date)) : "", event.time, event.place].filter(Boolean).join(" · ");
      return el("li", { className: "event-card" + (pending ? " is-pending" : "") + (started ? " is-past" : ""), "data-focus-item": event.id }, [
        when ? el("p", { className: "event-when", text: when }) : null,
        el(options && options.heading ? options.heading : "h4", { className: "event-title", text: event.title }),
        note ? el("p", { className: "pending-note", text: note }) : null,
        event.details ? el("div", { className: "event-details" }, paragraphs(event.details)) : null,
        el("p", { className: "event-meta" }, [
          document.createTextNode("Suggested by " + authorName(state.users, event.authorId)),
          roleBadge(state.users, event.authorId),
          document.createTextNode(" · " + event.going.length + " going"),
        ]),
        actions.length ? el("div", { className: "event-actions" }, actions) : null,
      ]);
    }

    function renderDay() {
      const date = fromISO(state.selected);
      dayTitle.textContent = DATE_LONG.format(date);
      const list = eventsOn(state.selected);
      dayEvents.replaceChildren(...list.map((event) => eventCard(event)));
      dayEmpty.hidden = list.length > 0;

      const isPast = state.selected < toISO(today());
      eventForm.hidden = !state.user || isPast;
      eventPrompt.hidden = !eventForm.hidden;
      eventPrompt.replaceChildren();
      if (!state.user) {
        eventPrompt.append(el("a", { href: "account.html#log-in", text: "Log in" }), document.createTextNode(" to suggest a meet-up on this day."));
      } else if (isPast) {
        eventPrompt.textContent = "This day has passed. Pick today or a later day to suggest a meet-up.";
      }
      document.getElementById("event-form-title").textContent = isAdmin(state.user) ? "Add a meet-up on this day" : "Suggest a meet-up on this day";
      document.getElementById("event-form-note").textContent = isAdmin(state.user)
        ? "As an admin, your meet-up appears on the calendar straight away."
        : "An admin checks each suggestion before everyone can see it.";
    }

    eventForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!state.user) return;
      const title = document.getElementById("meetup-title");
      const time = document.getElementById("meetup-time");
      const place = document.getElementById("meetup-place");
      const details = document.getElementById("meetup-details");
      [title, time, place].forEach((input) => setFieldError(input, ""));
      let first = null;
      const fail = (input, message) => { setFieldError(input, message); first = first || input; };
      if (!title.value.trim()) fail(title, "Give the meet-up a name.");
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time.value)) fail(time, "Choose a start time.");
      else if (state.selected === toISO(today()) && time.value <= nowTime()) fail(time, "That time has already passed today. Choose a later time.");
      if (!place.value.trim()) fail(place, "Say where it will be.");
      if (first) {
        showFormError(eventError, "Please fix the boxes marked above.");
        first.focus();
        sound("nudge");
        return;
      }
      showFormError(eventError, "");
      const admin = isAdmin(state.user);
      state.events.push({
        id: newId("e"),
        title: title.value.trim().slice(0, LIMITS.title),
        date: state.selected,
        time: time.value,
        place: place.value.trim().slice(0, LIMITS.place),
        details: details.value.trim().slice(0, LIMITS.details),
        authorId: state.user.id,
        status: admin ? "approved" : "pending",
        going: [state.user.id],
      });
      persist("events");
      eventForm.reset();
      renderAll();
      sound("add");
      announce(admin ? "Meet-up added to the calendar." : "Thanks! An admin will check your meet-up before it shows for everyone.");
    });

    function toggleGoing(id) {
      const event = state.events.find((item) => item.id === id);
      if (!event || !state.user) return;
      const going = event.going.includes(state.user.id);
      event.going = going ? event.going.filter((userId) => userId !== state.user.id) : event.going.concat(state.user.id);
      persist("events");
      renderAll();
      sound("check", !going);
      announce(going ? "You are no longer going to " + event.title + "." : "You are going to " + event.title + ".");
    }

    function approveEvent(id) {
      const event = state.events.find((item) => item.id === id);
      if (!event || !isAdmin(state.user) || hasStarted(event)) return;
      event.status = "approved";
      persist("events");
      renderAll();
      sound("add");
      announce("“" + event.title + "” is now on the calendar for everyone.");
    }

    function deleteEvent(id, verb) {
      const event = state.events.find((item) => item.id === id);
      if (!event || !canDelete(event)) return;
      if (!window.confirm(verb + " the meet-up “" + event.title + "”? This cannot be undone.")) return;
      state.events = state.events.filter((item) => item.id !== id);
      persist("events");
      renderAll();
      sound("remove");
      announce({ Decline: "Meet-up declined and removed.", Remove: "Meet-up removed." }[verb] || "Meet-up deleted.");
    }

    // --- Coming up -----------------------------------------------------------------
    function renderUpcoming() {
      const list = document.getElementById("upcoming-events");
      const upcoming = state.events
        .filter((event) => !hasStarted(event) && canSee(event))
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .slice(0, 6);
      list.replaceChildren(...upcoming.map((event) => {
        const card = eventCard(event, { withDate: true });
        const title = card.querySelector(".event-title");
        const link = el("button", { type: "button", className: "event-jump", "data-focus": "jump:" + event.id, text: event.title, "aria-label": event.title + ": show " + DATE_LONG.format(fromISO(event.date)) + " on the calendar", onclick: () => {
          selectDay(event.date, true);
        } });
        title.replaceChildren(link);
        return card;
      }));
      document.getElementById("upcoming-empty").hidden = upcoming.length > 0;
    }

    // --- Knowledge board -------------------------------------------------------------
    const postForm = document.getElementById("post-form");
    const postPrompt = document.getElementById("post-prompt");
    const postError = document.getElementById("post-error");
    const postList = document.getElementById("post-list");
    const topicFilter = document.getElementById("topic-filter");
    const postTopic = document.getElementById("new-post-topic");

    topicFilter.addEventListener("change", (event) => {
      if (event.isTrusted) sound("select");
      state.topic = topicFilter.value;
      renderPosts();
    });

    function renderPostForm() {
      postForm.hidden = !state.user;
      postPrompt.hidden = !!state.user;
      // Only admins can post a notice.
      const notice = postTopic.querySelector('option[value="Notice"]');
      if (notice) {
        notice.disabled = !isAdmin(state.user);
        notice.hidden = !isAdmin(state.user);
        if (!isAdmin(state.user) && postTopic.value === "Notice") postTopic.value = "Science";
      }
    }

    postForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!state.user) return;
      const title = document.getElementById("new-post-title");
      const body = document.getElementById("new-post-body");
      [title, body].forEach((input) => setFieldError(input, ""));
      let first = null;
      const fail = (input, message) => { setFieldError(input, message); first = first || input; };
      if (!title.value.trim()) fail(title, "Give your post a title.");
      if (body.value.trim().length < 10) fail(body, "Write at least a sentence (10 characters or more).");
      if (first) {
        showFormError(postError, "Please fix the boxes marked above.");
        first.focus();
        sound("nudge");
        return;
      }
      showFormError(postError, "");
      const topic = TOPICS.includes(postTopic.value) && (postTopic.value !== "Notice" || isAdmin(state.user)) ? postTopic.value : "Question";
      const post = {
        id: newId("p"),
        title: title.value.trim().slice(0, LIMITS.title),
        body: body.value.trim().slice(0, LIMITS.body),
        topic,
        authorId: state.user.id,
        created: Date.now(),
        pinned: false,
        replies: [],
      };
      state.posts.push(post);
      persist("posts");
      postForm.reset();
      renderPostForm();
      if (state.topic !== "all" && state.topic !== topic) {
        state.topic = "all";
        topicFilter.value = "all";
      }
      renderPosts();
      sound("add");
      announce("Your post is on the board.");
      const added = document.getElementById("post-" + post.id);
      if (added) added.querySelector(".post-title").focus();
    });

    function sortedPosts() {
      return state.posts
        .filter((post) => state.topic === "all" || post.topic === state.topic)
        .sort((a, b) => (b.pinned - a.pinned) || (b.created - a.created));
    }

    function renderPosts() {
      const posts = sortedPosts();
      postList.replaceChildren(...posts.map(postCard));
      const empty = document.getElementById("post-empty");
      empty.hidden = posts.length > 0;
      document.getElementById("post-count").textContent = posts.length + (posts.length === 1 ? " post" : " posts") + (state.topic === "all" ? "" : " in " + state.topic);
    }

    function postCard(post) {
      const actions = [];
      if (isAdmin(state.user)) {
        actions.push(el("button", { type: "button", className: "text-button", "data-focus": "pin:" + post.id, text: post.pinned ? "Unpin" : "Pin to top", "aria-label": (post.pinned ? "Unpin “" : "Pin “") + post.title + "”", onclick: () => togglePin(post.id) }));
      }
      if (canDelete(post)) {
        actions.push(el("button", { type: "button", className: "text-button text-button--muted", "data-focus": "delete-post:" + post.id, text: "Delete", "aria-label": "Delete the post “" + post.title + "”", onclick: () => deletePost(post.id) }));
      }

      const replies = el("ol", { className: "reply-list", id: "replies-" + post.id, "data-focus-scope": true }, post.replies.slice().sort((a, b) => a.created - b.created).map((reply) => el("li", { className: "reply", "data-focus-item": reply.id }, [
        el("p", { className: "post-meta" }, [
          authorAvatar(state.users, reply.authorId),
          el("strong", { text: authorName(state.users, reply.authorId) }),
          roleBadge(state.users, reply.authorId),
          document.createTextNode(" · " + timeAgo(reply.created)),
        ]),
        el("div", { className: "post-body" }, paragraphs(reply.body)),
        canDelete(reply) ? el("button", { type: "button", className: "text-button text-button--muted", "data-focus": "delete-reply:" + reply.id, text: "Delete reply", "aria-label": "Delete this reply by " + authorName(state.users, reply.authorId), onclick: () => deleteReply(post.id, reply.id) }) : null,
      ])));

      let replyForm = null;
      if (state.user) {
        const fieldId = "reply-" + post.id;
        replyForm = el("form", { className: "reply-form", noValidate: true }, [
          el("div", { className: "form-field" }, [
            el("label", { for: fieldId, text: "Your reply" }),
            // Every post card is drawn again whenever anything on the page changes, so a
            // half-written reply is kept aside and put back each time.
            el("textarea", { id: fieldId, rows: 2, maxLength: LIMITS.reply, "aria-describedby": fieldId + "-error", "data-focus": "reply-field:" + post.id,
              value: replyDrafts.get(post.id) || "",
              oninput: (event) => {
                if (event.target.value.trim()) replyDrafts.set(post.id, event.target.value);
                else replyDrafts.delete(post.id);
              } }),
            el("p", { className: "field-error", id: fieldId + "-error", hidden: true }),
          ]),
          el("button", { type: "submit", className: "button button--small", "data-focus": "reply-send:" + post.id, text: "Reply" }),
        ]);
        replyForm.addEventListener("submit", (event) => {
          event.preventDefault();
          const input = replyForm.querySelector("textarea");
          if (!input.value.trim()) {
            setFieldError(input, "Write something before you reply.");
            input.focus();
            sound("nudge");
            return;
          }
          addReply(post.id, input.value);
        });
      }

      const count = post.replies.length;
      const details = el("details", { className: "post-replies", "data-post": post.id }, [
        el("summary", { "data-focus": "replies:" + post.id, text: count ? count + (count === 1 ? " reply" : " replies") : state.user ? "Reply" : "No replies yet" }),
        count ? replies : null,
        replyForm || (count ? null : el("p", { className: "empty-state" }, [el("a", { href: "account.html#log-in", text: "Log in" }), document.createTextNode(" to reply.")])),
      ]);
      if (openReplies.has(post.id)) details.open = true;
      details.addEventListener("toggle", () => {
        if (details.open) openReplies.add(post.id);
        else openReplies.delete(post.id);
      });

      return el("li", { className: "post-card" + (post.pinned ? " is-pinned" : ""), id: "post-" + post.id, "data-focus-item": post.id }, [
        el("article", { "aria-labelledby": "post-" + post.id + "-title" }, [
          el("p", { className: "post-tags" }, [
            el("span", { className: "topic-tag", "data-topic": post.topic.toLowerCase().replace(/\s+/g, "-"), text: post.topic }),
            post.pinned ? el("span", { className: "pin-tag", text: "Pinned" }) : null,
          ]),
          el("h3", { className: "post-title", id: "post-" + post.id + "-title", tabindex: "-1", "data-focus": "title:" + post.id, text: post.title }),
          el("p", { className: "post-meta" }, [
            authorAvatar(state.users, post.authorId),
            el("strong", { text: authorName(state.users, post.authorId) }),
            roleBadge(state.users, post.authorId),
            document.createTextNode(" · " + timeAgo(post.created)),
          ]),
          el("div", { className: "post-body" }, paragraphs(post.body)),
          actions.length ? el("div", { className: "post-actions" }, actions) : null,
          details,
        ]),
      ]);
    }
    const openReplies = new Set();
    const replyDrafts = new Map(); // post id -> the reply being written

    function addReply(postId, text) {
      const post = state.posts.find((item) => item.id === postId);
      if (!post || !state.user) return;
      post.replies.push({ id: newId("r"), body: text.trim().slice(0, LIMITS.reply), authorId: state.user.id, created: Date.now() });
      openReplies.add(postId);
      replyDrafts.delete(postId);
      persist("posts");
      renderPosts();
      sound("add");
      announce("Reply added.");
      const field = document.getElementById("reply-" + postId);
      if (field) field.focus();
    }

    function togglePin(postId) {
      const post = state.posts.find((item) => item.id === postId);
      if (!post || !isAdmin(state.user)) return;
      post.pinned = !post.pinned;
      persist("posts");
      renderPosts();
      sound("check", post.pinned);
      announce(post.pinned ? "Post pinned to the top." : "Post unpinned.");
      const card = document.getElementById("post-" + postId);
      if (card) card.querySelector(".post-title").focus();
    }

    function deletePost(postId) {
      const post = state.posts.find((item) => item.id === postId);
      if (!post || !canDelete(post)) return;
      if (!window.confirm("Delete the post “" + post.title + "” and its replies? This cannot be undone.")) return;
      state.posts = state.posts.filter((item) => item.id !== postId);
      replyDrafts.delete(postId);
      persist("posts");
      renderPosts();
      sound("remove");
      announce("Post deleted.");
      document.getElementById("board-title").focus();
    }

    function deleteReply(postId, replyId) {
      const post = state.posts.find((item) => item.id === postId);
      const reply = post && post.replies.find((item) => item.id === replyId);
      if (!reply || !canDelete(reply)) return;
      if (!window.confirm("Delete this reply? This cannot be undone.")) return;
      post.replies = post.replies.filter((item) => item.id !== replyId);
      persist("posts");
      // Focus moves to the next reply's button or, after the last one, to the reply box.
      redraw(renderPosts, () => document.getElementById("reply-" + postId) || document.querySelector("#post-" + postId + " summary"));
      sound("remove");
      announce("Reply deleted.");
    }

    // --- Admin tools -----------------------------------------------------------------
    function renderAdmin() {
      const section = document.getElementById("admin-tools");
      section.hidden = !isAdmin(state.user);
      if (section.hidden) return;

      // Suggestions that can still be approved come first; ones whose time has passed wait
      // at the end for an admin to remove them.
      const pending = state.events.filter((event) => event.status === "pending")
        .sort((a, b) => (hasStarted(a) - hasStarted(b)) || (a.date + a.time).localeCompare(b.date + b.time));
      document.getElementById("pending-events").replaceChildren(...pending.map((event) => eventCard(event, { withDate: true })));
      document.getElementById("pending-empty").hidden = pending.length > 0;

      document.getElementById("member-rows").replaceChildren(...state.users.map((user) => {
        const isSelf = user.id === state.user.id;
        const waiting = isUnclaimed(user) && !!groupAdminFor(user);
        // Admins cannot change their own role, so there is always at least one admin.
        const button = isSelf ? el("span", { className: "member-self", text: "You" }) : el("button", {
          type: "button",
          className: "text-button",
          "data-focus": "role:" + user.id,
          text: isAdmin(user) ? "Make member" : "Make admin",
          "aria-label": (isAdmin(user) ? "Make " + user.name + " a member" : "Make " + user.name + " an admin"),
          disabled: waiting,
          title: waiting ? "A group admin keeps the role until they register" : null,
          onclick: () => toggleRole(user.id),
        });
        return el("tr", { "data-focus-item": user.id }, [
          el("th", { scope: "row", text: user.name }),
          el("td", { text: "@" + user.username }),
          el("td", {}, [isAdmin(user) ? el("span", { className: "role-badge", text: "Admin" }) : document.createTextNode("Member")]),
          el("td", { text: isUnclaimed(user) && groupAdminFor(user) ? "Not registered yet" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(user.joined)) }),
          el("td", {}, [button]),
        ]);
      }));
    }

    function toggleRole(userId) {
      const user = state.users.find((item) => item.id === userId);
      if (!user || !isAdmin(state.user) || user.id === state.user.id) return;
      if (isUnclaimed(user) && groupAdminFor(user)) return;
      user.role = isAdmin(user) ? "member" : "admin";
      persist("users");
      renderAll();
      sound("check", isAdmin(user));
      announce(user.name + " is now " + (isAdmin(user) ? "an admin." : "a member."));
    }

    // --- Everything together -----------------------------------------------------------
    function renderAll(fallback) {
      redraw(() => {
        renderSession();
        renderCalendar(false);
        renderDay();
        renderUpcoming();
        renderPostForm();
        renderPosts();
        renderAdmin();
      }, fallback);
    }

    // Another tab may log in, log out or post: keep this one in step. A key of null means
    // another tab cleared this site's storage. The browser may also show this page again
    // from its back/forward cache, as it was before the visitor went elsewhere.
    window.addEventListener("storage", (event) => {
      if (event.key && !Object.values(KEYS).includes(event.key)) return;
      reload(true);
      renderAll();
    });
    window.addEventListener("pageshow", (event) => {
      if (!event.persisted) return;
      reload(true);
      renderAll();
    });

    renderAll();
    // After logging in or registering, the account page sends people here with ?welcome.
    if (/[?&]welcome\b/.test(window.location.search)) {
      if (state.user) announce("Welcome, " + state.user.name + "! You are logged in.");
      try { window.history.replaceState(null, "", window.location.pathname); } catch (error) {}
    }
  }

  // ==========================================================================
  // 9. Start
  // ==========================================================================

  updateAccountLink();
  setUpAccountPage();
  setUpCommunityPage();

  // Every page: keep the header's account link right when another tab logs in or out,
  // and when the browser shows a page again from its back/forward cache.
  window.addEventListener("storage", (event) => {
    if (!event.key || event.key === KEYS.session || event.key === KEYS.users) updateAccountLink();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) updateAccountLink();
  });

  // For the tests: the hash function, checked against the published SHA-256 examples.
  window.BeforeLandfallCommunity = { sha256 };
})();
