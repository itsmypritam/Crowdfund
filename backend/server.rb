require "sinatra/base"
require "sinatra/json"
require "faye/websocket"
require "json"
require "net/http"
require "uri"
require "dotenv/load"

class CrowdfundApp < Sinatra::Base
  set :server, :puma
  set :port, ENV.fetch("PORT", 3001).to_i
  set :bind, "0.0.0.0"

  @@contract_id = ENV["CONTRACT_ID"]
  @@last_paging_token = ""
  @@ws_clients = []

  configure do
    set :threaded, true
    set :show_exceptions, false
  end

  error do
    content_type :json
    status 500
    json({ error: "Internal server error" })
  end

  not_found do
    content_type :json
    json({ error: "Not found" })
  end

  before do
    content_type :json
    headers "Access-Control-Allow-Origin" => "*",
            "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers" => "Content-Type"
  end

  options "*" do
    200
  end

  get "/api/contract-id" do
    json({ contractId: @@contract_id })
  end

  post "/api/contract-id" do
    body = JSON.parse(request.body.read)
    if body["contractId"] && !body["contractId"].empty?
      @@contract_id = body["contractId"]
      json({ contractId: @@contract_id })
    else
      status 400
      json({ error: "contractId required" })
    end
  end

  post "/api/donation" do
    body = JSON.parse(request.body.read)
    donor = body["donor"]
    amount = body["amount"]
    hash = body["hash"]

    unless donor && amount && hash
      status 400
      return json({ error: "donor, amount, and hash required" })
    end

    broadcast({
      type: "donation:new",
      donor: donor,
      amount: amount,
      hash: hash,
      timestamp: (Time.now.to_f * 1000).to_i
    })

    json({ ok: true })
  end

  get "/health" do
    json({ status: "ok", contractId: @@contract_id })
  end

  def self.broadcast(data)
    msg = data.to_json
    @@ws_clients.each do |ws|
      ws.send(msg) rescue nil
    end
  end

  def self.add_client(ws)
    @@ws_clients << ws
  end

  def self.remove_client(ws)
    @@ws_clients.delete(ws)
  end
end

Faye::WebSocket.on_ready = lambda do |env|
  ws = Faye::WebSocket.new(env)

  ws.on :open do |_|
    CrowdfundApp.add_client(ws)
    puts "WS client connected (#{CrowdfundApp.class_variable_get(:@@ws_clients).size} total)"
  end

  ws.on :message do |event|
    begin
      data = JSON.parse(event.data)
      case data["type"]
      when "subscribe:campaign"
        cid = data["contractId"]
        CrowdfundApp.class_variable_set(:@@contract_id, cid) if cid && !cid.empty?
        ws.send({ type: "campaign:subscribed", contractId: CrowdfundApp.class_variable_get(:@@contract_id) }.to_json)
      end
    rescue JSON::ParserError
      # ignore
    end
  end

  ws.on :close do |_|
    CrowdfundApp.remove_client(ws)
    puts "WS client disconnected"
  end
end

# Polling thread for contract events
Thread.new do
  loop do
    begin
      cid = CrowdfundApp.class_variable_get(:@@contract_id)
      if cid && !cid.empty?
        horizon = ENV.fetch("HORIZON_URL", "https://horizon-testnet.stellar.org")
        uri = URI("#{horizon}/transactions?limit=20&order=asc&cursor=#{@@last_paging_token}")
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = true
        request = Net::HTTP::Get.new(uri)
        response = http.request(request)

        if response.code.to_i == 200
          data = JSON.parse(response.body)
          records = data["_embedded"]&.dig("records") || []

          records.each do |tx|
            @@last_paging_token = tx["paging_token"]
            next unless tx["successful"]

            CrowdfundApp.broadcast({
              type: "campaign:updated",
              timestamp: (Time.now.to_f * 1000).to_i,
              tx_hash: tx["hash"]
            })
          end
        end
      end
    rescue => e
      puts "Poll error: #{e.message}"
    end
    sleep ENV.fetch("POLL_INTERVAL", "5").to_i
  end
end
