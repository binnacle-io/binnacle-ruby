module Binnacle
  class Event < Resource

    attr_accessor :channel_id
    attr_accessor :event_name
    attr_accessor :client_id
    attr_accessor :session_id
    attr_accessor :client_event_time
    attr_accessor :ip_address
    attr_accessor :log_level
    attr_accessor :tags
    attr_accessor :json
    attr_accessor :event_time
    attr_accessor :environment

    def configure(channel_id, event_name, client_id, session_id, log_level, environment = Event.rails_env, ts = Time.now, tags = [], json = {})
      self.channel_id = channel_id
      self.event_name = event_name
      self.client_id = client_id
      self.session_id = session_id
      self.timestamp = ts ? ts : Time.now
      self.log_level = log_level
      self.tags = tags
      self.json = json
      self.environment = environment || Event.rails_env
    end

    def configure_from_logging_progname(progname, channel_id, client_id, session_id, log_level, environment =  Event.rails_env, ts = Time.now, tags = [], json = {})
      if progname.is_a?(Hash)
        self.client_id = progname[:client_id] || client_id
        self.session_id = progname[:session_id] || session_id
        self.channel_id = progname[:channel_id] || channel_id
        self.event_name =  progname[:event_name]
        self.tags = progname[:tags] || tags
        self.json = json
        self.json.merge!(progname[:json]) if progname[:json]
        self.environment = environment || Event.rails_env
      elsif progname.is_a?(String)
        self.client_id = client_id
        self.session_id = session_id
        self.channel_id = channel_id
        self.event_name = progname
        self.tags = tags
        self.json = json
        self.environment = environment || Event.rails_env
      end

      self.timestamp = ts ? ts : Time.now
      self.log_level = log_level
      self.environment = environment || Event.rails_env
    end

    def timestamp=(ts)
      self.client_event_time = ts.strftime("%Y-%m-%dT%H:%M:%S%z")
    end

    def self.from_hash(h)
      event = self.new()
      event.channel_id = h['channelId']
      event.event_name = h['eventName']
      event.client_id = h['clientId']
      event.session_id = h['sessionId']
      event.ip_address = h['ipAddress']
      event.log_level = h['logLevel']
      event.event_time = Time.at(h['eventTime']/1000)
      event.tags = h['tags']
      event.json = h['json']
      event.environment = h['environment']

      event
    end

    def to_json
      {
        "channelId" => channel_id,
        "sessionId" => session_id,
        "clientEventTime" => client_event_time,
        "eventName" => event_name,
        "clientId" => client_id,
        "logLevel" => log_level,
        "tags" => tags,
        "environment" => environment,
        "json" => json
      }.to_json
    end

    def route
      "/api/events/#{channel_id}"
    end

    def self.route(channel)
      "/api/events/#{channel}"
    end

    def self.recents(connection, lines, since, channel, environment = rails_env)
      path = [route(channel), environment, 'recents'].compact.join('/')

      get(connection, path, {'limit' => lines, 'since' => since})
    end

    def self.events(connection, channel, date, start_hour, end_hour, lines, environment = rails_env)
      path = [route(channel), environment, date].compact.join('/')

      get(connection, path, {'start_hour' => start_hour, 'end_hour' => end_hour, 'limit' => lines})
    end

    protected

    def self.rails_env
      defined?(Rails) ? Rails.env : "production"
    end
  end
end
