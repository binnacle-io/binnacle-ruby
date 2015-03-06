require 'logger'

module Binnacle
  module Logging

    def self.new(account_id = nil, app_id = nil, api_key = nil, api_secret = nil, logging_context_id = nil, url = nil, params = nil)
      client = Binnacle::Client.new(account_id, app_id, api_key, api_secret, url, logging_context_id)
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

  end
end
