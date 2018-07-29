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

interface chatResponse {
  "ok": boolean;
  "channel": string;
  "ts": string;
}

const numberEmojis = [
  ":one:", ":two:", ":three:", ":four:", ":five:",
  ":six:", ":seven:", ":eight:", ":nine:", ":keycap_ten:"
];


export namespace Slack {
  const token = fs.readFileSync("slack_token", "utf8").trim();

  export function openDialog(gameId: string, userId: string, trigger_id: string) {
    return postToSlack("dialog.open", {
      "dialog": openDialogTemplate(gameId, userId),
      "trigger_id": trigger_id
    }).then((r: any) => {
      console.log(r.data)
      if (r.data.response_metadata) {
        r.data.response_metadata.messages.forEach((element: any) => {
          console.log(element);
        });
      }
    }).catch((error) => { console.log(error); });
  }

  function openDialogTemplate(gameId: string, userId: string) {
    return {
      "callback_id": `${gameId}-${userId}`,
      "title": "Imposter",
      "submit_label": "Submit",
      "elements": [
        {
          "type": "text",
          "label": "Guess the real word.",
          "name": "imposter_word",
          // "hint": "no hint"
        }
      ]
    };
  }

  export function publicStatusMessage(game: Game, text: string) {
    postToSlack("chat.postMessage", {
      "channel": game.channelId,
      "text": text
    });
  }

  export function refreshGameStatusMessageForPlayer(game: Game, player: Player, message_ts?: string) {
    return postToSlack("im.open", {"user": player.id})
    .then((r: axios.AxiosResponse) => {
      const j = r.data as imOpenResponse
      // console.log(`Opened IM connection for user ${user}: ${JSON.stringify(r)}`)
      postToSlack(message_ts ? "chat.update" : "chat.postMessage", {
        "ts": message_ts,
        "channel": j.channel.id,
        "text":
          "Take turns giving clues, then either:\n" +
          "- vote who you think is the imposter\n" +
          "- if you think you are the imposter, guess the real word\n" +
          `Your word is *${game.players[game.imposterIndex].id === player.id ? game.imposterWord : game.villagerWord}*.\n`,
        "attachments": [
          {
            "fallback": "Players",
            "title": "Players\n",
            "callback_id": "vote",
            "color": "good",
            "attachment_type": "default",
            "text": game.players.map((p: Player, i: number) => {
              if (p.id === player.id) {
                return `${numberEmojis[i]} *<@${p.id}>*`;
              } else if (p.id === player.voteId) {
                return `${numberEmojis[i]} <@${p.id}> (you voted)`
              }
              return `${numberEmojis[i]} <@${p.id}>`;
            }).join("\n\n"),
            "actions": game.players.map((p: Player, i: number) =>
              (p.id === player.id) ?
                {
                  "name": "accuse",
                  "text": numberEmojis[i],
                  "type": "button",
                  "style": "danger",
                  "value": "accuse",
                } : {
                  "name": "vote",
                  "text": numberEmojis[i],
                  "type": "button",
                  "value": p.id,
                }
            ),
            "footer": game.votesDisplayString(),
          },
        ]
      }).then((r: axios.AxiosResponse) => {
          const j = r.data as chatResponse
          console.log(`  Response: ${JSON.stringify(j)}`)

          // Fix this to not have janky side effects
          if (!message_ts) {
            game.players.filter((p: Player) => p.id === player.id).map((p: Player) => p.message_ts = j.ts);
          }
        }).catch((error) => { console.log(error); });
    }).catch((error) => { console.log(error); });
  }

  function postToSlack(url: string, body: {}) {
    console.log(`  Posting to ${url}`)
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
