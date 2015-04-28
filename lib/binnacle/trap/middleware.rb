module Binnacle
  module Trap
    class Middleware

      def initialize(app)
        @app = app
      end

      def call(env)
        if Binnacle.configuration.trap?
          begin
            response = @app.call(env)
          rescue Exception => exception
            exception_class_name = exception.class.name
            unless Configuration::IGNORED_EXCEPTIONS.include?(exception_class_name)
              begin
                Binnacle.logger.debug "Binnacle: reporting exception #{exception_class_name}"
                Binnacle.report_exception(exception, env)
              rescue
                # prevent the observer effect
              end
            end
          ensure
            raise exception
          end
        else
          super(env)
        end
      end

    end
  end
end
