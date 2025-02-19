#Create tournament

from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_protect
from itertools import combinations
from .models import Tournament, Match, Player
import json

def create_tournament(request):
    """Handle tournament creation for both full page and SPA"""
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        if request.method == 'POST':
            participants_count = int(request.POST.get('participants_count', 0))
            if 3 <= participants_count <= 8:
                tournament = Tournament.objects.create(participants_count=participants_count)
                return JsonResponse({
                    'success': True,
                    'redirect': f'/tournaments/{tournament.id}/add_players/'
                })
            return JsonResponse({'success': False, 'error': 'Invalid participant count'}, status=400)
        return JsonResponse({'success': True})
    
    # Regular page load
    return render(request, 'tournaments/create_tournament.html')

#Add players

def add_players(request, tournament_id):
    """Handle adding players for both full page and SPA"""
    tournament = get_object_or_404(Tournament, id=tournament_id)
    
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        if request.method == 'POST':
            try:
                nicknames = []
                for i in range(tournament.participants_count):
                    nickname = request.POST[f'nickname_{i}']
                    if nickname in nicknames:
                        return JsonResponse({
                            'success': False,
                            'error': f"The nickname '{nickname}' is already taken or repeated. Please use unique nicknames."
                        }, status=400)
                    nicknames.append(nickname)

                # Создаем игроков
                players = []
                for nickname in nicknames:
                    player = Player.objects.create(tournament=tournament, nickname=nickname)
                    players.append(player)

                # Генерируем пары матчей (круговая система)
                for player1, player2 in combinations(players, 2):
                    Match.objects.create(tournament=tournament, player1=player1, player2=player2)

                return JsonResponse({
                    'success': True,
                    'redirect': f'/tournaments/{tournament_id}/'
                })
            except Exception as e:
                return JsonResponse({'success': False, 'error': str(e)}, status=400)
        return JsonResponse({
            'success': True,
            'tournament': {
                'id': tournament.id,
                'participants_count': tournament.participants_count
            }
        })
    
    # Regular page load
    return render(request, 'tournaments/add_players.html', {
        'tournament': tournament,
        'range': range(tournament.participants_count)
    })

# View tournament

def view_tournament(request, tournament_id):
    """Handle tournament view for both full page and SPA"""
    tournament = get_object_or_404(Tournament, id=tournament_id)
    
    # Prepare common data
    context = prepare_tournament_context(tournament)
    
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        # Convert context data to JSON-safe format
        return JsonResponse({
            'success': True,
            'tournament': context
        })
    
    # Regular page load
    return render(request, 'tournaments/view_tournament.html', context)

def prepare_tournament_context(tournament):
    """Helper function to prepare tournament context for both view types"""
    players = tournament.players.all()
    regular_matches = tournament.matches.filter(is_additional=False)
    additional_matches = tournament.matches.filter(is_additional=True)
    player_scores = {player.nickname: player.get_score() for player in players}
    
    return {
        'tournament': tournament,
        'players': [p.nickname for p in players],
        'player_scores': player_scores,
        'regular_matches': [{
            'id': match.id,
            'player1': match.player1.nickname,
            'player2': match.player2.nickname,
            'score_player1': match.score_player1,
            'score_player2': match.score_player2,
            'winner': match.winner.nickname if match.winner else None,
            'is_complete': match.is_complete
        } for match in regular_matches],
        'additional_matches': [{
            'id': match.id,
            'player1': match.player1.nickname,
            'player2': match.player2.nickname,
            'score_player1': match.score_player1,
            'score_player2': match.score_player2,
            'winner': match.winner.nickname if match.winner else None,
            'is_complete': match.is_complete
        } for match in additional_matches],
        'has_additional_matches': additional_matches.exists(),
        'status': tournament.get_status(),
        'winner': tournament.get_winner().nickname if tournament.get_winner() and not isinstance(tournament.get_winner(), list) else None,
        'winners': [w.nickname for w in tournament.get_winner()] if isinstance(tournament.get_winner(), list) else None,
    }

# start match

@csrf_protect
@require_POST
def start_match(request, match_id):
    try:
        match = Match.objects.get(id=match_id)
        if not match.is_complete:
            tournament = match.tournament
            return JsonResponse({
                'success': True,
                'match_id': match_id,
                'tournament_id': tournament.id,
                'player1': match.player1.nickname,
                'player2': match.player2.nickname
            })
        else:
            return JsonResponse({
                'success': False,
                'message': 'Match is already completed'
            })
    except Match.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'Match not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': str(e)
        }, status=500)


# Логика для создания и отображения дополнительных матчей
def create_additional_matches(tournament, top_players):
    from itertools import combinations
    # Create matches only between top players
    for player1, player2 in combinations(top_players, 2):
        Match.objects.create(
            tournament=tournament,
            player1=player1,
            player2=player2,
            is_additional=True  # Mark as additional match
        )

def get_match_details(request, game_id):
    # Retrieve the match; return a 404 error if it doesn't exist
    match = get_object_or_404(Match, id=game_id)
    
    # Prepare the response dictionary
    details = {
        'player1': match.player1.nickname,
        'player2': match.player2.nickname,
        'score_player1': match.score_player1,
        'score_player2': match.score_player2,
        'winner': match.winner.nickname if match.winner else None,
        'is_complete': match.is_complete
    }
    
    return JsonResponse(details)

@require_POST
def finish_match(request, match_id):
    try:
        match = Match.objects.get(id=match_id)
        data = json.loads(request.body)
        
        match.score_player1 = data['score_player1']
        match.score_player2 = data['score_player2']
        
        # Определяем победителя
        if data['score_player1'] > data['score_player2']:
            match.winner = match.player1
        else:
            match.winner = match.player2
            
        match.is_complete = True
        match.save()
        
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': str(e)
        }, status=500)