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

    def formatter
      client_id, session_id = '', ''

      proc do |severity, datetime, progname, msg|
        Binnacle::Event.new(account_id, app_id, logging_context_id, progname || 'log', client_id, session_id, severity, [], {message: msg})
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
