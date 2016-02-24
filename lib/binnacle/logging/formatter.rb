require 'binnacle/resources/event'

module Binnacle
  module Logging
    class Formatter
      def initialize(client)
        @client = client
      end

      def call(severity, datetime, progname, msg)
        unless assets_log_prefix && msg.start_with?(assets_log_prefix)
          session_id, client_id = @client.session_and_client_ids

          event = Binnacle::Event.new()

          logging_tags = current_tags.dup

          if progname
            event.configure_from_logging_progname(progname, @client.logging_context_id, client_id, session_id, severity, datetime, [], { message: msg })
          elsif defined?(ActiveSupport::TaggedLogging) && logging_tags && !logging_tags.empty? && logging_tags.size > 2
            logging_tags.shift(2)
            event_name = logging_tags.shift
            event.configure_from_logging_progname(event_name, @client.logging_context_id, client_id, session_id, severity, datetime, logging_tags, { message: msg })
          else
            event.configure(@client.logging_context_id, 'log', client_id, session_id, severity, datetime, [], { message: msg })
          end

          event
        end
      end

      def tagged(*tags)
        new_tags = push_tags(*tags)
        yield self
      ensure
        pop_tags(new_tags.size)
      end

      def push_tags(*tags)
        tags.flatten.reject(&:blank?).tap do |new_tags|
          current_tags.concat new_tags
        end
      end

      def pop_tags(size = 1)
        current_tags.pop size
      end

      def clear_tags!
        current_tags.clear
      end

      def current_tags
        Thread.current[:activesupport_tagged_logging_tags] ||= []
      end

      def assets_log_prefix
        @assets_log_prefix ||= "Started GET \"#{Rails.application.config.assets.prefix}" if defined?(Rails)
      end
    end
  end
end
