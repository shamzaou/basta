# gameapp/views.py

from django.db.models import Q
from django.shortcuts import render

from userapp.models import MatchHistory
from userapp.views import build_profile_summary


# ---------------------------------------------------------------------------
# SPA entry point with server-side rendering of the initial view (SSR module).
# The template receives which page to show, a title/description for that page
# and, for logged-in users, the profile data so the HTML is complete before
# script.js runs.
# ---------------------------------------------------------------------------

SSR_PAGES = {
    'home': ('FAST_PONG — 3D Pong, tournaments and more', 'Play 3D Pong against friends or the AI, run tournaments and track your stats.'),
    'about': ('FAST_PONG — About', 'About the FAST_PONG project, the team, the technologies and our privacy policy.'),
    'login': ('FAST_PONG — Log in', 'Log in to FAST_PONG with your email or your 42 account.'),
    'register': ('FAST_PONG — Register', 'Create your FAST_PONG account.'),
    'profile': ('FAST_PONG — Player Profile', 'Your statistics, match history and friends.'),
    'settings': ('FAST_PONG — User Settings', 'Update your display name, avatar, security and privacy settings.'),
    'game': ('FAST_PONG — Pong', 'Play 3D Pong: two players on one keyboard or against the AI.'),
    'tictactoe': ('FAST_PONG — TicTacToe', 'Play TicTacToe locally or find an online opponent.'),
    'tournament': ('FAST_PONG — Tournament', 'Create a round-robin Pong tournament and follow the matches.'),
}
LOGIN_REQUIRED_PAGES = {'profile', 'settings', 'game', 'tictactoe', 'tournament'}


def index(request):
    segment = request.path.strip('/').split('/')[0].lower()
    page = segment if segment in SSR_PAGES else 'home'
    logged_in = request.user.is_authenticated
    if page in LOGIN_REQUIRED_PAGES and not logged_in:
        page = 'login'
    title, description = SSR_PAGES[page]
    profile = None
    if logged_in:
        profile = build_profile_summary(request.user)
        for m in profile['match_history']:
            m['date_display'] = m['date_played'].strftime('%d %b %Y')
    return render(request, 'frontend/index.html', {
        'ssr_page': page,
        'ssr_title': title,
        'ssr_description': description,
        'ssr_logged_in': logged_in,
        'ssr_profile': profile,
    })



QUEUE_STALE_SECONDS = 60
