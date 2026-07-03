FROM ruby:3.4-slim

RUN apt-get update -qq && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/Gemfile backend/Gemfile.lock ./
RUN bundle install --jobs 4 --retry 3

COPY backend/ .

EXPOSE 3001

CMD ["bundle", "exec", "ruby", "server.rb"]
