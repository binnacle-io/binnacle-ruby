require 'logger'

module Binnacle
  module Logging

    def self.new(account_id = nil, app_id = nil, logging_context_id = nil, url = nil)
      client = Binnacle::Client.new(account_id, app_id, url, logging_context_id)

      if defined?(ActiveSupport::TaggedLogging)
        logger = ActiveSupport::TaggedLogging.new(Logger.new(client))
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