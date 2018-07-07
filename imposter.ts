import * as http from 'http';
import { readFile } from 'fs';
import { Slack } from './slack';

let words: string[][];

readFile("words.json", "utf8", (error, content) => {
  words = JSON.parse(content) as string[][];
});

interface Game {
  id: string;
  villagers: string[];
  imposter: string;
  villagerWord: string;
  imposterWord: string;
  createdAt: number;
}

// interface SlackRequest {
//   token: string;
//   team_id: string;
//   team_domain: string;
//   channel_id: string;
//   channel_name: string;
//   user_id: string;
//   user_name: string;
//   command: string;
//   text: string;
//   response_url: string;
//   trigger_id: string;
// }
let games: { [name: string]: Game } = {};

function removePlayer(player: string, userId: string) {
  if (player === games[userId].imposter) {
    const imposterWord = games[userId].imposterWord;
    games[userId] = undefined;
    return {
      "text": `The imposter was defeated! <@${player}> was the imposter with the word *${imposterWord}*!`
    }
  } else if (games[userId].villagers.indexOf(player) !== -1) {
    // Remove player
    games[userId].villagers.splice(games[userId].villagers.indexOf(player), 1);
    if (games[userId].villagers.length <= 1) {
      const { imposter, imposterWord } = games[userId];
      games[userId] = undefined;
      return {
        "text": `<@${player}> is not the imposter. The imposter <@${imposter}> has won the game with the word *${imposterWord}*!`,
      }
    }
    return {
      "text": `<@${player}> is not the imposter. The imposter remains! Players remaining: ${formattedPlayers([...games[userId].villagers, games[userId].imposter])}`,
    }
  } else {
    // error, player not found
    return {
      "text": `Player ${player} is not currently playing this game!`,
      "response_type": "ephemeral"
    }
  }
}

function newGame(players: string[], userId: string) {
  const [villagerWord, imposterWord] = words[Math.floor(Math.random() * words.length)];
  const imposterIndex = Math.floor(Math.random() * players.length);
  let g: Game = {
    id: userId,
    villagers: players.filter((player: string, i: number) => i != imposterIndex),
    imposter: players[imposterIndex],
    createdAt: Date.now(),
    villagerWord,
    imposterWord,
  };

  const startingPlayerIndex = Math.floor(Math.random() * players.length);

  g.villagers.forEach((player: string, index: number) => {
    Slack.sendWord(player, villagerWord, players, userId, startingPlayerIndex);
  })
  Slack.sendWord(g.imposter, imposterWord, players, userId, startingPlayerIndex);
  Slack.usageHint(userId)

  games[userId] = g;

  return {
    "text": [
      `<@${userId}> started a game of Imposter!`,
      `Sending words to ${players.sort().map((player: string, i: number) => `<@${player}>${startingPlayerIndex === i ? " (goes first)" : ""}`).join(", ")}`,
    ].join(" ")
  }
}

function formattedPlayers(players: string[]): string {
  return players.sort().map((player: string) => `<@${player}>`).join(", ");
}

http.createServer(function (request: http.IncomingMessage, response: http.ServerResponse) {
  const { headers, method, url } = request;
  let buffer: Buffer[] = [];
  request.on('error', (err) => {
    console.error(err);
  }).on('data', (chunk: Buffer) => {
    buffer.push(chunk);
  }).on('end', () => {
    let body: string = '';
    let userId: string = '';
    Buffer.concat(buffer).toString().split("&").map((param: string) => {
      const [k, v] = param.split("=")
      if (k === "text") {
        body = decodeURIComponent(v);
      }
      if (k === "user_id") {
        userId = decodeURIComponent(v);
      }
    })

    let players: string[] = [];
    body.split("+").forEach((s: string) => {
      if (s[0] === "<" && s[s.length - 1] === ">") {
        const userId = s.slice(s.indexOf("@") + 1, s.lastIndexOf("|") || s.lastIndexOf(">"))
        players.push(userId);
      }
    })

    let j: { text: string, response_type?: string };
    if (games[userId]) {
      if (players.length === 1) {
        console.log(`== ${userId} is removing player: ${players[0]}`)
        j = removePlayer(players[0], userId);
      } else {
        // Invalid request while game is playing
        j = {
          "text": [
            "Usage: `/imposter @player` to out a player as imposter.",
            `Players remaining: ${formattedPlayers([...games[userId].villagers, games[userId].imposter])}`,
          ].join(" "),
          "response_type": "ephemeral",
        };
      }
    } else {
      if (players.indexOf(userId) === -1) { players.push(userId); }
      if (players.length < 3) {
        j = {"text": "At least 3 players are needed to play Imposter!"};
      } else {
        console.log(`== ${userId} is creating a new game with players: ${players}`)
        j = newGame(players, userId);
      }
    }

    if (games[userId]) {
      console.log("== Current game state:", JSON.stringify(games[userId]));
    }
    console.log();
    response.setHeader('Content-Type', 'application/json');
    response.writeHead(200);
    response.end(JSON.stringify({"response_type": "in_channel", ...j}), 'utf-8');
  });
}).listen(1337);

console.log('Imposter Node Server running at http://127.0.0.1:1337/');