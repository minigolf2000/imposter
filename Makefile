deploy:
	tsc && rsync -av dist/imposter.js dist/slack.js words.json package.json slack_token run golfsinteppadon.com:/var/www/imposter
	ssh golfsinteppadon.com "svc -d /var/www/imposter; killall node; svc -u /var/www/imposter"
