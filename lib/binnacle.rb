require 'forwardable'
require 'binnacle/configuration'
require 'binnacle/version'
require 'binnacle/errors'
require 'binnacle/connection'
require 'binnacle/resource'
require 'binnacle/client'
require 'binnacle/logging'
require 'binnacle/commands/commands'

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
    options.each do |k,v|
      configuration.send("#{k}=", v) rescue nil if configuration.respond_to?("#{k}=")
    end

    yield(configuration) if block_given?

    if configuration.ready?
      logger.info "Instantiating Binnacle Client..."
      begin
        @client = Client.new()
      rescue Faraday::ConnectionFailed => fcf
        logger.error "Failed to connect to Binnacle. Check your settings!"
      end

      if @client && configuration.can_setup_logger?
        logger.info "Configuring Binnacle Rails logger..."
        @rails_logger = Logging.new(@client, configuration.logging_ctx, Rails.application.config)
        @rails_logger.level = 1
        Rails.logger.extend(ActiveSupport::Logger.broadcast(@rails_logger))
        Rack::Timeout.unregister_state_change_observer(:logger) if Rails.env.development?
      end
    end
  end

  def self.logger
    @logger ||= defined?(Rails) ? Rails.logger : Logger.new(STDOUT)
  end

end

if defined?(Rails::Railtie)
  require 'binnacle/trap/middleware'
  require 'binnacle/trap/railtie'
end
