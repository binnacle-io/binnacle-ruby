module Binnacle
  class Event < Resource

    attr_accessor :account_id
    attr_accessor :app_id
    attr_accessor :context_id
    attr_accessor :event_name
    attr_accessor :client_id
    attr_accessor :session_id
    attr_accessor :client_event_time
    attr_accessor :ip_address
    attr_accessor :log_level
    attr_accessor :tags
    attr_accessor :json

    def initialize(account_id, app_id, context_id, event_name, client_id, session_id, log_level, tags = [], json = {})
      self.account_id = account_id
      self.app_id = app_id
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

    def to_json
      %[
        {
          "accountId": "#{account_id}",
          "appId": "#{app_id}",
          "contextId": "#{context_id}",
          "sessionId": "#{session_id}",
          "clientEventTime": "#{client_event_time}",
          "eventName": "#{event_name}",
          "clientId": "#{client_id}",
          "logLevel": "#{log_level}",
          "tags": #{tags},
          "json": #{json.to_json}
        }
      ]
    end

    def route
      "/api/events/#{account_id}/#{app_id}/#{context_id}"
    end
  end
end
