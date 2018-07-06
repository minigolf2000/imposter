import * as http from 'http';
import * as fs from 'fs';

let words: string[][];
let path: string = 'words.json';

// fetch("pieces.json").then((resp) => {
//   words = resp.json();
// });

fs.readFile("words.json", "utf8", (error, content) => {
  words = JSON.parse(content) as string[][];
  console.log(words);
});

interface Game {
  ID: string;
  PlayerIDs: string[];
  createdAt: Date;
}

interface SlackRequest {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
}
let games: { [name: string]: Game } = {};


function kickPlayer(player: string) {

  if (player === "0") {
    return {
      "text": "The imposter was defeated!",
      "attachments": [
        {"text": "____ was the imposter with the word *___*"},
        {"text": "/imposter [@player1 @player2...] to start a new game"}
      ]
    }
  } else {
    return {
      "text": "The imposter remains!",
    }
  }
}

function newGame(players: string[]) {
  return {
    "text": `New game started with players: ${players}!`,
    "attachments": [{"text": "/imposter @player to select this person as imposter"}]
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
    Buffer.concat(buffer).toString().split("&").map((param: string) => {
      const [k, v] = param.split("=")
      if (k === "text") {
        body = v;
      }
    })

    let users = body.split(" ");

    let j: { text: string, attachments?: {[text: string]: string }[] };
    if (users.length === 1) {
      j = kickPlayer(users[0]);
    } else {
      j = newGame(users);
    }

    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Content-Type', 'application/json');
    response.writeHead(200);
    response.end(JSON.stringify(j), 'utf-8');
  });
}).listen(1337, '127.0.0.1');

console.log('Server running at http://127.0.0.1:1337/');