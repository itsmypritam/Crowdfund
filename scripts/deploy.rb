#!/usr/bin/env ruby
# Deploy the Soroban crowdfund contract to Stellar testnet.
# Requires the contract WASM be compiled separately (soroban CLI or Rust toolchain).
#
# Usage:
#   1. soroban contract deploy --wasm contract/target/wasm32-unknown-unknown/release/crowdfund.wasm --network testnet
#   2. ruby scripts/deploy.rb CONTRACT_ID   (to save the deployed ID locally)

require "json"
require "dotenv/load"

CONTRACT_ID_FILE = ".contract_id"

if ARGV[0]
  cid = ARGV[0].strip
  File.write(CONTRACT_ID_FILE, cid)
  puts "Contract ID saved: #{cid}"
else
  existing = File.read(CONTRACT_ID_FILE) rescue nil
  if existing
    puts "Current contract ID: #{existing}"
  else
    puts "No contract ID set."
    puts ""
    puts "To deploy:"
    puts "  1. Build:  soroban contract build"
    puts "  2. Deploy: soroban contract deploy --wasm contract/target/wasm32-unknown-unknown/release/crowdfund.wasm --network testnet"
    puts "  3. Save:   ruby scripts/deploy.rb <CONTRACT_ID>"
    puts ""
    puts "Alternatively, deploy using the Soroban CLI Docker image:"
    puts "  docker run --rm -v $(pwd):/workspace stellar/soroban-tools soroban contract deploy ..."
  end
end
