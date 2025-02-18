from django.test import TestCase
from tournaments.models import Tournament, Player, Match

class TournamentTestCase(TestCase):
    def setUp(self):
        # Создаем тестовый турнир с 2 игроками
        self.tournament = Tournament.objects.create(name="Test Tournament", participants_count=2)
        self.player1 = Player.objects.create(tournament=self.tournament, nickname="Player1")
        self.player2 = Player.objects.create(tournament=self.tournament, nickname="Player2")
        self.match = Match.objects.create(tournament=self.tournament, player1=self.player1, player2=self.player2)

    def test_additional_match_for_two_players(self):
        # Завершаем основной матч с ничьей
        self.match.is_complete = True
        self.match.winner = None
        self.match.save()

        # Проверяем, создается ли дополнительный матч
        self.tournament.refresh_from_db()
        self.assertEqual(Match.objects.filter(tournament=self.tournament).count(), 2)  # Основной + доп. матч

    def test_additional_tournament_for_three_players(self):
        # Добавляем третьего игрока
        self.player3 = Player.objects.create(tournament=self.tournament, nickname="Player3")

        # Завершаем основной турнир с равным количеством очков
        Match.objects.create(tournament=self.tournament, player1=self.player1, player2=self.player2, is_complete=True, winner=self.player1)
        Match.objects.create(tournament=self.tournament, player1=self.player2, player2=self.player3, is_complete=True, winner=self.player2)
        Match.objects.create(tournament=self.tournament, player1=self.player3, player2=self.player1, is_complete=True, winner=self.player3)

        # Проверяем, создаются ли пары для дополнительного турнира
        self.tournament.refresh_from_db()
        additional_matches = Match.objects.filter(tournament=self.tournament).count()
        self.assertEqual(additional_matches, 6)  # 3 пары в круговом турнире
