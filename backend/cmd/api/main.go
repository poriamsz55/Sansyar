package main

import "sansyar/backend/cmd/api/bootstrap"

// @title Sansyar Sports Venue API
// @version 1.0
// @description REST API for sports venue discovery, scheduling, booking, payments, wallets, and owner operations.
// @BasePath /api/v1
func main() {
	bootstrap.RunApp()
}
