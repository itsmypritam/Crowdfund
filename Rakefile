desc "Start the Ruby backend server"
task :server do
  exec "cd backend && bundle exec puma config.ru"
end

desc "Start the frontend dev server"
task :frontend do
  exec "npm run dev"
end

desc "Build the Soroban contract"
task :contract do
  exec "cd contract && cargo build --target wasm32-unknown-unknown --release"
end

desc "Deploy contract to testnet"
task :deploy do
  exec "ruby scripts/deploy.rb"
end

desc "Initialize campaign"
task :init do
  exec "ruby scripts/initialize_campaign.rb"
end

task default: :server
