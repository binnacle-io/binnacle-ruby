require 'binnacle/resources/event'
require 'binnacle/trap/exception_event'

module Binnacle
  class Client

    attr_accessor :api_key, :api_secret
    attr_accessor :connection
    attr_accessor :logging_context_id
    attr_accessor :client_id
    attr_accessor :session_id
    attr_writer   :ready

    def initialize(api_key = nil, api_secret = nil, endpoint = nil, logging_context_id = nil)
      self.api_key = api_key || Binnacle.configuration.api_key
      self.api_secret = api_secret || Binnacle.configuration.api_secret
      if endpoint
        self.connection = Connection.new(self.api_key, self.api_secret, Binnacle.configuration.build_url(endpoint))
      else
        self.connection = Connection.new(self.api_key, self.api_secret)
      end
      self.logging_context_id = logging_context_id
    end

    def signal(context_id, event_name, client_id, session_id, log_level, tags = [], json = {}, asynch = false)
      event = Binnacle::Event.new()
      event.configure(context_id, event_name, client_id, session_id, log_level, tags, json)
      event.connection = connection
      asynch ? event.post_asynch : event.post
    end

    def signal_asynch(context_id, event_name, client_id, session_id, log_level, tags = [], json = {})
      signal(context_id, event_name, client_id, session_id, log_level, tags, json, true)
    end

    def recents(lines, since, context_id)
      Binnacle::Event.recents(connection, lines, since, context_id)
    end

    def report_exception(exception, env, asynch = true)
      event = Binnacle::Trap::ExceptionEvent.new(exception, env)
      event.connection = connection
      asynch ? event.post_asynch : event.post
    end

    #
    # Ruby Logger Implementation
    #

    def formatter
      proc do |severity, datetime, progname, msg|
        assets_log_prefix = "Started GET \"#{Rails.application.config.assets.prefix}" if defined?(Rails)

        unless assets_log_prefix && msg.start_with?(assets_log_prefix)
          client_id = self.client_id || ''
          session_id = self.session_id || ''
          context_id = self.logging_context_id
          event_name = 'log'
          tags = []

          if defined?(ActiveSupport::TaggedLogging)
            if Thread.current[:activesupport_tagged_logging_tags]
              session_id, client_id = Thread.current[:activesupport_tagged_logging_tags].last(2)
            else
              session_id, client_id = "", ""
            end
          end

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
          event = Binnacle::Event.new()
          event.configure(context_id, event_name, client_id, session_id, severity, tags, json)
          event.timestamp = datetime
          event
        end
      end
    end

    def write(event)
      if event
        event.connection = connection
        Binnacle.configuration.asynch_logging ? event.post_asynch : event.post
      end
    end

    def close
      nil
    end

    def ready?
      @ready
    end

  end

end
