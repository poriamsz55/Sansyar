FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/sansyar-api ./cmd/api

FROM alpine:3.21
WORKDIR /app
COPY --from=build /out/sansyar-api /app/sansyar-api
EXPOSE 8080
ENTRYPOINT ["/app/sansyar-api"]
