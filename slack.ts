import 'isomorphic-fetch';
import * as fs from 'fs';
import { Game, Player } from './game';

interface imOpenResponse {
  "ok": boolean;
  "no_op": boolean;
  "already_open": boolean;
  "channel": {
      "id": "D77H9VD47"
  }
}

interface chatPostMessageResponse {
  "ok": boolean;
  "channel": string;
}

const numberEmojis = [
  ":one:", ":two:", ":three:", ":four:", ":five:",
  ":six:", ":seven:", ":eight:", ":nine:", ":keycap_ten:"
];


export namespace Slack {
  const token = fs.readFileSync("slack_token", "utf8");

  export function refreshGameStatusMessageForPlayer(game: Game, player: Player) {
    slackIMUser(game, player);
  }

  function newGameMessage() {

  }

  function updateGameStatus() {

  }

  function openDialogTemplate(gameId: string, userId: string) {
    return {
      "callback_id": `${gameId}-${userId}`,
      "title": "Make final guess",
      "submit_label": "Submit",
      "elements": [
          {
              "type": "text",
              "label": "I am the imposter and I think the real word is",
              "name": "imposter_word",
              // "min_length": 1, does slack already do required check? if so don't need this
              "hint": "I'm being useful"
          }
      ]
    }
  }

  function slackIMUser(game: Game, player: Player) {
    postToSlack("im.open", {"user": player.id})
    .then((resp: any) => resp.json()).then((r: imOpenResponse) => {
      // console.log(`Opened IM connection for user ${user}: ${JSON.stringify(r)}`)
      postToSlack("chat.postMessage", {
        "channel": r.channel.id,
        "text": `Your word is *${game.players[game.imposterIndex].id === player.id ? game.imposterWord : game.villagerWord}*. Turn order is ${game.players.map((player: Player) => `<@${player.id}>`).join(", ")}`,
        "attachments": [
          {
            "fallback": "Who do you vote as the imposter?",
            "title": "Who do you vote as the imposter?",
            "callback_id": "vote",
            "color": "good",
            "attachment_type": "default",
            "text": game.players.map((p: Player, i: number) => `${numberEmojis[i]} <@${p.id}>`).join("\n\n"),
            "actions": game.players.map((p: Player, i: number) => ({
              "name": "vote",
              "text": numberEmojis[i],
              "type": "button",
              "value": p.id,
            })),
          },
          {
            "fallback": "Who do you vote as the imposter?",
            "title": "Who do you vote as the imposter?",
            "color": "good",
            "attachment_type": "default",
            "text": game.players.filter((p: Player) => !p.isDead).map((p: Player, i: number) => `${numberEmojis[i]} <@${p.id}>`).join("\n\n"),
          },
        ]
      })
        .then((resp: Response) => resp.json()).then((r: chatPostMessageResponse) => {
          console.log(`Successfully sent Slack PM to user ${player.id}`)
        }).catch((error) => { console.log(error); });
    }).catch((error) => { console.log(error); });
  }

  function postToSlack(url: string, body: {}) {
    return fetch(`https://slack.com/api/${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(body)
    });
  }
}

function formattedPlayers(players: string[]): string {
  return players.sort().map((player: string) => `<@${player}>`).join(", ");
}