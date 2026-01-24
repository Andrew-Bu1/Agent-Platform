package api

import (
	"net/http"
)

type Router interface {
	RegisterRouters(mux *http.ServeMux)
}

func RegisterRouters(mux *http.ServeMux, routers ...Router) {
	for _, router := range routers {
		router.RegisterRouters(mux)
	}
}

func methodHandler(handlers map[string]http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if handler, ok := handlers[r.Method]; ok {
			handler(w, r)
		} else {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		}
	}
}