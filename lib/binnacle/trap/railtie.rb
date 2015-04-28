module Binnacle
  module Trap
    class Railtie < ::Rails::Railtie
      initializer "binnacle.middleware" do |app|
        Binnacle.logger.info "Installing Rails Binnacle Middleware..."
        exception_class = defined?(ActionDispatch::DebugExceptions) ? "DebugExceptions" : "ShowExceptions"
        app.config.middleware.insert_after "ActionDispatch::#{exception_class}", "Binnacle::Trap::Middleware"
      end
    end
  end
end
