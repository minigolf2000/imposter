Play the Imposter Party Game on Slack!

`/imposter [villager-word imposter-word] [@player1 @player2 @player3...]` to start game

[Slack Imposter App Management Page](https://api.slack.com/apps/ABL52U6N4)

# Deployment
```bash
# Make sure a file named `slack_token` exists that contains the slack app's token
make deploy
```

# One-time Digital Ocean setup
```bash
# Install node using PPA https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-ubuntu-16-04
# Install and run yarn
# Install supervise
supervise /var/www/imposter &
```
