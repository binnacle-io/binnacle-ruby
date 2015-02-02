require 'binnacle/resources/event'

module Binnacle
  class Client

    attr_accessor :account_id, :app_id
    attr_accessor :connection
    attr_accessor :logging_context_id

    def initialize(account_id = nil, app_id = nil, url = nil, logging_context_id = nil)
      self.account_id = account_id || ENV['BINNACLE_ACCOUNT']
      self.app_id = app_id || ENV['BINNACLE_APP']
      self.connection = Connection.new(url)
      self.logging_context_id = logging_context_id || ENV['BINNACLE_CTX']
    end

    def signal(context_id, event_name, client_id, session_id, log_level, tags = [], json = {})
      event = Binnacle::Event.new(account_id, app_id, context_id, event_name, client_id, session_id, log_level, tags, json)
      event.connection = connection
      event.post
    end

    #
    # Ruby Logger Implementation
    #

    def formatter
      proc do |severity, datetime, progname, msg|
        client_id, session_id = '', ''
        context_id = logging_context_id
        event_name = 'log'
        tags = []
        json = { message: msg }

        if progname
          if progname.is_a?(Hash)
            client_id = progname[:client_id] || client_id
            session_id = progname[:session_id] || session_id
            context_id = progname[:context_id] || context_id
            event_name =  progname[:event_name] || event_name
            tags = progname[:tags] || tags
            json.merge!(progname[:json]) if progname[:json]
          elsif progname.is_a?(String)
            event_name = progname
          end
        end
        Binnacle::Event.new(account_id, app_id,context_id, event_name, client_id, session_id, severity, tags, json)
      end
    end

    def write(event)
      event.connection = connection
      event.post
    end

    def close
      nil
    end

  end

end