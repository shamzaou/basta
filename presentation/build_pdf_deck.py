"""Builds presentation/FAST_PONG-presentation.pdf (via presentation/pdf-deck.html).

Style follows the team's earlier capstone deck (pale-blue background, navy headings,
photo side panels, rounded cards, section dividers). Run:
    python presentation/build_pdf_deck.py
Requires Pillow and Google Chrome (headless print-to-PDF).

One presenter per section (see SECTIONS below); the matching speaker scripts live in
presentation/scripts/ (points/ = bullet points, full/ = word-for-word script).
"""
import base64, io, os, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")
SHOTS = os.path.join(HERE, "screenshots")
OUT_HTML = os.path.join(HERE, "pdf-deck.html")
OUT_PDF = os.path.join(HERE, "FAST_PONG-presentation.pdf")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


def img(path, max_w=1400, q=82):
    """Return a data URI, downscaled JPEG (keeps the file small)."""
    im = Image.open(path).convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, int(im.height * max_w / im.width)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=q, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def A(name, **kw):
    return img(os.path.join(ASSETS, name), **kw)


def S(name, **kw):
    return img(os.path.join(SHOTS, name), **kw)


CSS = """
*{box-sizing:border-box;margin:0;padding:0}
@page{size:13.333in 7.5in;margin:0}
html,body{background:#eef3fb;font-family:Calibri,"Segoe UI",Arial,sans-serif;color:#2b2f3a}
.slide{position:relative;width:13.333in;height:7.5in;overflow:hidden;background:#eef3fb;page-break-after:always;break-after:page}
.slide:last-child{page-break-after:auto;break-after:auto}
h1{font-weight:400;color:#1f3b8f;font-size:54px;line-height:1.15}
h2{font-weight:400;color:#1f3b8f;font-size:33px;line-height:1.2;margin-bottom:10px}
h3{font-weight:600;color:#1f3b8f;font-size:17.5px;line-height:1.25;margin-bottom:6px}
p,li{font-size:15px;line-height:1.45;color:#333}
.intro{font-size:15px;color:#333;margin-bottom:18px;line-height:1.45}
.rule{height:2px;background:#1f3b8f;margin:14px 0 18px}
/* panels */
.photo{position:absolute;left:0;top:0;width:4.55in;height:7.5in;object-fit:cover}
.content{position:absolute;left:5.05in;top:.55in;right:.6in;bottom:.5in}
.banner{position:absolute;left:0;top:0;width:13.333in;height:2.15in;object-fit:cover}
.under{position:absolute;left:.75in;right:.75in;top:2.55in;bottom:.5in}
.full{position:absolute;left:.75in;right:.75in;top:.55in;bottom:.5in}
/* cards */
.cards{display:grid;gap:16px}
.c1{grid-template-columns:1fr}.c2{grid-template-columns:1fr 1fr}.c3{grid-template-columns:1fr 1fr 1fr}.c4{grid-template-columns:repeat(4,1fr)}
.card{background:#dbe6f8;border:1px solid #c5d6f2;border-radius:10px;padding:18px 20px}
.card p{font-size:14px;line-height:1.45}
.card.plain{background:#fff}
.card ol{padding-left:20px}.card ol li{font-size:13.5px;line-height:1.4;margin:3px 0}
.num{display:inline-block;width:26px;height:26px;border-radius:50%;background:#1f3b8f;color:#fff;font-size:13px;line-height:26px;text-align:center;margin-right:8px;font-weight:600}
/* section divider */
.sec .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.sec .n{position:absolute;left:.75in;top:1.5in;font-size:120px;color:#1f3b8f;line-height:1}
.sec .t{position:absolute;right:.75in;bottom:2.05in;font-size:46px;color:#1f3b8f;text-align:right}
.sec .r{position:absolute;left:.75in;right:.75in;bottom:1.9in;height:2px;background:#1f3b8f}
.sec .who{position:absolute;right:.75in;bottom:1.35in;font-size:18px;color:#4b5563}
.sec .who b{color:#1f3b8f;font-weight:600}
/* title */
.title .content{top:1.7in}
.title .kicker{font-size:16px;letter-spacing:.18em;text-transform:uppercase;color:#6b7280;margin-bottom:18px}
.title .team{display:grid;grid-template-columns:1fr 1fr;gap:6px 28px;margin-top:18px}
.title .team div{font-size:16px;color:#333}.title .team b{color:#1f3b8f;font-weight:600}
.title .meta{margin-top:26px;font-size:14px;color:#6b7280}
/* contents */
.toc{display:grid;grid-template-columns:repeat(5,1fr);gap:34px 18px;text-align:center;margin-top:34px}
.toc i{display:block;font-style:italic;font-size:22px;color:#1f3b8f;margin-bottom:8px}
.toc span{font-size:19px;color:#1f3b8f;display:block;line-height:1.2}
.toc small{display:block;font-size:14px;color:#6b7280;margin-top:8px}
/* tables */
table{border-collapse:collapse;width:100%;font-size:13.5px}
th,td{border:1px solid #c5d6f2;padding:6px 9px;text-align:left;vertical-align:top}
th{background:#1f3b8f;color:#fff;font-weight:600}
tr:nth-child(even) td{background:#e4ecf9}
td.maj{color:#1f3b8f;font-weight:600;white-space:nowrap}td.min{color:#0f766e;font-weight:600;white-space:nowrap}
/* figures */
.figs{display:grid;gap:18px;align-items:start}
.figs img{width:100%;border:1px solid #c5d6f2;border-radius:6px;background:#fff}
.figs figcaption{font-size:13.5px;color:#4b5563;text-align:center;margin-top:6px}
.cap{font-size:14px;color:#4b5563;margin-top:8px}
.note{font-size:12.5px;color:#6b7280;font-style:italic;margin-top:10px}
.pn{position:absolute;right:.45in;bottom:.28in;font-size:11px;color:#8a94a6}
.spk{position:absolute;right:1.15in;bottom:.28in;font-size:11px;color:#8a94a6}
ul{padding-left:18px}li{margin:4px 0}
.two{display:grid;grid-template-columns:1fr 1fr;gap:22px}.two>.cards{align-content:start}
.flow{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-top:6px}
.flow div{background:#dbe6f8;border:1px solid #c5d6f2;border-radius:10px;padding:14px 12px;text-align:center}
.flow div b{display:block;color:#1f3b8f;font-size:15px;margin-bottom:6px}
.flow div p{font-size:12.5px;line-height:1.35}
"""

