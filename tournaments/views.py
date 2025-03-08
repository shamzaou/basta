# tournaments/views.py

from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_protect, csrf_exempt
from django.shortcuts import get_object_or_404
import json
from itertools import combinations
from .models import Tournament, Player, Match

def create_additional_matches(tournament, top_players):
    """Создает дополнительные матчи между игроками с одинаковым количеством очков."""
    for player1, player2 in combinations(top_players, 2):
        Match.objects.create(
            tournament=tournament,
            player1=player1,
            player2=player2,
            is_additional=True
        )

@require_POST
def create_tournament(request):
    """
    Создает турнир с указанным числом участников (participants_count).
    При успехе -> { "success": true, "tournament_id": <int> }
    При ошибке -> { "success": false, "error": "...", status=400 }
    """
    try:
        print("Request received at create_tournament")
        data = json.loads(request.body)
        participants_count = int(data['participants_count'])
        if 3 <= participants_count <= 8:
            tournament = Tournament.objects.create(participants_count=participants_count)
            return JsonResponse({'success': True, 'tournament_id': tournament.id})
        return JsonResponse({'success': False, 'error': 'participants_count must be between 3 and 8'}, status=400)
    except (KeyError, ValueError, json.JSONDecodeError):
        return JsonResponse({'success': False, 'error': 'Invalid data'}, status=400)

# @csrf_exempt
@require_POST
def add_players(request, tournament_id):
    """
    Добавляет всех игроков (nicknames) за один раз.
    Тело запроса: { "nicknames": ["Alice", "Bob", ...] }
    При успехе -> { "success": true }
    При ошибке -> { "success": false, "error": "...", status=400 }
    """
    tournament = get_object_or_404(Tournament, id=tournament_id)
    try:
        data = json.loads(request.body)
        nicknames = data['nicknames']
        # Проверяем, что количество ников соответствует participants_count
        if len(nicknames) != tournament.participants_count:
            return JsonResponse({'success': False, 'error': 'Number of nicknames must match participants_count'}, status=400)
        
        # Проверяем дубли
        if len(set(nicknames)) != len(nicknames):
            return JsonResponse({'success': False, 'error': 'Duplicate nicknames detected'}, status=400)
        
        # Создаём объекты Player
        players = []
        for nickname in nicknames:
            player = Player.objects.create(tournament=tournament, nickname=nickname)
            players.append(player)
        
        # Генерируем все матчи в стиле "каждый с каждым"
        for p1, p2 in combinations(players, 2):
            Match.objects.create(tournament=tournament, player1=p1, player2=p2)
        
        return JsonResponse({'success': True})
    except (KeyError, ValueError, json.JSONDecodeError):
        return JsonResponse({'success': False, 'error': 'Invalid data'}, status=400)

def view_tournament(request, tournament_id):
    """
    Возвращает JSON с информацией о турнире (статус, участники, матчи, потенциальные победители).
    """
    tournament = get_object_or_404(Tournament, id=tournament_id)
    players = tournament.players.all()
    matches = tournament.matches.all()
    
    # Считаем очки
    player_scores = {p.id: p.get_score() for p in players}
    
    # Проверяем, возможно ли несколько победителей (возвращаем список)
    winner = tournament.get_winner()
    if isinstance(winner, list):
        winner_ids = [w.id for w in winner]
    else:
        winner_ids = [winner.id] if winner else []
    
    data = {
        'tournament': {
            'id': tournament.id,
            'status': tournament.get_status(),
            'winner_ids': winner_ids
        },
        'players': [
            {'id': p.id, 'nickname': p.nickname, 'score': player_scores[p.id]}
            for p in players
        ],
        'matches': [
            {
                'id': m.id,
                'player1': m.player1.id,
                'player2': m.player2.id,
                'score_player1': m.score_player1 if m.score_player1 is not None else 0,
                'score_player2': m.score_player2 if m.score_player2 is not None else 0,
                'winner': m.winner.id if m.winner else None,
                'is_complete': m.is_complete,
                'is_additional': m.is_additional
            }
            for m in matches
        ]
    }
    return JsonResponse(data)

@csrf_protect
@require_POST
def start_match(request, match_id):
    """
    Начинает матч, если он не завершён. Возвращает данные для фронта:
    {
      "success": true,
      "match_id": ...,
      "tournament_id": ...,
      "player1": "...",
      "player2": "..."
    }
    """
    try:
        match = Match.objects.get(id=match_id)
        if match.is_complete:
            return JsonResponse({'success': False, 'message': 'Match is already completed'})
        
        tournament = match.tournament
        return JsonResponse({
            'success': True,
            'match_id': match_id,
            'tournament_id': tournament.id,
            'player1': match.player1.nickname,
            'player2': match.player2.nickname
        })
    except Match.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Match not found'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)

def get_match_details(request, game_id):
    """
    Возвращает детали указанного матча (player1, player2, score_player1, score_player2, winner).
    """
    match = get_object_or_404(Match, id=game_id)
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
    """
    Завершает матч, проставляет счёт и победителя.
    Тело запроса: { "score_player1": 5, "score_player2": 3 }
    """
    try:
        match = Match.objects.get(id=match_id)
        
        # Проверяем, не завершён ли матч уже
        if match.is_complete:
            return JsonResponse({'success': False, 'message': 'Match is already completed'}, status=400)
        
        data = json.loads(request.body)
        match.score_player1 = data['score_player1']
        match.score_player2 = data['score_player2']
        
        if data['score_player1'] > data['score_player2']:
            match.winner = match.player1
        elif data['score_player1'] < data['score_player2']:
            match.winner = match.player2
        else:
            match.winner = None  # Ничья (на всякий случай)
        
        match.is_complete = True
        match.save()
        
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@require_POST
def update_match_state(request, match_id):
    match = get_object_or_404(Match, id=match_id)
    try:
        data = json.loads(request.body)
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=400)

