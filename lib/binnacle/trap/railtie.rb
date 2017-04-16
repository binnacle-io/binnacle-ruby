module Binnacle
  module Trap
    class Railtie < ::Rails::Railtie
      initializer "binnacle.middleware" do |app|
        Binnacle.binnacle_logger.info "Installing Rails Binnacle Middleware..."

        # Exception Trapping
        if ::Rails::VERSION::MAJOR >= 5
          app.config.middleware.insert_after ActionDispatch::DebugExceptions, Binnacle::Trap::Middleware
        else
          exception_class = defined?(ActionDispatch::DebugExceptions) ? "DebugExceptions" : "ShowExceptions"
          app.config.middleware.insert_after "ActionDispatch::#{exception_class}", "Binnacle::Trap::Middleware"
        end
      end

      # Logging
      config.before_configuration do |app|
        app.config.log_tags = [ :uuid, :remote_ip ]
      end

      config.after_initialize do |app|
        if Binnacle.configuration.intercept_rails_logging? && !Binnacle.configuration.rails_verbose_logging?
          Binnacle::Logging::RequestLogSubscriber.attach_to :action_controller
        end
      end
    end
  end
end
