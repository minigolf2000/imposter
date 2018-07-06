deploy:
	GOOS=linux GOARCH=amd64 go build
	scp main.go imposter words.json golfsinteppadon.com:/var/www/imposter
	# ssh golfsinteppadon.com "cd /var/www/golfsinteppadon.com && go run git clone https://github.com/minigolf2000/golfsinteppadon.com.git /var/www/golfsinteppadon.com"