slides = []


def add(html):
    slides.append(html)


def cards(items, cols=3, numbered=False):
    cls = {1: "c1", 2: "c2", 3: "c3", 4: "c4"}[cols]
    out = [f'<div class="cards {cls}">']
    for i, (t, b) in enumerate(items, 1):
        n = f'<span class="num">{i}</span>' if numbered else ""
        out.append(f'<div class="card"><h3>{n}{t}</h3><p>{b}</p></div>')
    out.append("</div>")
    return "".join(out)


def section(n, title, who):
    add(f'<section class="slide sec"><img class="bg" src="{A("bg-section.jpg", max_w=1600, q=70)}">'
        f'<div class="n">{n}</div><div class="t">{title}</div><div class="r"></div><div class="who">Presenter: <b>{who}</b></div></section>')


def left(photo, title, intro, body):
    add(f'<section class="slide"><img class="photo" src="{A(photo, max_w=700)}"><div class="content"><h2>{title}</h2>'
        f'<p class="intro">{intro}</p>{body}</div></section>')


def banner(image, title, intro, body):
    add(f'<section class="slide"><img class="banner" src="{A(image, max_w=1600, q=70)}"><div class="under"><h2>{title}</h2>'
        f'<p class="intro">{intro}</p>{body}</div></section>')


def full(title, body, intro=""):
    add(f'<section class="slide"><div class="full"><h2>{title}</h2>' + (f'<p class="intro">{intro}</p>' if intro else "") + f'{body}</div></section>')


def shots(title, intro, items, cols=2, tall=False):
    st = "max-height:4.55in;object-fit:contain;object-position:top" if not tall else "max-height:4.55in;object-fit:cover;object-position:top"
    figs = "".join(f'<figure><img src="{S(f, max_w=1100)}" style="{st}"><figcaption>{c}</figcaption></figure>' for f, c in items)
    full(title, f'<div class="figs" style="grid-template-columns:repeat({cols},1fr)">{figs}</div>', intro=intro)


# Speaker plan — one presenter per section. Scripts: presentation/scripts/{points,full}/NN-*.md
NOUR, ALI, NASSER, SALIM = "Nour Murat", "Alisher Abdullaev", "Nasser Alzaabi", "Salim Hamzaoui"
SECTIONS = [("01", "Introduction", NOUR),
            ("02", "Software Development Life Cycle", ALI),
            ("03", "Selected Modules &amp; Design", SALIM),
            ("04", "Authentication &amp; Security", NASSER),
            ("05", "Games &amp; Graphics", SALIM),
            ("06", "Tournaments", NOUR),
            ("07", "Profiles, Statistics &amp; Friends", ALI),
            ("08", "GDPR &amp; Accessibility", SALIM),
            ("09", "Testing &amp; Evolution", NASSER),
            ("10", "Team &amp; Conclusion", ALI)]
SEC = {n: (t, w) for n, t, w in SECTIONS}


def sec(n):
    section(n, *SEC[n])


# ---------------------------------------------------------------- 1. title
add(f'''<section class="slide title"><img class="photo" src="{A("photo-city.jpg", max_w=700)}"><div class="content">
<div class="kicker">42 Abu Dhabi · Capstone Project · Staff Evaluation</div>
<h1>Capstone Project:<br>Ft_Transcendence</h1><div class="rule"></div>
<div class="team"><div><b>Salim Hamzaoui</b> · shamzaou</div><div><b>Nasser Alzaabi</b> · naalzaab</div>
<div><b>Alisher Abdullaev</b> · alabdull</div><div><b>Nour Murat</b> · nurmurat</div></div>
<div class="meta">FAST_PONG — a web platform for 3D Pong and Tic-Tac-Toe, tournaments with matchmaking, player statistics, 42 login, 2FA and GDPR tools<br>
7 Major + 6 Minor modules = 10 major-equivalents · Evaluation date: ____ / ____ / 2026</div>
</div></section>''')

# ---------------------------------------------------------------- 2. contents
add('<section class="slide"><div class="full" style="text-align:center"><h2 style="font-size:40px;margin-top:.25in">CONTENTS</h2><div class="rule"></div><div class="toc">'
    + "".join(f'<div><i>{n}</i><span>{t}</span><small>{w.split()[0]}</small></div>' for n, t, w in SECTIONS) + '</div></div></section>')

# ================================================================ 01 Introduction — Nour
sec("01")
banner("banner-tech.jpg", "Project Overview",
       "Ft_transcendence is a web-based multiplayer gaming platform developed as the capstone project of the 42 Abu Dhabi curriculum. "
       "Its core is a modern 3D implementation of the classic Pong, joined by a second game — Tic-Tac-Toe — and a complete user experience: "
       "secure accounts, 42 Intra login, email two-factor authentication, player profiles with statistics and match history, a friends list, a tournament system and GDPR tools.",
       '<p class="intro">The application is a Single Page Application: Django renders the first page on the server, then JavaScript swaps views without full reloads. '
       'The backend is Django (Python) with a PostgreSQL database; Gunicorn serves the site over HTTPS, and the whole stack runs in Docker Compose. '
       'The 3D game is rendered with Three.js (WebGL) and includes a computer-controlled opponent.</p>'
       + cards([("Backend", "Django 4.2, Django REST Framework, SimpleJWT, Gunicorn (HTTPS on port 443)"),
                ("Frontend", "Vanilla JavaScript SPA, Bootstrap toolkit, Three.js for the 3D Pong scene"),
                ("Data &amp; Ops", "PostgreSQL 13, Docker Compose, Git/GitHub feature-branch workflow")], 3))
