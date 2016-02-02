require 'forwardable'
require 'binnacle/configuration'
require 'binnacle/version'
require 'binnacle/errors'
require 'binnacle/connection'
require 'binnacle/resource'
require 'binnacle/client'
require 'binnacle/logging'
require 'binnacle/commands/commands'

require 'binnacle/http_logging/http_logger'
require 'binnacle/http_logging/adapters/net_http'
require 'binnacle/http_logging/adapters/httpclient'
require 'binnacle/http_logging/adapters/excon'
require 'binnacle/http_logging/adapters/ethon'
require 'binnacle/http_logging/adapters/patron'
require 'binnacle/http_logging/adapters/http'
require 'binnacle/http_logging/adapters/typhoeus'

require 'rack-timeout'

module Binnacle
  extend Forwardable
  def_delegators :@client, :signal, :signal_asynch, :recents, :report_exception

  [:signal, :signal_asynch, :recents, :report_exception].each do |m|
    self.module_eval do
      module_function(m)
    end
  end

  LOCK = Mutex.new

  def self.configuration
    @configuration || LOCK.synchronize { @configuration ||= Binnacle::Configuration.new }
  end

  def self.configure(options = {})
    set_options(options)

    yield(configuration) if block_given?

    configuration.prepare!

    if configuration.ready?
      create_client
      setup_logger
    end
  end

  def self.logger
    @logger ||= defined?(Rails) ? Rails.logger : Logger.new(STDOUT)
  end

  def self.logger=(logger)
    @logger = logger
  end

  def self.set_options(options)
    options.each do |k,v|
      configuration.send("#{k}=", v) rescue nil if configuration.respond_to?("#{k}=")
    end
  end

  def self.create_client
    logger.info "Instantiating Binnacle Client..."
    begin
      @client = Client.new()
    rescue Faraday::ConnectionFailed => fcf
      logger.error "Failed to connect to Binnacle. Check your settings!"
    end
  end

  def self.setup_logger
    if @client && configuration.can_setup_logger?
      if defined?(Rails)
        logger.info "Configuring Binnacle Rails logger..."
        @rails_logger = Logging.new(@client, configuration.logging_ctx, Rails.application.config)
        @rails_logger.level = 1
        Rails.logger.extend(ActiveSupport::Logger.broadcast(@rails_logger)) if configuration.rails_verbose_logging?
        Rack::Timeout.unregister_state_change_observer(:logger) if Rails.env.development?
      else
        logger.info "Skipping Binnacle Rails logger configuration..."
      end
    end
  end

  def self.rails_logger
    @rails_logger
  end

  def self.client
    @client
  end

end

if defined?(Rails::Railtie)
  require 'binnacle/trap/middleware'
  require 'binnacle/trap/railtie'
  require 'binnacle/request_log_subscriber'
end
