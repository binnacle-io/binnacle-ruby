module Binnacle
  class Configuration

    DEFAULT_IGNORED_EXCEPTIONS = [
      'ActiveRecord::RecordNotFound',
      'ActionController::RoutingError',
      'ActionController::InvalidAuthenticityToken',
      'CGI::Session::CookieStore::TamperedWithCookie',
      'ActionController::UnknownHttpMethod',
      'ActionController::UnknownAction',
      'AbstractController::ActionNotFound',
      'Mongoid::Errors::DocumentNotFound',
      'ActionController::UnknownFormat',
      'Sinatra::NotFound'
    ].map(&:freeze).freeze

    DEFAULT_PORT = '8080'

    DEFAULT_BACKTRACE_FILTERS = [
      lambda { |line| line.gsub(/^\.\//, "") },
      lambda { |line|
        Gem.path.each{ |path| line.sub!(/#{path}/, "[GEM_ROOT]") unless path.to_s.strip.empty? } if defined?(Gem)
        line
      },
      lambda { |line| line if line !~ %r{lib/binnacle} }
    ].freeze

    # The Binnacle Endpoint (BINNACLE_ENDPOINT) single IP or Array of IPs
    attr_accessor :endpoint

    # The Binnacle Endpoint PORT (BINNACLE_PORT), defaults to 8080 if not encrypted
    attr_accessor :port

    # The application logger Binnacle Context (BINNACLE_APP_LOG_CTX)
    attr_accessor :logging_ctx

    # The application error Binnacle Context (BINNACLE_APP_ERR_CTX)
    attr_accessor :error_ctx

    # An approved publisher API key for the App (BINNACLE_API_KEY)
    attr_accessor :api_key

    # The API secret for the given API key (BINNACLE_API_SECRET)
    attr_accessor :api_secret

    # Whether to redirect rails logging to Binnacle (BINNACLE_RAILS_LOG)
    attr_accessor :intercept_rails_logging

    # Whether to pipe Rails logs as they are (verbose as shit) or just grab action_controller events and single line them (BINNACLE_RAILS_LOG_VERBOSE)
    attr_accessor :rails_verbose_logging

    # Whether to report exceptions to Binnacle (BINNACLE_REPORT_EXCEPTIONS)
    attr_accessor :report_exceptions

    # Exceptions that do not get reported to Binnacle (BINNACLE_IGNORED_EXCEPTIONS)
    attr_accessor :ignored_exceptions

    # Whether to skip reporting exceptions where the headers['X-Cascade'] is set
    # to 'pass'. In Rails typically it means route was not found (404 error).
    attr_accessor :ignore_cascade_pass

    # Whether to make the requests over HTTPS, default is HTTPS
    attr_reader :encrypted

    # Whether to log asynchronoushly via the Ruby logger
    attr_accessor :asynch_logging

    # Array of Events to skip, e.g. ['home#index', 'webhooks#test']
    attr_writer :ignore_actions

    # HTTP outgoing logging options
    attr_accessor :url_whitelist_patterns
    attr_accessor :url_blacklist_patterns
    attr_reader :url_whitelist_pattern
    attr_reader :url_blacklist_pattern

    def initialize
      if ENV['BINNACLE_ENDPOINT']
        self.endpoint    ||= ENV['BINNACLE_ENDPOINT'].include?(',') ? ENV['BINNACLE_ENDPOINT'].split(',') : ENV['BINNACLE_ENDPOINT']
      end

      self.logging_ctx ||= ENV['BINNACLE_APP_LOG_CTX']
      self.error_ctx   ||= ENV['BINNACLE_APP_ERR_CTX']
      self.api_key     ||= ENV['BINNACLE_API_KEY']
      self.api_secret  ||= ENV['BINNACLE_API_SECRET']
      self.intercept_rails_logging = Configuration.set_boolean_flag_for(ENV['BINNACLE_RAILS_LOG'])
      self.rails_verbose_logging = Configuration.set_boolean_flag_for(ENV['BINNACLE_RAILS_LOG_VERBOSE'])
      self.report_exceptions = Configuration.set_boolean_flag_for(ENV['BINNACLE_REPORT_EXCEPTIONS'])
      self.ignored_exceptions ||= ENV['BINNACLE_IGNORED_EXCEPTIONS'] ? DEFAULT_IGNORED_EXCEPTIONS + ENV['BINNACLE_IGNORED_EXCEPTIONS'].split(',') : DEFAULT_IGNORED_EXCEPTIONS
      self.ignore_cascade_pass     ||= true
      self.asynch_logging = Configuration.set_boolean_flag_for(ENV['BINNACLE_RAILS_LOG_ASYNCH'], true)
      @encrypted = Configuration.set_boolean_flag_for(ENV['BINNACLE_ENCRYPTED'], true)

      self.url_whitelist_patterns ||= ENV['BINNACLE_HTTP_LOGGING_WHITELIST'] ? ENV['BINNACLE_HTTP_LOGGING_WHITELIST'].split(',') : []
      self.url_blacklist_patterns ||= ENV['BINNACLE_HTTP_LOGGING_BLACKLIST'] ? ENV['BINNACLE_HTTP_LOGGING_BLACKLIST'].split(',') : []
      @url_whitelist_pattern = /.*/
      @url_blacklist_pattern = nil

      prepare!
    end

    def prepare!
      set_default_port
      set_urls
      set_blacklist_patterns
      set_whitelist_patterns
    end

    def url
      if @urls
        @urls.is_a?(Array) ? @urls.sample : @urls
      end
    end

    def urls
      @urls
    end

    def ready?
      urls? && self.api_key && self.api_secret
    end

    def urls?
      (!@urls.nil? && !@urls.is_a?(Array)) || (@urls.is_a?(Array) && !@urls.empty?)
    end

    def can_setup_logger?
      !self.logging_ctx.nil?
    end

    def intercept_rails_logging?
      self.intercept_rails_logging && !self.logging_ctx.nil?
    end

    def rails_verbose_logging?
      self.rails_verbose_logging
    end

    def trap?
      !self.report_exceptions.nil? && !self.error_ctx.nil?
    end

    def ignore_cascade_pass?
      self.ignore_cascade_pass
    end

    def encrypted?
      self.encrypted
    end

    def build_url(ip_or_host)
      ["#{protocol}://#{ip_or_host}", port].compact.join(":")
    end

    def protocol
      self.encrypted? ? 'https' : 'http'
    end

    def set_urls
      if self.endpoint
        @urls = self.endpoint.is_a?(Array) ? self.endpoint.map { |ep| build_url(ep) } : build_url(endpoint)
      end
    end

    def set_blacklist_patterns
      blacklist_patterns = []

      # don't log binnacle's posts
      if @urls.is_a?(Array)
        @urls.each do |url|
          blacklist_patterns << /#{url}/ if url
        end
      elsif @urls
        blacklist_patterns << /#{@urls}/
      end

      self.url_blacklist_patterns.each do |pattern|
        blacklist_patterns << pattern
      end

      unless blacklist_patterns.empty?
        @url_blacklist_pattern = Regexp.union(blacklist_patterns)
      end
    end

    def set_whitelist_patterns
      whitelist_patterns = []

      self.url_whitelist_patterns.each do |pattern|
        whitelist_patterns << pattern
      end

      unless whitelist_patterns.empty?
        @whitelist_pattern = Regexp.union(whitelist_patterns)
      end
    end

    def endpoint=(value)
      @endpoint = value
      set_urls
    end

    def encrypted=(value)
      @encrypted = value
      set_default_port
      set_urls
    end

    def to_s
      [ :endpoint,
        :logging_ctx,
        :error_ctx,
        :api_key,
        :api_secret,
        :intercept_rails_logging,
        :report_exceptions,
        :ignore_cascade_pass,
        :encrypted,
        :asynch_logging
      ].map { |m| "#{m}: #{self.send(m)}" }.join(', ')
    end

    def self.set_boolean_flag_for(value, default = false)
      !value.nil? ? value.downcase == 'true' : default
    end

    def set_default_port
      self.port ||= ENV['BINNACLE_PORT'] || (self.encrypted? ? nil : DEFAULT_PORT)
    end

    # Set conditions for events that should be ignored
    #
    # Currently supported formats are:
    #  - A single string representing a controller action, e.g. 'users#sign_in'
    #  - An array of strings representing controller actions
    #  - An object that responds to call with an event argument and returns
    #    true iff the event should be ignored.
    #
    # The action ignores are given to 'ignore_actions'. The callable ignores
    # are given to 'ignore'.  Both methods can be called multiple times, which
    # just adds more ignore conditions to a list that is checked before logging.

    def ignore_actions(actions)
      ignore(lamba do |event|
        params = event.payload[:params]
        Array(actions).include?("#{params['controller']}##{params['action']}")
      end)
    end

    def ignore_tests
      @ignore_tests ||= []
    end

    def ignore(test)
      ignore_tests.push(test) if test
    end

    def ignore_nothing
      @ignore_tests = []
    end

    def ignore?(event)
      ignore_tests.any? { |ignore_test| ignore_test.call(event) }
    end

  end
end