left("photo-devs.jpg", "Project Objectives",
     "The goal was to design, develop and deploy a fully functional and secure web application centred on a Pong game. The objectives set at the outset were:",
     cards([("Functional gaming platform", "A fully operational website with 3D Pong (two players or versus AI) and a second game, Tic-Tac-Toe, played locally on one device; every game is recorded in the player's history."),
            ("Secure authentication", "Email/password registration, 42 Intra OAuth for students, optional email-based 2FA and JWT tokens."),
            ("Persistent user profiles", "Display name, avatar, friends, win/loss statistics, best score and a complete match history for both games."),
            ("Tournament mode", "Create a tournament of 3–8 nicknames, play a round-robin of Pong matches and determine a winner."),
            ("Application security &amp; GDPR", "Protection against SQL injection, XSS and CSRF; data export, anonymization and account deletion."),
            ("Collaborative development", "An Agile, feature-branch workflow with code reviews, Docker and a maintainable codebase.")], 3))
left("photo-holo.jpg", "Scope of the Project",
     "The scope covers every essential aspect of a modern web application, from user management to gameplay and deployment:",
     cards([("User management", "Registration, login, 42 OAuth, profile editing, avatar upload, friends list."),
            ("Pong (3D)", "Local two-player mode on one keyboard and a single-player mode against the AI opponent."),
            ("Tic-Tac-Toe", "Second game, played locally on one device; each result is saved to the user's match history."),
            ("Tournaments", "Creation, nickname registration, automatic match generation, tiebreakers, winner."),
            ("Profiles &amp; statistics", "Games played, win rate, best score, recent matches, JSON export of all data."),
            ("Security &amp; privacy", "Hashed passwords, HTTPS, CSRF, 2FA + JWT, GDPR anonymize / export / delete."),
            ("Deployment", "Two containers (web, db) orchestrated with Docker Compose; one command to run."),
            ("Team process", "Agile iterations, Git feature branches, pull requests and peer review.")], 4))

# ================================================================ 02 SDLC — Ali
sec("02")
left("photo-team-laptop.jpg", "Chosen SDLC Model: Agile (iterative &amp; incremental)",
     "The project was built in short cycles, each delivering one working feature that was merged and tested before the next one started. "
     "This suited a four-person learning project with evolving requirements.",
     cards([("Iterative development", "Work was broken into features — authentication, Pong core, tournaments, profiles — each built in its own short cycle."),
            ("Incremental delivery", "A runnable, testable version existed after every merge; functionality grew with each iteration."),
            ("Flexibility", "Requirements and the technical approach were refined as our understanding of the project grew."),
            ("Collaboration &amp; feedback", "Daily check-ins, pairing on complex features and peer review of every merge.")], 2, numbered=True)
     + '<p class="note">Evidence in the repository: 86 commits between 10 Feb and 2 Apr 2025, 15 pull requests merged from feature branches '
       '(db-connect, game-setup, tournaments, profile-page, secure-cookies, OAuth, user-settings, delete-account …), plus the 2026 pre-evaluation sweeps.</p>')
left("photo-meeting.jpg", "Phases and Iterations",
     "We did not use formal time-boxed sprints, but every major feature went through the same cycle of phases:",
     cards([("Planning", "Discuss the next feature (e.g. 2FA, tournament logic), clarify objectives and acceptance criteria."),
            ("Design", "Sketch data models, API endpoints and simple wireframes before coding."),
            ("Implementation", "Develop the feature in a dedicated Git branch to avoid conflicts with the main codebase."),
            ("Developer testing", "Unit tests for backend logic and functional checks by the developer."),
            ("Integration &amp; review", "Peer code review, then merge of the feature branch into master."),
            ("System testing", "Test the feature inside the whole application to catch regressions.")], 3, numbered=True))
banner("banner-hands.jpg", "Team Collaboration and Version Control",
       "Clear processes and modern tools kept four developers working in parallel without stepping on each other.",
       cards([("Version control", "Git with GitHub as the central repository — every change tracked and reversible."),
              ("Branching strategy", "Feature-based branches (OAuth, tournaments, profile-page …) isolated work in progress from master."),
              ("Code reviews", "Every branch was reviewed through a pull request before merging — 15 PRs in total."),
              ("Communication", "A WhatsApp group for quick coordination and regular in-person meetings on campus.")], 4))
full("Project Timeline (Gantt Chart)",
     f'<div class="figs" style="grid-template-columns:1fr"><figure><img src="{A("gantt.jpg", max_w=1500)}" style="max-height:4.6in;object-fit:contain"><figcaption>Figure 1: Project Gantt chart — planning &amp; setup, core frontend, core backend, feature implementation, testing &amp; integration, deployment.</figcaption></figure></div>',
     intro="The Gantt chart planned and tracked the project over time: task durations, dependencies and milestones.")

