import * as http from 'http';
import * as fs from 'fs';
import { Slack } from './slack';

let words: string[][];
let path: string = 'words.json';

fs.readFile("words.json", "utf8", (error, content) => {
  words = JSON.parse(content) as string[][];
});

interface Game {
  id: string;
  villagers: string[];
  imposter: string;
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


function kickPlayer(player: string, userId: string) {
  if (player === games[userId].imposter) {
    games[userId] = undefined;
    return {
      "text": "The imposter was defeated!",
      "attachments": [
        {"text": "____ was the imposter with the word *___*"},
        {"text": "/imposter [@player1 @player2...] to start a new game"}
      ]
    }
  } else if (games[userId].villagers.indexOf(player) !== -1) {
    return {
      "text": "The imposter remains!",
    }
  } else {
    // error, player not found
    return {
      "text": "This player is not in your game!",
    }
  }
}

function newGame(players: string[], userId: string) {
  if (players.indexOf(userId) === -1) { players.push(userId); }

  const [villagerWord, imposterWord] = words[Math.floor(Math.random() * words.length)];
  const imposterIndex = Math.floor(Math.random() * players.length);
  let g: Game = {
    id: userId,
    villagers: players,
    imposter: players[imposterIndex],
    createdAt: Date.now(),
  };
  g.villagers.splice(imposterIndex, 1) // remove imposter from villagers list

  g.villagers.forEach((player: string, index: number) => {
    Slack.sendWord(player, villagerWord, players);
  })
  Slack.sendWord(g.imposter, imposterWord, players);
  Slack.usageHint(userId)

  games[userId] = g;

  return {
    "text": `New game started! I've sent words to: ${players.map((player: string) => `<@${player}>`)}!`,
  }
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

    
    let users: string[] = [];
    body.split("+").forEach((s: string) => {
      if (s[0] === "<" && s[s.length - 1] === ">") {
        const userId = s.slice(s.indexOf("@") + 1, s.lastIndexOf("|") || s.lastIndexOf(">"))
        users.push(userId);
      }
    })

    users.push("U76JT0P0B") // add a fake user for testing LOL

    console.log(users);

    let j: { text: string, attachments?: {[text: string]: string }[] };
    if (users.length === 1) {
      j = kickPlayer(users[0], userId);
    } else {
      j = newGame(users, userId);
    }

    console.log(buffer.toString())
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Content-Type', 'application/json');
    response.writeHead(200);
    response.end(JSON.stringify({"response_type": "in_channel", ...j}), 'utf-8');
  });
}).listen(1337, '127.0.0.1');

console.log('Server running at http://127.0.0.1:1337/');