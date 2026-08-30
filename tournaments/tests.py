from django.test import TestCase, Client
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

        # Tiebreaker matches are created lazily by Tournament.get_winner()
        # (called from the view_tournament endpoint), not by a signal on save.
        self.tournament.refresh_from_db()
        winners = self.tournament.get_winner()
        self.assertEqual(len(winners), 2)  # still tied -> list of tied players
        self.assertEqual(Match.objects.filter(tournament=self.tournament).count(), 2)  # Основной + доп. матч

    def test_additional_tournament_for_three_players(self):
        # Добавляем третьего игрока (and drop the 2-player match from setUp so the
        # round-robin below is the whole tournament)
        self.match.delete()
        self.player3 = Player.objects.create(tournament=self.tournament, nickname="Player3")

        # Завершаем основной турнир с равным количеством очков
        Match.objects.create(tournament=self.tournament, player1=self.player1, player2=self.player2, is_complete=True, winner=self.player1)
        Match.objects.create(tournament=self.tournament, player1=self.player2, player2=self.player3, is_complete=True, winner=self.player2)
        Match.objects.create(tournament=self.tournament, player1=self.player3, player2=self.player1, is_complete=True, winner=self.player3)

        # Проверяем, создаются ли пары для дополнительного турнира
        self.tournament.refresh_from_db()
        winners = self.tournament.get_winner()
        self.assertEqual(len(winners), 3)
        additional_matches = Match.objects.filter(tournament=self.tournament).count()
        self.assertEqual(additional_matches, 6)  # 3 пары в круговом турнире
        self.assertEqual(Match.objects.filter(tournament=self.tournament, is_additional=True).count(), 3)

    def test_single_winner_creates_no_tiebreaker(self):
        self.match.is_complete = True
        self.match.winner = self.player1
        self.match.save()
        self.assertEqual(self.tournament.get_winner(), self.player1)
        self.assertEqual(Match.objects.filter(tournament=self.tournament, is_additional=True).count(), 0)


class TournamentApiValidationTests(TestCase):
    """Aug-2026 bug sweep: #10 add_players validation, #11 finish_match scores."""

    def setUp(self):
        self.client = Client()
        self.t = Tournament.objects.create(name="T", participants_count=3)
        self.url = f'/tournaments/api/tournaments/{self.t.id}/add_players/'

    def add(self, names):
        return self.client.post(self.url, {'nicknames': names}, content_type='application/json')

    def test_blank_and_long_nicknames_rejected(self):
        self.assertEqual(self.add(['a', '   ', 'c']).json()['error'], 'Nicknames cannot be empty')
        self.assertEqual(self.add(['a', 'b', 'x' * 60]).json()['error'], 'Nickname too long (max 50)')
        self.assertEqual(Player.objects.filter(tournament=self.t).count(), 0)

    def test_players_can_only_be_added_once_and_are_stripped(self):
        r = self.add([' a ', 'b', 'c'])
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(sorted(Player.objects.filter(tournament=self.t).values_list('nickname', flat=True)), ['a', 'b', 'c'])
        self.assertEqual(Match.objects.filter(tournament=self.t).count(), 3)
        r = self.add(['d', 'e', 'f'])
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json()['error'], 'Players already added')
        self.assertEqual(Player.objects.filter(tournament=self.t).count(), 3)

    def test_finish_match_scores(self):
        self.add(['a', 'b', 'c'])
        m = Match.objects.filter(tournament=self.t).first()
        finish = lambda body, mid=m.id: self.client.post(f'/tournaments/api/tournaments/{mid}/finish/', body, content_type='application/json')
        self.assertEqual(finish({'score_player1': 'x', 'score_player2': 1}).status_code, 400)
        self.assertEqual(finish({'score_player1': -1, 'score_player2': 1}).status_code, 400)
        self.assertEqual(finish({'score_player1': 2, 'score_player2': 2}).json()['message'], 'Scores cannot be equal')
        r = finish({'score_player1': '10', 'score_player2': '9'})   # strings must not be compared lexicographically
        self.assertEqual(r.status_code, 200, r.content)
        m.refresh_from_db()
        self.assertEqual((m.score_player1, m.score_player2, m.winner), (10, 9, m.player1))
        self.assertEqual(finish({'score_player1': 1, 'score_player2': 0}).status_code, 400)  # already completed


class RepeatedTiebreakerTests(TestCase):
    """Aug-2026 bug sweep #9: a tie after the tiebreaker round must trigger another round."""

    def setUp(self):
        self.t = Tournament.objects.create(name="T", participants_count=3)
        self.a, self.b, self.c = (Player.objects.create(tournament=self.t, nickname=n) for n in "abc")
        for p1, p2 in ((self.a, self.b), (self.b, self.c), (self.c, self.a)):
            Match.objects.create(tournament=self.t, player1=p1, player2=p2, is_complete=True, winner=p1)

    def _play_round(self, wins_for):
        for m in Match.objects.filter(tournament=self.t, is_additional=True, is_complete=False).order_by('id'):
            m.winner = wins_for(m); m.is_complete = True
            m.score_player1, m.score_player2 = (3, 0) if m.winner == m.player1 else (0, 3)
            m.save()

    def test_second_round_created_when_tiebreak_ties_again(self):
        w = self.t.get_winner()
        self.assertEqual(len(w), 3)
        self.assertEqual(Match.objects.filter(tournament=self.t, is_additional=True).count(), 3)
        self.t.get_winner()   # repeated GET must not create duplicates
        self.assertEqual(Match.objects.filter(tournament=self.t, is_additional=True).count(), 3)
        cyclic = {frozenset((self.a, self.b)): self.a, frozenset((self.b, self.c)): self.b, frozenset((self.c, self.a)): self.c}
        self._play_round(lambda m: cyclic[frozenset((m.player1, m.player2))])   # a>b, b>c, c>a -> still tied
        w = self.t.get_winner()
        self.assertEqual(len(w), 3)
        self.assertEqual(Match.objects.filter(tournament=self.t, is_additional=True).count(), 6)
        self.assertEqual(Match.objects.filter(tournament=self.t, is_additional=True, is_complete=True).count(), 3)  # first round kept
        self.assertEqual(self.t.get_status(), "Incomplete")
        self._play_round(lambda m: self.a if self.a in (m.player1, m.player2) else m.player1)   # a wins its two
        self.assertEqual(self.t.get_winner(), self.a)
        self.assertEqual(Match.objects.filter(tournament=self.t, is_additional=True).count(), 6)
        self.assertEqual(self.t.get_status(), "Complete")

    def test_decided_round_gives_single_winner(self):
        self.t.get_winner()
        self._play_round(lambda m: self.b if self.b in (m.player1, m.player2) else m.player1)
        self.assertEqual(self.t.get_winner(), self.b)
        self.assertEqual(Match.objects.filter(tournament=self.t, is_additional=True).count(), 3)
