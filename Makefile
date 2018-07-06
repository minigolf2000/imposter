deploy:
	tsc imposter.ts && rsync -av imposter.js words.json run golfsinteppadon.com:/var/www/imposter
	ssh golfsinteppadon.com "svc -d /var/www/imposter && killall node && svc -u /var/www/imposter"
