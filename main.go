package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"math/rand"
	"net/http"
	"net/http/httputil"
	"os"
	"sync"
	"time"

	"github.com/nlopes/slack"
)

type Server struct {
	Server http.Server

	mu    sync.Mutex
	games map[string]*Game
	words [][]string
	mux   *http.ServeMux
	slack *slack.Client
}

type Game struct {
	ID        string
	PlayerIDs []string
	CreatedAt time.Time
}

type JsonFile struct {
	Words [][]string `json:"words"`
}

type Response struct {
	Text string `json:"text"`
}

// POST /end-turn
func (s *Server) handleNewGame(w http.ResponseWriter, r *http.Request) {
	dump, err := httputil.DumpRequest(r, true)
	if err != nil {
		http.Error(w, fmt.Sprint(err), http.StatusInternalServerError)
		return
	}

	fmt.Fprintf(w, "%q", dump)

	slackCommand, err := slack.SlashCommandParse(r)

	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}

	fmt.Println(slackCommand.ChannelID)
	fmt.Println(slackCommand.ChannelName)
	fmt.Println(slackCommand.UserID)
	fmt.Println(slackCommand.UserName)
	fmt.Println(slackCommand.Command)

	// if !slackCommand.ValidateToken(verificationToken) {
	// 	w.WriteHeader(http.StatusUnauthorized)
	// 	return
	// }

	pair := s.words[rand.Intn(len(s.words))]
	villagerWord := pair[0]
	imposterWord := pair[1]

	s.mu.Lock()
	defer s.mu.Unlock()

	// message villagerWord to villagers
	// message imposterWord to imposter
	gameID := "only-support-one-game-for-v0"
	s.games[gameID] = &Game{
		ID:        gameID,
		PlayerIDs: []string{slackCommand.Text},
		CreatedAt: time.Now(),
	}

	fmt.Println(slackCommand)

	fmt.Println(villagerWord)
	fmt.Println(imposterWord)
	fmt.Println(s.games[gameID].PlayerIDs[0])
	writeJSON(w, Response{Text: s.games[gameID].PlayerIDs[0]})
}

func (s *Server) handleKickPlayer(w http.ResponseWriter, r *http.Request) {
}

func (s *Server) cleanupOldGames() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for id, g := range s.games {
		if g.CreatedAt.Add(30 * 24 * time.Hour).Before(time.Now()) {
			delete(s.games, id)
			fmt.Printf("Removed game %s\n", id)
		}
	}
}

func (s *Server) Start() error {
	var jsonFile JsonFile

	b, err := ioutil.ReadFile("words.json")
	if err != nil {
		log.Fatalf("error reading words")
	}

	err = json.Unmarshal(b, &jsonFile)
	if err != nil {
		log.Fatalf("failed to parse words")
	}

	s.mux = http.NewServeMux()
	s.mux.HandleFunc("/game/", s.handleNewGame)
	s.mux.HandleFunc("/game/kick", s.handleKickPlayer)

	s.slack = slack.New(os.Getenv("IMPOSTER_SLACK_TOKEN"))
	s.slack.SetDebug(true)
	rtm := s.slack.NewRTM()
	fmt.Println(rtm)
	s.games = make(map[string]*Game)
	s.words = jsonFile.Words
	s.Server.Handler = s.mux

	go func() {
		for range time.Tick(30 * 24 * time.Hour) {
			s.cleanupOldGames()
		}
	}()
	return s.Server.ListenAndServe()
}

func writeJSON(w http.ResponseWriter, resp interface{}) {
	j, err := json.Marshal(resp)
	if err != nil {
		http.Error(w, "unable to marshal response: "+err.Error(), 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(j)
}

func main() {
	rand.Seed(time.Now().UnixNano())

	server := &Server{
		Server: http.Server{
			Addr: ":9091",
		},
	}
	if err := server.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "error: %s\n", err)
	}
}