# ================================================================ 03 Modules & Design — Salim
sec("03")
mods = [("Web", "Use a framework as backend", "maj", "Major", "Django 4.2 + Django REST Framework; apps userapp, gameapp, tournaments"),
        ("Web", "Use a front-end framework or toolkit", "min", "Minor", "Bootstrap 4.5 + custom CSS; vanilla-JS SPA router"),
        ("Web", "Use a database for the backend", "min", "Minor", "PostgreSQL 13 via the Django ORM and migrations"),
        ("User Management", "Standard user management, authentication, users across tournaments", "maj", "Major", "Register / login, profiles, avatars, friends, stats, match history; tournaments of nicknames"),
        ("User Management", "Implementing a remote authentication", "maj", "Major", "42 Intra OAuth 2.0 (signed state → authorize → callback → state check + server-side code exchange → JWT)"),
        ("Gameplay &amp; UX", "Add another game with user history and matchmaking", "maj", "Major", "Tic-Tac-Toe (local, one device) with per-user match history; matchmaking = the tournament system (round-robin pairings, next-match announcement, tiebreakers)"),
        ("AI-Algo", "Introduce an AI opponent", "maj", "Major", "PongAI: looks once per second, predicts the intercept incl. wall bounces, presses simulated arrow keys at player speed — no A*"),
        ("AI-Algo", "User and game stats dashboards", "min", "Minor", "Profile cards, win-rate chart, match history, tournament scoreboard, JSON export"),
        ("Cybersecurity", "GDPR compliance: anonymization, local data management, account deletion", "min", "Minor", "Anonymization (42-safe), data export, edit data, account deletion, inactive-account cleanup"),
        ("Cybersecurity", "Two-Factor Authentication (2FA) and JWT", "maj", "Major", "Email one-time code on login; SimpleJWT access / refresh tokens"),
        ("Graphics", "Use of advanced 3D techniques", "maj", "Major", "Three.js: perspective camera, lights, Phong materials, textured spinning ball"),
        ("Accessibility", "Expanding browser compatibility", "min", "Minor", "Standard web APIs only (ES modules, fetch, WebGL); tested in Chrome, Edge and Firefox"),
        ("Accessibility", "Server-Side Rendering (SSR) integration", "min", "Minor", "Django pre-renders the requested page, title/meta and the profile data; the SPA hydrates it")]
rows = "".join(f'<tr><td>{c}</td><td>{m}</td><td class="{k}">{t}</td><td>{h}</td></tr>' for c, m, k, t, h in mods)
full("Selected Modules",
     f'<table><tr><th>Category</th><th>Module</th><th>Type</th><th>How it is implemented</th></tr>{rows}</table>'
     '<p class="cap" style="margin-top:12px"><b>7 Major + 6 Minor (× 0.5) = 10 major-equivalents</b> — 7 are required for 100 %. '
     'Not selected: support on all devices (responsive layout and touch remain features), remote players, live chat, microservices, multiple languages.</p>')
left("photo-dev-screens.jpg", "Technology Stack",
     "Chosen for robustness, simplicity and the learning objectives of the curriculum — and because the subject fixes Django, Bootstrap, PostgreSQL and Three.js for the modules we selected.",
     cards([("Backend", "Python 3.11, Django 4.2, Django REST Framework, SimpleJWT, python-decouple for configuration"),
            ("Server", "Gunicorn with TLS on port 443 (self-signed certificate), WhiteNoise for hashed static files"),
            ("Database", "PostgreSQL 13 in its own container, accessed through the Django ORM and migrations"),
            ("Frontend", "Vanilla JavaScript SPA, HTML5, CSS3, Bootstrap 4.5"),
            ("3D graphics", "Three.js r128 (WebGL) for the Pong scene; HTML5 canvas for procedural textures"),
            ("DevOps", "Docker Compose, Makefile targets, Git / GitHub with pull requests")], 2))
full("System Architecture",
     f'<div class="two" style="grid-template-columns:1fr 1.35fr;align-items:center">'
     '<div><p class="intro">The application is a monolith with a clear separation between frontend and backend, running in containers:</p>'
     '<ul><li>The browser loads one server-rendered page and then runs the SPA.</li>'
     '<li>Gunicorn (3 workers) terminates HTTPS on port 443 and runs the Django app; WhiteNoise serves static files.</li>'
     '<li>Django exposes the REST API — accounts, presence, match history, tournaments (matchmaking) — and talks to PostgreSQL only through the ORM.</li>'
     '<li>External services: the 42 API for OAuth and Gmail SMTP for 2FA codes.</li>'
     '<li>Docker Compose defines the two services, the network and the database volume.</li></ul></div>'
     f'<figure><img src="{A("architecture.jpg", max_w=1300)}" style="width:100%;border:1px solid #c5d6f2;border-radius:6px;background:#fff"><figcaption class="cap" style="text-align:center">Figure 2: System architecture diagram</figcaption></figure></div>')
left("photo-nodes.jpg", "Database and API Design",
     "The schema is defined with Django models, grouped into three apps; the frontend consumes a RESTful JSON API.",
     '<div class="two">'
     + cards([("userapp", "<b>User</b> (custom, email login, 2FA flag, avatar, friends M2M, last activity) and <b>MatchHistory</b> (game type, opponent, result, score, date)."),
              ("gameapp", "the <b>index</b> view that server-renders the requested page (SSR); both games run in the browser and post their results to MatchHistory. Legacy Game / Player / Score models."),
              ("tournaments", "<b>Tournament</b>, <b>Player</b> (nickname per tournament) and <b>Match</b> (scores, winner, tiebreaker flag).")], 1)
     + '<div><table><tr><th>Endpoint</th><th>Purpose</th></tr>'
       '<tr><td>POST /api/auth/register/ · login/ · logout/</td><td>Accounts and sessions (login starts 2FA)</td></tr>'
       '<tr><td>POST /api/auth/verify-otp/ · token/refresh/</td><td>Check the emailed code, issue / refresh JWT</td></tr>'
       '<tr><td>POST /api/auth/redirect_uri/ · get-token/</td><td>42 OAuth link and code exchange</td></tr>'
       '<tr><td>GET/PUT /api/auth/profile/ · friends/… · users/</td><td>Profile, stats, avatar, unique display name, friends + online status</td></tr>'
       '<tr><td>/api/auth/save-match/ · match-history/</td><td>Record and list games</td></tr>'
       '<tr><td>/api/auth/export-data/ · anonymize-account/ · delete-account/</td><td>GDPR tools</td></tr>'
       '<tr><td>POST /api/auth/heartbeat/</td><td>Presence: friends show online / offline (seen within 2 min)</td></tr>'
       '<tr><td>/tournaments/api/tournaments/…</td><td>Create, add players, view, start / finish matches</td></tr>'
       '</table></div></div>')
