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

function refreshGameStatusMessages(game: Game) {
  game.alivePlayers().forEach((p: Player) => {
    if (game.isOver()) {
      Slack.pmPlayerReplaceUIWithText(game, p, "Game is over!");
    } else {
      Slack.refreshGameStatusMessageForPlayer(game, p);
    }
  })
  if (game.isOver()) {
    delete games['only-game'];
  }
}

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
  refreshGameStatusMessages(game);

}).post('/imposter/action', (request: express.Request, response: express.Response, next: () => void) => {
  const payload: ButtonClickRequest | DialogSubmitRequest = JSON.parse(request.body.payload);

  if (payload.type === 'interactive_message') {
    console.log(payload);
    const action = payload.actions[0]; // Slack API returns actions as array, but is only ever length 1
    if (action.name === 'dialog_open') {
      Slack.openDialog('only-game', payload.user.id, payload.trigger_id)
      return;
    }
    const game = games['only-game'];
    game.addVote(payload.user.id, action.value);

    if (game.everyoneHasVoted()) {
      const talliedVotes = game.tallyVotes()
      if (talliedVotes.votees.length === 1) {
        Slack.publicStatusMessage(game, `<@${talliedVotes.votees[0]}> has been voted off with ${talliedVotes.count} votes! The imposter remains!`);
        game.voteOff(talliedVotes.votees[0]);
      } else {
        Slack.publicStatusMessage(game, `${talliedVotes.votees.map((id: string) => `<@${id}>`).join(", ")} are tied with ${talliedVotes.count} vote${talliedVotes.count !== 1 ? 's' : ''} each! Voted players must clue-off, then redo voting for this round.`);
        game.clearVotes();
      }
    }

    response.send('');
    refreshGameStatusMessages(game);

  } else if (payload.type === 'dialog_submission') {
    console.log(payload);
    const game = games['only-game'];
    response.send('');
    let responseText = '';

    const player = game.alivePlayers().filter((p: Player) => p.id === payload.user.id)[0];
    if (game.players[game.imposterIndex].id === payload.user.id) {
      if (game.guessIsCorrect(payload.submission.imposter_word)) {
        responseText = `<@${payload.user.id}> guessed the word *${payload.submission.imposter_word}* and is the imposter. The imposter wins!`
        Slack.pmPlayerReplaceUIWithText(game, player, `You are the imposter and correctly guessed *${game.villagerWord}*. The imposter wins!`)
      } else {
        responseText = `<@${payload.user.id}> guessed the word *${payload.submission.imposter_word}* and was the imposter. The imposter loses!`
        game.voteOff(payload.user.id);
        Slack.pmPlayerReplaceUIWithText(game, player, `You guessed the word *${payload.submission.imposter_word}* and you were the imposter. The word was *${game.villagerWord}*. The imposter loses!`)
        game.clearVotes();
      }
    } else {
      responseText = `<@${payload.user.id}> guessed the word *${payload.submission.imposter_word}* but is not the imposter. The imposter remains!`
      game.players[game.imposterIndex].isDead = true;
      game.voteOff(payload.user.id);
      Slack.pmPlayerReplaceUIWithText(game, player, `You guessed the word *${payload.submission.imposter_word}* but you are not the imposter. The imposter remains!`)
    }

    Slack.publicStatusMessage(game, responseText);
    refreshGameStatusMessages(game);
  }
}).get('/imposter', (request: express.Request, response: express.Response, next: () => void) => {
  response.end(JSON.stringify(games['only-game'] || {}), 'utf-8');
}).listen(1337);

console.log('Imposter Node Server running at http://127.0.0.1:1337/');
