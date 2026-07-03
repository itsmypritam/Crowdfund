#!/usr/bin/env ruby
require "json"
require "net/http"
require "uri"
require "dotenv/load"

# Initialize the crowdfund campaign on the deployed contract
# Usage: ruby scripts/initialize_campaign.rb

RPC_URL = ENV.fetch("RPC_URL", "https://soroban-testnet.stellar.org")
NETWORK_PASSPHRASE = ENV.fetch("NETWORK_PASSPHRASE", "Test SDF Network ; September 2015")

def rpc_request(method, params)
  uri = URI(RPC_URL)
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  req = Net::HTTP::Post.new(uri)
  req["Content-Type"] = "application/json"
  req.body = JSON.generate({
    jsonrpc: "2.0",
    id: Time.now.to_i,
    method: method,
    params: params
  })
  res = http.request(req)
  JSON.parse(res.body)
end

def main
  contract_id = File.read(".contract_id").strip rescue nil
  unless contract_id
    puts "No .contract_id file found. Deploy the contract first."
    exit 1
  end

  owner = ENV["CAMPAIGN_OWNER"] || ENV["DEPLOYER_ADDRESS"]
  goal = ENV["CAMPAIGN_GOAL"] || "10000000000" # 1000 XLM in stroops
  deadline = (Time.now.to_i + 30 * 24 * 3600).to_s # 30 days from now
  title = "Community Fund"
  description = "Support our open-source project development!"

  unless owner
    puts "CAMPAIGN_OWNER or DEPLOYER_ADDRESS env var required."
    exit 1
  end

  puts "Initializing campaign..."
  puts "  Owner: #{owner}"
  puts "  Goal: #{goal.to_i / 10_000_000} XLM"
  puts "  Deadline: #{Time.at(deadline.to_i)}"

  # Simulate the initialize call
  invoke_result = rpc_request("simulateTransaction", {
    contractId: contract_id,
    method: "initialize",
    args: [
      { type: "address", value: owner },
      { type: "i128", value: goal },
      { type: "u64", value: deadline },
      { type: "string", value: title },
      { type: "string", value: description }
    ],
    source: owner
  })

  if invoke_result["error"]
    puts "Simulation error: #{invoke_result["error"]["message"]}"
    exit 1
  end

  puts "Campaign initialized successfully!"
  puts "Contract ID: #{contract_id}"
  puts "Owner: #{owner}"
end

main if __FILE__ == $0
