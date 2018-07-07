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

interface postMessageResponse {
  "ok": boolean;
  "channel": string;
}

export namespace Slack {
  const token = fs.readFileSync("slack_token", "utf8");

  export function sendWord(user: string, word: string, players: string[]) {
    slackIMUser(user, `Your word: ${word}. Playing with ${players.map((player: string) => `<@${player}>`)}`);
  }

  export function usageHint(user: string) {
    slackIMUser(user, "You are the game maker! [/imposter @player] to out a player as imposter");
  }

  function slackIMUser(user: string, message: string) {
    fetch(`https://slack.com/api/im.open?token=${token}&user=${user}`)
    .then((resp: any) => resp.json()).then((r: imOpenResponse) => {
      console.log(`Opened IM connection for user ${user}: ${JSON.stringify(r)}`)
      fetch(`https://slack.com/api/chat.postMessage?token=${token}&channel=${r.channel.id}&text=${message}`)
        .then((resp: Response) => resp.json()).then((r: postMessageResponse) => {
          console.log(`Successfully sent Slack PM to user ${user}: "${message}"`)
        }).catch((error) => { console.log(error); });
    }).catch((error) => { console.log(error); });
  }
}
