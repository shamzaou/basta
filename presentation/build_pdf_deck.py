"""Builds presentation/FAST_PONG-presentation.pdf (via presentation/pdf-deck.html).

Style follows the team's earlier capstone deck (pale-blue background, navy headings,
photo side panels, rounded cards, section dividers). Run:
    python presentation/build_pdf_deck.py
Requires Pillow and Google Chrome (headless print-to-PDF).
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
.num{display:inline-block;width:26px;height:26px;border-radius:50%;background:#1f3b8f;color:#fff;font-size:13px;line-height:26px;text-align:center;margin-right:8px;font-weight:600}
/* section divider */
.sec .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.sec .n{position:absolute;left:.75in;top:1.5in;font-size:120px;color:#1f3b8f;line-height:1}
.sec .t{position:absolute;right:.75in;bottom:2.05in;font-size:46px;color:#1f3b8f}
.sec .r{position:absolute;left:.75in;right:.75in;bottom:1.9in;height:2px;background:#1f3b8f}
.sec .who{position:absolute;right:.75in;bottom:1.35in;font-size:15px;color:#4b5563}
/* title */
.title .content{top:2.1in}
.title .kicker{font-size:16px;letter-spacing:.18em;text-transform:uppercase;color:#6b7280;margin-bottom:18px}
.title .team{display:grid;grid-template-columns:1fr 1fr;gap:6px 28px;margin-top:18px}
.title .team div{font-size:16px;color:#333}.title .team b{color:#1f3b8f;font-weight:600}
.title .meta{margin-top:26px;font-size:14px;color:#6b7280}
/* contents */
.toc{display:grid;grid-template-columns:repeat(4,1fr);gap:34px 20px;text-align:center;margin-top:38px}
.toc i{display:block;font-style:italic;font-size:22px;color:#1f3b8f;margin-bottom:10px}
.toc span{font-size:21px;color:#1f3b8f}
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
ul{padding-left:18px}li{margin:4px 0}
.two{display:grid;grid-template-columns:1fr 1fr;gap:22px}.two>.cards{align-content:start}
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


def section(n, title, who="Presenter: ____________"):
    add(f'<section class="slide sec"><img class="bg" src="{A("bg-section.jpg", max_w=1600, q=70)}">'
        f'<div class="n">{n}</div><div class="t">{title}</div><div class="r"></div><div class="who">{who}</div></section>')


def left(photo, title, intro, body):
    add(f'<section class="slide"><img class="photo" src="{A(photo, max_w=700)}"><div class="content"><h2>{title}</h2>'
        f'<p class="intro">{intro}</p>{body}</div></section>')


def banner(image, title, intro, body):
    add(f'<section class="slide"><img class="banner" src="{A(image, max_w=1600, q=70)}"><div class="under"><h2>{title}</h2>'
        f'<p class="intro">{intro}</p>{body}</div></section>')


def full(title, body, intro=""):
    add(f'<section class="slide"><div class="full"><h2>{title}</h2>' + (f'<p class="intro">{intro}</p>' if intro else "") + f'{body}</div></section>')


# ---------------------------------------------------------------- 1. title
add(f'''<section class="slide title"><img class="photo" src="{A("photo-city.jpg", max_w=700)}"><div class="content">
<div class="kicker">42 Abu Dhabi · Capstone Project · Staff Evaluation</div>
<h1>Capstone Project:<br>Ft_Transcendence</h1><div class="rule"></div>
<div class="team"><div><b>Salim Hamzaoui</b> · shamzaou</div><div><b>Nasser Alzaabi</b> · naalzaab</div>
<div><b>Alisher Abdullaev</b> · alabdull</div><div><b>Nour Murat</b> · nurmurat</div></div>
<div class="meta">FAST_PONG — a web platform for 3D Pong with tournaments, player statistics, 42 login, 2FA and GDPR tools<br>Evaluation date: ____ / ____ / 2026</div>
</div></section>''')

# ---------------------------------------------------------------- 2. contents
toc = [("01", "Introduction"), ("02", "Software Development Life Cycle"), ("03", "Selected Modules"), ("04", "Design"),
       ("05", "Implementation &amp; Features"), ("06", "Security &amp; GDPR"), ("07", "Testing &amp; Evolution"), ("08", "Team &amp; Conclusion")]
add('<section class="slide"><div class="full" style="text-align:center"><h2 style="font-size:40px;margin-top:.35in">CONTENTS</h2><div class="rule"></div><div class="toc">'
    + "".join(f'<div><i>{n}</i><span>{t}</span></div>' for n, t in toc) + '</div></div></section>')

# ---------------------------------------------------------------- 01 Introduction
section("01", "Introduction")
banner("banner-tech.jpg", "Project Overview",
       "Ft_transcendence is a web-based multiplayer gaming platform developed as the capstone project of the 42 Abu Dhabi curriculum. "
       "Its core is a modern 3D implementation of the classic Pong, surrounded by a complete user experience: secure accounts, 42 Intra login, "
       "email two-factor authentication, player profiles with statistics and match history, a friends list, a tournament system and GDPR tools.",
       '<p class="intro">The application is a Single Page Application: one server-rendered page, after which JavaScript swaps views without full reloads. '
       'The backend is Django (Python) with a PostgreSQL database; Gunicorn serves the site over HTTPS, and the whole stack runs in Docker Compose. '
       'The 3D game is rendered with Three.js (WebGL) and includes a computer-controlled opponent.</p>'
       + cards([("Backend", "Django 4.2, Django REST Framework, SimpleJWT, Gunicorn (HTTPS on port 443)"),
                ("Frontend", "Vanilla JavaScript SPA, Bootstrap, Three.js for the 3D Pong scene"),
                ("Data &amp; Ops", "PostgreSQL 13, Docker Compose, Git/GitHub feature-branch workflow")], 3))
left("photo-devs.jpg", "Project Objectives",
     "The goal was to design, develop and deploy a fully functional and secure web application centred on a Pong game. The objectives set at the outset were:",
     cards([("Functional gaming platform", "A fully operational website with 3D Pong (two players or versus AI) as its central attraction."),
            ("Secure authentication", "Email/password registration, 42 Intra OAuth for students, optional email-based 2FA and JWT tokens."),
            ("Persistent user profiles", "Display name, avatar, win/loss statistics, best score and complete match history."),
            ("Tournament mode", "Create a tournament of 3–8 nicknames, play a round-robin of matches and determine a winner."),
            ("Application security &amp; GDPR", "Protection against SQL injection, XSS and CSRF; data export and account deletion."),
            ("Collaborative development", "An Agile, feature-branch workflow with code reviews, Docker and a maintainable codebase.")], 3))
left("photo-holo.jpg", "Scope of the Project",
     "The scope covers every essential aspect of a modern web application, from user management to gameplay and deployment:",
     cards([("User management", "Registration, login, 42 OAuth, profile editing, avatar upload, friends list."),
            ("Pong (3D)", "Local two-player mode on one keyboard and a single-player mode against the AI opponent."),
            ("Tournaments", "Creation, nickname registration, automatic match generation, tiebreakers, winner."),
            ("Profiles &amp; statistics", "Games played, win rate, best score, recent matches, JSON export of all data."),
            ("Security &amp; privacy", "Hashed passwords, HTTPS, CSRF, 2FA + JWT, GDPR data export / deletion."),
            ("Deployment", "Two containers (web, db) orchestrated with Docker Compose; one command to run."),
            ("Bonus feature", "A local Tic-Tac-Toe game whose results also appear in the match history."),
            ("Team process", "Agile iterations, Git feature branches, pull requests and peer review.")], 4))

# ---------------------------------------------------------------- 02 SDLC
section("02", "Software Development Life Cycle")
left("photo-team-laptop.jpg", "Chosen SDLC Model: Agile (iterative &amp; incremental)",
     "The project was built in short cycles, each delivering one working feature that was merged and tested before the next one started. "
     "This suited a four-person learning project with evolving requirements.",
     cards([("Iterative development", "Work was broken into features — authentication, Pong core, tournaments, profiles — each built in its own short cycle."),
            ("Incremental delivery", "A runnable, testable version existed after every merge; functionality grew with each iteration."),
            ("Flexibility", "Requirements and the technical approach were refined as our understanding of the project grew."),
            ("Collaboration &amp; feedback", "Daily check-ins, pairing on complex features and peer review of every merge.")], 2, numbered=True)
     + '<p class="note">Evidence in the repository: 86 commits between 10 Feb and 2 Apr 2025, 15 pull requests merged from feature branches '
       '(db-connect, game-setup, tournaments, profile-page, secure-cookies, OAuth, user-settings, delete-account …).</p>')
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

# ---------------------------------------------------------------- 03 Modules
section("03", "Selected Modules")
mods = [("Web", "Use a framework as backend", "maj", "Major", "Django 4.2 + Django REST Framework"),
        ("Web", "Use a front-end framework or toolkit", "min", "Minor", "Bootstrap 4.5 + custom CSS"),
        ("Web", "Use a database for the backend", "min", "Minor", "PostgreSQL 13 via the Django ORM"),
        ("User Management", "Standard user management, authentication, users across tournaments", "maj", "Major", "Register / login, profiles, avatars, friends, stats; tournaments of nicknames"),
        ("User Management", "Implementing a remote authentication", "maj", "Major", "42 Intra OAuth 2.0 (authorize → callback → token exchange → JWT)"),
        ("AI-Algo", "Introduce an AI opponent", "maj", "Major", "PongAI: samples the ball once per second, predicts the intercept, tunable accuracy — no A*"),
        ("AI-Algo", "User and game stats dashboards", "min", "Minor", "Profile cards, win-rate chart, match history, tournament scoreboard, JSON export"),
        ("Cybersecurity", "GDPR compliance: anonymization, local data management, account deletion", "min", "Minor", "Data export, account deletion, inactive-account cleanup"),
        ("Cybersecurity", "Two-Factor Authentication (2FA) and JWT", "maj", "Major", "Email one-time code on login; SimpleJWT access / refresh tokens"),
        ("Graphics", "Use of advanced 3D techniques", "maj", "Major", "Three.js: perspective camera, lights, Phong materials, textured spinning ball"),
        ("Accessibility", "Support on all devices", "min", "Minor", "Responsive layout, media queries, hamburger menu"),
        ("Accessibility", "Expanding browser compatibility", "min", "Minor", "Standard ES modules / WebGL; Chrome and Firefox"),
        ("Accessibility", "Server-Side Rendering (SSR) integration", "min", "Minor", "Django renders the initial page (CSRF token, static manifest); the SPA takes over")]
rows = "".join(f'<tr><td>{c}</td><td>{m}</td><td class="{k}">{t}</td><td>{h}</td></tr>' for c, m, k, t, h in mods)
full("Selected Modules",
     f'<table><tr><th>Category</th><th>Module</th><th>Type</th><th>How it is implemented</th></tr>{rows}</table>'
     '<p class="cap" style="margin-top:14px"><b>6 Major + 7 Minor (× 0.5) = 9.5 major-equivalents</b> — 7 are required for 100 %. '
     'Not selected: another game, microservices, multiple languages (Tic-Tac-Toe is a bonus feature only).</p>')

# ---------------------------------------------------------------- 04 Design
section("04", "Design")
full("System Architecture",
     f'<div class="two" style="grid-template-columns:1fr 1.35fr;align-items:center">'
     '<div><p class="intro">The application is a monolith with a clear separation between frontend and backend, running in containers:</p>'
     '<ul><li>The browser loads one server-rendered page and then runs the SPA.</li>'
     '<li>Gunicorn (3 workers) terminates HTTPS on port 443 and runs the Django app; WhiteNoise serves static files.</li>'
     '<li>Django exposes the REST API and talks to PostgreSQL only through the ORM.</li>'
     '<li>External services: the 42 API for OAuth and Gmail SMTP for 2FA codes.</li>'
     '<li>Docker Compose defines the two services, the network and the database volume.</li></ul></div>'
     f'<figure><img src="{A("architecture.jpg", max_w=1300)}" style="width:100%;border:1px solid #c5d6f2;border-radius:6px;background:#fff"><figcaption class="cap" style="text-align:center">Figure 2: System architecture diagram</figcaption></figure></div>')
left("photo-nodes.jpg", "Database and API Design",
     "The schema is defined with Django models, grouped into three apps; the frontend consumes a RESTful JSON API.",
     '<div class="two">'
     + cards([("userapp", "<b>User</b> (custom, email login, 2FA flag, avatar, friends M2M, last activity) and <b>MatchHistory</b> (game type, opponent, result, score)."),
              ("tournaments", "<b>Tournament</b>, <b>Player</b> (nickname per tournament) and <b>Match</b> (scores, winner, tiebreaker flag).")], 1)
     + '<div><table><tr><th>Endpoint</th><th>Purpose</th></tr>'
       '<tr><td>POST /api/auth/register/ · login/ · logout/</td><td>Accounts and sessions (login starts 2FA)</td></tr>'
       '<tr><td>POST /api/auth/verify-otp/</td><td>Check the emailed code, issue JWT</td></tr>'
       '<tr><td>POST /api/auth/redirect_uri/ · get-token/</td><td>42 OAuth link and code exchange</td></tr>'
       '<tr><td>GET/PUT /api/auth/profile/</td><td>Profile, stats, avatar, display name</td></tr>'
       '<tr><td>/api/auth/save-match/ · match-history/</td><td>Record and list games</td></tr>'
       '<tr><td>/api/auth/friends/… · users/</td><td>Friends list management</td></tr>'
       '<tr><td>/api/auth/export-data/ · delete-account/</td><td>GDPR tools</td></tr>'
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

# ---------------------------------------------------------------- 05 Implementation
section("05", "Implementation &amp; Features")
left("photo-dev-screens.jpg", "Technology Stack",
     "Chosen for robustness, simplicity and the learning objectives of the curriculum.",
     cards([("Backend", "Python 3.11, Django 4.2, Django REST Framework, SimpleJWT, python-decouple for configuration"),
            ("Server", "Gunicorn with TLS on port 443 (self-signed certificate), WhiteNoise for hashed static files"),
            ("Database", "PostgreSQL 13 in its own container, accessed through the Django ORM and migrations"),
            ("Frontend", "Vanilla JavaScript SPA, HTML5, CSS3, Bootstrap 4.5"),
            ("3D graphics", "Three.js r128 (WebGL) for the Pong scene; HTML5 canvas for procedural textures"),
            ("DevOps", "Docker Compose, Makefile targets, Git / GitHub with pull requests")], 2))


def shots(title, intro, items, cols=2, tall=False):
    st = "max-height:4.55in;object-fit:contain;object-position:top" if not tall else "max-height:4.55in;object-fit:cover;object-position:top"
    figs = "".join(f'<figure><img src="{S(f, max_w=1100)}" style="{st}"><figcaption>{c}</figcaption></figure>' for f, c in items)
    full(title, f'<div class="figs" style="grid-template-columns:repeat({cols},1fr)">{figs}</div>', intro=intro)


shots("Features — Authentication and 2FA", "Email/password registration with a strong-password policy, 42 Intra login, and an emailed one-time code when 2FA is enabled.",
      [("03-login.jpg", "Login page: email / password or “Sign in with 42”"), ("04-register.jpg", "Registration with optional two-factor authentication"),
       ("19-2fa-modal.jpg", "Second factor: 6-digit code sent by email, valid 10 minutes")], 3)
shots("Features — Player Profile and Stats Dashboard", "Every finished game is recorded; the profile turns the history into a dashboard and the settings page holds the GDPR tools.",
      [("08-profile.jpg", "Games played, win rate chart, best score, recent matches, friends panel"), ("09-settings.jpg", "Display name, avatar, Download my data, Delete account")], 2, tall=True)
shots("Features — 3D Pong and the AI Opponent", "Three.js scene with a perspective camera, lit table and a spinning textured ball. In “Player vs AI” the PongAI samples the ball once per second, predicts where it will cross the paddle line and moves with a tunable error margin — no path-finding algorithm.",
      [("10-pong-mode-select.jpg", "Mode selection: Player vs Player (one keyboard) or Player vs AI"), ("11-pong-3d-vs-ai.jpg", "Game in progress against the AI — first to 3 points")], 2)
shots("Features — Tournaments (and the bonus Tic-Tac-Toe)", "A logged-in user creates a tournament of 3–8 nicknames; every pair plays once, scores update the table, and tied leaders get automatic tiebreaker matches.",
      [("14-tournament-view.jpg", "Round-robin schedule with “Start Match” per pairing and live scores"), ("12-tictactoe.jpg", "Bonus feature: local Tic-Tac-Toe, results saved to the match history")], 2)
shots("Features — Support on All Devices", "The same pages reflow for phones: hamburger navigation, stacked cards and a fluid game canvas.",
      [("16-mobile-home.jpg", "Home on a 390 px phone"), ("17-mobile-menu-open.jpg", "Hamburger menu"), ("18-mobile-profile.jpg", "Profile stacked vertically")], 3, tall=True)

# ---------------------------------------------------------------- 06 Security
section("06", "Security &amp; GDPR")
banner("banner-lock.jpg", "Cybersecurity Features",
       "Security was a fundamental requirement, addressed in layers from the database to the browser.",
       cards([("Password storage", "Django hashes and salts every password (PBKDF2); a validator enforces length, upper-case, digit and symbol."),
              ("2FA + JWT", "Optional emailed one-time code as a second factor; SimpleJWT access (60 min) and refresh (7 days) tokens."),
              ("42 OAuth", "Students log in through the 42 Intra; the server exchanges the code and never sees a password."),
              ("SQL injection", "All database access goes through the ORM, which parameterises every query."),
              ("CSRF &amp; XSS", "Django’s CSRF token is required on every state-changing request; user data is inserted with textContent."),
              ("Transport", "HTTPS everywhere — Gunicorn terminates TLS directly on port 443.")], 3))
left("photo-shield.jpg", "GDPR Compliance",
     "Users own their data: they can take it with them or erase the account — and inactive accounts are cleaned up automatically.",
     cards([("Local data management", "“Download my data” exports profile, statistics and full match history as JSON."),
            ("Account deletion", "Hard-deletes the account and everything attached to it in one click, after confirmation."),
            ("Inactive accounts", "A management command warns after 5 months of inactivity and deletes after 6 (last activity tracked by middleware).")], 2)
     + '<p class="note">The privacy policy on the About page describes the data collected, its use, retention and the user’s rights.</p>')

# ---------------------------------------------------------------- 07 Testing & evolution
section("07", "Testing &amp; Evolution")
banner("banner-team.jpg", "Testing Strategy",
       "Several levels of testing, each with its own focus, keep the application stable and secure.",
       cards([("Unit tests", "Django test suite — 17 tests covering login and the whole 2FA flow, GDPR export / delete, the inactive-account command and tournament tiebreakers (<code>make test</code>)."),
              ("Integration tests", "Scripted end-to-end API flow: register → login → profile → matches → friends → export → tournament → delete."),
              ("Browser walkthrough", "Headless Chrome drives every page on desktop and phone, plays both games and checks for JavaScript errors."),
              ("Manual / acceptance", "Team members continuously tested each other’s features from an end-user perspective.")], 4))
left("photo-code.jpg", "Pre-Evaluation Audit (August 2026)",
     "Before the evaluation the codebase was audited end-to-end. Two bugs reported by users were traced to their root causes and fixed with regression tests:",
     cards([("“The 2FA code is sometimes rejected”", "The one-time code was kept in Django’s default in-memory cache, which is private to each process — and Gunicorn runs three workers. The verification request often reached a worker that had never seen the code. Fix: a database-backed cache shared by all workers."),
            ("“The 2FA e-mail is very slow”", "The e-mail was sent synchronously inside the login request with no timeout, so the response waited for the whole SMTP round-trip (and failed with 500 on any error). Fix: send in a background thread with a 10 s timeout — login now answers in ~80 ms."),
            ("Also fixed", "<code>make test</code> configuration, stale static files, the token-refresh URL in the SPA, a settings-page bug that saved a placeholder display name, the Pong ball getting stuck gliding along the top/bottom wall (wall bounce now clamps the ball and keeps a minimum angle), and the previous account's avatar remaining visible after switching users."),
            ("Result", "17/17 tests pass, clean build from scratch verified, 0 JavaScript errors across the full browser walkthrough.")], 2))
banner("banner-meeting.jpg", "Challenges and Lessons Learned",
       "Building a complete application from scratch provided technical and organisational hurdles — and lasting lessons.",
       cards([("Tournament logic", "Generating fair schedules and resolving ties correctly required careful data modelling and state management."),
              ("State in vanilla JS", "Without a framework, login state, routing and views had to be managed by hand with disciplined code structure."),
              ("Asynchronous flows", "OAuth redirects, 2FA and API calls demanded a solid grasp of Promises and loading states."),
              ("Docker networking", "Getting the web and database containers, volumes and environment variables to cooperate took iteration."),
              ("Lessons", "A well-defined API, a mature framework, a disciplined Git workflow and security from day one all paid off.")], 5 if False else 3))
left("photo-future.jpg", "Limitations and Future Enhancements",
     "The current version meets every selected module; the following points are known limitations and the improvements we would make next.",
     '<div class="two">' + cards([("Known limitations", "Local multiplayer only (no online matchmaking); tournament API protected by CSRF but not by login; JWT stored in localStorage; "
                                    "the 42 OAuth flow has no <i>state</i> parameter; third-party assets load from CDNs; the 2FA mailbox needs a valid Gmail app password.")], 1)
     + cards([("Next steps", "1. Real-time online multiplayer and live chat with WebSockets (Django Channels). 2. Unified authentication on JWT with protected tournament endpoints. "
                             "3. OAuth <i>state</i> parameter and rate limiting on login / 2FA. 4. AI difficulty levels driven by the live score. 5. Leaderboards, achievements and 2FA recovery codes.")], 1) + '</div>')

# ---------------------------------------------------------------- 08 Team & conclusion
section("08", "Team &amp; Conclusion")
left("photo-team-table.jpg", "Contribution of Each Member",
     "Areas of responsibility derived from the Git history (commits, pull requests and files touched). Team: adjust the wording before presenting.",
     cards([("Salim Hamzaoui", "SPA architecture and routing, page templates and styling, integration of the Pong and Tic-Tac-Toe games, profile / friends / statistics UI, avatar upload, GDPR pages, HTTPS on port 443, OAuth redirect flow — 66 commits, most merges."),
            ("Nasser Alzaabi", "JWT authentication and the e-mail 2FA flow, 42 OAuth token exchange, Docker / port 443 configuration, match-result API and statistics for both games."),
            ("Alisher Abdullaev", "Profile page and user-settings API, display name and e-mail editing, account deletion, user model migrations, Gantt planning."),
            ("Nour Murat", "Tournaments app (models, views, URLs, templates and styles), round-robin scheduling and tiebreaker system, Pong integration for tournament matches.")], 2))
banner("banner-conclusion.jpg", "Conclusion",
       "Ft_transcendence delivered a feature-rich, secure and engaging web gaming platform that satisfies all the selected modules — "
       "6 Major and 7 Minor, 9.5 major-equivalents against the 7 required.",
       '<div class="two">'
       '<p class="intro">Using Django, a vanilla-JavaScript SPA, Three.js and PostgreSQL inside Docker, the team gained hands-on experience in full-stack development, '
       'deployment and application security. The Agile, feature-branch workflow kept four developers productive and the codebase reviewable.</p>'
       '<p class="intro">The modular structure is a solid base for the next evolution — real-time online play, richer AI and social features — '
       'while the pre-evaluation audit leaves the project with a green test suite and documented, root-caused fixes.</p></div>')
add(f'<section class="slide sec"><img class="bg" src="{A("bg-end.jpg", max_w=1600, q=70)}"><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><h1 style="font-size:64px">Thank You</h1></div></section>')

# ---------------------------------------------------------------- write & print
html = ['<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Capstone Project: Ft_Transcendence</title><style>' + CSS + '</style></head><body>']
for i, s in enumerate(slides, 1):
    html.append(s.replace("</section>", f'<div class="pn">{i} / {len(slides)}</div></section>', 1) if i > 1 else s)
html.append("</body></html>")
open(OUT_HTML, "w", encoding="utf-8").write("".join(html))
print("slides:", len(slides), "html:", os.path.getsize(OUT_HTML) // 1024, "KB")
if "--no-pdf" not in sys.argv:
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=10000",
                    f"--print-to-pdf={OUT_PDF}", "file:///" + OUT_HTML.replace("\\", "/")], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("pdf:", os.path.getsize(OUT_PDF) // 1024, "KB")
