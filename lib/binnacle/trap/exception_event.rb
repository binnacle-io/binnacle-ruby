require_relative 'backtrace'
require 'json'

module Binnacle
  module Trap
    HTTP_HEADER_PREFIXES = [
      'HTTP_'.freeze,
      'CONTENT_TYPE'.freeze,
      'CONTENT_LENGTH'.freeze
    ].freeze

    HTTP_HEADER_SKIPS = [
      'HTTP_COOKIE'.freeze,
      'HTTP_X_CSRF_TOKEN'.freeze
    ]

    class ExceptionEvent < ::Binnacle::Event
      attr_reader :exception
      attr_reader :env
      attr_reader :request
      attr_reader :component
      attr_reader :method
      attr_reader :module
      attr_reader :backtrace

      def initialize(exception, env)
        @exception = unwrap_exception(exception)
        @env = env

        if env["action_dispatch.request.parameters"] != nil
          @component = env['action_dispatch.request.parameters'][:controller] || nil
          @method = env['action_dispatch.request.parameters'][:action] || nil
          @module = env['action_dispatch.request.parameters'][:module] || nil
        end

        @request = ::Rack::Request.new(env)

        extract_event_name
        extract_session_id
        extract_client_id
        extract_backtrace

        self.log_level = "EXCEPTION"
        self.tags = []
        build_json_payload

        configure(
          Binnacle.configuration.error_channel,
          self.event_name,
          self.client_id,
          self.session_id,
          self.log_level,
          nil,
          self.tags,
          self.json
        )
      end

      private

      def unwrap_exception(exception)
        if exception.respond_to?(:cause)
          exception.cause
        elsif exception.respond_to?(:original_exception)
          exception.original_exception
        elsif exception.respond_to?(:continued_exception)
          exception.continued_exception
        end || exception
      end

      # The root Exception class name
      def extract_event_name
        self.event_name = @exception.class.to_s
      end

      # The affected User or some identifier that can be used to determine
      # who was affected by the exception (Warden, Devise, etc. should be used
      # if available to get this information)
      def extract_session_id
        self.session_id = (@env["rack.session"] ? @env["rack.session"]["session_id"] : nil) || @request.ip
      end

      def extract_backtrace
        backtrace = Backtrace.parse(@exception.backtrace)
        @backtrace = backtrace.lines.map do |line|
          { number: line.number, file: line.file, method: line.method_name }
        end
      end

      def extract_headers
        http_headers = {}

        http_headers = @env.map.with_object({}) do |(key, value), headers|
          if Binnacle::Trap::HTTP_HEADER_PREFIXES.any? { |prefix| key.to_s.start_with?(prefix) } && !HTTP_HEADER_SKIPS.include?(key.to_s)
            headers[key] = value
          end

          headers
        end

        http_headers
      end

      def extract_framework
        defined?(Rails) ? "Rails" : "unknown"
      end

      def extract_framework_version
        defined?(Rails) ? Rails::VERSION::STRING : "unknown"
      end

      def extract_framework_params
        {}
      end

      def extract_ruby_version
        "#{RUBY_VERSION rescue '?.?.?'} p#{RUBY_PATCHLEVEL rescue '???'} #{RUBY_RELEASE_DATE rescue '????-??-??'} #{RUBY_PLATFORM rescue '????'}"
      end

      def extract_hostname
        require 'socket' unless defined?(Socket)
        Socket.gethostname
      rescue
        'UNKNOWN'
      end

      def extract_libraries_loaded
        libraries = {}
        begin
          libraries = Hash[*Gem.loaded_specs.map{|name, gem_specification| [name, gem_specification.version.to_s]}.flatten]
        rescue
        end

        libraries
      end

      def extract_http_params
        @request.params rescue {}
      end

      def extract_client_id
        session = @env["rack.session"] ? @env["rack.session"].to_hash : {}
        warden_info = session.find { |k,v| k.start_with?('warden.') }
        if warden_info
          self.client_id = warden_info.last.first.first
        else
          self.client_id = ""
        end
      end

      def build_json_payload
        self.json = {
          path: @request.path,
          exception: event_name,
          message: @exception.message,
          component: @component,
          method: @method,
          environment_level: Event.rails_env,
          hostname: extract_hostname,
          user_agent: @request.user_agent,
          ruby_version: extract_ruby_version,
          framework: extract_framework,
          framework_version: extract_framework_version,
          framework_params: extract_framework_params,
          http_params: extract_http_params,
          headers: extract_headers,
          dependencies: extract_libraries_loaded,
          backtrace: @backtrace
        }
      end

    end
  end
end
