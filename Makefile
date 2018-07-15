# dev is not very useful because it's hard to point a slack to 127.0.0.1
dev:
	yarn start

deploy:
	rm -rf dist
	yarn build
	rsync -av dist/* words.json package.json slack_token run golfsinteppadon.com:/var/www/imposter
	ssh golfsinteppadon.com "svc -d /var/www/imposter; killall node; svc -u /var/www/imposter"
