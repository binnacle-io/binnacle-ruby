module Binnacle
  module Trap
    class Middleware

      def initialize(app)
        @app = app
      end

      def call(env)
        _, headers, _ = response = @app.call(env)
        response
      rescue Exception => exception
        if report?(exception, headers)
          begin
            Binnacle.binnacle_logger.debug "Binnacle: reporting exception: #{exception.class.name}"
            Binnacle.report_exception(exception, env)
          rescue
            # prevent the observer effect
          ensure
            raise
          end
        else
          raise
        end
      end

      def report?(exception, headers)
        exception_class_name = exception.class.name
        if Binnacle.configuration.trap?
          if Binnacle.configuration.ignore_cascade_pass?
            if headers && headers['X-Cascade']
              report = headers['X-Cascade'] != 'pass'
            else
              report = true
            end
          end
          Binnacle.configuration.ignored_exceptions.include?(exception_class_name) ? false : report
        else
          false
        end
      end

    end
  end
end
