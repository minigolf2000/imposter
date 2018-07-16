import * as http from 'http';
import { readFile } from 'fs';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import { Slack } from './slack';
import { Game, Player } from './game';
import { runInNewContext } from 'vm';

// Request payload when user types command in chat
interface CommandRequest {
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

// Request payload when user clicks a button or submits a
interface ButtonClickRequest {
  type: 'interactive_message';
  actions: [
    {
      name: string;
      type: 'button';
      value: string;
    }
  ]
  callback_id: string;
  user: {id: string, name: string};
  channel: {id: string, name: string};
  team: {id: string, domain: string};
  action_ts: string;
  message_ts: string;
  trigger_id: string;
  attachment_id: string;
  token: string;
  response_url: string;
  original_message: string;
}

// Request payload when user submits their guess for the imposter word through the dialog
interface DialogSubmitRequest {
  type: 'dialog_submission';
  submission: {imposter_word: string};
  callback_id: string;
  user: {id: string, name: string};
  action_ts: string;
  token: string;
  response_url: string;
}

let words: string[][];

readFile("words.json", "utf8", (error, content) => {
  words = JSON.parse(content) as string[][];
});

let games: { [name: string]: Game } = {};

const app = express();
app.use(
  bodyParser.urlencoded({ extended: true })
).use((request: express.Request, response: express.Response, next: () => void) => {
  response.setHeader('Content-Type', 'application/json');
  next();
}).post('/imposter', (request: express.Request, response: express.Response, next: () => void) => {
  console.log(request.body);
  const payload = request.body as CommandRequest;
  const {token, user_id, text} = payload;

  const [game, error] = Game.fromText(text, words, payload.channel_id);

  response.writeHead(200); // Slack apps should always return 200 if they successfully received the request

  if (error) {
    response.end(JSON.stringify({"response_type": "ephemeral", "text": error}), 'utf-8');
    return;
  }

  games['only-game'] = game;

  const newGameMessage = `<@${user_id}> started a game of Imposter with players ${game.players.map((p: Player) => `<@${p.id}>`).join(", ")}!`
  response.end(JSON.stringify({"response_type": "in_channel", "text": newGameMessage}), 'utf-8');


  game.players.forEach((p: Player) => {
    Slack.refreshGameStatusMessageForPlayer(game, p);
  })
  console.log("== Current game state:", game);

}).post('/imposter/action', (request: express.Request, response: express.Response, next: () => void) => {
  const p = JSON.parse(request.body.payload);
  console.log(p);
  if (p.type === 'interactive_message') {
    const payload = p as ButtonClickRequest;
    const action = p.actions[0]; // Slack API returns actions as array, but is only ever length 1
    if (action.name === 'accuse') {
      Slack.openDialog('only-game', payload.user.id, payload.trigger_id)
      return;
    }
    const game = games['only-game'];
    game.addVote(payload.user.id, action.value);

    const votes = game.votesAreTallied()
    if (votes.length === 1) {
      game.voteOff(votes[0]);
    } else if (votes.length === 2) {
      game.clearVotes();
      // tiebreaker message
    }

    game.players.forEach((p: Player) => {
      Slack.refreshGameStatusMessageForPlayer(game, p, payload.message_ts);
    })
    console.log("== Current game state:", game);
  } else if (p.type === 'dialog_submission') {
    const payload = p as DialogSubmitRequest;

    const game = games['only-game'];
    if (game.players[game.imposterIndex].id !== payload.user.id) {
      game.players[game.imposterIndex].isDead = true;
      game.voteOff(payload.user.id);
      const m = `<@${payload.user.id}> is not the imposter. The imposter remains!`

      // The imposter <@${game.players[game.imposterIndex].id}> has won the game with the word *${game.imposterWord}*!
      response.end(JSON.stringify({"response_type": "in_channel", "text": m}), 'utf-8');
    } else {
      if (payload.submission.imposter_word.replace(/ /g,'').toLowerCase() === game.villagerWord.replace(/ /g,'').toLowerCase()) {
        // send victory message
        // Imposter win

        const m = `<@${payload.user.id}> was the imposter and won by guessing *${payload.submission}*!`
        response.end(JSON.stringify({"response_type": "in_channel", "text": m}), 'utf-8');
        //"text": ,
      } else {
        // Imposter lose
        game.voteOff(payload.user.id);
        const m = `<@${payload.user.id}> was the imposter and lost by guessing *${payload.submission}*.`
        game.clearVotes();
        response.end(JSON.stringify({"response_type": "in_channel", "text": m}), 'utf-8');
      }
    }

    game.players.forEach((p: Player) => {
      Slack.refreshGameStatusMessageForPlayer(game, p, payload.action_ts);
    })
    console.log("== Current game state:", game);
  }
}).get('/imposter', (request: express.Request, response: express.Response, next: () => void) => {
  response.end(JSON.stringify(games['only-game']), 'utf-8');
}).listen(1337);

console.log('Imposter Node Server running at http://127.0.0.1:1337/');