banner("banner-devices.jpg", "UI / UX Design",
       "The interface is built around clarity, simplicity and responsiveness: one consistent colour scheme and layout, immediate feedback on actions, and an app-like SPA experience.",
       f'<div class="two" style="grid-template-columns:1.1fr 1fr;align-items:start">'
       + cards([("SPA experience", "No full-page reloads: the client-side router swaps views and keeps browser history working."),
                ("Responsive", "Flexbox / grid layouts and media queries adapt the pages from desktop monitors to phones."),
                ("Feedback", "Buttons react on hover, loading states are shown during API calls, results and errors are displayed clearly."),
                ("Wireframes &amp; flowcharts", "Screens and the gameplay / tournament flows were sketched before implementation.")], 2)
       + f'<figure><img src="{A("wireframes.jpg", max_w=1100)}" style="width:100%;border:1px solid #c5d6f2;border-radius:6px;background:#fff;max-height:3.6in;object-fit:contain"><figcaption class="cap" style="text-align:center">Figure 3: Wireframes of the key screens</figcaption></figure></div>')

# ================================================================ 04 Authentication & Security — Nasser
sec("04")
shots("Features — Registration, Login and 2FA", "Email/password registration with a strong-password policy (every failing rule is reported separately), “Sign in with 42”, and an emailed one-time code when 2FA is enabled — password accounts switch it on or off in Settings; 42 accounts have no 2FA toggle.",
      [("03-login.jpg", "Login page: email / password or “Sign in with 42”"), ("04-register.jpg", "Registration: rule-by-rule password feedback, optional two-factor authentication"),
       ("19-2fa-modal.jpg", "Second factor: 6-digit code sent by email, valid 10 minutes, single use")], 3)
full("How a Login Works — 42 OAuth, 2FA and JWT",
     '<div class="cards c3">'
     '<div class="card"><h3><span class="num">1</span>Password + 2FA</h3><ol>'
     '<li>POST /login/ with email and password → Django <code>authenticate()</code> (PBKDF2 hash check).</li>'
     '<li>If 2FA is on: a 6-digit code is stored in a <b>shared database cache</b> for 10 min and emailed from a background thread; the response is <i>requires_2fa</i>.</li>'
     '<li>POST /verify-otp/ → code compared and deleted (single use) → session + JWT pair returned.</li></ol></div>'
     '<div class="card"><h3><span class="num">2</span>Remote authentication (42)</h3><ol>'
     '<li>“Sign in with 42” → the backend builds the authorize URL (client id, redirect URI, <i>response_type=code</i>) plus a signed, time-limited <i>state</i> kept in the session.</li>'
     '<li>The student consents on the 42 Intra; 42 redirects to <code>/oauth/callback?code=…&amp;state=…</code> in our SPA.</li>'
     '<li>The SPA posts code + state; the <b>server</b> checks the state (single use, 10 min — CSRF protection), exchanges the code with the client secret (never in the browser), reads <code>/v2/me</code>, creates or links the user by email, logs in, returns JWTs.</li></ol></div>'
     '<div class="card"><h3><span class="num">3</span>JSON Web Tokens</h3><ol>'
     '<li>SimpleJWT: access token 60 min, refresh token 7 days, signed HS256 with the Django secret; claims <i>user_id, exp, iat, jti</i>.</li>'
     '<li>The SPA sends <code>Authorization: Bearer</code> on every API call (games, profile, friends, GDPR).</li>'
     '<li><code>authFetch</code> refreshes the token one minute before expiry and retries once after a 401, so a session survives the 60-minute limit.</li></ol></div>'
     '</div>'
     '<p class="note">Both paths end in the same state: a Django session cookie (HttpOnly) plus a JWT pair — 42 users and password users are indistinguishable afterwards.</p>',
     intro="Three flows share one outcome: a logged-in user with a session and a JWT pair.")
banner("banner-lock.jpg", "Cybersecurity Features",
       "Security was a fundamental requirement, addressed in layers from the database to the browser.",
       cards([("Password storage", "Django hashes and salts every password (PBKDF2); validators enforce length, upper-case, digit and symbol and report each failing rule."),
              ("2FA + JWT", "Optional emailed one-time code as a second factor; SimpleJWT access (60 min) and refresh (7 days) tokens."),
              ("42 OAuth", "Students log in through the 42 Intra; the server verifies the signed <i>state</i>, exchanges the code and never sees a password."),
              ("SQL injection", "All database access goes through the ORM, which parameterises every query."),
              ("CSRF &amp; XSS", "Django’s CSRF token is required on every state-changing request; user data (names, nicknames) is inserted with textContent, never as HTML."),
              ("Transport &amp; access control", "HTTPS everywhere — Gunicorn terminates TLS on port 443; every game, tournament and profile API requires login; secrets live in .env.")], 3))

# ================================================================ 05 Games & Graphics — Salim
sec("05")
shots("Features — 3D Pong and the AI Opponent", "Three.js scene with a perspective camera, lit table and a spinning textured ball. In “Player vs AI” the PongAI looks at the ball once per second, predicts where it will cross the paddle line and presses simulated arrow keys — first to 3 points wins.",
      [("10-pong-mode-select.jpg", "Mode selection: Player vs Player (one keyboard or touch) or Player vs AI"), ("11-pong-3d-vs-ai.jpg", "Game in progress against the AI")], 2)
