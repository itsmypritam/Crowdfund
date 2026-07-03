require_relative "server"

class WebSocketMiddleware
  def initialize(app)
    @app = app
  end

  def call(env)
    if Faye::WebSocket.websocket?(env)
      ws = Faye::WebSocket.new(env)

      ws.on :open do |_|
        CrowdfundApp.add_client(ws)
        puts "WS client connected (#{CrowdfundApp.ws_clients.size} total)"
      end

      ws.on :message do |event|
        begin
          data = JSON.parse(event.data)
          case data["type"]
          when "subscribe:campaign"
            cid = data["contractId"]
            if cid && !cid.empty?
              CrowdfundApp.class_variable_set(:@@contract_id, cid)
            end
            ws.send({ type: "campaign:subscribed", contractId: CrowdfundApp.class_variable_get(:@@contract_id) }.to_json)
          end
        rescue JSON::ParserError
        end
      end

      ws.on :close do |_|
        CrowdfundApp.remove_client(ws)
        puts "WS client disconnected"
      end

      ws.rack_response
    else
      @app.call(env)
    end
  end
end

use WebSocketMiddleware

run CrowdfundApp
