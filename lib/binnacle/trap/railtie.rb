module Binnacle
  module Trap
    class Railtie < ::Rails::Railtie
      initializer "binnacle.middleware" do |app|
        Binnacle.logger.info "Installing Rails Binnacle Middleware..."

        # Exception Trapping
        exception_class = defined?(ActionDispatch::DebugExceptions) ? "DebugExceptions" : "ShowExceptions"
        app.config.middleware.insert_after "ActionDispatch::#{exception_class}", "Binnacle::Trap::Middleware"
      end

      # Logging
      config.after_initialize do |app|
        if Binnacle.configuration.intercept_rails_logging? && !Binnacle.configuration.rails_verbose_logging?
          Binnacle::Logging::RequestLogSubscriber.attach_to :action_controller
        end
      end
    end
  end
end
