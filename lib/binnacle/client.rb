require 'binnacle/resources/event'
require 'binnacle/trap/exception_event'
require 'socket'

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
      self.logging_context_id = logging_context_id || Binnacle.configuration.logging_ctx

      self.client_id = ""
      self.session_id = ""
    end

    def signal(context_id, event_name, client_id, session_id, log_level, tags = [], json = {}, asynch = false)
      event = Binnacle::Event.new()
      event.configure(context_id, event_name, client_id, session_id, log_level, nil, tags, json)
      event.connection = connection
      asynch ? event.post_asynch : event.post
    end

    def signal_asynch(context_id, event_name, client_id, session_id, log_level, tags = [], json = {})
      signal(context_id, event_name, client_id, session_id, log_level, tags, json, true)
    end

    def recents(lines, since, context)
      Binnacle::Event.recents(connection, lines, since, context)
    end

    def events(context, date, start_hour, end_hour, lines)
      Binnacle::Event.events(connection, context, date, start_hour, end_hour, lines)
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

        unless assets_log_prefix && msg.start_with?(assets_log_prefix)
          session_id, client_id = session_and_client_ids

          event = Binnacle::Event.new()

          if progname
            event.configure_from_logging_progname(progname, logging_context_id, 'log', client_id, session_id, severity, datetime, [], { message: msg })
          else
            event.configure(logging_context_id, 'log', client_id, session_id, severity, datetime, [], { message: msg })
          end

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
      !connection.nil?
    end

    def log_rails_event(data)
      session_id, client_id = session_and_client_ids
      event_name = %[#{data[:method]} #{data[:path]}]

      event = Binnacle::Event.new()
      event.configure(logging_context_id, event_name, client_id, session_id, 'log', data[:time], [], data)
      write(event)
    end

    def log_http_event(data)
      session_id, client_id = session_and_client_ids
      event_name = %[#{data[:method]} #{data[:url]}]

      event = Binnacle::Event.new()
      event.configure(logging_context_id, event_name, client_id, session_id, 'log', data[:time], [], data)
      write(event)
    end

    protected

    def assets_log_prefix
      @assets_log_prefix ||= "Started GET \"#{Rails.application.config.assets.prefix}" if defined?(Rails)
    end

    def session_and_client_ids
      if defined?(ActiveSupport::TaggedLogging) && Thread.current[:activesupport_tagged_logging_tags]
        session_id, client_id = Thread.current[:activesupport_tagged_logging_tags].last(2)
      else
        session_id, client_id = self.session_id, self.client_id
      end

      unless client_id
        # set it to the first non-loopback IP in the list
        client_id = Socket.ip_address_list.find { |ai| ai.ipv4? && !ai.ipv4_loopback? }.ip_address
      end

      [ session_id, client_id ]
    end

  end

end
