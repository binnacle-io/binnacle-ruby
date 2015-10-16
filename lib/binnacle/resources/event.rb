module Binnacle
  class Event < Resource

    attr_accessor :context_id
    attr_accessor :event_name
    attr_accessor :client_id
    attr_accessor :session_id
    attr_accessor :client_event_time
    attr_accessor :ip_address
    attr_accessor :log_level
    attr_accessor :tags
    attr_accessor :json
    attr_accessor :event_time

    def configure(context_id, event_name, client_id, session_id, log_level, tags = [], json = {})
      self.context_id = context_id
      self.event_name = event_name
      self.client_id = client_id
      self.session_id = session_id
      self.client_event_time = Time.now.strftime("%Y-%m-%dT%H:%M:%S%z")
      self.ip_address = ip_address
      self.log_level = log_level
      self.tags = tags
      self.json = json
    end

    def timestamp=(ts)
      self.client_event_time = ts.strftime("%Y-%m-%dT%H:%M:%S%z")
    end

    def self.from_hash(h)
      event = self.new()
      event.context_id = h['contextId']
      event.event_name = h['eventName']
      event.client_id = h['clientId']
      event.session_id = h['sessionId']
      event.ip_address = h['ipAddress']
      event.log_level = h['logLevel']
      event.event_time = Time.at(h['eventTime']/1000)
      event.tags = h['tags']
      event.json = h['json']

      event
    end

    def to_json
      {
        "contextId": context_id,
        "sessionId": session_id,
        "clientEventTime": client_event_time,
        "eventName": event_name,
        "clientId": client_id,
        "logLevel": log_level,
        "tags": tags,
        "json": json
      }.to_json
    end

    def route
      "/api/events/#{context_id}"
    end

    def self.route(context_id)
      "/api/events/#{context_id}"
    end

    def self.recents(connection, lines, since, context_id)
      path = [self.route(context_id), 'recents'].compact.join('/')

      get(connection, path, {'limit' => lines, 'since' => since})
    end
  end
end
