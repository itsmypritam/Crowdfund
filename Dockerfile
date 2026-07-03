FROM node:22-slim AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM ruby:3.4-slim
RUN apt-get update -qq && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/Gemfile backend/Gemfile.lock ./
RUN bundle install --jobs 4 --retry 3
COPY backend/ .
COPY --from=frontend-builder /app/dist /app/dist
EXPOSE 3001
CMD ["bundle", "exec", "puma", "config.ru", "-b", "tcp://0.0.0.0:3001"]
