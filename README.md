Play the Imposter Party Game on Slack!

`/imposter [@player1 @player2 @player3...]` to start game

Then `/imposter @player` to out people as imposter during the game

# Deployment
```bash
# Make sure a file named `slack_token` exists that contains the slack app's
make deploy
```
token

# One-time Digital Ocean setup
```bash
# Install node using PPA https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-ubuntu-16-04
# Install supervise
supervise /var/www/imposter &
```