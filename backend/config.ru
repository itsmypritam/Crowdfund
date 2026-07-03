require_relative "server"

Faye::WebSocket.load_adapter("puma")

run CrowdfundApp
