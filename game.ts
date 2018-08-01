export interface Player {
  id: string;
  voteId: string;
  isDead: boolean;
  message_ts: string;
}

interface TalliedVotes {
  votees: string[];
  count: number;
}

const usageString = "`/imposter [villager-word imposter-word] [@player1 @player2 @player3...]` to start game";

export class Game {
  public players: Player[];
  public imposterIndex: number;
  public villagerWord: string;
  public imposterWord: string;
  public channelId: string;
  public createdAt: number;

  constructor(attrs: {}) {
    Object.assign(this, attrs);
  }

  public static fromText(text: string, fallbackWords: string[][], channelId: string): [Game, string] {
    let villagerWord: string, imposterWord: string;
    let players: Player[] = [];
    text.split(" ").forEach((s: string) => {
      if (s[0] === "<" && s[s.length - 1] === ">") {
        const userId = s.slice(s.indexOf("@") + 1, s.lastIndexOf("|") || s.lastIndexOf(">"))
        players.push({
          id: userId,
          voteId: '',
          isDead: false,
          message_ts: '',
        });
      } else if (!villagerWord) {
        villagerWord = s;
      } else if (!imposterWord) {
        imposterWord = s;
      }
    })

    if (!villagerWord && !imposterWord) {
      [villagerWord, imposterWord] = fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
    }
    const imposterIndex = Math.floor(Math.random() * players.length);

    if (players.length < 2) {
      return [null, "At least 3 players are needed to play Imposter!"]
    }
    if (players.length > 10) {
      return [null, "Imposter only supports up to 10 players right now."]
    }
    if (villagerWord && !imposterWord) {
      return [null, usageString];
    }
    return [new Game({
      players: shuffle(players),
      imposterIndex: imposterIndex,
      villagerWord,
      imposterWord,
      channelId,
      createdAt: Date.now(),
    }), ""];
  }

  alivePlayers() {
    return this.players.filter((p: Player) => !p.isDead);
  }

  everyoneHasVoted() {
    return this.alivePlayers().every((p: Player) => p.voteId !== "");
  }

  tallyVotes() {
    let mostVotesCount = 0;
    let voteCounts: {[votee: string]: number} = {};
    this.alivePlayers().forEach((p: Player) => {
      voteCounts[p.voteId] = voteCounts[p.voteId] || 0;
      voteCounts[p.voteId]++;
      mostVotesCount = Math.max(voteCounts[p.voteId], mostVotesCount);
    })

    return {
      votees: Object.keys(voteCounts).filter((id: string) => voteCounts[id] === mostVotesCount),
      count: mostVotesCount,
    };
  }

  addVote(voter: string, votee: string) {
    this.players.filter((p: Player) => p.id === voter).map((p: Player) => p.voteId = votee);
  }

  voteOff(playerId: string) {
    this.players.filter((p: Player) => p.id === playerId).map((p: Player) => p.isDead = true);
    this.clearVotes();
  }

  isOver() {
    return this.alivePlayers().length <= 2 || this.players[this.imposterIndex].isDead;
  }

  clearVotes() {
    this.players.map((p: Player) => p.voteId = '');
  }

  guessIsCorrect(guess: string) {
    return guess.replace(/ /g,'').toLowerCase() === this.villagerWord.replace(/ /g,'').toLowerCase();
  }

  votesDisplayString() {
    const numVotes = this.players.filter((p: Player) => p.voteId).length;
    const numAlivePlayers = this.players.filter((p: Player) => !p.isDead).length
    return `(${numVotes} / ${numAlivePlayers}) players have voted.`
  }
}


// Randomize array element order in-place.
function shuffle(array: Player[]) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}