#!/usr/bin/env ruby
require "json"
require "net/http"
require "uri"
require "dotenv/load"

# Deploy the Soroban crowdfund contract to Stellar testnet
# Usage: ruby scripts/deploy.rb [--wasm path/to/contract.wasm]

HORIZON_URL = ENV.fetch("HORIZON_URL", "https://horizon-testnet.stellar.org")
RPC_URL = ENV.fetch("RPC_URL", "https://soroban-testnet.stellar.org")
NETWORK_PASSPHRASE = ENV.fetch("NETWORK_PASSPHRASE", "Test SDF Network ; September 2015")

# For deployment you need:
# 1. A funded Stellar account (secret key in FUNDING_SECRET env)
# 2. The compiled contract WASM file

FUNDING_SECRET = ENV["FUNDING_SECRET"]

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

def get_account(address)
  uri = URI("#{HORIZON_URL}/accounts/#{address}")
  res = Net::HTTP.get_response(uri)
  if res.code.to_i == 200
    JSON.parse(res.body)
  else
    nil
  end
end

def get_sequence(address)
  account = get_account(address)
  account ? account["sequence"].to_i : nil
end

def deploy_contract(wasm_path)
  puts "Reading WASM file: #{wasm_path}"
  wasm_bytes = File.binread(wasm_path)
  wasm_base64 = [wasm_bytes].pack("m0")

  puts "Uploading WASM (#{wasm_bytes.size} bytes)..."

  # Step 1: Upload the WASM to the network
  upload_result = rpc_request("uploadContractCode", {
    contractCode: wasm_base64,
    source: ENV["DEPLOYER_ADDRESS"]
  })

  if upload_result["error"]
    puts "Upload error: #{upload_result["error"]["message"]}"
    return nil
  end

  wasm_hash = upload_result["result"]["hash"]
  puts "WASM uploaded. Hash: #{wasm_hash}"

  # Step 2: Create the contract from the uploaded WASM
  puts "Creating contract..."
  create_result = rpc_request("createContract", {
    contractCodeHash: wasm_hash,
    source: ENV["DEPLOYER_ADDRESS"]
  })

  if create_result["error"]
    puts "Create error: #{create_result["error"]["message"]}"
    return nil
  end

  contract_id = create_result["result"]["contractId"]
  puts "Contract created! ID: #{contract_id}"
  contract_id
end

def main
  wasm_path = ARGV[0] || "contract/target/wasm32-unknown-unknown/release/crowdfund.wasm"

  unless File.exist?(wasm_path)
    puts "WASM file not found at #{wasm_path}"
    puts "Build it first: cd contract && cargo build --target wasm32-unknown-unknown --release"
    exit 1
  end

  unless FUNDING_SECRET
    puts "FUNDING_SECRET env var required. Set it in .env or export it."
    exit 1
  end

  contract_id = deploy_contract(wasm_path)
  if contract_id
    puts "\nDeployment complete!"
    puts "Contract ID: #{contract_id}"
    File.write(".contract_id", contract_id)
    puts "Contract ID saved to .contract_id"
  else
    puts "\nDeployment failed."
    exit 1
  end
end

main if __FILE__ == $0
