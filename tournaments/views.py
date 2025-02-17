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
    # Получаем данные турнира
    tournament = get_object_or_404(Tournament, id=tournament_id)
    players = tournament.players.all()

    # Получаем все матчи турнира
    matches = tournament.matches.all()
    # get match details
    # matche = Match.objects.all()
    # print(matche)

    # Очки игроков
    player_scores = {player: player.get_score() for player in players}

    # Статус турнира
    status = tournament.get_status()

    # Проверяем, завершены ли все матчи
    if status == "(completed)":
        # Проверяем, нужен ли дополнительный турнир
        if not Match.objects.filter(tournament=tournament, is_complete=False).exists():
            create_additional_matches(tournament)

    # Победитель
    winner = tournament.get_winner()

    # Формируем данные для отображения
    context = {
        'tournament': tournament,
        'players': players,
        'player_scores': player_scores,
        'matches': matches,
        'status': status,
        'winner': winner,
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
def create_additional_matches(tournament):
    players = tournament.players.all()
    max_score = max(player.get_score() for player in players)
    top_players = [player for player in players if player.get_score() == max_score]

    # Если два игрока, создаем один матч
    if len(top_players) == 2:
        Match.objects.create(
            tournament=tournament,
            player1=top_players[0],
            player2=top_players[1],
        )

    # Если три и более, создаем круговой турнир
    elif len(top_players) > 2:
        from itertools import combinations
        for player1, player2 in combinations(top_players, 2):
            Match.objects.create(
                tournament=tournament,
                player1=player1,
                player2=player2,
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