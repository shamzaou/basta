"""Tests for the online TicTacToe matchmaking API and the server-side rendered index page."""
from datetime import timedelta

from django.test import TestCase, Client
from django.utils import timezone

from userapp.models import User, MatchHistory
from .models import TicTacToeQueue, TicTacToeMatch

PW = 'Str0ng!Passw0rd'


def mk(name, **extra):
    return User.objects.create_user(username=name, email=f'{name}@example.com', password=PW, **extra)


def client_for(user):
    c = Client()
    c.force_login(user)
    return c


class MatchmakingTests(TestCase):
    def setUp(self):
        self.a, self.b, self.c = mk('ann'), mk('ben'), mk('cid')
        self.ca, self.cb, self.cc = client_for(self.a), client_for(self.b), client_for(self.c)

    def queue(self, c):
        return c.post('/api/game/ttt/queue/')

    def test_two_users_get_paired_and_find_the_same_match(self):
        r = self.queue(self.ca)
        self.assertEqual(r.json()['status'], 'waiting')
        self.assertEqual(TicTacToeQueue.objects.count(), 1)
        r = self.queue(self.cb)
        self.assertEqual(r.json()['status'], 'matched')
        self.assertEqual(r.json()['symbol'], 'O')
        mid = r.json()['match_id']
        self.assertEqual(TicTacToeQueue.objects.count(), 0)
        # the waiting player polls again and learns about the match
        r = self.queue(self.ca)
        self.assertEqual(r.json(), {'status': 'matched', 'match_id': mid, 'symbol': 'X'})
        state = self.ca.get(f'/api/game/ttt/match/{mid}/').json()
        self.assertEqual(state['players']['X']['username'], 'ann')
        self.assertEqual(state['players']['O']['username'], 'ben')
        self.assertEqual(state['you'], 'X')
        self.assertEqual(state['turn'], 'X')

    def test_closest_rating_is_chosen(self):
        for _ in range(4):
            MatchHistory.objects.create(user=self.a, game_type='TICTACTOE', opponent='x', result='WIN', score='1-0')
        for _ in range(4):
            MatchHistory.objects.create(user=self.c, game_type='TICTACTOE', opponent='x', result='LOSS', score='0-1')
        # ann rating 100, cid rating 0, ben (joiner) has no history -> 50: tie broken by who waited longest
        MatchHistory.objects.create(user=self.b, game_type='TICTACTOE', opponent='x', result='WIN', score='1-0')
        MatchHistory.objects.create(user=self.b, game_type='TICTACTOE', opponent='x', result='WIN', score='1-0')
        MatchHistory.objects.create(user=self.b, game_type='TICTACTOE', opponent='x', result='LOSS', score='0-1')
        # ben = 66.7 -> closest is ann (100) over cid (0). Two users can only be waiting at the
        # same time if they queued while nobody else was there, so seed the queue directly.
        TicTacToeQueue.objects.create(user=self.a, rating=100.0)
        TicTacToeQueue.objects.create(user=self.c, rating=0.0)
        r = self.queue(self.cb)
        self.assertEqual(r.json()['status'], 'matched')
        match = TicTacToeMatch.objects.get(id=r.json()['match_id'])
        self.assertEqual(match.player_x, self.a)
        self.assertEqual(TicTacToeQueue.objects.get().user, self.c)   # cid keeps waiting

    def test_stale_queue_entry_is_ignored(self):
        self.queue(self.ca)
        TicTacToeQueue.objects.filter(user=self.a).update(joined_at=timezone.now() - timedelta(seconds=120))
        r = self.queue(self.cb)
        self.assertEqual(r.json()['status'], 'waiting')
        self.assertFalse(TicTacToeQueue.objects.filter(user=self.a).exists())

    def test_leave_queue(self):
        self.queue(self.ca)
        self.assertEqual(self.ca.delete('/api/game/ttt/queue/').json()['status'], 'left')
        self.assertEqual(TicTacToeQueue.objects.count(), 0)

    def test_requires_login(self):
        self.assertIn(Client().post('/api/game/ttt/queue/').status_code, (401, 403))


