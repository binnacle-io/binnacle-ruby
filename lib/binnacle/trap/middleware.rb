module Binnacle
  module Trap
    class Middleware

      def initialize(app)
        @app = app
      end

      def call(env)
        response = @app.call(env)
      rescue Exception => exception
        if Binnacle.configuration.trap?
          exception_class_name = exception.class.name
          unless Configuration::IGNORED_EXCEPTIONS.include?(exception_class_name)
            begin
              Binnacle.logger.debug "Binnacle: reporting exception #{exception_class_name}"
              Binnacle.report_exception(exception, env)
            rescue
              # prevent the observer effect
            end
          end
        else
          raise exception
        end
      end

    end
  end
end
