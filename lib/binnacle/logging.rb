require 'logger'

module Binnacle
  module Logging

    attr_writer :asynch

    def self.new(client, logging_context_id, app_config = nil, params = {})
      client.logging_context_id = logging_context_id
      client.client_id = params[:client_id] || ''
      client.session_id = params[:session_id] || ''

      if defined?(ActiveSupport::TaggedLogging)
        # add :uuid and :remote_ip to the tags to be passed by the application
        if app_config
          tags = app_config.log_tags
          if tags
            app_config.log_tags = (tags - [ :uuid, :remote_ip ]) + [ :uuid, :remote_ip ]
          else
            app_config.log_tags = [ :uuid, :remote_ip ]
          end
        end
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

    def self.build(api_key = nil, api_secret = nil, endpoint = nil, logging_context_id = nil, app_config = nil, params = {})
      client = Binnacle::Client.new(api_key, api_secret, endpoint, logging_context_id)
      self.new(client, logging_context_id, app_config, params)
    end

    def asynch
      @asynch.nil? ? true : @asynch
    end

  end
end
