export interface Player {
  id: string;
  voteId: string;
  isDead: boolean;
  message_ts: string;
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

  votesAreTallied() {
    let votesAreTallied = true;
    let voteCounts: {[votee: string]: number } = {};
    this.players.filter((p: Player) => !p.isDead).map((p: Player) => {
      if (!p.voteId) {
        votesAreTallied = false;
      }
      voteCounts[p.voteId]++;
    })

    if (!votesAreTallied) {
      return [];
    }

    const mostVotes = Object.keys(voteCounts).map((k: string) => voteCounts[k]).sort()[0];
    return Object.keys(voteCounts).filter((k: string) => voteCounts[k] === mostVotes);
  }

  addVote(voter: string, votee: string) {
    this.players.filter((p: Player) => p.id === voter).map((p: Player) => p.voteId = votee);
  }

  voteOff(playerId: string) {
    this.players.filter((p: Player) => p.id === playerId).map((p: Player) => p.isDead = true);
    this.clearVotes();
  }

  clearVotes() {
    this.players.map((p: Player) => p.voteId = '');
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