full("Inside the Graphics and the AI Opponent",
     '<div class="two" style="grid-template-columns:1fr 1fr">'
     + cards([("3D scene (Three.js / WebGL)", "PerspectiveCamera (75°) looking down at a glossy table with neon edge lines; ambient + spot lighting; Phong materials with specular highlights; emissive cyan paddles; a magenta ball whose stripes are painted on an HTML canvas and used as a texture; antialiased renderer; a DOM HUD over the canvas."),
              ("Physics", "The bounce angle depends on where the ball hits the paddle (up to ±45°); the ball speeds up 5 % per hit; spin bends the trajectory and rotates the mesh; walls clamp and reflect; the canvas keeps a 4:3 ratio on resize; keyboard and touch input.")], 1)
     + cards([("AI — look once per second", "Every 1000 ms the AI takes one snapshot of the ball position and velocity (the subject’s “refresh once per second” rule). Between snapshots it acts only on its last decision."),
              ("AI — predict, with errors", "It extrapolates where the ball will cross its paddle line, folding the path at the walls so bounces are anticipated; then adds a small prediction error and, 10 % of the time, a big “mistake”."),
              ("AI — simulated keyboard", "The decision becomes a held ArrowUp / ArrowDown key fed into the same InputHandler as a human, so the AI paddle moves at exactly human speed. Every 5 s the score adjusts its judgement: it eases off when 2 points ahead, tries harder when behind. No A* — Pong has no graph to search.")], 1)
     + '</div>')
full("Features — Tic-Tac-Toe: the Second Game, History and Matchmaking",
     f'<div class="two" style="grid-template-columns:1fr 1.15fr;align-items:start">'
     f'<div class="figs" style="grid-template-columns:1fr"><figure><img src="{S("12-tictactoe.jpg", max_w=1100)}" style="max-height:4.6in;object-fit:contain;object-position:top"><figcaption>The 3 × 3 board: two players on one device, X and O alternate, “Reset game” starts over</figcaption></figure></div>'
     + cards([("A game distinct from Pong", "Turn-based Tic-Tac-Toe played locally on one device — like Pong, no online play by design. Win lines and draws are detected in the browser; moves on an occupied cell or after the end are ignored."),
              ("User history tracking", "Every finished game is posted to /api/auth/save-match/ with the JWT and stored as a MatchHistory row (TICTACTOE, WIN / LOSS / DRAW, date), so it appears in the profile’s recent matches, the win-rate chart and the JSON export."),
              ("Matchmaking", "Matchmaking is the tournament system: a tournament of 3–8 players is scheduled as a round-robin, the next pairing is announced (“Next match: A vs B”) and tied leaders are matched again in tiebreaker rounds until one winner remains."),
              ("Not online", "Both games run in the browser on one device; there is no online or remote play in the project — the “remote players” module is not selected.")], 1)
     + '</div>',
     intro="The “Add another game” module: a new game distinct from Pong, with user history tracking and a matchmaking system.")

# ================================================================ 06 Tournaments — Nour
sec("06")
shots("Features — Tournaments", "A logged-in user creates a tournament of 3–8 nicknames; every pair plays one Pong match, scores update the table, and tied leaders get automatic tiebreaker matches until one winner remains.",
      [("13-tournament-create.jpg", "Create a tournament and register the nicknames (unique inside the tournament)"), ("14-tournament-view.jpg", "Round-robin schedule with “Start Match” per pairing, “Next match” announcement, live scores and the winner")], 2)
full("Tournament Flow",
     '<div class="flow">'
     '<div><b>1 · Create</b><p>A logged-in user names the tournament and chooses 3–8 players.</p></div>'
     '<div><b>2 · Register</b><p>Each player types a nickname; duplicates and empty names are rejected.</p></div>'
     '<div><b>3 · Schedule</b><p>The server generates the round-robin: every pair meets exactly once.</p></div>'
     '<div><b>4 · Play</b><p>“Start Match” opens 3D Pong with both nicknames on screen (two players, one keyboard).</p></div>'
     '<div><b>5 · Score</b><p>The result is posted to the tournament API; the table shows points per player and announces the next match.</p></div>'
     '<div><b>6 · Winner</b><p>If leaders are tied, extra tiebreaker matches are created until one player wins.</p></div>'
     '</div>'
     + '<div style="margin-top:22px">' + cards([("Users across tournaments", "Nicknames belong to one tournament, so a person can join many tournaments with different aliases; the account that created the tournament must be logged in."),
                                                ("Kept safe", "All tournament endpoints require login and the CSRF token; nicknames are shown as text (no HTML injection); scores must be non-negative integers and a match cannot end in a tie."),
                                                ("Stays after refresh", "The current tournament id is remembered in the browser, so reloading the page returns to the same tournament.")], 3) + '</div>',
     intro="From creation to the final winner, the tournament system runs six steps:")

# ================================================================ 07 Profiles, Statistics & Friends — Ali
sec("07")
shots("Features — Player Profile and Stats Dashboard", "Every finished game — Pong, Pong vs AI, Tic-Tac-Toe — is recorded; the profile turns the history into a dashboard and the settings page holds the account and GDPR tools.",
      [("08-profile.jpg", "Games played, win-rate chart, best score, recent matches with game type and date, friends panel with online / offline dots"), ("09-settings.jpg", "Display name, e-mail, avatar, 2FA switch (password accounts), Download my data, Anonymize, Delete account")], 2, tall=True)
