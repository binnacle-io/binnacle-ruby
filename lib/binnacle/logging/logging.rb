require 'logger'

module Binnacle
  module Logging

    attr_writer :asynch

    def self.new(client, logging_context_id, params = {})
      client.logging_context_id = logging_context_id || Binnacle.configuration.logging_ctx
      client.client_id = params[:client_id] || ''
      client.session_id = params[:session_id] || ''

      if defined?(ActiveSupport::TaggedLogging)
        logger = ActiveSupport::TaggedLogging.new(Logger.new(client))
        logger.formatter = client.formatter
      elsif defined?(ActiveSupport::Logger)
        logger = ActiveSupport::Logger.new(client)
        logger.formatter = client.formatter
      else
        logger = Logger.new(client)
        logger.formatter = client.formatter
      end
      logger
    end

    def self.build(api_key = nil, api_secret = nil, endpoint = nil, logging_context_id = nil, params = {})
      client = Binnacle::Client.new(api_key, api_secret, endpoint, logging_context_id)
      self.new(client, logging_context_id, params)
    end

    def asynch
      @asynch.nil? ? true : @asynch
    end

  end
end
