require 'binnacle/resources/event'
require 'binnacle/trap/exception_event'
require 'binnacle/logging/formatter'
require 'socket'

module Binnacle
  class Client

    attr_accessor :api_key, :api_secret
    attr_accessor :connection
    attr_accessor :logging_channel_id
    attr_accessor :client_id
    attr_accessor :session_id
    attr_writer   :ready

    def initialize(api_key = nil, api_secret = nil, endpoint = nil, logging_channel_id = nil)
      self.api_key = api_key || Binnacle.configuration.api_key
      self.api_secret = api_secret || Binnacle.configuration.api_secret
      if endpoint
        self.connection = Connection.new(self.api_key, self.api_secret, Binnacle.configuration.build_url(endpoint))
      else
        self.connection = Connection.new(self.api_key, self.api_secret)
      end
      self.logging_channel_id = logging_channel_id || Binnacle.configuration.logging_channel

      self.client_id = ""
      self.session_id = ""

      @formatter = Binnacle::Logging::Formatter.new(self)
    end

    def signal(channel_id, event_name, client_id, session_id, log_level, tags = [], json = {}, asynch = false)
      event = Binnacle::Event.new()
      event.configure(channel_id, event_name, client_id, session_id, log_level, nil, tags, json)
      event.connection = connection
      asynch ? event.post_asynch : event.post
    end

    def signal_asynch(channel_id, event_name, client_id = '', session_id = '', log_level = 'INFO', tags = [], json = {})
      signal(channel_id, event_name, client_id, session_id, log_level, tags, json, true)
    end

    def recents(lines, since, channel)
      Binnacle::Event.recents(connection, lines, since, channel)
    end

    def events(channel, date, start_hour, end_hour, lines)
      Binnacle::Event.events(connection, channel, date, start_hour, end_hour, lines)
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
      @formatter
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
      event.configure(logging_channel_id, event_name, client_id, session_id, 'log', data[:time], [], data)
      write(event)
    end

    def log_http_event(data)
      session_id, client_id = session_and_client_ids
      event_name = %[#{data[:method]} #{data[:url]}]

      event = Binnacle::Event.new()
      event.configure(logging_channel_id, event_name, client_id, session_id, 'log', data[:time], [], data)
      write(event)
    end

    def session_and_client_ids
      if defined?(ActiveSupport::TaggedLogging) && Thread.current[:activesupport_tagged_logging_tags]
        session_id, client_id = Thread.current[:activesupport_tagged_logging_tags].first(2)
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
