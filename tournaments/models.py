from django.db import models
from django.db import models

# class Tournament(models.Model):
#     name = models.CharField(max_length=100, default="Tournament")
#     participants_count = models.PositiveIntegerField()
#     created_at = models.DateTimeField(auto_now_add=True)

#     def get_status(self):
#         matches = self.matches.all()
#         if matches.filter(is_complete=False).exists():
#             return "Incomplete"
#         return "Complete"

#     def get_winner(self):
#         # Проверяем, завершены ли все матчи
#         if self.matches.filter(is_complete=False).exists():
#             return None  # Победитель не определен, если есть незавершенные матчи

#         players = self.players.all()
#         max_score = max(player.get_score() for player in players)
#         top_players = [player for player in players if player.get_score() == max_score]

#         if len(top_players) == 1:
#             return top_players[0]  # Возвращаем победителя, если он один
#         return None  # Победитель не определен, если требуется дополнительный турнир

#     # def __str__(self):
#     #     return self.name

# class Player(models.Model):
#     tournament = models.ForeignKey('Tournament', on_delete=models.CASCADE, related_name='players')
#     nickname = models.CharField(max_length=50, unique=True)

#     def get_score(self):
#         # Подсчет побед игрока
#         return Match.objects.filter(winner=self).count()

#     def __str__(self):
#         return f"{self.nickname} ({self.get_score()} очков)"

#     # def __str__(self):
#     #     return self.nickname

# class Match(models.Model):
#     tournament = models.ForeignKey('Tournament', on_delete=models.CASCADE, related_name='matches')
#     player1 = models.ForeignKey('Player', on_delete=models.CASCADE, related_name='player1_matches')
#     player2 = models.ForeignKey('Player', on_delete=models.CASCADE, related_name='player2_matches')
#     score_player1 = models.PositiveIntegerField(null=True, blank=True)
#     score_player2 = models.PositiveIntegerField(null=True, blank=True)
#     winner = models.ForeignKey('Player', null=True, blank=True, on_delete=models.SET_NULL, related_name='won_matches')
#     is_complete = models.BooleanField(default=False)

#     def __str__(self):
#         return f"{self.player1.nickname} vs {self.player2.nickname}"


class Tournament(models.Model):
    name = models.CharField(max_length=100, default="Tournament")
    participants_count = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def get_status(self):
        matches = self.matches.all()
        if matches.filter(is_complete=False).exists():
            return "Incomplete"
        return "Complete"

    def get_winner(self):
        if self.matches.filter(is_complete=False).exists():
            return None
        players = self.players.all()
        max_score = max(player.get_score() for player in players)
        top_players = [player for player in players if player.get_score() == max_score]
        if len(top_players) == 1:
            return top_players[0]
        return None

    def __str__(self):
        return self.name


class Player(models.Model):
    tournament = models.ForeignKey('Tournament', on_delete=models.CASCADE, related_name='players')
    nickname = models.CharField(max_length=50)
    # Make nickname unique for each tournament
    class Meta:
        unique_together = ('tournament', 'nickname')

    def get_score(self):
        return Match.objects.filter(winner=self).count()

    def __str__(self):
        return f"{self.nickname} ({self.get_score()} points)"


class Match(models.Model):
    tournament = models.ForeignKey('Tournament', on_delete=models.CASCADE, related_name='matches')
    player1 = models.ForeignKey('Player', on_delete=models.CASCADE, related_name='player1_matches')
    player2 = models.ForeignKey('Player', on_delete=models.CASCADE, related_name='player2_matches')
    score_player1 = models.PositiveIntegerField(null=True, blank=True)
    score_player2 = models.PositiveIntegerField(null=True, blank=True)
    winner = models.ForeignKey('Player', null=True, blank=True, on_delete=models.SET_NULL, related_name='won_matches')
    is_complete = models.BooleanField(default=False)
    is_additional = models.BooleanField(default=False)  # New field for additional matches

    @classmethod
    def get_match_details(cls, match_id):
        try:
            match = cls.objects.get(id=match_id)
        except cls.DoesNotExist:
            return None  # You could also raise an exception or return an error dict

        return {
            'player1': match.player1.nickname,
            'player2': match.player2.nickname,
            'score_player1': match.score_player1,
            'score_player2': match.score_player2,
            'winner': match.winner.nickname if match.winner else None,
            'is_complete': match.is_complete
        }

    def __str__(self):
        return f"{self.player1.nickname} vs {self.player2.nickname}"