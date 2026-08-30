# tournaments/models.py

from django.db import models

from django.db import models

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
        """Returns the winner of the tournament or creates additional matches if there's a tie."""
        if not self.is_complete():
            return None
            
        # Get players with their scores
        players_with_scores = [(player, player.get_score()) for player in self.players.all()]
        
        # Sort by score (descending)
        players_with_scores.sort(key=lambda x: x[1], reverse=True)
        
        if not players_with_scores:
            return None
            
        max_score = players_with_scores[0][1]
        
        # Get all players with the maximum score
        winners = [player for player, score in players_with_scores if score == max_score]
        
        # If there's only one winner, return them
        if len(winners) == 1:
            return winners[0]
        
        # If there's a tie and no additional matches yet, create them
        existing_additional = self.matches.filter(is_additional=True).exists()

        if len(winners) > 1 and not existing_additional:
            self.create_additional_matches(winners)
            return winners  # Return list of tied players

        # Tiebreakers are played in rounds. Only the latest round decides; if it is
        # complete and still tied, a new round is created among the remaining players.
        additional_matches = list(self.matches.filter(is_additional=True).order_by('id'))
        if additional_matches and all(match.is_complete for match in additional_matches):
            tied = winners
            rounds = self._tiebreak_rounds(additional_matches, tied)
            for round_matches in rounds:
                wins = {p: 0 for p in tied}
                for match in round_matches:
                    if match.winner in wins:
                        wins[match.winner] += 1
                max_wins = max(wins.values())
                tied = [p for p in tied if wins[p] == max_wins]
                if len(tied) == 1:
                    return tied[0]
            # Every round finished and the leaders are still level: play another round
            self.create_additional_matches(tied)
            return tied

        # If we got here, there's still a tie or additional matches aren't complete
        return winners  # Return list of tied players

    def _tiebreak_rounds(self, additional_matches, tied):
        """Split the additional matches (in creation order) into successive round-robins."""
        rounds, remaining, players = [], list(additional_matches), list(tied)
        while remaining:
            size = len(players) * (len(players) - 1) // 2 or 1
            round_matches, remaining = remaining[:size], remaining[size:]
            rounds.append(round_matches)
            wins = {p: 0 for p in players}
            for match in round_matches:
                if match.winner in wins:
                    wins[match.winner] += 1
            max_wins = max(wins.values()) if wins else 0
            players = [p for p in players if wins[p] == max_wins]
        return rounds

    def create_additional_matches(self, tied_players):
        """Create a round-robin of additional (tiebreaker) matches between tied players."""
        # Only unplayed leftovers are discarded; completed tiebreaker rounds are kept
        self.matches.filter(is_additional=True, is_complete=False).delete()

        # Create new additional matches in round-robin format
        for i, player1 in enumerate(tied_players):
            for player2 in tied_players[i+1:]:
                Match.objects.create(
                    tournament=self,
                    player1=player1,
                    player2=player2, 
                    is_additional=True
                )
        return True
    
    def is_complete(self):
        """Check if all regular matches are complete."""
        return not self.matches.filter(is_additional=False, is_complete=False).exists()


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