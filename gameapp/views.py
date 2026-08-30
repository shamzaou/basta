# gameapp/views.py
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.shortcuts import render
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from userapp.models import MatchHistory
from userapp.views import build_profile_summary
from .models import TicTacToeQueue, TicTacToeMatch


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


# ---------------------------------------------------------------------------
# Online TicTacToe matchmaking API (/api/game/ttt/...)
# ---------------------------------------------------------------------------

QUEUE_STALE_SECONDS = 60


def ttt_rating(user):
    """TicTacToe win rate in percent; 50 for players without history."""
    games = MatchHistory.objects.filter(user=user, game_type='TICTACTOE')
    total = games.count()
    if total == 0:
        return 50.0
    return round(games.filter(result='WIN').count() * 100.0 / total, 1)


def _player_info(user):
    return {'username': user.username, 'display_name': user.display_name or user.username}


def match_state(match, user):
    return {
        'id': match.id,
        'board': match.board,
        'turn': match.turn,
        'status': match.status,
        'winner': match.winner,
        'players': {'X': _player_info(match.player_x), 'O': _player_info(match.player_o)},
        'you': match.symbol_of(user),
        'updated_at': match.updated_at.isoformat(),
    }


def _active_match_for(user):
    return TicTacToeMatch.objects.filter(status='active').filter(Q(player_x=user) | Q(player_o=user)).first()


def _record_result(match):
    """Write one MatchHistory row per player once a match is finished."""
    x, o = match.player_x, match.player_o
    if match.winner == 'X':
        rows = [(x, o, 'WIN', '1-0'), (o, x, 'LOSS', '0-1')]
    elif match.winner == 'O':
        rows = [(o, x, 'WIN', '1-0'), (x, o, 'LOSS', '0-1')]
    else:
        rows = [(x, o, 'DRAW', '0-0'), (o, x, 'DRAW', '0-0')]
    for user, opponent, result, score in rows:
        MatchHistory.objects.create(user=user, game_type='TICTACTOE', opponent=opponent.username,
                                    result=result, score=score)


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def ttt_queue(request):
    user = request.user
    if request.method == 'DELETE':
        TicTacToeQueue.objects.filter(user=user).delete()
        return Response({'status': 'left'})

    with transaction.atomic():
        active = _active_match_for(user)
        if active:
            return Response({'status': 'matched', 'match_id': active.id, 'symbol': active.symbol_of(user)})

        cutoff = timezone.now() - timedelta(seconds=QUEUE_STALE_SECONDS)
        TicTacToeQueue.objects.filter(joined_at__lt=cutoff).delete()

        my_rating = ttt_rating(user)
        candidates = list(TicTacToeQueue.objects.select_for_update()
                          .filter(user__is_active=True).exclude(user=user).select_related('user'))
        if candidates:
            best = min(candidates, key=lambda q: (abs(q.rating - my_rating), q.joined_at))
            match = TicTacToeMatch.objects.create(player_x=best.user, player_o=user)
            TicTacToeQueue.objects.filter(user__in=[best.user, user]).delete()
            return Response({'status': 'matched', 'match_id': match.id, 'symbol': 'O'})

        TicTacToeQueue.objects.update_or_create(user=user, defaults={'rating': my_rating})
        return Response({'status': 'waiting', 'queued': TicTacToeQueue.objects.count()})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ttt_match(request, match_id):
    try:
        match = TicTacToeMatch.objects.select_related('player_x', 'player_o').get(id=match_id)
    except TicTacToeMatch.DoesNotExist:
        return Response({'error': 'Match not found'}, status=404)
    if match.symbol_of(request.user) is None:
        return Response({'error': 'Not a participant'}, status=403)
    return Response(match_state(match, request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ttt_move(request, match_id):
    try:
        cell = int(request.data.get('cell'))
    except (TypeError, ValueError):
        return Response({'error': 'cell must be an integer 0-8'}, status=400)
    if not 0 <= cell <= 8:
        return Response({'error': 'cell must be an integer 0-8'}, status=400)

    with transaction.atomic():
        try:
            match = (TicTacToeMatch.objects.select_for_update()
                     .select_related('player_x', 'player_o').get(id=match_id))
        except TicTacToeMatch.DoesNotExist:
            return Response({'error': 'Match not found'}, status=404)
        symbol = match.symbol_of(request.user)
        if symbol is None:
            return Response({'error': 'Not a participant'}, status=403)
        if match.status != 'active':
            return Response({'error': 'Match is finished', **match_state(match, request.user)}, status=400)
        if match.turn != symbol:
            return Response({'error': 'Not your turn'}, status=400)
        if match.board[cell] != '.':
            return Response({'error': 'Cell already taken'}, status=400)

        board = list(match.board)
        board[cell] = symbol
        match.board = ''.join(board)
        winner = match.check_winner()
        if winner:
            match.winner = winner
            match.status = 'finished'
        elif '.' not in match.board:
            match.status = 'finished'          # draw
        else:
            match.turn = 'O' if symbol == 'X' else 'X'
        match.save()
        if match.status == 'finished':
            _record_result(match)
    return Response(match_state(match, request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ttt_leave(request, match_id):
    """Forfeit: the other player wins."""
    with transaction.atomic():
        try:
            match = (TicTacToeMatch.objects.select_for_update()
                     .select_related('player_x', 'player_o').get(id=match_id))
        except TicTacToeMatch.DoesNotExist:
            return Response({'error': 'Match not found'}, status=404)
        symbol = match.symbol_of(request.user)
        if symbol is None:
            return Response({'error': 'Not a participant'}, status=403)
        if match.status == 'active':
            match.winner = 'O' if symbol == 'X' else 'X'
            match.status = 'finished'
            match.save()
            _record_result(match)
    TicTacToeQueue.objects.filter(user=request.user).delete()
    return Response(match_state(match, request.user))
