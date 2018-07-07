import 'isomorphic-fetch';
import * as fs from 'fs';

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

export namespace Slack {
  const token = fs.readFileSync("slack_token", "utf8");

  export function sendWord(user: string, word: string, players: string[], gameCreator: string, startingPlayerIndex: number) {
    slackIMUser(user, [
      `<@${gameCreator}> started a game of Imposter!`,
      `Your word is *${word}*.`,
      `Playing with ${players.sort().map((player: string, i: number) => `<@${player}>${startingPlayerIndex === i ? " (goes first)" : ""}`).join(", ")}`,
    ].join(" "));
  }

  export function usageHint(user: string) {
    slackIMUser(user, "You are the game maker! `/imposter @player` to out a player as imposter");
  }

  function slackIMUser(user: string, message: string) {
    fetch(`https://slack.com/api/im.open?token=${token}&user=${user}`)
    .then((resp: any) => resp.json()).then((r: imOpenResponse) => {
      // console.log(`Opened IM connection for user ${user}: ${JSON.stringify(r)}`)
      fetch(`https://slack.com/api/chat.postMessage?token=${token}&channel=${r.channel.id}&text=${message}`)
        .then((resp: Response) => resp.json()).then((r: chatPostMessageResponse) => {
          console.log(`Successfully sent Slack PM to user ${user}: "${message}"`)
        }).catch((error) => { console.log(error); });
    }).catch((error) => { console.log(error); });
  }
}
