# dev is not very useful because it's hard to point a slack to 127.0.0.1
dev:
	yarn start

deploy:
	yarn build && rsync -av dist/imposter.js dist/slack.js words.json package.json slack_token run golfsinteppadon.com:/var/www/imposter
	ssh golfsinteppadon.com "svc -d /var/www/imposter; killall node; svc -u /var/www/imposter"
