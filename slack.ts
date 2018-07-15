import Axios, * as axios from 'axios';
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
  "ts": string;
}

const numberEmojis = [
  ":one:", ":two:", ":three:", ":four:", ":five:",
  ":six:", ":seven:", ":eight:", ":nine:", ":keycap_ten:"
];


export namespace Slack {
  const token = fs.readFileSync("slack_token", "utf8");

  export function refreshGameStatusMessageForPlayer(game: Game, player: Player, message_ts?: string) {
    slackIMUser(game, player, message_ts);
  }

  export function openDialog(gameId: string, userId: string, trigger_id: string) {
    return postToSlack("dialog.open", {
      "dialog": openDialogTemplate(gameId, userId),
      "trigger_id": trigger_id
    }).then((r: any) => {
      console.log(r.data)
      r.data.response_metadata.messages.forEach((element: any) => {
        console.log(element);
      });
    }).catch((error) => { console.log(error); });
  }

  function openDialogTemplate(gameId: string, userId: string) {
    return {
      "callback_id": `${gameId}-${userId}`,
      "title": "I am the imposter",
      "submit_label": "Submit",
      "elements": [
        {
          "type": "text",
          "label": "What is the real word?",
          "name": "imposter_word",
          // "hint": "no hint"
        }
      ]
    };
  }

  function slackIMUser(game: Game, player: Player, message_ts: string) {
    return postToSlack("im.open", {"user": player.id})
    .then((r: axios.AxiosResponse) => {
      const j = r.data as imOpenResponse
      // console.log(`Opened IM connection for user ${user}: ${JSON.stringify(r)}`)
      postToSlack(message_ts ? "chat.update" : "chat.postMessage", {
        "message_ts": message_ts,
        "channel": j.channel.id,
        "text": `Your word is *${game.players[game.imposterIndex].id === player.id ? game.imposterWord : game.villagerWord}*.`,
        "attachments": [
          {
            "fallback": "Who do you vote as the imposter?",
            "title": "Who do you vote as the imposter?",
            "callback_id": "vote",
            "color": "good",
            "attachment_type": "default",
            "text": game.players.map((p: Player, i: number) => `${numberEmojis[i]} <@${p.id}>`).join("\n\n"),
            "actions": [...game.players.map((p: Player, i: number) => ({
              "name": "vote",
              "text": numberEmojis[i],
              "type": "button",
              "value": p.id,
            })),{
              "name": "accuse",
              "text": "I am the imposter",
              "type": "button",
              "style": "danger",
              "value": "accuse",
            }],
          },
          {
            "color": "good",
            "attachment_type": "default",
            "text": `(${game.players.filter((p: Player) => p.voteId).length} / ${game.players.filter((p: Player) => !p.isDead).length}) players have voted.`,
          },
        ]
      }).then((r: axios.AxiosResponse) => {
          const j = r.data as chatPostMessageResponse
          // TODO: fix this to not have janky side effects
          player.message_ts = j.ts;

          console.log(`Successfully sent Slack PM to user ${player.id} with ts ${j.ts}`)
        }).catch((error) => { console.log(error); });
    }).catch((error) => { console.log(error); });
  }

  function postToSlack(url: string, body: {}) {
    return Axios.request({
      method: 'POST',
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": `Bearer ${token}`,
      },
      data: JSON.stringify(body),
      url: `https://slack.com/api/${url}`,
    });
  }
}