class MatchPlayTests(TestCase):
    def setUp(self):
        self.x, self.o, self.other = mk('xena'), mk('oscar'), mk('zed')
        self.cx, self.co, self.cz = client_for(self.x), client_for(self.o), client_for(self.other)
        self.m = TicTacToeMatch.objects.create(player_x=self.x, player_o=self.o)
        self.url = f'/api/game/ttt/match/{self.m.id}/'

    def move(self, c, cell):
        return c.post(self.url + 'move/', {'cell': cell}, content_type='application/json')

    def test_non_participant_forbidden(self):
        self.assertEqual(self.cz.get(self.url).status_code, 403)
        self.assertEqual(self.move(self.cz, 0).status_code, 403)

    def test_move_validation(self):
        self.assertEqual(self.move(self.co, 0).json()['error'], 'Not your turn')
        self.assertEqual(self.move(self.cx, 0).status_code, 200)
        self.assertEqual(self.move(self.co, 0).json()['error'], 'Cell already taken')
        self.assertEqual(self.move(self.co, 9).status_code, 400)
        self.assertEqual(self.move(self.co, 'x').status_code, 400)

    def test_win_records_history_for_both(self):
        for cx, co in ((0, 3), (1, 4)):
            self.move(self.cx, cx); self.move(self.co, co)
        r = self.move(self.cx, 2)
        self.assertEqual(r.json()['status'], 'finished')
        self.assertEqual(r.json()['winner'], 'X')
        hx = MatchHistory.objects.get(user=self.x)
        ho = MatchHistory.objects.get(user=self.o)
        self.assertEqual((hx.game_type, hx.opponent, hx.result, hx.score), ('TICTACTOE', 'oscar', 'WIN', '1-0'))
        self.assertEqual((ho.opponent, ho.result, ho.score), ('xena', 'LOSS', '0-1'))
        self.assertEqual(self.move(self.co, 5).status_code, 400)   # finished

    def test_draw(self):
        # X: 0 1 5 6 8 / O: 2 3 4 7  -> full board, no line
        seq = [(self.cx, 0), (self.co, 2), (self.cx, 1), (self.co, 3), (self.cx, 5), (self.co, 4), (self.cx, 6), (self.co, 7), (self.cx, 8)]
        for c, cell in seq:
            r = self.move(c, cell)
            self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()['status'], 'finished')
        self.assertEqual(r.json()['winner'], '')
        self.assertEqual(set(MatchHistory.objects.values_list('result', flat=True)), {'DRAW'})

    def test_forfeit(self):
        r = self.cx.post(self.url + 'leave/')
        self.assertEqual(r.json()['winner'], 'O')
        self.assertEqual(MatchHistory.objects.get(user=self.o).result, 'WIN')
        self.assertEqual(MatchHistory.objects.get(user=self.x).result, 'LOSS')

    def test_queue_returns_existing_active_match(self):
        r = self.cx.post('/api/game/ttt/queue/')
        self.assertEqual(r.json(), {'status': 'matched', 'match_id': self.m.id, 'symbol': 'X'})


class ServerSideRenderingTests(TestCase):
    def setUp(self):
        self.user = mk('ssruser', display_name='Rendered Name')
        MatchHistory.objects.create(user=self.user, game_type='PONG', opponent='AI', result='WIN', score='3-1')

    def test_profile_is_rendered_server_side_for_logged_in_user(self):
        c = client_for(self.user)
        r = c.get('/profile')
        self.assertEqual(r.status_code, 200)
        html = r.content.decode()
        if 'ssr_title' in open('templates/frontend/index.html', encoding='utf-8').read():
            self.assertIn('Profile', html.split('<title>')[1].split('</title>')[0])
            self.assertIn('ssruser', html)
        self.assertEqual(r.context['ssr_page'], 'profile')
        self.assertTrue(r.context['ssr_logged_in'])
        self.assertEqual(r.context['ssr_profile']['username'], 'ssruser')
        self.assertEqual(r.context['ssr_profile']['stats']['games_played'], 1)
        self.assertEqual(r.context['ssr_profile']['match_history'][0]['opponent'], 'AI')

    def test_anonymous_profile_renders_login(self):
        r = Client().get('/profile')
        self.assertEqual(r.context['ssr_page'], 'login')
        if 'ssr_title' in open('templates/frontend/index.html', encoding='utf-8').read():
            self.assertIn('Log in', r.content.decode().split('<title>')[1].split('</title>')[0])

    def test_unknown_and_oauth_paths_fall_back_to_home(self):
        self.assertEqual(Client().get('/oauth/callback?code=x').context['ssr_page'], 'home')
        self.assertEqual(Client().get('/whatever').context['ssr_page'], 'home')