full("Features — Friends, Match History and User Data",
     f'<div class="two" style="grid-template-columns:1.1fr 1fr;align-items:start">'
     f'<figure class="figs"><img src="{S("15-find-users.jpg", max_w=1100)}" style="max-height:4.6in;object-fit:contain;object-position:top"><figcaption>“Find Users” lists every active player with an Add / Remove friend button</figcaption></figure>'
     + cards([("User information", "Custom Django user: e-mail is the login, unique username, optional display name (unique, case-insensitive), avatar (default picture if none, max 2 MB, image type checked), 2FA flag, 42 link."),
              ("Friends", "Add or remove friends from the Find Users list; the friends panel shows names, avatars and an online / offline dot — the SPA sends a heartbeat every minute, a user counts as online when seen in the last 2 minutes, and logging out sets offline at once. Presence only: there is no online play."),
              ("Match history", "One row per game: type (PONG / TICTACTOE), opponent, score, result, date. Last five on the profile, full list in the JSON export."),
              ("Statistics", "Games played, win rate (hand-drawn SVG pie chart), best score = the win with the largest margin. Tournament games are kept separate because their players are nicknames, not accounts.")], 1)
     + '</div>',
     intro="The user-management and stats-dashboard modules, seen from the user’s side.")

# ================================================================ 08 GDPR & Accessibility — Salim
sec("08")
left("photo-shield.jpg", "GDPR Compliance",
     "Users own their data: they can see it, take it with them, anonymize it or erase the account — and inactive accounts are cleaned up automatically.",
     cards([("Anonymization", "“Anonymize My Account” replaces username, e-mail, avatar and 42 link with anonymous values, clears friends and disables login; the non-personal game statistics are kept. Works for 42 accounts too."),
            ("Local data management", "“Download my data” exports profile, statistics and full match history as JSON; display name, e-mail and avatar can be edited in Settings."),
            ("Account deletion", "Hard-deletes the account and everything attached to it (match history, friend links, tokens) in one click, after confirmation."),
            ("Retention", "A management command warns after 5 months of inactivity and deletes after 6 (last activity tracked by middleware).")], 2)
     + '<p class="note">The privacy policy on the About page describes the data collected, its use, retention and the user’s rights.</p>')
full("Accessibility — Browser Compatibility and Server-Side Rendering",
     f'<div class="two" style="grid-template-columns:1.6fr 1fr;align-items:start">'
     + cards([("Expanding browser compatibility", "Primary browser: Chrome (and Edge). Additional browser: Firefox. The app uses only standard web APIs — ES modules, fetch, localStorage, History API, CSS Grid / Flexbox, WebGL 1 — with no vendor prefixes or polyfills. Browser-specific fixes: ISO-8601 dates so Firefox parses them, pointer events instead of touch/mouse events, font fallbacks. Tested manually in both browsers and with an automated headless-Chrome walkthrough of every page."),
              ("Server-Side Rendering", "Every URL is answered by Django’s <code>index</code> view, which renders the <i>requested</i> page as complete HTML: the right section is already active, the navigation reflects the login state, the page title and meta description are set, and for a logged-in user the profile — username, statistics, recent matches — is rendered into the HTML before any JavaScript runs. The SPA then hydrates and takes over routing. View-source shows real content, not an empty <code>&lt;div&gt;</code>, which helps first paint and SEO."),
              ("Responsive layout (feature)", "Media queries at 1100 / 920 / 768 / 480 px, hamburger navigation, stacked cards, a fluid game canvas and touch controls for Pong — kept as a feature although “support on all devices” is not a claimed module.")], 1)
     + f'<figure class="figs"><img src="{S("18-mobile-profile.jpg", max_w=800)}" style="max-height:5.4in;object-fit:cover;object-position:top"><figcaption>Profile on a 390 px phone</figcaption></figure></div>')

# ================================================================ 09 Testing & Evolution — Nasser
sec("09")
banner("banner-team.jpg", "Testing Strategy",
       "Several levels of testing, each with its own focus, keep the application stable and secure.",
       cards([("Unit tests", "Django test suite (<code>make test</code>) — 54 tests (userapp 41, tournaments 10, gameapp 3): login and the whole 2FA flow, the OAuth <i>state</i> check, presence, unique display names, rule-by-rule password feedback, GDPR export / anonymize / delete, the inactive-account command, tournament tiebreakers, server-side rendering."),
              ("Integration tests", "Scripted end-to-end API flow: register → login → profile → matches → friends → export → tournament → delete."),
              ("Browser walkthrough", "Headless Chrome drives every page on desktop and phone, plays both games and checks for JavaScript errors."),
              ("Manual / acceptance", "Team members continuously tested each other’s features from an end-user perspective, in Chrome and Firefox.")], 4))
left("photo-code.jpg", "Pre-Evaluation Audit (August 2026)",
     "Before the evaluation the codebase was audited end-to-end. Two bugs reported by users were traced to their root causes and fixed with regression tests:",
     cards([("“The 2FA code is sometimes rejected”", "The one-time code was kept in Django’s default in-memory cache, which is private to each process — and Gunicorn runs three workers. The verification request often reached a worker that had never seen the code. Fix: a database-backed cache shared by all workers."),
            ("“The 2FA e-mail is very slow”", "The e-mail was sent synchronously inside the login request with no timeout, so the response waited for the whole SMTP round-trip (and failed with 500 on any error). Fix: send in a background thread with a 10 s timeout — login now answers in ~80 ms."),
            ("Also fixed", "<code>make test</code> configuration, stale static files, the token-refresh URL in the SPA, a settings-page bug that saved a placeholder display name, the Pong ball gliding along a wall (bounce now clamps the ball and keeps a minimum angle), and the previous account's avatar remaining visible after switching users."),
            ("Result", "A second sweep found and fixed 30 more bugs (silent JWT expiry after 60 min, secrets in logs, duplicate-registration errors, tournament persistence and repeated tiebreakers, Save Settings, 2FA toggle, Pong resize / touch / pause leaks, input validation). A third pass checked every module against the subject: stored XSS via tournament nicknames fixed, AI presses simulated keys at player speed and anticipates bounces, DB credentials moved to .env, tournament API requires login, next-match announcement, GDPR anonymization (42-safe), no 2FA toggle for 42 accounts, rule-by-rule password feedback, unique display names, online / offline status of friends, the OAuth <i>state</i> parameter, real SSR — and an online Tic-Tac-Toe prototype was removed again: no online play by design, matchmaking is the tournament system. 54/54 tests pass, 0 JavaScript errors.")], 2))
