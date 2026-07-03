#!/usr/bin/env ruby
# Initialize the crowdfund campaign on the deployed contract.
# Uses the soroban CLI to invoke the initialize function.
#
# Usage:
#   ruby scripts/initialize_campaign.rb <CONTRACT_ID> <OWNER_ADDRESS> <GOAL_XLM> <TITLE> <DESCRIPTION>

CONTRACT_ID = ARGV[0] || ENV["CONTRACT_ID"]
OWNER = ARGV[1] || ENV["CAMPAIGN_OWNER"]
GOAL_XLM = ARGV[2] || "1000"
TITLE = ARGV[3] || "Community Fund"
DESC = ARGV[4] || "Support our open-source project development!"

unless CONTRACT_ID && OWNER
  puts "Usage: ruby scripts/initialize_campaign.rb <CONTRACT_ID> <OWNER_ADDRESS> [GOAL_XLM] [TITLE] [DESCRIPTION]"
  puts ""
  puts "Or set CONTRACT_ID and CAMPAIGN_OWNER env vars."
  exit 1
end

goal_stroops = (GOAL_XLM.to_f * 10_000_000).to_i
deadline = (Time.now.to_i + 30 * 24 * 3600).to_s

cmd = "soroban contract invoke" \
  " --id #{CONTRACT_ID}" \
  " --network testnet" \
  " --source-account #{OWNER}" \
  " -- initialize" \
  " --owner #{OWNER}" \
  " --goal #{goal_stroops}" \
  " --deadline #{deadline}" \
  " --title '#{TITLE}'" \
  " --description '#{DESC}'"

puts "Running:"
puts cmd
puts ""
puts "This requires the soroban CLI. Install it with:"
puts "  cargo install soroban-cli"
puts ""
puts "Or run manually with the contract address #{CONTRACT_ID}"
