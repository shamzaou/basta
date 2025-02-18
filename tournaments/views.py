#Create tournament

from django.shortcuts import render, redirect
from .models import Tournament
from django.http import JsonResponse
from django.views.decorators.http import require_POST
import json
from django.views.decorators.csrf import csrf_protect

# from  pong import templates

def create_tournament(request):
    if request.method == 'POST':
        participants_count = int(request.POST['participants_count'])
        if 3 <= participants_count <= 8:
            tournament = Tournament.objects.create(participants_count=participants_count)
            return redirect('tournaments:add_players', tournament_id=tournament.id)
        else:
            return render(request, 'tournaments/create_tournament.html', {'error': 'Please enter a number between 3 and 8.'})
    return render(request, 'tournaments/create_tournament.html')


#Add players
from itertools import combinations
from .models import Match, Player

def add_players(request, tournament_id):
    tournament = get_object_or_404(Tournament, id=tournament_id)
    if request.method == 'POST':
        nicknames = []
        for i in range(tournament.participants_count):
            nickname = request.POST[f'nickname_{i}']
            if nickname in nicknames:
            # if nickname in nicknames or Player.objects.filter(nickname=nickname).exists():
                return render(request, 'tournaments/add_players.html', {
                    'tournament': tournament,
                    'range': range(tournament.participants_count),
                    'error': f"The nickname '{nickname}' is already taken or repeated. Please use unique nicknames."
                })
            nicknames.append(nickname)

        # Создаем игроков
        players = []
        for nickname in nicknames:
            player = Player.objects.create(tournament=tournament, nickname=nickname)
            players.append(player)

        # Генерируем пары матчей (круговая система)
        for player1, player2 in combinations(players, 2):
            Match.objects.create(tournament=tournament, player1=player1, player2=player2)

        return redirect('tournaments:view_tournament', tournament_id=tournament.id)
    return render(request, 'tournaments/add_players.html', {
        'tournament': tournament,
        'range': range(tournament.participants_count)
    })



# View tournament
from django.shortcuts import render, get_object_or_404
from .models import Tournament, Player, Match

def view_tournament(request, tournament_id):
    tournament = get_object_or_404(Tournament, id=tournament_id)
    players = tournament.players.all()
    
    regular_matches = tournament.matches.filter(is_additional=False)
    additional_matches = tournament.matches.filter(is_additional=True)
    
    player_scores = {player: player.get_score() for player in players}
    
    all_regular_complete = not regular_matches.filter(is_complete=False).exists()
    
    # Check if additional matches are needed only if we don't already have them
    need_additional_matches = False
    if all_regular_complete and not additional_matches.exists():
        max_score = max(score for score in player_scores.values())
        top_players = [player for player, score in player_scores.items() if score == max_score]
        if len(top_players) > 1:
            need_additional_matches = True
            create_additional_matches(tournament, top_players)
            additional_matches = tournament.matches.filter(is_additional=True)

    status = tournament.get_status()
    winner = tournament.get_winner()
    
    # Handle multiple winners
    winners = []
    if isinstance(winner, list):
        winners = winner
        winner = None

    context = {
        'tournament': tournament,
        'players': players,
        'player_scores': player_scores,
        'regular_matches': regular_matches,
        'additional_matches': additional_matches,
        'has_additional_matches': additional_matches.exists(),
        'status': status,
        'winner': winner,
        'winners': winners,
    }
    return render(request, 'tournaments/view_tournament.html', context)

# start match
from django.shortcuts import get_object_or_404, redirect
from .models import Match

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