banner("banner-meeting.jpg", "Challenges and Lessons Learned",
       "Building a complete application from scratch provided technical and organisational hurdles — and lasting lessons.",
       cards([("Tournament logic", "Generating fair schedules and resolving ties correctly required careful data modelling and state management."),
              ("State in vanilla JS", "Without a framework, login state, routing and views had to be managed by hand with disciplined code structure."),
              ("Asynchronous flows", "OAuth redirects, 2FA, the presence heartbeat and API calls demanded a solid grasp of Promises and loading states."),
              ("Docker networking", "Getting the web and database containers, volumes and environment variables to cooperate took iteration."),
              ("Multi-process bugs", "The 2FA cache bug only appears with several Gunicorn workers — a lesson in testing on the real deployment."),
              ("Lessons", "A well-defined API, a mature framework, a disciplined Git workflow and security from day one all paid off.")], 3))
left("photo-future.jpg", "Limitations and Future Enhancements",
     "The current version meets every selected module; the following points are known limitations and the improvements we would make next.",
     '<div class="two">' + cards([("Known limitations", "Both games are local by design — no online or remote play (the remote-players module is not selected); JWT stored in localStorage; "
                                    "no rate limit on the 2FA code; third-party assets load from CDNs; the 2FA mailbox needs a valid Gmail app password; Pong scores are reported by the client; the GDPR cleanup command is run by hand, not by a cron inside the image.")], 1)
     + cards([("Next steps", "1. Rate limiting on login / 2FA and 2FA recovery codes. 2. Server-authoritative Pong scores. "
                             "3. Selectable AI difficulty. 4. Leaderboards and achievements. 5. Only if the remote-players module were added: real-time online Pong and chat with WebSockets (Django Channels).")], 1) + '</div>')

# ================================================================ 10 Team & Conclusion — Ali
sec("10")
left("photo-team-table.jpg", "Contribution of Each Member",
     "Each member owned a group of modules end-to-end — backend, frontend and tests — and reviewed the others’ pull requests.",
     cards([("Salim Hamzaoui", "<b>Graphics</b> — 3D Pong with Three.js and its physics; <b>Gameplay</b> — the second game, Tic-Tac-Toe, with match history and tournament matchmaking; <b>Cybersecurity &amp; GDPR</b> — anonymization, data export, account deletion, retention cleanup, privacy policy."),
            ("Nasser Alzaabi", "<b>Authentication</b> — registration, login, sessions; <b>Remote authentication</b> — the 42 OAuth 2.0 flow; <b>2FA and JWT</b> — emailed one-time codes, SimpleJWT access / refresh tokens and their automatic renewal in the SPA."),
            ("Alisher Abdullaev", "<b>User history and statistics</b> — match history, stats dashboard, win-rate chart; <b>user information</b> — username, avatar, display name, e-mail, friends; <b>Database module</b> — PostgreSQL, models and migrations."),
            ("Nour Murat", "<b>Mandatory part</b> — the tournament system with round-robin scheduling and tiebreakers; <b>Front end</b> — the SPA and the Bootstrap toolkit module; <b>Backend framework module</b> — the Django project structure and REST API.")], 2))
banner("banner-conclusion.jpg", "Conclusion",
       "Ft_transcendence delivered a feature-rich, secure and engaging web gaming platform that satisfies all the selected modules — "
       "7 Major and 6 Minor, 10 major-equivalents against the 7 required.",
       '<div class="two">'
       '<p class="intro">Using Django, a vanilla-JavaScript SPA with Bootstrap, Three.js and PostgreSQL inside Docker, the team gained hands-on experience in full-stack development, '
       'game logic, deployment and application security. The Agile, feature-branch workflow kept four developers productive and the codebase reviewable.</p>'
       '<p class="intro">The modular structure is a solid base for the next evolution — remote play, chat and a richer AI — '
       'while the pre-evaluation audit leaves the project with a green test suite and documented, root-caused fixes.</p></div>')
add(f'<section class="slide sec"><img class="bg" src="{A("bg-end.jpg", max_w=1600, q=70)}"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><h1 style="font-size:64px">Thank You</h1></div></section>')

# ---------------------------------------------------------------- write & print
html = ['<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Capstone Project: Ft_Transcendence</title><style>' + CSS + '</style></head><body>']
speaker_of = {}   # slide index -> presenter (content slides only)
cur = None
for i, s in enumerate(slides, 1):
    if 'class="slide sec"' in s:
        cur = None
        for n, t, w in SECTIONS:
            if f'<div class="n">{n}</div>' in s:
                cur = w
    elif cur:
        speaker_of[i] = cur
for i, s in enumerate(slides, 1):
    if i == 1:
        html.append(s)
        continue
    foot = f'<div class="pn">{i} / {len(slides)}</div>'
    if i in speaker_of:
        foot = f'<div class="spk">Presenter: {speaker_of[i]}</div>' + foot
    html.append(s.replace("</section>", foot + "</section>", 1))
html.append("</body></html>")
open(OUT_HTML, "w", encoding="utf-8").write("".join(html))
print("slides:", len(slides), "html:", os.path.getsize(OUT_HTML) // 1024, "KB")
if "--no-pdf" not in sys.argv:
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=10000",
                    f"--print-to-pdf={OUT_PDF}", "file:///" + OUT_HTML.replace("\\", "/")], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("pdf:", os.path.getsize(OUT_PDF) // 1024, "KB")
